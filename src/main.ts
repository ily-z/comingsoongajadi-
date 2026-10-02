import './style.css'
import * as THREE from 'three'
import { CAMERA, COPY, PHOTO_URLS, LOGO_URL, THEME } from './config'
import { loadAssets } from './core/loader'
import { createWorld } from './scene/world'
import { createCarousel } from './scene/carousel'
import { createPointer } from './scene/pointer'
import { createPost } from './scene/post'
import { createHeadline } from './ui/headline'

const q = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel)
  if (!el) throw new Error(`Missing element: ${sel}`)
  return el
}

const canvas = q<HTMLCanvasElement>('.stage__canvas')
const hero = q<HTMLElement>('.hero')
const loader = q<HTMLElement>('.loader')
const loaderFill = q<HTMLElement>('.loader__fill')
const loaderPct = q<HTMLElement>('.loader__pct')
const headlineText = q<HTMLElement>('.headline__text')
const headlineGhost = q<HTMLElement>('.headline__scramble')

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const world = createWorld(canvas)
const carousel = createCarousel()
world.ring.add(carousel.root)
world.ring.add(carousel.logo)

const post = createPost(world.renderer, world.scene, world.camera)
const headline = createHeadline(headlineText, headlineGhost, COPY.headline)

const abort = new AbortController()

let spinTarget = 0

const pointer = createPointer(
  canvas,
  (delta) => {
    spinTarget += delta
  },
  () => {
    // gentle nudge back to auto-rotation after idling
    spinTarget *= 0.9
  },
)

const onResize = () => {
  world.resize()
  post.setSize(
    window.innerWidth,
    window.innerHeight,
    Math.min(window.devicePixelRatio, 2),
  )
}
window.addEventListener('resize', onResize)
window.addEventListener('orientationchange', onResize)

function updateLoader(fraction: number) {
  const pct = Math.round(Math.min(fraction, 1) * 100)
  loaderFill.style.width = `${pct}%`
  loaderPct.textContent = `${pct}%`
}

// warm the scene immediately so the background is alive while assets stream in
world.scene.background = new THREE.Color(THEME.bg)
carousel.logoMat.opacity = 0
let logoRevealed = false

let elapsed = 0
let running = true
const maxDelta = 0.05

function frame() {
  if (!running) return
  requestAnimationFrame(frame)

  const dt = Math.min(world.clock.getDelta(), maxDelta)
  elapsed += dt

  // accumulated drag decays back toward the auto-rotation baseline
  if (!pointer.dragging) {
    spinTarget *= 1 - Math.min(dt * 2.2, 1)
    if (Math.abs(spinTarget) < 1e-4) spinTarget = 0
  }

  carousel.setSpin(spinTarget)
  carousel.update(elapsed, dt)
  carousel.root.rotation.y = carousel.offset

  // pointer parallax on the camera
  const pAmp = reduced ? 0 : CAMERA.parallaxAmp
  world.camera.position.x += (pointer.parallaxX * pAmp - world.camera.position.x) * 0.06
  world.camera.position.y +=
    (0.3 - pointer.parallaxY * pAmp * 0.55 - world.camera.position.y) * 0.06
  world.camera.lookAt(0, 0, 0)

  world.updateUniforms(elapsed)

  // logo fade-in once its texture is ready
  if (!logoRevealed && carousel.logoMat.map) {
    logoRevealed = true
    loader.classList.add('is-done')
    hero.classList.add('is-ready')
    headline.run()
  }

  post.render(elapsed)
}

requestAnimationFrame(frame)

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false
  } else if (!running) {
    running = true
    world.clock.getDelta()
    requestAnimationFrame(frame)
  }
})

loadAssets(LOGO_URL, PHOTO_URLS, world.renderer, {
  onProgress: updateLoader,
  onLogoReady: (texture) => {
    carousel.logoMat.map = texture
    carousel.logoMat.needsUpdate = true
  },
}, abort.signal)
  .then(({ photos }) => {
    photos.forEach((texture, i) => {
      const panel = carousel.panels[i]
      panel?.setTexture(texture)
    })

    // hold the loader until at least the first panels are in
    window.setTimeout(() => {
      if (!logoRevealed) {
        logoRevealed = true
        loader.classList.add('is-done')
        hero.classList.add('is-ready')
        headline.run()
      }
    }, 420)
  })
  .catch((err: unknown) => {
    console.error('[utm-tv] asset load failed', err)
    loader.classList.add('is-done')
    hero.classList.add('is-ready')
    headline.run()
  })

window.addEventListener('pagehide', () => {
  abort.abort()
  pointer.dispose()
})
