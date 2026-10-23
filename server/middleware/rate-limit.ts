/**
 * Small in-memory rate limit for the geocoding proxy, so a public instance can't be used to
 * hammer the upstream geocoder. Generous enough for search-as-you-type.
 */
const WINDOW_MS = 60_000
const MAX_REQUESTS = Number(process.env.NUXT_GEOCODER_RATE_LIMIT || 120)

const hits = new Map<string, { count: number, reset: number }>()
let lastSweep = Date.now()

export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/geocode') || MAX_REQUESTS <= 0) return
  const now = Date.now()
  if (now - lastSweep > WINDOW_MS) {
    for (const [ip, entry] of hits) if (entry.reset < now) hits.delete(ip)
    lastSweep = now
  }
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const entry = hits.get(ip)
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS })
    return
  }
  entry.count++
  if (entry.count > MAX_REQUESTS) {
    setResponseHeader(event, 'Retry-After', Math.ceil((entry.reset - now) / 1000))
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
})
