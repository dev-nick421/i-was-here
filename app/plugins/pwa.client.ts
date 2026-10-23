export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const tiles = config.public.map.tilesUrl as string
  startPwa(config.app.buildId, {
    // In development there is no service worker (Vite serves modules on the fly).
    serviceWorker: !import.meta.dev,
    // A TileJSON URL (not a {z}/{x}/{y} template) is the one map file that isn't cached on its own.
    warm: tiles.includes('{z}') ? [] : [tiles],
  })
})
