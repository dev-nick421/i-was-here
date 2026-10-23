/**
 * Renders the app icons in public/ from the postmark logo (public/favicon.svg).
 * Run after changing the logo: `pnpm icons` (uses Playwright's Chromium).
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'public/icons')
const ACCENT = '#e2502a'
const INK = '#1b1915'
const PIN = 'M18 9.6c-3.2 0-5.7 2.5-5.7 5.6 0 4.2 5.7 10 5.7 10s5.7-5.8 5.7-10c0-3.1-2.5-5.6-5.7-5.6Zm0 8a2.3 2.3 0 1 1 0-4.7 2.3 2.3 0 0 1 0 4.7Z'

/** The round postmark on a transparent background (browser tabs, desktop app icons). */
const mark = size => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="16.9" fill="${ACCENT}" stroke="${INK}" stroke-width="1.6"/>
  <circle cx="18" cy="18" r="13.1" fill="none" stroke="#fff" stroke-width="1.15" stroke-dasharray="1.45 2.15"/>
  <path d="${PIN}" fill="#fff" fill-rule="evenodd"/>
</svg>`

/**
 * Full-bleed version for home screens: the platform cuts it into its own shape, so everything
 * important stays inside the central safe zone (`ring` = radius of the dashed ring).
 */
const tile = (size, ring) => {
  const k = (ring * size) / 13.1
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${ACCENT}"/>
  <g transform="translate(${size / 2} ${size / 2}) scale(${k}) translate(-18 -17.6)">
    <circle cx="18" cy="17.6" r="13.1" fill="none" stroke="#fff" stroke-width="1.15" stroke-dasharray="1.45 2.15"/>
    <path d="${PIN}" fill="#fff" fill-rule="evenodd"/>
  </g>
</svg>`
}

const ICONS = [
  ['icon-192.png', mark(192)],
  ['icon-512.png', mark(512)],
  ['icon-maskable-192.png', tile(192, 0.3)],
  ['icon-maskable-512.png', tile(512, 0.3)],
  ['apple-touch-icon.png', tile(180, 0.34)],
]

const browser = await chromium.launch()
const page = await browser.newPage()

async function render(svg) {
  const size = Number(/width="(\d+)"/.exec(svg)[1])
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`)
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}

fs.mkdirSync(out, { recursive: true })
for (const [name, svg] of ICONS) {
  fs.writeFileSync(path.join(out, name), await render(svg))
  console.log(`public/icons/${name}`)
}

// favicon.ico: PNG images in an ICO container (supported by every browser since IE).
const sizes = [16, 32, 48]
const images = []
for (const size of sizes) images.push(await render(mark(size)))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((size, i) => {
  const entry = 6 + 16 * i
  header.writeUInt8(size, entry)
  header.writeUInt8(size, entry + 1)
  header.writeUInt16LE(1, entry + 4) // color planes
  header.writeUInt16LE(32, entry + 6) // bits per pixel
  header.writeUInt32LE(images[i].length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += images[i].length
})
fs.writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([header, ...images]))
console.log('public/favicon.ico')

await browser.close()
