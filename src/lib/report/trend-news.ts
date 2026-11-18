"use client"

import { format } from "date-fns"
import { articleMemoryOf } from "@/components/posters/article-memory"
import { suggestTrendDetails } from "@/lib/ai/client"
import { isCaragaPage, pageShortName, pageSlug } from "@/lib/ai/homes-places"
import { newsEvent, newsHeadline, newsSubtextState } from "@/lib/data/news"
import { updateProject } from "@/lib/data/projects"
import type { ReportPoster } from "@/lib/data/report"
import { LOGO_BLUE_SRC, PICKLEPLAY_LOGO_SRC } from "@/lib/design/constants"
import { GENSAN_PAGE, HOMES_POSTER_PAGE, isEventPosterTemplate, newsPostLabel, posterKindOf, type NewsBrand } from "@/lib/design/news-templates"
import { postTitleOf } from "@/lib/brand-templates/posts"
import { NEWS_HEADLINE_PLACEHOLDER } from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"
import type { ReportFolderBrand } from "@/lib/desktop"
import { FHI_EMBLEM_SRC } from "./daily-report"
import { HOMES_TREND_NAME, REPORT_BRANDS, trendBrandName, trendLabel, trendText } from "./report-texts"

/**
 * Daily Trend News: the day's Poster Maker posters as the floating report lists them (by brand,
 * then each other Homes.ph page, numbered DTN 1, 2… in each), their texts, and the AI's details.
 * The floating report and the Chrome extension's bridge both use these.
 */

/** A news post's headline ("" while it still has the sample text). */
export function headlineOf(design: SlideDesign) {
  const h = newsHeadline(design).replace(/\s+/g, " ").trim()
  return h === NEWS_HEADLINE_PLACEHOLDER ? "" : h
}

/** What goes in brackets after a poster's headline: its subtext (when shown), or an event's place and time. */
export function posterSubtext(design: SlideDesign) {
  if (isEventPosterTemplate(design.templateId)) {
    const event = newsEvent(design)
    return event ? [event.location, event.when].filter(Boolean).join(" | ") : ""
  }
  const sub = newsSubtextState(design)
  return sub?.on ? sub.text : ""
}

/** A Homes.ph poster's page (Homes.ph CARAGA when it has none). */
export const posterPage = (p: Pick<ReportPoster, "brand" | "design">) => (p.brand === "homes" ? p.design.page?.trim() || HOMES_POSTER_PAGE : null)

/** Which report folder a poster's picture goes in (a Homes.ph page other than CARAGA: its own, "Homes.ph Cebu"). */
export function posterFolder(brand: NewsBrand, page: string | null): ReportFolderBrand {
  if (brand === "pickleplay" || brand === "fhi" || brand === "gensan") return brand
  return page && !isCaragaPage(page) ? `homes:${pageShortName(page)}` : "caraga"
}

/** A poster's Daily Trend News group: its brand, or its Homes.ph page ("homes:cebu"; CARAGA is "homes"). */
export function trendGroupOf(p: Pick<ReportPoster, "brand" | "design">): string {
  const page = posterPage(p)
  return page && !isCaragaPage(page) ? `homes:${pageSlug(page)}` : p.brand
}

/** Daily Trend News groups: the Poster Maker's brands. */
export const TREND_GROUPS: { id: "pickleplay" | "fhi" | "homes" | "gensan"; logo: string; name: string }[] = [
  { id: "pickleplay", logo: PICKLEPLAY_LOGO_SRC, name: REPORT_BRANDS.pickleplay.name },
  { id: "fhi", logo: FHI_EMBLEM_SRC, name: REPORT_BRANDS.fhi.name },
  { id: "homes", logo: LOGO_BLUE_SRC, name: HOMES_TREND_NAME },
  { id: "gensan", logo: LOGO_BLUE_SRC, name: REPORT_BRANDS.gensan.name },
]

export interface TrendGroup {
  id: string
  logo: string
  name: string
  /** Its posters with a headline, in order: DTN 1, 2… */
  posters: ReportPoster[]
}

/** The day's posters with a headline in their groups: the brands, then each other Homes.ph page with posters ("Homes.ph Cebu"). */
export function trendGroups(posters: ReportPoster[]): TrendGroup[] {
  const titled = posters.filter((p) => headlineOf(p.design))
  const pageGroups = new Map<string, { id: string; logo: string; name: string }>()
  for (const p of titled) {
    const id = trendGroupOf(p)
    if (id.startsWith("homes:") && !pageGroups.has(id)) pageGroups.set(id, { id, logo: LOGO_BLUE_SRC, name: newsPostLabel("homes", posterPage(p)) })
  }
  return [...TREND_GROUPS, ...[...pageGroups.values()].sort((a, b) => a.name.localeCompare(b.name))].map((g) => ({
    ...g,
    posters: titled.filter((p) => trendGroupOf(p) === g.id),
  }))
}

/** One poster of the Daily Trend News, as listed. */
export interface TrendEntry {
  poster: ReportPoster
  /** "pickleplay", "fhi", "caraga", "gensan" or "homes:<page slug>" ("homes:cebu"). */
  group: string
  /** "Pickleplay.ph", "FHI Global", "Homes.ph CARAGA", "Homes.ph Gensan", "Homes.ph Cebu" */
  groupName: string
  /** The Homes.ph Facebook page of a Homes.ph or Gensan poster ("Homes.ph Caraga", "Homes.ph Cebu", "Homes.ph Gensan"), else null. */
  page: string | null
  /** Its DTN number in its group. */
  n: number
  /** "FHI Global DTN 1" */
  label: string
  headline: string
  subtext: string
}

/** Every listed poster of the day in the floating report's order (groups, then DTN 1, 2…). */
/** A Did You Know or engagement post in the extension's Trending tab (1.53). */
export interface PostEntry {
  poster: ReportPoster
  kind: "dyk" | "engagement"
  /** As a poster's: "pickleplay", "fhi", "caraga", "gensan", "bayanihan" or "homes:<page slug>". */
  group: string
  groupName: string
  page: string | null
  /** Its number among its page's posts of its kind that day. */
  n: number
  title: string
}

/** The day's Did You Know and engagement posts, grouped like the posters (numbered per page and kind). */
export function postEntries(posts: ReportPoster[]): PostEntry[] {
  const counts = new Map<string, number>()
  return posts.map((poster) => {
    const kind = posterKindOf(poster.design.templateId) === "dyk" ? "dyk" : "engagement"
    const page = posterPage(poster)
    const id = trendGroupOf(poster)
    const group = id === "homes" ? "caraga" : id
    const groupName = poster.brand === "bayanihan" ? "Bayanihan" : trendBrandName(poster.brand, page)
    const key = `${group}|${kind}`
    const n = (counts.get(key) ?? 0) + 1
    counts.set(key, n)
    return { poster, kind, group, groupName, page: poster.brand === "gensan" ? GENSAN_PAGE : page, n, title: postTitleOf(poster.design.brandPost?.fields ?? {}) || headlineOf(poster.design) }
  })
}

export function trendEntries(posters: ReportPoster[]): TrendEntry[] {
  return trendGroups(posters).flatMap((g) =>
    g.posters.map((poster, i) => {
      const page = posterPage(poster)
      const groupName = trendBrandName(poster.brand, page)
      return {
        poster,
        group: g.id === "homes" ? "caraga" : g.id,
        groupName,
        page: poster.brand === "gensan" ? GENSAN_PAGE : page,
        n: i + 1,
        label: trendLabel(groupName, i + 1),
        headline: headlineOf(poster.design),
        subtext: posterSubtext(poster.design),
      }
    }),
  )
}

/** The poster's posting day (its scheduled date, else the report's day). */
export const trendDay = (poster: ReportPoster, day: Date) => (poster.project.scheduled_at ? new Date(poster.project.scheduled_at) : day)

/** The whole Daily Trend News entry, as the floating report copies it. */
export function trendEntryText(entry: TrendEntry, day: Date, details: string): string {
  return trendText({ name: entry.groupName, n: entry.n, day: trendDay(entry.poster, day), headline: entry.headline, subtext: entry.subtext, details })
}

/** "2026-11-12 FHI Global DTN 1" (the picture's name, without .png). */
export const trendFileBase = (entry: TrendEntry, day: Date) => `${format(trendDay(entry.poster, day), "yyyy-MM-dd")} ${entry.label}`

/**
 * The AI's details for a poster (what the news is about and why it's a trend). The article from
 * "Write from article" goes with it when it was this poster's (its headline is one of the AI's choices).
 */
export async function writeTrendDetails(input: { name: string; headline: string; subtext: string; caption: string }): Promise<{ details: string; fellBack?: string }> {
  const article = articleMemoryOf(input.headline, input.name)?.article ?? ""
  return suggestTrendDetails({ article, brand: input.name, headline: input.headline, subtext: input.subtext, caption: input.caption })
}

/** Saves a poster's details (its topic), when they changed. */
export async function saveTrendDetails(poster: Pick<ReportPoster, "project">, text: string): Promise<boolean> {
  const value = text.replace(/\s+/g, " ").trim()
  if (value === (poster.project.topic ?? "").trim()) return false
  await updateProject(poster.project.id, { topic: value || null })
  return true
}
