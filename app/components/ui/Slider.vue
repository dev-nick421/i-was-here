<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  min: number
  max: number
  step?: number
  /** Double-click the track to go back to this value. */
  resetValue?: number
  format?: (v: number) => string
}>(), { step: 1 })

const model = defineModel<number>({ required: true })
const id = useId()

const percent = computed(() => ((model.value - props.min) / (props.max - props.min)) * 100)
const display = computed(() => (props.format ? props.format(model.value) : String(model.value)))

function onInput(e: Event) {
  model.value = Number((e.target as HTMLInputElement).value)
}

function reset() {
  if (props.resetValue !== undefined) model.value = props.resetValue
}
</script>

<template>
  <div class="py-1">
    <div class="mb-1.5 flex items-center justify-between gap-3">
      <label
        :for="id"
        class="text-sm text-ink"
      >{{ label }}</label>
      <span class="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-ink-2">{{ display }}</span>
    </div>
    <input
      :id="id"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="model"
      :aria-valuetext="display"
      class="iwh-range w-full"
      :style="{ '--p': `${percent}%` }"
      @input="onInput"
      @dblclick="reset"
    >
  </div>
</template>

<style scoped>
.iwh-range {
  appearance: none;
  height: 22px;
  background: transparent;
  cursor: pointer;
}
.iwh-range::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(to right, var(--ink) var(--p), var(--line-strong) var(--p));
}
.iwh-range::-moz-range-track {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(to right, var(--ink) var(--p), var(--line-strong) var(--p));
}
.iwh-range::-webkit-slider-thumb {
  appearance: none;
  margin-top: -7.5px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--accent);
  border: 1.5px solid var(--ink);
  box-shadow: 1.5px 1.5px 0 0 var(--ink);
  transition: transform 0.15s;
}
.iwh-range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--accent);
  border: 1.5px solid var(--ink);
  box-shadow: 1.5px 1.5px 0 0 var(--ink);
}
.iwh-range:active::-webkit-slider-thumb {
  transform: scale(1.12);
}
.iwh-range:focus-visible {
  outline: none;
}
.iwh-range:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 35%, transparent);
}
</style>
