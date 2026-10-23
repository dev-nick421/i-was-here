import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: ['@pinia/nuxt', '@nuxt/eslint'],

  // The editor is a pure client-side app (WebGL map, canvas export, localStorage),
  // the Nitro server only serves the SPA and the small geocoding API.
  ssr: false,

  devtools: { enabled: false },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'I Was Here: map poster maker',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content' },
        {
          name: 'description',
          content:
            'Design minimalist map posters of any place on earth and export them as print-ready high-resolution images. Free and open source.',
        },
        { name: 'theme-color', content: '#fbf9f4' },
        // Installed app on iPhone/iPad (the rest comes from the web app manifest)
        { name: 'apple-mobile-web-app-title', content: 'I Was Here' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { property: 'og:title', content: 'I Was Here: map poster maker' },
        {
          property: 'og:description',
          content: 'Design minimalist map posters of any place and export them in print quality.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: '/og.jpg' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    geocoder: {
      // "photon" (default, supports search-as-you-type) or "nominatim"
      provider: 'photon',
      // Override the upstream endpoint, e.g. a self-hosted Photon instance.
      url: '',
      userAgent: 'i-was-here/1.0 (+https://github.com/dev-nick421/i-was-here)',
      // Optional contact address that Nominatim asks heavy users to send along.
      email: '',
      timeoutMs: 8000,
    },
    public: {
      map: {
        // TileJSON URL of an OpenMapTiles-schema vector tile source.
        tilesUrl: 'https://tiles.openfreemap.org/planet',
        glyphsUrl: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
        labelFont: 'Noto Sans Regular',
        attribution: '© OpenStreetMap contributors · © OpenMapTiles',
        providerName: 'OpenFreeMap',
        providerUrl: 'https://openfreemap.org',
      },
      repoUrl: 'https://github.com/dev-nick421/i-was-here',
    },
  },

  routeRules: {
    '/**': {
      headers: {
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'x-frame-options': 'SAMEORIGIN',
        'permissions-policy': 'camera=(), microphone=(), geolocation=(self)',
      },
    },
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },
  compatibilityDate: '2026-10-01',

  nitro: {
    compressPublicAssets: true,
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['maplibre-gl', 'gsap', 'zod'],
    },
  },

  typescript: {
    strict: true,
  },

  eslint: {
    config: {
      stylistic: {
        semi: false,
        quotes: 'single',
        commaDangle: 'always-multiline',
        braceStyle: '1tbs',
      },
    },
  },
})
