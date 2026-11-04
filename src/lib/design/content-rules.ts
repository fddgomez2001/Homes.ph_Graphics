import { imageUpscaleFactor } from "./geometry"
import type { MeasureText } from "./layout"
import { textPadding } from "./konva-attrs"
import type { SlideDesign, TextElement } from "./types"

/** A Homes.ph content card's description should fill 2–3 lines. */
export const DESCRIPTION_LINES = { min: 2, max: 3 } as const

export interface ContentIssue {
  elementId: string
  elementName: string
  kind: "description-short" | "description-long"
  lines: number
  message: string
}

/** Rendered line count of a text element (0 when empty). */
export function lineCount(el: TextElement, measure: MeasureText): number {
  if (!el.text.trim()) return 0
  return Math.max(1, Math.round((measure(el) - textPadding(el) * 2) / Math.max(1, el.lineHeight)))
}

export function cardDescription(design: SlideDesign): TextElement | undefined {
  if (design.templateId !== "homes-card") return undefined
  return design.elements.find((e): e is TextElement => e.type === "text" && e.role === "description" && e.visible)
}

/** Friendly checks on the slide's content (currently: card description length). */
export function findContentIssues(design: SlideDesign, measure: MeasureText): ContentIssue[] {
  const el = cardDescription(design)
  if (!el) return []
  const lines = lineCount(el, measure)
  const base = { elementId: el.id, elementName: el.name, lines }
  if (lines < DESCRIPTION_LINES.min) {
    return [
      {
        ...base,
        kind: "description-short",
        message:
          lines === 0
            ? "Add a card description — it should fill 2 to 3 lines."
            : "The description is only 1 line. Add a few more words so it fills 2 to 3 lines.",
      },
    ]
  }
  if (lines > DESCRIPTION_LINES.max) {
    return [{ ...base, kind: "description-long", message: `The description is ${lines} lines. Please shorten it to 3 lines or fewer.` }]
  }
  return []
}

/** "2 lines · good" style status for a description field. */
export function descriptionStatus(el: TextElement, measure: MeasureText) {
  const lines = lineCount(el, measure)
  const ok = lines >= DESCRIPTION_LINES.min && lines <= DESCRIPTION_LINES.max
  return { lines, ok }
}

/** Photos smaller than their frame: the export has to enlarge them, so they look softer than the rest. */
export function lowResolutionPhotos(design: SlideDesign) {
  return design.elements.flatMap((el) => {
    // Brand files (logo, icons, swoosh) ship with the app at the right size.
    if (el.type !== "image" || !el.visible || !el.src || el.src.startsWith("/") || el.role === "logo") return []
    const factor = imageUpscaleFactor(el)
    if (factor <= 1.05) return []
    return [
      {
        message: `“${el.name}” is ${el.naturalWidth} × ${el.naturalHeight} px, so it's enlarged ${factor.toFixed(1)}× and will look softer. For full sharpness use an original of at least ${Math.ceil(el.naturalWidth * factor)} × ${Math.ceil(el.naturalHeight * factor)} px.`,
      },
    ]
  })
}
