import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE } from '~/core/defaults'
import { outputPixels, paperSizeCm, posterUnits, printQuality } from '~/core/formats'
import type { OutputOptions } from '~/core/types'

const out = (o: Partial<OutputOptions>): OutputOptions => ({ ...DEFAULT_STYLE.output, ...o })

describe('paper formats', () => {
  it('applies orientation', () => {
    expect(paperSizeCm(out({ paper: '50x70' }))).toEqual({ width: 50, height: 70 })
    expect(paperSizeCm(out({ paper: '50x70', orientation: 'landscape' }))).toEqual({ width: 70, height: 50 })
  })

  it('takes custom sizes literally and clamps them', () => {
    expect(paperSizeCm(out({ paper: 'custom', customWidthCm: 80, customHeightCm: 20 }))).toEqual({ width: 80, height: 20 })
    expect(paperSizeCm(out({ paper: 'custom', customWidthCm: 1, customHeightCm: 9999 }))).toEqual({ width: 5, height: 300 })
  })

  it('normalises the short side to 1000 layout units', () => {
    expect(posterUnits(out({ paper: '30x40' }))).toEqual({ width: 1000, height: (40 / 30) * 1000 })
    expect(posterUnits(out({ paper: '30x40', orientation: 'landscape' }))).toEqual({ width: (40 / 30) * 1000, height: 1000 })
  })
})

describe('output resolution', () => {
  it('uses the long edge for screen resolutions', () => {
    expect(outputPixels(out({ paper: '30x40', resolution: '4k' }))).toMatchObject({ width: 2880, height: 3840 })
    expect(outputPixels(out({ paper: '30x40', resolution: 'hd' }))).toMatchObject({ width: 1440, height: 1920 })
    expect(outputPixels(out({ paper: '50x70', resolution: 'wqhd' }))).toMatchObject({ width: 1829, height: 2560 })
    expect(outputPixels(out({ paper: '60x80', resolution: '4k', orientation: 'landscape' }))).toMatchObject({ width: 3840, height: 2880 })
  })

  it('uses the paper size for print resolutions', () => {
    const p = outputPixels(out({ paper: '30x40', resolution: 'print300' }))
    expect(p).toMatchObject({ width: 3543, height: 4724 })
    expect(p.dpi).toBeCloseTo(300, 0)
  })

  it('reports the effective dpi', () => {
    expect(outputPixels(out({ paper: '30x40', resolution: '4k' })).dpi).toBeCloseTo(243.8, 1)
    expect(printQuality(300)).toBe('excellent')
    expect(printQuality(200)).toBe('good')
    expect(printQuality(120)).toBe('fair')
    expect(printQuality(60)).toBe('low')
  })
})
