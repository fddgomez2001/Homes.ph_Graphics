import type { DesignElement, SlideDesign, TextElement, TextStack, TextStackItem } from "./types"

/** Measures the rendered height of a text element in canvas px. */
export type MeasureText = (el: TextElement) => number

interface ShownItem {
  item: TextStackItem
  /** Position in stack.items (definition order). */
  index: number
  el: TextElement
}

/** Stack items that take up space: visible text with something written in it. */
function shownItems(design: SlideDesign, stack: TextStack): ShownItem[] {
  const byId = new Map(design.elements.map((el) => [el.id, el]))
  return stack.items
    .map((item, index) => ({ item, index, el: byId.get(item.id) }))
    .filter((x): x is ShownItem => x.el?.type === "text" && x.el.visible && x.el.text.trim() !== "")
}

function itemHeight(entry: ShownItem, measure: MeasureText) {
  return Math.max(measure(entry.el), entry.item.minHeight ?? 0)
}

function itemGap(shown: ShownItem[], i: number) {
  if (i === 0) return 0
  const { item, index } = shown[i]
  // The item listed right before this one was skipped (e.g. an empty subtitle).
  const previousSkipped = shown[i - 1].index !== index - 1
  return previousSkipped && item.gapWithoutPrevious !== undefined ? item.gapWithoutPrevious : item.gap
}

/**
 * Re-positions the stacked text (bottom- or center-anchored, like auto layout).
 * Empty or hidden items are skipped, so e.g. clearing a card's subtitle switches
 * to the no-subtitle layout. Returns the same object when nothing moved.
 */
export function applyTextStack(design: SlideDesign, measure: MeasureText): SlideDesign {
  const stack = design.stack
  if (!stack?.enabled || stack.items.length === 0) return design
  const shown = shownItems(design, stack)
  if (shown.length === 0) return design

  const heights = shown.map((entry) => itemHeight(entry, measure))
  const gaps = shown.map((_, i) => itemGap(shown, i))
  const total = heights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0)
  let cursor = stack.anchor === "center" ? (stack.center ?? design.height / 2) - total / 2 : stack.bottom - total

  const positions = new Map<string, number>()
  shown.forEach((entry, i) => {
    cursor += gaps[i]
    positions.set(entry.el.id, Math.round(cursor))
    cursor += heights[i]
  })

  let changed = false
  const elements = design.elements.map((el) => {
    const y = positions.get(el.id)
    if (y === undefined || y === el.y) return el
    changed = true
    return { ...el, y } as DesignElement
  })
  return changed ? { ...design, elements } : design
}

/** Top and bottom edge of the stacked text block as currently placed, or null. */
export function stackBounds(design: SlideDesign, measure: MeasureText): { top: number; bottom: number } | null {
  const stack = design.stack
  if (!stack?.enabled) return null
  const shown = shownItems(design, stack)
  if (!shown.length) return null
  return {
    top: Math.min(...shown.map((s) => s.el.y)),
    bottom: Math.max(...shown.map((s) => s.el.y + itemHeight(s, measure))),
  }
}

export type TextWarningKind = "outside-canvas" | "stack-too-tall" | "stack-too-low"

export interface TextWarning {
  elementId: string
  elementName: string
  kind: TextWarningKind
  message: string
}

/** Finds text that would be clipped by the canvas edge or run into the logo or footer. */
export function findTextWarnings(design: SlideDesign, measure: MeasureText): TextWarning[] {
  const warnings: TextWarning[] = []
  const tolerance = 2
  for (const el of design.elements) {
    if (el.type !== "text" || !el.visible || !el.text.trim()) continue
    const box = rotatedBounds(el.x, el.y, el.width, measure(el), el.rotation)
    if (
      box.minX < -tolerance ||
      box.minY < -tolerance ||
      box.maxX > design.width + tolerance ||
      box.maxY > design.height + tolerance
    ) {
      warnings.push({
        elementId: el.id,
        elementName: el.name,
        kind: "outside-canvas",
        message: `"${el.name}" extends past the edge of the canvas and would be cut off in the export.`,
      })
    }
  }
  const stack = design.stack
  const bounds = stackBounds(design, measure)
  if (stack?.enabled && bounds) {
    const shown = shownItems(design, stack)
    const flagged = new Set(warnings.map((w) => w.elementId))
    const first = shown[0].el
    const last = shown[shown.length - 1].el
    if (bounds.top < stack.minTop - tolerance && !flagged.has(first.id)) {
      warnings.push({
        elementId: first.id,
        elementName: first.name,
        kind: "stack-too-tall",
        message: `The text block is too tall: "${first.name}" reaches into the logo area. Shorten the text or reduce the font size.`,
      })
    }
    if (stack.maxBottom !== undefined && bounds.bottom > stack.maxBottom + tolerance && !flagged.has(last.id)) {
      warnings.push({
        elementId: last.id,
        elementName: last.name,
        kind: "stack-too-low",
        message: `The text block is too tall: "${last.name}" runs into the footer. Shorten the text or reduce the font size.`,
      })
    }
  }
  return warnings
}

/**
 * Shrinks font sizes of the stacked text (proportionally, keeping line-height ratios)
 * until it fits between the logo and the footer and inside the canvas.
 */
export function shrinkStackToFit(
  design: SlideDesign,
  measure: MeasureText,
  options: { minScale?: number; onlyIds?: string[] } = {},
): SlideDesign {
  const minScale = options.minScale ?? 0.4
  if (!design.stack?.enabled) return shrinkTextToCanvas(design, measure, minScale)
  const ids = new Set(options.onlyIds ?? design.stack.items.map((i) => i.id))
  let current = applyTextStack(design, measure)
  let scale = 1
  for (let i = 0; i < 40; i++) {
    if (findTextWarnings(current, measure).length === 0) return current
    scale *= 0.95
    if (scale < minScale) return current
    current = applyTextStack(scaleTextElements(design, ids, scale), measure)
  }
  return current
}

function shrinkTextToCanvas(design: SlideDesign, measure: MeasureText, minScale: number): SlideDesign {
  const offending = new Set(findTextWarnings(design, measure).map((w) => w.elementId))
  if (offending.size === 0) return design
  let scale = 1
  let current = design
  for (let i = 0; i < 40 && offending.size; i++) {
    scale *= 0.95
    if (scale < minScale) break
    current = scaleTextElements(design, offending, scale)
    if (findTextWarnings(current, measure).filter((w) => offending.has(w.elementId)).length === 0) break
  }
  return current
}

function scaleTextElements(design: SlideDesign, ids: Set<string>, scale: number): SlideDesign {
  return {
    ...design,
    elements: design.elements.map((el) =>
      el.type === "text" && ids.has(el.id)
        ? {
            ...el,
            fontSize: Math.max(8, Math.round(el.fontSize * scale)),
            lineHeight: Math.max(8, Math.round(el.lineHeight * scale)),
            letterSpacing: Math.round(el.letterSpacing * scale * 10) / 10,
          }
        : el,
    ),
  }
}

export function rotatedBounds(x: number, y: number, width: number, height: number, rotationDeg: number) {
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([px, py]) => [x + px * cos - py * sin, y + px * sin + py * cos])
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}
