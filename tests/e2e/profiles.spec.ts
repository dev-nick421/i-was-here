import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { closeDialog, openEditor, openTab } from './helpers'

test.describe('profiles', () => {
  test('save, download, re-import and apply a profile', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'style')
    await page.locator('[data-layout="halo"]').click()
    await page.locator('[data-theme="noir"]').click()
    await openTab(page, 'export')
    await page.locator('[data-paper="50x70"]').click()

    // Save the look as a profile
    await page.getByTestId('profile-menu').click()
    await page.getByTestId('save-profile').click()
    await page.getByTestId('profile-name').fill('Night Halo')
    await page.getByTestId('profile-save-confirm').click()
    await expect(page.getByTestId('toast').filter({ hasText: 'Profile “Night Halo” saved' })).toBeVisible()
    await expect(page.getByTestId('profile-menu')).toContainText('Night Halo')

    // Download it as JSON
    await page.getByTestId('profile-menu').click()
    await page.getByTestId('manage-profiles').click()
    await expect(page.getByTestId('profile-item')).toHaveCount(1)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('profile-download').click()])
    expect(download.suggestedFilename()).toBe('night-halo.iwh.json')
    const json = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'))
    expect(json).toMatchObject({
      app: 'i-was-here',
      kind: 'profile',
      version: 1,
      name: 'Night Halo',
      style: { layout: 'halo', themeId: 'noir', output: { paper: '50x70' } },
    })
    expect(json.content).toBeUndefined()

    // Delete it, then import the file again
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByTestId('profiles-dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('profile-item')).toHaveCount(0)
    await closeDialog(page)
    await page.getByTestId('profile-file-input').setInputFiles({
      name: 'night-halo.iwh.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(json)),
    })
    await expect(page.getByTestId('toast').filter({ hasText: '1 profile(s) imported' })).toBeVisible()

    // Change the look, then apply the profile → back to the saved style
    await openTab(page, 'style')
    await page.locator('[data-theme="sand"]').click()
    await page.locator('[data-layout="card"]').click()
    await page.getByTestId('profile-menu').click()
    await page.getByRole('menuitem', { name: 'Night Halo' }).click()
    await expect(page.locator('[data-theme="noir"]')).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[data-layout="halo"]')).toHaveAttribute('aria-checked', 'true')

    // Profiles are kept in localStorage
    await page.reload()
    await expect(page.getByTestId('poster')).toHaveAttribute('data-ready', 'true')
    await page.getByTestId('profile-menu').click()
    await expect(page.getByRole('menuitem', { name: 'Night Halo' })).toBeVisible()
  })

  test('rejects files that are not profiles', async ({ page }) => {
    await openEditor(page)
    await page.getByTestId('profile-file-input').setInputFiles({
      name: 'nope.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}'),
    })
    await expect(page.getByTestId('toast').filter({ hasText: 'not an I Was Here profile' })).toBeVisible()
  })

  test('a profile can carry the place and text too', async ({ page }) => {
    await openEditor(page)
    await openTab(page, 'text')
    await page.getByTestId('title-input').fill('First date')
    await page.getByTestId('profile-menu').click()
    await page.getByTestId('save-profile').click()
    await page.getByTestId('profile-name').fill('With place')
    await page.getByRole('switch', { name: /Also store place and text/ }).click()
    await page.getByTestId('profile-save-confirm').click()

    await page.getByTestId('title-input').fill('Something else')
    await page.getByTestId('profile-menu').click()
    await page.getByRole('menuitem', { name: 'With place' }).click()
    await expect(page.getByTestId('title-input')).toHaveValue('First date')
  })
})
