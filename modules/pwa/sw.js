/**
 * Service worker of I Was Here. The build (modules/pwa) prepends `self.__IWH_BUILD` with the
 * build id and the files to precache.
 *
 * - App shell: the built JS, CSS and fonts are stored per build, so the editor opens offline.
 *   The page itself is network-first because the server puts its runtime config into it;
 *   the last copy is the offline fallback.
 * - Map: vector tiles and glyphs are cached as you look at places (cache-first, capped);
 *   TileJSON and other map metadata are network-first. Places you've seen work offline.
 * - Updates: a new version waits until the page asks it to take over (app/composables/usePwa.ts).
 */
const { version: VERSION, precache: PRECACHE } = self.__IWH_BUILD

const SHELL_CACHE = `iwh-shell-${VERSION}`
const ASSET_CACHE = 'iwh-assets'
const TILE_CACHE = 'iwh-map-tiles'
const META_CACHE = 'iwh-map-meta'
const LIMITS = { [ASSET_CACHE]: 300, [TILE_CACHE]: 4000, [META_CACHE]: 50 }
const PAGE_TIMEOUT_MS = 4000

const PRECACHED = new Set(PRECACHE)
const isHashed = path => path.startsWith('/_nuxt/') && !path.startsWith('/_nuxt/builds/latest')
const isTile = url => /\.(?:pbf|mvt)$/i.test(url.pathname) || /\/\d+\/\d+\/\d+(?:@\dx)?(?:\.\w+)?$/.test(url.pathname)

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    await Promise.all(PRECACHE.map(async (path) => {
      // Hashed files never change: reuse them from the previous version instead of downloading them again.
      const previous = isHashed(path) ? await caches.match(path, { ignoreVary: true }) : undefined
      const response = previous ?? await fetch(new Request(path, { cache: 'reload' }))
      if (!response.ok) throw new Error(`Could not precache ${path} (${response.status})`)
      await cache.put(path, response)
    }))
    const page = await fetch(new Request('/', { cache: 'reload' }))
    if (!page.ok) throw new Error(`Could not precache the page (${page.status})`)
    await cache.put('/', page)
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith('iwh-shell-') && name !== SHELL_CACHE).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  else if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage(VERSION)
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (!url.protocol.startsWith('http')) return

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') event.respondWith(page(event))
    else if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js' || url.pathname.startsWith('/_nuxt/builds/latest')) return
    else if (url.pathname.startsWith('/_nuxt/') || PRECACHED.has(url.pathname)) event.respondWith(cacheFirst(event, ASSET_CACHE))
    else if (isTile(url)) event.respondWith(cacheFirst(event, TILE_CACHE))
    return
  }

  if (isTile(url)) event.respondWith(cacheFirst(event, TILE_CACHE))
  // TileJSON, styles and the like (images, links and everything else go straight to the network)
  else if (request.destination === '') event.respondWith(networkFirst(event, META_CACHE))
})

/** The page: fresh from the server when it answers in time, otherwise the last copy. */
async function page(event) {
  const cache = await caches.open(SHELL_CACHE)
  const network = fetch(event.request).then((response) => {
    const html = response.headers.get('content-type')?.includes('text/html')
    if (response.ok && html && new URL(event.request.url).pathname === '/') {
      event.waitUntil(cache.put('/', response.clone()).catch(() => {}))
    }
    return response
  })
  event.waitUntil(network.catch(() => {}))
  try {
    return await withTimeout(network, PAGE_TIMEOUT_MS)
  } catch {
    return (await cache.match('/')) ?? network
  }
}

async function cacheFirst(event, cacheName) {
  const cached = await caches.match(event.request, { ignoreVary: true })
  if (cached) return cached
  const response = await fetch(event.request)
  if (response.ok) event.waitUntil(store(cacheName, event.request, response.clone()))
  return response
}

async function networkFirst(event, cacheName) {
  try {
    const response = await fetch(event.request)
    if (response.ok) event.waitUntil(store(cacheName, event.request, response.clone()))
    return response
  } catch (error) {
    const cached = await caches.match(event.request, { cacheName, ignoreVary: true })
    if (cached) return cached
    throw error
  }
}

const writes = {}

/** Stores a response and now and then drops the oldest entries (cache keys keep insertion order). */
async function store(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
    writes[cacheName] = (writes[cacheName] ?? 0) + 1
    if (writes[cacheName] % 50 !== 1) return
    const keys = await cache.keys()
    const excess = keys.length - LIMITS[cacheName]
    for (let i = 0; i < excess; i++) await cache.delete(keys[i])
  } catch {
    // Storage full or unavailable: the app still works online.
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}
