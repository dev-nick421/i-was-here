import { posterUnits } from './formats'
import { detailZoomOffset, formatCoordinates, type Camera } from './geo'
import { computeScene, type MeasureFn, type Scene } from './scene'
import type { PosterContent, PosterStyle } from './types'

/** Glue between the stored poster state and the layout engine. */

export interface ResolvedTexts {
  title: string
  subtitle: string
  coords: string
}

export function resolveTexts(style: PosterStyle, content: PosterContent, locale: string): ResolvedTexts {
  const t = content.text
  let coords = ''
  if (t.showCoords) {
    if (t.coordsMode === 'custom') {
      coords = t.coordsCustom
    } else {
      coords = formatCoordinates(content.view.lat, content.view.lng, style.typography.coordFormat, locale)
    }
  }
  return {
    title: t.showTitle ? t.title : '',
    subtitle: t.showSubtitle ? t.subtitle : '',
    coords,
  }
}

export function buildScene(
  style: PosterStyle,
  content: PosterContent,
  opts: { locale: string, measure: MeasureFn, attribution: string },
): Scene {
  const units = posterUnits(style.output)
  const texts = resolveTexts(style, content, opts.locale)
  return computeScene({
    width: units.width,
    height: units.height,
    layout: style.layout,
    frame: style.frame,
    colors: style.colors,
    typography: style.typography,
    ...texts,
    attribution: style.attribution ? opts.attribution : '',
    measure: opts.measure,
  })
}

/** MapLibre camera for the stored view (normalised zoom + detail offset). */
export function mapCamera(content: PosterContent, style: PosterStyle): Camera {
  return {
    lng: content.view.lng,
    lat: content.view.lat,
    zoom: content.view.zoom + detailZoomOffset(style.map.detail),
    bearing: content.view.bearing,
  }
}

/** File name for an export, e.g. `hamburg_30x40_4k.png`. */
export function exportFileName(style: PosterStyle, content: PosterContent, ext: string) {
  const base = (content.text.title || content.place?.name || 'map-poster')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'map-poster'
  const o = style.output
  const paper = o.paper === 'custom' ? `${o.customWidthCm}x${o.customHeightCm}cm` : o.paper
  const orientation = o.paper !== 'custom' && o.orientation === 'landscape' ? '-landscape' : ''
  return `${base}_${paper}${orientation}_${o.resolution}.${ext}`
}
