import type Konva from "konva"
import { slotClipPath } from "./cover-collage"
import { fontStack } from "./fonts"
import { containLayout, coverLayout, frameLayout, gradientPoints, konvaFillAttrs } from "./geometry"
import { logoDrawBox } from "./logo"
import type { ImageElement, ShapeElement, TextElement } from "./types"

/**
 * Konva attribute builders shared by the interactive editor and the offscreen
 * exporter, so an export is rendered exactly like the editor preview.
 */

export function textPadding(el: TextElement): number {
  return el.background.enabled ? Math.max(0, el.background.padding) : 0
}

/** Attributes for the Konva.Label wrapper (position/transform of a text element). */
export function labelAttrs(el: TextElement) {
  return {
    id: el.id,
    name: "element",
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: el.visible,
  }
}

export function tagAttrs(el: TextElement) {
  return {
    fill: el.background.enabled ? el.background.color : "rgba(0,0,0,0)",
    cornerRadius: el.background.enabled ? el.background.radius : 0,
  }
}

/** Height the text gradient spans: one line box per explicit line (auto-fit lines never wrap). */
function gradientHeight(el: TextElement) {
  return Math.max(1, el.lineHeight) * Math.max(1, el.text.split("\n").length) + textPadding(el) * 2
}

/** The text as shown: in capitals when the element asks for it. */
export function displayText(el: Pick<TextElement, "text" | "textCase">) {
  return el.textCase === "upper" ? el.text.toUpperCase() : el.text
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Where `phrase` first appears in `text` (ignoring case; any run of spaces or line
 * breaks matches a space), in code points. Null when it isn't there.
 */
export function findPhrase(text: string, phrase: string): { start: number; end: number } | null {
  const words = phrase.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return null
  const match = new RegExp(words.map(escapeRegExp).join("\\s+"), "iu").exec(text)
  if (!match) return null
  const start = Array.from(text.slice(0, match.index)).length
  return { start, end: start + Array.from(match[0]).length }
}

/**
 * For each non-space character of the text, in order: is it part of a highlighted
 * phrase? Null when no phrase is found (nothing to color).
 */
export function highlightFlags(text: string, phrases: readonly string[]): boolean[] | null {
  const chars = Array.from(text)
  const marked = new Array<boolean>(chars.length).fill(false)
  let any = false
  for (const phrase of phrases) {
    const at = findPhrase(text, phrase)
    if (!at) continue
    for (let i = at.start; i < at.end; i++) marked[i] = true
    any = true
  }
  if (!any) return null
  return chars.flatMap((c, i) => (/\s/u.test(c) ? [] : [marked[i]]))
}

type PartialText = Konva.Text & { _partialText: string; _partialTextX: number; _partialFillStyle?: string; _sceneFunc: (context: Konva.Context) => void }

/**
 * Draws highlighted words in their own color. Konva lays the text out and draws it as
 * usual; each line it draws is split into runs of normal and highlighted words, placed
 * by measuring the text before them (so kerning and alignment stay exactly the same).
 */
function highlightSceneFunc(flags: boolean[], fill: string) {
  return (context: Konva.Context, shape: Konva.Shape) => {
    const text = shape as PartialText
    const draw = context.fillStrokeShape
    let seen = 0
    context.fillStrokeShape = (target: Konva.Shape) => {
      if (target !== shape) return draw.call(context, target)
      const line = text._partialText
      const x = text._partialTextX
      const runs: { text: string; on: boolean }[] = []
      for (const c of Array.from(line)) {
        // Spaces join the run before them (they're invisible either way).
        const on = /\s/u.test(c) ? (runs.at(-1)?.on ?? false) : (flags[seen++] ?? false)
        if (runs.at(-1)?.on === on) runs[runs.length - 1].text += c
        else runs.push({ text: c, on })
      }
      if (!runs.some((r) => r.on)) return draw.call(context, target)
      let before = ""
      for (const run of runs) {
        text._partialText = run.text
        text._partialTextX = x + (before ? context.measureText(before).width : 0)
        text._partialFillStyle = run.on ? fill : undefined
        draw.call(context, target)
        before += run.text
      }
      text._partialText = line
      text._partialTextX = x
      text._partialFillStyle = undefined
    }
    try {
      text._sceneFunc(context)
    } finally {
      delete (context as { fillStrokeShape?: unknown }).fillStrokeShape
      if (context.fillStrokeShape !== draw) context.fillStrokeShape = draw
    }
  }
}

/** Scene function for a text element with highlighted words (undefined = Konva's own). */
export function textSceneFunc(el: TextElement) {
  const flags = el.highlight?.phrases.length && !el.fillGradient ? highlightFlags(displayText(el), el.highlight.phrases) : null
  return flags ? highlightSceneFunc(flags, el.highlight!.fill) : undefined
}

export function textAttrs(el: TextElement) {
  const fontSize = Math.max(1, el.fontSize)
  const width = Math.max(1, el.width)
  return {
    // Always present, so removing a highlight in the editor clears the custom drawing.
    sceneFunc: textSceneFunc(el),
    text: displayText(el),
    width,
    fontFamily: fontStack(el.fontFamily),
    fontSize,
    // Konva builds the CSS font string as "<fontStyle> <variant> <size>px <family>",
    // so a numeric weight here becomes e.g. "900 normal 120px Outfit".
    fontStyle: String(el.fontWeight),
    // CSS background-clip: text gradients (e.g. the gold headline) span the line box.
    ...(el.fillGradient ? konvaFillAttrs(el.fillGradient, width, gradientHeight(el)) : { fill: el.fill, fillPriority: "color" }),
    align: el.align,
    lineHeight: Math.max(1, el.lineHeight) / fontSize,
    letterSpacing: el.letterSpacing,
    padding: textPadding(el),
    wrap: el.autoFit ? "none" : "word",
    shadowEnabled: el.shadow.enabled,
    shadowColor: el.shadow.color,
    shadowBlur: el.shadow.blur,
    shadowOffsetX: el.shadow.offsetX,
    shadowOffsetY: el.shadow.offsetY,
    shadowOpacity: 1,
    perfectDrawEnabled: false,
  }
}

export function imageGroupAttrs(el: ImageElement) {
  return {
    id: el.id,
    name: "element",
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: el.visible,
    // Cover-fit photos are cropped to the frame (rounded when it has a corner radius). Contained
    // images (logos) fit inside it anyway; their clip leaves room so a drop shadow isn't cut off.
    ...(el.slot ? slotClip(el) : el.fit === "cover" && (el.cornerRadius ?? 0) > 0 ? { clipFunc: roundedClip(el.cornerRadius ?? 0) } : imageClip(el)),
  }
}

/** A cover collage photo slot is cut to its shape (clicks only count inside it too). */
function slotClip(el: ImageElement) {
  const path = slotClipPath(el)
  if (!path) return imageClip({ ...el, fit: "cover" })
  // Konva passes what the function returns to context.clip().
  const clipFunc = (() => [path]) as unknown as NonNullable<Konva.ContainerConfig["clipFunc"]>
  return { clipFunc }
}

/** Rounded-rectangle clip that follows the group's current size (also while resizing). */
function roundedClip(radius: number): NonNullable<Konva.ContainerConfig["clipFunc"]> {
  return (ctx, container) => {
    const w = container.width()
    const h = container.height()
    const r = Math.max(0, Math.min(radius, w / 2, h / 2))
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.arcTo(w, 0, w, h, r)
    ctx.arcTo(w, h, 0, h, r)
    ctx.arcTo(0, h, 0, 0, r)
    ctx.arcTo(0, 0, w, 0, r)
    ctx.closePath()
  }
}

export function imageClip(el: Pick<ImageElement, "fit" | "width" | "height" | "shadow">) {
  if (el.fit === "cover") return { clipX: 0, clipY: 0, clipWidth: el.width, clipHeight: el.height }
  const s = el.shadow
  const margin = Math.ceil(16 + (s?.enabled ? s.blur * 3 + Math.max(Math.abs(s.offsetX), Math.abs(s.offsetY)) : 0))
  return { clipX: -margin, clipY: -margin, clipWidth: el.width + margin * 2, clipHeight: el.height + margin * 2 }
}

/** CSS drop-shadow() for an image (follows the transparent PNG outline). */
export function imageShadowAttrs(el: ImageElement) {
  const s = el.shadow
  return s?.enabled
    ? { shadowEnabled: true, shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: 1 }
    : { shadowEnabled: false }
}

/** Where the bitmap is drawn inside the image group, plus the source crop (cover mode). */
export function imageDrawAttrs(el: ImageElement, image?: { naturalWidth: number; naturalHeight: number } | null) {
  const nw = image?.naturalWidth || el.naturalWidth || el.width
  const nh = image?.naturalHeight || el.naturalHeight || el.height
  if (el.fit === "contain") {
    const box = logoDrawBox(el)
    const { image: rect } = containLayout(nw, nh, box.width, box.height)
    // Always pass an explicit crop: removing the prop would leave a previous cover crop in place.
    return { ...rect, x: box.x + rect.x, y: box.y + rect.y, crop: { x: 0, y: 0, width: nw, height: nh } }
  }
  if (el.blurFill) {
    // Can be zoomed out: drawn only where the photo is (its blurred copy fills the rest).
    const { dest, crop } = frameLayout(nw, nh, el.width, el.height, el.zoom, el.focusX, el.focusY)
    return { ...dest, crop }
  }
  const { crop } = coverLayout(nw, nh, el.width, el.height, el.zoom, el.focusX, el.focusY)
  return { x: 0, y: 0, width: el.width, height: el.height, crop }
}

/** A solid or gradient border (the gradient spans the shape's own box, like a CSS border-image). */
function strokeAttrs(el: ShapeElement): Record<string, unknown> {
  const stroke = el.stroke
  if (!stroke || stroke.width <= 0) return { strokeEnabled: false, strokeLinearGradientColorStops: undefined }
  const base = { strokeEnabled: true, strokeWidth: stroke.width }
  if (!stroke.gradient) return { ...base, stroke: stroke.color, strokeLinearGradientColorStops: undefined }
  const { start, end } = gradientPoints(stroke.gradient.angle, el.width, el.height)
  const stops = [...stroke.gradient.stops].sort((a, b) => a.offset - b.offset)
  return {
    ...base,
    stroke: stroke.color,
    strokeLinearGradientStartPoint: start,
    strokeLinearGradientEndPoint: end,
    strokeLinearGradientColorStops: stops.flatMap((s) => [Math.min(1, Math.max(0, s.offset)), s.color]),
  }
}

export function shapeAttrs(el: ShapeElement) {
  return {
    id: el.id,
    name: "element",
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: el.visible,
    cornerRadius: el.cornerRadius,
    ...konvaFillAttrs(el.fill, el.width, el.height),
    ...strokeAttrs(el),
    ...(el.shadow?.enabled
      ? { shadowEnabled: true, shadowColor: el.shadow.color, shadowBlur: el.shadow.blur, shadowOffsetX: el.shadow.offsetX, shadowOffsetY: el.shadow.offsetY, shadowOpacity: 1 }
      : { shadowEnabled: false }),
    perfectDrawEnabled: false,
  }
}

/**
 * Draws images with the browser's highest-quality resampling. The bitmap is
 * always the full-resolution original; it is resampled once, straight to the
 * output size, so no intermediate downscaling ever happens.
 */
export function highQualityImageSceneFunc(context: Konva.Context, shape: Konva.Shape) {
  const native = (context as unknown as { _context: CanvasRenderingContext2D })._context
  native.imageSmoothingEnabled = true
  native.imageSmoothingQuality = "high"
  ;(shape as unknown as { _sceneFunc: (ctx: Konva.Context) => void })._sceneFunc(context)
}
