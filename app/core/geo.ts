import type { CoordFormat, DetailLevel } from './types'

/** Web Mercator math matching MapLibre GL (512 px tiles). */
export const EARTH_CIRCUMFERENCE = 40075016.686
export const TILE_SIZE = 512
export const MAX_LAT = 85.051129

const DEG = Math.PI / 180

export function clampLat(lat: number) {
  return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
}

export function wrapLng(lng: number) {
  if (lng >= -180 && lng <= 180) return lng
  const w = ((((lng + 180) % 360) + 360) % 360) - 180
  return w === -180 && lng > 0 ? 180 : w
}

export function worldSize(zoom: number) {
  return TILE_SIZE * 2 ** zoom
}

export function lngToX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * worldSize(zoom)
}

export function latToY(lat: number, zoom: number) {
  const l = clampLat(lat)
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (l * DEG) / 2))) / 360
  return y * worldSize(zoom)
}

export function xToLng(x: number, zoom: number) {
  return (x / worldSize(zoom)) * 360 - 180
}

export function yToLat(y: number, zoom: number) {
  const y2 = 180 - (y / worldSize(zoom)) * 360
  return (360 / Math.PI) * Math.atan(Math.exp(y2 * DEG)) - 90
}

export function metersPerPixel(lat: number, zoom: number) {
  return (EARTH_CIRCUMFERENCE * Math.cos(clampLat(lat) * DEG)) / worldSize(zoom)
}

export interface Camera {
  lng: number
  lat: number
  zoom: number
  /** Degrees, clockwise rotation of the map like MapLibre's `bearing`. */
  bearing: number
}

/**
 * Converts an offset on screen (CSS pixels from the map center, y pointing down)
 * to a geographic coordinate. Equivalent to `map.unproject(center + offset)`.
 */
export function screenOffsetToLngLat(camera: Camera, dx: number, dy: number) {
  const b = camera.bearing * DEG
  const cos = Math.cos(b)
  const sin = Math.sin(b)
  // Rotate the screen offset into world orientation.
  const wx = dx * cos - dy * sin
  const wy = dx * sin + dy * cos
  const cx = lngToX(camera.lng, camera.zoom)
  const cy = latToY(camera.lat, camera.zoom)
  return { lng: xToLng(cx + wx, camera.zoom), lat: yToLat(cy + wy, camera.zoom) }
}

/** Inverse of {@link screenOffsetToLngLat}: geographic coordinate → screen offset from center. */
export function lngLatToScreenOffset(camera: Camera, lng: number, lat: number) {
  const cx = lngToX(camera.lng, camera.zoom)
  const cy = latToY(camera.lat, camera.zoom)
  let wx = lngToX(lng, camera.zoom) - cx
  const wy = latToY(lat, camera.zoom) - cy
  // Take the shortest way around the antimeridian.
  const ws = worldSize(camera.zoom)
  if (wx > ws / 2) wx -= ws
  else if (wx < -ws / 2) wx += ws
  const b = camera.bearing * DEG
  const cos = Math.cos(b)
  const sin = Math.sin(b)
  return { x: wx * cos + wy * sin, y: -wx * sin + wy * cos }
}

/**
 * The detail level renders the same extent at a higher zoom level (and with proportionally
 * wider lines), so the vector tiles contain more streets. OpenMapTiles adds residential streets
 * at zoom 13, so "medium" is chosen to reach it for a typical city-sized poster (~12 km wide).
 */
export function detailZoomOffset(detail: DetailLevel) {
  switch (detail) {
    case 'low': return 0
    case 'high': return 2
    default: return 1.2
  }
}

/** Design pixels per layout unit for the given detail level. */
export function detailScale(detail: DetailLevel) {
  return 2 ** detailZoomOffset(detail)
}

/**
 * Map scale (the "1 : n" number) for a poster.
 * @param lat latitude of the map center
 * @param zoom normalised zoom (see `MapView.zoom`)
 * @param posterWidthUnits poster width in layout units
 * @param paperWidthCm physical poster width
 */
export function mapScale(lat: number, zoom: number, posterWidthUnits: number, paperWidthCm: number) {
  const groundMeters = metersPerPixel(lat, zoom) * posterWidthUnits
  return groundMeters / (paperWidthCm / 100)
}

/** Rounds a scale denominator to three significant digits: 43127 → 43100. */
export function roundScale(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 0
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 2)
  return Math.round(n / magnitude) * magnitude
}

export function formatScale(n: number, locale: string) {
  return `1:${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(roundScale(n))}`
}

function hemisphere(value: number, positive: string, negative: string) {
  return value >= 0 ? positive : negative
}

function dms(value: number, withSeconds: boolean, degreePad: number) {
  const abs = Math.abs(value)
  let deg = Math.floor(abs)
  let min = Math.floor((abs - deg) * 60)
  let sec = Math.round(((abs - deg) * 60 - min) * 60)
  if (sec === 60) {
    sec = 0
    min += 1
  }
  if (min === 60) {
    min = 0
    deg += 1
  }
  const d = String(deg).padStart(degreePad, '0')
  const m = String(min).padStart(2, '0')
  if (!withSeconds) {
    const decMin = ((abs - Math.floor(abs)) * 60).toFixed(3)
    return `${String(Math.floor(abs)).padStart(degreePad, '0')}°${decMin.padStart(6, '0')}'`
  }
  return `${d}°${m}'${String(sec).padStart(2, '0')}"`
}

/**
 * Formats a coordinate pair for the poster, e.g. `53°33'11" N 9°59'34" E`.
 * German uses "O" (Ost) for east.
 */
export function formatCoordinates(lat: number, lng: number, format: CoordFormat, locale: string) {
  const east = locale.startsWith('de') ? 'O' : 'E'
  const ns = hemisphere(lat, 'N', 'S')
  const ew = hemisphere(lng, east, 'W')
  const lngW = wrapLng(lng)
  if (format === 'decimal') {
    const f = (n: number) => Math.abs(n).toFixed(4)
    return `${f(lat)}° ${ns}  ${f(lngW)}° ${ew}`
  }
  const withSeconds = format === 'dms'
  return `${dms(lat, withSeconds, 2)} ${ns}  ${dms(lngW, withSeconds, 2)} ${ew}`
}
