<script setup lang="ts">
import { MapPin, Palette, Printer, Type } from '@lucide/vue'
import type { Component } from 'vue'
import { TABS, type TabId } from '~/stores/ui'

/** Tabs of the inspector: a pill bar on top (desktop) or a bottom bar (phones). */
const props = defineProps<{ placement: 'top' | 'bottom' }>()

const ui = useUiStore()
const { t } = useI18n()

const ICONS: Record<TabId, Component> = { map: MapPin, style: Palette, text: Type, export: Printer }

function select(id: TabId) {
  if (props.placement === 'bottom' && ui.tab === id) ui.sheetOpen = !ui.sheetOpen
  else ui.openTab(id)
}

function onKey(e: KeyboardEvent, i: number) {
  const dir = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0
  if (!dir) return
  e.preventDefault()
  const next = TABS[(i + dir + TABS.length) % TABS.length]!
  ui.openTab(next)
  nextTick(() => document.getElementById(`tab-${next}`)?.focus())
}
</script>

<template>
  <nav
    role="tablist"
    aria-orientation="horizontal"
    :aria-label="t('app.name')"
    :class="placement === 'top'
      ? 'grid grid-cols-4 gap-0.5 rounded-full border border-line bg-surface-2 p-[3px]'
      : 'grid grid-cols-4 border-t border-line bg-surface px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5'"
  >
    <button
      v-for="(id, i) in TABS"
      :id="`tab-${id}`"
      :key="id"
      type="button"
      role="tab"
      :aria-selected="ui.tab === id"
      :aria-controls="`panel-${id}`"
      :tabindex="ui.tab === id ? 0 : -1"
      :data-tab="id"
      class="group flex items-center justify-center font-medium transition-colors duration-150"
      :class="placement === 'top'
        ? ['h-9 gap-1.5 rounded-full text-[13px]', ui.tab === id ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-surface-3 hover:text-ink']
        : ['h-13 flex-col gap-1 text-[11px]', ui.tab === id ? 'text-ink' : 'text-ink-3']"
      @click="select(id)"
      @keydown="onKey($event, i)"
    >
      <span
        v-if="placement === 'bottom'"
        class="flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200"
        :class="ui.tab === id ? 'bg-ink text-surface' : 'group-hover:bg-surface-3'"
      >
        <component
          :is="ICONS[id]"
          class="size-[17px]"
        />
      </span>
      <component
        :is="ICONS[id]"
        v-else
        class="size-[15px]"
      />
      {{ t(`tabs.${id}`) }}
    </button>
  </nav>
</template>
