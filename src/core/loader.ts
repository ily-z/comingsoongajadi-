import * as THREE from 'three'

export interface LoadedAssets {
  logo: THREE.Texture
  photos: THREE.Texture[]
}

export interface Job {
  url: string
  bytes: number
}

export interface LoaderCallbacks {
  onProgress(fraction: number): void
  onLogoReady(texture: THREE.Texture): void
}

interface BitmapLike {
  width: number
  height: number
}

async function fetchWithProgress(
  url: string,
  job: Job,
  onBytes: (n: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  if (!res.body) return res.blob()

  const total = Number(res.headers.get('content-length') ?? 0) || job.bytes
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    received += value.byteLength
    if (total > 0) job.bytes = total
    onBytes(received)
  }

  return new Blob(chunks as BlobPart[])
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      }
    ).requestIdleCallback

    if (typeof ric === 'function') {
      ric(() => resolve(), { timeout: 60 })
    } else {
      globalThis.setTimeout(resolve, 0)
    }
  })
}

function makeTexture(
  bitmap: ImageBitmap,
  maxAniso: number,
): THREE.Texture {
  const texture = new THREE.Texture(
    bitmap as unknown as HTMLImageElement,
  )
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = true
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = maxAniso
  texture.needsUpdate = true
  return texture
}

export function textureSize(t: THREE.Texture): BitmapLike {
  const img = t.image as BitmapLike | undefined
  return {
    width: img?.width ?? 3,
    height: img?.height ?? 4,
  }
}

export async function loadAssets(
  logoUrl: string,
  photoUrls: string[],
  renderer: THREE.WebGLRenderer,
  cb: LoaderCallbacks,
  signal?: AbortSignal,
): Promise<LoadedAssets> {
  const maxAniso = renderer.capabilities.getMaxAnisotropy()

  const jobs: Job[] = [
    { url: logoUrl, bytes: 0 },
    ...photoUrls.map((url) => ({ url, bytes: 0 })),
  ]
  const received: number[] = jobs.map(() => 0)
  const doneFlags: boolean[] = jobs.map(() => false)

  const emit = () => {
    const known = jobs.filter((_, i) => doneFlags[i])
    const knownTotal = known.reduce((a, j) => a + j.bytes, 0)
    const live = jobs
      .map((j, i) => ({ j, i }))
      .filter(({ i }) => !doneFlags[i])

    const liveTotal = live.reduce((a, { j }) => a + j.bytes, 0)
    const liveGot = live.reduce((a, { i }) => a + received[i], 0)

    // weight by bytes when every size is known, otherwise fall back to file counts
    const fraction =
      knownTotal + liveTotal > 0
        ? (knownTotal + liveGot) / (knownTotal + liveTotal)
        : doneFlags.filter(Boolean).length / jobs.length

    cb.onProgress(Math.max(0, Math.min(fraction, 0.999)))
  }

  const logoJob = jobs[0]
  const logoBlob = await fetchWithProgress(
    logoUrl,
    logoJob,
    (n) => {
      received[0] = n
      emit()
    },
    signal,
  )
  logoJob.bytes = logoBlob.size
  doneFlags[0] = true

  const logoBitmap = await createImageBitmap(logoBlob, {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
  })
  const logo = makeTexture(logoBitmap, maxAniso)
  emit()
  cb.onLogoReady(logo)

  const photos: THREE.Texture[] = []

  for (let i = 0; i < photoUrls.length; i++) {
    if (signal?.aborted) break

    const idx = i + 1
    const job = jobs[idx]
    const blob = await fetchWithProgress(
      photoUrls[i],
      job,
      (n) => {
        received[idx] = n
        emit()
      },
      signal,
    )
    job.bytes = blob.size
    doneFlags[idx] = true
    emit()

    const bitmap = await createImageBitmap(blob, {
      imageOrientation: 'flipY',
      premultiplyAlpha: 'none',
    })
    photos.push(makeTexture(bitmap, maxAniso))

    await idle()
  }

  cb.onProgress(1)
  return { logo, photos }
}
