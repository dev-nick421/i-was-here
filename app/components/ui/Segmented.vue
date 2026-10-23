<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

const props = defineProps<{
  options: { value: T, label: string, icon?: Component, title?: string }[]
  label: string
  size?: 'sm' | 'md'
}>()

const model = defineModel<T>({ required: true })
const buttons = ref<HTMLButtonElement[]>([])

function onKey(e: KeyboardEvent, index: number) {
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!dir) return
  e.preventDefault()
  const next = (index + dir + props.options.length) % props.options.length
  model.value = props.options[next]!.value
  buttons.value[next]?.focus()
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="grid gap-0.5 rounded-full border border-line bg-surface-2 p-[3px]"
    :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }"
  >
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      ref="buttons"
      type="button"
      role="radio"
      :aria-checked="model === opt.value"
      :tabindex="model === opt.value ? 0 : -1"
      :title="opt.title ?? opt.label"
      class="flex min-w-0 items-center justify-center gap-1.5 truncate rounded-full font-medium transition-[background-color,color] duration-150"
      :class="[
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-[13px]',
        model === opt.value ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
      ]"
      @click="model = opt.value"
      @keydown="onKey($event, i)"
    >
      <component
        :is="opt.icon"
        v-if="opt.icon"
        class="size-4 shrink-0"
        aria-hidden="true"
      />
      <span class="truncate">{{ opt.label }}</span>
    </button>
  </div>
</template>
