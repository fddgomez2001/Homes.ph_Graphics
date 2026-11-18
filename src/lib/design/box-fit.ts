import type { MeasureText } from "./layout"
import type { SlideDesign, TextElement } from "./types"

/**
 * Fit text to a fixed box (the poster headline: 1006 × 231, League Spartan 68 / 100%).
 * The text wraps at its width. Long text shrinks from `maxSize` until it is no taller
 * than `maxHeight`; short text grows (up to `growTo`) to fill the space while it keeps
 * its number of lines. Nothing ever leaves the box.
 */

const MIN_SIZE = 8

/** The element at `size`, with line height and letter spacing scaled to match. */
export function boxSized(el: TextElement, size: number): TextElement {
  const fit = el.boxFit
  const ratio = fit?.lineHeightRatio ?? (el.fontSize > 0 ? el.lineHeight / el.fontSize : 1)
  const em = fit?.letterSpacingEm ?? (el.fontSize > 0 ? el.letterSpacing / el.fontSize : 0)
  return {
    ...el,
    fontSize: size,
    lineHeight: Math.round(size * ratio * 100) / 100,
    letterSpacing: Math.round(em * size * 100) / 100,
  }
}

/** The largest whole font size that fits: grown up to `growTo` for short text, shrunk down to `minSize` for long text. */
export function fitBoxSize(el: TextElement, measure: MeasureText): number {
  const fit = el.boxFit
  if (!fit) return el.fontSize
  const max = Math.max(MIN_SIZE, Math.round(fit.maxSize))
  const min = Math.min(max, Math.max(MIN_SIZE, Math.round(fit.minSize ?? MIN_SIZE)))
  const fits = (size: number) => measure(boxSized(el, size)) <= fit.maxHeight + 0.5
  if (!el.text.trim()) return max
  if (fits(max)) {
    const grow = Math.round(fit.growTo ?? 0)
    if (grow <= max) return max
    // Grow while it fits and doesn't wrap onto more lines (no single word pushed to a new line).
    // A background's padding (the banner subtext) is in the height but isn't a line.
    const padding = el.background?.enabled ? Math.max(0, el.background.padding) * 2 : 0
    const linesAt = (size: number) => {
      const sized = boxSized(el, size)
      return Math.round((measure(sized) - padding) / Math.max(1, sized.lineHeight))
    }
    const lines = linesAt(max)
    const ok = (size: number) => fits(size) && linesAt(size) <= lines
    let lo = max
    let hi = grow
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (ok(mid)) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  if (!fits(min)) return min
  // Binary search: `lo` always fits, everything above `hi` doesn't.
  let lo = min
  let hi = max - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (fits(mid)) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** The element with its sizes capped at `cap` (for the share-of-another-text rule). */
function capped(el: TextElement, cap: number): TextElement {
  const fit = el.boxFit!
  if (!Number.isFinite(cap)) return el
  const top = Math.max(MIN_SIZE, Math.floor(cap))
  return {
    ...el,
    boxFit: {
      ...fit,
      maxSize: Math.min(fit.maxSize, top),
      minSize: Math.min(fit.minSize ?? MIN_SIZE, top),
      ...(fit.growTo !== undefined ? { growTo: Math.min(fit.growTo, top) } : {}),
    },
  }
}

const shown = (el: TextElement | undefined): el is TextElement => !!el && el.visible && el.text.trim() !== ""

/**
 * A text and the one under it sharing one space (the poster headline and its subtext): the
 * lower one fits first (it can grow when short), the upper one gets what's left. When the
 * lower one may only be a share of the upper one's size, it's brought down until it is.
 */
function fitShared(upper: TextElement, lower: TextElement, measure: MeasureText): [number, number] {
  const share = upper.boxFit!.shareWith!
  const rule = lower.boxFit?.maxRatioOf?.id === upper.id ? lower.boxFit.maxRatioOf.ratio : null
  const first = fitPair(upper, lower, upper.boxFit!.maxHeight, rule, measure)
  const spare = share.spare ?? 0
  // Both at their design size or bigger: the design's own layout stands.
  if (spare <= 0 || (first[0] >= upper.boxFit!.maxSize && first[1] >= lower.boxFit!.maxSize)) return first
  // One came out small: the pair gets the spare room under it, and the lower one a little more height
  // and share, so neither is small when there's space on the poster. Never smaller than before.
  const roomier: TextElement = { ...lower, boxFit: { ...lower.boxFit!, maxHeight: lower.boxFit!.maxHeight + Math.round(spare * SPARE_TO_LOWER) } }
  const second = fitPair(upper, roomier, upper.boxFit!.maxHeight + spare, rule === null ? null : rule + SPARE_RATIO, measure)
  return second[0] >= first[0] && second[1] >= first[1] ? second : first
}

/** With spare room: this share of it may go to the lower text's own height, and it may be this much more of the upper one's size. */
const SPARE_TO_LOWER = 0.3
const SPARE_RATIO = 0.05

/**
 * The two sizes for a shared space of `room`: the lower one as big as it can be while the upper
 * one, which gets the rest, still leads (the lower is at most `rule` of the upper's size).
 */
function fitPair(upper: TextElement, lower: TextElement, room: number, rule: number | null, measure: MeasureText): [number, number] {
  const gap = upper.boxFit!.shareWith!.gap
  const solve = (cap: number): [number, number] => {
    const below = capped(lower, cap)
    const lowerSize = fitBoxSize(below, measure)
    const lowerHeight = measure(boxSized(below, lowerSize))
    const upperSize = fitBoxSize({ ...upper, boxFit: { ...upper.boxFit!, maxHeight: Math.max(1, room - lowerHeight - gap) } }, measure)
    return [upperSize, lowerSize]
  }
  const ok = (s: [number, number]) => rule === null || s[1] <= Math.floor(s[0] * rule)
  const free = solve(Number.POSITIVE_INFINITY)
  if (ok(free)) return free
  // The biggest lower size that keeps the rule (a smaller lower text leaves the upper one more room).
  let lo = Math.min(free[1], Math.max(MIN_SIZE, Math.round(lower.boxFit?.minSize ?? MIN_SIZE)))
  let hi = free[1] - 1
  let best = solve(lo)
  lo += 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const s = solve(mid)
    if (ok(s)) {
      best = s
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

/** A hugging text at its full width (it's fitted there; applyHug narrows it afterwards). */
function unhugged(el: TextElement): TextElement {
  if (!el.hug) return el
  const x = el.hug.centerX - el.hug.maxWidth / 2
  return el.width === el.hug.maxWidth && el.x === x ? el : { ...el, x, width: el.hug.maxWidth }
}

/** Fits every box-fit text element. Returns the same object when nothing changed. */
export function applyBoxFit(design: SlideDesign, measure: MeasureText): SlideDesign {
  if (!design.elements.some((el) => el.type === "text" && el.boxFit)) return design
  const full = design.elements.map((el) => (el.type === "text" ? unhugged(el) : el))
  const byId = new Map(full.map((el) => [el.id, el]))
  const sizes = new Map<string, number>()
  for (const el of full) {
    if (el.type !== "text" || !el.boxFit?.shareWith) continue
    const lower = byId.get(el.boxFit.shareWith.id)
    if (lower?.type !== "text" || !lower.boxFit || !shown(lower)) continue
    const [upperSize, lowerSize] = fitShared(el, lower, measure)
    sizes.set(el.id, upperSize)
    sizes.set(lower.id, lowerSize)
  }
  let changed = false
  const elements = full.map((el, i) => {
    if (el.type !== "text" || !el.boxFit) {
      if (el !== design.elements[i]) changed = true
      return el
    }
    const next = boxSized(el, sizes.get(el.id) ?? fitBoxSize(el, measure))
    const before = design.elements[i] as TextElement
    if (
      next.fontSize === before.fontSize &&
      next.lineHeight === before.lineHeight &&
      next.letterSpacing === before.letterSpacing &&
      next.x === before.x &&
      next.width === before.width
    )
      return before
    changed = true
    return next
  })
  return changed ? { ...design, elements } : design
}

/** Width of the widest line of a text as it wraps in its box (padding not included). */
export type MeasureWidest = (el: TextElement) => number

/**
 * Narrows each hugging text (the banner subtext) to its widest line plus its padding,
 * centered, so its background band hugs the words. Run after applyBoxFit.
 */
export function applyHug(design: SlideDesign, widest: MeasureWidest): SlideDesign {
  if (!design.elements.some((el) => el.type === "text" && el.hug)) return design
  let changed = false
  const elements = design.elements.map((el) => {
    if (el.type !== "text" || !el.hug) return el
    const full = unhugged(el)
    const padding = full.background?.enabled ? Math.max(0, full.background.padding) : 0
    // A pixel to spare so the lines wrap exactly as they did at full width.
    const width = Math.min(full.hug!.maxWidth, Math.ceil(widest(full) + 2 * padding + 2))
    const x = Math.round((full.hug!.centerX - width / 2) * 100) / 100
    if (el.width === width && el.x === x) return el
    changed = true
    return { ...el, x, width }
  })
  return changed ? { ...design, elements } : design
}
