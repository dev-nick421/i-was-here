import { expect, test, type Page } from '@playwright/test'
import { exportPoster, openEditor, openTab, pngInfo } from './helpers'

test.describe('mobile', () => {
  test('bottom tabs, collapsible sheet and export work on a phone', async ({ page }) => {
    await openEditor(page)
    const tabs = page.getByRole('tablist')
    await expect(tabs).toHaveAttribute('aria-orientation', 'horizontal')
    await expect(page.getByTestId('poster')).toBeVisible()

    // Search lives in the map panel on small screens
    await expect(page.getByTestId('location-search')).toBeVisible()

    await page.locator('[data-tab="style"]').click()
    await expect(page.getByTestId('layouts')).toBeVisible()
    // tapping the active tab collapses the sheet
    await page.locator('[data-tab="style"]').click()
    await expect(page.getByTestId('layouts')).toBeHidden()
    await page.locator('[data-tab="style"]').click()
    await page.locator('[data-layout="classic"]').click()

    const { buffer } = await exportPoster(page)
    expect(pngInfo(buffer)).toMatchObject({ width: 2880, height: 3840 })
  })

  test('the panel sheet can be dragged between peek, half and full height', async ({ page }) => {
    await openEditor(page)
    const sheet = page.getByTestId('panel')
    await expect(sheet).toHaveAttribute('data-sheet', 'half')
    const posterHalf = (await page.getByTestId('poster').boundingBox())!.height

    await dragHandle(page, 320)
    await expect(sheet).toHaveAttribute('data-sheet', 'peek')
    // more room for the poster
    await expect.poll(async () => (await page.getByTestId('poster').boundingBox())!.height).toBeGreaterThan(posterHalf * 1.3)

    await dragHandle(page, -700)
    await expect(sheet).toHaveAttribute('data-sheet', 'full')

    // a tap folds it back to half height
    await page.getByTestId('sheet-handle').click()
    await expect(sheet).toHaveAttribute('data-sheet', 'half')

    // focusing the search pulls it up above the keyboard, picking a place lowers it again
    await page.getByTestId('location-search').fill('Hamburg')
    await expect(sheet).toHaveAttribute('data-sheet', 'full')
    await page.getByRole('option').first().click()
    await expect(sheet).toHaveAttribute('data-sheet', 'half')
  })

  test('undo and zoom sit next to the poster', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'style')
    await page.locator('[data-layout="halo"]').click()
    await expect(page.locator('[data-layout="halo"]')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('undo-mobile').click()
    await expect(page.locator('[data-layout="halo"]')).toHaveAttribute('aria-checked', 'false')

    await openTab(page, 'map')
    const before = await page.getByTestId('scale').textContent()
    await page.getByTestId('zoom-in').click()
    await expect(page.getByTestId('scale')).not.toHaveText(before!)
  })
})

async function dragHandle(page: Page, dy: number) {
  const box = (await page.getByTestId('sheet-handle').boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  const steps = 12
  for (let i = 1; i <= steps; i++) await page.mouse.move(x, y + (dy * i) / steps)
  await page.waitForTimeout(250) // no flick: let it settle where it was dropped
  await page.mouse.move(x, y + dy + 1)
  await page.mouse.up()
}
