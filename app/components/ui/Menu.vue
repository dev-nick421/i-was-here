<script setup lang="ts">
import gsap from 'gsap'

/**
 * Small dropdown menu. The trigger is passed in the `trigger` slot and receives `toggle`
 * and `open`; menu items are plain buttons in the default slot with `role="menuitem"`.
 */
const props = withDefaults(defineProps<{ align?: 'left' | 'right', width?: string, label: string }>(), {
  align: 'right',
  width: '16rem',
})

const open = ref(false)
const root = ref<HTMLElement>()
const menu = ref<HTMLElement>()

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close()
}

function items() {
  return [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])]
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
    root.value?.querySelector<HTMLElement>('[aria-haspopup]')?.focus()
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length
    list[next]?.focus()
  }
}

watch(open, async (v) => {
  if (!v) return
  await nextTick()
  if (menu.value && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.fromTo(menu.value, { opacity: 0, y: -6, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out' })
  }
})

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))

defineExpose({ close })
</script>

<template>
  <div
    ref="root"
    class="relative"
    @keydown="onKeydown"
  >
    <slot
      name="trigger"
      :toggle="toggle"
      :open="open"
    />
    <div
      v-if="open"
      ref="menu"
      role="menu"
      :aria-label="props.label"
      class="absolute top-full z-40 mt-2 origin-top overflow-hidden rounded-xl border-[1.5px] border-ink bg-surface p-1.5 shadow-[3px_3px_0_0_var(--ink)]"
      :class="align === 'right' ? 'right-0' : 'left-0'"
      :style="{ width }"
      @click="($event.target as HTMLElement).closest('[role=menuitem]') && close()"
    >
      <slot :close="close" />
    </div>
  </div>
</template>
