import type { FontId } from './types'

export interface FontFace {
  family: string
  weight: number
  style: 'normal' | 'italic'
  /** Cap height as a fraction of the font size, used to center caps optically. */
  capHeight: number
}

export interface FontPreset {
  id: FontId
  name: string
  title: FontFace & {
    /** Letter spacing in em. */
    letterSpacing: number
    /** Script fonts look wrong in caps, so the "uppercase" switch is ignored for them. */
    allowUppercase: boolean
  }
  body: FontFace & { letterSpacing: number }
}

const montserrat = (weight: number): FontFace => ({ family: 'Montserrat', weight, style: 'normal', capHeight: 0.7 })
const openSans = (weight: number): FontFace => ({ family: 'Open Sans', weight, style: 'normal', capHeight: 0.714 })

export const FONT_PRESETS: readonly FontPreset[] = [
  {
    id: 'regular',
    name: 'Grotesk',
    title: { ...openSans(700), letterSpacing: 0.1, allowUppercase: true },
    body: { ...openSans(400), letterSpacing: 0.06 },
  },
  {
    id: 'modern',
    name: 'Geometric',
    title: { ...montserrat(700), letterSpacing: 0.16, allowUppercase: true },
    body: { ...montserrat(500), letterSpacing: 0.12 },
  },
  {
    id: 'classic',
    name: 'Didone',
    title: { family: 'Playfair Display', weight: 700, style: 'normal', capHeight: 0.708, letterSpacing: 0.06, allowUppercase: true },
    body: { family: 'Playfair Display', weight: 400, style: 'italic', capHeight: 0.708, letterSpacing: 0.04 },
  },
  {
    id: 'elegant',
    name: 'Garamond',
    title: { family: 'Cormorant Garamond', weight: 600, style: 'normal', capHeight: 0.63, letterSpacing: 0.18, allowUppercase: true },
    body: { family: 'Cormorant Garamond', weight: 500, style: 'italic', capHeight: 0.63, letterSpacing: 0.06 },
  },
  {
    id: 'signature',
    name: 'Script',
    title: { family: 'Great Vibes', weight: 400, style: 'normal', capHeight: 0.62, letterSpacing: 0, allowUppercase: false },
    body: { ...montserrat(500), letterSpacing: 0.14 },
  },
  {
    id: 'playful',
    name: 'Rounded',
    title: { family: 'Fredoka', weight: 600, style: 'normal', capHeight: 0.7, letterSpacing: 0.04, allowUppercase: true },
    body: { family: 'Fredoka', weight: 400, style: 'normal', capHeight: 0.7, letterSpacing: 0.06 },
  },
  {
    id: 'poster',
    name: 'Condensed',
    title: { family: 'Bebas Neue', weight: 400, style: 'normal', capHeight: 0.7, letterSpacing: 0.12, allowUppercase: true },
    body: { ...montserrat(500), letterSpacing: 0.16 },
  },
  {
    id: 'vintage',
    name: 'Deco',
    title: { family: 'Josefin Sans', weight: 700, style: 'normal', capHeight: 0.75, letterSpacing: 0.14, allowUppercase: true },
    body: { family: 'Josefin Sans', weight: 400, style: 'normal', capHeight: 0.75, letterSpacing: 0.1 },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    title: { family: 'DM Serif Display', weight: 400, style: 'normal', capHeight: 0.71, letterSpacing: 0.03, allowUppercase: true },
    body: { ...openSans(400), letterSpacing: 0.1 },
  },
  {
    id: 'technical',
    name: 'Mono',
    title: { family: 'Space Mono', weight: 700, style: 'normal', capHeight: 0.66, letterSpacing: 0.04, allowUppercase: true },
    body: { family: 'Space Mono', weight: 400, style: 'normal', capHeight: 0.66, letterSpacing: 0.02 },
  },
] as const

export const DEFAULT_FONT_ID: FontId = 'regular'

export function getFontPreset(id: FontId | string): FontPreset {
  return FONT_PRESETS.find(f => f.id === id) ?? FONT_PRESETS[0]!
}

/** CSS / canvas font shorthand, e.g. `italic 400 24px "Playfair Display"`. */
export function cssFont(face: Pick<FontFace, 'family' | 'weight' | 'style'>, sizePx: number): string {
  const style = face.style === 'italic' ? 'italic ' : ''
  return `${style}${face.weight} ${round(sizePx)}px "${face.family}"`
}

function round(n: number) {
  return Math.round(n * 1000) / 1000
}

/** All font faces that may be used on a poster (for preloading before an export). */
export function allPosterFaces(): FontFace[] {
  const seen = new Map<string, FontFace>()
  for (const p of FONT_PRESETS) {
    for (const f of [p.title, p.body]) seen.set(cssFont(f, 10), f)
  }
  return [...seen.values()]
}
