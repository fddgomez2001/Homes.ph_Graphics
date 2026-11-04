import type { DesignElement, SlideDesign, TextElement } from "./types"

/**
 * Port of the "Homes.ph Title Auto-Fit" Figma plugin:
 *  - each auto-fit line stays on ONE line within `maxWidth`, shrinking the font
 *    from `maxSize` (never growing past it), minimum 8 px;
 *  - line height keeps its ratio to the size (100% unless set) and letter spacing scales with the size;
 *  - the gap between the two headline lines is round(baseGap × ratio²) + extraGap,
 *    where ratio = how far the more-shrunk headline is below its own max size (capped at 1).
 */

/** Width of a text element drawn on a single line (canvas px). */
export type MeasureLine = (el: TextElement) => number

const MIN_SIZE = 8

function sized(el: TextElement, size: number): TextElement {
  const em = el.autoFit?.letterSpacingEm ?? 0
  const lineHeight = Math.round(size * (el.autoFit?.lineHeightRatio ?? 1) * 100) / 100
  return { ...el, fontSize: size, lineHeight, letterSpacing: Math.round(em * size * 100) / 100 }
}

/** Same steps as the plugin's fitSize(): exact check at max size, proportional guess, then step down. */
export function fitLineSize(el: TextElement, measure: MeasureLine): number {
  const fit = el.autoFit
  if (!fit) return el.fontSize
  const widthAt = (size: number) => measure(sized(el, size))
  const full = widthAt(fit.maxSize)
  if (full <= fit.maxWidth) return fit.maxSize
  let size = Math.max(MIN_SIZE, Math.floor((fit.maxSize * fit.maxWidth) / full))
  while (size > MIN_SIZE && widthAt(size) > fit.maxWidth) size -= 1
  return size
}

const hasText = (el: DesignElement | undefined): el is TextElement => el?.type === "text" && el.visible && el.text.trim() !== ""

/** Fits every auto-fit line and updates the headline gap. Returns the same object when nothing changed. */
export function applyTitleFit(design: SlideDesign, measure: MeasureLine): SlideDesign {
  const sizes = new Map<string, number>()
  for (const el of design.elements) {
    if (el.type === "text" && el.autoFit) sizes.set(el.id, fitLineSize(el, measure))
  }
  if (sizes.size === 0) return design

  const fit = design.titleFit
  const byId = new Map(design.elements.map((el) => [el.id, el]))
  const heads = (fit?.headlineIds ?? []).filter((id) => sizes.has(id) && hasText(byId.get(id)))
  if (fit?.matchHeadlines && heads.length > 1) {
    const smallest = Math.min(...heads.map((id) => sizes.get(id)!))
    for (const id of heads) sizes.set(id, smallest)
  }

  let changed = false
  const elements = design.elements.map((el) => {
    const size = sizes.get(el.id)
    if (size === undefined || el.type !== "text") return el
    const next = sized(el, size)
    if (next.fontSize === el.fontSize && next.lineHeight === el.lineHeight && next.letterSpacing === el.letterSpacing) return el
    changed = true
    return next
  })

  let stack = design.stack
  if (fit && stack && heads.length) {
    const maxOf = (id: string) => (byId.get(id) as TextElement).autoFit?.maxSize ?? fit.baseSize
    const ratio = Math.min(Math.min(...heads.map((id) => sizes.get(id)! / maxOf(id))), 1)
    const gap = Math.round(fit.baseGap * ratio * ratio) + (Number(fit.extraGap) || 0)
    const second = fit.headlineIds[1]
    const item = stack.items.find((i) => i.id === second)
    if (item && item.gap !== gap) {
      stack = { ...stack, items: stack.items.map((i) => (i.id === second ? { ...i, gap } : i)) }
      changed = true
    }
  }
  return changed ? { ...design, elements, stack } : design
}

/** "Headline Line 1: 98px …, Line gap: -8px", like the plugin's status panel. */
export function titleFitReport(design: SlideDesign): string[] {
  const lines = design.elements
    .filter((el): el is TextElement => el.type === "text" && !!el.autoFit)
    .map((el) => `${el.name.split(" (")[0]}: ${el.fontSize}px`)
  const second = design.titleFit?.headlineIds[1]
  const gap = design.stack?.items.find((i) => i.id === second)?.gap
  return gap === undefined ? lines : [...lines, `Line gap: ${gap}px`]
}
