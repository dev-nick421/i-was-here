import { getTheme, DEFAULT_THEME_ID } from './themes'
import type { PosterContent, PosterStyle } from './types'

export const DEFAULT_STYLE: PosterStyle = Object.freeze({
  layout: 'classic',
  frame: 'margin',
  themeId: DEFAULT_THEME_ID,
  colors: { ...getTheme(DEFAULT_THEME_ID)!.colors },
  map: {
    detail: 'medium',
    roads: 'standard',
    buildings: true,
    parks: false,
    water: true,
    rail: false,
    labels: false,
    lineWidth: 1,
  },
  typography: {
    font: 'editorial',
    size: 'm',
    uppercase: true,
    coordFormat: 'dms',
  },
  output: {
    paper: '30x40',
    customWidthCm: 40,
    customHeightCm: 50,
    orientation: 'portrait',
    resolution: '4k',
    fileType: 'png',
    jpegQuality: 0.92,
  },
  attribution: true,
}) as PosterStyle

/** The poster a first-time visitor sees. */
export function defaultContent(locale = 'en'): PosterContent {
  const de = locale.startsWith('de')
  return {
    view: { lng: 9.9937, lat: 53.5511, zoom: 11.9, bearing: 0 },
    text: {
      title: 'Hamburg',
      subtitle: de ? 'DEUTSCHLAND' : 'GERMANY',
      showTitle: true,
      showSubtitle: true,
      showCoords: true,
      coordsMode: 'auto',
      coordsCustom: '',
    },
    place: { name: 'Hamburg', country: de ? 'Deutschland' : 'Germany', countryCode: 'de' },
  }
}

/** Deep copy of plain JSON data. Also strips Vue's reactive proxies. */
export function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
