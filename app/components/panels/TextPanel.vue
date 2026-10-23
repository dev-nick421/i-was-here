<script setup lang="ts">
import { Eye, EyeOff, Pencil, RotateCcw } from '@lucide/vue'
import { FONT_PRESETS, getFontPreset } from '~/core/fonts'
import { formatCoordinates } from '~/core/geo'
import type { CoordFormat, TextSize } from '~/core/types'

const store = usePosterStore()
const { t, intlLocale } = useI18n()

const text = computed(() => store.content.text)
const preset = computed(() => getFontPreset(store.style.typography.font))
/** The typeface tiles preview the poster's own title. */
const sample = computed(() => (text.value.title.trim() || 'Hamburg').slice(0, 14))
const sizeOptions = computed(() => (['s', 'm', 'l'] as TextSize[]).map(v => ({ value: v, label: t(`text.sizes.${v}`) })))
const formatOptions = computed(() => (['dms', 'dm', 'decimal'] as CoordFormat[]).map(v => ({ value: v, label: t(`text.coordsFormats.${v}`) })))

const autoCoords = computed(() => {
  const p = store.content.view
  return formatCoordinates(p.lat, p.lng, store.style.typography.coordFormat, intlLocale.value)
})

function editCoords() {
  text.value.coordsCustom = text.value.coordsCustom || autoCoords.value
  text.value.coordsMode = 'custom'
}
</script>

<template>
  <div>
    <UiSection :title="t('text.yourMoment')">
      <p
        v-if="store.style.layout === 'mapOnly'"
        class="mb-3 rounded-lg border border-dashed border-warn px-3 py-2 text-xs text-warn"
      >
        {{ t('text.noTextLayout') }}
      </p>
      <div class="space-y-3">
        <div>
          <label
            class="mb-1.5 block text-xs font-medium text-ink-2"
            for="poster-title"
          >{{ t('text.titleLabel') }}</label>
          <div class="flex gap-1.5">
            <input
              id="poster-title"
              v-model="text.title"
              class="field"
              :class="text.showTitle ? '' : 'opacity-50'"
              :placeholder="t('text.titlePlaceholder')"
              maxlength="200"
              enterkeyhint="done"
              data-testid="title-input"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >
            <UiIconButton
              :label="text.showTitle ? t('text.hide') : t('text.show')"
              :active="!text.showTitle"
              @click="text.showTitle = !text.showTitle"
            >
              <Eye
                v-if="text.showTitle"
                class="size-4"
              />
              <EyeOff
                v-else
                class="size-4"
              />
            </UiIconButton>
          </div>
        </div>
        <div>
          <label
            class="mb-1.5 block text-xs font-medium text-ink-2"
            for="poster-subtitle"
          >{{ t('text.subtitleLabel') }}</label>
          <div class="flex gap-1.5">
            <input
              id="poster-subtitle"
              v-model="text.subtitle"
              class="field"
              :class="text.showSubtitle ? '' : 'opacity-50'"
              :placeholder="t('text.subtitlePlaceholder')"
              maxlength="200"
              enterkeyhint="done"
              data-testid="subtitle-input"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >
            <UiIconButton
              :label="text.showSubtitle ? t('text.hide') : t('text.show')"
              :active="!text.showSubtitle"
              @click="text.showSubtitle = !text.showSubtitle"
            >
              <Eye
                v-if="text.showSubtitle"
                class="size-4"
              />
              <EyeOff
                v-else
                class="size-4"
              />
            </UiIconButton>
          </div>
        </div>
        <div>
          <label
            class="mb-1.5 block text-xs font-medium text-ink-2"
            for="poster-coords"
          >{{ t('text.coordsLabel') }}</label>
          <div class="flex gap-1.5">
            <input
              v-if="text.coordsMode === 'custom'"
              id="poster-coords"
              v-model="text.coordsCustom"
              class="field"
              :class="text.showCoords ? '' : 'opacity-50'"
              maxlength="200"
            >
            <input
              v-else
              id="poster-coords"
              :value="autoCoords"
              readonly
              class="field cursor-default bg-surface-2 font-mono text-[13px] text-ink-2 pointer-coarse:text-sm"
              :class="text.showCoords ? '' : 'opacity-50'"
            >
            <UiIconButton
              v-if="text.coordsMode === 'auto'"
              :label="t('text.coordsEdit')"
              @click="editCoords"
            >
              <Pencil class="size-4" />
            </UiIconButton>
            <UiIconButton
              v-else
              :label="t('text.coordsBackToAuto')"
              @click="text.coordsMode = 'auto'"
            >
              <RotateCcw class="size-4" />
            </UiIconButton>
            <UiIconButton
              :label="text.showCoords ? t('text.hide') : t('text.show')"
              :active="!text.showCoords"
              @click="text.showCoords = !text.showCoords"
            >
              <Eye
                v-if="text.showCoords"
                class="size-4"
              />
              <EyeOff
                v-else
                class="size-4"
              />
            </UiIconButton>
          </div>
          <p
            v-if="text.coordsMode === 'auto'"
            class="mt-1.5 text-xs leading-relaxed text-ink-3"
          >
            {{ t('text.coordsAuto') }}
          </p>
        </div>
        <div v-if="text.coordsMode === 'auto'">
          <span class="mb-1.5 block text-xs font-medium text-ink-2">{{ t('text.coordsFormat') }}</span>
          <UiSegmented
            v-model="store.style.typography.coordFormat"
            :options="formatOptions"
            :label="t('text.coordsFormat')"
            size="sm"
          />
        </div>
      </div>
    </UiSection>

    <UiSection :title="t('text.fontSize')">
      <UiSegmented
        v-model="store.style.typography.size"
        :options="sizeOptions"
        :label="t('text.fontSize')"
      />
    </UiSection>

    <UiSection :title="t('text.font')">
      <div
        class="grid grid-cols-2 gap-1.5"
        role="radiogroup"
        :aria-label="t('text.font')"
        data-testid="fonts"
      >
        <button
          v-for="f in FONT_PRESETS"
          :key="f.id"
          type="button"
          role="radio"
          :aria-checked="store.style.typography.font === f.id"
          :data-font="f.id"
          class="tile flex h-[4.25rem] flex-col items-start justify-center gap-1 px-3 text-left"
          :class="store.style.typography.font === f.id ? 'tile-active' : ''"
          @click="store.style.typography.font = f.id"
        >
          <span
            class="block max-w-full truncate text-[17px] leading-tight text-ink"
            :style="{ fontFamily: `'${f.title.family}'`, fontWeight: f.title.weight, letterSpacing: `${f.title.letterSpacing * 0.6}em` }"
          >{{ f.title.allowUppercase && store.style.typography.uppercase ? sample.toLocaleUpperCase() : sample }}</span>
          <span class="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-3">{{ f.name }}</span>
        </button>
      </div>
      <div class="mt-3">
        <UiSwitch
          v-model="store.style.typography.uppercase"
          :label="t('text.uppercase')"
          :hint="preset.title.allowUppercase ? undefined : t('text.uppercaseScript')"
          :disabled="!preset.title.allowUppercase"
        />
      </div>
    </UiSection>

    <UiSection>
      <UiSwitch
        v-model="store.style.attribution"
        :label="t('text.attribution')"
        :hint="t('text.attributionHint')"
      />
    </UiSection>
  </div>
</template>
