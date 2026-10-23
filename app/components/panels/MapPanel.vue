<script setup lang="ts">
import { formatPaperSize } from '~/core/formats'
import { formatScale } from '~/core/geo'
import type { DetailLevel, RoadDensity } from '~/core/types'

const store = usePosterStore()
const { t, intlLocale } = useI18n()
const { isDesktop } = useBreakpoint()

const zoom = computed({
  get: () => Math.round(store.content.view.zoom * 100) / 100,
  set: v => store.requestCamera({ zoom: v }, false),
})

const bearing = computed({
  get: () => Math.round(store.content.view.bearing),
  set: v => store.requestCamera({ bearing: v }, false),
})

const detailOptions = computed(() => (['low', 'medium', 'high'] as DetailLevel[]).map(v => ({ value: v, label: t(`map.details.${v}`) })))
const roadOptions = computed(() => (['major', 'standard', 'all'] as RoadDensity[]).map(v => ({ value: v, label: t(`map.roadOptions.${v}`) })))

const scaleText = computed(() => formatScale(store.scale, intlLocale.value))
const paperText = computed(() => formatPaperSize(store.style.output, intlLocale.value))
const nf = computed(() => new Intl.NumberFormat(intlLocale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
</script>

<template>
  <div>
    <UiSection v-if="!isDesktop">
      <EditorLocationSearch compact />
    </UiSection>

    <UiSection :title="t('map.view')">
      <div class="mb-3 flex items-baseline justify-between rounded-lg border border-dashed border-line-strong px-3.5 py-2.5">
        <span class="text-sm text-ink-2">{{ t('map.scale') }}</span>
        <span
          class="font-mono text-sm tabular-nums text-ink"
          data-testid="scale"
        >~{{ scaleText }}</span>
      </div>
      <p class="-mt-1 mb-3 text-xs text-ink-3">
        {{ t('map.scaleHint', { size: paperText }) }}
      </p>
      <UiSlider
        v-model="zoom"
        :label="t('map.zoom')"
        :min="1"
        :max="18"
        :step="0.05"
        :format="v => nf.format(v)"
      />
      <UiSlider
        v-model="bearing"
        :label="t('map.rotation')"
        :min="-180"
        :max="180"
        :step="1"
        :reset-value="0"
        :format="v => `${v}°`"
      />
      <p class="mt-2 text-xs leading-relaxed text-ink-3">
        {{ t('map.dragHint') }}
      </p>
    </UiSection>

    <UiSection
      :title="t('map.detail')"
      :hint="t('map.detailHint')"
    >
      <UiSegmented
        v-model="store.style.map.detail"
        :options="detailOptions"
        :label="t('map.detail')"
      />
    </UiSection>

    <UiSection :title="t('map.roads')">
      <UiSegmented
        v-model="store.style.map.roads"
        :options="roadOptions"
        :label="t('map.roads')"
      />
      <div class="mt-3">
        <UiSlider
          v-model="store.style.map.lineWidth"
          :label="t('map.lineWidth')"
          :min="0.4"
          :max="2.5"
          :step="0.05"
          :reset-value="1"
          :format="v => `${nf.format(v)}×`"
        />
      </div>
    </UiSection>

    <UiSection :title="t('map.layers')">
      <UiSwitch
        v-model="store.style.map.buildings"
        :label="t('map.buildings')"
      />
      <UiSwitch
        v-model="store.style.map.parks"
        :label="t('map.parks')"
      />
      <UiSwitch
        v-model="store.style.map.water"
        :label="t('map.water')"
      />
      <UiSwitch
        v-model="store.style.map.rail"
        :label="t('map.rail')"
      />
      <UiSwitch
        v-model="store.style.map.labels"
        :label="t('map.labels')"
      />
    </UiSection>
  </div>
</template>
