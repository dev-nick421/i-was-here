<script setup lang="ts">
import { TABS } from '~/stores/ui'

const poster = usePosterStore()
const profiles = useProfilesStore()
const ui = useUiStore()
const { t, locale } = useI18n()
const { push } = useToasts()
const actions = useProfileActions()
const pwa = usePwa()

poster.init(profiles.defaultProfile)
if (poster.restored) {
  onMounted(() => setTimeout(() => push(t('poster.restored'), 'info', { duration: 3000 }), 600))
}

useHead({
  htmlAttrs: { lang: locale },
  title: computed(() => `${t('app.name')}: ${t('app.tagline')}`),
})

// Appearance (light / dark / system)
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(media?.matches ?? false)
media?.addEventListener('change', e => (systemDark.value = e.matches))
const dark = computed(() => ui.appearance === 'dark' || (ui.appearance === 'system' && systemDark.value))
watchEffect(() => document.documentElement.classList.toggle('dark', dark.value))
// Browser and system bars take the color of the top bar.
useHead({ meta: [{ name: 'theme-color', content: computed(() => (dark.value ? '#181714' : '#fbf9f4')) }] })

// App updates and connectivity
watch(pwa.updateReady, (ready) => {
  if (ready) push(t('pwa.updateReady'), 'info', { duration: 0, action: { label: t('pwa.reload'), run: pwa.applyUpdate } })
})
watch(pwa.online, (online) => {
  if (!online) push(t('pwa.offline'), 'info', { duration: 5000 })
})

// Keyboard shortcuts
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

function onKeydown(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  const key = e.key.toLowerCase()
  if (mod && key === 'z' && !isTyping(e.target)) {
    e.preventDefault()
    if (e.shiftKey) poster.redo()
    else poster.undo()
  } else if (mod && key === 'y' && !isTyping(e.target)) {
    e.preventDefault()
    poster.redo()
  } else if (mod && key === 'e') {
    e.preventDefault()
    ui.exportOpen = true
  } else if (mod && key === 's') {
    e.preventDefault()
    if (actions.active.value && poster.isDirty) actions.saveChanges()
    else ui.saveProfileOpen = true
  } else if (mod || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) {
    // leave everything else alone
  } else if (key === '/') {
    e.preventDefault()
    ui.focusSearch()
  } else if (/^[1-4]$/.test(key)) {
    ui.openTab(TABS[Number(key) - 1]!)
  } else if (key === '+' || key === '=') {
    poster.zoomBy(0.5)
  } else if (key === '-') {
    poster.zoomBy(-0.5)
  }
}

// Drop a profile file anywhere to import it
const dropping = ref(false)
let dragDepth = 0
function hasFiles(e: DragEvent) {
  return [...(e.dataTransfer?.types ?? [])].includes('Files')
}
function onDragEnter(e: DragEvent) {
  if (!hasFiles(e) || ui.profilesOpen) return
  dragDepth++
  dropping.value = true
}
function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dropping.value = false
}
async function onDrop(e: DragEvent) {
  if (!hasFiles(e) || ui.profilesOpen) return
  e.preventDefault()
  dragDepth = 0
  dropping.value = false
  if (e.dataTransfer?.files.length) await actions.importFiles(e.dataTransfer.files)
}
function onDragOver(e: DragEvent) {
  if (hasFiles(e)) e.preventDefault()
}

// Installed app (Chrome, Edge): profile files opened from the file manager arrive here.
interface LaunchParams { files: FileSystemFileHandle[] }
const launchQueue = typeof window !== 'undefined'
  ? (window as { launchQueue?: { setConsumer: (fn: (params: LaunchParams) => void) => void } }).launchQueue
  : undefined
launchQueue?.setConsumer(async ({ files }) => {
  if (files?.length) await actions.importFiles(await Promise.all(files.map(f => f.getFile())))
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('drop', onDrop)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('drop', onDrop)
})
</script>

<template>
  <div>
    <EditorShell />
    <EditorExportDialog />
    <ProfilesDialog />
    <ProfilesSaveProfileDialog />
    <EditorInfoDialogs />
    <EditorInstallDialog />
    <EditorToastHost />
    <div
      v-if="dropping"
      class="pointer-events-none fixed inset-3 z-[70] flex items-center justify-center rounded-2xl border-2 border-dashed border-ink bg-accent-soft/90 font-display text-3xl font-[750] tracking-tight text-ink backdrop-blur-sm"
    >
      {{ t('profiles.dropHere') }}
    </div>
  </div>
</template>
