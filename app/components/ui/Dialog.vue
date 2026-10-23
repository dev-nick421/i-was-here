<script setup lang="ts">
import { X } from '@lucide/vue'
import gsap from 'gsap'

const props = withDefaults(defineProps<{
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  dismissible?: boolean
}>(), { size: 'md', dismissible: true })

const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const panel = ref<HTMLElement>()
const titleId = useId()
const descId = useId()
let previouslyFocused: HTMLElement | null = null

/** Open dialogs, top-most last – Escape closes only the top one. */
const stack: symbol[] = (globalThis as { __iwhDialogs?: symbol[] }).__iwhDialogs ??= []
const self = Symbol('dialog')

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && stack[stack.length - 1] === self) {
    e.preventDefault()
    close()
  }
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'

function close() {
  if (props.dismissible) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !panel.value) return
  const items = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(open, async (v) => {
  const i = stack.indexOf(self)
  if (i >= 0) stack.splice(i, 1)
  if (v) {
    stack.push(self)
    window.addEventListener('keydown', onWindowKeydown)
  } else {
    window.removeEventListener('keydown', onWindowKeydown)
  }
  if (v) {
    previouslyFocused = document.activeElement as HTMLElement | null
    await nextTick()
    const target = panel.value?.querySelector<HTMLElement>('[autofocus]') ?? panel.value?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()
  } else {
    previouslyFocused?.focus?.()
  }
})

onBeforeUnmount(() => {
  const i = stack.indexOf(self)
  if (i >= 0) stack.splice(i, 1)
  window.removeEventListener('keydown', onWindowKeydown)
})

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function onEnter(el: Element, done: () => void) {
  const backdrop = el.querySelector('[data-backdrop]')
  const card = el.querySelector('[data-card]')
  if (reduced()) return done()
  const mobile = window.innerWidth < 640
  gsap.timeline({ onComplete: done })
    .fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out' })
    .fromTo(card, mobile ? { y: 60, opacity: 0 } : { y: 14, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.32, ease: 'power3.out' }, 0)
}

function onLeave(el: Element, done: () => void) {
  if (reduced()) return done()
  gsap.timeline({ onComplete: done })
    .to(el.querySelector('[data-card]'), { y: 8, opacity: 0, duration: 0.16, ease: 'power1.in' })
    .to(el.querySelector('[data-backdrop]'), { opacity: 0, duration: 0.18 }, 0)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      :css="false"
      @enter="onEnter"
      @leave="onLeave"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
        @keydown="onKeydown"
      >
        <div
          data-backdrop
          class="absolute inset-0 bg-[rgb(27_25_21/0.45)] backdrop-blur-[3px]"
          aria-hidden="true"
          @click="close"
        />
        <div
          ref="panel"
          data-card
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="description ? descId : undefined"
          class="pb-safe relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border-[1.5px] border-ink bg-surface shadow-[4px_4px_0_0_var(--ink)] sm:rounded-2xl sm:pb-0"
          :class="{ sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[size]"
        >
          <header class="flex items-start gap-4 px-6 pt-6 pb-4">
            <div class="min-w-0 flex-1">
              <h2
                :id="titleId"
                class="panel-title"
              >
                {{ title }}
              </h2>
              <p
                v-if="description"
                :id="descId"
                class="mt-2 text-sm leading-relaxed text-ink-2"
              >
                {{ description }}
              </p>
            </div>
            <UiIconButton
              v-if="dismissible"
              :label="t('common.close')"
              size="sm"
              class="-mt-1 -mr-2"
              @click="close"
            >
              <X class="size-4" />
            </UiIconButton>
          </header>
          <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="flex flex-wrap items-center justify-end gap-2 border-t border-dashed border-line-strong bg-surface-2 px-6 py-4"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
