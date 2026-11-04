"use client"

import { addDays, format, startOfDay } from "date-fns"
import { newsBrandOf, newsTimesFor, type NewsBrand } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import type { SlideDesign } from "@/lib/design/types"
import type { ProjectRow } from "@/lib/types"
import { listPostChecks, listPostPages, type PostPage } from "./posting"
import { listProjects, listSlidesForProjects, projectFeatures } from "./projects"

/** A news post in one of the day's posting slots. */
export interface ReportPost {
  project: ProjectRow
  design: SlideDesign
  brand: NewsBrand
  /** "09:00" */
  time: string
}

export interface ReportCarousel {
  project: ProjectRow
  slides: SlideDesign[]
  /** Facebook pages it was posted on (checklist order). */
  postedPages: PostPage[]
  /** Pages still to post on. */
  pagesLeft: PostPage[]
}

export interface ReportDay {
  day: Date
  posts: ReportPost[]
  carousels: ReportCarousel[]
}

export interface ReportData {
  today: ReportDay
  tomorrow: ReportDay
  /** All Facebook pages (empty before the posting checklist migration). */
  pages: PostPage[]
}

async function loadDay(day: Date, pages: PostPage[], posting: boolean): Promise<ReportDay> {
  const from = startOfDay(day).toISOString()
  const to = addDays(startOfDay(day), 1).toISOString()
  const [news, carousels] = await Promise.all([
    listProjects({ kind: "news", from, to, orderBy: "scheduled_at", ascending: true, limit: 200 }),
    listProjects({ kind: "carousel", from, to, orderBy: "scheduled_at", ascending: true, limit: 50 }),
  ])
  const slides = await listSlidesForProjects([...news, ...carousels].map((p) => p.id))
  const designsOf = (id: string) => slides.filter((s) => s.project_id === id).map((s) => normalizeDesign(s.design_json))

  const posts: ReportPost[] = []
  for (const project of news) {
    const design = designsOf(project.id)[0]
    const time = project.scheduled_at ? format(new Date(project.scheduled_at), "HH:mm") : ""
    const brand = design ? newsBrandOf(design) : null
    if (design && brand && newsTimesFor(brand).some((t) => t.time === time)) posts.push({ project, design, brand, time })
  }

  const withPages = await Promise.all(
    carousels.map(async (project): Promise<ReportCarousel> => {
      const ticked = posting ? new Set((await listPostChecks(project.id)).map((c) => c.page_key)) : new Set<string>()
      // Published without the checklist (marked by hand): every page counts as posted.
      const all = project.status === "published" && ticked.size === 0
      return {
        project,
        slides: designsOf(project.id),
        postedPages: pages.filter((p) => all || ticked.has(p.key)),
        pagesLeft: pages.filter((p) => !all && !ticked.has(p.key)),
      }
    }),
  )
  return { day: startOfDay(day), posts, carousels: withPages }
}

/** Everything the Daily Tasks report shows for a day (and the day after, for what's pending). */
export async function loadReportData(day: Date): Promise<ReportData> {
  const features = await projectFeatures()
  const pages = features.posting ? await listPostPages() : []
  const [today, tomorrow] = await Promise.all([loadDay(day, pages, features.posting), loadDay(addDays(day, 1), pages, features.posting)])
  return { today, tomorrow, pages }
}
