import { z } from 'zod'
import { normalizeHex } from './color'
import { clonePlain, DEFAULT_STYLE, defaultContent } from './defaults'
import { FONT_PRESETS } from './fonts'
import { CUSTOM_SIZE_LIMITS, PAPER_FORMATS, RESOLUTIONS } from './formats'
import { clampLat, wrapLng } from './geo'
import { LAYOUT_IDS } from './scene'
import { COLOR_KEYS, getTheme } from './themes'
import type { PosterContent, PosterStyle, Profile, ThemeColors } from './types'

/**
 * Profiles are plain JSON files so people can keep them in a repo, share them or edit them
 * by hand. Parsing is deliberately forgiving: unknown keys are dropped, invalid or missing
 * values fall back to defaults, numbers are clamped — an old or hand-edited file still loads.
 */

export const PROFILE_APP = 'i-was-here'
export const PROFILE_VERSION = 1
export const PROFILE_SCHEMA_URL = 'https://raw.githubusercontent.com/dev-nick421/i-was-here/main/docs/profile.schema.json'

const D = DEFAULT_STYLE

function oneOf<const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z.enum(values).catch(fallback)
}

function clamped(min: number, max: number, fallback: number) {
  return z.number().refine(Number.isFinite).transform(n => Math.min(max, Math.max(min, n))).catch(fallback)
}

const bool = (fallback: boolean) => z.boolean().catch(fallback)

const color = (fallback: string) =>
  z.string().refine(v => normalizeHex(v) !== null).transform(v => normalizeHex(v)!).catch(fallback)

const text = (fallback: string, max = 200) => z.string().transform(s => s.slice(0, max)).catch(fallback)

function colorsSchema(base: ThemeColors) {
  return z.object(Object.fromEntries(COLOR_KEYS.map(k => [k, color(base[k])])) as Record<keyof ThemeColors, ReturnType<typeof color>>)
}

const ids = <T extends { id: string }>(items: readonly T[]) => items.map(i => i.id) as [T['id'], ...T['id'][]]

function styleSchema(baseColors: ThemeColors) {
  return z.object({
    layout: oneOf(LAYOUT_IDS as [string, ...string[]], D.layout),
    frame: oneOf(['none', 'margin', 'line', 'double'], D.frame),
    themeId: text(D.themeId, 40),
    colors: colorsSchema(baseColors).catch({ ...baseColors }),
    map: z.object({
      detail: oneOf(['low', 'medium', 'high'], D.map.detail),
      roads: oneOf(['major', 'standard', 'all'], D.map.roads),
      buildings: bool(D.map.buildings),
      parks: bool(D.map.parks),
      water: bool(D.map.water),
      rail: bool(D.map.rail),
      labels: bool(D.map.labels),
      lineWidth: clamped(0.4, 2.5, D.map.lineWidth),
    }).catch({ ...D.map }),
    typography: z.object({
      font: oneOf(ids(FONT_PRESETS), D.typography.font),
      size: oneOf(['s', 'm', 'l'], D.typography.size),
      uppercase: bool(D.typography.uppercase),
      coordFormat: oneOf(['dms', 'dm', 'decimal'], D.typography.coordFormat),
    }).catch({ ...D.typography }),
    output: z.object({
      paper: oneOf(ids(PAPER_FORMATS), D.output.paper),
      customWidthCm: clamped(CUSTOM_SIZE_LIMITS.min, CUSTOM_SIZE_LIMITS.max, D.output.customWidthCm),
      customHeightCm: clamped(CUSTOM_SIZE_LIMITS.min, CUSTOM_SIZE_LIMITS.max, D.output.customHeightCm),
      orientation: oneOf(['portrait', 'landscape'], D.output.orientation),
      resolution: oneOf(ids(RESOLUTIONS), D.output.resolution),
      fileType: oneOf(['png', 'jpeg', 'pdf'], D.output.fileType),
      jpegQuality: clamped(0.5, 1, D.output.jpegQuality),
    }).catch({ ...D.output }),
    attribution: bool(D.attribution),
  })
}

function contentSchema(fallback: PosterContent) {
  return z.object({
    view: z.object({
      lng: z.number().refine(Number.isFinite).transform(wrapLng).catch(fallback.view.lng),
      lat: z.number().refine(Number.isFinite).transform(clampLat).catch(fallback.view.lat),
      zoom: clamped(0, 20, fallback.view.zoom),
      bearing: clamped(-180, 180, 0),
    }).catch({ ...fallback.view }),
    text: z.object({
      title: text(fallback.text.title),
      subtitle: text(fallback.text.subtitle),
      showTitle: bool(true),
      showSubtitle: bool(true),
      showCoords: bool(true),
      coordsMode: oneOf(['auto', 'custom'], 'auto'),
      coordsCustom: text(''),
    }).catch({ ...fallback.text }),
    place: z.object({
      name: text('', 120),
      country: z.string().max(120).optional().catch(undefined),
      countryCode: z.string().max(8).optional().catch(undefined),
    }).nullable().catch(null),
  })
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Validates and completes a (possibly partial or old) style object. */
export function normalizeStyle(input: unknown): PosterStyle {
  const obj = isObject(input) ? input : {}
  // Missing colors fall back to the named theme (or the default theme).
  const theme = typeof obj.themeId === 'string' ? getTheme(obj.themeId) : undefined
  const baseColors = theme?.colors ?? D.colors
  const style = styleSchema(baseColors).parse(obj) as PosterStyle
  if (!getTheme(style.themeId) && style.themeId !== 'custom') style.themeId = 'custom'
  return style
}

/** Validates and completes a poster content object. */
export function normalizeContent(input: unknown, locale = 'en'): PosterContent {
  const fallback = defaultContent(locale)
  return contentSchema(fallback).parse(isObject(input) ? input : {}) as PosterContent
}

export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createProfile(name: string, style: PosterStyle, content?: PosterContent): Profile {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: name.trim().slice(0, 80) || 'Untitled',
    createdAt: now,
    updatedAt: now,
    style: clonePlain(style),
    ...(content ? { content: clonePlain(content) } : {}),
  }
}

function profileFileObject(p: Profile) {
  return {
    $schema: PROFILE_SCHEMA_URL,
    app: PROFILE_APP,
    kind: 'profile',
    version: PROFILE_VERSION,
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    style: p.style,
    ...(p.content ? { content: p.content } : {}),
  }
}

export function serializeProfile(p: Profile): string {
  return `${JSON.stringify(profileFileObject(p), null, 2)}\n`
}

export function serializeProfiles(profiles: Profile[]): string {
  const bundle = {
    $schema: PROFILE_SCHEMA_URL,
    app: PROFILE_APP,
    kind: 'profile-bundle',
    version: PROFILE_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: profiles.map(profileFileObject).map(({ $schema: _s, app: _a, version: _v, ...rest }) => rest),
  }
  return `${JSON.stringify(bundle, null, 2)}\n`
}

export class ProfileParseError extends Error {
  constructor(public code: 'invalid-json' | 'not-a-profile' | 'newer-version' | 'empty', message?: string) {
    super(message ?? code)
    this.name = 'ProfileParseError'
  }
}

function isoDate(v: unknown, fallback: string) {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fallback
}

function looksLikeStyle(o: Record<string, unknown>) {
  return ['layout', 'colors', 'themeId', 'typography', 'map'].some(k => k in o)
}

function toProfile(o: Record<string, unknown>, locale: string, fallbackName: string): Profile {
  const now = new Date().toISOString()
  const hasStyle = isObject(o.style)
  const style = normalizeStyle(hasStyle ? o.style : o)
  const content = isObject(o.content) ? normalizeContent(o.content, locale) : undefined
  return {
    id: typeof o.id === 'string' && o.id.length <= 64 && o.id ? o.id : newId(),
    name: (typeof o.name === 'string' && o.name.trim() ? o.name.trim() : fallbackName).slice(0, 80),
    createdAt: isoDate(o.createdAt, now),
    updatedAt: isoDate(o.updatedAt, now),
    style,
    ...(content ? { content } : {}),
  }
}

/**
 * Parses the contents of a profile file (single profile, bundle, or a bare style object).
 * Throws {@link ProfileParseError} for things that are clearly not a profile.
 */
export function parseProfileFile(raw: string | unknown, opts: { locale?: string, fallbackName?: string } = {}): Profile[] {
  const locale = opts.locale ?? 'en'
  const fallbackName = opts.fallbackName ?? 'Imported profile'
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw.replace(/^\uFEFF/, ''))
    } catch {
      throw new ProfileParseError('invalid-json')
    }
  }
  if (!isObject(data)) throw new ProfileParseError('not-a-profile')
  if (typeof data.app === 'string' && data.app !== PROFILE_APP) throw new ProfileParseError('not-a-profile')
  if (typeof data.version === 'number' && data.version > PROFILE_VERSION) throw new ProfileParseError('newer-version')

  if (data.kind === 'profile-bundle' || Array.isArray(data.profiles)) {
    const list = Array.isArray(data.profiles) ? data.profiles.filter(isObject) : []
    if (!list.length) throw new ProfileParseError('empty')
    return list.map((p, i) => toProfile(p, locale, `${fallbackName} ${i + 1}`))
  }
  if (data.kind === 'profile' || isObject(data.style) || looksLikeStyle(data)) {
    return [toProfile(data, locale, fallbackName)]
  }
  throw new ProfileParseError('not-a-profile')
}

/** Validates the profile list stored in localStorage; drops anything broken. */
export function parseStoredProfiles(raw: string | null, locale = 'en'): Profile[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter(isObject).map(p => toProfile(p, locale, 'Profile'))
  } catch {
    return []
  }
}

/** Stable comparison of two styles (used for the "unsaved changes" indicator). */
export function sameStyle(a: PosterStyle, b: PosterStyle) {
  return JSON.stringify(normalizeStyle(a)) === JSON.stringify(normalizeStyle(b))
}

/** File name for downloads, e.g. `hamburg-blue.iwh.json`. */
export function profileFileName(name: string) {
  return `${slugify(name) || 'profile'}.iwh.json`
}

export function slugify(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
