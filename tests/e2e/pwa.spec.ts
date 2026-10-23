import { devices, expect, test, type Page } from '@playwright/test'
import { exportPoster, openEditor, pngInfo, waitForMap } from './helpers'

async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 })
}

test.describe('app (PWA)', () => {
  test('is installable: manifest, icons and a service worker', async ({ page, request }) => {
    await openEditor(page)
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    const res = await request.get(href!)
    expect(res.headers()['content-type']).toContain('application/manifest+json')
    const manifest = await res.json()
    expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', short_name: 'I Was Here' })

    // Every icon exists in the size it claims; there is a maskable one for home screens.
    for (const icon of manifest.icons.filter((i: { type: string }) => i.type === 'image/png')) {
      const png = await request.get(icon.src)
      expect(png.ok(), icon.src).toBe(true)
      const { width, height } = pngInfo(Buffer.from(await png.body()))
      expect(`${width}x${height}`).toBe(icon.sizes)
    }
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
    for (const shot of manifest.screenshots) expect((await request.get(shot.src)).ok(), shot.src).toBe(true)

    await waitForServiceWorker(page)
    const cached = await page.evaluate(async () => {
      const names = await caches.keys()
      const shell = names.find(n => n.startsWith('iwh-shell-'))
      return shell ? (await (await caches.open(shell)).keys()).map(r => new URL(r.url).pathname) : []
    })
    expect(cached).toContain('/')
    expect(cached.some(p => p.endsWith('.css'))).toBe(true)
    expect(cached.some(p => p.includes('maplibre-gl-worker'))).toBe(true)
  })

  test('starts and exports offline after the first visit', async ({ page, context }) => {
    await openEditor(page)
    await waitForServiceWorker(page)
    // Let the map load once through the service worker so its tiles are kept.
    await page.reload()
    await waitForMap(page)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByTestId('poster')).toHaveAttribute('data-ready', 'true')
    await waitForMap(page)
    await expect(page.getByTestId('offline-badge')).toBeVisible()
    await expect(page.getByTestId('map-data-error')).toHaveCount(0)

    await page.getByTestId('location-search').fill('Hamburg')
    await expect(page.getByText('You’re offline. Searching needs a connection.')).toBeVisible()
    await page.getByTestId('location-search').fill('')

    const { buffer } = await exportPoster(page)
    expect(pngInfo(buffer)).toMatchObject({ width: 2880, height: 3840 })
  })

  test('offers the browser’s install prompt', async ({ page }) => {
    await openEditor(page)
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>, userChoice: Promise<unknown> }
      e.prompt = async () => {
        (window as { __prompted?: boolean }).__prompted = true
      }
      e.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(e)
    })
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByTestId('install-app').click()
    await expect.poll(() => page.evaluate(() => (window as { __prompted?: boolean }).__prompted)).toBe(true)
    // The prompt can only be used once.
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await expect(page.getByTestId('install-app')).toHaveCount(0)
  })
})

test.describe('app (PWA) on an iPhone', () => {
  const iphone = devices['iPhone 13']
  test.use({ userAgent: iphone.userAgent, viewport: iphone.viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  test('explains “Add to Home Screen”', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByTestId('install-app').click()
    const help = page.getByTestId('install-help')
    await expect(help).toBeVisible()
    await expect(help.locator('li')).toHaveCount(3)
    await expect(help).toContainText('Add to Home Screen')
  })
})
