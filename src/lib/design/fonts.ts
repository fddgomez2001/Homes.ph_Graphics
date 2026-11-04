import { FONTS } from "./constants"
import type { SlideDesign } from "./types"

const BASE_SAMPLE = "AaBbCcGgQq0123456789₱"

/**
 * Inter backs up the brand fonts for glyphs they don't include (Outfit has no ₱
 * peso sign, for example), so those characters never drop to a random system font.
 */
export const FALLBACK_FAMILY = "Inter"

/** Font-family list used on the canvas and in the in-place editor. */
export function fontStack(family: string): string {
  return family === FALLBACK_FAMILY ? `${family}, sans-serif` : `${family}, ${FALLBACK_FAMILY}, sans-serif`
}

export function cssFontStack(family: string): string {
  return family === FALLBACK_FAMILY ? `"${family}", sans-serif` : `"${family}", "${FALLBACK_FAMILY}", sans-serif`
}

function fontSpec(family: string, weight: number) {
  return `${weight} 48px ${cssFontStack(family)}`
}

/** Nearest weight the family actually ships (e.g. Plus Jakarta Sans has no 900). */
export function supportedWeight(family: string, weight: number): number {
  const option = FONTS.find((f) => f.family === family)
  if (!option) return weight
  return option.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), option.weights[0])
}

/** Loads one font face (no-op if it's already available). */
export async function loadFont(family: string, weight: number, sample = BASE_SAMPLE): Promise<boolean> {
  if (typeof document === "undefined" || !document.fonts) return true
  try {
    await document.fonts.load(fontSpec(family, weight), sample)
    return document.fonts.check(fontSpec(family, weight), sample)
  } catch {
    return false
  }
}

/**
 * Waits until every font used by the given designs is loaded, so canvas text is
 * measured and drawn with the real typeface (required before any export).
 * Resolves with the list of fonts that could not be loaded.
 */
export async function ensureFonts(designs: SlideDesign[], timeoutMs = 10000): Promise<string[]> {
  if (typeof document === "undefined" || !document.fonts) return []
  const samples = new Map<string, { family: string; weight: number; text: string }>()
  for (const design of designs) {
    for (const el of design.elements) {
      if (el.type !== "text") continue
      const key = `${el.fontFamily}|${el.fontWeight}`
      const entry = samples.get(key) ?? { family: el.fontFamily, weight: el.fontWeight, text: BASE_SAMPLE }
      if (entry.text.length < 2000) entry.text += el.text.slice(0, 500)
      samples.set(key, entry)
    }
  }
  const missing: string[] = []
  const work = Promise.all(
    [...samples.values()].map(async ({ family, weight, text }) => {
      const ok = await loadFont(family, weight, uniqueChars(text))
      if (!ok) missing.push(`${family} ${weight}`)
    }),
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs)
  })
  const result = await Promise.race([work.then(() => "done" as const), timeout])
  clearTimeout(timer)
  if (result === "timeout") return [...samples.values()].map((s) => `${s.family} ${s.weight}`)
  return missing
}

function uniqueChars(text: string) {
  return [...new Set(text)].join("")
}
