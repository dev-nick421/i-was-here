<script setup lang="ts">
defineProps<{ disabled?: boolean, danger?: boolean, hint?: string }>()
</script>

<template>
  <button
    type="button"
    role="menuitem"
    :disabled="disabled"
    class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-surface-3 focus-visible:bg-surface-3 disabled:opacity-40"
    :class="danger ? 'text-danger' : 'text-ink'"
  >
    <slot name="icon" />
    <span class="min-w-0 flex-1 truncate"><slot /></span>
    <span
      v-if="hint"
      class="shrink-0 font-mono text-[10.5px] uppercase text-ink-3"
    >{{ hint }}</span>
  </button>
</template>
