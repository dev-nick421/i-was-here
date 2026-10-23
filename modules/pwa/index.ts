import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { createResolver, defineNuxtModule, extendRouteRules } from '@nuxt/kit'
import { precachePaths } from './precache'

/**
 * Turns the production build into an installable, offline-capable app: after Nitro has
 * copied the public files, `sw.js` is written next to them with the list of files to precache
 * (before the server bundle is built, so it's served as a static file like the others).
 * The manifest and icons are plain files in `public/`; registration, install prompt and updates
 * live in `app/composables/usePwa.ts`.
 */
export default defineNuxtModule({
  meta: { name: 'iwh-pwa' },
  setup(_, nuxt) {
    // Browsers must always see the newest worker and manifest.
    extendRouteRules('/sw.js', { headers: { 'cache-control': 'no-cache' } })
    extendRouteRules('/manifest.webmanifest', { headers: { 'cache-control': 'no-cache', 'content-type': 'application/manifest+json' } })

    if (nuxt.options.dev) return

    nuxt.hook('nitro:build:public-assets', async (nitro) => {
      const publicDir = nitro.options.output.publicDir
      const files = (await listFiles(publicDir)).map(file => relative(publicDir, file).split(sep).join('/'))
      const build = { version: nuxt.options.buildId, precache: precachePaths(files) }
      const template = await readFile(createResolver(import.meta.url).resolve('./sw.js'), 'utf8')
      await writeFile(join(publicDir, 'sw.js'), `self.__IWH_BUILD = ${JSON.stringify(build)}\n\n${template}`)
    })
  },
})

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(e => (e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)])))
  return nested.flat()
}
