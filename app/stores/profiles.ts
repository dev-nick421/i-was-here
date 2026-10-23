import { defineStore } from 'pinia'
import { clonePlain } from '~/core/defaults'
import {
  createProfile,
  newId,
  parseProfileFile,
  parseStoredProfiles,
  profileFileName,
  serializeProfile,
  serializeProfiles,
} from '~/core/profile'
import type { PosterContent, PosterStyle, Profile } from '~/core/types'
import { downloadText, readStorage, writeStorage } from '~/utils/storage'

const PROFILES_KEY = 'iwh.profiles.v1'
const DEFAULT_KEY = 'iwh.defaultProfile'

export const useProfilesStore = defineStore('profiles', () => {
  const { locale } = useI18n()
  const list = ref<Profile[]>(parseStoredProfiles(readStorage(PROFILES_KEY), locale.value))
  const defaultId = ref<string | null>(readStorage(DEFAULT_KEY))
  const storageError = ref(false)

  if (defaultId.value && !list.value.some(p => p.id === defaultId.value)) defaultId.value = null

  const sorted = computed(() => [...list.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  const defaultProfile = computed(() => list.value.find(p => p.id === defaultId.value) ?? null)

  watch(list, (value) => {
    storageError.value = !writeStorage(PROFILES_KEY, JSON.stringify(value))
  }, { deep: true })
  watch(defaultId, value => writeStorage(DEFAULT_KEY, value))

  function byId(id: string | null) {
    return id ? list.value.find(p => p.id === id) ?? null : null
  }

  function save(name: string, style: PosterStyle, content?: PosterContent) {
    const profile = createProfile(name, style, content)
    list.value.push(profile)
    return profile
  }

  function update(id: string, patch: { name?: string, style?: PosterStyle, content?: PosterContent | null }) {
    const p = byId(id)
    if (!p) return null
    if (patch.name !== undefined) p.name = patch.name.trim().slice(0, 80) || p.name
    if (patch.style) p.style = clonePlain(patch.style)
    if (patch.content === null) delete p.content
    else if (patch.content) p.content = clonePlain(patch.content)
    p.updatedAt = new Date().toISOString()
    return p
  }

  function remove(id: string) {
    list.value = list.value.filter(p => p.id !== id)
    if (defaultId.value === id) defaultId.value = null
  }

  function duplicate(id: string, suffix: string) {
    const p = byId(id)
    if (!p) return null
    const copy = createProfile(`${p.name} (${suffix})`, p.style, p.content)
    list.value.push(copy)
    return copy
  }

  function setDefault(id: string | null) {
    defaultId.value = id
  }

  /** Imports one file's content. Throws ProfileParseError for invalid files. */
  function importText(text: string, fallbackName: string) {
    const parsed = parseProfileFile(text, { locale: locale.value, fallbackName })
    const added: Profile[] = []
    for (const p of parsed) {
      const existing = byId(p.id)
      if (existing) {
        // Same profile again: replace if the file is newer, otherwise keep both.
        if (p.updatedAt > existing.updatedAt) Object.assign(existing, p)
        else if (JSON.stringify(existing.style) !== JSON.stringify(p.style)) {
          const copy = { ...p, id: newId() }
          list.value.push(copy)
          added.push(copy)
          continue
        }
        added.push(existing)
      } else {
        list.value.push(p)
        added.push(p)
      }
    }
    return added
  }

  function exportOne(id: string) {
    const p = byId(id)
    if (p) downloadText(serializeProfile(p), profileFileName(p.name))
  }

  function exportAll() {
    if (list.value.length) downloadText(serializeProfiles(sorted.value), 'i-was-here-profiles.iwh.json')
  }

  return { list, sorted, defaultId, defaultProfile, storageError, byId, save, update, remove, duplicate, setDefault, importText, exportOne, exportAll }
})
