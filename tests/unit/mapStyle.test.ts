import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE } from '~/core/defaults'
import { buildMapStyle, ROAD_WIDTHS, vectorSource, widthExpression } from '~/core/mapStyle'
import type { MapOptions } from '~/core/types'

const base = {
  colors: DEFAULT_STYLE.colors,
  tilesUrl: 'https://tiles.example.org/planet',
  glyphsUrl: 'https://tiles.example.org/fonts/{fontstack}/{range}.pbf',
  labelFont: 'Noto Sans Regular',
  language: 'de',
}

const build = (map: Partial<MapOptions> = {}) => buildMapStyle({ ...base, map: { ...DEFAULT_STYLE.map, ...map } })
const ids = (map: Partial<MapOptions> = {}) => build(map).layers.map(l => l.id)

describe('buildMapStyle', () => {
  it('builds a valid-looking v8 style', () => {
    const style = build()
    expect(style.version).toBe(8)
    expect(style.sources.omt).toEqual({ type: 'vector', url: base.tilesUrl })
    expect(style.layers[0]).toMatchObject({ id: 'land', type: 'background', paint: { 'background-color': DEFAULT_STYLE.colors.land } })
  })

  it('toggles layers from the map options', () => {
    expect(ids({ buildings: false })).not.toContain('buildings')
    expect(ids({ buildings: true })).toContain('buildings')
    expect(ids({ parks: true })).toContain('parks')
    expect(ids({ water: false })).not.toContain('water')
    expect(ids({ rail: true })).toContain('rail')
    expect(ids({ labels: true })).toContain('place-labels')
    expect(ids({ roads: 'major' })).not.toContain('roads-minor')
    expect(ids({ roads: 'standard' })).toContain('roads-minor')
    expect(ids({ roads: 'standard' })).not.toContain('roads-path')
    expect(ids({ roads: 'all' })).toContain('roads-path')
  })

  it('draws major roads above minor roads', () => {
    const list = ids()
    expect(list.indexOf('roads-motorway')).toBeGreaterThan(list.indexOf('roads-minor'))
    expect(list.indexOf('roads-minor')).toBeGreaterThan(list.indexOf('water'))
  })

  it('uses the theme colors', () => {
    const style = buildMapStyle({ ...base, map: DEFAULT_STYLE.map, colors: { ...DEFAULT_STYLE.colors, roads: '#ff0000', water: '#00ff00' } })
    const motorway = style.layers.find(l => l.id === 'roads-motorway')!
    expect((motorway as { paint: Record<string, unknown> }).paint['line-color']).toBe('#ff0000')
    const water = style.layers.find(l => l.id === 'water')!
    expect((water as { paint: Record<string, unknown> }).paint['fill-color']).toBe('#00ff00')
  })

  it('localises labels', () => {
    const labels = build({ labels: true }).layers.find(l => l.id === 'place-labels') as { layout: Record<string, unknown> }
    expect(labels.layout['text-field']).toEqual(['coalesce', ['get', 'name:de'], ['get', 'name']])
  })

  it('accepts tile URL templates as well as TileJSON', () => {
    expect(vectorSource('https://x.org/{z}/{x}/{y}.pbf')).toEqual({ type: 'vector', tiles: ['https://x.org/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14 })
  })
})

describe('widthExpression', () => {
  it('shifts zoom stops and scales widths for higher detail levels', () => {
    const low = widthExpression(ROAD_WIDTHS.motorway, 0, 1)
    const high = widthExpression(ROAD_WIDTHS.motorway, 1, 2)
    expect(low.slice(0, 5)).toEqual(['interpolate', ['exponential', 1.55], ['zoom'], 6, 0.5])
    expect(high.slice(3, 5)).toEqual([7, 1])
  })
})
