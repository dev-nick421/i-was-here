<script setup lang="ts">
import { ChevronUp } from '@lucide/vue'
import type { SheetSnap } from '~/stores/ui'

/**
 * Phones: the inspector as a bottom sheet. Drag or flick the handle between a peek (just the
 * title), half height and almost full height; tap it to open or fold it away.
 */
defineProps<{ title: string }>()

const ui = useUiStore()

const PEEK = 58
const SNAPS: SheetSnap[] = ['peek', 'half', 'full']

const root = ref<HTMLElement>()
const body = ref<HTMLElement>()
/** Height shared by the poster stage and the sheet. */
const space = ref(0)
/** Height while the handle is being dragged. */
const dragHeight = ref<number | null>(null)

let observer: ResizeObserver | null = null
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) space.value = entry.contentRect.height
  })
  observer.observe(root.value!.parentElement!)
})
onBeforeUnmount(() => observer?.disconnect())

const heights = computed<Record<SheetSnap, number>>(() => ({
  peek: PEEK,
  half: Math.max(PEEK, Math.round(space.value * 0.52)),
  // keep a strip of the poster in view
  full: Math.max(PEEK, space.value - 76),
}))
const height = computed(() => dragHeight.value ?? heights.value[ui.sheet])

let start: { y: number, height: number } | null = null
let last = { y: 0, time: 0 }
let velocity = 0
let moved = false

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  start = { y: e.clientY, height: height.value }
  last = { y: e.clientY, time: e.timeStamp }
  velocity = 0
  moved = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!start) return
  const dy = e.clientY - start.y
  if (!moved && Math.abs(dy) < 6) return
  moved = true
  const dt = e.timeStamp - last.time
  if (dt > 0) velocity = 0.7 * ((e.clientY - last.y) / dt) + 0.3 * velocity
  last = { y: e.clientY, time: e.timeStamp }
  dragHeight.value = Math.min(heights.value.full, Math.max(PEEK, start.height - dy))
}

function onPointerUp() {
  if (!start) return
  start = null
  if (!moved || dragHeight.value === null) return
  const h = dragHeight.value
  const snaps = SNAPS.map(id => ({ id, h: heights.value[id] }))
  let target: SheetSnap
  // A flick goes on to the next stop in its direction (velocity in px/ms, up is negative).
  if (velocity < -0.4) target = snaps.find(s => s.h > h + 4)?.id ?? 'full'
  else if (velocity > 0.4) target = [...snaps].reverse().find(s => s.h < h - 4)?.id ?? 'peek'
  else target = snaps.reduce((a, b) => (Math.abs(b.h - h) < Math.abs(a.h - h) ? b : a)).id
  ui.sheet = target
  dragHeight.value = null
}

function onClick() {
  // The click after a drag is not a tap.
  if (moved) {
    moved = false
    return
  }
  ui.sheet = ui.sheet === 'half' ? 'peek' : 'half'
}

defineExpose({ body })
</script>

<template>
  <section
    ref="root"
    class="relative z-20 flex shrink-0 flex-col overflow-hidden rounded-t-[1.25rem] border-t-[1.5px] border-ink bg-surface shadow-[0_-10px_30px_-18px_rgb(27_25_21/0.45)]"
    :class="dragHeight === null ? 'transition-[height] duration-300 ease-out-soft' : ''"
    :style="{ height: space ? `${height}px` : '46dvh' }"
    :data-sheet="ui.sheet"
  >
    <button
      type="button"
      class="flex shrink-0 cursor-grab touch-none select-none flex-col items-stretch outline-offset-[-2px] active:cursor-grabbing"
      :aria-expanded="ui.sheetOpen"
      data-testid="sheet-handle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click="onClick"
    >
      <span
        class="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong"
        aria-hidden="true"
      />
      <span class="flex h-11 items-center justify-between gap-3 px-5">
        <span class="font-display text-xl font-[750] leading-none tracking-tight text-ink">{{ title }}</span>
        <ChevronUp
          class="size-5 text-ink-3 transition-transform duration-300"
          :class="ui.sheet === 'peek' ? '' : 'rotate-180'"
          aria-hidden="true"
        />
      </span>
    </button>
    <div
      v-show="ui.sheet !== 'peek' || dragHeight !== null"
      ref="body"
      class="inspector-body scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <slot />
    </div>
  </section>
</template>
