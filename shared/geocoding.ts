import type { GeocodeResult, PlaceKind } from './types/geocode'

/**
 * Geocoding code shared by the server (`/api/geocode`) and the browser. Static builds (GitHub
 * Pages) have no server, so there the editor asks Photon directly and tidies up the answer
 * exactly like the server would.
 */

export interface GeocodeQuery {
  q: string
  lang: string
  limit: number
}

export function unique(parts: (string | undefined)[], exclude?: string) {
  const out: string[] = []
  for (const p of parts) {
    if (p && p !== exclude && !out.includes(p)) out.push(p)
  }
  return out
}

export function dedupe(results: GeocodeResult[]) {
  const seen = new Set<string>()
  return results.filter((r) => {
    const key = `${r.name}|${r.context}|${r.kind}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------------------------------------------------------------------------------------------
// Photon
// ---------------------------------------------------------------------------------------------

export const PHOTON_DEFAULT_URL = 'https://photon.komoot.io/api/'

export interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: Record<string, unknown> & {
    osm_type?: string
    osm_id?: number
    osm_key?: string
    osm_value?: string
    type?: string
    name?: string
    country?: string
    countrycode?: string
    state?: string
    county?: string
    city?: string
    district?: string
    street?: string
    housenumber?: string
    extent?: [number, number, number, number]
  }
}

/** Search URL for a Photon instance. Asks for a few extra results because some get merged. */
export function photonSearchUrl(base: string, query: GeocodeQuery) {
  const url = new URL(base || PHOTON_DEFAULT_URL)
  url.searchParams.set('q', query.q)
  url.searchParams.set('limit', String(query.limit + 3))
  if (['de', 'en', 'fr', 'it'].includes(query.lang)) url.searchParams.set('lang', query.lang)
  return url.toString()
}

const POI_KEYS = new Set(['amenity', 'tourism', 'shop', 'leisure', 'historic', 'building', 'man_made', 'natural', 'aeroway', 'railway'])

function photonKind(p: NonNullable<PhotonFeature['properties']>): PlaceKind {
  switch (p.type) {
    case 'country': return 'country'
    case 'state':
    case 'county': return 'state'
    case 'city': return 'city'
    case 'district':
    case 'locality': return 'district'
    case 'street': return 'street'
    case 'house': return p.osm_key && POI_KEYS.has(p.osm_key) && p.name ? 'poi' : 'address'
  }
  if (p.osm_key === 'place') {
    if (['city', 'town', 'village', 'municipality', 'hamlet'].includes(p.osm_value ?? '')) return 'city'
    if (['suburb', 'quarter', 'neighbourhood', 'borough', 'city_block'].includes(p.osm_value ?? '')) return 'district'
  }
  return p.osm_key && POI_KEYS.has(p.osm_key) ? 'poi' : 'other'
}

export function normalizePhoton(features: PhotonFeature[]): GeocodeResult[] {
  const results: GeocodeResult[] = []
  for (const f of features) {
    const p = f.properties
    const c = f.geometry?.coordinates
    if (!p || !c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue
    const kind = photonKind(p)
    const street = p.street ? `${p.street}${p.housenumber ? ` ${p.housenumber}` : ''}` : undefined
    const name = p.name ?? street ?? p.city ?? p.state ?? p.country
    if (!name) continue
    const e = p.extent
    results.push({
      id: `${p.osm_type ?? 'X'}${p.osm_id ?? results.length}`,
      name,
      context: unique([p.name && street ? street : undefined, p.district, p.city, p.state, p.country], name).join(', '),
      city: p.city ?? (kind === 'city' ? name : undefined),
      country: p.country,
      countryCode: p.countrycode?.toLowerCase(),
      lat: c[1],
      lon: c[0],
      bbox: Array.isArray(e) && e.length === 4 ? [e[0], e[3], e[2], e[1]] : undefined,
      kind,
    })
  }
  return dedupe(results)
}
