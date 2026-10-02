import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BLOOM } from '../config'

const CRTShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uScanline: { value: 0.12 },
    uAberration: { value: 0.0016 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.05 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uScanline;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      // slight barrel distortion
      uv = 0.5 + c * (1.0 + 0.055 * r2);

      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // chromatic aberration, stronger toward edges
      float ab = uAberration * (0.35 + r2 * 2.4);
      vec2 dir = normalize(c + 1e-6);
      float r = texture2D(tDiffuse, uv - dir * ab).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + dir * ab).b;
      vec3 col = vec3(r, g, b);

      // scanlines
      float sl = sin(uv.y * uResolution.y * 1.15) * 0.5 + 0.5;
      col *= 1.0 - uScanline * sl;

      // rolling bright band
      float roll = smoothstep(0.0, 0.08, abs(fract(uv.y + uTime * 0.06) - 0.5));
      col *= 0.985 + 0.03 * roll;

      // grain
      float n = hash(uv * uResolution + fract(uTime) * 91.7);
      col += (n - 0.5) * uGrain;

      // vignette
      float vig = smoothstep(0.95, 0.18, r2 * uVignette * 1.9);
      col *= mix(0.42, 1.0, vig);

      // neon lift in the shadows
      col = pow(max(col, 0.0), vec3(0.94));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

export interface Post {
  composer: EffectComposer
  setSize(w: number, h: number, dpr: number): void
  render(t: number): void
  dispose(): void
}

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): Post {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold,
  )
  composer.addPass(bloom)

  const crt = new ShaderPass(CRTShader)
  composer.addPass(crt)

  const setSize = (w: number, h: number, dpr: number) => {
    composer.setPixelRatio(dpr)
    composer.setSize(w, h)
    bloom.resolution.set(w * dpr, h * dpr)
    ;(crt.uniforms.uResolution.value as THREE.Vector2).set(w * dpr, h * dpr)
  }

  setSize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio, 2))

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    crt.uniforms.uGrain.value = 0
    crt.uniforms.uScanline.value = 0.05
  }

  return {
    composer,
    setSize,
    render(t: number) {
      crt.uniforms.uTime.value = t
      composer.render()
    },
    dispose() {
      composer.dispose()
      bloom.dispose()
    },
  }
}
