import * as THREE from 'three'
import { CAMERA, FOG, GRID, RING, SUN, THEME } from '../config'

export interface World {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  ring: THREE.Group
  clock: THREE.Clock
  resize(): void
  updateUniforms(t: number): void
}

function createSun(): THREE.Mesh {
  const geo = new THREE.CircleGeometry(SUN.radius, 128)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(THEME.sunTop) },
      uBottom: { value: new THREE.Color(THEME.sunBottom) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));

        // retro horizontal bands, widening toward the top
        float band = 0.0;
        for (int i = 0; i < 8; i++) {
          float fi = float(i);
          float y = 0.30 + fi * 0.088;
          float th = 0.004 + fi * 0.0085;
          band += smoothstep(th, 0.0, abs(vUv.y - y));
        }
        // only cut in the upper portion
        band *= smoothstep(0.26, 0.62, vUv.y);

        float drift = sin(uTime * 0.5) * 0.006;
        float a = clamp(1.0 - band - drift, 0.0, 1.0);

        // soft edge so the disc does not alias
        float rr = length(vUv - 0.5) * 2.0;
        a *= smoothstep(1.0, 0.88, rr);

        gl_FragColor = vec4(col, a);
      }
    `,
  })

  const sun = new THREE.Mesh(geo, mat)
  sun.position.set(0, SUN.y, SUN.z)
  sun.renderOrder = -10
  sun.userData.shaderTime = true
  return sun
}

function createGrid(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(GRID.size, GRID.size, 1, 1)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uCyan: { value: new THREE.Color(THEME.cyan) },
      uMagenta: { value: new THREE.Color(THEME.magenta) },
      uScroll: { value: GRID.scroll },
      uOpacity: { value: GRID.opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uScroll;
      uniform float uOpacity;
      uniform vec3 uCyan;
      uniform vec3 uMagenta;
      varying vec2 vUv;
      varying vec3 vWorld;

      float gridLine(float coord, float w) {
        float g = abs(fract(coord) - 0.5);
        return 1.0 - smoothstep(w, w + w * 0.6, g);
      }

      void main() {
        float x = vWorld.x;
        float z = vWorld.z + uTime * uScroll;

        // world-space grid: the perspective divide provides convergence for free
        float gx = gridLine(x * 0.35, 0.035);
        float gz = gridLine(z * 0.35, 0.035);
        float lines = clamp(gx * 0.7 + gz, 0.0, 1.0);

        // distance fade: hide behind the camera, soften at the horizon
        float dist = length(vWorld.xz);
        float near = smoothstep(3.0, 20.0, dist);
        float far = 1.0 - smoothstep(60.0, 130.0, dist);
        float mask = near * far;

        // anti-alias the lines as they recede
        float fadeWidth = clamp(dist * 0.004, 0.015, 0.2);
        float gx2 = gridLine(x * 0.35, fadeWidth);
        float gz2 = gridLine(z * 0.35, fadeWidth);
        lines = clamp(gx2 * 0.7 + gz2, 0.0, 1.0);

        vec3 col = mix(uCyan, uMagenta, smoothstep(8.0, 60.0, dist));

        float a = lines * mask * uOpacity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col * (0.5 + lines * 1.2), a);
      }
    `,
  })

  const grid = new THREE.Mesh(geo, mat)
  grid.rotation.x = -Math.PI / 2
  grid.position.y = GRID.y
  grid.renderOrder = -8
  grid.userData.shaderTime = true
  return grid
}

function createStars(): THREE.Points {
  const count = 1600
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const c1 = new THREE.Color(THEME.cyan)
  const c2 = new THREE.Color(THEME.magenta)
  const c3 = new THREE.Color(0xffffff)

  for (let i = 0; i < count; i++) {
    const r = 70 + Math.random() * 130
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(1 - Math.random() * 1.05)

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.5 + 6
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

    const pick = Math.random()
    const c = pick > 0.84 ? c3 : pick > 0.42 ? c1 : c2
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    sizes[i] = 0.7 + Math.random() * 2.1
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float size;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      void main() {
        vColor = color;
        vTwinkle = 0.5 + 0.5 * sin(uTime * 1.6 + position.x * 0.3 + position.z * 0.18);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float m = smoothstep(0.5, 0.04, length(d));
        gl_FragColor = vec4(vColor, m * vTwinkle * 0.9);
      }
    `,
    vertexColors: true,
  })

  const points = new THREE.Points(geo, mat)
  points.renderOrder = -9
  points.userData.shaderTime = true
  return points
}

function createHorizonGlow(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(220, 90)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMagenta: { value: new THREE.Color(THEME.magenta) },
      uViolet: { value: new THREE.Color(THEME.violet) },
      uCyan: { value: new THREE.Color(THEME.cyan) },
      uStrength: { value: 0.75 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMagenta;
      uniform vec3 uViolet;
      uniform vec3 uCyan;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        // tight hot band right at the horizon line
        float band = exp(-pow((y - 0.14) * 13.0, 2.0));
        // broad atmospheric wash above it
        float wide = exp(-pow((y - 0.34) * 3.2, 2.0)) * 0.5;
        float fall = 1.0 - smoothstep(0.05, 0.85, x);

        vec3 col = mix(uViolet, uMagenta, smoothstep(0.0, 0.35, y));
        col = mix(col, uCyan, smoothstep(0.2, 0.0, y) * 0.7);

        float a = (band * 0.75 + wide) * fall * fall * uStrength;
        gl_FragColor = vec4(col, a);
      }
    `,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(0, GRID.y + 5, -110)
  mesh.renderOrder = -11
  return mesh
}

export function createWorld(canvas: HTMLCanvasElement): World {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    alpha: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(THEME.bg)
  scene.fog = new THREE.FogExp2(FOG.color, FOG.density)

  const camera = new THREE.PerspectiveCamera(
    CAMERA.fov,
    window.innerWidth / window.innerHeight,
    CAMERA.near,
    CAMERA.far,
  )
  camera.position.set(0, 0.3, CAMERA.z)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0x4a2f7a, 0.7))

  const ring = new THREE.Group()
  ring.position.y = RING.height
  ring.rotation.x = RING.tilt
  scene.add(ring)

  const timed: THREE.Object3D[] = []
  const sun = createSun()
  const grid = createGrid()
  const stars = createStars()
  const glow = createHorizonGlow()
  scene.add(sun, grid, stars, glow)
  timed.push(sun, grid, stars)

  const clock = new THREE.Clock()

  const updateUniforms = (t: number) => {
    for (const obj of timed) {
      const mesh = obj as THREE.Mesh
      const mat = mesh.material as THREE.ShaderMaterial
      if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = t
    }
  }

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const aspect = w / h
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)

    // fit the ring to the viewport width
    const portrait = aspect < 1
    const visibleHalfWidth = Math.tan((CAMERA.fov * Math.PI) / 360) * aspect * CAMERA.z

    const scale = portrait
      ? Math.min(0.92, (visibleHalfWidth / RING.radius) * 0.86)
      : Math.min(1.06, (visibleHalfWidth / RING.radius) * 1.02)

    ring.scale.setScalar(scale)
  }
  resize()

  return { renderer, scene, camera, ring, clock, resize, updateUniforms }
}
