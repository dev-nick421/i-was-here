import type { OutputOptions, PaperId, ResolutionId } from './types'

export interface PaperFormat {
  id: PaperId
  label: string
  /** Portrait dimensions (width <= height) in centimetres. */
  widthCm: number
  heightCm: number
  group: 'poster' | 'iso' | 'square' | 'custom'
}

export const PAPER_FORMATS: readonly PaperFormat[] = [
  { id: '30x40', label: '30 × 40', widthCm: 30, heightCm: 40, group: 'poster' },
  { id: '45x60', label: '45 × 60', widthCm: 45, heightCm: 60, group: 'poster' },
  { id: '50x70', label: '50 × 70', widthCm: 50, heightCm: 70, group: 'poster' },
  { id: '60x80', label: '60 × 80', widthCm: 60, heightCm: 80, group: 'poster' },
  { id: '70x100', label: '70 × 100', widthCm: 70, heightCm: 100, group: 'poster' },
  { id: 'a4', label: 'A4', widthCm: 21, heightCm: 29.7, group: 'iso' },
  { id: 'a3', label: 'A3', widthCm: 29.7, heightCm: 42, group: 'iso' },
  { id: 'a2', label: 'A2', widthCm: 42, heightCm: 59.4, group: 'iso' },
  { id: 'a1', label: 'A1', widthCm: 59.4, heightCm: 84.1, group: 'iso' },
  { id: '30x30', label: '30 × 30', widthCm: 30, heightCm: 30, group: 'square' },
  { id: '50x50', label: '50 × 50', widthCm: 50, heightCm: 50, group: 'square' },
  { id: 'custom', label: 'Custom', widthCm: 40, heightCm: 50, group: 'custom' },
] as const

export const CUSTOM_SIZE_LIMITS = { min: 5, max: 300 } as const

export interface ResolutionPreset {
  id: ResolutionId
  label: string
  /** Pixel count of the long edge … */
  longEdge?: number
  /** … or a print density in dots per inch. */
  dpi?: number
}

export const RESOLUTIONS: readonly ResolutionPreset[] = [
  { id: 'hd', label: 'Full HD', longEdge: 1920 },
  { id: 'wqhd', label: 'WQHD', longEdge: 2560 },
  { id: '4k', label: '4K UHD', longEdge: 3840 },
  { id: '8k', label: '8K', longEdge: 7680 },
  { id: 'print150', label: '150 DPI', dpi: 150 },
  { id: 'print300', label: '300 DPI', dpi: 300 },
] as const

/** The poster's short side is always this many layout units, independent of paper size. */
export const SHORT_SIDE_UNITS = 1000

export function getPaper(id: PaperId): PaperFormat {
  return PAPER_FORMATS.find(p => p.id === id) ?? PAPER_FORMATS[0]!
}

export function getResolution(id: ResolutionId): ResolutionPreset {
  return RESOLUTIONS.find(r => r.id === id) ?? RESOLUTIONS[2]!
}

function clampCm(n: number) {
  if (!Number.isFinite(n)) return CUSTOM_SIZE_LIMITS.min
  return Math.min(CUSTOM_SIZE_LIMITS.max, Math.max(CUSTOM_SIZE_LIMITS.min, n))
}

/** Physical size of the poster in centimetres, with orientation applied. */
export function paperSizeCm(output: Pick<OutputOptions, 'paper' | 'orientation' | 'customWidthCm' | 'customHeightCm'>) {
  let w: number
  let h: number
  if (output.paper === 'custom') {
    // Custom sizes are taken literally; orientation is implied by the numbers.
    return { width: clampCm(output.customWidthCm), height: clampCm(output.customHeightCm) }
  }
  const paper = getPaper(output.paper)
  w = paper.widthCm
  h = paper.heightCm
  if (output.orientation === 'landscape') [w, h] = [h, w]
  return { width: w, height: h }
}

/** Size of the poster in layout units (short side = 1000). */
export function posterUnits(output: Parameters<typeof paperSizeCm>[0]) {
  const { width, height } = paperSizeCm(output)
  const short = Math.min(width, height)
  return {
    width: (width / short) * SHORT_SIDE_UNITS,
    height: (height / short) * SHORT_SIDE_UNITS,
  }
}

export interface OutputPixels {
  width: number
  height: number
  /** Effective print density at the chosen paper size. */
  dpi: number
}

/** Final image size in pixels for the selected paper + resolution. */
export function outputPixels(output: Pick<OutputOptions, 'paper' | 'orientation' | 'customWidthCm' | 'customHeightCm' | 'resolution'>): OutputPixels {
  const { width: wCm, height: hCm } = paperSizeCm(output)
  const res = getResolution(output.resolution)
  let width: number
  let height: number
  if (res.dpi) {
    width = Math.round((wCm / 2.54) * res.dpi)
    height = Math.round((hCm / 2.54) * res.dpi)
  } else {
    const scale = res.longEdge! / Math.max(wCm, hCm)
    width = Math.round(wCm * scale)
    height = Math.round(hCm * scale)
  }
  const dpi = width / (wCm / 2.54)
  return { width, height, dpi }
}

export type PrintQuality = 'excellent' | 'good' | 'fair' | 'low'

export function printQuality(dpi: number): PrintQuality {
  if (dpi >= 240) return 'excellent'
  if (dpi >= 150) return 'good'
  if (dpi >= 100) return 'fair'
  return 'low'
}

export function formatCm(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)
}

export function formatPaperSize(output: Parameters<typeof paperSizeCm>[0], locale: string) {
  const { width, height } = paperSizeCm(output)
  return `${formatCm(width, locale)} × ${formatCm(height, locale)} cm`
}
