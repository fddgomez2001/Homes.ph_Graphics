"use client"

import { gradientPoints } from "./geometry"
import type { Fill, ShapeElement } from "./types"

/**
 * Soft shapes (radial gradients and CSS `filter: blur()`) are painted once into a
 * bitmap with the browser's own canvas blur, then drawn like an image — identical
 * in the editor and the export. Blurred glows have no fine detail, so they are
 * painted at reduced resolution and scaled up smoothly.
 */

export interface GlowBitmap {
  canvas: HTMLCanvasElement
  /** Extra space around the element box the blur spreads into (design px). */
  pad: number
}

const cache = new Map<string, GlowBitmap>()

export function isGlowShape(el: ShapeElement): boolean {
  return el.fill.type === "radial" || (el.blur ?? 0) > 0
}

function addStops(gradient: CanvasGradient, stops: { offset: number; color: string }[]) {
  for (const stop of [...stops].sort((a, b) => a.offset - b.offset)) {
    gradient.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color)
  }
}

function paintFill(ctx: CanvasRenderingContext2D, fill: Fill, x: number, y: number, w: number, h: number, radius: number) {
  ctx.save()
  ctx.beginPath()
  if (radius > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, radius)
  else ctx.rect(x, y, w, h)
  ctx.clip()
  if (fill.type === "solid") {
    ctx.fillStyle = fill.color
    ctx.fillRect(x, y, w, h)
  } else if (fill.type === "linear") {
    const { start, end } = gradientPoints(fill.angle, w, h)
    const gradient = ctx.createLinearGradient(x + start.x, y + start.y, x + end.x, y + end.y)
    addStops(gradient, fill.stops)
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, w, h)
  } else {
    // Elliptical gradient: a unit circle stretched to the ellipse radii.
    const rx = Math.max(0.0001, fill.rx * w)
    const ry = Math.max(0.0001, fill.ry * h)
    ctx.translate(x + fill.cx * w, y + fill.cy * h)
    ctx.scale(rx, ry)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    addStops(gradient, fill.stops)
    ctx.fillStyle = gradient
    ctx.fillRect(-(fill.cx * w) / rx, -(fill.cy * h) / ry, w / rx, h / ry)
  }
  ctx.restore()
}

export function glowBitmap(el: ShapeElement): GlowBitmap {
  const blur = Math.max(0, el.blur ?? 0)
  const key = JSON.stringify([el.width, el.height, el.fill, blur, el.cornerRadius])
  const hit = cache.get(key)
  if (hit) return hit

  const pad = Math.ceil(blur * 3)
  const k = blur > 0 ? 0.25 : 0.5
  const width = Math.max(1, Math.ceil((el.width + pad * 2) * k))
  const height = Math.max(1, Math.ceil((el.height + pad * 2) * k))

  const shape = document.createElement("canvas")
  shape.width = width
  shape.height = height
  paintFill(shape.getContext("2d")!, el.fill, pad * k, pad * k, el.width * k, el.height * k, el.cornerRadius * k)

  let canvas = shape
  if (blur > 0) {
    const out = document.createElement("canvas")
    out.width = width
    out.height = height
    const ctx = out.getContext("2d")!
    // Standard deviation in bitmap pixels, applied with an identity transform (same as CSS blur()).
    ctx.filter = `blur(${blur * k}px)`
    ctx.drawImage(shape, 0, 0)
    canvas = out
  }

  const result = { canvas, pad }
  if (cache.size > 40) cache.delete(cache.keys().next().value!)
  cache.set(key, result)
  return result
}
