import { withAlpha } from './color'
import { getFontPreset, type FontFace } from './fonts'
import type { FrameId, LayoutId, Rect, TextSize, ThemeColors, TypographyOptions } from './types'

/**
 * The layout engine. It turns poster settings into a *scene*: a flat list of shapes and
 * text runs in layout units (short side = 1000). The live preview and the high-resolution
 * export both draw this very same scene, which is what makes the editor WYSIWYG.
 */

export interface TextStyle {
  family: string
  weight: number
  style: 'normal' | 'italic'
  /** Font size in layout units. */
  size: number
  /** Extra space between characters in layout units. */
  letterSpacing: number
  color: string
}

export type TextRole = 'title' | 'subtitle' | 'coords' | 'attribution'

export type SceneNode
  = | { kind: 'rect', rect: Rect, fill: string }
  /** Vertical fade: transparent at the top, fully `color` from `solidFrom` (0–1) downwards. */
    | { kind: 'fade', rect: Rect, color: string, solidFrom: number }
    | { kind: 'strokeRect', rect: Rect, color: string, width: number }
    | { kind: 'strokeCircle', cx: number, cy: number, r: number, color: string, width: number }
    | { kind: 'line', x1: number, y1: number, x2: number, y2: number, color: string, width: number }
    | {
      kind: 'text'
      role: TextRole
      text: string
      /** x of the anchor given by `align`; y is the alphabetic baseline. */
      x: number
      y: number
      align: 'left' | 'center' | 'right'
      style: TextStyle
      halo?: { color: string, width: number }
    }

export interface SceneMap {
  shape: 'rect' | 'circle'
  rect: Rect
}

export interface Scene {
  width: number
  height: number
  paper: string
  map: SceneMap
  nodes: SceneNode[]
}

/** Returns the advance width of `text` in layout units, including letter spacing between glyphs. */
export type MeasureFn = (text: string, style: Omit<TextStyle, 'color'>) => number

export interface SceneInput {
  width: number
  height: number
  layout: LayoutId
  frame: FrameId
  colors: ThemeColors
  typography: TypographyOptions
  /** Empty/undefined lines are hidden. */
  title?: string
  subtitle?: string
  coords?: string
  attribution?: string
  measure: MeasureFn
}

const SIZE_MUL: Record<TextSize, number> = { s: 0.84, m: 1, l: 1.2 }

/** Rough width estimate used when no real text measurement is available (tests, SSR). */
export const estimateMeasure: MeasureFn = (text, style) => {
  const chars = [...text].length
  return chars * style.size * 0.6 + Math.max(0, chars - 1) * style.letterSpacing
}

interface Ctx {
  W: number
  H: number
  S: number
  mul: number
  size: TextSize
  colors: ThemeColors
  measure: MeasureFn
  titleFace: FontFace & { letterSpacing: number }
  bodyFace: FontFace & { letterSpacing: number }
  title: string
  subtitle: string
  coords: string
}

function makeCtx(input: SceneInput): Ctx {
  const preset = getFontPreset(input.typography.font)
  const rawTitle = (input.title ?? '').trim()
  const upper = input.typography.uppercase && preset.title.allowUppercase
  return {
    W: input.width,
    H: input.height,
    S: Math.min(input.width, input.height),
    mul: SIZE_MUL[input.typography.size] ?? 1,
    size: input.typography.size,
    colors: input.colors,
    measure: input.measure,
    titleFace: preset.title,
    bodyFace: preset.body,
    title: upper ? rawTitle.toLocaleUpperCase() : rawTitle,
    subtitle: (input.subtitle ?? '').trim(),
    coords: (input.coords ?? '').trim(),
  }
}

function titleStyle(c: Ctx, size: number): TextStyle {
  const f = c.titleFace
  return { family: f.family, weight: f.weight, style: f.style, size, letterSpacing: f.letterSpacing * size, color: c.colors.text }
}

function bodyStyle(c: Ctx, size: number, extraTrackingEm = 0): TextStyle {
  const f = c.bodyFace
  return {
    family: f.family,
    weight: f.weight,
    style: f.style,
    size,
    letterSpacing: (f.letterSpacing + extraTrackingEm) * size,
    color: c.colors.text,
  }
}

function measure(c: Ctx, text: string, style: TextStyle) {
  return text ? c.measure(text, style) : 0
}

function scaleStyle(style: TextStyle, factor: number): TextStyle {
  return { ...style, size: style.size * factor, letterSpacing: style.letterSpacing * factor }
}

/** Shrinks a style so that `text` fits into `maxWidth`. */
function fitStyle(c: Ctx, text: string, style: TextStyle, maxWidth: number): TextStyle {
  const w = measure(c, text, style)
  if (w <= maxWidth || w === 0) return style
  return scaleStyle(style, Math.max(0.05, maxWidth / w))
}

/**
 * Fits a title into `maxWidth`, breaking it into two balanced lines if that allows a
 * considerably larger font size than shrinking a single line would.
 */
function fitTitle(c: Ctx, text: string, style: TextStyle, maxWidth: number, allowWrap: boolean) {
  const w1 = measure(c, text, style)
  if (w1 <= maxWidth || w1 === 0) return { lines: [text], style }
  const single = maxWidth / w1
  const words = text.split(/\s+/)
  if (allowWrap && words.length > 1 && single < 0.78) {
    let best = { lines: [text], width: w1 }
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
      const width = Math.max(...lines.map(l => measure(c, l, style)))
      if (width < best.width) best = { lines, width }
    }
    const double = Math.min(1, maxWidth / best.width) * 0.92
    if (best.lines.length === 2 && double > single * 1.2) {
      return { lines: best.lines, style: scaleStyle(style, double) }
    }
  }
  return { lines: [text], style: scaleStyle(style, single) }
}

function capHeight(c: Ctx, style: TextStyle) {
  const face = style.family === c.titleFace.family ? c.titleFace : c.bodyFace
  return face.capHeight * style.size
}

// ---------------------------------------------------------------------------------------------
// Vertical stacks of text (used by most layouts)
// ---------------------------------------------------------------------------------------------

type StackItem
  = | { kind: 'text', role: TextRole, lines: string[], style: TextStyle }
    | { kind: 'divider', width: number, thickness: number, color: string }
    | { kind: 'space', h: number }

const LINE_HEIGHT = 1.08

function itemHeight(c: Ctx, item: StackItem) {
  if (item.kind === 'space') return item.h
  if (item.kind === 'divider') return item.thickness
  return capHeight(c, item.style) + (item.lines.length - 1) * item.style.size * LINE_HEIGHT
}

function stackHeight(c: Ctx, items: StackItem[]) {
  return items.reduce((sum, i) => sum + itemHeight(c, i), 0)
}

function placeStack(c: Ctx, items: StackItem[], x: number, top: number, align: 'left' | 'center'): SceneNode[] {
  const nodes: SceneNode[] = []
  let y = top
  for (const item of items) {
    if (item.kind === 'space') {
      y += item.h
      continue
    }
    if (item.kind === 'divider') {
      const x1 = align === 'center' ? x - item.width / 2 : x
      nodes.push({ kind: 'line', x1, y1: y + item.thickness / 2, x2: x1 + item.width, y2: y + item.thickness / 2, color: item.color, width: item.thickness })
      y += item.thickness
      continue
    }
    let baseline = y + capHeight(c, item.style)
    for (const line of item.lines) {
      nodes.push({ kind: 'text', role: item.role, text: line, x, y: baseline, align, style: item.style })
      baseline += item.style.size * LINE_HEIGHT
    }
    y += itemHeight(c, item)
  }
  return nodes
}

interface StackOptions {
  maxWidth: number
  titleSize: number
  divider?: boolean
  /** Scale for the secondary lines. */
  bodyScale?: number
}

function textStack(c: Ctx, o: StackOptions): StackItem[] {
  const { S, mul } = c
  const items: StackItem[] = []
  const bodyScale = o.bodyScale ?? 1
  const hasBody = Boolean(c.subtitle || c.coords)
  if (c.title) {
    const fitted = fitTitle(c, c.title, titleStyle(c, o.titleSize * S * mul), o.maxWidth, true)
    items.push({ kind: 'text', role: 'title', lines: fitted.lines, style: fitted.style })
    if (hasBody) {
      if (o.divider) {
        items.push({ kind: 'space', h: 0.03 * S * mul })
        items.push({ kind: 'divider', width: 0.06 * S, thickness: 0.0028 * S, color: c.colors.text })
        items.push({ kind: 'space', h: 0.028 * S * mul })
      } else {
        items.push({ kind: 'space', h: 0.032 * S * mul })
      }
    }
  }
  if (c.subtitle) {
    const style = fitStyle(c, c.subtitle, bodyStyle(c, 0.024 * S * mul * bodyScale, 0.16), o.maxWidth)
    items.push({ kind: 'text', role: 'subtitle', lines: [c.subtitle], style })
    if (c.coords) items.push({ kind: 'space', h: 0.016 * S * mul })
  }
  if (c.coords) {
    const style = fitStyle(c, c.coords, bodyStyle(c, 0.0165 * S * mul * bodyScale, 0.06), o.maxWidth)
    items.push({ kind: 'text', role: 'coords', lines: [c.coords], style })
  }
  return items
}

function hasText(c: Ctx) {
  return Boolean(c.title || c.subtitle || c.coords)
}

// ---------------------------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------------------------

function frameInset(frame: FrameId, S: number) {
  switch (frame) {
    case 'margin':
    case 'line':
      return 0.05 * S
    case 'double':
      return 0.065 * S
    default:
      return 0
  }
}

function inflate(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d }
}

function frameNodes(frame: FrameId, content: Rect, S: number, color: string): SceneNode[] {
  if (frame === 'line') {
    return [{ kind: 'strokeRect', rect: inflate(content, 0.016 * S), color, width: 0.0025 * S }]
  }
  if (frame === 'double') {
    return [
      { kind: 'strokeRect', rect: inflate(content, 0.012 * S), color, width: 0.0016 * S },
      { kind: 'strokeRect', rect: inflate(content, 0.028 * S), color, width: 0.0048 * S },
    ]
  }
  return []
}

function ringNodes(frame: FrameId, cx: number, cy: number, r: number, S: number, color: string): SceneNode[] {
  if (frame === 'line') return [{ kind: 'strokeCircle', cx, cy, r: r + 0.016 * S, color, width: 0.0025 * S }]
  if (frame === 'double') {
    return [
      { kind: 'strokeCircle', cx, cy, r: r + 0.012 * S, color, width: 0.0016 * S },
      { kind: 'strokeCircle', cx, cy, r: r + 0.028 * S, color, width: 0.0048 * S },
    ]
  }
  return []
}

// ---------------------------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------------------------

interface LayoutResult {
  map: SceneMap
  nodes: SceneNode[]
  /** Where the attribution goes; omitted → bottom right inside the map. */
  attribution?: { x: number, y: number, align: 'left' | 'center' | 'right', onMap: boolean }
}

type LayoutFn = (c: Ctx, C: Rect, frame: FrameId) => LayoutResult

const card: LayoutFn = (c, C) => {
  const { S, mul } = c
  if (!hasText(c)) return { map: { shape: 'rect', rect: C }, nodes: [] }
  const boxH = S * { s: 0.12, m: 0.14, l: 0.16 }[c.size]
  const map: Rect = { x: C.x, y: C.y, w: C.w, h: C.h - boxH }
  const box: Rect = { x: C.x, y: C.y + C.h - boxH, w: C.w, h: boxH }
  const nodes: SceneNode[] = [{ kind: 'rect', rect: box, fill: c.colors.textBox }]
  const pad = 0.05 * S
  const inner = C.w - 2 * pad
  const gap = 0.028 * S
  const boxCy = box.y + boxH / 2

  let sub = c.subtitle ? bodyStyle(c, 0.021 * S * mul, 0.08) : null
  let crd = c.coords ? bodyStyle(c, 0.0145 * S * mul) : null
  const sideMax = c.title ? inner * 0.45 : inner
  if (sub) sub = fitStyle(c, c.subtitle, sub, sideMax)
  if (crd) crd = fitStyle(c, c.coords, crd, sideMax)
  const sideW = Math.max(sub ? measure(c, c.subtitle, sub) : 0, crd ? measure(c, c.coords, crd) : 0)

  let baseline = boxCy
  if (c.title) {
    const maxTitle = inner - (sideW ? sideW + 2 * gap : 0)
    const style = fitStyle(c, c.title, titleStyle(c, 0.074 * S * mul), maxTitle)
    baseline = boxCy + capHeight(c, style) / 2
    nodes.push({ kind: 'text', role: 'title', text: c.title, x: C.x + pad, y: baseline, align: 'left', style })
  }
  // Like a ticket stub: the details sit at the right edge, separated by a thin rule.
  const sideX = c.title ? C.x + C.w - pad - sideW : C.x + pad
  if (sub || crd) {
    const subCap = sub ? capHeight(c, sub) : 0
    const crdCap = crd ? capHeight(c, crd) : 0
    const between = sub && crd ? 0.75 * crd.size : 0
    if (!c.title) baseline = boxCy + (subCap + between + crdCap) / 2
    if (crd) nodes.push({ kind: 'text', role: 'coords', text: c.coords, x: sideX, y: baseline, align: 'left', style: crd })
    if (sub) {
      const y = crd ? baseline - crdCap - between : baseline
      nodes.push({ kind: 'text', role: 'subtitle', text: c.subtitle, x: sideX, y, align: 'left', style: sub })
    }
    if (c.title) {
      const ruleX = sideX - gap
      nodes.push({ kind: 'line', x1: ruleX, y1: box.y + boxH * 0.24, x2: ruleX, y2: box.y + boxH * 0.76, color: c.colors.text, width: 0.0022 * S })
    }
  }
  return { map: { shape: 'rect', rect: map }, nodes }
}

const classic: LayoutFn = (c, C) => {
  const { S } = c
  if (!hasText(c)) return { map: { shape: 'rect', rect: C }, nodes: [] }
  const area = S * { s: 0.215, m: 0.245, l: 0.285 }[c.size]
  const map: Rect = { x: C.x, y: C.y, w: C.w, h: C.h - area }
  const items = textStack(c, { maxWidth: C.w - 0.12 * S, titleSize: 0.082, divider: true })
  const h = stackHeight(c, items)
  const top = map.y + map.h + (area - h) / 2
  return { map: { shape: 'rect', rect: map }, nodes: placeStack(c, items, C.x + C.w / 2, top, 'center') }
}

const poster: LayoutFn = (c, C) => {
  const { S } = c
  const nodes: SceneNode[] = []
  if (!hasText(c)) return { map: { shape: 'rect', rect: C }, nodes }
  const items = textStack(c, { maxWidth: C.w - 0.14 * S, titleSize: 0.095 })
  const h = stackHeight(c, items)
  const bottom = C.y + C.h - 0.085 * S
  const fadeH = Math.min(C.h, h + 0.34 * S)
  nodes.push({ kind: 'fade', rect: { x: C.x, y: C.y + C.h - fadeH, w: C.w, h: fadeH }, color: c.colors.textBox, solidFrom: 0.5 })
  nodes.push(...placeStack(c, items, C.x + C.w / 2, bottom - h, 'center'))
  return {
    map: { shape: 'rect', rect: C },
    nodes,
    attribution: { x: C.x + C.w - 0.016 * S, y: C.y + C.h - 0.016 * S, align: 'right', onMap: false },
  }
}

const halo: LayoutFn = (c, C, frame) => {
  const { S, W, H } = c
  const landscape = W / H >= 1.15
  const nodes: SceneNode[] = []
  let cx: number, cy: number, d: number
  if (landscape) {
    d = Math.min(C.h - 0.16 * S, C.w * 0.5)
    cx = C.x + C.w * (hasText(c) ? 0.32 : 0.5)
    cy = C.y + C.h / 2
    if (hasText(c)) {
      const textX = C.x + C.w * 0.74
      const items = textStack(c, { maxWidth: C.w * 0.4, titleSize: 0.085 })
      nodes.push(...placeStack(c, items, textX, cy - stackHeight(c, items) / 2, 'center'))
    }
  } else {
    const area = hasText(c) ? 0.26 * S : 0
    d = Math.min(C.w - 0.2 * S, C.h - area - 0.14 * S)
    cx = C.x + C.w / 2
    cy = C.y + (C.h - area) / 2 + (area ? 0.035 * S : 0)
    if (hasText(c)) {
      const items = textStack(c, { maxWidth: C.w - 0.14 * S, titleSize: 0.082, divider: true })
      const top = cy + d / 2
      const h = stackHeight(c, items)
      nodes.push(...placeStack(c, items, cx, top + (C.y + C.h - top - h) / 2 - 0.01 * S, 'center'))
    }
  }
  nodes.push(...ringNodes(frame, cx, cy, d / 2, S, c.colors.frame))
  return {
    map: { shape: 'circle', rect: { x: cx - d / 2, y: cy - d / 2, w: d, h: d } },
    nodes,
    attribution: { x: C.x + C.w / 2, y: C.y + C.h - 0.016 * S, align: 'center', onMap: false },
  }
}

const square: LayoutFn = (c, C) => {
  const { S, W, H } = c
  const ratio = H / W
  if (!hasText(c)) {
    const side = Math.min(C.w, C.h)
    return { map: { shape: 'rect', rect: { x: C.x + (C.w - side) / 2, y: C.y + (C.h - side) / 2, w: side, h: side } }, nodes: [] }
  }
  if (W / H >= 1.15) {
    const side = C.h
    const map: Rect = { x: C.x, y: C.y, w: side, h: side }
    const restW = C.w - side
    const items = textStack(c, { maxWidth: restW - 0.12 * S, titleSize: 0.085, divider: true })
    const nodes = placeStack(c, items, C.x + side + restW / 2, C.y + (C.h - stackHeight(c, items)) / 2, 'center')
    return { map: { shape: 'rect', rect: map }, nodes }
  }
  const items = textStack(c, { maxWidth: C.w - 0.12 * S, titleSize: 0.09, divider: true })
  const h = stackHeight(c, items)
  const needed = h + 0.12 * S
  let side = Math.min(C.w, C.h - needed)
  let top = C.y
  if (ratio < 1.15 || side < C.w) {
    // Not enough room for a full-width square: shrink it and give it some air on top.
    const gap = Math.min((C.w - side) / 2, 0.05 * S)
    top = C.y + gap
    side = Math.min(C.w, C.h - needed - gap)
  }
  const map: Rect = { x: C.x + (C.w - side) / 2, y: top, w: side, h: side }
  const areaTop = map.y + map.h
  const nodes = placeStack(c, items, C.x + C.w / 2, areaTop + (C.y + C.h - areaTop - h) / 2, 'center')
  return { map: { shape: 'rect', rect: map }, nodes }
}

const architect: LayoutFn = (c, C) => {
  const { S, mul } = c
  const nodes: SceneNode[] = []
  if (!hasText(c)) return { map: { shape: 'rect', rect: C }, nodes }
  const inset = 0.035 * S
  const pad = 0.024 * S
  const stroke = 0.0028 * S
  const maxBox = C.w - 2 * inset
  let tStyle = c.title ? titleStyle(c, 0.05 * S * mul) : null
  let sStyle = c.subtitle ? bodyStyle(c, 0.0185 * S * mul, 0.1) : null
  let kStyle = c.coords ? bodyStyle(c, 0.0135 * S * mul) : null
  if (tStyle) tStyle = fitStyle(c, c.title, tStyle, maxBox - 2 * pad)
  if (sStyle) sStyle = fitStyle(c, c.subtitle, sStyle, maxBox - 2 * pad)
  if (kStyle) kStyle = fitStyle(c, c.coords, kStyle, maxBox - 2 * pad)
  const contentW = Math.max(
    tStyle ? measure(c, c.title, tStyle) : 0,
    sStyle ? measure(c, c.subtitle, sStyle) : 0,
    kStyle ? measure(c, c.coords, kStyle) : 0,
  )
  const boxW = Math.min(maxBox, Math.max(0.3 * S, contentW + 2 * pad))
  const titleRowH = tStyle ? capHeight(c, tStyle) + 2 * pad : 0
  const between = sStyle && kStyle ? 0.012 * S * mul : 0
  const detailH = sStyle || kStyle
    ? (sStyle ? capHeight(c, sStyle) : 0) + between + (kStyle ? capHeight(c, kStyle) : 0) + 2 * pad * 0.85
    : 0
  const boxH = titleRowH + detailH
  const box: Rect = { x: C.x + C.w - inset - boxW, y: C.y + C.h - inset - boxH, w: boxW, h: boxH }
  nodes.push({ kind: 'rect', rect: box, fill: c.colors.textBox })
  nodes.push({ kind: 'strokeRect', rect: box, color: c.colors.frame, width: stroke })
  const x = box.x + pad
  if (tStyle) {
    nodes.push({ kind: 'text', role: 'title', text: c.title, x, y: box.y + pad + capHeight(c, tStyle), align: 'left', style: tStyle })
  }
  if (tStyle && detailH) {
    const y = box.y + titleRowH
    nodes.push({ kind: 'line', x1: box.x, y1: y, x2: box.x + box.w, y2: y, color: c.colors.frame, width: stroke * 0.7 })
  }
  let y = box.y + titleRowH + pad * 0.85
  if (sStyle) {
    y += capHeight(c, sStyle)
    nodes.push({ kind: 'text', role: 'subtitle', text: c.subtitle, x, y, align: 'left', style: sStyle })
    y += between
  }
  if (kStyle) {
    y += capHeight(c, kStyle)
    nodes.push({ kind: 'text', role: 'coords', text: c.coords, x, y, align: 'left', style: kStyle })
  }
  return {
    map: { shape: 'rect', rect: C },
    nodes,
    attribution: { x: C.x + 0.014 * S, y: C.y + C.h - 0.014 * S, align: 'left', onMap: true },
  }
}

const banner: LayoutFn = (c, C, frame) => {
  const { S } = c
  const nodes: SceneNode[] = []
  if (!hasText(c)) return { map: { shape: 'rect', rect: C }, nodes }
  const items = textStack(c, { maxWidth: C.w - 0.14 * S, titleSize: 0.07 })
  const h = stackHeight(c, items)
  const bandH = h + 0.09 * S
  const cy = Math.min(C.y + C.h * 0.8, C.y + C.h - bandH / 2 - 0.06 * S)
  const band: Rect = { x: C.x, y: cy - bandH / 2, w: C.w, h: bandH }
  nodes.push({ kind: 'rect', rect: band, fill: c.colors.textBox })
  if (frame === 'line' || frame === 'double') {
    const w = 0.0025 * S
    nodes.push({ kind: 'line', x1: band.x, y1: band.y, x2: band.x + band.w, y2: band.y, color: c.colors.frame, width: w })
    nodes.push({ kind: 'line', x1: band.x, y1: band.y + band.h, x2: band.x + band.w, y2: band.y + band.h, color: c.colors.frame, width: w })
  }
  nodes.push(...placeStack(c, items, C.x + C.w / 2, cy - h / 2, 'center'))
  return { map: { shape: 'rect', rect: C }, nodes }
}

const mapOnly: LayoutFn = (_c, C) => ({ map: { shape: 'rect', rect: C }, nodes: [] })

const LAYOUTS: Record<LayoutId, LayoutFn> = { card, classic, poster, halo, square, architect, banner, mapOnly }

export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[]

/** Layouts that never show text. */
export function layoutShowsText(layout: LayoutId) {
  return layout !== 'mapOnly'
}

export function computeScene(input: SceneInput): Scene {
  const c = makeCtx(input)
  if (!layoutShowsText(input.layout)) {
    c.title = ''
    c.subtitle = ''
    c.coords = ''
  }
  const { S, W, H } = c
  const inset = frameInset(input.frame, S)
  const content: Rect = { x: inset, y: inset, w: W - 2 * inset, h: H - 2 * inset }
  const layout = LAYOUTS[input.layout] ?? card
  const result = layout(c, content, input.frame)

  const nodes: SceneNode[] = [...result.nodes]
  if (result.map.shape === 'rect') nodes.push(...frameNodes(input.frame, content, S, c.colors.frame))

  const attribution = (input.attribution ?? '').trim()
  if (attribution) {
    const m = result.map.rect
    const anchor = result.attribution ?? { x: m.x + m.w - 0.014 * S, y: m.y + m.h - 0.014 * S, align: 'right' as const, onMap: true }
    const style: TextStyle = {
      family: 'Open Sans',
      weight: 400,
      style: 'normal',
      size: 0.0088 * S,
      letterSpacing: 0.02 * 0.0088 * S,
      color: anchor.onMap ? withAlpha(c.colors.roads, 0.78) : withAlpha(c.colors.text, 0.55),
    }
    nodes.push({
      kind: 'text',
      role: 'attribution',
      text: attribution,
      x: anchor.x,
      y: anchor.y,
      align: anchor.align,
      style,
      halo: anchor.onMap ? { color: withAlpha(c.colors.land, 0.85), width: 0.0028 * S } : undefined,
    })
  }

  return { width: W, height: H, paper: c.colors.paper, map: result.map, nodes }
}

/** Integer CSS size of the MapLibre container for a map rect (layout units × detail scale). */
export function mapContainerSize(rect: Rect, detailScale: number) {
  return {
    width: Math.max(1, Math.round(rect.w * detailScale)),
    height: Math.max(1, Math.round(rect.h * detailScale)),
  }
}

/** All distinct fonts used by a scene, as canvas font strings at a nominal size. */
export function sceneFonts(scene: Scene): { family: string, weight: number, style: 'normal' | 'italic' }[] {
  const map = new Map<string, { family: string, weight: number, style: 'normal' | 'italic' }>()
  for (const n of scene.nodes) {
    if (n.kind !== 'text') continue
    const { family, weight, style } = n.style
    map.set(`${style}|${weight}|${family}`, { family, weight, style })
  }
  return [...map.values()]
}
