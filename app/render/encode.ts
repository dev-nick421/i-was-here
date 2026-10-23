/**
 * Binary helpers for the exported files: print resolution metadata for PNG/JPEG and a tiny
 * single-page PDF writer. Print shops read the DPI from these headers to get the physical size.
 */

// ---------------------------------------------------------------------------------------------
// PNG: insert/replace a pHYs chunk
// ---------------------------------------------------------------------------------------------

let crcTable: Uint32Array | null = null

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xFFFFFFFF
  for (let i = start; i < end; i++) crc = crcTable[(crc ^ bytes[i]!) & 0xFF]! ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]

export function isPng(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b)
}

function chunkType(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!)
}

/** Returns a copy of the PNG with a pHYs chunk declaring `dpi` (replacing any existing one). */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (!isPng(png)) throw new Error('Not a PNG file')
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const ppm = Math.round(dpi / 0.0254)

  const phys = new Uint8Array(21)
  const pv = new DataView(phys.buffer)
  pv.setUint32(0, 9)
  phys.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  pv.setUint32(8, ppm)
  pv.setUint32(12, ppm)
  phys[16] = 1 // unit: metre
  pv.setUint32(17, crc32(phys, 4, 17))

  const parts: Uint8Array[] = [png.subarray(0, 8)]
  let offset = 8
  let inserted = false
  while (offset < png.length) {
    const len = view.getUint32(offset)
    const type = chunkType(png, offset)
    const end = offset + 12 + len
    if (type === 'pHYs') {
      offset = end
      continue
    }
    parts.push(png.subarray(offset, end))
    if (type === 'IHDR' && !inserted) {
      parts.push(phys)
      inserted = true
    }
    offset = end
  }
  return concat(parts)
}

/** Reads the DPI from a PNG's pHYs chunk (null if absent). */
export function readPngDpi(png: Uint8Array): number | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let offset = 8
  while (offset < png.length) {
    const len = view.getUint32(offset)
    if (chunkType(png, offset) === 'pHYs' && png[offset + 16] === 1) {
      return Math.round(view.getUint32(offset + 8) * 0.0254)
    }
    offset += 12 + len
  }
  return null
}

export function readPngSize(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

// ---------------------------------------------------------------------------------------------
// JPEG: set the JFIF density
// ---------------------------------------------------------------------------------------------

export function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xFF && bytes[1] === 0xD8
}

/** Returns a copy of the JPEG whose JFIF header declares `dpi` (adds the header if missing). */
export function setJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array {
  if (!isJpeg(jpeg)) throw new Error('Not a JPEG file')
  const d = Math.max(1, Math.min(65535, Math.round(dpi)))
  const hasJfif = jpeg[2] === 0xFF && jpeg[3] === 0xE0
    && String.fromCharCode(jpeg[6]!, jpeg[7]!, jpeg[8]!, jpeg[9]!) === 'JFIF'
  if (hasJfif) {
    const out = jpeg.slice()
    out[13] = 1 // units: dots per inch
    out[14] = d >> 8
    out[15] = d & 0xFF
    out[16] = d >> 8
    out[17] = d & 0xFF
    return out
  }
  const app0 = new Uint8Array([
    0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    d >> 8, d & 0xFF, d >> 8, d & 0xFF, 0x00, 0x00,
  ])
  return concat([jpeg.subarray(0, 2), app0, jpeg.subarray(2)])
}

export function readJpegDpi(jpeg: Uint8Array): number | null {
  if (!(jpeg[2] === 0xFF && jpeg[3] === 0xE0) || jpeg[13] !== 1) return null
  return (jpeg[14]! << 8) | jpeg[15]!
}

// ---------------------------------------------------------------------------------------------
// PDF: one page, one full-bleed JPEG image
// ---------------------------------------------------------------------------------------------

export interface PdfOptions {
  jpeg: Uint8Array
  pixelWidth: number
  pixelHeight: number
  /** Physical page size in centimetres. */
  widthCm: number
  heightCm: number
  title?: string
}

function pdfString(s: string) {
  // UTF-16BE hex string, safe for any characters.
  let hex = 'FEFF'
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (cp > 0xFFFF) {
      const v = cp - 0x10000
      hex += (0xD800 + (v >> 10)).toString(16).padStart(4, '0')
      hex += (0xDC00 + (v & 0x3FF)).toString(16).padStart(4, '0')
    } else {
      hex += cp.toString(16).padStart(4, '0')
    }
  }
  return `<${hex.toUpperCase()}>`
}

function pdfDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

export function buildPdf(o: PdfOptions): Uint8Array {
  const enc = new TextEncoder()
  const w = ((o.widthCm / 2.54) * 72).toFixed(3)
  const h = ((o.heightCm / 2.54) * 72).toFixed(3)
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`

  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data
    chunks.push(bytes)
    length += bytes.length
  }
  const obj = (n: number, body: string | (() => void)) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    if (typeof body === 'string') push(body)
    else body()
    push('\nendobj\n')
  }

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /TrimBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`)
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${o.pixelWidth} /Height ${o.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${o.jpeg.length} >>\nstream\n`)
    push(o.jpeg)
    push('\nendstream')
  })
  obj(5, `<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`)
  obj(6, `<< /Title ${pdfString(o.title ?? 'Map poster')} /Producer ${pdfString('I Was Here')} /Creator ${pdfString('I Was Here map poster maker')} /CreationDate (${pdfDate()}) >>`)

  const xref = length
  let table = `xref\n0 7\n0000000000 65535 f \n`
  for (let i = 1; i <= 6; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  push(table)
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return concat(chunks)
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
