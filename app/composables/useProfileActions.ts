import { clonePlain } from '~/core/defaults'
import { ProfileParseError } from '~/core/profile'
import type { Profile } from '~/core/types'
import { readFileText } from '~/utils/storage'

/** Profile workflows that touch several stores and give user feedback. */
export function useProfileActions() {
  const poster = usePosterStore()
  const profiles = useProfilesStore()
  const { t } = useI18n()
  const { push } = useToasts()

  const active = computed(() => profiles.byId(poster.activeProfileId))

  function apply(p: Profile) {
    poster.applyProfile(p)
    push(t('profiles.applied', { name: p.name }), 'success')
  }

  function saveNew(name: string, includeContent: boolean) {
    const p = profiles.save(name, clonePlain(poster.style), includeContent ? clonePlain(poster.content) : undefined)
    poster.markProfileSaved(p)
    if (profiles.storageError) push(t('profiles.errors.storage'), 'error')
    else push(t('profiles.saved', { name: p.name }), 'success')
    return p
  }

  function saveChanges() {
    const p = active.value
    if (!p) return null
    profiles.update(p.id, { style: clonePlain(poster.style), content: p.content ? clonePlain(poster.content) : undefined })
    poster.markProfileSaved(p)
    push(t('profiles.updated', { name: p.name }), 'success')
    return p
  }

  function remove(p: Profile) {
    profiles.remove(p.id)
    if (poster.activeProfileId === p.id) poster.markProfileSaved(null)
    push(t('profiles.deleted', { name: p.name }))
  }

  async function importFiles(files: FileList | File[]) {
    let count = 0
    let last: Profile | null = null
    for (const file of Array.from(files)) {
      try {
        const text = await readFileText(file)
        const fallback = file.name.replace(/\.iwh\.json$|\.json$/i, '') || 'Profile'
        const added = profiles.importText(text, fallback)
        count += added.length
        last = added[added.length - 1] ?? last
      } catch (e) {
        const code = e instanceof ProfileParseError ? e.code : 'invalid-json'
        push(`${file.name}: ${t(`profiles.errors.${code}`)}`, 'error')
      }
    }
    if (count) {
      push(t('profiles.imported', { n: count }), 'success', last && count === 1 ? { action: { label: t('common.apply'), run: () => apply(last!) } } : {})
    }
    return count
  }

  return { active, apply, saveNew, saveChanges, remove, importFiles }
}
