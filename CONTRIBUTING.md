# Contributing

Thanks for helping to improve I Was Here! Bug reports, ideas, new palettes, layouts and
translations are all welcome.

## Getting started

You need Node.js 22+ and [pnpm](https://pnpm.io):

```bash
corepack enable
pnpm install
pnpm dev          # http://localhost:3000
```

Before opening a pull request, please run:

```bash
pnpm lint
pnpm typecheck
pnpm test                    # unit tests (Vitest)
pnpm build && pnpm test:e2e  # end-to-end tests (Playwright, against the production build)
```

CI runs the same checks plus a Docker build for every published platform.

### Working offline

The end-to-end tests don't use any public service: `tests/fixtures/server.mjs` generates a
synthetic city as vector tiles and answers place searches. You can develop against it too:

```bash
pnpm fixtures:serve   # http://localhost:4599
NUXT_PUBLIC_MAP_TILES_URL=http://localhost:4599/tiles.json \
NUXT_GEOCODER_URL=http://localhost:4599/photon/api pnpm dev
```

## How it works

```
 ┌───────────────┐   PosterStyle + PosterContent (Pinia, autosaved)
 │ Editor panels │──────────────────────────────┐
 └───────────────┘                              ▼
                    app/core/scene.ts: layout engine → Scene (shapes + text in layout units)
                                                │
           ┌────────────────────────────────────┴───────────────────────────┐
           ▼                                                                ▼
  Live preview (PosterPreview.vue)                         Export (app/render/exportPoster.ts)
  • MapLibre map at the poster's design size,              • the same MapLibre style at pixelRatio = output/design
    scaled down with a CSS transform                       • split into pixel-exact tiles above the GPU limit
  • canvas overlay draws the Scene                         • the same Scene drawn on top, then PNG/JPEG/PDF
                                                             with DPI metadata
```

- **Layout units:** the poster's short side is always 1000 units. Text sizes, margins and
  frames scale with the paper, so a 50 × 70 print is a larger copy of the same design.
- **Detail level:** the map is rendered at a higher zoom level in a proportionally larger
  container. The vector tiles then contain more streets, while line widths are scaled to match.
- **Map style:** `app/core/mapStyle.ts` generates a MapLibre style from the palette and map
  options.
- **App (PWA):** `modules/pwa` writes the service worker (`sw.js`) into every production build
  with the list of files to precache. The page is loaded network-first because the server puts
  its runtime config into it; map tiles are cached as they're viewed. Registration, the install
  prompt and updates live in `app/composables/usePwa.ts`. There's no service worker in
  `pnpm dev`. The icons in `public/icons` are rendered from the logo with `pnpm icons`.

### Project structure

```
app/
  core/        framework-free domain logic: layouts, themes, fonts, geo math, profiles (unit-tested)
  render/      canvas drawing, export pipeline, PNG/JPEG/PDF encoders
  components/  editor UI (panels, poster preview, dialogs, UI primitives)
  composables/ shared state: i18n, toasts, breakpoints, app install and updates
  stores/      Pinia stores: poster (with undo/redo), profiles, ui
  i18n/        English and German messages
modules/pwa/   build step that generates the service worker
server/        Nitro API: /api/geocode, /api/health
deploy/        Unraid template
profiles/      example profiles
tests/         Vitest unit tests, Playwright e2e tests, offline fixture tile server
```

## Where things live

- **New palette:** add it to `app/core/themes.ts`. Palettes are designed as a whole: map colors
  and paper/text colors belong together. Check them with light and dark layouts.
- **New layout:** add a layout function in `app/core/scene.ts`, then add it to the profile schema
  (`docs/profile.schema.json`), the translations and the tests. Layouts work in layout units
  (short side = 1000), and `tests/unit/scene.test.ts` checks every layout with every frame, text
  size and paper shape.
- **New typeface:** add a preset to `app/core/fonts.ts` and import its weights from Fontsource in
  `app/assets/css/main.css`. Only use fonts with an open license (OFL or Apache).
- **Translations:** `app/i18n/en.ts` is the reference, other languages are typed against it.
- **Map rendering:** `app/core/mapStyle.ts` builds the MapLibre style. The schema is OpenMapTiles.

## Principles

- **WYSIWYG:** preview and export draw the same scene. Anything visual goes into the scene or
  the map style, never only into the preview's DOM.
- **Phones are first-class:** check changes at phone size too (`pnpm test:e2e` has a mobile
  project). Touch targets at least 40 px, inputs 16 px on touch screens.
- **Profiles are a public format.** Keep `normalizeStyle` backwards compatible. If you need a
  breaking change, bump `PROFILE_VERSION` and add a migration.
- **No tracking, no third-party requests** beyond the configured tiles and geocoder.
