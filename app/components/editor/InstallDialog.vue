<script setup lang="ts">
import { ExternalLink, Share, SquarePlus } from '@lucide/vue'

/** How to install where the browser has no install prompt (iPhone/iPad, Safari) or can't (HTTP). */
const ui = useUiStore()
const pwa = usePwa()
const { t } = useI18n()
const config = useRuntimeConfig()

const steps = computed(() => {
  const kind = pwa.help.value
  if (kind !== 'ios' && kind !== 'safari') return []
  return [1, 2, 3].map(n => t(`pwa.${kind}.step${n}`))
})
const host = typeof window === 'undefined' ? '' : window.location.host
</script>

<template>
  <UiDialog
    v-model:open="ui.installOpen"
    :title="pwa.help.value === 'insecure' ? t('pwa.insecure.title') : t('pwa.title')"
    size="sm"
  >
    <div
      class="space-y-5 text-sm leading-relaxed text-ink-2"
      data-testid="install-help"
    >
      <div class="flex items-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface-2 p-3.5">
        <img
          src="/icons/apple-touch-icon.png"
          alt=""
          class="size-14 shrink-0 rounded-[14px] border border-ink"
        >
        <p>{{ t('pwa.intro') }}</p>
      </div>

      <ol
        v-if="steps.length"
        class="space-y-3"
      >
        <li
          v-for="(step, i) in steps"
          :key="i"
          class="flex gap-3"
        >
          <span class="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-accent font-mono text-[11px] font-bold text-accent-ink">
            {{ i + 1 }}
          </span>
          <span class="text-ink">
            {{ step }}
            <Share
              v-if="i === 0 && pwa.help.value === 'ios'"
              class="ml-1 inline size-4 -translate-y-px text-accent"
              aria-hidden="true"
            />
            <SquarePlus
              v-else-if="i === 1 && pwa.help.value === 'ios'"
              class="ml-1 inline size-4 -translate-y-px text-accent"
              aria-hidden="true"
            />
          </span>
        </li>
      </ol>

      <template v-else-if="pwa.help.value === 'insecure'">
        <p class="text-ink">
          {{ t('pwa.insecure.text', { host }) }}
        </p>
        <p>{{ t('pwa.insecure.fix') }}</p>
        <a
          :href="`${config.public.repoUrl}/blob/main/docs/self-hosting.md#https-and-installing-the-app`"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 font-medium text-accent underline-offset-2 hover:underline"
        >
          {{ t('pwa.insecure.docs') }}
          <ExternalLink class="size-3.5" />
        </a>
      </template>
    </div>

    <template #footer>
      <UiButton
        variant="secondary"
        @click="ui.installOpen = false"
      >
        {{ t('common.done') }}
      </UiButton>
    </template>
  </UiDialog>
</template>
