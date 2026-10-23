<script setup lang="ts">
import { Copy, Download, Pencil, Star, Trash2, Upload } from '@lucide/vue'
import { posterUnits } from '~/core/formats'
import type { Profile } from '~/core/types'

const ui = useUiStore()
const poster = usePosterStore()
const profiles = useProfilesStore()
const { t, intlLocale } = useI18n()
const actions = useProfileActions()

const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)
const renaming = ref<string | null>(null)
const renameValue = ref('')
const confirmDelete = ref<string | null>(null)

const dateFmt = computed(() => new Intl.DateTimeFormat(intlLocale.value, { dateStyle: 'medium', timeStyle: 'short' }))

function aspect(p: Profile) {
  const u = posterUnits(p.style.output)
  return u.height / u.width
}

function startRename(p: Profile) {
  renaming.value = p.id
  renameValue.value = p.name
  nextTick(() => document.querySelector<HTMLInputElement>(`[data-rename="${p.id}"]`)?.select())
}

function commitRename(p: Profile) {
  if (renaming.value !== p.id) return
  profiles.update(p.id, { name: renameValue.value })
  renaming.value = null
}

function applyAndClose(p: Profile) {
  actions.apply(p)
  ui.profilesOpen = false
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) await actions.importFiles(input.files)
  input.value = ''
}

async function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files.length) await actions.importFiles(e.dataTransfer.files)
}
</script>

<template>
  <UiDialog
    v-model:open="ui.profilesOpen"
    :title="t('profiles.title')"
    :description="t('profiles.intro')"
    size="lg"
  >
    <div
      class="relative"
      data-testid="profiles-dialog"
      @dragover.prevent="dragging = true"
      @dragleave.self="dragging = false"
      @drop.prevent="onDrop"
    >
      <p
        v-if="!profiles.list.length"
        class="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-2"
      >
        {{ t('profiles.empty') }}
      </p>
      <ul
        v-else
        class="grid gap-2 sm:grid-cols-2"
      >
        <li
          v-for="p in profiles.sorted"
          :key="p.id"
          class="tile group relative flex gap-3 p-3"
          :class="p.id === poster.activeProfileId ? 'tile-active' : ''"
          data-testid="profile-item"
        >
          <button
            type="button"
            class="w-16 shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-black/10"
            :aria-label="`${t('common.apply')}: ${p.name}`"
            @click="applyAndClose(p)"
          >
            <StyleLayoutThumb
              :layout="p.style.layout"
              :frame="p.style.frame"
              :colors="p.style.colors"
              :typography="p.style.typography"
              :aspect="aspect(p)"
            />
          </button>
          <div class="flex min-w-0 flex-1 flex-col">
            <input
              v-if="renaming === p.id"
              v-model="renameValue"
              :data-rename="p.id"
              class="field h-8 text-sm pointer-coarse:h-10 pointer-coarse:text-base"
              maxlength="80"
              @keydown.enter="commitRename(p)"
              @keydown.esc.stop="renaming = null"
              @blur="commitRename(p)"
            >
            <p
              v-else
              class="flex items-center gap-1.5 truncate text-sm font-medium text-ink"
            >
              <span class="truncate">{{ p.name }}</span>
              <Star
                v-if="p.id === profiles.defaultId"
                class="size-3.5 shrink-0 fill-current text-warn"
              />
            </p>
            <p class="mt-0.5 truncate text-xs text-ink-3">
              {{ t('profiles.updatedAt', { date: dateFmt.format(new Date(p.updatedAt)) }) }}
              <template v-if="p.content">
                · {{ t('profiles.withPlace') }}
              </template>
            </p>
            <div
              v-if="confirmDelete === p.id"
              class="mt-auto flex items-center gap-1.5 pt-2"
            >
              <span class="min-w-0 flex-1 truncate text-xs text-danger">{{ t('profiles.confirmDelete', { name: p.name }) }}</span>
              <UiButton
                size="sm"
                variant="ghost"
                @click="confirmDelete = null"
              >
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                size="sm"
                variant="danger"
                @click="actions.remove(p); confirmDelete = null"
              >
                {{ t('common.delete') }}
              </UiButton>
            </div>
            <div
              v-else
              class="mt-auto flex items-center gap-0.5 pt-2"
            >
              <UiButton
                size="sm"
                variant="soft"
                class="mr-auto"
                data-testid="profile-apply"
                @click="applyAndClose(p)"
              >
                {{ t('common.apply') }}
              </UiButton>
              <UiIconButton
                size="sm"
                :label="p.id === profiles.defaultId ? t('profiles.isDefault') : t('profiles.setDefault')"
                :active="p.id === profiles.defaultId"
                @click="profiles.setDefault(p.id === profiles.defaultId ? null : p.id)"
              >
                <Star
                  class="size-4"
                  :class="p.id === profiles.defaultId ? 'fill-current' : ''"
                />
              </UiIconButton>
              <UiIconButton
                size="sm"
                :label="t('common.rename')"
                @click="startRename(p)"
              >
                <Pencil class="size-4" />
              </UiIconButton>
              <UiIconButton
                size="sm"
                :label="t('common.duplicate')"
                @click="profiles.duplicate(p.id, t('common.copy'))"
              >
                <Copy class="size-4" />
              </UiIconButton>
              <UiIconButton
                size="sm"
                :label="`${t('common.download')} (JSON)`"
                data-testid="profile-download"
                @click="profiles.exportOne(p.id)"
              >
                <Download class="size-4" />
              </UiIconButton>
              <UiIconButton
                size="sm"
                :label="t('common.delete')"
                @click="confirmDelete = p.id"
              >
                <Trash2 class="size-4" />
              </UiIconButton>
            </div>
          </div>
        </li>
      </ul>

      <p class="mt-4 text-xs leading-relaxed text-ink-3">
        {{ t('profiles.storageNote') }}
      </p>

      <div
        v-if="dragging"
        class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-ink bg-accent-soft/95 font-mono text-xs uppercase tracking-[0.14em] text-ink"
      >
        {{ t('profiles.dropHere') }}
      </div>
    </div>

    <template #footer>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        multiple
        class="hidden"
        @change="onFiles"
      >
      <UiButton
        variant="ghost"
        class="mr-auto"
        :disabled="!profiles.list.length"
        @click="profiles.exportAll()"
      >
        <Download class="size-4" />
        {{ t('profiles.exportAll') }}
      </UiButton>
      <UiButton
        variant="secondary"
        @click="fileInput?.click()"
      >
        <Upload class="size-4" />
        {{ t('common.import') }}
      </UiButton>
      <UiButton
        variant="primary"
        @click="ui.saveProfileOpen = true"
      >
        {{ t('profiles.saveAs') }}
      </UiButton>
    </template>
  </UiDialog>
</template>
