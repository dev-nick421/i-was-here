<script setup lang="ts">
import { Compass, Minus, Plus, Redo2, Undo2, WifiOff } from '@lucide/vue'
import { formatPaperSize, printQuality } from '~/core/formats'

const store = usePosterStore()
const ui = useUiStore()
const { t, intlLocale } = useI18n()
const config = useRuntimeConfig()

const stage = ref<HTMLElement>()
const available = reactive({ width: 0, height: 0 })
const { isDesktop } = useBreakpoint()
const { online } = usePwa()

let observer: ResizeObserver | null = null
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    // contentRect excludes the stage padding, which keeps room for the info line and zoom bar.
    available.width = entry.contentRect.width
    available.height = entry.contentRect.height
  })
  observer.observe(stage.value!)
})
onBeforeUnmount(() => observer?.disconnect())

/** CSS pixels per layout unit so the poster fits the stage. */
const unit = computed(() => {
  const w = Math.max(80, available.width)
  const h = Math.max(80, available.height)
  return Math.max(0.05, Math.min(w / store.units.width, h / store.units.height))
})

const paperText = computed(() => formatPaperSize(store.style.output, intlLocale.value))
const quality = computed(() => printQuality(store.pixels.dpi))
const rotated = computed(() => Math.abs(store.content.view.bearing) > 0.05)

/** Room around the poster for the chips on top and the controls (below, or at the sides on phones). */
const padding = computed(() => (isDesktop.value ? '64px 48px 92px' : '46px 58px 16px'))
/** How much of the print details and credits fit next to each other above the poster. */
const showPixels = computed(() => available.width > 600)
const creditsShown = computed(() => (available.width > 820 ? 3 : available.width > 520 ? 2 : 1))
/** Phones with the sheet pulled all the way up: only a strip of the poster is left, without controls. */
const compact = computed(() => !isDesktop.value && available.height > 0 && available.height < 110)

function zoom(delta: number) {
  store.zoomBy(delta)
}
</script>

<template>
  <div class="canvas-dots relative flex min-h-0 min-w-0 flex-1 flex-col">
    <!-- Print details: paper, pixels, DPI -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3"
      :class="isDesktop ? 'px-5 pt-4' : 'px-3 pt-2.5'"
    >
      <div class="flex min-w-0 items-center gap-2">
        <button
          type="button"
          class="chip pointer-events-auto min-w-0 whitespace-nowrap rounded-full border border-line-strong bg-surface px-3 py-1.5 transition-colors hover:border-ink hover:text-ink"
          data-testid="poster-info"
          @click="ui.openTab('export')"
        >
          <span>{{ paperText }}</span>
          <template v-if="showPixels">
            <span class="text-ink-3">/</span>
            <span>{{ store.pixels.width }} × {{ store.pixels.height }} px</span>
          </template>
          <span class="text-ink-3">/</span>
          <span
            class="size-2 shrink-0 rounded-full border border-ink"
            :class="{ excellent: 'bg-emerald-500', good: 'bg-emerald-300', fair: 'bg-amber-400', low: 'bg-rose-500' }[quality]"
          />
          {{ Math.round(store.pixels.dpi) }} DPI
        </button>
        <span
          v-if="!online"
          class="chip shrink-0 rounded-full border-[1.5px] border-ink bg-warn-soft px-2.5 py-1.5 text-warn"
          role="status"
          data-testid="offline-badge"
        >
          <WifiOff class="size-3.5" />
          <span :class="isDesktop ? '' : 'sr-only'">{{ t('pwa.offlineShort') }}</span>
        </span>
      </div>
      <p class="chip pointer-events-auto mt-1.5 shrink-0 gap-2 whitespace-nowrap text-[10px] text-ink-3">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener"
          class="hover:text-ink"
        >© OpenStreetMap</a>
        <a
          v-if="creditsShown >= 2"
          href="https://openmaptiles.org/"
          target="_blank"
          rel="noopener"
          class="hover:text-ink"
        >© OpenMapTiles</a>
        <a
          v-if="creditsShown >= 3"
          :href="config.public.map.providerUrl as string"
          target="_blank"
          rel="noopener"
          class="hover:text-ink"
        >{{ config.public.map.providerName }}</a>
      </p>
    </div>

    <div
      ref="stage"
      class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      :style="{ padding }"
    >
      <PosterPreview
        v-if="available.width > 0"
        :unit="unit"
      />
    </div>

    <!-- Phones: undo/redo at the left edge, zoom at the right one (where thumbs are) -->
    <div
      v-if="!isDesktop"
      v-show="!compact"
      class="absolute left-2 top-[calc(50%_+_15px)] z-10 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-full border-[1.5px] border-ink bg-surface p-0.5 shadow-hard"
      role="toolbar"
      aria-orientation="vertical"
      :aria-label="`${t('common.undo')} / ${t('common.redo')}`"
    >
      <UiIconButton
        :label="t('common.undo')"
        :disabled="!store.canUndo"
        data-testid="undo-mobile"
        @click="store.undo()"
      >
        <Undo2 class="size-[18px]" />
      </UiIconButton>
      <UiIconButton
        :label="t('common.redo')"
        :disabled="!store.canRedo"
        @click="store.redo()"
      >
        <Redo2 class="size-[18px]" />
      </UiIconButton>
    </div>
    <div
      v-if="!isDesktop"
      v-show="!compact"
      class="absolute right-2 top-[calc(50%_+_15px)] z-10 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-full border-[1.5px] border-ink bg-surface p-0.5 shadow-hard"
      role="toolbar"
      aria-orientation="vertical"
      :aria-label="t('map.zoom')"
    >
      <UiIconButton
        :label="t('map.zoomIn')"
        data-testid="zoom-in"
        @click="zoom(0.5)"
      >
        <Plus class="size-[18px]" />
      </UiIconButton>
      <UiIconButton
        :label="t('map.zoomOut')"
        data-testid="zoom-out"
        @click="zoom(-0.5)"
      >
        <Minus class="size-[18px]" />
      </UiIconButton>
      <UiIconButton
        v-if="rotated"
        :label="t('map.resetRotation')"
        @click="store.requestCamera({ bearing: 0 })"
      >
        <Compass
          class="size-[18px]"
          :style="{ transform: `rotate(${-store.content.view.bearing}deg)` }"
        />
      </UiIconButton>
    </div>

    <!-- Desktop: map zoom bar with fine steps -->
    <div
      v-else
      class="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border-[1.5px] border-ink bg-surface p-1 shadow-hard"
      role="toolbar"
      :aria-label="t('map.zoom')"
    >
      <UiIconButton
        :label="`${t('map.zoomOut')} (−)`"
        size="sm"
        data-testid="zoom-out"
        @click="zoom(-0.5)"
      >
        <Minus class="size-4" />
      </UiIconButton>
      <UiIconButton
        :label="t('map.zoomOutFine')"
        size="sm"
        class="font-mono text-[11px]"
        @click="zoom(-0.1)"
      >
        −.1
      </UiIconButton>
      <span class="mx-1 h-5 w-px bg-line-strong" />
      <UiIconButton
        :label="t('map.zoomInFine')"
        size="sm"
        class="font-mono text-[11px]"
        @click="zoom(0.1)"
      >
        +.1
      </UiIconButton>
      <UiIconButton
        :label="`${t('map.zoomIn')} (+)`"
        size="sm"
        data-testid="zoom-in"
        @click="zoom(0.5)"
      >
        <Plus class="size-4" />
      </UiIconButton>
      <template v-if="rotated">
        <span class="mx-1 h-5 w-px bg-line-strong" />
        <UiIconButton
          :label="t('map.resetRotation')"
          size="sm"
          @click="store.requestCamera({ bearing: 0 })"
        >
          <Compass
            class="size-4"
            :style="{ transform: `rotate(${-store.content.view.bearing}deg)` }"
          />
        </UiIconButton>
      </template>
    </div>
  </div>
</template>
