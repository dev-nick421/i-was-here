<script setup lang="ts">
import { computeScene, estimateMeasure } from '~/core/scene'
import type { FrameId, LayoutId, ThemeColors, TypographyOptions } from '~/core/types'

/** A miniature, schematic render of a layout using the real layout engine. */
const props = defineProps<{
  layout: LayoutId
  frame: FrameId
  colors: ThemeColors
  typography: TypographyOptions
  aspect: number
}>()

const W = 1000
const H = computed(() => W * props.aspect)

const scene = computed(() =>
  computeScene({
    width: W,
    height: H.value,
    layout: props.layout,
    frame: props.frame,
    colors: props.colors,
    typography: { ...props.typography, size: 'm' },
    title: 'Hamburg',
    subtitle: 'Deutschland',
    coords: `53°33' N 9°59' E`,
    measure: estimateMeasure,
  }),
)

const clipId = useId()
const r = computed(() => scene.value.map.rect)

function textBar(n: { x: number, y: number, align: string, text: string, style: { size: number, letterSpacing: number } }) {
  const w = estimateMeasure(n.text, n.style as never)
  const h = Math.max(16, n.style.size * 0.7)
  const x = n.align === 'left' ? n.x : n.align === 'center' ? n.x - w / 2 : n.x - w
  return { x, y: n.y - h, width: w, height: h }
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${W} ${H}`"
    class="block h-full w-full"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="clipId">
        <ellipse
          v-if="scene.map.shape === 'circle'"
          :cx="r.x + r.w / 2"
          :cy="r.y + r.h / 2"
          :rx="r.w / 2"
          :ry="r.h / 2"
        />
        <rect
          v-else
          :x="r.x"
          :y="r.y"
          :width="r.w"
          :height="r.h"
        />
      </clipPath>
    </defs>
    <rect
      :width="W"
      :height="H"
      :fill="scene.paper"
    />
    <g :clip-path="`url(#${clipId})`">
      <rect
        :x="r.x"
        :y="r.y"
        :width="r.w"
        :height="r.h"
        :fill="colors.land"
      />
      <path
        :d="`M${r.x} ${r.y + r.h * 0.62} C ${r.x + r.w * 0.3} ${r.y + r.h * 0.5}, ${r.x + r.w * 0.6} ${r.y + r.h * 0.8}, ${r.x + r.w} ${r.y + r.h * 0.66} L ${r.x + r.w} ${r.y + r.h * 0.8} C ${r.x + r.w * 0.6} ${r.y + r.h * 0.95}, ${r.x + r.w * 0.3} ${r.y + r.h * 0.66}, ${r.x} ${r.y + r.h * 0.76} Z`"
        :fill="colors.water"
      />
      <g
        :stroke="colors.roads"
        fill="none"
        stroke-linecap="round"
      >
        <path
          :d="`M${r.x - 20} ${r.y + r.h * 0.2} L ${r.x + r.w + 20} ${r.y + r.h * 0.45}`"
          stroke-width="16"
        />
        <path
          :d="`M${r.x + r.w * 0.35} ${r.y - 20} L ${r.x + r.w * 0.55} ${r.y + r.h + 20}`"
          stroke-width="12"
        />
        <path
          :d="`M${r.x + r.w * 0.75} ${r.y - 20} L ${r.x + r.w * 0.68} ${r.y + r.h + 20}`"
          stroke-width="7"
        />
        <path
          :d="`M${r.x - 20} ${r.y + r.h * 0.9} L ${r.x + r.w + 20} ${r.y + r.h * 0.84}`"
          stroke-width="7"
        />
        <path
          :d="`M${r.x + r.w * 0.1} ${r.y - 20} L ${r.x + r.w * 0.18} ${r.y + r.h + 20}`"
          stroke-width="5"
        />
        <path
          :d="`M${r.x - 20} ${r.y + r.h * 0.33} L ${r.x + r.w + 20} ${r.y + r.h * 0.3}`"
          stroke-width="5"
        />
      </g>
    </g>
    <template
      v-for="(n, i) in scene.nodes"
      :key="i"
    >
      <rect
        v-if="n.kind === 'rect'"
        :x="n.rect.x"
        :y="n.rect.y"
        :width="n.rect.w"
        :height="n.rect.h"
        :fill="n.fill"
      />
      <rect
        v-else-if="n.kind === 'fade'"
        :x="n.rect.x"
        :y="n.rect.y + n.rect.h * 0.3"
        :width="n.rect.w"
        :height="n.rect.h * 0.7"
        :fill="n.color"
      />
      <rect
        v-else-if="n.kind === 'strokeRect'"
        :x="n.rect.x"
        :y="n.rect.y"
        :width="n.rect.w"
        :height="n.rect.h"
        fill="none"
        :stroke="n.color"
        :stroke-width="Math.max(8, n.width * 2.5)"
      />
      <circle
        v-else-if="n.kind === 'strokeCircle'"
        :cx="n.cx"
        :cy="n.cy"
        :r="n.r"
        fill="none"
        :stroke="n.color"
        :stroke-width="Math.max(8, n.width * 2.5)"
      />
      <line
        v-else-if="n.kind === 'line'"
        :x1="n.x1"
        :y1="n.y1"
        :x2="n.x2"
        :y2="n.y2"
        :stroke="n.color"
        :stroke-width="Math.max(8, n.width * 2)"
      />
      <rect
        v-else-if="n.kind === 'text'"
        v-bind="textBar(n)"
        :fill="n.style.color"
        rx="4"
      />
    </template>
  </svg>
</template>
