/**
 * Picture filters (1.54): a picture's look (presets like Vivid, Warm, B&W, or brightness, contrast, saturation,
 * warmth, blur and black & white by hand), for added pictures and a brand post's own photo. Drawn as a filtered
 * copy of the picture (the editor, every export and the brand templates draw the same).
 */

export interface ImageFilter {
  /** The preset picked (null: set by hand). */
  preset?: string | null
  /** 1 = as is. */
  brightness: number
  contrast: number
  saturation: number
  /** -1 (cool) … 0 … 1 (warm). */
  warmth: number
  /** px (at the picture's own size). */
  blur: number
  /** 0–1 */
  grayscale: number
}

export const NO_FILTER: ImageFilter = { preset: null, brightness: 1, contrast: 1, saturation: 1, warmth: 0, blur: 0, grayscale: 0 }

export const FILTER_PRESETS: readonly { id: string; name: string; values: Omit<ImageFilter, "preset"> }[] = [
  { id: "vivid", name: "Vivid", values: { ...NO_FILTER, contrast: 1.12, saturation: 1.35, brightness: 1.03 } },
  { id: "bright", name: "Bright", values: { ...NO_FILTER, brightness: 1.15, contrast: 1.05, saturation: 1.08 } },
  { id: "warm", name: "Warm", values: { ...NO_FILTER, warmth: 0.55, saturation: 1.12, brightness: 1.03 } },
  { id: "cool", name: "Cool", values: { ...NO_FILTER, warmth: -0.55, saturation: 1.05 } },
  { id: "dramatic", name: "Dramatic", values: { ...NO_FILTER, contrast: 1.35, saturation: 0.9, brightness: 0.95 } },
  { id: "vintage", name: "Vintage", values: { ...NO_FILTER, warmth: 0.8, contrast: 0.9, saturation: 0.8, brightness: 1.05 } },
  { id: "soft", name: "Soft", values: { ...NO_FILTER, contrast: 0.88, brightness: 1.06, saturation: 0.95, blur: 0.6 } },
  { id: "bw", name: "B&W", values: { ...NO_FILTER, grayscale: 1, contrast: 1.12 } },
  { id: "noir", name: "Noir", values: { ...NO_FILTER, grayscale: 1, contrast: 1.4, brightness: 0.92 } },
]

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)

/** A saved filter, checked (null when it changes nothing or isn't one). */
export function normalizeFilter(raw: unknown): ImageFilter | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const f: ImageFilter = {
    preset: typeof r.preset === "string" && FILTER_PRESETS.some((p) => p.id === r.preset) ? r.preset : null,
    brightness: clamp(r.brightness, 0.2, 2, 1),
    contrast: clamp(r.contrast, 0.2, 2, 1),
    saturation: clamp(r.saturation, 0, 3, 1),
    warmth: clamp(r.warmth, -1, 1, 0),
    blur: clamp(r.blur, 0, 40, 0),
    grayscale: clamp(r.grayscale, 0, 1, 0),
  }
  return filterCss(f) ? f : null
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.005

/** The filter as CSS (canvas `filter`), "" when it changes nothing. */
export function filterCss(f: ImageFilter | null | undefined): string {
  if (!f) return ""
  const parts: string[] = []
  if (!near(f.brightness, 1)) parts.push(`brightness(${f.brightness.toFixed(3)})`)
  if (!near(f.contrast, 1)) parts.push(`contrast(${f.contrast.toFixed(3)})`)
  if (!near(f.saturation, 1)) parts.push(`saturate(${f.saturation.toFixed(3)})`)
  // Warm: a touch of sepia; cool: hues turned toward blue.
  if (f.warmth > 0.005) parts.push(`sepia(${(f.warmth * 0.4).toFixed(3)})`)
  if (f.warmth < -0.005) parts.push(`hue-rotate(${(f.warmth * 14).toFixed(1)}deg)`, `saturate(${(1 - f.warmth * 0.1).toFixed(3)})`)
  if (f.grayscale > 0.005) parts.push(`grayscale(${f.grayscale.toFixed(3)})`)
  if (f.blur > 0.05) parts.push(`blur(${f.blur.toFixed(2)}px)`)
  return parts.join(" ")
}

type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap

const sizeOf = (img: Drawable) => (img instanceof HTMLImageElement ? { w: img.naturalWidth, h: img.naturalHeight } : { w: img.width, h: img.height })

const cache = new WeakMap<object, Map<string, HTMLCanvasElement>>()

/** The picture with the filter on it (same size), kept for the next draw. */
export function filteredBitmap(img: Drawable, css: string): HTMLCanvasElement {
  let mine = cache.get(img)
  if (!mine) {
    mine = new Map()
    cache.set(img, mine)
  }
  const hit = mine.get(css)
  if (hit) return hit
  const { w, h } = sizeOf(img)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, w)
  canvas.height = Math.max(1, h)
  const ctx = canvas.getContext("2d")!
  ctx.filter = css
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  // A few looks per picture are kept (the sliders make many).
  if (mine.size > 4) mine.delete(mine.keys().next().value!)
  mine.set(css, canvas)
  return canvas
}
