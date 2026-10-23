import { defineStore } from 'pinia'
import { readStorage, writeStorage } from '~/utils/storage'

export type TabId = 'map' | 'style' | 'text' | 'export'
export type Appearance = 'system' | 'light' | 'dark'
/** Phones: how far the bottom sheet with the panel is pulled up. */
export type SheetSnap = 'peek' | 'half' | 'full'

export const TABS: TabId[] = ['map', 'style', 'text', 'export']

const APPEARANCE_KEY = 'iwh.appearance'

export const useUiStore = defineStore('ui', () => {
  const tab = ref<TabId>('map')
  const sheet = ref<SheetSnap>('half')
  /** Phones: whether the sheet shows the panel (opening returns to the half-height sheet). */
  const sheetOpen = computed({
    get: () => sheet.value !== 'peek',
    set: (open: boolean) => {
      if (open !== sheetOpen.value) sheet.value = open ? 'half' : 'peek'
    },
  })
  const exportOpen = ref(false)
  const profilesOpen = ref(false)
  const saveProfileOpen = ref(false)
  const aboutOpen = ref(false)
  const shortcutsOpen = ref(false)
  const installOpen = ref(false)
  const searchFocusToken = ref(0)

  const stored = readStorage(APPEARANCE_KEY)
  const appearance = ref<Appearance>(stored === 'light' || stored === 'dark' ? stored : 'system')
  watch(appearance, v => writeStorage(APPEARANCE_KEY, v === 'system' ? null : v))

  function openTab(id: TabId) {
    tab.value = id
    sheetOpen.value = true
  }

  function focusSearch() {
    searchFocusToken.value++
  }

  return {
    tab,
    sheet,
    sheetOpen,
    exportOpen,
    profilesOpen,
    saveProfileOpen,
    aboutOpen,
    shortcutsOpen,
    installOpen,
    searchFocusToken,
    appearance,
    openTab,
    focusSearch,
  }
})
