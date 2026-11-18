"use client"

import { addDays, format, parse, startOfDay } from "date-fns"
import { createNewsArticle, newsHeadline, storeNewsPhoto, updateNewsArticle } from "@/lib/data/news"
import { getProjectSlides, listProjects, updateProject } from "@/lib/data/projects"
import { combineDateTime } from "@/lib/dates"
import { defaultArticleTemplate, newsFileName, newsTimeLabel } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { isPageLane, reportBrandLabel, reportBrandOfDesign, templateBrandOf, type ReportBrand } from "@/lib/news-lanes"
import { homesPage, type HomesPageKey } from "@/lib/pages"
import type { ProjectRow } from "@/lib/types"

/**
 * What the Homes.ph Publisher Chrome extension asks the app (through the desktop bridge): the article it
 * publishes becomes the News Article post of its slot (brand, day, time) with its headline and photo, the
 * template is drawn and saved in the download folder, and the picture goes back to the extension for the
 * Facebook post. When the Facebook post is scheduled or posted, the post is marked published.
 */
export interface ExtensionNewsInput {
  /** The daily brand, or another Homes.ph page's row ("homes:cebu", 1.50). */
  brand: ReportBrand
  /** "2026-11-10" */
  day: string
  /** "22:00" */
  time: string
  headline: string
  /** The article on the brand's site (the READ MORE link). */
  articleUrl?: string
  image?: { base64: string; type: string; name: string }
}

const brandName = (brand: ReportBrand) => reportBrandLabel(brand)
/** The page's name kept on a Homes.ph page's post ("Homes.ph Cebu"). */
const pageOf = (brand: ReportBrand) => (isPageLane(brand) ? homesPage(brand.slice(6) as HomesPageKey).name : null)

function bytesOf(base64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function base64Of(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ""
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

/** The slot's News Article post (not a poster): the brand's post at that time on that day. */
export async function findSlotPost(brand: ReportBrand, day: string, time: string): Promise<ProjectRow | null> {
  const from = startOfDay(parse(day, "yyyy-MM-dd", new Date()))
  const projects = await listProjects({ kind: "news", from: from.toISOString(), to: addDays(from, 1).toISOString(), orderBy: "scheduled_at", ascending: true, limit: 200 })
  for (const p of projects) {
    if (!p.scheduled_at || format(new Date(p.scheduled_at), "HH:mm") !== time) continue
    const design = (await getProjectSlides(p.id))[0]?.design_json
    if (!design) continue
    if (reportBrandOfDesign(normalizeDesign(design)) === brand) return p
  }
  return null
}

/** The post's template as a PNG (its full size). */
async function renderPost(projectId: string): Promise<{ blob: Blob; width: number; height: number }> {
  const row = (await getProjectSlides(projectId))[0]
  if (!row) throw new Error("The News Article post has no design.")
  const design = normalizeDesign(row.design_json)
  const { renderFullSize } = await import("@/lib/report/report-files")
  const canvas = await renderFullSize(design)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The template couldn't be drawn."))), "image/png"))
  return { blob, width: design.width, height: design.height }
}

/**
 * The extension published an article: it's the slot's News Article post now (created, or the one already
 * there gets the headline and photo), its template PNG is saved in the download folder and returned.
 */
export async function extensionNewsPost(input: ExtensionNewsInput) {
  const photo = input.image ? await storeNewsPhoto(new File([bytesOf(input.image.base64)], input.image.name, { type: input.image.type })) : undefined
  const existing = await findSlotPost(input.brand, input.day, input.time)
  let projectId: string
  if (existing) {
    projectId = existing.id
    await updateNewsArticle(projectId, { headline: input.headline, ...(photo ? { photo } : {}) })
  } else {
    projectId = await createNewsArticle({
      templateId: defaultArticleTemplate(templateBrandOf(input.brand), parse(input.day, "yyyy-MM-dd", new Date())).id,
      headline: input.headline,
      scheduledAt: combineDateTime(input.day, input.time),
      photo,
      page: pageOf(input.brand),
    })
  }
  const { blob, width, height } = await renderPost(projectId)
  const slot = { time: input.time, label: newsTimeLabel(input.time) }
  const fileName = newsFileName(parse(input.day, "yyyy-MM-dd", new Date()), slot, brandName(input.brand))
  // Saved like the board's PNG button (the desktop app puts it in the download folder).
  const { downloadBlob } = await import("@/lib/export")
  downloadBlob(blob, fileName)
  return { projectId, created: !existing, fileName, width, height, png: await base64Of(blob) }
}

/** The article is published and its Facebook post scheduled (or posted): the News Article post says so. */
export async function extensionNewsStatus(input: ExtensionNewsInput & { projectId?: string | null; facebook?: "scheduled" | "posted" | null }) {
  const post = input.projectId ? { id: input.projectId } : await findSlotPost(input.brand, input.day, input.time)
  if (!post) return { updated: false }
  const rows = await getProjectSlides(post.id)
  const headline = rows[0] ? newsHeadline(normalizeDesign(rows[0].design_json)) : input.headline
  await updateProject(post.id, {
    status: "published",
    posted_at: new Date().toISOString(),
    ...(input.articleUrl ? { caption: `${headline}\n\nREAD MORE: ${input.articleUrl}` } : {}),
  })
  return { updated: true, projectId: post.id }
}
