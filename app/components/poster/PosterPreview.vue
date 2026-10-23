<script setup lang="ts">
import gsap from 'gsap'
import type { MapLibreMap as MapInstance } from 'maplibre-gl'
import { buildMapStyle } from '~/core/mapStyle'
import { detailZoomOffset } from '~/core/geo'
import { sceneFonts } from '~/core/scene'
import { drawSceneNodes } from '~/render/drawScene'
import { ensureFonts } from '~/render/fonts'
import { configureMapLibre, MapLibreMap } from '~/render/maplibre'
import { clearMeasureCache } from '~/render/text'

/**
 * The live poster. The map is a real MapLibre map rendered at the poster's *design size* and
 * scaled down with a CSS transform, so what you see is exactly what gets exported (only the
 * pixel density differs). Text and decorations are drawn on a canvas overlay from the same
 * scene description the exporter uses.
 */
const props = defineProps<{
  /** CSS pixels per layout unit. */
  unit: number
}>()

const emit = defineEmits<{ ready: [map: MapInstance] }>()

const store = usePosterStore()
const { t, intlLocale } = useI18n()
const { online } = usePwa()
const config = useRuntimeConfig()
const mapConfig = config.public.map as { tilesUrl: string, glyphsUrl: string, labelFont: string }

const poster = ref<HTMLElement>()
const mapEl = ref<HTMLElement>()
const overlay = ref<HTMLCanvasElement>()
const dpr = ref(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
const loaded = ref(false)
/** True while the map has nothing left to load or animate (used by tests). */
const idle = ref(false)
/** Set when map data can't be loaded (tile server unreachable or misconfigured). */
const dataError = ref(false)
let map: MapInstance | null = null

const scene = computed(() => store.scene)
const rect = computed(() => scene.value.map.rect)
const size = computed(() => ({ width: scene.value.width * props.unit, height: scene.value.height * props.unit }))
/** CSS scale applied to the design-size map container. */
const mapScale = computed(() => (rect.value.w * props.unit) / store.mapSize.width)
const zoomOffset = computed(() => detailZoomOffset(store.style.map.detail))

function currentStyle(transitionMs = 250) {
  return buildMapStyle({
    colors: store.style.colors,
    map: store.style.map,
    tilesUrl: mapConfig.tilesUrl,
    glyphsUrl: mapConfig.glyphsUrl,
    labelFont: mapConfig.labelFont,
    language: intlLocale.value,
    transitionMs,
  })
}

// ---------------------------------------------------------------------------------------------
// Map lifecycle
// ---------------------------------------------------------------------------------------------

let moveFrame = 0
function syncViewFromMap() {
  if (!map) return
  const c = map.getCenter()
  store.setView({ lng: c.lng, lat: c.lat, zoom: map.getZoom() - zoomOffset.value, bearing: map.getBearing() })
}

onMounted(() => {
  configureMapLibre()
  const v = store.content.view
  map = new MapLibreMap({
    container: mapEl.value!,
    style: currentStyle(0),
    center: [v.lng, v.lat],
    zoom: v.zoom + zoomOffset.value,
    bearing: v.bearing,
    pixelRatio: Math.max(0.1, dpr.value * mapScale.value),
    attributionControl: false,
    maxPitch: 0,
    pitchWithRotate: false,
    touchPitch: false,
    minZoom: 0,
    maxZoom: 21,
    canvasContextAttributes: { antialias: true },
  })
  map.touchZoomRotate.disableRotation()
  map.on('move', () => {
    cancelAnimationFrame(moveFrame)
    moveFrame = requestAnimationFrame(syncViewFromMap)
  })
  map.on('moveend', syncViewFromMap)
  map.on('idle', () => (idle.value = true))
  map.on('render', () => {
    if (idle.value && !map?.loaded()) idle.value = false
  })
  map.on('movestart', () => (idle.value = false))
  map.on('error', (e) => {
    const err = e as unknown as { sourceId?: string, tile?: unknown, error?: { status?: number } }
    if (err.sourceId || err.tile || err.error?.status) dataError.value = true
  })
  map.on('data', (e) => {
    if ((e as unknown as { dataType?: string, tile?: unknown }).tile) dataError.value = false
  })
  map.once('load', () => {
    loaded.value = true
    emit('ready', map!)
  })
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(moveFrame)
  cancelAnimationFrame(drawFrame)
  map?.remove()
  map = null
})

function onResize() {
  dpr.value = window.devicePixelRatio || 1
}

// Style (colors, map elements, language)
let styleFrame = 0
watch(
  () => [store.style.colors, store.style.map, intlLocale.value],
  () => {
    cancelAnimationFrame(styleFrame)
    styleFrame = requestAnimationFrame(() => map?.setStyle(currentStyle(), { diff: true }))
  },
  { deep: true },
)

// Detail level: same extent, different zoom and container size
watch(zoomOffset, async () => {
  await nextTick()
  if (!map) return
  map.resize()
  map.jumpTo({ zoom: store.content.view.zoom + zoomOffset.value })
})

// Container size changes (layout, format, frame) – MapLibre's own ResizeObserver handles the
// canvas; we keep the pixel ratio in sync so the preview is sharp but not wasteful.
watch([mapScale, dpr], () => {
  map?.setPixelRatio(Math.max(0.1, dpr.value * mapScale.value))
})

watch(() => store.mapSize, async () => {
  await nextTick()
  map?.resize()
}, { deep: true })

// Camera requests from the UI (search, sliders, undo)
watch(() => store.cameraRequest, (req) => {
  if (!map || !req) return
  const v = { ...store.content.view, ...req.view }
  const target = {
    center: [v.lng, v.lat] as [number, number],
    zoom: v.zoom + zoomOffset.value,
    bearing: v.bearing,
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!req.animate || reduced) map.jumpTo(target)
  else map.flyTo({ ...target, duration: 1400, essential: false, curve: 1.5 })
})

// ---------------------------------------------------------------------------------------------
// Overlay (text, frames, text boxes)
// ---------------------------------------------------------------------------------------------

let drawFrame = 0
function draw() {
  cancelAnimationFrame(drawFrame)
  drawFrame = requestAnimationFrame(() => {
    const canvas = overlay.value
    if (!canvas) return
    const s = props.unit * dpr.value
    const w = Math.max(1, Math.round(scene.value.width * s))
    const h = Math.max(1, Math.round(scene.value.height * s))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    drawSceneNodes(ctx, scene.value, s)
  })
}

watch([scene, () => props.unit, dpr], draw, { immediate: true })

// Load the fonts a scene needs, then re-measure and redraw.
async function loadFonts() {
  const texts = scene.value.nodes.flatMap(n => (n.kind === 'text' ? [n.text] : [])).join('')
  await ensureFonts(sceneFonts(scene.value), texts)
  store.fontsVersion++
}

watch(() => [store.style.typography.font, store.content.text.title, store.content.text.subtitle], loadFonts, { immediate: true })

onMounted(() => {
  const onFontsDone = () => {
    clearMeasureCache()
    store.fontsVersion++
  }
  document.fonts?.addEventListener?.('loadingdone', onFontsDone)
  onBeforeUnmount(() => document.fonts?.removeEventListener?.('loadingdone', onFontsDone))
})

// A gentle "settle" when the composition changes
watch(() => [store.style.layout, store.style.frame, store.style.output.paper, store.style.output.orientation], () => {
  if (!poster.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  gsap.fromTo(poster.value, { scale: 0.985, opacity: 0.85 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' })
})

defineExpose({
  getMap: () => map,
})
</script>

<template>
  <div
    ref="poster"
    data-testid="poster"
    :data-ready="loaded"
    :data-idle="idle"
    class="relative select-none"
    :style="{ width: `${size.width}px`, height: `${size.height}px`, background: scene.paper, boxShadow: 'var(--shadow-poster)' }"
  >
    <div
      class="absolute overflow-hidden"
      :class="scene.map.shape === 'circle' ? 'rounded-full' : ''"
      :style="{
        left: `${rect.x * unit}px`,
        top: `${rect.y * unit}px`,
        width: `${rect.w * unit}px`,
        height: `${rect.h * unit}px`,
        background: store.style.colors.land,
      }"
    >
      <div
        ref="mapEl"
        data-testid="map"
        class="origin-top-left"
        :style="{
          width: `${store.mapSize.width}px`,
          height: `${store.mapSize.height}px`,
          transform: `scale(${mapScale})`,
        }"
      />
    </div>
    <canvas
      ref="overlay"
      data-testid="poster-overlay"
      class="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
    />
    <p
      v-if="dataError"
      role="status"
      data-testid="map-data-error"
      class="pointer-events-none absolute inset-x-3 top-3 rounded-xl bg-surface/95 px-3 py-2 text-center text-xs text-ink-2 shadow-pop"
    >
      {{ online ? t('map.dataError') : t('map.offline') }}
    </p>
    <div
      v-if="!loaded"
      class="pointer-events-none absolute inset-0 animate-pulse"
      :style="{ background: `linear-gradient(120deg, transparent 30%, rgb(255 255 255 / 0.25) 50%, transparent 70%)` }"
    />
  </div>
</template>
