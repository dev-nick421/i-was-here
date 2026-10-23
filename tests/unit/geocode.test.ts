import { describe, expect, it } from 'vitest'
import { subtitleForPlace, zoomForPlace } from '~/core/fit'
import { normalizeNominatim, normalizePhoton } from '../../server/utils/geocoders'

describe('normalizePhoton', () => {
  it('maps cities, districts, streets and POIs', () => {
    const results = normalizePhoton([
      {
        geometry: { coordinates: [9.99, 53.55] },
        properties: { osm_type: 'R', osm_id: 62782, type: 'city', osm_key: 'place', osm_value: 'city', name: 'Hamburg', country: 'Deutschland', countrycode: 'DE', state: 'Hamburg', extent: [8.1, 54.0, 10.3, 53.3] },
      },
      {
        geometry: { coordinates: [9.93, 53.54] },
        properties: { osm_type: 'N', osm_id: 1, osm_key: 'place', osm_value: 'suburb', name: 'Altona', city: 'Hamburg', country: 'Deutschland' },
      },
      {
        geometry: { coordinates: [9.98, 53.54] },
        properties: { osm_type: 'W', osm_id: 2, type: 'house', osm_key: 'amenity', name: 'Elbphilharmonie', street: 'Platz der Deutschen Einheit', housenumber: '1', city: 'Hamburg', country: 'Deutschland' },
      },
      {
        geometry: { coordinates: [9.97, 53.56] },
        properties: { osm_type: 'W', osm_id: 3, type: 'street', name: 'Grindelallee', city: 'Hamburg', country: 'Deutschland' },
      },
      { properties: { name: 'no geometry' } },
    ])
    expect(results.map(r => r.kind)).toEqual(['city', 'district', 'poi', 'street'])
    expect(results[0]).toMatchObject({ id: 'R62782', name: 'Hamburg', context: 'Deutschland', countryCode: 'de', lat: 53.55, lon: 9.99, bbox: [8.1, 53.3, 10.3, 54.0] })
    expect(results[1]!.context).toBe('Hamburg, Deutschland')
    expect(results[2]!.context).toBe('Platz der Deutschen Einheit 1, Hamburg, Deutschland')
  })

  it('removes duplicates', () => {
    const f = { geometry: { coordinates: [1, 2] as [number, number] }, properties: { type: 'city', name: 'X', country: 'Y' } }
    expect(normalizePhoton([f, f])).toHaveLength(1)
  })
})

describe('normalizeNominatim', () => {
  it('maps results and bounding boxes', () => {
    const [r] = normalizeNominatim([
      {
        osm_type: 'relation',
        osm_id: 7444,
        lat: '48.85',
        lon: '2.35',
        name: 'Paris',
        addresstype: 'city',
        boundingbox: ['48.81', '48.90', '2.22', '2.47'],
        address: { city: 'Paris', state: 'Île-de-France', country: 'France', country_code: 'fr' },
      },
    ])
    expect(r).toMatchObject({ id: 'R7444', name: 'Paris', kind: 'city', country: 'France', countryCode: 'fr', bbox: [2.22, 48.81, 2.47, 48.9] })
    expect(r!.context).toBe('Île-de-France, France')
  })
})

describe('place framing', () => {
  it('fits a bounding box but keeps cities at a city-like zoom', () => {
    // Hamburg's admin area includes islands far out in the North Sea – don't zoom out to that.
    const z = zoomForPlace({ kind: 'city', lat: 53.55, bbox: [8.1, 53.3, 10.3, 54.0] }, 1000, 1200)
    expect(z).toBeGreaterThanOrEqual(10.4)
    const paris = zoomForPlace({ kind: 'city', lat: 48.85, bbox: [2.22, 48.81, 2.47, 48.9] }, 1000, 1200)
    expect(paris).toBeGreaterThan(10.4)
    expect(paris).toBeLessThan(13.2)
    expect(zoomForPlace({ kind: 'street', lat: 0 }, 1000, 1000)).toBe(14.6)
  })

  it('suggests a subtitle', () => {
    const base = { id: '1', context: '', lat: 0, lon: 0 }
    expect(subtitleForPlace({ ...base, name: 'Hamburg', kind: 'city', country: 'Germany' })).toBe('Germany')
    expect(subtitleForPlace({ ...base, name: 'Altona', kind: 'district', city: 'Hamburg', country: 'Germany' })).toBe('Hamburg')
    expect(subtitleForPlace({ ...base, name: 'France', kind: 'country' })).toBe('')
  })
})
