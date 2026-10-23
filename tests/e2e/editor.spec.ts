import { expect, test } from '@playwright/test'
import { openEditor, openTab, waitForMap } from './helpers'

test.describe('editor', () => {
  test('loads without errors and shows the default poster', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await openEditor(page)

    await expect(page.getByTestId('poster')).toBeVisible()
    await expect(page.getByTestId('poster-info')).toContainText('30 × 40 cm')
    await expect(page.getByTestId('poster-info')).toContainText('2880 × 3840 px')
    await expect(page.getByTestId('scale')).toHaveText(/~1:\d{2},\d{3}/)

    // The map canvas exists inside the scaled design-size container.
    const map = page.getByTestId('map')
    await expect(map.locator('canvas.maplibregl-canvas')).toHaveCount(1)
    // It is laid out at design size (× detail level) and shown scaled down.
    const width = await map.evaluate(el => el.clientWidth)
    const shown = (await map.locator('..').boundingBox())!.width
    expect(width).toBeGreaterThan(shown * 1.5)

    expect(errors).toEqual([])
    await expect(page.getByTestId('map-data-error')).toHaveCount(0)
  })

  test('tells the user when map data cannot be loaded', async ({ page }) => {
    await page.route('**/tiles.json', route => route.abort())
    await page.goto('/')
    await expect(page.getByTestId('map-data-error')).toBeVisible()
  })

  test('searching a place sets the title, subtitle and moves the map', async ({ page }) => {
    await openEditor(page)
    const search = page.getByTestId('location-search')
    await search.fill('Pari')
    const results = page.getByTestId('search-results')
    await expect(results.getByRole('option')).toHaveCount(1)
    await expect(results).toContainText('Paris')
    await results.getByRole('option').first().click()
    await waitForMap(page)

    await openTab(page, 'text')
    await expect(page.getByTestId('title-input')).toHaveValue('Paris')
    await expect(page.getByTestId('subtitle-input')).toHaveValue('FRANCE')
    await expect(page.locator('#poster-coords')).toHaveValue(/48°51'\d\d" N {2}02°21'\d\d" E/)
  })

  test('keyboard navigation in search results', async ({ page }) => {
    await openEditor(page)
    const search = page.getByTestId('location-search')
    await search.fill('Ham')
    await expect(page.getByTestId('search-results').getByRole('option')).toHaveCount(5)
    await search.press('ArrowDown')
    await search.press('Enter')
    await waitForMap(page)
    await openTab(page, 'text')
    await expect(page.getByTestId('title-input')).toHaveValue('Altona')
    await expect(page.getByTestId('subtitle-input')).toHaveValue('HAMBURG')
  })

  test('layouts, frames and color themes update the poster', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'style')
    await page.locator('[data-layout="halo"]').click()
    await page.locator('[data-theme="noir"]').click()
    await page.getByRole('radio', { name: 'Double' }).click()

    await expect(page.locator('[data-layout="halo"]')).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[data-theme="noir"]')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('poster')).toHaveCSS('background-color', 'rgb(15, 15, 17)')
    // circular map
    await expect(page.getByTestId('map').locator('..')).toHaveClass(/rounded-full/)
  })

  test('custom colors switch the theme to "custom" and can be reset', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'style')
    await page.getByRole('button', { name: 'Fine-tune colors' }).click()
    const land = page.getByTestId('custom-colors').locator('[data-color="land"] input[aria-label$="(hex)"]')
    await land.fill('#ffeedd')
    await land.press('Enter')
    await expect(page.locator('[data-theme][aria-checked="true"]')).toHaveCount(0)
    await page.getByRole('button', { name: /Back to “Atelier”/ }).click()
    await expect(page.locator('[data-theme="atelier"]')).toHaveAttribute('aria-checked', 'true')
  })

  test('text options: hide lines, custom coordinates, fonts', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'text')
    await page.getByTestId('title-input').fill('Our Place')
    await page.getByRole('button', { name: 'Write your own text instead' }).click()
    await page.locator('#poster-coords').fill('Since 2019')
    await page.locator('[data-font="signature"]').click()
    await expect(page.locator('[data-font="signature"]')).toHaveAttribute('aria-checked', 'true')
    // the uppercase switch is disabled for script fonts
    await expect(page.getByRole('switch', { name: /Title in capitals/ })).toBeDisabled()
    await page.getByRole('button', { name: 'Use coordinates again' }).click()
    await expect(page.locator('#poster-coords')).toHaveValue(/53°33'/)
  })

  test('the map can be dragged inside the scaled preview', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'text')
    const coords = page.locator('#poster-coords')
    const before = await coords.inputValue()
    const box = (await page.getByTestId('map').locator('..').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 + 80, { steps: 8 })
    await page.mouse.up()
    await waitForMap(page)
    await expect(coords).not.toHaveValue(before)
    // dragging left moves the map center east, dragging down moves it north
    const [lat, lng] = (await coords.inputValue()).match(/\d+°\d+'\d+"/g)!
    const [lat0, lng0] = before.match(/\d+°\d+'\d+"/g)!
    expect(lat).not.toBe(lat0)
    expect(lng).not.toBe(lng0)
  })

  test('undo and redo', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'style')
    await page.locator('[data-theme="ocean"]').click()
    await page.waitForTimeout(500)
    await page.getByTestId('undo').click()
    await expect(page.locator('[data-theme="atelier"]')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('redo').click()
    await expect(page.locator('[data-theme="ocean"]')).toHaveAttribute('aria-checked', 'true')
  })

  test('zoom controls update the map scale', async ({ page }) => {
    await openEditor(page)
    const before = await page.getByTestId('scale').textContent()
    await page.getByTestId('zoom-in').click()
    await waitForMap(page)
    await expect(page.getByTestId('scale')).not.toHaveText(before!)
  })

  test('the session survives a reload', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'text')
    await page.getByTestId('title-input').fill('Persisted')
    await page.waitForTimeout(800)
    await page.reload()
    await expect(page.getByTestId('poster')).toHaveAttribute('data-ready', 'true')
    await openTab(page, 'text')
    await expect(page.getByTestId('title-input')).toHaveValue('Persisted')
  })

  test('language can be switched to German', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('radio', { name: 'Deutsch' }).click()
    await expect(page.locator('[data-tab="map"]')).toContainText('Ort')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByTestId('scale')).toHaveText(/~1:\d{2}\.\d{3}/)
  })
})

test.describe('api', () => {
  test('geocoding proxy normalises results', async ({ request }) => {
    const res = await request.get('/api/geocode?q=Paris&lang=en')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.results[0]).toMatchObject({ name: 'Paris', kind: 'city', country: 'France', countryCode: 'fr' })
    expect(body.results[0].bbox).toHaveLength(4)
    const empty = await (await request.get('/api/geocode?q=a')).json()
    expect(empty.results).toEqual([])
  })

  test('health check', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
