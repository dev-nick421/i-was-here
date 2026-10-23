import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl'
import { detailScale, detailZoomOffset } from './geo'
import type { MapOptions, ThemeColors } from './types'

/**
 * Builds a MapLibre style for the poster look from the theme colors and map options.
 * The style targets the OpenMapTiles vector schema (used by OpenFreeMap, MapTiler,
 * tileserver-gl, Planetiler, …).
 *
 * All widths and zoom stops are defined for the "low" detail level. For higher detail
 * levels the map is rendered `dz` zoom levels deeper in a proportionally larger container,
 * so every zoom stop is shifted by `dz` and every width multiplied by `2^dz`. The result
 * looks identical – just with more streets.
 */

export interface MapStyleOptions {
  colors: ThemeColors
  map: MapOptions
  tilesUrl: string
  glyphsUrl: string
  labelFont: string
  /** Language for labels (`name:de`, `name:en`, …). */
  language: string
  /** Paint transition duration; 0 for exports. */
  transitionMs?: number
}

type Stops = readonly (readonly [zoom: number, width: number])[]

/** Line widths in px at the reference detail level. */
export const ROAD_WIDTHS = {
  motorway: [[6, 0.5], [8, 0.8], [10, 1.4], [12, 2.6], [14, 5], [16, 11], [18, 28]],
  primary: [[7, 0.35], [8, 0.55], [10, 1.05], [12, 2], [14, 4], [16, 9], [18, 22]],
  secondary: [[8, 0.3], [10, 0.75], [12, 1.5], [14, 3.2], [16, 7.5], [18, 18]],
  tertiary: [[9, 0.25], [10, 0.45], [12, 1.1], [14, 2.6], [16, 6], [18, 15]],
  minor: [[11, 0.2], [12, 0.45], [14, 1.35], [16, 3.6], [18, 10]],
  path: [[12, 0.15], [14, 0.5], [16, 1.2], [18, 2.6]],
  rail: [[9, 0.25], [12, 0.6], [14, 1.1], [16, 2], [18, 3.5]],
  river: [[6, 0.4], [10, 0.9], [12, 1.6], [14, 3.2], [16, 7], [18, 16]],
  stream: [[11, 0.2], [13, 0.5], [14, 0.8], [16, 1.6], [18, 3]],
} as const satisfies Record<string, Stops>

const LINE: ExpressionSpecification = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false]
const POLYGON: ExpressionSpecification = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false]

function classIn(...classes: string[]): ExpressionSpecification {
  return ['match', ['get', 'class'], classes, true, false]
}

function notTunnel(): ExpressionSpecification {
  return ['!=', ['coalesce', ['get', 'brunnel'], ''], 'tunnel']
}

function all(...exprs: ExpressionSpecification[]): FilterSpecification {
  return ['all', ...exprs] as FilterSpecification
}

export function widthExpression(stops: Stops, dz: number, factor: number): ExpressionSpecification {
  const flat: number[] = []
  for (const [z, w] of stops) flat.push(z + dz, round(w * factor))
  return ['interpolate', ['exponential', 1.55], ['zoom'], ...flat] as ExpressionSpecification
}

function round(n: number) {
  return Math.round(n * 10000) / 10000
}

export function vectorSource(tilesUrl: string): SourceSpecification {
  if (tilesUrl.includes('{z}')) {
    return { type: 'vector', tiles: [tilesUrl], minzoom: 0, maxzoom: 14 }
  }
  return { type: 'vector', url: tilesUrl }
}

export const SOURCE_ID = 'omt'

export function buildMapStyle(o: MapStyleOptions): StyleSpecification {
  const { colors, map } = o
  const dz = detailZoomOffset(map.detail)
  const k = detailScale(map.detail)
  const lw = Math.max(0.2, Math.min(4, map.lineWidth)) * k
  const layers: LayerSpecification[] = []
  const src = { source: SOURCE_ID } as const

  layers.push({ id: 'land', type: 'background', paint: { 'background-color': colors.land } })

  if (map.parks) {
    layers.push({
      'id': 'parks-landcover',
      'type': 'fill',
      ...src,
      'source-layer': 'landcover',
      'filter': classIn('wood', 'grass'),
      'paint': { 'fill-color': colors.parks, 'fill-antialias': false },
    })
    layers.push({
      'id': 'parks-landuse',
      'type': 'fill',
      ...src,
      'source-layer': 'landuse',
      'filter': classIn('cemetery', 'pitch', 'playground', 'garden', 'park'),
      'paint': { 'fill-color': colors.parks, 'fill-antialias': false },
    })
    layers.push({
      'id': 'parks',
      'type': 'fill',
      ...src,
      'source-layer': 'park',
      'filter': all(POLYGON, ['!', classIn('national_park', 'protected_area', 'nature_reserve', 'aboriginal_lands')]),
      'paint': { 'fill-color': colors.parks, 'fill-antialias': false },
    })
  }

  if (map.water) {
    layers.push({
      'id': 'water',
      'type': 'fill',
      ...src,
      'source-layer': 'water',
      'filter': all(POLYGON, notTunnel(), ['!', classIn('swimming_pool')]),
      'paint': { 'fill-color': colors.water, 'fill-antialias': true },
    })
    layers.push({
      'id': 'waterway-river',
      'type': 'line',
      ...src,
      'source-layer': 'waterway',
      'filter': all(LINE, notTunnel(), classIn('river', 'canal')),
      'layout': { 'line-cap': 'round', 'line-join': 'round' },
      'paint': { 'line-color': colors.water, 'line-width': widthExpression(ROAD_WIDTHS.river, dz, k) },
    })
    if (map.roads !== 'major') {
      layers.push({
        'id': 'waterway-stream',
        'type': 'line',
        ...src,
        'source-layer': 'waterway',
        'filter': all(LINE, notTunnel(), classIn('stream', 'drain', 'ditch')),
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': { 'line-color': colors.water, 'line-width': widthExpression(ROAD_WIDTHS.stream, dz, k) },
      })
    }
  }

  if (map.buildings) {
    layers.push({
      'id': 'buildings',
      'type': 'fill',
      ...src,
      'source-layer': 'building',
      'paint': { 'fill-color': colors.buildings, 'fill-antialias': true },
    })
  }

  const road = (id: string, classes: string[], stops: Stops, sourceLayer = 'transportation'): LayerSpecification => ({
    id,
    'type': 'line',
    ...src,
    'source-layer': sourceLayer,
    'filter': all(LINE, classIn(...classes)),
    'layout': { 'line-cap': 'round', 'line-join': 'round' },
    'paint': { 'line-color': colors.roads, 'line-width': widthExpression(stops, dz, lw) },
  })

  if (map.roads === 'all') {
    layers.push(road('roads-path', ['path', 'track', 'pedestrian', 'bridleway', 'footway', 'cycleway'], ROAD_WIDTHS.path))
  }
  if (map.rail) {
    layers.push({
      ...road('rail', ['rail', 'transit'], ROAD_WIDTHS.rail),
      paint: { 'line-color': colors.roads, 'line-width': widthExpression(ROAD_WIDTHS.rail, dz, lw), 'line-opacity': 0.85 },
    } as LayerSpecification)
  }
  if (map.roads !== 'major') {
    layers.push(road('aeroway', ['runway', 'taxiway'], ROAD_WIDTHS.secondary, 'aeroway'))
    layers.push(road('roads-minor', ['minor', 'service', 'busway', 'raceway'], ROAD_WIDTHS.minor))
  }
  layers.push(road('roads-tertiary', ['tertiary'], ROAD_WIDTHS.tertiary))
  layers.push(road('roads-secondary', ['secondary'], ROAD_WIDTHS.secondary))
  layers.push(road('roads-primary', ['primary'], ROAD_WIDTHS.primary))
  layers.push(road('roads-motorway', ['motorway', 'trunk'], ROAD_WIDTHS.motorway))

  if (map.labels) {
    const lang = o.language.split('-')[0] || 'en'
    layers.push({
      'id': 'place-labels',
      'type': 'symbol',
      ...src,
      'source-layer': 'place',
      'filter': classIn('city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood'),
      'layout': {
        'text-field': ['coalesce', ['get', `name:${lang}`], ['get', 'name']],
        'text-font': [o.labelFont],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          8 + dz, ['match', ['get', 'class'], ['city'], 13 * k, 9 * k],
          14 + dz, ['match', ['get', 'class'], ['city', 'town'], 18 * k, ['suburb'], 11 * k, 9.5 * k],
        ],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.14,
        'text-max-width': 8,
        'text-padding': 4 * k,
      },
      'paint': {
        'text-color': colors.roads,
        'text-halo-color': colors.land,
        'text-halo-width': 1.4 * k,
        'text-halo-blur': 0.2 * k,
      },
    })
  }

  return {
    version: 8,
    name: 'i-was-here poster',
    glyphs: o.glyphsUrl,
    sources: { [SOURCE_ID]: vectorSource(o.tilesUrl) },
    transition: { duration: o.transitionMs ?? 0, delay: 0 },
    layers,
  }
}
