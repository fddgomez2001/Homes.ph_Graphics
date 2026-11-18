"use client"

import type { SlideDesign } from "@/lib/design/types"
import { getDesktop, type ReportFolderBrand, type ReportSection } from "@/lib/desktop"

/**
 * The images the floating report saves with each copy: the News Article post of a posting time,
 * a Daily Trend News poster, or the day's carousel as one picture (cover and cards together).
 * Every file stays under 4.5 MB: PNG when it fits, else a high-quality JPEG (made smaller only
 * when even that is too big).
 */

/** Under 4.5 MB however it's counted (4.5 × 1000² and 4.5 × 1024²). */
export const REPORT_FILE_MAX = 4_400_000

export interface EncodedImage {
  blob: Blob
  type: "image/png" | "image/jpeg"
  width: number
  height: number
}

function toBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The image couldn't be encoded."))), type, quality),
  )
}

/** The canvas on white (JPEG has no transparency), optionally smaller. */
function flatten(source: HTMLCanvasElement, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * The best-looking file under `max` bytes: lossless PNG when it fits, otherwise JPEG from
 * quality 0.95 down to 0.8, and only then a slightly smaller picture.
 */
export async function encodeUnder(canvas: HTMLCanvasElement, max = REPORT_FILE_MAX, opts: { tryPng?: boolean } = {}): Promise<EncodedImage> {
  if (opts.tryPng !== false) {
    const png = await toBlob(canvas, "image/png")
    if (png.size <= max) return { blob: png, type: "image/png", width: canvas.width, height: canvas.height }
  }
  let scale = 1
  for (let round = 0; round < 6; round++) {
    const flat = flatten(canvas, scale)
    for (const quality of round === 0 ? [0.95, 0.92, 0.88, 0.84, 0.8] : [0.88]) {
      const jpeg = await toBlob(flat, "image/jpeg", quality)
      if (jpeg.size <= max) return { blob: jpeg, type: "image/jpeg", width: flat.width, height: flat.height }
    }
    scale *= 0.85
  }
  throw new Error("The image is too big to save under 4.5 MB.")
}

/** A design at its full size (photos at full resolution); a missing photo doesn't stop it. */
export async function renderFullSize(design: SlideDesign): Promise<HTMLCanvasElement> {
  const { renderDesignToCanvas } = await import("@/lib/design/render")
  try {
    return await renderDesignToCanvas(design, { pixelRatio: 1 })
  } catch {
    return renderDesignToCanvas(design, { pixelRatio: 1, tolerateMissingImages: true })
  }
}

/** How a carousel's slides sit in one picture: rows of up to 4, the last row centered. */
export function collageLayout(count: number, tile: number, aspect = 1, gap = 28, pad = 56) {
  const rows = count <= 4 ? 1 : count <= 8 ? 2 : Math.ceil(count / 4)
  const cols = Math.ceil(count / rows)
  const tileH = Math.round(tile * aspect)
  const width = pad * 2 + cols * tile + (cols - 1) * gap
  const height = pad * 2 + rows * tileH + (rows - 1) * gap
  const cells = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, count - row * cols)
    const offset = ((cols - inRow) * (tile + gap)) / 2
    return { x: Math.round(pad + offset + (i % cols) * (tile + gap)), y: pad + row * (tileH + gap), width: tile, height: tileH }
  })
  return { width, height, cells }
}

/** The whole carousel in one picture: the cover first, then the cards, in order. */
export async function renderCarouselCollage(slides: SlideDesign[], tile = 960): Promise<HTMLCanvasElement> {
  if (!slides.length) throw new Error("The carousel has no slides.")
  const { renderDesignToCanvas } = await import("@/lib/design/render")
  const first = slides[0]
  const aspect = first.height / first.width
  const layout = collageLayout(slides.length, tile, aspect)
  const canvas = document.createElement("canvas")
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#F3F5FA"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  for (const [i, design] of slides.entries()) {
    const cell = layout.cells[i]
    const ratio = cell.width / design.width
    const slide = await renderDesignToCanvas(design, { pixelRatio: ratio, tolerateMissingImages: true })
    ctx.save()
    ctx.shadowColor = "rgba(13, 25, 105, 0.18)"
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height)
    ctx.restore()
    ctx.drawImage(slide, cell.x, cell.y, cell.width, cell.height)
  }
  return canvas
}

export interface SavedReportFile {
  /** Full path in the desktop app; the file name in a browser (it went to the browser's downloads). */
  where: string
  bytes: number
  desktop: boolean
}

/**
 * Saves an image into the report folder (desktop: <report folder>\<section>\<brand>\, replacing
 * the same name), or downloads it in a browser.
 */
export async function saveReportImage(canvas: HTMLCanvasElement, section: ReportSection, brand: ReportFolderBrand | "", baseName: string, opts: { tryPng?: boolean } = {}): Promise<SavedReportFile> {
  const image = await encodeUnder(canvas, REPORT_FILE_MAX, opts)
  const name = `${baseName}.${image.type === "image/png" ? "png" : "jpg"}`
  const desktop = getDesktop()
  if (desktop?.saveReportFile) {
    const where = await desktop.saveReportFile(section, brand, name, new Uint8Array(await image.blob.arrayBuffer()))
    return { where, bytes: image.blob.size, desktop: true }
  }
  const { downloadBlob } = await import("@/lib/export")
  downloadBlob(image.blob, name)
  return { where: name, bytes: image.blob.size, desktop: false }
}

/** "2.1 MB" */
export function fileSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`
}
