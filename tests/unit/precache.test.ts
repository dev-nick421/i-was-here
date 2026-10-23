import { describe, expect, it } from 'vitest'
import { precachePaths } from '../../modules/pwa/precache'

describe('precachePaths', () => {
  it('keeps the app shell and Latin fonts, skips everything else', () => {
    const files = [
      '_nuxt/entry.abc.css',
      '_nuxt/Iwh6fSQR.js',
      '_nuxt/Iwh6fSQR.js.gz',
      '_nuxt/maplibre-gl-worker.x.mjs',
      '_nuxt/builds/latest.json',
      '_nuxt/builds/meta/1234.json',
      '_nuxt/inter-latin-wght-normal.a.woff2',
      '_nuxt/inter-latin-ext-wght-normal.b.woff2',
      '_nuxt/inter-cyrillic-wght-normal.c.woff2',
      '_nuxt/inter-latin-wght-normal.a.woff',
      'favicon.svg',
      'favicon.ico',
      'manifest.webmanifest',
      'icons/apple-touch-icon.png',
      'icons/icon-512.png',
      'og.jpg',
      'screenshots/editor-wide.jpg',
      'sw.js',
    ]
    expect(precachePaths(files)).toEqual([
      '/_nuxt/Iwh6fSQR.js',
      '/_nuxt/builds/meta/1234.json',
      '/_nuxt/entry.abc.css',
      '/_nuxt/inter-latin-ext-wght-normal.b.woff2',
      '/_nuxt/inter-latin-wght-normal.a.woff2',
      '/_nuxt/maplibre-gl-worker.x.mjs',
      '/favicon.ico',
      '/favicon.svg',
      '/icons/apple-touch-icon.png',
      '/manifest.webmanifest',
    ])
  })
})
