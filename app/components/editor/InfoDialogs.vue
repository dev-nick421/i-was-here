<script setup lang="ts">
const ui = useUiStore()
const { t } = useI18n()
const config = useRuntimeConfig()

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

const shortcuts = computed(() => [
  { keys: [mod, 'Z'], label: t('shortcuts.undo') },
  { keys: [mod, '⇧', 'Z'], label: t('shortcuts.redo') },
  { keys: [mod, 'E'], label: t('shortcuts.export') },
  { keys: [mod, 'S'], label: t('shortcuts.save') },
  { keys: ['/'], label: t('shortcuts.search') },
  { keys: ['1', '–', '4'], label: t('shortcuts.tabs') },
  { keys: ['+', '−'], label: t('shortcuts.zoom') },
])
</script>

<template>
  <UiDialog
    v-model:open="ui.shortcutsOpen"
    :title="t('settings.shortcuts')"
    size="sm"
  >
    <dl class="divide-y divide-line">
      <div
        v-for="s in shortcuts"
        :key="s.label"
        class="flex items-center justify-between gap-4 py-2.5"
      >
        <dt class="text-sm text-ink">
          {{ s.label }}
        </dt>
        <dd class="flex gap-1">
          <kbd
            v-for="k in s.keys"
            :key="k"
            class="min-w-7 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-center font-sans text-xs text-ink-2"
          >{{ k }}</kbd>
        </dd>
      </div>
    </dl>
  </UiDialog>

  <UiDialog
    v-model:open="ui.aboutOpen"
    :title="t('about.title')"
    size="sm"
  >
    <div class="space-y-3 text-sm leading-relaxed text-ink-2">
      <p>{{ t('about.text') }}</p>
      <p>
        {{ t('about.data') }}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener"
          class="text-accent underline-offset-2 hover:underline"
        >openstreetmap.org/copyright</a>
      </p>
      <p>
        {{ t('about.license') }}
        <a
          :href="config.public.repoUrl as string"
          target="_blank"
          rel="noopener"
          class="text-accent underline-offset-2 hover:underline"
        >{{ t('settings.source') }}</a>
      </p>
    </div>
  </UiDialog>
</template>
