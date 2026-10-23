/**
 * A synthetic city in the OpenMapTiles vector schema, centred on Hamburg's coordinates.
 * It gives the end-to-end tests (and offline development) realistic-looking map data without
 * depending on a public tile server: a river with harbour basins, a lake, parks, a road
 * hierarchy from motorways to footpaths, railways, buildings and district labels.
 */

export const CENTER = { lng: 9.9937, lat: 53.5511 }

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LNG = 111_320 * Math.cos((CENTER.lat * Math.PI) / 180)

/** Local metres (x east, y north) → [lng, lat] */
function ll(x, y) {
  return [CENTER.lng + x / M_PER_DEG_LNG, CENTER.lat + y / M_PER_DEG_LAT]
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const rand = rng(42)

const riverY = x => -2600 + 700 * Math.sin(x / 3200) + 250 * Math.sin(x / 900)
const RIVER_HALF = 280

function inRiver(x, y) {
  return Math.abs(y - riverY(x)) < RIVER_HALF + 40
}

const LAKE = { x: 600, y: 1700, rx: 650, ry: 1000 }
function inLake(x, y) {
  return ((x - LAKE.x) / (LAKE.rx + 60)) ** 2 + ((y - LAKE.y) / (LAKE.ry + 60)) ** 2 < 1
}

const BASINS = [
  { x: -1800, w: 260, h: 1300 },
  { x: -900, w: 200, h: 1100 },
  { x: 200, w: 320, h: 1500 },
  { x: 1400, w: 220, h: 900 },
  { x: 2600, w: 260, h: 1200 },
]

function inBasin(x, y) {
  return BASINS.some(b => x > b.x - 40 && x < b.x + b.w + 40 && y < riverY(b.x) && y > riverY(b.x) - RIVER_HALF - b.h - 40)
}

const PARKS = [
  { x: -2600, y: 2200, w: 1400, h: 900 },
  { x: 3200, y: 3400, w: 2600, h: 1800 },
  { x: -5200, y: -600, w: 1200, h: 1600 },
  { x: 1800, y: -900, w: 700, h: 500 },
]

function inPark(x, y) {
  return PARKS.some(p => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h)
}

function wet(x, y) {
  return inRiver(x, y) || inLake(x, y) || inBasin(x, y)
}

function feature(geometry, properties) {
  return { type: 'Feature', geometry, properties }
}

function line(points, properties) {
  return feature({ type: 'LineString', coordinates: points.map(([x, y]) => ll(x, y)) }, properties)
}

function polygon(ring, properties) {
  const coords = ring.map(([x, y]) => ll(x, y))
  coords.push(coords[0])
  return feature({ type: 'Polygon', coordinates: [coords] }, properties)
}

function rect(x, y, w, h, properties) {
  return polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], properties)
}

/** Splits a polyline into pieces that do not run over water (bridges only for big roads). */
function dryPieces(points) {
  const pieces = []
  let current = []
  for (const p of points) {
    if (wet(p[0], p[1])) {
      if (current.length > 1) pieces.push(current)
      current = []
    } else {
      current.push(p)
    }
  }
  if (current.length > 1) pieces.push(current)
  return pieces
}

function sample(from, to, step) {
  const [x0, y0] = from
  const [x1, y1] = to
  const len = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.max(1, Math.ceil(len / step))
  return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n])
}

export function buildCity() {
  const layers = {
    water: [],
    waterway: [],
    landcover: [],
    landuse: [],
    park: [],
    building: [],
    transportation: [],
    aeroway: [],
    place: [],
  }

  // --- Water -----------------------------------------------------------------------------
  const top = []
  const bottom = []
  for (let x = -16000; x <= 16000; x += 200) {
    top.push([x, riverY(x) + RIVER_HALF])
    bottom.push([x, riverY(x) - RIVER_HALF])
  }
  layers.water.push(polygon([...top, ...bottom.reverse()], { class: 'river' }))
  const lake = []
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) lake.push([LAKE.x + LAKE.rx * Math.cos(a), LAKE.y + LAKE.ry * Math.sin(a)])
  layers.water.push(polygon(lake, { class: 'lake' }))
  for (const b of BASINS) {
    const y0 = riverY(b.x)
    layers.water.push(rect(b.x, y0 - RIVER_HALF - b.h, b.w, b.h + 100, { class: 'dock' }))
  }
  // A canal from the lake down to the river, and some streams
  layers.waterway.push(line(sample([LAKE.x, LAKE.y - LAKE.ry], [LAKE.x + 200, riverY(LAKE.x + 200)], 100), { class: 'canal' }))
  for (let i = 0; i < 6; i++) {
    const x = -9000 + i * 3300
    const pts = []
    for (let y = 9000; y > riverY(x) + RIVER_HALF; y -= 250) pts.push([x + 400 * Math.sin(y / 1300 + i), y])
    layers.waterway.push(line(pts, { class: 'stream' }))
  }

  // --- Green -------------------------------------------------------------------------------
  for (const p of PARKS) layers.park.push(rect(p.x, p.y, p.w, p.h, { class: 'park' }))
  layers.landcover.push(rect(-14000, 5000, 5000, 4000, { class: 'wood' }))
  layers.landcover.push(rect(7000, -9000, 4000, 3500, { class: 'wood' }))
  layers.landuse.push(rect(-3800, 4200, 900, 700, { class: 'cemetery' }))

  // --- Roads -------------------------------------------------------------------------------
  const road = (cls, points, minzoom = 0) => {
    const pieces = cls === 'motorway' || cls === 'trunk' || cls === 'primary' || cls === 'rail' ? [points] : dryPieces(points)
    for (const p of pieces) layers.transportation.push({ ...line(p, { class: cls }), minzoom })
  }

  // Motorway ring and a through motorway
  const ring = []
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 48) ring.push([7200 * Math.cos(a) + 300 * Math.sin(3 * a), 6400 * Math.sin(a)])
  road('motorway', ring)
  road('motorway', sample([-16000, -9000], [16000, 8000], 400))
  road('trunk', sample([-16000, 6000], [-7000, 2000], 400))

  // Radial primary roads with a slight curve
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2
    const pts = []
    for (let r = 300; r <= 15000; r += 300) pts.push([r * Math.cos(a + 0.00004 * r), r * Math.sin(a + 0.00004 * r)])
    road('primary', pts)
  }

  // Secondary rings and tertiary grid
  for (const R of [2400, 4300]) {
    const pts = []
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 40) pts.push([R * Math.cos(a), R * 0.9 * Math.sin(a)])
    road('secondary', pts)
  }
  for (let v = -10000; v <= 10000; v += 1100) {
    road('tertiary', sample([v, -11000], [v + 600, 11000], 150), 9)
    road('tertiary', sample([-11000, v], [11000, v - 500], 150), 9)
  }

  // Dense minor street grid in the centre, slightly rotated per district
  for (let gx = -7000; gx < 7000; gx += 1400) {
    for (let gy = -7000; gy < 7000; gy += 1400) {
      const angle = (rand() - 0.5) * 0.6
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const rot = (x, y) => [gx + 700 + (x * cos - y * sin), gy + 700 + (x * sin + y * cos)]
      for (let s = -700; s <= 700; s += 175) {
        road('minor', [rot(s, -700), rot(s, -350), rot(s, 0), rot(s, 350), rot(s, 700)], 12)
        road('minor', [rot(-700, s), rot(-350, s), rot(0, s), rot(350, s), rot(700, s)], 12)
      }
      // Buildings in the blocks of the inner districts
      if (Math.hypot(gx + 700, gy + 700) < 6000) {
        for (let bx = -700; bx < 700; bx += 175) {
          for (let by = -700; by < 700; by += 175) {
            for (const [ox, oy] of [[22, 22], [92, 22], [22, 92], [92, 92]]) {
              if (rand() < 0.18) continue
              const [cx, cy] = rot(bx + ox + 30, by + oy + 30)
              if (wet(cx, cy) || inPark(cx, cy)) continue
              const w = 40 + rand() * 25
              const h = 40 + rand() * 25
              const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
                .map(([px, py]) => [cx + px * cos - py * sin, cy + px * sin + py * cos])
              layers.building.push({ ...polygon(corners, {}), minzoom: 13 })
            }
          }
        }
      }
    }
  }

  // Footpaths through the parks
  for (const p of PARKS) {
    const pts = []
    for (let t = 0; t <= 1.0001; t += 0.05) pts.push([p.x + t * p.w, p.y + p.h / 2 + Math.sin(t * 9) * p.h * 0.3])
    road('path', pts, 13)
    road('path', sample([p.x + p.w * 0.3, p.y], [p.x + p.w * 0.7, p.y + p.h], 60), 13)
  }

  // An airport runway
  layers.aeroway.push(line(sample([5200, -7600], [9200, -6400], 200), { class: 'runway' }))

  // Railways
  road('rail', sample([-16000, -1200], [16000, 1800], 300), 8)
  road('rail', sample([-3000, 16000], [2500, -16000], 300), 8)

  // --- Labels --------------------------------------------------------------------------------
  const places = [
    ['Altstadt', 400, -600],
    ['Altona', -4200, -1300],
    ['Eimsbüttel', -2800, 2600],
    ['Winterhude', 1800, 4200],
    ['Barmbek', 4600, 2800],
    ['St. Georg', 2100, 300],
    ['Wilhelmsburg', 900, -5400],
    ['Harburg', -600, -9800],
    ['Wandsbek', 7600, 2200],
    ['Ottensen', -5600, -600],
  ]
  for (const [name, x, y] of places) {
    layers.place.push(feature({ type: 'Point', coordinates: ll(x, y) }, { class: 'suburb', name, rank: 10 }))
  }
  layers.place.push(feature({ type: 'Point', coordinates: ll(0, 0) }, { 'class': 'city', 'name': 'Hamburg', 'name:de': 'Hamburg', 'rank': 1 }))

  return layers
}

export const VECTOR_LAYERS = ['water', 'waterway', 'landcover', 'landuse', 'park', 'building', 'transportation', 'aeroway', 'place']
