<script setup lang="ts">
import { CircleCheck, Download, FileText, Share2, TriangleAlert } from '@lucide/vue'
import gsap from 'gsap'
import { clonePlain } from '~/core/defaults'
import { downloadBlob, ExportError, exportPoster, type ExportProgress, type ExportResult } from '~/render/exportPoster'
import { formatBytes } from '~/utils/storage'

const ui = useUiStore()
const store = usePosterStore()
const { t, intlLocale } = useI18n()
const config = useRuntimeConfig()
const { push } = useToasts()
const pwa = usePwa()

type State = 'running' | 'done' | 'error'
const state = ref<State>('running')
const progress = ref<ExportProgress>({ stage: 'prepare', progress: 0 })
const result = shallowRef<ExportResult | null>(null)
const errorCode = ref<string>('unknown')
const previewUrl = ref<string | null>(null)
const bar = ref<HTMLElement>()
const check = ref<HTMLElement>()
let controller: AbortController | null = null

/** Overall progress: the map is most of the work. */
const overall = computed(() => {
  const p = progress.value
  switch (p.stage) {
    case 'prepare': return 0.04
    case 'map': return 0.06 + p.progress * 0.74
    case 'compose': return 0.82
    case 'encode': return 0.9
    default: return 1
  }
})

const stageText = computed(() => {
  const p = progress.value
  if (p.stage === 'map' && (p.tiles ?? 1) > 1) return t('export.stages.tiles', { n: p.tile ?? 1, total: p.tiles ?? 1 })
  return t(`export.stages.${p.stage}`)
})

watch(overall, (v) => {
  if (bar.value) gsap.to(bar.value, { scaleX: v, duration: 0.5, ease: 'power2.out' })
})

async function run() {
  state.value = 'running'
  result.value = null
  progress.value = { stage: 'prepare', progress: 0 }
  controller = new AbortController()
  if (bar.value) gsap.set(bar.value, { scaleX: 0.02 })
  try {
    const res = await exportPoster({
      style: clonePlain(store.style),
      content: clonePlain(store.content),
      locale: intlLocale.value,
      source: {
        tilesUrl: config.public.map.tilesUrl as string,
        glyphsUrl: config.public.map.glyphsUrl as string,
        labelFont: config.public.map.labelFont as string,
        attribution: config.public.map.attribution as string,
      },
      signal: controller.signal,
      // `?maxTile=512` forces tiled rendering (used by the end-to-end tests).
      maxTileSize: Number(new URLSearchParams(location.search).get('maxTile')) || undefined,
      onProgress: (p) => {
        progress.value = p
      },
    })
    result.value = res
    if (res.mime.startsWith('image/')) previewUrl.value = URL.createObjectURL(res.blob)
    downloadBlob(res.blob, res.fileName)
    state.value = 'done'
    await nextTick()
    if (check.value) gsap.fromTo(check.value, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.2)' })
    if (pwa.shouldHintInstall()) {
      setTimeout(() => push(t('pwa.hint'), 'info', { duration: 9000, action: { label: t('pwa.install'), run: pwa.install } }), 1500)
    }
  } catch (e) {
    if (!ui.exportOpen) return
    errorCode.value = e instanceof ExportError ? e.code : 'unknown'
    if (!(e instanceof ExportError)) console.error(e)
    state.value = 'error'
  }
}

function cleanup() {
  controller?.abort()
  controller = null
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}

watch(() => ui.exportOpen, (open) => {
  if (open) run()
  else cleanup()
})

onBeforeUnmount(cleanup)

function again() {
  if (result.value) downloadBlob(result.value.blob, result.value.fileName)
}

// Phones: hand the file to the share sheet (save to Photos, AirDrop, send it to a print shop …).
const resultFile = computed(() => (result.value ? new File([result.value.blob], result.value.fileName, { type: result.value.mime }) : null))
const canShare = computed(() => {
  if (!resultFile.value || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [resultFile.value] })
  } catch {
    return false
  }
})
const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

async function share() {
  if (!resultFile.value) return
  try {
    await navigator.share({ files: [resultFile.value] })
  } catch (e) {
    if ((e as Error).name !== 'AbortError') push(t('export.shareFailed'), 'error')
  }
}
</script>

<template>
  <UiDialog
    v-model:open="ui.exportOpen"
    :title="state === 'done' ? t('export.success') : state === 'error' ? t('export.title') : t('export.rendering')"
    :description="state === 'running' ? t('export.renderingHint') : state === 'done' ? t('export.successHint') : undefined"
    size="sm"
  >
    <div
      data-testid="export-dialog"
      :data-state="state"
    >
      <div
        v-if="state === 'running'"
        class="py-2"
      >
        <div class="h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            ref="bar"
            class="h-full origin-left rounded-full bg-accent"
            style="transform: scaleX(0.02)"
          />
        </div>
        <p
          class="mt-3 text-sm text-ink-2"
          aria-live="polite"
        >
          {{ stageText }}
        </p>
      </div>

      <div
        v-else-if="state === 'done' && result"
        class="space-y-4"
      >
        <div class="canvas-dots relative flex items-center justify-center overflow-hidden rounded-lg border border-line p-5">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt=""
            class="max-h-64 w-auto shadow-poster"
            data-testid="export-preview"
          >
          <FileText
            v-else
            class="size-16 text-ink-3"
          />
          <span
            ref="check"
            class="absolute right-3 top-3 flex size-9 -rotate-12 items-center justify-center rounded-full border-[1.5px] border-ink bg-accent text-accent-ink shadow-hard"
          >
            <CircleCheck class="size-5" />
          </span>
        </div>
        <div class="text-sm">
          <p
            class="truncate font-medium text-ink"
            data-testid="export-filename"
          >
            {{ result.fileName }}
          </p>
          <p
            class="text-ink-3"
            data-testid="export-info"
          >
            {{ t('export.fileInfo', { size: formatBytes(result.blob.size, intlLocale), w: result.width, h: result.height }) }}
            · {{ Math.round(result.dpi) }} DPI
          </p>
        </div>
        <p
          v-if="result.warnings.length"
          class="flex gap-2 rounded-lg border border-dashed border-warn px-3 py-2 text-xs text-warn"
        >
          <TriangleAlert class="size-4 shrink-0" />
          {{ t('export.warnings') }}
        </p>
      </div>

      <div
        v-else
        class="flex gap-3 rounded-lg border-[1.5px] border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
        role="alert"
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0" />
        {{ t(`export.errors.${errorCode}`) }}
      </div>
    </div>

    <template #footer>
      <UiButton
        v-if="state === 'running'"
        variant="ghost"
        @click="ui.exportOpen = false"
      >
        {{ t('export.cancel') }}
      </UiButton>
      <template v-else-if="state === 'done'">
        <UiButton
          variant="ghost"
          class="max-sm:hidden"
          @click="ui.exportOpen = false"
        >
          {{ t('export.exportAnother') }}
        </UiButton>
        <UiButton
          :variant="canShare && touch ? 'secondary' : 'primary'"
          class="max-sm:flex-1"
          :class="canShare && touch ? '' : 'order-last'"
          @click="again"
        >
          <Download class="size-4" />
          {{ t('export.again') }}
        </UiButton>
        <UiButton
          v-if="canShare"
          :variant="touch ? 'primary' : 'secondary'"
          class="max-sm:flex-1"
          data-testid="export-share"
          @click="share"
        >
          <Share2 class="size-4" />
          {{ t('export.share') }}
        </UiButton>
      </template>
      <UiButton
        v-else
        variant="secondary"
        @click="ui.exportOpen = false"
      >
        {{ t('common.close') }}
      </UiButton>
    </template>
  </UiDialog>
</template>
