import type { GeocodeResult, PlaceKind } from '#shared/types/geocode'
import { dedupe, type GeocodeQuery, normalizePhoton, type PhotonFeature, photonSearchUrl, unique } from '#shared/geocoding'

/**
 * Upstream geocoders. Both normalise to the same `GeocodeResult` shape.
 * - Photon (komoot): built for search-as-you-type, the default.
 * - Nominatim (OSM): official, but its usage policy forbids autocomplete on the public
 *   instance; we throttle to one request per second.
 */

export interface GeocoderConfig {
  provider: string
  url: string
  userAgent: string
  email: string
  timeoutMs: number
}

// ---------------------------------------------------------------------------------------------
// Photon
// ---------------------------------------------------------------------------------------------

async function photon(query: GeocodeQuery, config: GeocoderConfig) {
  const data = await $fetch<{ features?: PhotonFeature[] }>(photonSearchUrl(config.url, query), {
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

export function geocode(query: GeocodeQuery, config: GeocoderConfig) {
  return config.provider === 'nominatim' ? nominatim(query, config) : photon(query, config)
}
