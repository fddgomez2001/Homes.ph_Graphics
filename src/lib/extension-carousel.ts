"use client"

import { addDays, parse, startOfDay } from "date-fns"
import { listPostChecks, listPostPages, setPostCheck } from "@/lib/data/posting"
import { getProject, getProjectSlides, listProjects, projectFeatures } from "@/lib/data/projects"
import { getDesktop } from "@/lib/desktop"

/**
 * What the Homes.ph Publisher Chrome extension asks the app about carousels (through the desktop bridge): the
 * carousels scheduled on a day with their Facebook pages (the posting checklist) and the pages ticked, the
 * slides as numbered PNGs (1.png is the cover, saved in the download folder like the PNGs button), and the
 * pages a Facebook post went to, ticked on the checklist.
 */

export interface ExtensionCarouselPage {
  key: string
  /** "Homes.ph Ozamiz" */
  name: string
  /** "Ozamiz" */
  short: string
  sort: number
}

export interface ExtensionCarousel {
  id: string
  title: string
  caption: string
  scheduledAt: string | null
  status: string
  slides: number
  revision: number
  /** The pages ticked on its checklist. */
  checks: { key: string; by: string; at: string }[]
}

/** The carousels scheduled on `day` ("2026-11-12"), the checklist's pages, and each carousel's ticks. */
export async function extensionCarouselDay({ day }: { day: string }) {
  const from = startOfDay(parse(day, "yyyy-MM-dd", new Date()))
  const projects = await listProjects({ kind: "carousel", from: from.toISOString(), to: addDays(from, 1).toISOString(), orderBy: "scheduled_at", ascending: true, limit: 20 })
  const features = await projectFeatures().catch(() => null)
  const checklist = !!features?.posting
  const pages = checklist ? await listPostPages() : []
  const carousels: ExtensionCarousel[] = await Promise.all(
    projects
      .filter((p) => !p.deleted_at && !p.archived_at)
      .map(async (p) => ({
        id: p.id,
        title: p.title,
        caption: p.caption ?? "",
        scheduledAt: p.scheduled_at,
        status: p.status,
        slides: p.slide_count,
        revision: p.revision,
        checks: checklist ? (await listPostChecks(p.id)).map((c) => ({ key: c.page_key, by: c.checked_by_name, at: c.checked_at })) : [],
      })),
  )
  const list: ExtensionCarouselPage[] = pages.map((p) => ({ key: p.key, name: p.name, short: p.short_name, sort: p.sort }))
  return { day, checklist, pages: list, carousels }
}

/** Carousels whose PNGs were saved in the download folder this session (id → revision): saved once per version. */
const savedRevision = new Map<string, number>()

async function base64Of(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ""
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

/**
 * The carousel's slides as PNGs at full size, named in order (1.png = the cover, 2.png…). The first time
 * (per version) they're also saved like the PNGs button: Downloads\<date-title>\1.png, 2.png…
 */
export async function extensionCarouselImages({ projectId, save }: { projectId: string; save: boolean }) {
  const project = await getProject(projectId)
  const lib = await import("@/lib/export")
  const slides = lib.slidesFromRows(await getProjectSlides(projectId))
  if (!slides.length) throw new Error("This carousel has no slides.")
  const { ensureFonts } = await import("@/lib/design/fonts")
  await ensureFonts(slides.map((s) => s.design))
  const { files, failures } = await lib.renderSlides(project, slides, "png", 1)
  if (failures.length) throw new Error(`Slide ${failures[0].slide} couldn't be drawn: ${failures[0].message}`)
  let savedTo: string | null = null
  if (save && savedRevision.get(projectId) !== project.revision) {
    const name = lib.exportBaseName(project)
    const folder = getDesktop()?.exportFolder
    if (folder && files.length > 1) await folder(name, files.length).catch(() => {})
    for (const file of files) {
      lib.downloadBlob(file.blob, file.name)
      // Downloads close together may be dropped.
      if (files.length > 1) await new Promise((r) => setTimeout(r, 350))
    }
    savedRevision.set(projectId, project.revision)
    savedTo = folder && files.length > 1 ? `Downloads\\${name}` : "Downloads"
  }
  return {
    projectId,
    title: project.title,
    savedTo,
    files: await Promise.all(files.map(async (f) => ({ name: f.name, type: "image/png", base64: await base64Of(f.blob) }))),
  }
}

/** The Facebook post went to these pages: they're ticked on the carousel's checklist (by you, now). */
export async function extensionCarouselPosted({ projectId, pageKeys }: { projectId: string; pageKeys: string[]; facebook?: "posted" | "scheduled" | null }) {
  const features = await projectFeatures().catch(() => null)
  if (!features?.posting) throw new Error("The 17-page posting checklist is off in this app (its database update isn't run yet).")
  const pages = await listPostPages()
  const known = new Set(pages.map((p) => p.key))
  const ticked = pageKeys.filter((k) => known.has(k))
  for (const key of ticked) await setPostCheck(projectId, key, true)
  const checks = await listPostChecks(projectId)
  const done = checks.filter((c) => known.has(c.page_key)).length
  return {
    projectId,
    ticked,
    names: ticked.map((k) => pages.find((p) => p.key === k)?.short_name ?? k),
    done,
    total: pages.length,
    checks: checks.map((c) => ({ key: c.page_key, by: c.checked_by_name, at: c.checked_at })),
  }
}
