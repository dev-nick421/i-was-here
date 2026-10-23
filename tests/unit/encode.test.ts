import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildPdf, crc32, readJpegDpi, readPngDpi, readPngSize, setJpegDpi, setPngDpi } from '~/render/encode'

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length))
  return out
}

/** A real 2 × 1 RGB PNG. */
function tinyPng() {
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, 2)
  v.setUint32(4, 1)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const raw = new Uint8Array([0, 255, 0, 0, 0, 0, 255])
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array()),
  ]
  return Uint8Array.from(parts.flatMap(p => [...p]))
}

function chunkTypes(png: Uint8Array) {
  const types: string[] = []
  const view = new DataView(png.buffer, png.byteOffset)
  let o = 8
  while (o < png.length) {
    const len = view.getUint32(o)
    const type = new TextDecoder().decode(png.subarray(o + 4, o + 8))
    // every chunk must carry a valid CRC
    expect(view.getUint32(o + 8 + len)).toBe(crc32(png, o + 4, o + 8 + len))
    types.push(type)
    o += 12 + len
  }
  return types
}

describe('crc32', () => {
  it('matches the reference value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926)
  })
})

describe('PNG DPI', () => {
  it('inserts a pHYs chunk right after IHDR', () => {
    const png = setPngDpi(tinyPng(), 300)
    expect(chunkTypes(png)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND'])
    expect(readPngDpi(png)).toBe(300)
    expect(readPngSize(png)).toEqual({ width: 2, height: 1 })
  })

  it('replaces an existing pHYs chunk', () => {
    const twice = setPngDpi(setPngDpi(tinyPng(), 72), 150)
    expect(chunkTypes(twice)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND'])
    expect(readPngDpi(twice)).toBe(150)
  })

  it('rejects non-PNG data', () => {
    expect(() => setPngDpi(new Uint8Array([1, 2, 3]), 300)).toThrow()
  })
})

describe('JPEG DPI', () => {
  const jfif = () => new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xFF, 0xD9,
  ])

  it('updates the JFIF density', () => {
    const out = setJpegDpi(jfif(), 300)
    expect(readJpegDpi(out)).toBe(300)
    expect(out.length).toBe(jfif().length)
  })

  it('adds a JFIF header when missing', () => {
    const bare = new Uint8Array([0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x02, 0xFF, 0xD9])
    const out = setJpegDpi(bare, 240)
    expect(readJpegDpi(out)).toBe(240)
    expect(out.length).toBe(bare.length + 18)
    expect([...out.subarray(-6)]).toEqual([...bare.subarray(2)])
  })
})

describe('PDF', () => {
  it('writes a valid single-page PDF with correct xref offsets', () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 1, 2, 3, 0xFF, 0xD9])
    const pdf = buildPdf({ jpeg, pixelWidth: 2480, pixelHeight: 3508, widthCm: 21, heightCm: 29.7, title: 'Café (Hamburg) ♥' })
    const text = new TextDecoder('latin1').decode(pdf)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/MediaBox [0 0 595.276 841.890]')
    expect(text).toContain('/Width 2480 /Height 3508')
    expect(text).toContain(`/Length ${jpeg.length}`)
    const xref = Number(/startxref\n(\d+)/.exec(text)![1])
    expect(text.slice(xref, xref + 4)).toBe('xref')
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]))
    expect(offsets).toHaveLength(6)
    offsets.forEach((off, i) => expect(text.slice(off, off + 8)).toBe(`${i + 1} 0 obj\n`))
    // non-ASCII titles are encoded as UTF-16BE hex strings
    expect(text).toContain('/Title <FEFF00430061006600E9')
  })
})
