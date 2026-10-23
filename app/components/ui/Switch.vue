<script setup lang="ts">
defineProps<{ label: string, hint?: string, disabled?: boolean }>()
const model = defineModel<boolean>({ required: true })
const id = useId()
</script>

<template>
  <div class="flex items-start justify-between gap-4 py-1.5">
    <label
      :for="id"
      class="min-w-0 cursor-pointer text-sm text-ink"
      :class="disabled ? 'opacity-50' : ''"
    >
      {{ label }}
      <span
        v-if="hint"
        class="mt-0.5 block text-xs leading-snug text-ink-3"
      >{{ hint }}</span>
    </label>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="model"
      :disabled="disabled"
      class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-[1.5px] border-ink transition-colors duration-200 disabled:opacity-40"
      :class="model ? 'bg-accent' : 'bg-surface-2'"
      @click="model = !model"
    >
      <span
        class="inline-block size-4 rounded-full border-[1.5px] border-ink transition-transform duration-200 ease-out-soft"
        :class="model ? 'translate-x-[21px] bg-surface' : 'translate-x-[3px] bg-ink'"
      />
    </button>
  </div>
</template>
