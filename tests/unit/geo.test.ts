import { describe, expect, it } from 'vitest'
import {
  formatCoordinates,
  formatScale,
  latToY,
  lngLatToScreenOffset,
  lngToX,
  mapScale,
  metersPerPixel,
  roundScale,
  screenOffsetToLngLat,
  wrapLng,
  xToLng,
  yToLat,
} from '~/core/geo'

describe('mercator', () => {
  it('round-trips lng/lat through world pixels', () => {
    for (const [lng, lat] of [[9.99, 53.55], [-122.42, 37.77], [151.2, -33.86], [0, 0]] as const) {
      expect(xToLng(lngToX(lng, 12.3), 12.3)).toBeCloseTo(lng, 9)
      expect(yToLat(latToY(lat, 12.3), 12.3)).toBeCloseTo(lat, 9)
    }
  })

  it('puts 0/0 in the middle of the world', () => {
    expect(lngToX(0, 0)).toBe(256)
    expect(latToY(0, 0)).toBeCloseTo(256, 9)
  })

  it('computes meters per pixel like MapLibre (512 px tiles)', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(78271.517, 2)
    expect(metersPerPixel(60, 1)).toBeCloseTo(78271.517 / 4, 2)
  })

  it('converts screen offsets and back, with rotation', () => {
    const cam = { lng: 9.99, lat: 53.55, zoom: 13.2, bearing: 33 }
    for (const [dx, dy] of [[0, 0], [100, 0], [0, -250], [-400, 321]] as const) {
      const ll = screenOffsetToLngLat(cam, dx, dy)
      const back = lngLatToScreenOffset(cam, ll.lng, ll.lat)
      expect(back.x).toBeCloseTo(dx, 6)
      expect(back.y).toBeCloseTo(dy, 6)
    }
  })

  it('treats screen-up as north without rotation and as east with bearing 90', () => {
    const north = screenOffsetToLngLat({ lng: 10, lat: 50, zoom: 10, bearing: 0 }, 0, -100)
    expect(north.lat).toBeGreaterThan(50)
    expect(north.lng).toBeCloseTo(10, 9)
    const east = screenOffsetToLngLat({ lng: 10, lat: 50, zoom: 10, bearing: 90 }, 0, -100)
    expect(east.lng).toBeGreaterThan(10)
    expect(east.lat).toBeCloseTo(50, 6)
  })

  it('wraps longitudes', () => {
    expect(wrapLng(190)).toBeCloseTo(-170)
    expect(wrapLng(-190)).toBeCloseTo(170)
    expect(wrapLng(180)).toBe(180)
  })
})

describe('scale', () => {
  it('matches the reference app for Hamburg on 30 × 40 cm (~1:43,000)', () => {
    // ~12.4 km across a 30 cm wide poster
    const scale = mapScale(53.55, 11.85, 1000, 30)
    expect(scale).toBeGreaterThan(38_000)
    expect(scale).toBeLessThan(46_000)
  })

  it('rounds to three significant digits', () => {
    expect(roundScale(43127)).toBe(43100)
    expect(roundScale(987)).toBe(987)
    expect(roundScale(1234567)).toBe(1230000)
    expect(formatScale(43127, 'de-DE')).toBe('1:43.100')
    expect(formatScale(43127, 'en-US')).toBe('1:43,100')
  })
})

describe('formatCoordinates', () => {
  it('formats degrees, minutes and seconds', () => {
    expect(formatCoordinates(53.5531, 9.9575, 'dms', 'en')).toBe(`53°33'11" N  09°57'27" E`)
    expect(formatCoordinates(53.5531, 9.9575, 'dms', 'de')).toBe(`53°33'11" N  09°57'27" O`)
  })

  it('handles the southern and western hemisphere', () => {
    expect(formatCoordinates(-33.8568, -151.2153, 'dms', 'en')).toBe(`33°51'24" S  151°12'55" W`)
  })

  it('formats decimal degrees and decimal minutes', () => {
    expect(formatCoordinates(53.5531, 9.9575, 'decimal', 'en')).toBe('53.5531° N  9.9575° E')
    expect(formatCoordinates(53.5531, 9.9575, 'dm', 'en')).toBe(`53°33.186' N  09°57.450' E`)
  })

  it('never shows 60 seconds', () => {
    expect(formatCoordinates(10.99999, 0, 'dms', 'en')).toMatch(/^11°00'00" N/)
  })
})
