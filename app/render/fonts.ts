import { cssFont } from '~/core/fonts'
import { clearMeasureCache } from './text'

type Face = { family: string, weight: number, style: 'normal' | 'italic' }

const SAMPLE = 'AÄÖÜBCDEFGHIJKLMNOPQRSTUVWXYZaäbcdefghijklmnoöpqrstuüvwxyzß0123456789°\'".,'

/**
 * Loads the given font faces (only the unicode ranges needed for `text`).
 * Resolves even if a font fails – canvas will fall back to a system font.
 */
export async function ensureFonts(faces: Face[], text = '') {
  if (typeof document === 'undefined' || !document.fonts) return
  const sample = SAMPLE + text
  const before = faces.map(f => document.fonts.check(cssFont(f, 32), sample))
  await Promise.all(faces.map(f => document.fonts.load(cssFont(f, 32), sample).catch(() => [])))
  const after = faces.map(f => document.fonts.check(cssFont(f, 32), sample))
  if (after.some((ok, i) => ok !== before[i])) clearMeasureCache()
}
