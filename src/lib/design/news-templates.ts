import { differenceInCalendarDays, format, parse } from "date-fns"
import {
  buildCaragaNews,
  buildCaragaPortraitNews,
  buildFhiPortraitNews,
  buildFhiPortraitPoster,
  buildFhiPoster,
  buildFhiWideNews,
  buildHomesPortraitPoster,
  buildHomesPoster,
  buildPickleplayEventPoster,
  buildPickleplayNews,
  buildPickleplayPortraitEventPoster,
  buildPickleplayPortraitNews,
  buildPickleplayPortraitPoster,
  buildPickleplayPoster,
  buildRentsouqPortraitPoster,
  buildRentsouqPoster,
  PORTRAIT_POSTER_IDS,
} from "./templates"
import type { SlideDesign } from "./types"
import { buildDesignPoster, designTemplateId, isDesignPoster, POSTER_DESIGN_COUNT, type DesignBrand } from "./poster-designs"
import { allBrandPostIds, brandPostKindOf, brandPostTemplate, isBrandPostTemplate, POST_KINDS } from "@/lib/brand-templates/catalog"
import { buildBrandPost } from "@/lib/brand-templates/posts"
import type { BrandPostKind } from "@/lib/brand-templates/types"

/** Every brand with news posts or posters (Bayanihan: Poster Maker posts only, 1.52). */
export type NewsBrand = DailyBrand | "homes" | "bayanihan"
/** Brands with 5 posts a day: their rows on News, the phone and the Daily Report. */
export type DailyBrand = "pickleplay" | "fhi" | "caraga" | "gensan"

export interface NewsTemplate {
  id: string
  brand: NewsBrand
  name: string
  /** "1152 × 1408" */
  size: string
  width: number
  height: number
  build: (content?: { headline?: string }) => SlideDesign
}

/** Every news article template, by brand. Ids end in "-news" (that marks a news design). */
export const NEWS_TEMPLATES: NewsTemplate[] = [
  // PicklePlay PH and Homes.ph: the New Template (1126 × 1408) is the default, the Old Template (1408 × 1408) the second choice.
  { id: "pickleplay-portrait-news", brand: "pickleplay", name: "New Template", size: "1126 × 1408", width: 1126, height: 1408, build: buildPickleplayPortraitNews },
  { id: "pickleplay-news", brand: "pickleplay", name: "Old Template", size: "1408 × 1408", width: 1408, height: 1408, build: buildPickleplayNews },
  { id: "fhi-portrait-news", brand: "fhi", name: "Template 1 · Portrait", size: "1152 × 1408", width: 1152, height: 1408, build: buildFhiPortraitNews },
  { id: "fhi-wide-news", brand: "fhi", name: "Template 2 · Wide", size: "1742 × 1436", width: 1742, height: 1436, build: buildFhiWideNews },
  { id: "caraga-portrait-news", brand: "caraga", name: "New Template", size: "1126 × 1408", width: 1126, height: 1408, build: (c) => buildCaragaPortraitNews(c) },
  { id: "caraga-news", brand: "caraga", name: "Old Template", size: "1408 × 1408", width: 1408, height: 1408, build: (c) => buildCaragaNews(c) },
  // Homes.ph Gensan: the same Homes.ph designs as CARAGA.
  { id: "gensan-portrait-news", brand: "gensan", name: "New Template", size: "1126 × 1408", width: 1126, height: 1408, build: (c) => buildCaragaPortraitNews(c, "gensan-portrait-news") },
  { id: "gensan-news", brand: "gensan", name: "Old Template", size: "1408 × 1408", width: 1408, height: 1408, build: (c) => buildCaragaNews(c, "gensan-news") },
  // The other Homes.ph pages (Cebu, BGC Taguig…): the same Homes.ph designs, the page's name kept on the post (1.50).
  { id: "homes-portrait-news", brand: "homes", name: "New Template", size: "1126 × 1408", width: 1126, height: 1408, build: (c) => buildCaragaPortraitNews(c, "homes-portrait-news") },
  { id: "homes-news", brand: "homes", name: "Old Template", size: "1408 × 1408", width: 1408, height: 1408, build: (c) => buildCaragaNews(c, "homes-news") },
  // Posters (Poster Maker), New Template (1126 × 1408, the default): logo centered at the top, photo, headline, optional subtext, footer.
  { id: "pickleplay-portrait-poster-news", brand: "pickleplay", name: "Poster · New Template", size: "1126 × 1408", width: 1126, height: 1408, build: buildPickleplayPortraitPoster },
  { id: "pickleplay-portrait-event-poster-news", brand: "pickleplay", name: "Event Poster · New Template", size: "1126 × 1408", width: 1126, height: 1408, build: buildPickleplayPortraitEventPoster },
  { id: "fhi-portrait-poster-news", brand: "fhi", name: "Poster · New Template", size: "1126 × 1408", width: 1126, height: 1408, build: buildFhiPortraitPoster },
  { id: "homes-portrait-poster-news", brand: "homes", name: "Homes.ph Poster · New Template", size: "1126 × 1408", width: 1126, height: 1408, build: (c) => buildHomesPortraitPoster(c) },
  {
    id: "gensan-portrait-poster-news",
    brand: "gensan",
    name: "Homes.ph Gensan Poster · New Template",
    size: "1126 × 1408",
    width: 1126,
    height: 1408,
    build: (c) => buildHomesPortraitPoster(c, "gensan-portrait-poster-news"),
  },
  // Posters, Old Template (1254 × 1254): photo card, headline with highlighted words, optional photo credit.
  { id: "pickleplay-poster-news", brand: "pickleplay", name: "Poster", size: "1254 × 1254", width: 1254, height: 1254, build: buildPickleplayPoster },
  // Tournaments, games, new courts: the poster with LOCATION and DATE & TIME under the headline.
  { id: "pickleplay-event-poster-news", brand: "pickleplay", name: "Event Poster", size: "1254 × 1254", width: 1254, height: 1254, build: buildPickleplayEventPoster },
  { id: "fhi-poster-news", brand: "fhi", name: "Template 3 · Poster", size: "1254 × 1254", width: 1254, height: 1254, build: buildFhiPoster },
  // Homes.ph posters go on one of the Homes.ph Facebook pages (the poster's `page`).
  { id: "homes-poster-news", brand: "homes", name: "Homes.ph Poster", size: "1254 × 1254", width: 1254, height: 1254, build: buildHomesPoster },
  // Homes.ph Gensan posters: the Homes.ph poster, for the Homes.ph Gensan page.
  { id: "gensan-poster-news", brand: "gensan", name: "Homes.ph Gensan Poster", size: "1254 × 1254", width: 1254, height: 1254, build: (c) => buildHomesPoster(c, "gensan-poster-news") },
  // The Homes.ph poster designs 1–10 (1.51), for any Homes.ph page and the Gensan page.
  ...(["homes", "gensan"] as const).flatMap((brand) =>
    Array.from({ length: POSTER_DESIGN_COUNT }, (_, i): NewsTemplate => {
      const id = designTemplateId(brand, i + 1)
      return { id, brand, name: `Design ${i + 1}`, size: "1126 × 1408", width: 1126, height: 1408, build: (c) => buildDesignPoster(i + 1, id, c) }
    }),
  ),
  // The brand post templates (1.52): Poster (news posters, 1080 × 1350), Did You Know and Engagement Posts
  // (1126 × 1408) for Homes.ph (and the Gensan page), FHI Global, PicklePlay and Bayanihan; drawn by their SVG files.
  ...allBrandPostIds().map((id): NewsTemplate => {
    const t = brandPostTemplate(id)!
    const kind = POST_KINDS.find((k) => k.id === t.kind)!
    return { id, brand: t.brand, name: `${kind.name} · ${t.def.name}`, size: `${t.info.width} × ${t.info.height}`, width: t.info.width, height: t.info.height, build: (c) => buildBrandPost(id, c) }
  }),
]

/**
 * Rentsouq.ae: FHI Global Property's posters on the Rentsouq.ae template, in the Poster Maker's Rentsouq.ae
 * tab. Nothing is saved as Rentsouq.ae (the posters are FHI's), so it isn't a News Article brand, isn't in the
 * Daily Report and isn't in NEWS_TEMPLATES (the editor's and News Article's lists); getNewsTemplate knows it.
 */
export const RENTSOUQ_BRAND = { name: "Rentsouq.ae", site: "rentsouq.ae" } as const

/** The Rentsouq.ae templates: New Template (1126 × 1408, the default) and Old Template (1254 × 1254). */
export const RENTSOUQ_TEMPLATES: readonly NewsTemplate[] = [
  { id: "rentsouq-portrait-poster-news", brand: "fhi", name: "Rentsouq.ae Poster · New Template", size: "1126 × 1408", width: 1126, height: 1408, build: buildRentsouqPortraitPoster },
  { id: "rentsouq-poster-news", brand: "fhi", name: "Rentsouq.ae Poster", size: "1254 × 1254", width: 1254, height: 1254, build: buildRentsouqPoster },
]

/** Brands with a poster, and their Old Template poster (1254 × 1254). */
export const POSTER_TEMPLATE_IDS: Partial<Record<NewsBrand, string>> = {
  fhi: "fhi-poster-news",
  pickleplay: "pickleplay-poster-news",
  homes: "homes-poster-news",
  gensan: "gensan-poster-news",
}

/** Brands with an event poster (location, date and time under the headline): the Old Template one. */
export const EVENT_POSTER_TEMPLATE_IDS: Partial<Record<NewsBrand, string>> = { pickleplay: "pickleplay-event-poster-news" }

/** A poster's size: the New Template (1126 × 1408, the default) or the Old Template (1254 × 1254). */
export type PosterLayout = "portrait" | "square"

export const POSTER_LAYOUTS: readonly { id: PosterLayout; name: string; size: string }[] = [
  { id: "portrait", name: "New Template", size: "1126 × 1408" },
  { id: "square", name: "Old Template", size: "1254 × 1254" },
]

/** A Rentsouq.ae template by size (the New Template is the default). */
export const RENTSOUQ_TEMPLATE_IDS: Readonly<Record<PosterLayout, string>> = { portrait: "rentsouq-portrait-poster-news", square: "rentsouq-poster-news" }

export const rentsouqTemplateId = (layout: PosterLayout = "portrait") => RENTSOUQ_TEMPLATE_IDS[layout]

export function isRentsouqTemplate(id: string | null | undefined): boolean {
  return id === RENTSOUQ_TEMPLATE_IDS.portrait || id === RENTSOUQ_TEMPLATE_IDS.square
}

/** The New Template posters (1126 × 1408), by brand. */
const PORTRAIT_POSTER_TEMPLATE_IDS: Partial<Record<NewsBrand, string>> = {
  fhi: "fhi-portrait-poster-news",
  pickleplay: "pickleplay-portrait-poster-news",
  homes: "homes-portrait-poster-news",
  gensan: "gensan-portrait-poster-news",
}
const PORTRAIT_EVENT_POSTER_TEMPLATE_IDS: Partial<Record<NewsBrand, string>> = { pickleplay: "pickleplay-portrait-event-poster-news" }

/**
 * The poster template for a brand, kind ("news" or "event") and size. An event poster on a brand
 * without one is its news poster.
 */
export function posterTemplateId(brand: NewsBrand, format: "news" | "event" = "news", layout: PosterLayout = "portrait", design: number | null = null): string | undefined {
  // A Homes.ph poster design (news posters).
  if (design && format === "news" && (brand === "homes" || brand === "gensan")) return designTemplateId(brand as DesignBrand, design)
  const news = layout === "portrait" ? PORTRAIT_POSTER_TEMPLATE_IDS : POSTER_TEMPLATE_IDS
  const event = layout === "portrait" ? PORTRAIT_EVENT_POSTER_TEMPLATE_IDS : EVENT_POSTER_TEMPLATE_IDS
  return (format === "event" ? event[brand] : undefined) ?? news[brand]
}

/** A poster template's size (Old Template for anything that isn't a New Template poster). */
export function posterLayoutOf(id: string | null | undefined): PosterLayout {
  return id && (PORTRAIT_POSTER_IDS.includes(id) || isDesignPoster(id) || isBrandPostTemplate(id)) ? "portrait" : "square"
}

const ALL_POSTER_IDS = new Set([
  ...Object.values(POSTER_TEMPLATE_IDS),
  ...Object.values(RENTSOUQ_TEMPLATE_IDS),
  ...Object.values(EVENT_POSTER_TEMPLATE_IDS),
  ...Object.values(PORTRAIT_POSTER_TEMPLATE_IDS),
  ...Object.values(PORTRAIT_EVENT_POSTER_TEMPLATE_IDS),
])
const EVENT_IDS = new Set([...Object.values(EVENT_POSTER_TEMPLATE_IDS), ...Object.values(PORTRAIT_EVENT_POSTER_TEMPLATE_IDS)])

/** A Poster Maker post (kept apart from News Article): a poster, or a Did You Know / engagement post (1.52). */
export function isPosterTemplate(id: string | null | undefined): boolean {
  return !!id && (ALL_POSTER_IDS.has(id) || isDesignPoster(id) || isBrandPostTemplate(id))
}

/** Which Poster Maker navigation a post is in: Poster (every poster made before 1.52 too), Did You Know or Engagement Posts. */
export function posterKindOf(id: string | null | undefined): BrandPostKind {
  return brandPostKindOf(id) ?? "news"
}

/** A news poster (Poster): the Daily Report's Daily Trend News; Did You Know and engagement posts aren't. */
export const isNewsPosterTemplate = (id: string | null | undefined) => isPosterTemplate(id) && posterKindOf(id) === "news"

export function isEventPosterTemplate(id: string | null | undefined): boolean {
  return !!id && EVENT_IDS.has(id)
}

/** The daily brands (5 posts a day), in board order. */
export const NEWS_BRANDS: { id: DailyBrand; name: string; site: string }[] = [
  { id: "pickleplay", name: "PicklePlay PH", site: "pickleplay.ph" },
  { id: "fhi", name: "FHI Global Property", site: "fhiglobal.ae" },
  { id: "caraga", name: "Homes.ph CARAGA", site: "homes.ph" },
  { id: "gensan", name: "Homes.ph Gensan", site: "homes.ph" },
]

/** Homes.ph posters (any Homes.ph Facebook page). Not a daily brand. */
export const HOMES_BRAND = { id: "homes" as const, name: "Homes.ph", site: "homes.ph" }

export function isDailyBrand(brand: NewsBrand | null | undefined): brand is DailyBrand {
  return NEWS_BRANDS.some((b) => b.id === brand)
}

/** Bayanihan (Poster Maker posts only). */
export const BAYANIHAN_BRAND = { id: "bayanihan" as const, name: "Bayanihan", site: "bayanihan.com" }

/** "PicklePlay PH", "Homes.ph", "Bayanihan" */
export function newsBrandName(brand: NewsBrand): string {
  if (brand === "bayanihan") return BAYANIHAN_BRAND.name
  return brand === "homes" ? HOMES_BRAND.name : (NEWS_BRANDS.find((b) => b.id === brand)?.name ?? brand)
}

/**
 * The Homes.ph Facebook pages, as in the posting checklist (`carousel_post_pages`). The
 * Poster Maker reads that table; this copy is used when it can't be reached.
 */
export const DEFAULT_HOMES_PAGES: readonly string[] = [
  "Homes.ph Main Page",
  "Homes.ph Ozamiz",
  "Homes.ph Dumaguete",
  "Homes.ph BGC Taguig",
  "Homes.ph Cebu",
  "Homes.ph Pampanga",
  "Homes.ph Cavite",
  "Homes.ph Iloilo",
  "Homes.ph Bacolod",
  "Homes.ph Davao",
  "Homes.ph Palawan",
  "Homes.ph Bohol",
  "Homes.ph Makati",
  "Homes.ph CDO",
  "Homes.ph Gensan",
  "Homes.ph Caraga",
  "Homes.ph Leyte",
]

/** The Facebook page a new Homes.ph poster is for: Homes.ph CARAGA. */
export const HOMES_POSTER_PAGE = "Homes.ph Caraga"

/** The Homes.ph Gensan page (Homes.ph Gensan posts and posters go there). */
export const GENSAN_PAGE = "Homes.ph Gensan"

/** A page's name as shown: "Homes.ph Caraga" → "Homes.ph CARAGA" (the team writes CARAGA in capitals). */
export function pageDisplayName(page: string): string {
  return page.replace(/\s+/g, " ").trim().replace(/\bcaraga\b/i, "CARAGA")
}

/**
 * Who a post is for, for file names and lists: "PicklePlay PH", "Homes.ph CARAGA",
 * "Homes.ph Main Page" (a page name that already says Homes.ph isn't repeated).
 */
export function newsPostLabel(brand: NewsBrand, page?: string | null): string {
  const name = newsBrandName(brand)
  const p = page ? pageDisplayName(page) : ""
  if (!p) return name
  return p.toLowerCase().includes(name.toLowerCase()) ? p : `${name} ${p}`
}

export interface NewsTime {
  /** "13:30" (local time) */
  time: string
  /** "1:30 PM" */
  label: string
}

/** The daily posting times of PicklePlay PH and FHI Global Property (local time). */
export const NEWS_TIMES: readonly NewsTime[] = [
  { time: "09:00", label: "9 AM" },
  { time: "11:00", label: "11 AM" },
  { time: "15:00", label: "3 PM" },
  { time: "19:00", label: "7 PM" },
  { time: "22:00", label: "10 PM" },
]

/** Homes.ph CARAGA (and Homes.ph Gensan) post on their own schedule. */
export const CARAGA_TIMES: readonly NewsTime[] = [
  { time: "11:00", label: "11 AM" },
  { time: "13:30", label: "1:30 PM" },
  { time: "18:00", label: "6 PM" },
  { time: "20:00", label: "8 PM" },
  { time: "22:00", label: "10 PM" },
]

export function newsTimesFor(brand: NewsBrand): readonly NewsTime[] {
  // The Homes.ph pages post at the Cities board's times; PicklePlay and FHI at the Sites board's.
  return brand === "caraga" || brand === "gensan" || brand === "homes" ? CARAGA_TIMES : NEWS_TIMES
}

/** "9 AM", "1:30 PM": a posting time's label (any brand), or the time written out. */
export function newsTimeLabel(time: string): string {
  return [...NEWS_TIMES, ...CARAGA_TIMES].find((t) => t.time === time)?.label ?? format(new Date(`2000-01-01T${time}:00`), time.endsWith(":00") ? "h a" : "h:mm a")
}

/** "2026-11-01 1.30PM Homes.ph CARAGA.png" (no ":" — Windows doesn't allow it in file names). */
export function newsFileName(day: Date, time: NewsTime, brandName: string) {
  return `${format(day, "yyyy-MM-dd")} ${time.label.replace(/\s+/g, "").replace(":", ".")} ${brandName}.png`
}

export function getNewsTemplate(id: string | null | undefined): NewsTemplate | undefined {
  return NEWS_TEMPLATES.find((t) => t.id === id) ?? RENTSOUQ_TEMPLATES.find((t) => t.id === id)
}

export function newsTemplatesFor(brand: NewsBrand): NewsTemplate[] {
  return NEWS_TEMPLATES.filter((t) => t.brand === brand)
}

/** The day FHI Global Property's News Article templates start alternating: Portrait (Wide the next day). */
export const FHI_ALTERNATION_START = "2026-11-10"

/**
 * A new News Article post's template on `day`: FHI Global Property alternates day by day (Template 1 · Portrait
 * on 2026-11-10, Template 2 · Wide on the 11th, Portrait on the 12th…); the other brands use their first one.
 */
export function defaultArticleTemplate(brand: NewsBrand, day: Date): NewsTemplate {
  const templates = articleTemplatesFor(brand)
  if (brand !== "fhi") return templates[0]
  const portrait = templates.find((t) => t.id === "fhi-portrait-news") ?? templates[0]
  const wide = templates.find((t) => t.id === "fhi-wide-news") ?? portrait
  const days = differenceInCalendarDays(day, parse(FHI_ALTERNATION_START, "yyyy-MM-dd", new Date()))
  return Math.abs(days) % 2 === 0 ? portrait : wide
}

/**
 * News Article templates of a brand (no posters). The Poster Maker and News Article are
 * separate: posters never show on News Article, the phone's News tab or the Daily Report.
 */
export function articleTemplatesFor(brand: NewsBrand): NewsTemplate[] {
  return newsTemplatesFor(brand).filter((t) => !isPosterTemplate(t.id))
}

/** The brand of a news design (PicklePlay for older articles without a known template). */
export function newsBrandOf(design: Pick<SlideDesign, "templateId"> | null | undefined): NewsBrand {
  return getNewsTemplate(design?.templateId)?.brand ?? "pickleplay"
}
