import type { GeocodeResponse } from '#shared/types/geocode'
import { geocode, type GeocoderConfig } from '../utils/geocoders'

const LANGS = new Set(['de', 'en', 'fr', 'it'])

function parseQuery(raw: Record<string, unknown>) {
  const q = String(raw.q ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)
  const lang = LANGS.has(String(raw.lang)) ? String(raw.lang) : 'en'
  const limit = Math.min(10, Math.max(1, Number.parseInt(String(raw.limit ?? 7), 10) || 7))
  return { q, lang, limit }
}

/**
 * Place search proxy. Keeps the upstream configurable (env), adds a proper User-Agent and
 * caches answers for a day so popular searches don't hit the public geocoders again.
 */
export default defineCachedEventHandler(async (event): Promise<GeocodeResponse> => {
  const query = parseQuery(getQuery(event))
  if (query.q.length < 2) return { results: [] }
  const config = useRuntimeConfig(event).geocoder as GeocoderConfig
  try {
    return { results: await geocode(query, config) }
  } catch (e) {
    console.warn('[geocode] upstream failed:', (e as Error).message)
    throw createError({ statusCode: 502, statusMessage: 'Geocoder unavailable' })
  }
}, {
  name: 'geocode',
  maxAge: 60 * 60 * 24,
  swr: false,
  getKey: (event) => {
    const { q, lang, limit } = parseQuery(getQuery(event))
    return encodeURIComponent(`${lang}:${limit}:${q.toLowerCase()}`)
  },
})
