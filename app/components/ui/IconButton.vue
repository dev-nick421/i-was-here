<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  size?: 'sm' | 'md'
  active?: boolean
  disabled?: boolean
}>(), { size: 'md' })
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    :aria-pressed="active === undefined ? undefined : active"
    class="inline-flex shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:opacity-35"
    :class="[size === 'sm' ? 'size-8' : 'size-10', active ? 'bg-ink text-surface hover:bg-ink hover:text-surface' : '']"
  >
    <slot />
  </button>
</template>
