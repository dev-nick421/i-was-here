<script setup lang="ts">
import { ChevronDown, RotateCcw } from '@lucide/vue'
import gsap from 'gsap'
import { LAYOUT_IDS } from '~/core/scene'
import { DEFAULT_THEME_ID, getTheme, LAYOUT_COLOR_KEYS, MAP_COLOR_KEYS, THEMES } from '~/core/themes'
import type { FrameId, ThemeColors } from '~/core/types'

const store = usePosterStore()
const { t } = useI18n()

const aspect = computed(() => store.units.height / store.units.width)

/** Layout previews use neutral colors so the composition reads clearly with any theme. */
const NEUTRAL: ThemeColors = {
  land: '#efe9dd',
  water: '#cfdcdc',
  roads: '#a49b8a',
  buildings: '#e4ddcf',
  parks: '#e1e4d2',
  paper: '#fbf9f4',
  textBox: '#fbf9f4',
  text: '#1b1915',
  frame: '#1b1915',
}
const FRAMES: FrameId[] = ['none', 'margin', 'line', 'double']

const showCustom = ref(store.style.themeId === 'custom')
const customBox = ref<HTMLElement>()
/** Last preset that was picked, to offer "back to …" after editing colors. */
const lastTheme = ref(store.style.themeId === 'custom' ? DEFAULT_THEME_ID : store.style.themeId)

watch(() => store.style.themeId, (id) => {
  if (id !== 'custom') lastTheme.value = id
})

function pickTheme(id: string, e: MouseEvent) {
  store.setTheme(id)
  const el = e.currentTarget as HTMLElement
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.fromTo(el, { rotate: -4, scale: 0.94 }, { rotate: 0, scale: 1, duration: 0.45, ease: 'back.out(2.5)', clearProps: 'transform' })
  }
}

async function toggleCustom() {
  showCustom.value = !showCustom.value
  await nextTick()
  if (showCustom.value && customBox.value) {
    gsap.fromTo(customBox.value, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.35, ease: 'power2.out' })
  }
}

function setColor(key: keyof ThemeColors, value: string) {
  store.setColor(key, value)
}
</script>

<template>
  <div>
    <UiSection :title="t('style.layout')">
      <div
        class="grid grid-cols-4 gap-2"
        role="radiogroup"
        :aria-label="t('style.layout')"
        data-testid="layouts"
      >
        <button
          v-for="id in LAYOUT_IDS"
          :key="id"
          type="button"
          role="radio"
          :aria-checked="store.style.layout === id"
          :data-layout="id"
          class="tile flex flex-col items-center gap-1.5 p-1.5"
          :class="store.style.layout === id ? 'tile-active' : ''"
          @click="store.style.layout = id"
        >
          <span
            class="flex w-full items-center justify-center overflow-hidden rounded-[3px] border border-line"
            :style="{ aspectRatio: `1 / ${Math.min(1.5, aspect)}` }"
          >
            <StyleLayoutThumb
              :layout="id"
              :frame="store.style.frame"
              :colors="NEUTRAL"
              :typography="store.style.typography"
              :aspect="aspect"
            />
          </span>
          <span
            class="max-w-full truncate font-mono text-[9.5px] uppercase tracking-[0.08em]"
            :class="store.style.layout === id ? 'text-ink' : 'text-ink-3'"
          >
            {{ t(`style.layouts.${id}`) }}
          </span>
        </button>
      </div>
    </UiSection>

    <UiSection :title="t('style.frame')">
      <div
        class="grid grid-cols-4 gap-2"
        role="radiogroup"
        :aria-label="t('style.frame')"
      >
        <button
          v-for="f in FRAMES"
          :key="f"
          type="button"
          role="radio"
          :aria-checked="store.style.frame === f"
          :aria-label="t(`style.frames.${f}`)"
          :data-frame="f"
          class="tile flex flex-col items-center gap-1.5 px-1 pb-1.5 pt-2"
          :class="store.style.frame === f ? 'tile-active' : ''"
          @click="store.style.frame = f"
        >
          <svg
            viewBox="0 0 30 38"
            class="h-9 w-auto"
            aria-hidden="true"
          >
            <rect
              x="0.5"
              y="0.5"
              width="29"
              height="37"
              rx="1"
              fill="var(--surface-2)"
              stroke="var(--line-strong)"
            />
            <rect
              v-bind="f === 'none' ? { x: 0.5, y: 0.5, width: 29, height: 37 } : { x: 5, y: 5, width: 20, height: 28 }"
              fill="var(--line-strong)"
              opacity="0.55"
            />
            <rect
              v-if="f === 'line' || f === 'double'"
              x="3"
              y="3"
              width="24"
              height="32"
              fill="none"
              stroke="var(--ink)"
              stroke-width="0.8"
            />
            <rect
              v-if="f === 'double'"
              x="1.6"
              y="1.6"
              width="26.8"
              height="34.8"
              fill="none"
              stroke="var(--ink)"
              stroke-width="1.2"
            />
          </svg>
          <span
            class="max-w-full truncate font-mono text-[9px] uppercase tracking-[0.06em]"
            :class="store.style.frame === f ? 'text-ink' : 'text-ink-3'"
          >{{ t(`style.frames.${f}`) }}</span>
        </button>
      </div>
    </UiSection>

    <UiSection :title="t('style.colors')">
      <div
        class="grid grid-cols-3 gap-2"
        role="radiogroup"
        :aria-label="t('style.colors')"
        data-testid="themes"
      >
        <button
          v-for="theme in THEMES"
          :key="theme.id"
          type="button"
          role="radio"
          :aria-checked="store.style.themeId === theme.id"
          :aria-label="theme.name"
          :title="theme.name"
          :data-theme="theme.id"
          class="tile p-[3px]"
          :class="store.style.themeId === theme.id ? 'tile-active' : ''"
          @click="pickTheme(theme.id, $event)"
        >
          <StyleThemeChip
            :colors="theme.colors"
            :name="theme.name"
          />
        </button>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <UiButton
          size="sm"
          :variant="showCustom ? 'soft' : 'secondary'"
          :aria-expanded="showCustom"
          @click="toggleCustom"
        >
          {{ t('style.customColors') }}
          <ChevronDown
            class="size-3.5 transition-transform"
            :class="showCustom ? 'rotate-180' : ''"
          />
        </UiButton>
        <UiButton
          v-if="store.style.themeId === 'custom'"
          size="sm"
          variant="ghost"
          @click="store.setTheme(lastTheme)"
        >
          <RotateCcw class="size-3.5" />
          {{ t('style.resetColors', { theme: getTheme(lastTheme)?.name ?? '' }) }}
        </UiButton>
      </div>

      <div
        v-if="showCustom"
        ref="customBox"
        class="overflow-hidden"
        data-testid="custom-colors"
      >
        <h4 class="section-label mt-5 mb-1">
          {{ t('style.mapColors') }}
        </h4>
        <UiColorField
          v-for="key in MAP_COLOR_KEYS"
          :key="key"
          :model-value="store.style.colors[key]"
          :label="t(`style.colorNames.${key}`)"
          :data-color="key"
          @update:model-value="setColor(key, $event)"
        />
        <h4 class="section-label mt-5 mb-1">
          {{ t('style.layoutColors') }}
        </h4>
        <UiColorField
          v-for="key in LAYOUT_COLOR_KEYS"
          :key="key"
          :model-value="store.style.colors[key]"
          :label="t(`style.colorNames.${key}`)"
          :data-color="key"
          @update:model-value="setColor(key, $event)"
        />
      </div>
    </UiSection>
  </div>
</template>
