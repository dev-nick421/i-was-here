<script setup lang="ts">
import type { ThemeColors } from '~/core/types'

/** A "paint chip" for a color theme: a tiny map on top, the poster's paper and type below. */
defineProps<{ colors: ThemeColors, name: string }>()
</script>

<template>
  <span class="flex w-full flex-col overflow-hidden rounded-[5px]">
    <svg
      viewBox="0 0 60 34"
      class="block w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <rect
        width="60"
        height="34"
        :fill="colors.land"
      />
      <path
        d="M38 0 C 44 6, 52 4, 60 8 L 60 0 Z"
        :fill="colors.parks"
      />
      <path
        d="M0 22 C 14 17, 26 29, 60 20 L 60 34 L 0 34 Z"
        :fill="colors.water"
      />
      <g
        :stroke="colors.roads"
        fill="none"
        stroke-linecap="round"
      >
        <path
          d="M-2 11 L 62 4"
          stroke-width="2.4"
        />
        <path
          d="M16 -2 L 24 36"
          stroke-width="1.5"
        />
        <path
          d="M-2 17 L 40 14"
          stroke-width="0.8"
        />
        <path
          d="M42 -2 L 47 20"
          stroke-width="0.8"
        />
        <path
          d="M6 -2 L 9 18"
          stroke-width="0.6"
        />
      </g>
    </svg>
    <span
      class="block truncate px-1.5 py-1 text-left font-mono text-[9.5px] uppercase leading-tight tracking-[0.08em]"
      :style="{ background: colors.paper, color: colors.text }"
    >{{ name }}</span>
  </span>
</template>
