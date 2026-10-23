import type { GeocodeResult, PlaceKind } from '#shared/types/geocode'
import { latToY, lngToX } from './geo'

const ZOOM_RANGE: Record<PlaceKind, [min: number, max: number, fallback: number]> = {
  country: [2.5, 8, 5],
  state: [5, 10, 7.5],
  city: [10.4, 13.2, 11.6],
  district: [12, 15, 13.2],
  street: [13.5, 16, 14.6],
  address: [14.5, 16.5, 15.3],
  poi: [13.5, 16.5, 15],
  other: [3, 16, 12],
}

/**
 * Normalised zoom (see `MapView.zoom`) that frames a search result inside a map area of
 * `mapWidth × mapHeight` layout units. Bounding boxes of cities are often huge (admin areas
 * with islands or forests), so each kind of place gets a sensible zoom range.
 */
export function zoomForPlace(place: Pick<GeocodeResult, 'bbox' | 'kind' | 'lat'>, mapWidth: number, mapHeight: number) {
  const [min, max, fallback] = ZOOM_RANGE[place.kind] ?? ZOOM_RANGE.other
  if (!place.bbox) return fallback
  const [w, s, e, n] = place.bbox
  const dx = Math.abs(lngToX(e, 0) - lngToX(w, 0))
  const dy = Math.abs(latToY(s, 0) - latToY(n, 0))
  if (dx < 1e-9 || dy < 1e-9) return fallback
  const zoom = Math.log2(Math.min(mapWidth / dx, mapHeight / dy) * 0.92)
  return Math.min(max, Math.max(min, zoom))
}

/** Center of a result: the bbox center for areas, the point for everything else. */
export function placeCenter(place: Pick<GeocodeResult, 'bbox' | 'kind' | 'lat' | 'lon'>) {
  return { lng: place.lon, lat: place.lat }
}

/** Suggested subtitle for a place (country for cities, city for streets …). */
export function subtitleForPlace(place: GeocodeResult) {
  switch (place.kind) {
    case 'country':
      return ''
    case 'state':
    case 'city':
      return place.country ?? ''
    default:
      return place.city && place.city !== place.name ? place.city : place.country ?? ''
  }
}
