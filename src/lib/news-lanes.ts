import { format } from "date-fns"
import { isDailyBrand, isPosterTemplate, NEWS_BRANDS, newsBrandOf, newsTimesFor, type DailyBrand, type NewsTime } from "@/lib/design/news-templates"
import type { SlideDesign } from "@/lib/design/types"
import { assignedPageIds, homesPageByName, newsLaneOf, pageIdOfBrand, pageName, parsePageId, type Assignment, type HomesPageKey, type PageId } from "@/lib/pages"

/**
 * A page's row of daily News Article posts (1.50): PicklePlay, FHI, CARAGA and Gensan as before; the other
 * Homes.ph pages with the Homes.ph design and the page's name on each post; sites without a template have
 * no row (`brand` null).
 */
export interface NewsLane {
  id: PageId
  /** "Homes.ph Cebu", "PicklePlay PH" */
  name: string
  site: string
  /** The posts' brand: a daily brand, "homes" (the page's name on the post), or null (no template yet). */
  brand: DailyBrand | "homes" | null
  /** "Homes.ph Cebu" for the "homes" brand. */
  page: string | null
  times: readonly NewsTime[]
}

export function newsLane(id: PageId): NewsLane {
  const lane = newsLaneOf(id)
  const p = parsePageId(id)
  const site = p?.kind === "site" ? p.page.site : "homes.ph"
  if (!lane) return { id, name: pageName(id), site, brand: null, page: null, times: [] }
  if (lane.brand === "homes") return { id, name: pageName(id), site, brand: "homes", page: lane.page, times: newsTimesFor("homes") }
  const daily = NEWS_BRANDS.find((b) => b.id === lane.brand)!
  return { id, name: daily.name, site: daily.site, brand: lane.brand, page: null, times: newsTimesFor(lane.brand) }
}

/** The page a News Article post belongs to (posters and unknown pages: null). */
export function laneOfDesign(design: Pick<SlideDesign, "templateId" | "page">): PageId | null {
  if (isPosterTemplate(design.templateId)) return null
  const brand = newsBrandOf(design)
  if (isDailyBrand(brand)) return pageIdOfBrand(brand)
  if (brand !== "homes") return null
  const page = homesPageByName(design.page)
  return page ? `homes:${page.key}` : null
}

/** "homes:cebu@13:30": a post's slot key (null when it isn't in a lane's slot). */
export function slotKeyOf(design: Pick<SlideDesign, "templateId" | "page">, scheduledAt: string | null): string | null {
  const lane = laneOfDesign(design)
  if (!lane || !scheduledAt) return null
  const time = format(new Date(scheduledAt), "HH:mm")
  return newsLane(lane).times.some((t) => t.time === time) ? `${lane}@${time}` : null
}

// ---------- the Daily Report's rows ----------

/** A Daily Report row: PicklePlay, FHI, CARAGA, Gensan (as before), or another Homes.ph page ("homes:cebu"). */
export type ReportBrand = DailyBrand | `homes:${HomesPageKey}`

export const isPageLane = (b: ReportBrand): b is `homes:${HomesPageKey}` => b.startsWith("homes:")

export function reportBrandOfPage(id: PageId): ReportBrand | null {
  const lane = newsLaneOf(id)
  if (!lane) return null
  return lane.brand === "homes" ? (id as `homes:${HomesPageKey}`) : lane.brand
}

/** A News Article post's report row (posters and posts of no page: null). */
export function reportBrandOfDesign(design: Pick<SlideDesign, "templateId" | "page">): ReportBrand | null {
  const lane = laneOfDesign(design)
  return lane ? reportBrandOfPage(lane) : null
}

/** The report's rows for these pages: PicklePlay, FHI, CARAGA, Gensan first (the order the team knows), then the other Homes.ph pages. */
export function reportBrandsOf(a: Assignment): ReportBrand[] {
  const rank = (b: ReportBrand) => ["pickleplay", "fhi", "caraga", "gensan"].indexOf(b)
  const brands = assignedPageIds(a)
    .map(reportBrandOfPage)
    .filter((b): b is ReportBrand => !!b)
  return brands.map((b, i) => ({ b, i })).sort((x, y) => (rank(x.b) < 0 ? 99 : rank(x.b)) - (rank(y.b) < 0 ? 99 : rank(y.b)) || x.i - y.i).map((x) => x.b)
}

/** The template brand of a report row (a Homes.ph page's posts use the Homes.ph design). */
export const templateBrandOf = (b: ReportBrand): DailyBrand | "homes" => (isPageLane(b) ? "homes" : b)

export const laneTimesOf = (b: ReportBrand): readonly NewsTime[] => newsTimesFor(templateBrandOf(b))

/** "PicklePlay PH", "Homes.ph CARAGA", "Homes.ph Cebu". */
export const reportBrandLabel = (b: ReportBrand): string => (isPageLane(b) ? pageName(b) : NEWS_BRANDS.find((x) => x.id === b)!.name)
