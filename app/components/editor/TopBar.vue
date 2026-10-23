<script setup lang="ts">
import { Code, Download, Ellipsis, FilePlus2, Info, Keyboard, Languages, Monitor, MonitorDown, Moon, Redo2, Smartphone, Sun, Undo2 } from '@lucide/vue'
import type { Appearance } from '~/stores/ui'

const poster = usePosterStore()
const profiles = useProfilesStore()
const ui = useUiStore()
const { t, locale, setLocale, locales } = useI18n()
const config = useRuntimeConfig()
const { isDesktop } = useBreakpoint()
const pwa = usePwa()

const appearanceOptions = computed(() => [
  { value: 'system' as Appearance, label: t('settings.themes.system'), icon: Monitor },
  { value: 'light' as Appearance, label: t('settings.themes.light'), icon: Sun },
  { value: 'dark' as Appearance, label: t('settings.themes.dark'), icon: Moon },
])

function newPoster() {
  if (confirm(t('poster.newPosterConfirm'))) poster.newPoster(profiles.defaultProfile)
}
</script>

<template>
  <header class="pt-safe px-safe relative z-30 box-content flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface">
    <a
      href="./"
      class="group flex shrink-0 items-center gap-2.5 rounded-full pr-2"
      :aria-label="t('app.name')"
    >
      <EditorBrandMark class="size-9 transition-transform duration-300 group-hover:-rotate-12" />
      <span class="hidden flex-col gap-1 leading-none sm:flex">
        <span class="font-display text-[17px] font-[800] uppercase tracking-[0.05em] text-ink">{{ t('app.name') }}</span>
        <span class="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-3">{{ t('app.studio') }}</span>
      </span>
    </a>

    <div
      v-if="isDesktop"
      class="flex min-w-0 flex-1 justify-center"
    >
      <EditorLocationSearch />
    </div>
    <div
      v-else
      class="flex-1"
    />

    <div class="flex shrink-0 items-center gap-1.5">
      <div class="hidden items-center sm:flex">
        <UiIconButton
          :label="`${t('common.undo')} (Ctrl Z)`"
          :disabled="!poster.canUndo"
          data-testid="undo"
          @click="poster.undo()"
        >
          <Undo2 class="size-[18px]" />
        </UiIconButton>
        <UiIconButton
          :label="`${t('common.redo')} (Ctrl Shift Z)`"
          :disabled="!poster.canRedo"
          data-testid="redo"
          @click="poster.redo()"
        >
          <Redo2 class="size-[18px]" />
        </UiIconButton>
      </div>

      <ProfilesProfileMenu />

      <UiMenu
        :label="t('common.more')"
        width="17rem"
      >
        <template #trigger="{ toggle, open }">
          <UiIconButton
            :label="t('common.more')"
            aria-haspopup="menu"
            :aria-expanded="open"
            @click="toggle"
          >
            <Ellipsis class="size-5" />
          </UiIconButton>
        </template>
        <UiMenuItem @click="newPoster">
          <template #icon>
            <FilePlus2 class="size-4 text-ink-2" />
          </template>
          {{ t('poster.newPoster') }}
        </UiMenuItem>
        <UiMenuItem
          v-if="pwa.canInstall.value"
          data-testid="install-app"
          @click="pwa.install()"
        >
          <template #icon>
            <MonitorDown
              v-if="isDesktop"
              class="size-4 text-ink-2"
            />
            <Smartphone
              v-else
              class="size-4 text-ink-2"
            />
          </template>
          {{ t('pwa.install') }}
        </UiMenuItem>
        <div class="my-1.5 border-t border-dashed border-line" />
        <div class="px-3 pb-1 pt-1.5">
          <p class="section-label mb-2 flex items-center gap-1.5">
            <Languages class="size-3.5" /> {{ t('settings.language') }}
          </p>
          <UiSegmented
            :model-value="locale"
            :options="locales.map(l => ({ value: l.code, label: l.name }))"
            :label="t('settings.language')"
            size="sm"
            @update:model-value="setLocale"
          />
          <p class="section-label mb-2 mt-3">
            {{ t('settings.theme') }}
          </p>
          <UiSegmented
            v-model="ui.appearance"
            :options="appearanceOptions"
            :label="t('settings.theme')"
            size="sm"
          />
        </div>
        <div class="my-1.5 border-t border-dashed border-line" />
        <UiMenuItem
          v-if="isDesktop"
          @click="ui.shortcutsOpen = true"
        >
          <template #icon>
            <Keyboard class="size-4 text-ink-2" />
          </template>
          {{ t('settings.shortcuts') }}
        </UiMenuItem>
        <UiMenuItem @click="ui.aboutOpen = true">
          <template #icon>
            <Info class="size-4 text-ink-2" />
          </template>
          {{ t('settings.about') }}
        </UiMenuItem>
        <a
          :href="config.public.repoUrl as string"
          target="_blank"
          rel="noopener"
          role="menuitem"
          class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-3"
        >
          <Code class="size-4 text-ink-2" />
          {{ t('settings.source') }}
        </a>
      </UiMenu>

      <UiButton
        variant="primary"
        class="ml-1"
        data-testid="topbar-export"
        @click="ui.exportOpen = true"
      >
        <Download class="size-4" />
        <span class="hidden sm:inline">{{ t('export.buttonShort') }}</span>
      </UiButton>
    </div>
  </header>
</template>
