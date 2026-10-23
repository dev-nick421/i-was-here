/**
 * Shared domain types. Everything in `app/core` is framework-free TypeScript so it can be
 * unit-tested in isolation and reused by the preview and the export renderer alike.
 */

export type LayoutId
  = | 'card'
    | 'classic'
    | 'poster'
    | 'halo'
    | 'square'
    | 'architect'
    | 'banner'
    | 'mapOnly'

export type FrameId = 'none' | 'margin' | 'line' | 'double'
export type TextSize = 's' | 'm' | 'l'
export type CoordFormat = 'dms' | 'dm' | 'decimal'
export type DetailLevel = 'low' | 'medium' | 'high'
export type RoadDensity = 'major' | 'standard' | 'all'
export type Orientation = 'portrait' | 'landscape'
export type ResolutionId = 'hd' | 'wqhd' | '4k' | '8k' | 'print150' | 'print300'
export type FileType = 'png' | 'jpeg' | 'pdf'
export type FontId
  = | 'modern'
    | 'regular'
    | 'classic'
    | 'playful'
    | 'elegant'
    | 'signature'
    | 'poster'
    | 'vintage'
    | 'technical'
    | 'editorial'
export type PaperId
  = | '30x40'
    | '45x60'
    | '50x70'
    | '60x80'
    | '70x100'
    | 'a4'
    | 'a3'
    | 'a2'
    | 'a1'
    | '30x30'
    | '50x50'
    | 'custom'

/** All colors are lowercase `#rrggbb` hex strings. */
export interface ThemeColors {
  land: string
  water: string
  roads: string
  buildings: string
  parks: string
  paper: string
  textBox: string
  text: string
  frame: string
}

export interface MapOptions {
  /** How much street detail is loaded for a given map extent (renders at a higher zoom level). */
  detail: DetailLevel
  roads: RoadDensity
  buildings: boolean
  parks: boolean
  water: boolean
  rail: boolean
  labels: boolean
  /** Multiplier for all line widths (0.4 – 2.5). */
  lineWidth: number
}

export interface TypographyOptions {
  font: FontId
  size: TextSize
  uppercase: boolean
  coordFormat: CoordFormat
}

export interface OutputOptions {
  paper: PaperId
  /** Only used when `paper` is `custom`. */
  customWidthCm: number
  customHeightCm: number
  orientation: Orientation
  resolution: ResolutionId
  fileType: FileType
  /** 0.5 – 1 */
  jpegQuality: number
}

/** Everything that defines the *look* of a poster. This is what a profile stores. */
export interface PosterStyle {
  layout: LayoutId
  frame: FrameId
  /** Id of the preset the colors came from, or `custom` once edited. */
  themeId: string
  colors: ThemeColors
  map: MapOptions
  typography: TypographyOptions
  output: OutputOptions
  /** Print the OpenStreetMap attribution on the poster. */
  attribution: boolean
}

export interface MapView {
  lng: number
  lat: number
  /**
   * Zoom normalised to the "low" detail level. The real MapLibre zoom is
   * `zoom + detailZoomOffset(detail)` so changing the detail level keeps the extent.
   */
  zoom: number
  bearing: number
}

export interface PosterText {
  title: string
  subtitle: string
  showTitle: boolean
  showSubtitle: boolean
  showCoords: boolean
  coordsMode: 'auto' | 'custom'
  coordsCustom: string
}

export interface PlaceInfo {
  name: string
  country?: string
  countryCode?: string
}

/** Everything that is specific to *one* poster: where it is and what it says. */
export interface PosterContent {
  view: MapView
  text: PosterText
  place: PlaceInfo | null
}

export interface Profile {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  style: PosterStyle
  /** Optional: a profile can also carry a full poster (location and text). */
  content?: PosterContent
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
