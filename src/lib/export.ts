"use client"

import { zipSync, strToU8 } from "fflate"
import { format } from "date-fns"
import { findContentIssues, lowResolutionPhotos } from "@/lib/design/content-rules"
import { findTextWarnings } from "@/lib/design/layout"
import { measureTextHeight } from "@/lib/design/measure"
import { normalizeDesign } from "@/lib/design/normalize"
import { renderSlideImage, type ExportFormat } from "@/lib/design/render"
import type { SlideDesign, SlideType } from "@/lib/design/types"
import { STATUS_LABELS, type ProjectRow, type SlideRow } from "@/lib/types"
import { slugify } from "@/lib/utils"

export interface ExportSlide {
  type: SlideType
  design: SlideDesign
}

export interface ExportProjectMeta {
  title: string
  caption: string
  status: ProjectRow["status"]
  scheduled_at: string | null
  topic?: string | null
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function exportBaseName(meta: Pick<ExportProjectMeta, "title" | "scheduled_at">) {
  const date = meta.scheduled_at ? format(new Date(meta.scheduled_at), "yyyy-MM-dd") : "unscheduled"
  return `${date}-${slugify(meta.title)}`
}

/** Slides are numbered in carousel order: the cover is 1.png, then 2.png, 3.png… */
export function slideFileName(index: number, fmt: ExportFormat) {
  return `${index + 1}.${fmt === "jpeg" ? "jpg" : "png"}`
}

/** Text that would be cut off, card descriptions outside 2–3 lines and soft (enlarged) photos, per slide (1-based numbers). */
export function exportWarnings(slides: ExportSlide[]) {
  return slides.flatMap((slide, index) =>
    [
      ...findTextWarnings(slide.design, measureTextHeight),
      ...findContentIssues(slide.design, measureTextHeight),
      ...lowResolutionPhotos(slide.design),
    ].map((w) => ({
      slide: index + 1,
      message: w.message,
    })),
  )
}

export function buildProjectSummary(meta: ExportProjectMeta, slides: ExportSlide[]): string {
  const lines: string[] = []
  lines.push(meta.title)
  lines.push("=".repeat(Math.min(60, Math.max(3, meta.title.length))))
  lines.push(`Status: ${STATUS_LABELS[meta.status]}`)
  lines.push(`Publication date: ${meta.scheduled_at ? format(new Date(meta.scheduled_at), "EEEE, MMMM d, yyyy 'at' h:mm a") : "Not scheduled"}`)
  if (meta.topic) lines.push(`Topic: ${meta.topic}`)
  const first = slides[0]?.design
  lines.push(`Slides: ${slides.length} (${first?.width ?? 1254} × ${first?.height ?? 1254} px each; 1.png is the cover)`)
  lines.push("")
  lines.push("CAPTION")
  lines.push("-------")
  lines.push(meta.caption?.trim() || "(no caption)")
  lines.push("")
  lines.push("SLIDES")
  lines.push("------")
  slides.forEach((slide, index) => {
    lines.push(`${index + 1}. ${slide.type === "cover" ? "Cover" : "Card"}`)
    for (const el of slide.design.elements) {
      if (el.type === "text" && el.visible && el.text.trim()) {
        lines.push(`   ${el.name}: ${el.text.replace(/\s*\n\s*/g, " / ")}`)
      }
    }
  })
  lines.push("")
  return lines.join("\n")
}

export interface RenderedSlide {
  index: number
  name: string
  blob: Blob
}

export interface ExportProgress {
  done: number
  total: number
  failures: { slide: number; message: string }[]
}

/**
 * Renders slides one at a time (keeps memory low). A failed slide is reported
 * and skipped; it never silently produces a broken file.
 */
export async function renderSlides(
  meta: ExportProjectMeta,
  slides: ExportSlide[],
  fmt: ExportFormat,
  jpegQuality: number,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ files: RenderedSlide[]; failures: ExportProgress["failures"] }> {
  const files: RenderedSlide[] = []
  const failures: ExportProgress["failures"] = []
  for (let i = 0; i < slides.length; i++) {
    onProgress?.({ done: i, total: slides.length, failures })
    try {
      const blob = await renderSlideImage(slides[i].design, fmt, jpegQuality)
      files.push({ index: i, name: slideFileName(i, fmt), blob })
    } catch (error) {
      failures.push({ slide: i + 1, message: (error as Error).message })
    }
  }
  onProgress?.({ done: slides.length, total: slides.length, failures })
  return { files, failures }
}

export async function buildZip(meta: ExportProjectMeta, files: RenderedSlide[], slides: ExportSlide[]): Promise<Blob> {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}
  for (const file of files) {
    // PNG/JPEG are already compressed: store them as-is.
    entries[file.name] = [new Uint8Array(await file.blob.arrayBuffer()), { level: 0 }]
  }
  entries["summary.txt"] = [strToU8(buildProjectSummary(meta, slides)), { level: 6 }]
  const zipped = zipSync(entries)
  return new Blob([zipped as BlobPart], { type: "application/zip" })
}

/** Turns saved slide rows into exportable slides. */
export function slidesFromRows(rows: SlideRow[]): ExportSlide[] {
  return [...rows]
    .sort((a, b) => a.slide_order - b.slide_order)
    .map((row) => ({ type: row.slide_type, design: normalizeDesign(row.design_json) }))
}
