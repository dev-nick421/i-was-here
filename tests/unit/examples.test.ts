import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { FONT_PRESETS } from '~/core/fonts'
import { PAPER_FORMATS, RESOLUTIONS } from '~/core/formats'
import { parseProfileFile } from '~/core/profile'
import { LAYOUT_IDS } from '~/core/scene'

const root = path.resolve(__dirname, '../..')
const dir = path.join(root, 'profiles')
const files = fs.readdirSync(dir).filter(f => f.endsWith('.iwh.json'))

describe('example profiles', () => {
  it('exist', () => {
    expect(files.length).toBeGreaterThan(3)
  })

  for (const file of files) {
    it(`${file} loads without falling back to defaults`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
      const [profile] = parseProfileFile(raw)
      expect(profile!.name).toBe(raw.name)
      // Every value in the file was valid: parsing must not have changed anything.
      expect(profile!.style).toEqual(raw.style)
    })
  }
})

describe('profile JSON schema', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'docs/profile.schema.json'), 'utf8'))
  const style = schema.$defs.style.properties

  it('lists every option the app supports', () => {
    expect(style.layout.enum.sort()).toEqual([...LAYOUT_IDS].sort())
    expect(style.typography.properties.font.enum.sort()).toEqual(FONT_PRESETS.map(f => f.id).sort())
    expect(style.output.properties.paper.enum.sort()).toEqual(PAPER_FORMATS.map(p => p.id).sort())
    expect(style.output.properties.resolution.enum.sort()).toEqual(RESOLUTIONS.map(r => r.id).sort())
    expect(style.marker).toBeUndefined()
    expect(schema.$defs.content.properties.markers).toBeUndefined()
  })
})
