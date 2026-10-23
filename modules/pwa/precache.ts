/**
 * Which built files the service worker downloads up front, so the editor starts offline.
 *
 * Everything else (other font scripts, images, …) is cached the first time it's used.
 * Paths are relative to the public output directory and use forward slashes.
 */
export function precachePaths(files: string[]): string[] {
  return files
    .filter((file) => {
      if (/\.(?:gz|br)$/.test(file)) return false
      if (file.startsWith('_nuxt/')) {
        if (file.startsWith('_nuxt/builds/')) return file.startsWith('_nuxt/builds/meta/')
        if (/\.(?:js|mjs|css)$/.test(file)) return true
        // Fonts: only the Latin subsets, the browser only fetches other scripts when a title uses them.
        return file.endsWith('.woff2') && /-latin(?:-ext)?-/.test(file)
      }
      return ['favicon.svg', 'favicon.ico', 'manifest.webmanifest', 'icons/apple-touch-icon.png'].includes(file)
    })
    .map(file => `/${file}`)
    .sort()
}
