import de from '~/i18n/de'
import en, { type Messages } from '~/i18n/en'

export const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
] as const

export type Locale = (typeof LOCALES)[number]['code']

const MESSAGES: Record<Locale, Messages> = { en, de }
const STORAGE_KEY = 'iwh.locale'

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'de') return stored
  } catch {
    // storage unavailable
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en'
}

const locale = ref<Locale>(typeof window === 'undefined' ? 'en' : detectLocale())

function lookup(messages: Messages, key: string): unknown {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = (node as Record<string, unknown>)[part]
    else return undefined
  }
  return node
}

export function translate(key: string, params?: Record<string, string | number>, lang: Locale = locale.value): string {
  let value = lookup(MESSAGES[lang], key) ?? lookup(MESSAGES.en, key)
  if (typeof value !== 'string') value = key
  if (!params) return value as string
  return (value as string).replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? String(params[name]) : `{${name}}`))
}

export function useI18n() {
  const t = (key: string, params?: Record<string, string | number>) => translate(key, params, locale.value)
  const setLocale = (code: Locale) => {
    locale.value = code
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // ignore
    }
  }
  /** BCP 47 tag for Intl APIs. */
  const intlLocale = computed(() => (locale.value === 'de' ? 'de-DE' : 'en-US'))
  return { locale, t, setLocale, intlLocale, locales: LOCALES }
}
