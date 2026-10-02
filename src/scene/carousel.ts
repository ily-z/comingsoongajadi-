import * as THREE from 'three'
import { LOGO, PHOTOS, RING, THEME } from '../config'
import { textureSize } from '../core/loader'

interface Panel {
  group: THREE.Group
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  back: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  edge: THREE.Mesh
  phase: number
  baseAngle: number
  aspect: number
  setTexture(t: THREE.Texture): void
}

export interface Carousel {
  root: THREE.Group
  logo: THREE.Group
  logoMat: THREE.MeshBasicMaterial
  logoGlowMat: THREE.ShaderMaterial
  panels: Panel[]
  setSpin(v: number): void
  spinSpeed: number
  offset: number
  update(t: number, dt: number): void
}

function makeEdge(color: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1, 1)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSize: { value: new THREE.Vector2(1, 1) },
      uGlow: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec2 uSize;
      uniform float uGlow;
      varying vec2 vUv;

      void main() {
        vec2 px = vUv * uSize;
        float b = 0.0;

        float d = min(min(px.x, uSize.x - px.x), min(px.y, uSize.y - px.y));
        float w = 0.055;
        float core = 1.0 - smoothstep(w, w + 0.045, d);
        float halo = exp(-d * 5.5) * 0.55;
        b = clamp(core + halo, 0.0, 1.0) * uGlow;

        if (b < 0.004) discard;
        gl_FragColor = vec4(uColor, b);
      }
    `,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = 2
  return mesh
}

export function createCarousel(): Carousel {
  const root = new THREE.Group()
  const panels: Panel[] = []
  const count = PHOTOS.length
  const step = (Math.PI * 2) / count

  for (let i = 0; i < count; i++) {
    const photo = PHOTOS[i]
    const group = new THREE.Group()
    const angle = i * step
    const x = Math.sin(angle) * RING.radius
    const z = Math.cos(angle) * RING.radius

    group.position.set(x, 0, z)
    group.rotation.y = angle
    group.rotation.z = photo.tiltZ

    // placeholder 3:4 ratio, replaced on texture load
    const aspect = 3 / 4
    const h = RING.planeHeight
    const w = h * aspect

    // dark card behind the photo so it reads as a framed panel on black
    const backMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTop: { value: new THREE.Color(THEME.bgDeep) },
        uBottom: { value: new THREE.Color(0x1b1038) },
        uOpacity: { value: 0 },
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
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec3 col = mix(uBottom, uTop, vUv.y);
          // subtle centre lift so the card is not flat
          float d = length(vUv - 0.5) * 2.0;
          col += vec3(0.03, 0.01, 0.06) * (1.0 - smoothstep(0.0, 1.0, d));
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    })
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backMat)
    back.scale.set(w + RING.gap * 2, h + RING.gap * 2, 1)
    back.position.z = -0.06
    back.renderOrder = 0

    // photo plane: brightness lift + neon duotone tint, since source photos are very dark
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: null },
        uOpacity: { value: 0 },
        uBoost: { value: 1.55 },
        uTint: { value: new THREE.Color(photo.edge) },
        uTintAmount: { value: 0.14 },
        uDim: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uOpacity;
        uniform float uBoost;
        uniform vec3 uTint;
        uniform float uTintAmount;
        uniform float uDim;
        varying vec2 vUv;

        void main() {
          vec4 tex = texture2D(uMap, vUv);
          if (tex.a < 0.004) discard;

          vec3 col = tex.rgb * uBoost * uDim;

          // lift the shadows so the photos are legible against black
          col = col * (1.0 - uTintAmount) + uTint * uTintAmount * (0.25 + col);

          // gentle filmic rolloff to avoid clipping after the boost
          col = col / (col + vec3(0.85)) * 1.85;

          gl_FragColor = vec4(col, tex.a * uOpacity);
        }
      `,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    mesh.scale.set(w, h, 1)
    mesh.renderOrder = 1

    const edge = makeEdge(photo.edge)
    const eMat = edge.material as THREE.ShaderMaterial
    eMat.uniforms.uSize.value.set(w + RING.gap * 2, h + RING.gap * 2)
    edge.scale.set(w + RING.gap * 2, h + RING.gap * 2, 1)
    edge.position.z = 0.02

    group.add(back, mesh, edge)
    root.add(group)

    panels.push({
      group,
      mesh,
      back,
      edge,
      phase: (i / count) * Math.PI * 2,
      baseAngle: angle,
      aspect,
      setTexture(t: THREE.Texture) {
        const { width, height } = textureSize(t)
        const nextAspect = width / height
        const nh = RING.planeHeight
        const nw = nh * nextAspect
        mesh.scale.set(nw, nh, 1)
        back.scale.set(nw + RING.gap * 2, nh + RING.gap * 2, 1)
        const ew = nw + RING.gap * 2
        const eh = nh + RING.gap * 2
        edge.scale.set(ew, eh, 1)
        eMat.uniforms.uSize.value.set(ew, eh)
        mat.uniforms.uMap.value = t
        panels[i].aspect = nextAspect
      },
    })
  }

  const logo = new THREE.Group()
  logo.position.z = LOGO.z

  const logoMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const logoMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(LOGO.height * LOGO.aspect, LOGO.height),
    logoMat,
  )
  logoMesh.renderOrder = 3

  const logoGlowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uInner: { value: new THREE.Color(0xffffff) },
      uOuter: { value: new THREE.Color(THEME.magenta) },
      uIntensity: { value: LOGO.glowIntensity },
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
      uniform vec3 uInner;
      uniform vec3 uOuter;
      uniform float uIntensity;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        d.y *= 1.06;
        float r = length(d);

        // soft radial falloff, no hard edge
        float halo = exp(-r * 3.4) * 0.85;
        float core = exp(-r * 9.0) * 0.55;
        halo += core;

        // slow breathing pulse
        halo *= 0.85 + 0.15 * sin(uTime * 1.5);

        vec3 col = mix(uOuter, uInner, exp(-r * 5.0));
        float a = halo * uIntensity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(col * a, a);
      }
    `,
  })
  const logoGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(LOGO.glowSize, LOGO.glowSize),
    logoGlowMat,
  )
  logoGlow.position.z = -0.4
  logoGlow.renderOrder = 0

  const logoEdge = makeEdge(THEME.cyan)
  const lMat = logoEdge.material as THREE.ShaderMaterial
  lMat.uniforms.uGlow.value = 0.85
  lMat.uniforms.uSize.value.set(LOGO.height * LOGO.aspect + 0.3, LOGO.height + 0.3)
  logoEdge.scale.set(LOGO.height * LOGO.aspect + 0.3, LOGO.height + 0.3, 1)
  logoEdge.position.z = -0.02
  logoEdge.renderOrder = 2

  logo.add(logoGlow, logoEdge, logoMesh)

  let offset = 0
  let autoAngle = 0
  let dragOffset = 0
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const autoSpeed: number = reduced ? RING.speed * 0.15 : RING.speed
  let spinSpeed: number = autoSpeed
  const targetOffset = { value: 0 }

  const setSpin = (v: number) => {
    targetOffset.value = Math.max(
      -RING.maxDragOffset,
      Math.min(RING.maxDragOffset, v),
    )
  }

  const update = (t: number, dt: number) => {
    spinSpeed += (autoSpeed - spinSpeed) * 0.02
    // continuous auto-rotation (unbounded, wrapped for precision)
    autoAngle = (autoAngle + spinSpeed * dt) % (Math.PI * 2)
    // drag offset eases toward the pointer target, then decays to 0
    dragOffset += (targetOffset.value - dragOffset) * 0.08
    dragOffset = THREE.MathUtils.clamp(
      dragOffset,
      -RING.maxDragOffset,
      RING.maxDragOffset,
    )
    offset = autoAngle + dragOffset

    for (let i = 0; i < panels.length; i++) {
      const p = panels[i]

      p.group.position.y = Math.sin(t * RING.bobSpeed + p.phase) * RING.bobAmp

      // how much this panel faces the camera: 1 = front, 0 = back
      const worldAngle = p.baseAngle + offset
      const facing = Math.cos(worldAngle)
      const f = THREE.MathUtils.smoothstep(facing, -0.2, 0.8)
      const dim = THREE.MathUtils.lerp(RING.backFade, 1, f)

      const targetOpacity = 0.5 + 0.5 * f
      const mu = p.mesh.material as THREE.ShaderMaterial
      mu.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        mu.uniforms.uOpacity.value,
        targetOpacity,
        0.06,
      )
      mu.uniforms.uDim.value = dim

      const bu = p.back.material as THREE.ShaderMaterial
      bu.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        bu.uniforms.uOpacity.value,
        0.35 + 0.65 * f,
        0.06,
      )

      const em = p.edge.material as THREE.ShaderMaterial
      em.uniforms.uGlow.value =
        RING.neonIntensity * dim * (0.6 + 0.4 * Math.sin(t * 1.3 + p.phase))
    }

    logo.position.y = Math.sin(t * LOGO.floatSpeed) * LOGO.floatAmp
    logo.rotation.y = Math.sin(t * 0.5) * 0.16
    logo.rotation.z = Math.sin(t * 0.33) * 0.028
    logoMat.opacity = Math.min(1, logoMat.opacity + dt * 1.4)
    logoGlowMat.uniforms.uTime.value = t
  }

  return {
    root,
    logo,
    logoMat,
    logoGlowMat,
    panels,
    setSpin,
    get spinSpeed() {
      return spinSpeed
    },
    set spinSpeed(v: number) {
      spinSpeed = v
    },
    get offset() {
      return offset
    },
    set offset(v: number) {
      autoAngle = v
      dragOffset = 0
      offset = v
    },
    update,
  }
}
