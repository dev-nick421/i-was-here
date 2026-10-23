<script setup lang="ts">
import { Download, FileImage, FileText, Image as ImageIcon, RectangleHorizontal, RectangleVertical } from '@lucide/vue'
import { CUSTOM_SIZE_LIMITS, formatPaperSize, outputPixels, PAPER_FORMATS, printQuality, RESOLUTIONS } from '~/core/formats'
import type { FileType, Orientation } from '~/core/types'

const store = usePosterStore()
const ui = useUiStore()
const { t, intlLocale } = useI18n()

const out = computed(() => store.style.output)
const paper = computed(() => PAPER_FORMATS.find(p => p.id === out.value.paper))
const isSquare = computed(() => paper.value?.group === 'square')

const orientationOptions = computed(() => [
  { value: 'portrait' as Orientation, label: t('export.portrait'), icon: RectangleVertical },
  { value: 'landscape' as Orientation, label: t('export.landscape'), icon: RectangleHorizontal },
])

const fileOptions = computed(() => [
  { value: 'png' as FileType, label: 'PNG', icon: ImageIcon },
  { value: 'jpeg' as FileType, label: 'JPEG', icon: FileImage },
  { value: 'pdf' as FileType, label: 'PDF', icon: FileText },
])

const groups = computed(() => [
  { id: 'poster', items: PAPER_FORMATS.filter(p => p.group === 'poster') },
  { id: 'iso', items: PAPER_FORMATS.filter(p => p.group === 'iso') },
  { id: 'square', items: PAPER_FORMATS.filter(p => p.group === 'square' || p.group === 'custom') },
])

const resolutions = computed(() =>
  RESOLUTIONS.map((r) => {
    const px = outputPixels({ ...out.value, resolution: r.id })
    return { ...r, px, quality: printQuality(px.dpi) }
  }),
)

const qualityDot = { excellent: 'bg-emerald-500', good: 'bg-emerald-400', fair: 'bg-amber-400', low: 'bg-rose-500' } as const
const sizeText = computed(() => formatPaperSize(out.value, intlLocale.value))
const current = computed(() => resolutions.value.find(r => r.id === out.value.resolution)!)

function setCustom(key: 'customWidthCm' | 'customHeightCm', e: Event) {
  const n = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(n)) out.value[key] = Math.min(CUSTOM_SIZE_LIMITS.max, Math.max(CUSTOM_SIZE_LIMITS.min, n))
}
</script>

<template>
  <div>
    <UiSection :title="t('export.paper')">
      <div
        class="space-y-2"
        role="radiogroup"
        :aria-label="t('export.paper')"
        data-testid="papers"
      >
        <div
          v-for="g in groups"
          :key="g.id"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="p in g.items"
            :key="p.id"
            type="button"
            role="radio"
            :aria-checked="out.paper === p.id"
            :data-paper="p.id"
            class="tile h-9 px-3 font-mono text-[12px] tabular-nums"
            :class="out.paper === p.id ? 'tile-active text-ink' : 'text-ink-2 hover:text-ink'"
            @click="out.paper = p.id"
          >
            {{ p.id === 'custom' ? t('export.custom') : p.label }}
          </button>
        </div>
      </div>

      <div
        v-if="out.paper === 'custom'"
        class="mt-3 grid grid-cols-2 gap-2"
      >
        <label class="text-xs font-medium text-ink-2">
          {{ t('export.width') }} (cm)
          <input
            type="number"
            class="field mt-1.5 tabular-nums"
            :min="CUSTOM_SIZE_LIMITS.min"
            :max="CUSTOM_SIZE_LIMITS.max"
            step="0.5"
            :value="out.customWidthCm"
            @change="setCustom('customWidthCm', $event)"
          >
        </label>
        <label class="text-xs font-medium text-ink-2">
          {{ t('export.height') }} (cm)
          <input
            type="number"
            class="field mt-1.5 tabular-nums"
            :min="CUSTOM_SIZE_LIMITS.min"
            :max="CUSTOM_SIZE_LIMITS.max"
            step="0.5"
            :value="out.customHeightCm"
            @change="setCustom('customHeightCm', $event)"
          >
        </label>
      </div>
      <div
        v-else-if="!isSquare"
        class="mt-3"
      >
        <UiSegmented
          v-model="out.orientation"
          :options="orientationOptions"
          :label="t('export.orientation')"
        />
      </div>
    </UiSection>

    <UiSection :title="t('export.resolution')">
      <div
        class="space-y-1.5"
        role="radiogroup"
        :aria-label="t('export.resolution')"
        data-testid="resolutions"
      >
        <button
          v-for="r in resolutions"
          :key="r.id"
          type="button"
          role="radio"
          :aria-checked="out.resolution === r.id"
          :data-resolution="r.id"
          class="tile flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
          :class="out.resolution === r.id ? 'tile-active' : ''"
          @click="out.resolution = r.id"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-ink">{{ r.label }}</span>
            <span class="block font-mono text-[11px] tabular-nums text-ink-3">{{ t('export.pixels', { w: r.px.width, h: r.px.height }) }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums text-ink-2">
            <span
              class="size-2 rounded-full border border-ink"
              :class="qualityDot[r.quality]"
            />
            {{ Math.round(r.px.dpi) }} DPI
          </span>
        </button>
      </div>
      <p class="mt-3 rounded-lg border border-dashed border-line-strong px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
        <span class="font-medium text-ink">{{ t(`export.quality_${current.quality}`) }}</span>
        · {{ t('export.dpiAt', { dpi: Math.round(current.px.dpi), size: sizeText }) }}
      </p>
    </UiSection>

    <UiSection :title="t('export.fileType')">
      <UiSegmented
        v-model="out.fileType"
        :options="fileOptions"
        :label="t('export.fileType')"
      />
      <p class="mt-2 text-xs leading-relaxed text-ink-3">
        {{ t(`export.fileHints.${out.fileType}`) }}
      </p>
      <UiSlider
        v-if="out.fileType === 'jpeg'"
        v-model="out.jpegQuality"
        class="mt-3"
        :label="t('export.quality')"
        :min="0.5"
        :max="1"
        :step="0.01"
        :format="v => `${Math.round(v * 100)}%`"
      />
    </UiSection>

    <UiSection>
      <UiButton
        variant="primary"
        size="lg"
        block
        data-testid="export-button"
        @click="ui.exportOpen = true"
      >
        <Download class="size-4" />
        {{ t('export.button') }}
      </UiButton>
      <p class="mt-3 text-xs leading-relaxed text-ink-3">
        {{ t('export.printTip') }}
      </p>
    </UiSection>
  </div>
</template>
