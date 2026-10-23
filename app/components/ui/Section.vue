<script setup lang="ts">
defineProps<{ title?: string, hint?: string }>()
</script>

<template>
  <section
    class="border-b border-dashed border-line px-5 py-5 last:border-b-0"
    data-animate
  >
    <div
      v-if="title || $slots.action"
      class="mb-3 flex items-center justify-between gap-3"
    >
      <h3
        v-if="title"
        class="section-title"
      >
        {{ title }}
      </h3>
      <slot name="action" />
    </div>
    <p
      v-if="hint"
      class="-mt-1 mb-3 text-xs leading-relaxed text-ink-3"
    >
      {{ hint }}
    </p>
    <slot />
  </section>
</template>
