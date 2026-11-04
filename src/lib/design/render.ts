"use client"

import Konva from "konva"
import { ensureFonts } from "./fonts"
import { glowBitmap, isGlowShape } from "./glow"
import { isAutoLogo, logoForLuminance, logoSource, meanLuminance, type ResolvedLogo } from "./logo"
import { loadImage } from "./image-cache"
import {
  highQualityImageSceneFunc,
  imageDrawAttrs,
  imageGroupAttrs,
  imageShadowAttrs,
  labelAttrs,
  shapeAttrs,
  tagAttrs,
  textAttrs,
} from "./konva-attrs"
import type { DesignElement, SlideDesign } from "./types"

export class RenderError extends Error {}

interface RenderOptions {
  /** Output scale. 1 = exact design size (1254 × 1254). */
  pixelRatio?: number
  /** Skip images that fail to load instead of failing (used for previews only). */
  tolerateMissingImages?: boolean
}

/** Loads every font and full-resolution image a design needs (both logo versions for auto logos). */
async function prepare(design: SlideDesign, options: RenderOptions) {
  const missingFonts = await ensureFonts([design])
  if (missingFonts.length && !options.tolerateMissingImages) {
    throw new RenderError(`These fonts could not be loaded: ${missingFonts.join(", ")}. Check your connection and try again.`)
  }
  const sources = new Map<string, string>()
  for (const el of design.elements) {
    if (el.type !== "image" || !el.visible) continue
    if (el.src) sources.set(el.src, el.name)
    if (isAutoLogo(el)) {
      sources.set(logoSource("white").src, el.name)
      sources.set(logoSource("blue").src, el.name)
    }
  }
  const images = new Map<string, HTMLImageElement>()
  for (const [src, name] of sources) {
    try {
      images.set(src, await loadImage(src))
    } catch (error) {
      if (!options.tolerateMissingImages) throw new RenderError(`Image "${name}" could not be loaded. ${(error as Error).message}`)
    }
  }
  return images
}

interface BuiltStage {
  stage: Konva.Stage
  layer: Konva.Layer
  nodes: { el: DesignElement; node: Konva.Shape | Konva.Group }[]
}

function buildStage(design: SlideDesign, images: Map<string, HTMLImageElement>): BuiltStage {
  const container = document.createElement("div")
  const stage = new Konva.Stage({ container, width: design.width, height: design.height, listening: false })
  const layer = new Konva.Layer({ listening: false })
  stage.add(layer)
  // An opaque white base for transparent designs is only used when sampling, never exported.
  if (design.background && design.background !== "transparent") {
    layer.add(new Konva.Rect({ x: 0, y: 0, width: design.width, height: design.height, fill: design.background }))
  }
  const nodes: BuiltStage["nodes"] = []
  for (const el of design.elements) {
    if (!el.visible) continue
    const node = buildNode(el, images)
    layer.add(node)
    nodes.push({ el, node })
  }
  return { stage, layer, nodes }
}

/**
 * Picks white or blue for each automatic logo by measuring the pixels of the layers
 * below it in the logo's own area, then swaps the logo bitmap to match.
 */
function applyAutoLogos(built: BuiltStage, images: Map<string, HTMLImageElement>): Map<string, ResolvedLogo> {
  const chosen = new Map<string, ResolvedLogo>()
  built.nodes.forEach(({ el, node }, index) => {
    if (el.type !== "image" || !isAutoLogo(el)) return
    const above = built.nodes.slice(index).map((n) => n.node)
    above.forEach((n) => n.visible(false))
    let variant: ResolvedLogo = el.logoResolved ?? "white"
    try {
      const region = built.layer.toCanvas({ x: el.x, y: el.y, width: Math.max(1, el.width), height: Math.max(1, el.height), pixelRatio: 1 })
      const pixels = region.getContext("2d")!.getImageData(0, 0, region.width, region.height).data
      variant = logoForLuminance(meanLuminance(pixels))
    } catch {
      // A cross-origin image without CORS can't be measured; keep the current logo.
    } finally {
      above.forEach((n) => n.visible(true))
    }
    chosen.set(el.id, variant)
    const resolved = { ...el, ...logoSource(variant) }
    const img = images.get(resolved.src)
    const bitmap = (node as Konva.Group).findOne("Image") as Konva.Image | undefined
    if (img && bitmap) {
      const { crop, ...rect } = imageDrawAttrs(resolved, img)
      bitmap.setAttrs({ image: img, ...rect, crop })
    } else if (img) {
      const { crop, ...rect } = imageDrawAttrs(resolved, img)
      ;(node as Konva.Group).add(new Konva.Image({ image: img, ...rect, crop, ...imageShadowAttrs(el), sceneFunc: highQualityImageSceneFunc }))
    }
  })
  return chosen
}

/**
 * Renders a slide offscreen with Konva — never a screenshot of the editor, so no
 * selection handles, borders or UI can end up in the image. Waits for every font
 * and full-resolution image first.
 */
export async function renderDesignToCanvas(design: SlideDesign, options: RenderOptions = {}): Promise<HTMLCanvasElement> {
  const pixelRatio = options.pixelRatio ?? 1
  const images = await prepare(design, options)
  const built = buildStage(design, images)
  try {
    applyAutoLogos(built, images)
    const canvas = built.layer.toCanvas({ x: 0, y: 0, width: design.width, height: design.height, pixelRatio })
    const expectedW = Math.round(design.width * pixelRatio)
    const expectedH = Math.round(design.height * pixelRatio)
    if (Math.abs(canvas.width - expectedW) > 1 || Math.abs(canvas.height - expectedH) > 1) {
      throw new RenderError(`Unexpected output size ${canvas.width}×${canvas.height} (expected ${expectedW}×${expectedH}).`)
    }
    return canvas
  } finally {
    built.stage.destroy()
  }
}

/** Which logo (white/blue) each automatic logo should show — the same decision the export makes. */
export async function resolveAutoLogos(design: SlideDesign): Promise<Map<string, ResolvedLogo>> {
  if (!design.elements.some((el) => el.type === "image" && el.visible && isAutoLogo(el))) return new Map()
  const images = await prepare(design, { tolerateMissingImages: true })
  const built = buildStage(design, images)
  try {
    return applyAutoLogos(built, images)
  } finally {
    built.stage.destroy()
  }
}

function buildNode(el: DesignElement, images: Map<string, HTMLImageElement>): Konva.Shape | Konva.Group {
  switch (el.type) {
    case "text": {
      const label = new Konva.Label(labelAttrs(el))
      label.add(new Konva.Tag(tagAttrs(el)))
      label.add(new Konva.Text(textAttrs(el) as Konva.TextConfig))
      return label
    }
    case "shape": {
      if (!isGlowShape(el)) return new Konva.Rect(shapeAttrs(el) as Konva.RectConfig)
      const { canvas, pad } = glowBitmap(el)
      const group = new Konva.Group({ id: el.id, x: el.x, y: el.y, rotation: el.rotation, opacity: el.opacity, visible: el.visible })
      group.add(new Konva.Image({ image: canvas, x: -pad, y: -pad, width: el.width + pad * 2, height: el.height + pad * 2, sceneFunc: highQualityImageSceneFunc }))
      return group
    }
    case "image": {
      const group = new Konva.Group(imageGroupAttrs(el))
      const img = el.src ? images.get(el.src) : undefined
      if (img) {
        const { crop, ...rect } = imageDrawAttrs(el, img)
        group.add(new Konva.Image({ image: img, ...rect, crop, ...imageShadowAttrs(el), sceneFunc: highQualityImageSceneFunc }))
      }
      return group
    }
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new RenderError("The browser could not encode the image."))), type, quality)
  })
}

export type ExportFormat = "png" | "jpeg"

/** Final export: exactly design.width × design.height pixels. */
/** Exactly 1254 × 1254 from the full-resolution originals: PNG is lossless, JPEG uses the maximum quality. */
export async function renderSlideImage(design: SlideDesign, format: ExportFormat, jpegQuality = 1): Promise<Blob> {
  let canvas = await renderDesignToCanvas(design, { pixelRatio: 1 })
  if (format === "jpeg") {
    // JPEG has no alpha channel: flatten onto white instead of black.
    const flat = document.createElement("canvas")
    flat.width = canvas.width
    flat.height = canvas.height
    const ctx = flat.getContext("2d")!
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, flat.width, flat.height)
    ctx.drawImage(canvas, 0, 0)
    canvas = flat
    return canvasToBlob(canvas, "image/jpeg", jpegQuality)
  }
  return canvasToBlob(canvas, "image/png")
}

/** Small JPEG data URL for lists and slide strips. Never used as an export source. */
export async function renderThumbnail(design: SlideDesign, size = 320, quality = 0.8, tolerateMissingImages = true): Promise<string> {
  const canvas = await renderDesignToCanvas(design, {
    pixelRatio: size / design.width,
    tolerateMissingImages,
  })
  const flat = document.createElement("canvas")
  flat.width = canvas.width
  flat.height = canvas.height
  const ctx = flat.getContext("2d")!
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  return flat.toDataURL("image/jpeg", quality)
}
