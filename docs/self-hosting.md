# Self-hosting guide

The [README](../README.md#install) gets you running in a minute. This page has the details:
every setting, HTTPS (needed to install the app), other map sources and what to do when
something doesn't work.

- [Settings](#settings)
- [HTTPS and installing the app](#https-and-installing-the-app)
- [Map tiles](#map-tiles)
- [Place search](#place-search)
- [Building the image yourself](#building-the-image-yourself)
- [Troubleshooting](#troubleshooting)

## Settings

All settings are optional environment variables. They are read when the container starts, so
there's no need to rebuild anything. With Docker Compose, put them into a `.env` file next to
`docker-compose.yml` (copy [`.env.example`](../.env.example)); with `docker run`, pass them
with `-e NAME=value`; on Unraid, they're in the template under *Show more settings*.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | With Compose: the port on your machine. Without Docker: the port the server listens on. |
| `NUXT_PUBLIC_MAP_TILES_URL` | `https://tiles.openfreemap.org/planet` | Vector tiles in the [OpenMapTiles schema](https://openmaptiles.org/schema/), as a TileJSON URL or a `…/{z}/{x}/{y}.pbf` template |
| `NUXT_PUBLIC_MAP_GLYPHS_URL` | OpenFreeMap fonts | Fonts for the optional district names on the map |
| `NUXT_PUBLIC_MAP_LABEL_FONT` | `Noto Sans Regular` | Font for those names (must exist on the glyph server) |
| `NUXT_PUBLIC_MAP_ATTRIBUTION` | `© OpenStreetMap contributors · © OpenMapTiles` | Credit line printed on posters |
| `NUXT_PUBLIC_MAP_PROVIDER_NAME`, `…_URL` | `OpenFreeMap` | Shown next to the poster |
| `NUXT_GEOCODER_PROVIDER` | `photon` | `photon` (search as you type) or `nominatim` |
| `NUXT_GEOCODER_URL` | provider's public server | Your own Photon or Nominatim |
| `NUXT_GEOCODER_USER_AGENT` | `i-was-here/1.0 (+repo)` | Sent to the geocoder. Please identify your instance. |
| `NUXT_GEOCODER_EMAIL` | none | Contact address for Nominatim |
| `NUXT_GEOCODER_RATE_LIMIT` | `120` | Searches per IP and minute (`0` turns the limit off) |

## HTTPS and installing the app

I Was Here is a progressive web app: you can install it on your phone, and it
opens offline with the places you've already looked at. Browsers only allow that on secure
addresses, `https://…` or `http://localhost`. On `http://192.168.1.10:3000` the editor works
fine, but the *Install app* option explains that HTTPS is needed.

Any reverse proxy with a certificate does the job (Nginx proxy manager, traefik, caddy whatever).

When you update the container, installed apps pick up the new version by themselves and
offer to reload.

## Map tiles

Any vector tile source in the [OpenMapTiles schema](https://openmaptiles.org/schema/) works:

- [OpenFreeMap](https://openfreemap.org) (default): free, no API key. You can also
  [host it yourself](https://github.com/hyperknot/openfreemap).
- [MapTiler](https://www.maptiler.com): set
  `NUXT_PUBLIC_MAP_TILES_URL=https://api.maptiler.com/tiles/v3/tiles.json?key=YOUR_KEY` and
  `NUXT_PUBLIC_MAP_GLYPHS_URL=https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=YOUR_KEY`.
- Your own tiles, built with [Planetiler](https://github.com/onthegomap/planetiler) and served
  with [tileserver-gl](https://github.com/maptiler/tileserver-gl) or
  [Martin](https://martin.maplibre.org).

The tiles are loaded by the browser, not by the server, so the URL has to be reachable from the
devices people design on.

## Place search

Searches go through the app's own `/api/geocode` endpoint, which forwards them to the
geocoder, tidies up the answers and caches them for a day.

- [Photon](https://photon.komoot.io) (default) is made for search as you type. Please keep its
  fair use in mind, or [run your own](https://github.com/komoot/photon).
- With [Nominatim](https://nominatim.org), requests are throttled to one per second, as its
  [usage policy](https://operations.osmfoundation.org/policies/nominatim/) asks.

## Building the image

```bash
git clone https://github.com/dev-nick421/i-was-here.git
cd i-was-here
docker build -t ghcr.io/dev-nick421/i-was-here:latest .
docker compose up -d   # uses the image you just built
```

Behind a TLS-intercepting proxy, pass its CA bundle as a build secret:
`docker build --secret id=ca,src=/path/to/ca.pem .`
```

## Troubleshooting

- **The map stays empty.** The browser can't reach the tile server. Check
  `NUXT_PUBLIC_MAP_TILES_URL` and whether the device you're on can open that URL. The editor
  shows a notice when tiles fail to load.
- **`pull access denied` or `denied`.** The image couldn't be downloaded. Check the spelling of
  `ghcr.io/dev-nick421/i-was-here:latest` and your internet connection.
- **`port is already allocated`.** Another container uses that port. Choose another one: `-p
  8080:3000` with `docker run`, `PORT=8080` in `.env` with Compose.
- **`env_file … must be a string`.** Your Docker Compose is older than 2.24. Update it, or
  replace the `env_file` block in `docker-compose.yml` with `env_file: .env`.
- **"Install app" says HTTPS is needed.** See [HTTPS and installing the app](#https-and-installing-the-app).
- **Logs:** `docker logs i-was-here`. A healthy start prints
  `Listening on http://0.0.0.0:3000`, and `docker ps` shows the container as *healthy*.
