import { expect, test } from '@playwright/test'
import {
  closeDialog,
  compareImages,
  exportPoster,
  inkShare,
  meanAbsDiff,
  openEditor,
  openTab,
  pngInfo,
  sampleImages,
  waitForMap,
} from './helpers'

test.describe('export', () => {
  test('exports a 4K PNG with print DPI metadata and real content', async ({ page }) => {
    await openEditor(page)
    // Ticket composition, no border, black on white: map on top, title strip at the bottom.
    await openTab(page, 'style')
    await page.locator('[data-layout="card"]').click()
    await page.locator('[data-frame="none"]').click()
    await page.locator('[data-theme="classic"]').click()
    const { buffer, fileName } = await exportPoster(page)
    expect(fileName).toBe('hamburg_30x40_4k.png')
    expect(pngInfo(buffer)).toEqual({ width: 2880, height: 3840, dpi: 244 })
    await expect(page.getByTestId('export-info')).toContainText('2880 × 3840 px · 244 DPI')

    const [grid] = await sampleImages(page, [buffer], 90, 120)
    // The map area has roads and water, the text box at the bottom has the title.
    const map = grid!.slice(0, 90 * 100 * 4)
    const textBox = grid!.slice(90 * 109 * 4, 90 * 120 * 4)
    expect(inkShare(map, 230)).toBeGreaterThan(0.2)
    expect(inkShare(textBox)).toBeGreaterThan(0.02)
    expect(inkShare(textBox)).toBeLessThan(0.3)
  })

  test('the preview matches the export (WYSIWYG)', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'style')
    await page.locator('[data-theme="midnight"]').click()
    await page.locator('[data-layout="classic"]').click()
    await waitForMap(page)
    const preview = await page.getByTestId('poster').screenshot()
    const { buffer } = await exportPoster(page)
    await closeDialog(page)

    // Same poster, different place: a control to make sure the comparison is meaningful.
    await page.getByTestId('zoom-in').click()
    await page.getByTestId('zoom-in').click()
    await waitForMap(page)
    const moved = await page.getByTestId('poster').screenshot()

    const [p, e, m] = await sampleImages(page, [preview, buffer, moved], 60, 80)
    const same = meanAbsDiff(p!, e!)
    const different = meanAbsDiff(m!, e!)
    expect(same).toBeLessThan(10)
    expect(different).toBeGreaterThan(same * 1.5)
  })

  test('tiled rendering (for huge prints) is seamless', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'export')
    await page.locator('[data-resolution="hd"]').click()
    const single = await exportPoster(page, () => page.getByTestId('export-button').click())
    await closeDialog(page)

    await page.goto('/?maxTile=400')
    await expect(page.getByTestId('poster')).toHaveAttribute('data-ready', 'true')
    await waitForMap(page)
    const tiled = await exportPoster(page)

    expect(pngInfo(tiled.buffer)).toMatchObject({ width: 1440, height: 1920 })
    const diff = await compareImages(page, single.buffer, tiled.buffer)
    expect(diff.mean).toBeLessThan(1.5)
    expect(diff.changed).toBeLessThan(0.004)
  })

  test('exports JPEG with JFIF density', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'export')
    await page.locator('[data-paper="50x70"]').click()
    await page.locator('[data-resolution="print150"]').click()
    await page.getByRole('radio', { name: 'JPEG' }).click()
    const { buffer, fileName } = await exportPoster(page, () => page.getByTestId('export-button').click())
    expect(fileName).toBe('hamburg_50x70_print150.jpg')
    expect(buffer[0]).toBe(0xFF)
    expect(buffer[1]).toBe(0xD8)
    expect(buffer.subarray(6, 10).toString('latin1')).toBe('JFIF')
    expect(buffer[13]).toBe(1) // dots per inch
    expect(buffer.readUInt16BE(14)).toBe(150)
  })

  test('exports a print-ready PDF with the physical page size', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'export')
    await page.locator('[data-paper="a3"]').click()
    await page.getByRole('radio', { name: 'Landscape' }).click()
    await page.locator('[data-resolution="hd"]').click()
    await page.getByRole('radio', { name: 'PDF' }).click()
    const { buffer, fileName } = await exportPoster(page, () => page.getByTestId('export-button').click())
    expect(fileName).toBe('hamburg_a3-landscape_hd.pdf')
    const text = buffer.toString('latin1')
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/MediaBox [0 0 1190.551 841.890]')
    expect(text).toContain('/Width 1920 /Height 1358')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    // cross-reference offsets point at the objects
    const xref = Number(/startxref\n(\d+)/.exec(text)![1])
    expect(text.slice(xref, xref + 4)).toBe('xref')
  })
})
