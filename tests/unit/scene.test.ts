import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE } from '~/core/defaults'
import { computeScene, estimateMeasure, LAYOUT_IDS, mapContainerSize, type Scene, type SceneInput } from '~/core/scene'
import type { FrameId, LayoutId, TextSize } from '~/core/types'

function input(over: Partial<SceneInput> = {}): SceneInput {
  return {
    width: 1000,
    height: 1333.33,
    layout: 'card',
    frame: 'none',
    colors: DEFAULT_STYLE.colors,
    typography: DEFAULT_STYLE.typography,
    title: 'Hamburg',
    subtitle: 'Deutschland',
    coords: `53°33'11" N  09°57'27" E`,
    attribution: '© OpenStreetMap contributors',
    measure: estimateMeasure,
    ...over,
  }
}

function texts(scene: Scene) {
  return scene.nodes.filter(n => n.kind === 'text')
}

function textBox(n: Extract<Scene['nodes'][number], { kind: 'text' }>) {
  const w = estimateMeasure(n.text, n.style)
  const x = n.align === 'left' ? n.x : n.align === 'center' ? n.x - w / 2 : n.x - w
  return { x, y: n.y - n.style.size * 0.75, w, h: n.style.size }
}

const FRAMES: FrameId[] = ['none', 'margin', 'line', 'double']
const SIZES: TextSize[] = ['s', 'm', 'l']
const SHAPES = [
  { width: 1000, height: 1333.33 },
  { width: 1000, height: 1400 },
  { width: 1414, height: 1000 },
  { width: 1000, height: 1000 },
]

describe('computeScene', () => {
  for (const layout of LAYOUT_IDS) {
    it(`${layout}: keeps the map and all text inside the poster for every frame, size and shape`, () => {
      for (const frame of FRAMES) {
        for (const size of SIZES) {
          for (const shape of SHAPES) {
            const scene = computeScene(input({ layout, frame, ...shape, typography: { ...DEFAULT_STYLE.typography, size } }))
            const m = scene.map.rect
            expect(m.w).toBeGreaterThan(shape.width * 0.3)
            expect(m.h).toBeGreaterThan(shape.height * 0.25)
            expect(m.x).toBeGreaterThanOrEqual(-0.001)
            expect(m.y).toBeGreaterThanOrEqual(-0.001)
            expect(m.x + m.w).toBeLessThanOrEqual(shape.width + 0.001)
            expect(m.y + m.h).toBeLessThanOrEqual(shape.height + 0.001)
            for (const t of texts(scene)) {
              const b = textBox(t)
              expect(b.x, `${layout}/${frame}/${size} ${t.role}`).toBeGreaterThanOrEqual(-0.5)
              expect(b.x + b.w, `${layout}/${frame}/${size} ${t.role}`).toBeLessThanOrEqual(shape.width + 0.5)
              expect(b.y).toBeGreaterThanOrEqual(0)
              expect(t.y).toBeLessThanOrEqual(shape.height)
            }
          }
        }
      }
    })
  }

  it('card: puts the title in a text box below the map', () => {
    const scene = computeScene(input())
    const title = texts(scene).find(t => t.role === 'title')!
    expect(title.text).toBe('HAMBURG')
    expect(title.y).toBeGreaterThan(scene.map.rect.y + scene.map.rect.h)
    const subtitle = texts(scene).find(t => t.role === 'subtitle')!
    expect(subtitle.x).toBeGreaterThan(title.x)
    expect(scene.nodes.some(n => n.kind === 'rect')).toBe(true)
  })

  it('respects the uppercase switch, except for script fonts', () => {
    const lower = computeScene(input({ typography: { ...DEFAULT_STYLE.typography, uppercase: false } }))
    expect(texts(lower).find(t => t.role === 'title')!.text).toBe('Hamburg')
    const script = computeScene(input({ typography: { ...DEFAULT_STYLE.typography, font: 'signature', uppercase: true } }))
    expect(texts(script).find(t => t.role === 'title')!.text).toBe('Hamburg')
  })

  it('omits hidden lines and lets map-only posters fill the content area', () => {
    const scene = computeScene(input({ subtitle: '', coords: '' }))
    expect(texts(scene).map(t => t.role).sort()).toEqual(['attribution', 'title'])
    const mapOnly = computeScene(input({ layout: 'mapOnly' }))
    expect(texts(mapOnly).map(t => t.role)).toEqual(['attribution'])
    expect(mapOnly.map.rect).toEqual({ x: 0, y: 0, w: 1000, h: 1333.33 })
  })

  it('without text, the card map uses the whole poster', () => {
    const scene = computeScene(input({ title: '', subtitle: '', coords: '', attribution: '' }))
    expect(scene.map.rect.h).toBeCloseTo(1333.33)
    expect(scene.nodes).toHaveLength(0)
  })

  it('draws frame lines around the content for line/double frames', () => {
    expect(computeScene(input({ frame: 'line' })).nodes.filter(n => n.kind === 'strokeRect')).toHaveLength(1)
    expect(computeScene(input({ frame: 'double' })).nodes.filter(n => n.kind === 'strokeRect')).toHaveLength(2)
    expect(computeScene(input({ frame: 'margin' })).map.rect.x).toBeCloseTo(50)
    const halo = computeScene(input({ layout: 'halo', frame: 'double' }))
    expect(halo.map.shape).toBe('circle')
    expect(halo.nodes.filter(n => n.kind === 'strokeCircle')).toHaveLength(2)
  })

  it('shrinks or wraps long titles instead of overflowing', () => {
    const long = 'Santa Cruz de la Sierra de los Andes'
    for (const layout of ['classic', 'card', 'poster'] as LayoutId[]) {
      const scene = computeScene(input({ layout, title: long }))
      for (const t of texts(scene).filter(t => t.role === 'title')) {
        expect(estimateMeasure(t.text, t.style)).toBeLessThanOrEqual(1000)
      }
    }
    const classic = computeScene(input({ layout: 'classic', title: long }))
    expect(texts(classic).filter(t => t.role === 'title')).toHaveLength(2)
  })

  it('is deterministic', () => {
    expect(computeScene(input({ layout: 'architect' }))).toEqual(computeScene(input({ layout: 'architect' })))
  })
})

describe('mapContainerSize', () => {
  it('rounds to integer CSS pixels and scales with detail', () => {
    expect(mapContainerSize({ x: 0, y: 0, w: 1000, h: 1193.3 }, 2)).toEqual({ width: 2000, height: 2387 })
  })
})
