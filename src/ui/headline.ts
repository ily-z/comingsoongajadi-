import { COPY } from '../config'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*+=/\\<>'

export interface Headline {
  run(): void
}

export function createHeadline(
  textEl: HTMLElement,
  ghostEl: HTMLElement,
  full: string = COPY.headline,
): Headline {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const chars = [...full]

  const run = () => {
    if (reduced) {
      textEl.textContent = full
      ghostEl.textContent = ''
      return
    }

    const start = performance.now()
    const total = chars.length * 55 + 320

    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / total, 1)
      const settled = Math.floor(progress * chars.length)
      let out = ''
      let ghostOut = ''

      for (let i = 0; i < chars.length; i++) {
        if (i < settled) {
          out += chars[i]
          ghostOut += chars[i]
        } else {
          out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
          if (i < settled + 2) ghostOut += GLYPHS[(Math.random() * GLYPHS.length) | 0]
        }
      }

      textEl.textContent = out
      ghostEl.textContent = ghostOut

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        textEl.textContent = full
        window.setTimeout(() => {
          ghostEl.textContent = ''
        }, 420)
      }
    }

    requestAnimationFrame(step)
  }

  return { run }
}
