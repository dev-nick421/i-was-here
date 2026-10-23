import { cssFont } from '~/core/fonts'
import type { MeasureFn, TextStyle } from '~/core/scene'

/**
 * Text measuring and drawing on a 2D canvas. Layout (in units) and drawing (in pixels) share
 * the same measurements so text lands exactly where the layout engine expects it.
 */

const REFERENCE_SIZE = 100
const cache = new Map<string, number>()
let measureCtx: CanvasRenderingContext2D | null = null

function graphemes(text: string) {
  return [...text]
}

function referenceWidth(text: string, style: Pick<TextStyle, 'family' | 'weight' | 'style'>) {
  const key = `${style.style}|${style.weight}|${style.family}|${text}`
  let w = cache.get(key)
  if (w === undefined) {
    measureCtx ??= document.createElement('canvas').getContext('2d')
    if (!measureCtx) return 0
    measureCtx.font = cssFont(style, REFERENCE_SIZE)
    if ('letterSpacing' in measureCtx) measureCtx.letterSpacing = '0px'
    w = measureCtx.measureText(text).width
    cache.set(key, w)
  }
  return w
}

/** Measures text in layout units. Width includes letter spacing between (not after) glyphs. */
export const canvasMeasure: MeasureFn = (text, style) => {
  if (!text) return 0
  const n = graphemes(text).length
  return (referenceWidth(text, style) * style.size) / REFERENCE_SIZE + Math.max(0, n - 1) * style.letterSpacing
}

/** Must be called when web fonts finish loading – measurements made with fallback fonts are wrong. */
export function clearMeasureCache() {
  cache.clear()
}

let letterSpacingSupport: boolean | null = null
function supportsLetterSpacing(ctx: CanvasRenderingContext2D) {
  letterSpacingSupport ??= 'letterSpacing' in ctx
  return letterSpacingSupport
}

export interface DrawTextOptions {
  text: string
  /** Pixel position of the anchor (see `align`) and the baseline. */
  x: number
  y: number
  align: 'left' | 'center' | 'right'
  style: TextStyle
  /** Pixels per layout unit. */
  scale: number
  halo?: { color: string, width: number }
}

export function drawText(ctx: CanvasRenderingContext2D, o: DrawTextOptions) {
  const sizePx = o.style.size * o.scale
  const spacingPx = o.style.letterSpacing * o.scale
  const widthPx = canvasMeasure(o.text, o.style) * o.scale
  let x = o.x
  if (o.align === 'center') x -= widthPx / 2
  else if (o.align === 'right') x -= widthPx

  ctx.save()
  ctx.font = cssFont(o.style, sizePx)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = o.style.color
  if (o.halo) {
    ctx.strokeStyle = o.halo.color
    ctx.lineWidth = o.halo.width * o.scale * 2
    ctx.lineJoin = 'round'
  }

  if (supportsLetterSpacing(ctx)) {
    ctx.letterSpacing = `${spacingPx}px`
    if (o.halo) ctx.strokeText(o.text, x, o.y)
    ctx.fillText(o.text, x, o.y)
  } else {
    // Fallback for browsers without canvas letter-spacing: place glyph by glyph.
    let cx = x
    for (const g of graphemes(o.text)) {
      if (o.halo) ctx.strokeText(g, cx, o.y)
      ctx.fillText(g, cx, o.y)
      cx += ctx.measureText(g).width + spacingPx
    }
  }
  ctx.restore()
}
