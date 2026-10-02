import { CAMERA } from '../config'

export interface Pointer {
  x: number
  y: number
  parallaxX: number
  parallaxY: number
  dragging: boolean
  dispose(): void
}

export function createPointer(
  target: HTMLElement,
  onSpin: (delta: number) => void,
  onIdle: () => void,
): Pointer {
  const state: Pointer = {
    x: 0,
    y: 0,
    parallaxX: 0,
    parallaxY: 0,
    dragging: false,
    dispose: () => {},
  }

  let lastX = 0
  let down = false
  let moved = false
  let idleTimer = 0

  const onPointerMove = (e: PointerEvent) => {
    const w = window.innerWidth
    const h = window.innerHeight
    state.x = (e.clientX / w) * 2 - 1
    state.y = (e.clientY / h) * 2 - 1

    if (down) {
      const dx = e.clientX - lastX
      lastX = e.clientX
      onSpin(dx * 0.006)
      moved = true
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    down = true
    moved = false
    state.dragging = true
    lastX = e.clientX
    target.setPointerCapture?.(e.pointerId)
  }

  const onPointerUp = (e: PointerEvent) => {
    if (!down) return
    down = false
    state.dragging = false
    target.releasePointerCapture?.(e.pointerId)
    if (!moved) {
      // tap: nudge the carousel
      onSpin(0.15)
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) return
    e.preventDefault()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') onSpin(0.5)
    if (e.key === 'ArrowLeft') onSpin(-0.5)
  }

  target.addEventListener('pointerdown', onPointerDown)
  target.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  target.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  const tick = () => {
    if (down) {
      idleTimer = 0
    } else {
      idleTimer += 1
      if (idleTimer > 240) onIdle()
    }
    const k = CAMERA.parallaxLerp
    state.parallaxX += (state.x - state.parallaxX) * k
    state.parallaxY += (state.y - state.parallaxY) * k
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  state.dispose = () => {
    target.removeEventListener('pointerdown', onPointerDown)
    target.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    target.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('pointermove', onPointerMove)
  }

  return state
}
