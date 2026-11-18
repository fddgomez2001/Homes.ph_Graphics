"use client"

/**
 * Draws a brand post (1.52): its SVG template, filled in the page (where its text can be measured), then made a
 * picture with its fonts and photos inside it (nothing is fetched from the internet), so the preview, the board,
 * the download and the posted picture are the same, pixel for pixel, at any size.
 */
import { loadImage } from "@/lib/design/image-cache"
import type { SlideDesign } from "@/lib/design/types"
import { brandPostTemplate, templateSrc } from "./catalog"
import { fillEngagement, fillPoster } from "./fill"
import { TEMPLATE_FONTS } from "./manifest"
import { filterCss } from "@/lib/design/filters"
import { engagementFillOf, photoNamed, posterFillOf, SECOND_PHOTO } from "./posts"

const SVG_NS = "http://www.w3.org/2000/svg"
const FONT_DIR = "/brand/templates/fonts/"

export class BrandPostError extends Error {}

// ---------- templates ----------

const templates = new Map<string, Promise<string>>()

/** A template's SVG (fetched once). */
export function loadTemplate(file: string): Promise<string> {
  let p = templates.get(file)
  if (!p) {
    p = fetch(templateSrc(file)).then((r) => {
      if (!r.ok) throw new BrandPostError(`The template "${file}" could not be loaded (${r.status}).`)
      return r.text()
    })
    p.catch(() => templates.delete(file))
    templates.set(file, p)
  }
  return p
}

// ---------- fonts ----------

/** The fonts a template uses (by family). */
const familiesIn = (svg: string) => [...new Set(TEMPLATE_FONTS.map((f) => f.family).filter((family) => svg.includes(family)))]

let registered = false
const faces = new Map<string, FontFace>()

/** The templates' fonts in this page (for measuring the text), from the app's own files. */
function registerFonts() {
  if (registered || typeof document === "undefined" || typeof FontFace === "undefined") return
  registered = true
  for (const f of TEMPLATE_FONTS) {
    const face = new FontFace(f.family, `url(${FONT_DIR}${f.file}) format("woff2")`, { weight: String(f.weight), unicodeRange: f.unicodeRange })
    document.fonts.add(face)
    faces.set(f.file, face)
  }
}

/** Loads every font a template uses before its text is measured. */
async function loadFonts(svg: string) {
  registerFonts()
  const families = familiesIn(svg)
  await Promise.all(TEMPLATE_FONTS.filter((f) => families.includes(f.family)).map((f) => faces.get(f.file)?.load().catch(() => null)))
}

const fontData = new Map<string, Promise<string>>()

async function dataUrlOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function fontDataUrl(file: string) {
  let p = fontData.get(file)
  if (!p) {
    p = fetch(FONT_DIR + file)
      .then((r) => {
        if (!r.ok) throw new BrandPostError(`The font ${file} could not be loaded.`)
        return r.blob()
      })
      .then((b) => dataUrlOf(new Blob([b], { type: "font/woff2" })))
    p.catch(() => fontData.delete(file))
    fontData.set(file, p)
  }
  return p
}

/** The template's fonts as CSS inside the picture. */
async function fontCss(svg: string) {
  const families = familiesIn(svg)
  const used = TEMPLATE_FONTS.filter((f) => families.includes(f.family))
  const rules = await Promise.all(
    used.map(async (f) => `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};src:url(${await fontDataUrl(f.file)}) format("woff2");unicode-range:${f.unicodeRange}}`),
  )
  return rules.join("\n")
}

// ---------- photos ----------

const photos = new Map<string, Promise<string>>()
/** The longest side a photo is put in the picture at (sharp at 3× zoom on a 1080 px poster). */
const PHOTO_MAX = 2600

/** A photo as a picture inside the SVG (smaller when it's very big), with its filter (1.54) when it has one. */
function photoDataUrl(src: string, filter = "") {
  const key = `${src}|${filter}`
  let p = photos.get(key)
  if (!p) {
    p = loadImage(src).then((img) => {
      const k = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
      const ctx = canvas.getContext("2d")!
      ctx.imageSmoothingQuality = "high"
      if (filter) ctx.filter = filter
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      // A see-through picture stays PNG; photos are JPEG (much smaller).
      return canvas.toDataURL(seeThrough(img) ? "image/png" : "image/jpeg", 0.93)
    })
    p.catch(() => photos.delete(key))
    photos.set(key, p)
    // Only the latest few are kept.
    if (photos.size > 12) photos.delete(photos.keys().next().value!)
  }
  return p
}

/** The picture has see-through pixels (checked on a small copy). */
function seeThrough(img: HTMLImageElement) {
  try {
    const c = document.createElement("canvas")
    c.width = 48
    c.height = 48
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, 48, 48)
    const px = ctx.getImageData(0, 0, 48, 48).data
    for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return true
  } catch {
    // can't be read: treated as a photo
  }
  return false
}

async function photoOrNull(src: string | null | undefined, tolerate: boolean, filter = ""): Promise<string | null> {
  if (!src) return null
  try {
    return await photoDataUrl(src, filter)
  } catch (e) {
    if (tolerate) return null
    throw new BrandPostError(`The photo could not be loaded. ${(e as Error).message}`)
  }
}

// ---------- filling ----------

let hostEl: HTMLElement | null = null

/** Where templates are filled (off screen: the text must be laid out to be measured). */
function host() {
  if (hostEl?.isConnected) return hostEl
  hostEl = document.createElement("div")
  hostEl.setAttribute("aria-hidden", "true")
  Object.assign(hostEl.style, { position: "fixed", left: "-40000px", top: "0", width: "1200px", height: "1500px", overflow: "hidden", opacity: "0", pointerEvents: "none", zIndex: "-1" })
  document.body.appendChild(hostEl)
  return hostEl
}

export interface BrandPostRenderOptions {
  /** Draw without a photo that can't be loaded (previews) instead of failing. */
  tolerateMissingImages?: boolean
  /** Only one of the template's layers (its top-level part's id, e.g. "layer-photo", "text-block"). */
  part?: string
}

/** The template filled with the post (its fonts and photos inside it), not yet a picture. */
async function filledSvg(design: SlideDesign, options: BrandPostRenderOptions): Promise<SVGSVGElement> {
  const t = brandPostTemplate(design.templateId)
  if (!t || !design.brandPost) throw new BrandPostError("This post's template is unknown.")
  const file = t.file
  const source = await loadTemplate(file)
  const tolerate = !!options.tolerateMissingImages
  const p1 = photoNamed(design, "Photo")
  const p2 = photoNamed(design, SECOND_PHOTO)
  const [, photo1, photo2, css] = await Promise.all([
    loadFonts(source),
    photoOrNull(p1?.src, tolerate, filterCss(p1?.filter)),
    photoOrNull(p2?.src, tolerate, filterCss(p2?.filter)),
    fontCss(source),
  ])
  const doc = new DOMParser().parseFromString(source, "image/svg+xml")
  if (doc.querySelector("parsererror")) throw new BrandPostError(`The template "${file}" isn't a valid SVG.`)
  const svg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement
  host().appendChild(svg)
  try {
    if (t.kind === "news") fillPoster(svg, posterFillOf(design, photo1))
    else fillEngagement(svg, engagementFillOf(design, [photo1, photo2]))
  } finally {
    svg.remove()
  }
  // The fonts, inside the picture.
  const style = document.createElementNS(SVG_NS, "style")
  style.textContent = css
  let defs = svg.querySelector("defs")
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs")
    svg.prepend(defs)
  }
  defs.prepend(style)
  svg.setAttribute("width", String(t.info.width))
  svg.setAttribute("height", String(t.info.height))
  return svg
}

/** The filled template as SVG text; `part`: only that layer (the others taken out, its gradients and masks kept). */
function serialize(svg: SVGSVGElement, part?: string) {
  if (!part) return new XMLSerializer().serializeToString(svg)
  const copy = svg.cloneNode(true) as SVGSVGElement
  for (const child of Array.from(copy.children)) {
    const tag = child.tagName.toLowerCase()
    if (tag !== "defs" && tag !== "style" && child.id !== part) child.remove()
  }
  return new XMLSerializer().serializeToString(copy)
}

/** The post as a finished SVG (fonts and photos inside it), or one of its layers. */
export async function brandPostSvg(design: SlideDesign, options: BrandPostRenderOptions = {}): Promise<string> {
  return serialize(await filledSvg(design, options), options.part)
}

/** SVG text drawn on a canvas, `ratio` × the post's size. */
async function draw(svgText: string, width: number, height: number, ratio: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }))
  try {
    const img = new Image()
    img.decoding = "sync"
    img.src = url
    await img.decode()
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } catch (e) {
    throw e instanceof BrandPostError ? e : new BrandPostError(`The post couldn't be drawn. ${(e as Error).message ?? ""}`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * The template's layers (1.54: each of its top-level parts, as in the SVG), each on its own canvas: the editor
 * shows them, the export stacks the post's own layers between them. Filled once, drawn layer by layer.
 */
export async function renderBrandPostParts(design: SlideDesign, options: BrandPostRenderOptions & { pixelRatio?: number } = {}): Promise<Record<string, HTMLCanvasElement>> {
  const svg = await filledSvg(design, options)
  const ids = brandPostTemplate(design.templateId)?.info.layers ?? []
  const ratio = options.pixelRatio ?? 1
  const canvases = await Promise.all(ids.map((id) => draw(serialize(svg, id), design.width, design.height, ratio)))
  return Object.fromEntries(ids.map((id, i) => [id, canvases[i]]))
}

/** The post drawn on a canvas, `pixelRatio` × its size (1 = 1080 × 1350 / 1126 × 1408). */
export async function renderBrandPostToCanvas(design: SlideDesign, options: BrandPostRenderOptions & { pixelRatio?: number } = {}): Promise<HTMLCanvasElement> {
  return draw(await brandPostSvg(design, options), design.width, design.height, options.pixelRatio ?? 1)
}
