import fs from 'node:fs'
import { expect, type Page } from '@playwright/test'

/** Opens the editor with a clean localStorage (only on the first load of a test). */
export async function openEditor(page: Page, path = '/') {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('iwh.e2e')) {
      localStorage.clear()
      sessionStorage.setItem('iwh.e2e', '1')
    }
  })
  await page.goto(path)
  await expect(page.getByTestId('poster')).toHaveAttribute('data-ready', 'true')
  await waitForMap(page)
}

export async function waitForMap(page: Page) {
  await expect(page.getByTestId('poster')).toHaveAttribute('data-idle', 'true', { timeout: 30_000 })
  // let the overlay canvas catch up (it redraws on the next animation frame)
  await page.waitForTimeout(300)
}

export async function openTab(page: Page, tab: 'map' | 'style' | 'text' | 'export') {
  await page.locator(`[data-tab="${tab}"]`).click()
  await expect(page.getByTestId('panel')).toHaveAttribute('id', `panel-${tab}`)
}

export async function exportPoster(page: Page, trigger = () => page.getByTestId('topbar-export').click()) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 180_000 }), trigger()])
  const file = await download.path()
  const buffer = fs.readFileSync(file)
  await expect(page.getByTestId('export-dialog')).toHaveAttribute('data-state', 'done')
  return { buffer, fileName: download.suggestedFilename() }
}

export async function closeDialog(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
}

export function pngInfo(buf: Buffer) {
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const i = buf.indexOf('pHYs')
  const dpi = i > 0 ? Math.round(buf.readUInt32BE(i + 4) * 0.0254) : null
  return { width, height, dpi }
}

/**
 * Decodes images in the browser and returns them as small RGBA grids, so tests can compare
 * the preview with the export without extra image libraries.
 */
export async function sampleImages(page: Page, images: Buffer[], width: number, height: number) {
  return page.evaluate(async ({ images, width, height }) => {
    const out: number[][] = []
    for (const b64 of images) {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes]))
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, 0, 0, width, height)
      out.push([...ctx.getImageData(0, 0, width, height).data])
    }
    return out
  }, { images: images.map(b => b.toString('base64')), width, height })
}

export function meanAbsDiff(a: number[], b: number[]) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!)
    n += 3
  }
  return sum / n
}

/** Share of pixels that differ by more than `threshold` in any channel. */
export function changedShare(a: number[], b: number[], threshold = 64) {
  let changed = 0
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i]! - b[i]!) > threshold || Math.abs(a[i + 1]! - b[i + 1]!) > threshold || Math.abs(a[i + 2]! - b[i + 2]!) > threshold) changed++
  }
  return changed / (a.length / 4)
}

/** Share of "ink" pixels (clearly darker than white paper) in an RGBA grid. */
export function inkShare(rgba: number[], threshold = 140) {
  let ink = 0
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i]! + rgba[i + 1]! + rgba[i + 2]!) / 3 < threshold) ink++
  }
  return ink / (rgba.length / 4)
}

/** Compares two images pixel by pixel inside the browser (fast, no data transfer). */
export async function compareImages(page: Page, a: Buffer, b: Buffer, threshold = 64) {
  return page.evaluate(async ({ a, b, threshold }) => {
    const decode = async (b64: string) => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes]))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    }
    const [x, y] = [await decode(a), await decode(b)]
    if (x.width !== y.width || x.height !== y.height) return { mean: Infinity, changed: 1 }
    let sum = 0
    let changed = 0
    for (let i = 0; i < x.data.length; i += 4) {
      const d0 = Math.abs(x.data[i]! - y.data[i]!)
      const d1 = Math.abs(x.data[i + 1]! - y.data[i + 1]!)
      const d2 = Math.abs(x.data[i + 2]! - y.data[i + 2]!)
      sum += d0 + d1 + d2
      if (d0 > threshold || d1 > threshold || d2 > threshold) changed++
    }
    const pixels = x.data.length / 4
    return { mean: sum / (pixels * 3), changed: changed / pixels }
  }, { a: a.toString('base64'), b: b.toString('base64'), threshold })
}
