<script setup lang="ts">
const ui = useUiStore()
const poster = usePosterStore()
const { t } = useI18n()
const actions = useProfileActions()

const name = ref('')
const includeContent = ref(false)

watch(() => ui.saveProfileOpen, (open) => {
  if (!open) return
  const place = poster.content.place?.name ?? poster.content.text.title
  name.value = actions.active.value?.name ?? [place, poster.style.themeId === 'custom' ? '' : poster.style.themeId]
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
  includeContent.value = false
})

function submit() {
  if (!name.value.trim()) return
  actions.saveNew(name.value, includeContent.value)
  ui.saveProfileOpen = false
}
</script>

<template>
  <UiDialog
    v-model:open="ui.saveProfileOpen"
    :title="t('profiles.saveAs').replace('…', '')"
    :description="t('profiles.intro')"
    size="sm"
  >
    <form
      id="save-profile-form"
      class="space-y-4"
      @submit.prevent="submit"
    >
      <input
        v-model="name"
        autofocus
        class="field h-11"
        maxlength="80"
        required
        :placeholder="t('profiles.namePlaceholder')"
        :aria-label="t('profiles.namePlaceholder')"
        data-testid="profile-name"
      >
      <UiSwitch
        v-model="includeContent"
        :label="t('profiles.includeContent')"
        :hint="t('profiles.includeContentHint')"
      />
    </form>
    <template #footer>
      <UiButton
        variant="ghost"
        @click="ui.saveProfileOpen = false"
      >
        {{ t('common.cancel') }}
      </UiButton>
      <UiButton
        variant="primary"
        type="submit"
        form="save-profile-form"
        :disabled="!name.trim()"
        data-testid="profile-save-confirm"
      >
        {{ t('common.save') }}
      </UiButton>
    </template>
  </UiDialog>
</template>
