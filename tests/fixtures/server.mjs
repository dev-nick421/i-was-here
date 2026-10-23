/**
 * Offline fixture server for development and end-to-end tests.
 *
 *   GET /tiles.json               TileJSON for the synthetic city
 *   GET /tiles/{z}/{x}/{y}.pbf    vector tiles (OpenMapTiles schema)
 *   GET /photon/api?q=…           Photon-compatible geocoding answers
 *
 * Run with `pnpm fixtures:serve`, then start the app with
 *   NUXT_PUBLIC_MAP_TILES_URL=http://localhost:4599/tiles.json
 *   NUXT_GEOCODER_URL=http://localhost:4599/photon/api
 */
import http from 'node:http'
import { GeoJSONVT } from '@maplibre/geojson-vt'
import { fromGeojsonVt } from '@maplibre/vt-pbf'
import { buildCity, CENTER, VECTOR_LAYERS } from './city.mjs'

const PORT = Number(process.env.FIXTURE_PORT || 4599)
const HOST = process.env.FIXTURE_HOST || '127.0.0.1'
const BASE = process.env.FIXTURE_BASE_URL || `http://localhost:${PORT}`

const started = Date.now()
const city = buildCity()
const indexes = {}
for (const name of VECTOR_LAYERS) {
  // Features carry a `minzoom` so detailed layers only appear when zoomed in (like OMT).
  const byZoom = {}
  for (const f of city[name]) {
    const mz = f.minzoom ?? 0
    ;(byZoom[mz] ??= []).push({ type: 'Feature', geometry: f.geometry, properties: f.properties })
  }
  indexes[name] = Object.entries(byZoom).map(([mz, features]) => ({
    minzoom: Number(mz),
    index: new GeoJSONVT({ type: 'FeatureCollection', features }, { maxZoom: 14, indexMaxZoom: 4, tolerance: 2, extent: 4096, buffer: 64 }),
  }))
}
console.log(`[fixtures] city built in ${Date.now() - started} ms`)

function tile(z, x, y) {
  const layers = {}
  for (const name of VECTOR_LAYERS) {
    const features = []
    for (const { minzoom, index } of indexes[name]) {
      if (z < minzoom) continue
      const t = index.getTile(z, x, y)
      if (t) features.push(...t.features)
    }
    if (features.length) layers[name] = { features }
  }
  if (!Object.keys(layers).length) return null
  return fromGeojsonVt(layers, { version: 2, extent: 4096 })
}

const GEOCODE_FIXTURES = [
  { name: 'Hamburg', type: 'city', osm_key: 'place', osm_value: 'city', country: 'Deutschland', countrycode: 'DE', state: 'Hamburg', lng: CENTER.lng, lat: CENTER.lat, extent: [9.73, 53.74, 10.33, 53.39] },
  { name: 'Altona', type: 'district', osm_key: 'place', osm_value: 'suburb', city: 'Hamburg', country: 'Deutschland', countrycode: 'DE', lng: 9.931, lat: 53.539 },
  { name: 'Eimsbüttel', type: 'district', osm_key: 'place', osm_value: 'suburb', city: 'Hamburg', country: 'Deutschland', countrycode: 'DE', lng: 9.951, lat: 53.574 },
  { name: 'Hamburger Straße', type: 'street', osm_key: 'highway', osm_value: 'primary', city: 'Hamburg', country: 'Deutschland', countrycode: 'DE', lng: 10.03, lat: 53.575 },
  { name: 'Elbphilharmonie', type: 'house', osm_key: 'amenity', osm_value: 'concert_hall', street: 'Platz der Deutschen Einheit', housenumber: '1', city: 'Hamburg', country: 'Deutschland', countrycode: 'DE', lng: 9.9841, lat: 53.5413 },
  { name: 'Berlin', type: 'city', osm_key: 'place', osm_value: 'city', country: 'Deutschland', countrycode: 'DE', state: 'Berlin', lng: 13.405, lat: 52.52, extent: [13.09, 52.68, 13.76, 52.34] },
  { name: 'Paris', type: 'city', osm_key: 'place', osm_value: 'city', country: 'France', countrycode: 'FR', state: 'Île-de-France', lng: 2.3522, lat: 48.8566, extent: [2.22, 48.9, 2.47, 48.81] },
]

function photon(q, limit) {
  const needle = q.toLowerCase()
  const features = GEOCODE_FIXTURES
    .filter(p => p.name.toLowerCase().includes(needle) || (p.city ?? '').toLowerCase().includes(needle))
    .slice(0, limit)
    .map((p, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { osm_type: 'R', osm_id: 1000 + i, ...p, lng: undefined, lat: undefined },
    }))
  return { type: 'FeatureCollection', features }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', BASE)
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (url.pathname === '/health') {
    res.end('ok')
    return
  }
  if (url.pathname === '/tiles.json') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      tilejson: '3.0.0',
      name: 'i-was-here fixture city',
      attribution: 'Synthetic test data',
      tiles: [`${BASE}/tiles/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 14,
      bounds: [9.6, 53.35, 10.4, 53.75],
      vector_layers: VECTOR_LAYERS.map(id => ({ id, fields: {} })),
    }))
    return
  }
  const m = /^\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(url.pathname)
  if (m) {
    const data = tile(Number(m[1]), Number(m[2]), Number(m[3]))
    if (!data) {
      res.statusCode = 204
      res.end()
      return
    }
    res.setHeader('Content-Type', 'application/x-protobuf')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(Buffer.from(data))
    return
  }
  if (url.pathname === '/photon/api' || url.pathname === '/photon/api/') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(photon(url.searchParams.get('q') ?? '', Number(url.searchParams.get('limit') ?? 7))))
    return
  }
  res.statusCode = 404
  res.end('not found')
})

server.listen(PORT, HOST, () => {
  console.log(`[fixtures] listening on ${BASE}`)
})
