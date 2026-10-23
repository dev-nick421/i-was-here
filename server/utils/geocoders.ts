import type { GeocodeResult, PlaceKind } from '#shared/types/geocode'

/**
 * Upstream geocoders. Both normalise to the same `GeocodeResult` shape.
 * - Photon (komoot): built for search-as-you-type, the default.
 * - Nominatim (OSM): official, but its usage policy forbids autocomplete on the public
 *   instance; we throttle to one request per second.
 */

export interface GeocodeQuery {
  q: string
  lang: string
  limit: number
}

export interface GeocoderConfig {
  provider: string
  url: string
  userAgent: string
  email: string
  timeoutMs: number
}

function unique(parts: (string | undefined)[], exclude?: string) {
  const out: string[] = []
  for (const p of parts) {
    if (p && p !== exclude && !out.includes(p)) out.push(p)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Photon
// ---------------------------------------------------------------------------------------------

interface PhotonFeature {
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

async function photon(query: GeocodeQuery, config: GeocoderConfig) {
  const url = new URL(config.url || 'https://photon.komoot.io/api/')
  url.searchParams.set('q', query.q)
  url.searchParams.set('limit', String(query.limit + 3))
  if (['de', 'en', 'fr', 'it'].includes(query.lang)) url.searchParams.set('lang', query.lang)
  const data = await $fetch<{ features?: PhotonFeature[] }>(url.toString(), {
    headers: { 'User-Agent': config.userAgent, 'Accept': 'application/json' },
    timeout: config.timeoutMs,
    retry: 1,
  })
  return normalizePhoton(data.features ?? []).slice(0, query.limit)
}

// ---------------------------------------------------------------------------------------------
// Nominatim
// ---------------------------------------------------------------------------------------------

interface NominatimItem {
  osm_type?: string
  osm_id?: number
  lat?: string
  lon?: string
  name?: string
  display_name?: string
  addresstype?: string
  category?: string
  boundingbox?: [string, string, string, string]
  address?: Record<string, string>
}

function nominatimKind(addresstype = '', category = ''): PlaceKind {
  if (addresstype === 'country') return 'country'
  if (['state', 'region', 'province', 'county'].includes(addresstype)) return 'state'
  if (['city', 'town', 'village', 'municipality', 'hamlet'].includes(addresstype)) return 'city'
  if (['suburb', 'quarter', 'neighbourhood', 'city_district', 'borough'].includes(addresstype)) return 'district'
  if (addresstype === 'road') return 'street'
  if (['house', 'building'].includes(addresstype)) return 'address'
  return category === 'boundary' || category === 'place' ? 'other' : 'poi'
}

export function normalizeNominatim(items: NominatimItem[]): GeocodeResult[] {
  const results: GeocodeResult[] = []
  for (const it of items) {
    const lat = Number(it.lat)
    const lon = Number(it.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const a = it.address ?? {}
    const city = a.city ?? a.town ?? a.village ?? a.municipality
    const name = it.name || (a.road ? `${a.road}${a.house_number ? ` ${a.house_number}` : ''}` : undefined) || it.display_name?.split(',')[0]
    if (!name) continue
    const bb = it.boundingbox?.map(Number)
    results.push({
      id: `${(it.osm_type ?? 'X').charAt(0).toUpperCase()}${it.osm_id ?? results.length}`,
      name,
      context: unique([a.suburb, city, a.state, a.country], name).join(', '),
      city,
      country: a.country,
      countryCode: a.country_code?.toLowerCase(),
      lat,
      lon,
      bbox: bb && bb.length === 4 && bb.every(Number.isFinite) ? [bb[2]!, bb[0]!, bb[3]!, bb[1]!] : undefined,
      kind: nominatimKind(it.addresstype, it.category),
    })
  }
  return dedupe(results)
}

let nominatimQueue: Promise<unknown> = Promise.resolve()
let lastNominatim = 0

/** Serialises Nominatim calls with ≥ 1.1 s spacing (usage policy: max 1 request per second). */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = lastNominatim + 1100 - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    lastNominatim = Date.now()
    return fn()
  }
  const p = nominatimQueue.then(run, run)
  nominatimQueue = p.catch(() => undefined)
  return p
}

async function nominatim(query: GeocodeQuery, config: GeocoderConfig) {
  const url = new URL(config.url || 'https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query.q)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(query.limit))
  url.searchParams.set('accept-language', query.lang)
  if (config.email) url.searchParams.set('email', config.email)
  const data = await throttled(() => $fetch<NominatimItem[]>(url.toString(), {
    headers: { 'User-Agent': config.userAgent, 'Accept': 'application/json' },
    timeout: config.timeoutMs,
  }))
  return normalizeNominatim(Array.isArray(data) ? data : [])
}

function dedupe(results: GeocodeResult[]) {
  const seen = new Set<string>()
  return results.filter((r) => {
    const key = `${r.name}|${r.context}|${r.kind}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function geocode(query: GeocodeQuery, config: GeocoderConfig) {
  return config.provider === 'nominatim' ? nominatim(query, config) : photon(query, config)
}
