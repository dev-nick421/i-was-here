import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the production build (`pnpm build` first) and an offline
 * fixture server that serves a synthetic city as vector tiles and fake geocoding results,
 * so they never depend on public map services.
 */
const APP_PORT = Number(process.env.E2E_APP_PORT || 3100)
const FIXTURE_PORT = Number(process.env.E2E_FIXTURE_PORT || 4599)
const FIXTURES = `http://localhost:${FIXTURE_PORT}`

const webglArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    acceptDownloads: true,
    trace: 'retain-on-failure',
    launchOptions: {
      args: webglArgs,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
  ],
  webServer: [
    {
      command: 'node tests/fixtures/server.mjs',
      url: `${FIXTURES}/health`,
      env: { FIXTURE_PORT: String(FIXTURE_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node .output/server/index.mjs',
      url: `http://localhost:${APP_PORT}/api/health`,
      env: {
        PORT: String(APP_PORT),
        NUXT_PUBLIC_MAP_TILES_URL: `${FIXTURES}/tiles.json`,
        NUXT_PUBLIC_MAP_GLYPHS_URL: `${FIXTURES}/fonts/{fontstack}/{range}.pbf`,
        NUXT_GEOCODER_URL: `${FIXTURES}/photon/api`,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
