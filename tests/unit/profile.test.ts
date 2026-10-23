import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, defaultContent } from '~/core/defaults'
import {
  createProfile,
  normalizeContent,
  normalizeStyle,
  parseProfileFile,
  parseStoredProfiles,
  profileFileName,
  ProfileParseError,
  sameStyle,
  serializeProfile,
  serializeProfiles,
} from '~/core/profile'
import { getTheme } from '~/core/themes'

describe('profiles', () => {
  it('round-trips through JSON without changes', () => {
    const style = { ...DEFAULT_STYLE, layout: 'halo' as const, frame: 'double' as const }
    const profile = createProfile('Hamburg Blue', style, defaultContent('de'))
    const [back] = parseProfileFile(serializeProfile(profile))
    expect(back).toEqual(profile)
  })

  it('writes a self-describing file', () => {
    const json = JSON.parse(serializeProfile(createProfile('X', DEFAULT_STYLE)))
    expect(json).toMatchObject({ app: 'i-was-here', kind: 'profile', version: 1, name: 'X' })
    expect(json.$schema).toMatch(/profile\.schema\.json$/)
    expect(json.content).toBeUndefined()
  })

  it('round-trips bundles', () => {
    const a = createProfile('A', DEFAULT_STYLE)
    const b = createProfile('B', { ...DEFAULT_STYLE, themeId: 'noir', colors: { ...getTheme('noir')!.colors } })
    const list = parseProfileFile(serializeProfiles([a, b]))
    expect(list.map(p => p.name)).toEqual(['A', 'B'])
    expect(list[1]!.style.colors.land).toBe('#0f0f11')
  })

  it('fills in missing values and clamps invalid ones', () => {
    const [p] = parseProfileFile({
      kind: 'profile',
      name: '  Hand edited  ',
      style: {
        layout: 'does-not-exist',
        themeId: 'noir',
        colors: { roads: '#ABC', water: 'not a color' },
        map: { lineWidth: 99, buildings: 'yes' },
        output: { paper: '50x70', jpegQuality: 0.1 },
        somethingUnknown: true,
      },
    })
    expect(p!.name).toBe('Hand edited')
    expect(p!.style.layout).toBe(DEFAULT_STYLE.layout)
    expect(p!.style.colors.roads).toBe('#aabbcc')
    // invalid / missing colors come from the named theme
    expect(p!.style.colors.water).toBe(getTheme('noir')!.colors.water)
    expect(p!.style.colors.land).toBe(getTheme('noir')!.colors.land)
    expect(p!.style.map.lineWidth).toBe(2.5)
    expect(p!.style.map.buildings).toBe(DEFAULT_STYLE.map.buildings)
    expect(p!.style.output.paper).toBe('50x70')
    expect(p!.style.output.jpegQuality).toBe(0.5)
    expect('somethingUnknown' in p!.style).toBe(false)
  })

  it('accepts a bare style object', () => {
    const [p] = parseProfileFile(JSON.stringify({ layout: 'classic', colors: { land: '#000000' } }), { fallbackName: 'Imported' })
    expect(p!.name).toBe('Imported')
    expect(p!.style.layout).toBe('classic')
    expect(p!.style.colors.land).toBe('#000000')
  })

  it('rejects things that are not profiles', () => {
    expect(() => parseProfileFile('{nope')).toThrowError(ProfileParseError)
    expect(() => parseProfileFile('[]')).toThrow(/not-a-profile/)
    expect(() => parseProfileFile({ hello: 'world' })).toThrow(/not-a-profile/)
    expect(() => parseProfileFile({ app: 'other-app', style: {} })).toThrow(/not-a-profile/)
    expect(() => parseProfileFile({ app: 'i-was-here', kind: 'profile', version: 99, style: {} })).toThrow(/newer-version/)
    expect(() => parseProfileFile({ kind: 'profile-bundle', profiles: [] })).toThrow(/empty/)
  })

  it('validates content coordinates', () => {
    const content = normalizeContent({ view: { lng: 370, lat: 95, zoom: 30, bearing: 0 } })
    expect(content.view.lng).toBeCloseTo(10)
    expect(content.view.lat).toBeCloseTo(85.051129)
    expect(content.view.zoom).toBe(20)
  })

  it('still loads older files that contain markers (they are ignored)', () => {
    const [p] = parseProfileFile({
      kind: 'profile',
      name: 'Old',
      style: { layout: 'halo', marker: { icon: 'heart', color: '#f00', size: 1 } },
      content: { text: { title: 'Paris' }, markers: [{ lng: 2.29, lat: 48.86, icon: 'heart' }] },
    })
    expect(p!.style.layout).toBe('halo')
    expect('marker' in p!.style).toBe(false)
    expect(p!.content!.text.title).toBe('Paris')
    expect('markers' in p!.content!).toBe(false)
  })

  it('compares styles structurally', () => {
    expect(sameStyle(DEFAULT_STYLE, normalizeStyle(JSON.parse(JSON.stringify(DEFAULT_STYLE))))).toBe(true)
    expect(sameStyle(DEFAULT_STYLE, { ...DEFAULT_STYLE, layout: 'halo' })).toBe(false)
  })

  it('ignores broken localStorage data', () => {
    expect(parseStoredProfiles(null)).toEqual([])
    expect(parseStoredProfiles('garbage')).toEqual([])
    expect(parseStoredProfiles('[1, "x", {"name":"ok","style":{}}]')).toHaveLength(1)
  })

  it('creates safe file names', () => {
    expect(profileFileName('Hamburg – Straßen & Wasser')).toBe('hamburg-strassen-wasser.iwh.json')
    expect(profileFileName('***')).toBe('profile.iwh.json')
  })
})
