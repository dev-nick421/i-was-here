import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, defaultContent } from '~/core/defaults'
import { buildScene, exportFileName, mapCamera, resolveTexts } from '~/core/poster'
import { estimateMeasure } from '~/core/scene'
import type { PosterContent } from '~/core/types'

function content(over: Partial<PosterContent> = {}): PosterContent {
  return { ...defaultContent('en'), ...over }
}

describe('resolveTexts', () => {
  it('shows the coordinates of the map center', () => {
    expect(resolveTexts(DEFAULT_STYLE, content(), 'en').coords).toBe(`53°33'04" N  09°59'37" E`)
    const paris = content({ view: { lng: 2.2945, lat: 48.8584, zoom: 13, bearing: 0 } })
    expect(resolveTexts(DEFAULT_STYLE, paris, 'en').coords).toBe(`48°51'30" N  02°17'40" E`)
  })

  it('respects visibility and custom text', () => {
    const c = content()
    c.text = { ...c.text, showSubtitle: false, coordsMode: 'custom', coordsCustom: 'Since 2019' }
    expect(resolveTexts(DEFAULT_STYLE, c, 'en')).toEqual({ title: 'Hamburg', subtitle: '', coords: 'Since 2019' })
  })
})

describe('buildScene', () => {
  it('omits the attribution when switched off', () => {
    const on = buildScene(DEFAULT_STYLE, content(), { locale: 'en', measure: estimateMeasure, attribution: '© OSM' })
    const off = buildScene({ ...DEFAULT_STYLE, attribution: false }, content(), { locale: 'en', measure: estimateMeasure, attribution: '© OSM' })
    expect(on.nodes.some(n => n.kind === 'text' && n.role === 'attribution')).toBe(true)
    expect(off.nodes.some(n => n.kind === 'text' && n.role === 'attribution')).toBe(false)
  })

  it('uses the paper size for the scene dimensions', () => {
    const scene = buildScene({ ...DEFAULT_STYLE, output: { ...DEFAULT_STYLE.output, paper: '50x70', orientation: 'landscape' } }, content(), { locale: 'en', measure: estimateMeasure, attribution: '' })
    expect(scene.width).toBeCloseTo(1400)
    expect(scene.height).toBe(1000)
  })
})

describe('mapCamera', () => {
  it('adds the detail offset to the normalised zoom', () => {
    expect(mapCamera(content(), DEFAULT_STYLE).zoom).toBeCloseTo(13.1)
    expect(mapCamera(content(), { ...DEFAULT_STYLE, map: { ...DEFAULT_STYLE.map, detail: 'high' } }).zoom).toBeCloseTo(13.9)
  })
})

describe('exportFileName', () => {
  it('builds descriptive, safe file names', () => {
    expect(exportFileName(DEFAULT_STYLE, content(), 'png')).toBe('hamburg_30x40_4k.png')
    const c = content()
    c.text.title = 'Düsseldorf – Straße'
    expect(exportFileName({ ...DEFAULT_STYLE, output: { ...DEFAULT_STYLE.output, paper: 'custom', customWidthCm: 42, customHeightCm: 59.4 } }, c, 'pdf'))
      .toBe('dusseldorf-strasse_42x59.4cm_4k.pdf')
  })
})
