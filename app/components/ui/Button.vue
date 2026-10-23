<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  block?: boolean
  type?: 'button' | 'submit'
}>(), { variant: 'secondary', size: 'md', type: 'button' })

const classes = computed(() => [
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:opacity-50',
  {
    sm: 'h-8 px-3.5 text-[13px]',
    md: 'h-10 px-4.5 text-sm',
    lg: 'h-12 px-6 text-[15px]',
  }[props.size],
  {
    // Primary actions look like a pressed print proof: ink outline + offset shadow.
    primary: 'border-[1.5px] border-ink bg-accent text-accent-ink shadow-hard hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:shadow-none',
    secondary: 'border border-line-strong bg-surface text-ink hover:border-ink',
    ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink',
    danger: 'border-[1.5px] border-ink bg-danger text-white hover:brightness-110',
    soft: 'border border-ink bg-surface text-ink hover:bg-ink hover:text-surface',
  }[props.variant],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle
      v-if="loading"
      class="size-4 animate-spin"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
