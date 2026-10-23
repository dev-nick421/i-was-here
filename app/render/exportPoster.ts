import { buildMapStyle } from '~/core/mapStyle'
import { outputPixels, paperSizeCm, posterUnits } from '~/core/formats'
import { detailScale, screenOffsetToLngLat } from '~/core/geo'
import { buildScene, exportFileName, mapCamera } from '~/core/poster'
import { mapContainerSize, sceneFonts, type Scene } from '~/core/scene'
import type { PosterContent, PosterStyle } from '~/core/types'
import { clipToMap, drawSceneNodes } from './drawScene'
import { buildPdf, setJpegDpi, setPngDpi } from './encode'
import { ensureFonts } from './fonts'
import { configureMapLibre, MapLibreMap, maxRenderSize, waitForIdle } from './maplibre'
import { canvasMeasure } from './text'

export interface MapSourceConfig {
  tilesUrl: string
  glyphsUrl: string
  labelFont: string
  attribution: string
}

export type ExportStage = 'prepare' | 'map' | 'compose' | 'encode' | 'done'

export interface ExportProgress {
  stage: ExportStage
  /** 0 – 1 */
  progress: number
  tile?: number
  tiles?: number
}

export interface ExportOptions {
  style: PosterStyle
  content: PosterContent
  locale: string
  source: MapSourceConfig
  onProgress?: (p: ExportProgress) => void
  signal?: AbortSignal
  /** Overrides for tests. */
  maxTileSize?: number
  pixels?: { width: number, height: number }
}

export interface ExportResult {
  blob: Blob
  fileName: string
  width: number
  height: number
  dpi: number
  mime: string
  warnings: string[]
}

export class ExportError extends Error {
  constructor(public code: 'canvas-too-large' | 'webgl' | 'aborted' | 'encode', message?: string) {
    super(message ?? code)
    this.name = 'ExportError'
  }
}

const BLEED = 48
const SNAP_SPAN = 48

function distanceToWhole(v: number) {
  return Math.abs(v - Math.round(v))
}

/** Smallest CSS size ≥ `min` (within SNAP_SPAN) whose device size css × pr is closest to whole. */
function snapUp(min: number, pr: number) {
  let best = min
  for (let c = min; c < min + SNAP_SPAN; c++) {
    if (distanceToWhole(c * pr) < distanceToWhole(best * pr) - 1e-9) best = c
    if (distanceToWhole(best * pr) < 1e-6) break
  }
  return best
}

/** CSS size within ±span of `ideal` whose device size is closest to whole (ties → closest to ideal). */
function snapAround(ideal: number, pr: number, span: number) {
  let best = ideal
  for (let d = 1; d <= span; d++) {
    for (const c of [ideal - d, ideal + d]) {
      if (c > 0 && distanceToWhole(c * pr) < distanceToWhole(best * pr) - 1e-9) best = c
    }
  }
  return best
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new ExportError('aborted')
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx || canvas.width !== width || canvas.height !== height) throw new ExportError('canvas-too-large')
  // Browsers silently return an unusable context for oversized canvases: probe a pixel.
  ctx.fillStyle = '#010203'
  ctx.fillRect(width - 1, height - 1, 1, 1)
  const probe = ctx.getImageData(width - 1, height - 1, 1, 1).data
  if (probe[0] !== 1 || probe[1] !== 2 || probe[2] !== 3) throw new ExportError('canvas-too-large')
  return { canvas, ctx }
}

function makeContainer(width: number, height: number) {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.dataset.exportMap = ''
  Object.assign(el.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0px',
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: 'none',
    overflow: 'hidden',
  })
  document.body.appendChild(el)
  return el
}

/**
 * Renders the map part of a poster into `ctx` at the given device-pixel rectangle.
 * Big outputs are rendered tile by tile (each tile with some bleed to keep labels stable),
 * so the size is not limited by the GPU's maximum canvas size.
 */
async function renderMap(
  ctx: CanvasRenderingContext2D,
  o: ExportOptions,
  scene: Scene,
  scale: number,
  warnings: string[],
) {
  configureMapLibre()
  const k = detailScale(o.style.map.detail)
  const css = mapContainerSize(scene.map.rect, k)
  const target = {
    x: Math.round(scene.map.rect.x * scale),
    y: Math.round(scene.map.rect.y * scale),
    w: Math.round(scene.map.rect.w * scale),
    h: Math.round(scene.map.rect.h * scale),
  }
  // Device pixels per CSS pixel; css.width × pr is exactly target.w.
  const pr = target.w / css.width
  // MapLibre sizes its canvas as round(css × pr). A height whose device size is (almost) a
  // whole number keeps the x and y scale identical; a pixel or two of extent doesn't matter.
  const cssH = snapAround(css.height, pr, 3)
  /** The map in device pixels, as a single render would produce it. */
  const grid = { w: target.w, h: Math.round(cssH * pr) }
  const origin = { x: target.x, y: target.y + Math.round((target.h - grid.h) / 2) }
  const maxTile = Math.min(o.maxTileSize ?? Infinity, maxRenderSize())
  const camera = mapCamera(o.content, o.style)
  const style = buildMapStyle({
    colors: o.style.colors,
    map: o.style.map,
    tilesUrl: o.source.tilesUrl,
    glyphsUrl: o.source.glyphsUrl,
    labelFont: o.source.labelFont,
    language: o.locale,
    transitionMs: 0,
  })

  // Tiles are planned on the integer device-pixel grid so they can be copied 1:1, without any
  // resampling. Each tile renders a little extra (bleed) around it for stable label placement.
  const single = grid.w <= maxTile && grid.h <= maxTile
  const bleed = single ? 0 : Math.ceil(BLEED * pr)
  const inner = single ? Math.max(grid.w, grid.h) : maxTile - 2 * bleed - Math.ceil(SNAP_SPAN * pr) - 2
  if (!single && inner < 64) throw new ExportError('webgl', 'Tile size too small for this resolution')
  const cols = Math.ceil(grid.w / inner)
  const rows = Math.ceil(grid.h / inner)
  const total = cols * rows

  const container = makeContainer(single ? css.width : Math.ceil((inner + 2 * bleed) / pr), single ? cssH : Math.ceil((inner + 2 * bleed) / pr))
  let map: MapLibreMap
  try {
    map = new MapLibreMap({
      container,
      style,
      center: [camera.lng, camera.lat],
      zoom: camera.zoom,
      bearing: camera.bearing,
      pixelRatio: pr,
      maxCanvasSize: [maxTile, maxTile],
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      trackResize: false,
      renderWorldCopies: true,
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      maxTileCacheSize: 512,
    })
  } catch (e) {
    container.remove()
    throw new ExportError('webgl', (e as Error).message)
  }
  map.on('error', (e) => {
    const msg = e.error?.message ?? 'map error'
    if (!warnings.includes(msg)) warnings.push(msg)
  })

  ctx.save()
  clipToMap(ctx, scene, scale)
  // Land color underneath, so a rounding pixel at the map's edge never shows the paper.
  ctx.fillStyle = o.style.colors.land
  ctx.fillRect(target.x, target.y, target.w, target.h)
  try {
    let n = 0
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        checkAbort(o.signal)
        o.onProgress?.({ stage: 'map', progress: n / total, tile: n + 1, tiles: total })
        // Tile area (without bleed) in device pixels of the full map.
        const x0 = col * inner
        const y0 = row * inner
        const x1 = Math.min(grid.w, x0 + inner)
        const y1 = Math.min(grid.h, y0 + inner)
        const tileCssW = single ? css.width : snapUp(Math.ceil((x1 - x0 + 2 * bleed) / pr), pr)
        const tileCssH = single ? cssH : snapUp(Math.ceil((y1 - y0 + 2 * bleed) / pr), pr)
        container.style.width = `${tileCssW}px`
        container.style.height = `${tileCssH}px`
        // The tile's camera sits at its canvas center; pick it so that tile pixel (bleed, bleed)
        // is exactly global pixel (x0, y0).
        const tileW = Math.round(tileCssW * pr)
        const tileH = Math.round(tileCssH * pr)
        const center = single
          ? { lng: camera.lng, lat: camera.lat }
          : screenOffsetToLngLat(camera, (x0 - bleed + tileW / 2 - grid.w / 2) / pr, (y0 - bleed + tileH / 2 - grid.h / 2) / pr)
        const idle = waitForIdle(map)
        map.resize()
        map.jumpTo({ center: [center.lng, center.lat], zoom: camera.zoom, bearing: camera.bearing })
        const { timedOut } = await idle
        if (timedOut) warnings.push('Some map tiles did not load in time.')
        checkAbort(o.signal)

        ctx.drawImage(map.getCanvas(), bleed, bleed, x1 - x0, y1 - y0, origin.x + x0, origin.y + y0, x1 - x0, y1 - y0)
        n++
      }
    }
    o.onProgress?.({ stage: 'map', progress: 1, tile: total, tiles: total })
  } finally {
    ctx.restore()
    map.remove()
    container.remove()
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new ExportError('encode'))), type, quality)
  })
}

export async function exportPoster(o: ExportOptions): Promise<ExportResult> {
  const warnings: string[] = []
  const progress = (p: ExportProgress) => o.onProgress?.(p)
  progress({ stage: 'prepare', progress: 0 })

  const px = o.pixels ? { ...o.pixels, dpi: outputPixels(o.style.output).dpi } : outputPixels(o.style.output)
  const units = posterUnits(o.style.output)
  const scale = px.width / units.width

  // Fonts first: the layout depends on real text measurements.
  const draft = buildScene(o.style, o.content, { locale: o.locale, measure: canvasMeasure, attribution: o.source.attribution })
  await ensureFonts(sceneFonts(draft), draft.nodes.flatMap(n => (n.kind === 'text' ? [n.text] : [])).join(''))
  const scene = buildScene(o.style, o.content, { locale: o.locale, measure: canvasMeasure, attribution: o.source.attribution })
  checkAbort(o.signal)

  const { canvas, ctx } = createCanvas(px.width, px.height)
  try {
    ctx.fillStyle = scene.paper
    ctx.fillRect(0, 0, px.width, px.height)

    await renderMap(ctx, o, scene, scale, warnings)

    progress({ stage: 'compose', progress: 0 })
    drawSceneNodes(ctx, scene, scale)
    progress({ stage: 'compose', progress: 1 })
    checkAbort(o.signal)

    progress({ stage: 'encode', progress: 0 })
    const type = o.style.output.fileType
    let blob: Blob
    let mime: string
    if (type === 'png') {
      const raw = new Uint8Array(await (await toBlob(canvas, 'image/png')).arrayBuffer())
      blob = new Blob([setPngDpi(raw, px.dpi) as BlobPart], { type: 'image/png' })
      mime = 'image/png'
    } else {
      const quality = type === 'pdf' ? Math.max(0.95, o.style.output.jpegQuality) : o.style.output.jpegQuality
      const jpeg = setJpegDpi(new Uint8Array(await (await toBlob(canvas, 'image/jpeg', quality)).arrayBuffer()), px.dpi)
      if (type === 'pdf') {
        const size = paperSizeCm(o.style.output)
        const pdf = buildPdf({
          jpeg,
          pixelWidth: px.width,
          pixelHeight: px.height,
          widthCm: size.width,
          heightCm: size.height,
          title: o.content.text.title || 'Map poster',
        })
        blob = new Blob([pdf as BlobPart], { type: 'application/pdf' })
        mime = 'application/pdf'
      } else {
        blob = new Blob([jpeg as BlobPart], { type: 'image/jpeg' })
        mime = 'image/jpeg'
      }
    }
    progress({ stage: 'done', progress: 1 })
    const ext = type === 'jpeg' ? 'jpg' : type
    return {
      blob,
      fileName: exportFileName(o.style, o.content, ext),
      width: px.width,
      height: px.height,
      dpi: px.dpi,
      mime,
      warnings,
    }
  } finally {
    // Free the (potentially huge) backing store right away.
    canvas.width = 0
    canvas.height = 0
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
