<script setup lang="ts">
import { CircleCheck, Info, TriangleAlert, X } from '@lucide/vue'
import gsap from 'gsap'

const { toasts, dismiss } = useToasts()
const { t } = useI18n()

function onEnter(el: Element, done: () => void) {
  gsap.fromTo(el, { y: 16, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out', onComplete: done })
}

function onLeave(el: Element, done: () => void) {
  gsap.to(el, { opacity: 0, y: 8, duration: 0.2, ease: 'power1.in', onComplete: done })
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8"
    aria-live="polite"
  >
    <TransitionGroup
      :css="false"
      @enter="onEnter"
      @leave="onLeave"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border-[1.5px] border-ink bg-surface py-1.5 pl-4 pr-1.5 text-sm text-ink shadow-hard"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
        data-testid="toast"
      >
        <CircleCheck
          v-if="toast.tone === 'success'"
          class="size-4 shrink-0 text-accent"
        />
        <TriangleAlert
          v-else-if="toast.tone === 'error'"
          class="size-4 shrink-0 text-danger"
        />
        <Info
          v-else
          class="size-4 shrink-0 text-ink-3"
        />
        <span class="min-w-0 flex-1">{{ toast.message }}</span>
        <UiButton
          v-if="toast.action"
          size="sm"
          variant="soft"
          @click="toast.action.run(); dismiss(toast.id)"
        >
          {{ toast.action.label }}
        </UiButton>
        <UiIconButton
          :label="t('common.close')"
          size="sm"
          @click="dismiss(toast.id)"
        >
          <X class="size-4" />
        </UiIconButton>
      </div>
    </TransitionGroup>
  </div>
</template>
