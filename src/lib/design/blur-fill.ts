import { coverLayout, frameLayout } from "./geometry"
import type { ImageElement } from "./types"

/**
 * The blurred copy of a photo that fills its frame's empty space when the photo is zoomed
 * out (the poster photo card). Small (256 px), slightly darker so the photo stands out,
 * made once per image.
 */

const SIZE = 256
const BLUR = 10
const cache = new WeakMap<CanvasImageSource, HTMLCanvasElement>()

type Source = HTMLImageElement | HTMLCanvasElement | ImageBitmap

function sizeOf(image: Source) {
  return image instanceof HTMLImageElement ? { w: image.naturalWidth, h: image.naturalHeight } : { w: image.width, h: image.height }
}

export function blurredCopy(image: Source): HTMLCanvasElement {
  const cached = cache.get(image)
  if (cached) return cached
  const { w: nw, h: nh } = sizeOf(image)
  const k = SIZE / Math.max(1, nw, nh)
  const w = Math.max(8, Math.round(nw * k))
  const h = Math.max(8, Math.round(nh * k))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  if (typeof ctx.filter === "string") {
    // Drawn a little bigger than the canvas so the blur doesn't fade out at the edges.
    ctx.drawImage(image, 0, 0, w, h)
    ctx.filter = `blur(${BLUR}px) brightness(0.82) saturate(1.1)`
    const m = BLUR * 2
    ctx.drawImage(image, -m, -m, w + 2 * m, h + 2 * m)
    ctx.filter = "none"
  } else {
    // No canvas filters (old Safari): a tiny copy stretched back up is blurry too.
    const tiny = document.createElement("canvas")
    tiny.width = Math.max(2, Math.round(w / 16))
    tiny.height = Math.max(2, Math.round(h / 16))
    tiny.getContext("2d")?.drawImage(image, 0, 0, tiny.width, tiny.height)
    ctx.drawImage(tiny, 0, 0, w, h)
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)"
    ctx.fillRect(0, 0, w, h)
  }
  cache.set(image, canvas)
  return canvas
}

/**
 * The blurred backdrop for a blur-fill photo that doesn't cover its frame right now (zoomed
 * out), covering the whole frame; null when the photo covers it (nothing to fill).
 */
export function blurBackdrop(el: ImageElement, image: Source | null | undefined) {
  if (!image || !el.blurFill || el.fit !== "cover") return null
  const { w, h } = sizeOf(image)
  if (frameLayout(w || el.naturalWidth, h || el.naturalHeight, el.width, el.height, el.zoom, el.focusX, el.focusY).covers) return null
  const copy = blurredCopy(image)
  const { crop } = coverLayout(copy.width, copy.height, el.width, el.height)
  return { image: copy, x: 0, y: 0, width: el.width, height: el.height, crop }
}
