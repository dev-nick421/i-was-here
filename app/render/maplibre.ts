import { MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

let configured = false

/** Points MapLibre at its worker bundle (works with Vite's dev server and production builds). */
export function configureMapLibre() {
  if (configured) return
  setWorkerUrl(workerUrl)
  configured = true
}

let glLimit: number | null = null

/** Largest canvas edge the GPU can render into (capped at 4096 to keep memory sane). */
export function maxRenderSize(cap = 4096): number {
  if (glLimit === null) {
    glLimit = 2048
    try {
      const canvas = document.createElement('canvas')
      const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
      if (gl) {
        const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array
        glLimit = Math.min(
          gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
          gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
          dims[0] ?? 4096,
          dims[1] ?? 4096,
        )
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    } catch {
      // keep the conservative default
    }
  }
  return Math.min(cap, glLimit)
}

/**
 * Resolves once the map has finished loading and rendering everything currently in view.
 * Never rejects: after `timeoutMs` it resolves with `timedOut: true` so an export can still
 * finish with whatever has loaded.
 */
export function waitForIdle(map: MapLibreMap, timeoutMs = 45_000): Promise<{ timedOut: boolean }> {
  return new Promise((resolve) => {
    let done = false
    const finish = (timedOut: boolean) => {
      if (done) return
      done = true
      clearTimeout(timer)
      map.off('idle', onIdle)
      resolve({ timedOut })
    }
    const onIdle = () => finish(false)
    const timer = setTimeout(() => finish(true), timeoutMs)
    map.on('idle', onIdle)
    map.triggerRepaint()
  })
}

export { MapLibreMap }
