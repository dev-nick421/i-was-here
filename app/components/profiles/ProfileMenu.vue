<script setup lang="ts">
import { BookmarkPlus, Check, ChevronDown, FolderOpen, Save, Star, Upload } from '@lucide/vue'

const poster = usePosterStore()
const profiles = useProfilesStore()
const ui = useUiStore()
const { t } = useI18n()
const actions = useProfileActions()
const fileInput = ref<HTMLInputElement>()

const label = computed(() => actions.active.value?.name ?? t('profiles.none'))

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) await actions.importFiles(input.files)
  input.value = ''
}
</script>

<template>
  <!-- The file input lives outside the menu: the menu closes (and unmounts its content) as
       soon as "Import" is clicked, while the file picker is still open. -->
  <div class="contents">
    <UiMenu
      :label="t('profiles.title')"
      width="18.5rem"
    >
      <template #trigger="{ toggle, open }">
        <button
          type="button"
          aria-haspopup="menu"
          :aria-expanded="open"
          data-testid="profile-menu"
          class="flex h-10 max-w-[14rem] items-center gap-2 rounded-full border border-line-strong bg-surface pl-3.5 pr-2.5 text-sm transition-colors hover:border-ink"
          @click="toggle"
        >
          <span class="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 xl:inline">{{ t('profiles.menu') }}</span>
          <span class="truncate font-medium text-ink">{{ label }}</span>
          <span
            v-if="poster.isDirty"
            class="size-2 shrink-0 rounded-full border border-ink bg-accent"
            :title="t('profiles.unsaved')"
          />
          <ChevronDown class="size-4 shrink-0 text-ink-3" />
        </button>
      </template>

      <div class="max-h-64 overflow-y-auto">
        <UiMenuItem
          v-for="p in profiles.sorted"
          :key="p.id"
          @click="actions.apply(p)"
        >
          <template #icon>
            <Check
              class="size-4"
              :class="p.id === poster.activeProfileId ? 'text-accent' : 'invisible'"
            />
          </template>
          {{ p.name }}
          <Star
            v-if="p.id === profiles.defaultId"
            class="ml-1 inline size-3 fill-current text-warn"
          />
        </UiMenuItem>
      </div>
      <div
        v-if="profiles.list.length"
        class="my-1.5 h-px bg-line"
      />
      <UiMenuItem
        v-if="actions.active.value && poster.isDirty"
        @click="actions.saveChanges()"
      >
        <template #icon>
          <Save class="size-4 text-ink-2" />
        </template>
        {{ t('profiles.saveChanges', { name: actions.active.value.name }) }}
      </UiMenuItem>
      <UiMenuItem
        hint="Ctrl S"
        data-testid="save-profile"
        @click="ui.saveProfileOpen = true"
      >
        <template #icon>
          <BookmarkPlus class="size-4 text-ink-2" />
        </template>
        {{ t('profiles.saveAs') }}
      </UiMenuItem>
      <UiMenuItem @click="fileInput?.click()">
        <template #icon>
          <Upload class="size-4 text-ink-2" />
        </template>
        {{ t('profiles.import') }}
      </UiMenuItem>
      <UiMenuItem
        data-testid="manage-profiles"
        @click="ui.profilesOpen = true"
      >
        <template #icon>
          <FolderOpen class="size-4 text-ink-2" />
        </template>
        {{ t('profiles.manage') }}
      </UiMenuItem>
    </UiMenu>
    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      multiple
      class="hidden"
      data-testid="profile-file-input"
      @change="onFiles"
    >
  </div>
</template>
