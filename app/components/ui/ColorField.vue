<script setup lang="ts">
import { normalizeHex } from '~/core/color'

const props = defineProps<{ label: string }>()
const model = defineModel<string>({ required: true })
const draft = ref(model.value)
const picker = ref<HTMLInputElement>()

watch(model, (v) => {
  draft.value = v
})

let frame = 0
function onPick(e: Event) {
  const value = (e.target as HTMLInputElement).value
  draft.value = value
  // The native picker fires continuously while dragging: update at most once per frame.
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    model.value = value
  })
}

function openPicker() {
  const el = picker.value
  if (!el) return
  try {
    if (typeof el.showPicker === 'function') el.showPicker()
    else el.click()
  } catch {
    el.click()
  }
}

function commit() {
  const hex = normalizeHex(draft.value)
  if (hex) model.value = hex
  else draft.value = model.value
}
</script>

<template>
  <div class="group flex items-center gap-3 border-b border-dashed border-line py-2 last:border-b-0">
    <div class="relative size-7 shrink-0">
      <button
        type="button"
        class="size-7 rounded-md border-[1.5px] border-ink transition-transform duration-150 hover:-rotate-6 hover:scale-110"
        :style="{ background: model }"
        :aria-label="props.label"
        @click="openPicker"
      />
      <input
        ref="picker"
        type="color"
        tabindex="-1"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 size-full opacity-0"
        :value="model"
        @input="onPick"
      >
    </div>
    <span
      class="min-w-0 flex-1 cursor-pointer text-sm text-ink"
      @click="openPicker"
    >{{ label }}</span>
    <input
      v-model="draft"
      :aria-label="`${label} (hex)`"
      spellcheck="false"
      class="w-[5.5rem] rounded-lg border border-transparent bg-transparent px-2 py-1 text-right font-mono text-xs uppercase text-ink-2 outline-none pointer-coarse:text-base transition-colors hover:border-line focus:border-ink focus:text-ink"
      @change="commit"
      @keydown.enter="commit"
    >
  </div>
</template>
