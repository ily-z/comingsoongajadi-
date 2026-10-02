export const THEME = {
  bg: 0x070a12,
  bgDeep: 0x12002b,
  cyan: 0x00f0ff,
  magenta: 0xff2e9a,
  violet: 0x7c3aed,
  sunTop: 0xffe29a,
  sunBottom: 0xff2e9a,
  fog: 0x0b0618,
} as const

export const RING = {
  radius: 6.4,
  height: 0.1,
  tilt: -0.05,
  planeHeight: 4.6,
  gap: 0.13,
  speed: 0.1,
  maxDragOffset: Math.PI,
  bobAmp: 0.14,
  bobSpeed: 0.7,
  neonIntensity: 1.7,
  backFade: 0.28,
} as const

export const LOGO = {
  height: 2.9,
  aspect: 432 / 490,
  z: 1.1,
  floatAmp: 0.1,
  floatSpeed: 0.9,
  glowSize: 7.5,
  glowIntensity: 0.34,
} as const

export const CAMERA = {
  fov: 45,
  near: 0.1,
  far: 320,
  z: 17,
  parallaxAmp: 1.1,
  parallaxLerp: 0.045,
} as const

export const GRID = {
  y: -4.6,
  size: 400,
  scroll: 0.45,
  opacity: 1,
} as const

export const SUN = {
  radius: 26,
  y: 5.5,
  z: -90,
} as const

export const FOG = {
  color: 0x0b0618,
  density: 0.0085,
} as const

export const BLOOM = {
  strength: 0.62,
  radius: 0.62,
  threshold: 0.68,
} as const

export const COPY = {
  eyebrow: 'UTM TV',
  headline: 'SEGERA HADIR',
  tagline: 'Something worth watching is on the way.',
} as const

export interface Photo {
  src: string
  edge: number
  tiltZ: number
}

const base = import.meta.env.BASE_URL || './'

export const PHOTOS: Photo[] = [
  { src: 'assets/foto-iqbal.webp', edge: THEME.cyan, tiltZ: 0.03 },
  { src: 'assets/dsc03959.webp', edge: THEME.magenta, tiltZ: -0.025 },
  { src: 'assets/id-card.webp', edge: THEME.cyan, tiltZ: 0.02 },
  { src: 'assets/dsc06813.webp', edge: THEME.magenta, tiltZ: -0.03 },
  { src: 'assets/dsc06873.webp', edge: THEME.cyan, tiltZ: 0.025 },
  { src: 'assets/dsc06945.webp', edge: THEME.magenta, tiltZ: -0.02 },
]

export const PHOTO_URLS = PHOTOS.map((p) => base + p.src)
export const LOGO_URL = base + 'assets/logo.png'
