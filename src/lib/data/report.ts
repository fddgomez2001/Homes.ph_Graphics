"use client"

import { addDays, format, startOfDay } from "date-fns"
import { currentAssignment } from "@/lib/assignment"
import { isNewsPosterTemplate, isPosterTemplate, newsBrandOf, type NewsBrand } from "@/lib/design/news-templates"
import { laneTimesOf, reportBrandOfDesign, reportBrandsOf, type ReportBrand } from "@/lib/news-lanes"
import { normalizeDesign } from "@/lib/design/normalize"
import { carouselBrandOfSlides } from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"
import type { ProjectRow } from "@/lib/types"
import { listPostChecks, listPostPages, type PostPage } from "./posting"
import { listProjects, listSlidesForProjects, projectFeatures } from "./projects"

/** A news post in one of the day's posting slots. */
export interface ReportPost {
  project: ProjectRow
  design: SlideDesign
  /** Its row: PicklePlay, FHI, CARAGA, Gensan or another Homes.ph page ("homes:cebu"). */
  brand: ReportBrand
  /** "09:00" */
  time: string
}

/** A Poster Maker poster of the day (Daily Trend News in the floating report). */
export interface ReportPoster {
  project: ProjectRow
  design: SlideDesign
  brand: NewsBrand
  /** "14:30" ("" without a time) */
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
  /** The day's posters, by time (not part of the Daily Tasks image). */
  posters?: ReportPoster[]
}

export interface ReportData {
  today: ReportDay
  tomorrow: ReportDay
  /** All Facebook pages (empty before the posting checklist migration). */
  pages: PostPage[]
  /** The rows of the assigned pages (1.50), in the report's order. */
  brands: ReportBrand[]
  /** The person makes the carousel (its task, pending line and pictures). */
  carousel: boolean
}

/** The day's news projects (by time): the News Article posts of the daily brands' posting times, and the Poster Maker posters. */
function splitNews(news: ProjectRow[], designsOf: (id: string) => SlideDesign[]): { posts: ReportPost[]; posters: ReportPoster[] } {
  const posts: ReportPost[] = []
  const posters: ReportPoster[] = []
  for (const project of news) {
    const design = designsOf(project.id)[0]
    const time = project.scheduled_at ? format(new Date(project.scheduled_at), "HH:mm") : ""
    // News Article posts in a page's posting times only: Poster Maker posters aren't part of it.
    if (design && isNewsPosterTemplate(design.templateId)) posters.push({ project, design, brand: newsBrandOf(design), time })
    // Did You Know and engagement posts (1.52) are neither.
    else if (design && isPosterTemplate(design.templateId)) continue
    else if (design) {
      const brand = reportBrandOfDesign(design)
      if (brand && laneTimesOf(brand).some((t) => t.time === time)) posts.push({ project, design, brand, time })
    }
  }
  return { posts, posters }
}

const newsOfDay = (day: Date) =>
  listProjects({ kind: "news", from: startOfDay(day).toISOString(), to: addDays(startOfDay(day), 1).toISOString(), orderBy: "scheduled_at", ascending: true, limit: 200 })

/**
 * The day's Did You Know and engagement posts (Poster Maker, 1.52), by time: the extension's Trending tab lists
 * them under the posters (they're not Daily Trend News).
 */
export async function loadPosterMakerPosts(day: Date): Promise<ReportPoster[]> {
  const news = await newsOfDay(day)
  const slides = await listSlidesForProjects(news.map((p) => p.id))
  const out: ReportPoster[] = []
  for (const project of news) {
    const row = slides.find((s) => s.project_id === project.id)
    const design = row ? normalizeDesign(row.design_json) : null
    if (!design || !isPosterTemplate(design.templateId) || isNewsPosterTemplate(design.templateId)) continue
    out.push({ project, design, brand: newsBrandOf(design), time: project.scheduled_at ? format(new Date(project.scheduled_at), "HH:mm") : "" })
  }
  return out
}

/** The day's Poster Maker posters (Daily Trend News), by time: the same ones the floating report lists. */
export async function loadTrendPosters(day: Date): Promise<ReportPoster[]> {
  const news = await newsOfDay(day)
  const slides = await listSlidesForProjects(news.map((p) => p.id))
  return splitNews(news, (id) => slides.filter((s) => s.project_id === id).map((s) => normalizeDesign(s.design_json))).posters
}

async function loadDay(day: Date, pages: PostPage[], posting: boolean): Promise<ReportDay> {
  const from = startOfDay(day).toISOString()
  const to = addDays(startOfDay(day), 1).toISOString()
  const [news, carousels] = await Promise.all([newsOfDay(day), listProjects({ kind: "carousel", from, to, orderBy: "scheduled_at", ascending: true, limit: 50 })])
  const slides = await listSlidesForProjects([...news, ...carousels].map((p) => p.id))
  const designsOf = (id: string) => slides.filter((s) => s.project_id === id).map((s) => normalizeDesign(s.design_json))
  const { posts, posters } = splitNews(news, designsOf)

  // The report's carousel task is the Homes.ph pages' daily carousel: FHI and PicklePlay carousels aren't part of it.
  const homes = carousels.filter((project) => carouselBrandOfSlides(designsOf(project.id)) === "homes")
  const withPages = await Promise.all(
    homes.map(async (project): Promise<ReportCarousel> => {
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
  return { day: startOfDay(day), posts, carousels: withPages, posters }
}

/** Everything the Daily Tasks report shows for a day (and the day after, for what's pending). */
export async function loadReportData(day: Date): Promise<ReportData> {
  const features = await projectFeatures()
  const pages = features.posting ? await listPostPages() : []
  const [today, tomorrow] = await Promise.all([loadDay(day, pages, features.posting), loadDay(addDays(day, 1), pages, features.posting)])
  const assigned = currentAssignment()
  return { today, tomorrow, pages, brands: reportBrandsOf(assigned), carousel: assigned.carousel }
}
