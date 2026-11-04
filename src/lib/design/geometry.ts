import type { Fill, ImageElement } from "./types"

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Cover-fit math (CSS object-fit: cover) with zoom and focus.
 * Returns where the *whole* source image sits in frame coordinates, and the
 * source-pixel crop that is visible inside the frame.
 */
export function coverLayout(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
  zoom = 1,
  focusX = 0.5,
  focusY = 0.5,
) {
  const nw = Math.max(1, naturalWidth)
  const nh = Math.max(1, naturalHeight)
  const fw = Math.max(1, frameWidth)
  const fh = Math.max(1, frameHeight)
  const scale = Math.max(fw / nw, fh / nh) * Math.max(1, zoom)
  const displayWidth = nw * scale
  const displayHeight = nh * scale
  const overflowX = Math.max(0, displayWidth - fw)
  const overflowY = Math.max(0, displayHeight - fh)
  const fx = clamp01(focusX)
  const fy = clamp01(focusY)
  const image: Rect = { x: -overflowX * fx, y: -overflowY * fy, width: displayWidth, height: displayHeight }
  const crop: Rect = {
    x: (overflowX * fx) / scale,
    y: (overflowY * fy) / scale,
    width: fw / scale,
    height: fh / scale,
  }
  return { scale, image, crop, overflowX, overflowY }
}

/** Contain-fit: the whole image inside the frame, centered, aspect ratio preserved. */
export function containLayout(naturalWidth: number, naturalHeight: number, frameWidth: number, frameHeight: number) {
  const nw = Math.max(1, naturalWidth)
  const nh = Math.max(1, naturalHeight)
  const scale = Math.min(frameWidth / nw, frameHeight / nh)
  const width = nw * scale
  const height = nh * scale
  return { scale, image: { x: (frameWidth - width) / 2, y: (frameHeight - height) / 2, width, height } }
}

/** Inverse of coverLayout: focus values for an image dragged to (imageX, imageY) in frame space. */
export function focusFromImageOffset(imageX: number, imageY: number, overflowX: number, overflowY: number) {
  return {
    focusX: overflowX > 0 ? clamp01(-imageX / overflowX) : 0.5,
    focusY: overflowY > 0 ? clamp01(-imageY / overflowY) : 0.5,
  }
}

/** How many output pixels each source pixel covers. > 1 means the image is being upscaled. */
export function imageUpscaleFactor(el: Pick<ImageElement, "naturalWidth" | "naturalHeight" | "width" | "height" | "fit" | "zoom">) {
  if (!el.naturalWidth || !el.naturalHeight) return 1
  if (el.fit === "contain") return containLayout(el.naturalWidth, el.naturalHeight, el.width, el.height).scale
  return coverLayout(el.naturalWidth, el.naturalHeight, el.width, el.height, el.zoom).scale
}

/** CSS linear-gradient angle → start/end points across a w × h box (matches browser rendering). */
export function gradientPoints(angleDeg: number, width: number, height: number) {
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const length = Math.abs(width * dx) + Math.abs(height * dy)
  const cx = width / 2
  const cy = height / 2
  // Round away floating-point noise (e.g. sin(180°) ≈ 1e-16).
  const r = (v: number) => Math.round(v * 1000) / 1000 + 0
  return {
    start: { x: r(cx - (dx * length) / 2), y: r(cy - (dy * length) / 2) },
    end: { x: r(cx + (dx * length) / 2), y: r(cy + (dy * length) / 2) },
  }
}

/** Konva fill attributes for a solid or linear-gradient fill over a w × h box. */
export function konvaFillAttrs(fill: Fill, width: number, height: number): Record<string, unknown> {
  if (fill.type === "solid") {
    return { fill: fill.color, fillPriority: "color" }
  }
  if (fill.type === "radial") {
    // Konva radial gradients are circular; elliptical/blurred glows are drawn by glow.ts instead.
    const stops = [...fill.stops].sort((a, b) => a.offset - b.offset)
    return {
      fillPriority: "radial-gradient",
      fillRadialGradientStartPoint: { x: fill.cx * width, y: fill.cy * height },
      fillRadialGradientEndPoint: { x: fill.cx * width, y: fill.cy * height },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: Math.max(fill.rx * width, fill.ry * height),
      fillRadialGradientColorStops: stops.flatMap((s) => [clamp01(s.offset), s.color]),
    }
  }
  const { start, end } = gradientPoints(fill.angle, width, height)
  const stops = [...fill.stops].sort((a, b) => a.offset - b.offset)
  return {
    fillPriority: "linear-gradient",
    fillLinearGradientStartPoint: start,
    fillLinearGradientEndPoint: end,
    fillLinearGradientColorStops: stops.flatMap((s) => [clamp01(s.offset), s.color]),
  }
}

/** CSS string for previews (e.g. swatches in the UI). */
export function fillToCss(fill: Fill): string {
  if (fill.type === "solid") return fill.color
  const stops = [...fill.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(", ")
  if (fill.type === "radial") {
    const pct = (v: number) => `${Math.round(v * 10000) / 100}%`
    return `radial-gradient(${pct(fill.rx)} ${pct(fill.ry)} at ${pct(fill.cx)} ${pct(fill.cy)}, ${stops})`
  }
  return `linear-gradient(${fill.angle}deg, ${stops})`
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5))
}
