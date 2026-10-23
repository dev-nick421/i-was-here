import { defineStore } from 'pinia'
import type { GeocodeResult } from '#shared/types/geocode'
import { clonePlain, DEFAULT_STYLE, defaultContent } from '~/core/defaults'
import { subtitleForPlace, zoomForPlace } from '~/core/fit'
import { outputPixels, paperSizeCm, posterUnits } from '~/core/formats'
import { detailScale, mapScale, wrapLng } from '~/core/geo'
import { buildScene } from '~/core/poster'
import { normalizeContent, normalizeStyle, sameStyle } from '~/core/profile'
import { mapContainerSize } from '~/core/scene'
import { getTheme, matchTheme } from '~/core/themes'
import type { MapView, PosterContent, PosterStyle, Profile, ThemeColors } from '~/core/types'
import { canvasMeasure } from '~/render/text'
import { debounce, readStorage, writeStorage } from '~/utils/storage'

const SESSION_KEY = 'iwh.session.v1'
const HISTORY_LIMIT = 100

export interface CameraRequest {
  id: number
  view: Partial<MapView>
  animate: boolean
}

interface Snapshot {
  style: PosterStyle
  content: PosterContent
}

export const usePosterStore = defineStore('poster', () => {
  const { intlLocale, locale } = useI18n()
  const config = useRuntimeConfig()
  const attributionText = config.public.map.attribution as string

  const style = reactive<PosterStyle>(clonePlain(DEFAULT_STYLE))
  const content = reactive<PosterContent>(defaultContent(locale.value))
  const activeProfileId = ref<string | null>(null)
  /** The style as it was when the active profile was applied/saved (for "unsaved changes"). */
  const profileBaseline = shallowRef<PosterStyle | null>(null)
  /** Bumped when web fonts finish loading so text gets re-measured. */
  const fontsVersion = ref(0)
  const cameraRequest = shallowRef<CameraRequest | null>(null)
  const restored = ref(false)

  // -------------------------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------------------------

  const units = computed(() => posterUnits(style.output))
  const paper = computed(() => paperSizeCm(style.output))
  const pixels = computed(() => outputPixels(style.output))
  const scale = computed(() => mapScale(content.view.lat, content.view.zoom, units.value.width, paper.value.width))
  const detailFactor = computed(() => detailScale(style.map.detail))

  const scene = computed(() => {
    void fontsVersion.value
    return buildScene(style, content, { locale: intlLocale.value, measure: canvasMeasure, attribution: attributionText })
  })

  const mapSize = computed(() => mapContainerSize(scene.value.map.rect, detailFactor.value))
  const isDirty = computed(() => !!profileBaseline.value && !sameStyle(style, profileBaseline.value))

  // -------------------------------------------------------------------------------------------
  // Style
  // -------------------------------------------------------------------------------------------

  function setTheme(id: string) {
    const theme = getTheme(id)
    if (!theme) return
    style.themeId = id
    Object.assign(style.colors, theme.colors)
  }

  function setColor(key: keyof ThemeColors, value: string) {
    style.colors[key] = value
    style.themeId = matchTheme(style.colors)
  }

  function applyStyle(next: PosterStyle) {
    const s = normalizeStyle(clonePlain(next))
    Object.assign(style, s)
  }

  // -------------------------------------------------------------------------------------------
  // Map view
  // -------------------------------------------------------------------------------------------

  let cameraId = 0
  function requestCamera(view: Partial<MapView>, animate = true) {
    cameraRequest.value = { id: ++cameraId, view, animate }
  }

  /** Called by the live map after the user moved it. */
  function setView(view: MapView) {
    const v = content.view
    const lng = wrapLng(view.lng)
    const zoom = Math.round(view.zoom * 1000) / 1000
    const bearing = Math.round(view.bearing * 10) / 10
    // Ignore floating point noise so a map that merely re-renders doesn't create history entries.
    if (Math.abs(v.lng - lng) > 1e-9) v.lng = lng
    if (Math.abs(v.lat - view.lat) > 1e-9) v.lat = view.lat
    if (v.zoom !== zoom) v.zoom = zoom
    if (v.bearing !== bearing) v.bearing = bearing
  }

  function zoomBy(delta: number) {
    requestCamera({ zoom: Math.min(18, Math.max(1, content.view.zoom + delta)) })
  }

  function goToPlace(place: GeocodeResult) {
    const rect = scene.value.map.rect
    const zoom = zoomForPlace(place, rect.w, rect.h)
    content.place = { name: place.name, country: place.country, countryCode: place.countryCode }
    content.text.title = place.name
    content.text.subtitle = subtitleForPlace(place).toLocaleUpperCase()
    content.view.lng = place.lon
    content.view.lat = place.lat
    content.view.zoom = zoom
    content.view.bearing = 0
    requestCamera({ lng: place.lon, lat: place.lat, zoom, bearing: 0 }, true)
  }

  // -------------------------------------------------------------------------------------------
  // Profiles & whole-poster operations
  // -------------------------------------------------------------------------------------------

  function applyContent(next: PosterContent, animate = true) {
    const c = normalizeContent(clonePlain(next), locale.value)
    Object.assign(content, c)
    requestCamera({ ...c.view }, animate)
  }

  function applyProfile(profile: Profile) {
    applyStyle(profile.style)
    if (profile.content) applyContent(profile.content)
    activeProfileId.value = profile.id
    profileBaseline.value = clonePlain(profile.style)
  }

  function markProfileSaved(profile: Profile | null) {
    activeProfileId.value = profile?.id ?? null
    profileBaseline.value = profile ? clonePlain(profile.style) : null
  }

  function newPoster(startProfile: Profile | null) {
    const fresh = defaultContent(locale.value)
    if (startProfile) {
      applyStyle(startProfile.style)
      markProfileSaved(startProfile)
    }
    applyContent(fresh)
  }

  // -------------------------------------------------------------------------------------------
  // History (undo / redo)
  // -------------------------------------------------------------------------------------------

  const past: string[] = []
  const future: string[] = []
  const canUndo = ref(false)
  const canRedo = ref(false)
  let current = ''
  let applyingHistory = false

  function serialize(): string {
    return JSON.stringify({ style, content } satisfies Snapshot)
  }

  function syncFlags() {
    canUndo.value = past.length > 0
    canRedo.value = future.length > 0
  }

  const record = debounce(() => {
    if (applyingHistory) return
    const next = serialize()
    if (next === current) return
    if (current) past.push(current)
    if (past.length > HISTORY_LIMIT) past.shift()
    future.length = 0
    current = next
    syncFlags()
  }, 350)

  function restoreSnapshot(json: string) {
    applyingHistory = true
    const snap = JSON.parse(json) as Snapshot
    Object.assign(style, snap.style)
    const prevView = { ...content.view }
    Object.assign(content, snap.content)
    const v = snap.content.view
    if (v.lng !== prevView.lng || v.lat !== prevView.lat || v.zoom !== prevView.zoom || v.bearing !== prevView.bearing) {
      requestCamera({ ...v }, true)
    }
    current = json
    syncFlags()
    nextTick(() => {
      applyingHistory = false
    })
  }

  function undo() {
    record.flush()
    const prev = past.pop()
    if (!prev) return
    future.push(current)
    restoreSnapshot(prev)
  }

  function redo() {
    const next = future.pop()
    if (!next) return
    past.push(current)
    restoreSnapshot(next)
  }

  // -------------------------------------------------------------------------------------------
  // Persistence (autosave of the current poster)
  // -------------------------------------------------------------------------------------------

  const persist = debounce(() => {
    writeStorage(SESSION_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      style,
      content,
      activeProfileId: activeProfileId.value,
      profileBaseline: profileBaseline.value,
    }))
  }, 400)

  function restoreSession(): boolean {
    const raw = readStorage(SESSION_KEY)
    if (!raw) return false
    try {
      const data = JSON.parse(raw) as Record<string, unknown>
      Object.assign(style, normalizeStyle(data.style))
      Object.assign(content, normalizeContent(data.content, locale.value))
      activeProfileId.value = typeof data.activeProfileId === 'string' ? data.activeProfileId : null
      profileBaseline.value = data.profileBaseline ? normalizeStyle(data.profileBaseline) : null
      return true
    } catch {
      return false
    }
  }

  function init(startProfile: Profile | null) {
    restored.value = restoreSession()
    if (!restored.value && startProfile) {
      applyStyle(startProfile.style)
      markProfileSaved(startProfile)
    }
    current = serialize()
    watch([style, content], () => {
      record()
      persist()
    }, { deep: true })
    watch(activeProfileId, () => persist())
  }

  return {
    style,
    content,
    activeProfileId,
    profileBaseline,
    fontsVersion,
    cameraRequest,
    restored,
    units,
    paper,
    pixels,
    scale,
    detailFactor,
    scene,
    mapSize,
    isDirty,
    canUndo,
    canRedo,
    setTheme,
    setColor,
    applyStyle,
    requestCamera,
    setView,
    zoomBy,
    goToPlace,
    applyContent,
    applyProfile,
    markProfileSaved,
    newPoster,
    undo,
    redo,
    init,
  }
})
