"use client"

import { addDays, format } from "date-fns"
import { isGensanPage, pageSlug, samePage } from "@/lib/ai/homes-places"
import { applyNewsChange, syncPosterContent } from "@/lib/data/news"
import type { ProjectQuery } from "@/lib/data/projects"
import {
  DEFAULT_HOMES_PAGES,
  GENSAN_PAGE,
  HOMES_POSTER_PAGE,
  isPosterTemplate,
  posterKindOf,
  newsBrandOf,
  newsPostLabel,
  RENTSOUQ_BRAND,
  rentsouqTemplateId,
  type PosterLayout,
} from "@/lib/design/news-templates"
import type { SlideDesign } from "@/lib/design/types"
import type { BrandPostKind } from "@/lib/brand-templates/types"

/** A poster's brand (its template): Homes.ph Gensan posters have their own template. Bayanihan: 1.52. */
export type PosterBrand = "fhi" | "pickleplay" | "homes" | "gensan" | "bayanihan"

export const POSTER_BRANDS: { id: PosterBrand; name: string; short: string; accent: string }[] = [
  { id: "fhi", name: "FHI Global Property", short: "FHI Global", accent: "#F8C563" },
  { id: "pickleplay", name: "PicklePlay PH", short: "PicklePlay PH", accent: "#AFD137" },
  { id: "homes", name: "Homes.ph", short: "Homes.ph", accent: "#F4AA1D" },
  // The Homes.ph poster for the Homes.ph Gensan page (its own trending news and report entry).
  { id: "gensan", name: "Homes.ph Gensan", short: "Homes.ph Gensan", accent: "#F4AA1D" },
  { id: "bayanihan", name: "Bayanihan", short: "Bayanihan", accent: "#FBBF49" },
]

export const isPosterBrand = (v: string | null | undefined): v is PosterBrand => v === "fhi" || v === "pickleplay" || v === "homes" || v === "gensan" || v === "bayanihan"

/**
 * The Poster Maker's tabs: FHI, Rentsouq.ae (FHI's posters on the Rentsouq.ae template), PicklePlay and
 * Homes.ph (one tab for every Homes.ph page, Gensan too).
 */
export type PosterTab = "fhi" | "rentsouq" | "pickleplay" | "homes" | "bayanihan"

/** Rentsouq.ae's orange (its highlighted words on the poster). */
export const RENTSOUQ_ACCENT = "#EFA01C"

export const POSTER_TABS: { id: PosterTab; name: string; short: string; accent: string }[] = [
  { id: "fhi", name: "FHI Global Property", short: "FHI Global", accent: "#F8C563" },
  { id: "rentsouq", name: RENTSOUQ_BRAND.name, short: RENTSOUQ_BRAND.name, accent: RENTSOUQ_ACCENT },
  { id: "pickleplay", name: "PicklePlay PH", short: "PicklePlay PH", accent: "#AFD137" },
  { id: "homes", name: "Homes.ph", short: "Homes.ph", accent: "#F4AA1D" },
  { id: "bayanihan", name: "Bayanihan", short: "Bayanihan", accent: "#FBBF49" },
]

export const isPosterTab = (v: string | null | undefined): v is PosterTab => v === "fhi" || v === "rentsouq" || v === "pickleplay" || v === "homes" || v === "bayanihan"

/** A brand's tab (Homes.ph Gensan is a Homes.ph page). */
export const tabOfBrand = (brand: PosterBrand): PosterTab => (brand === "gensan" ? "homes" : brand)

/** What ?brand= (and the remembered tab) can be: a brand, or the Rentsouq.ae tab. */
export type PosterTabParam = PosterBrand | "rentsouq"

export const isPosterTabParam = (v: string | null | undefined): v is PosterTabParam => isPosterBrand(v) || v === "rentsouq"

/** The tab of ?brand= ("gensan" from before 1.38 is the Homes.ph tab). */
export const tabOfParam = (v: PosterTabParam): PosterTab => (v === "rentsouq" ? "rentsouq" : tabOfBrand(v))

// ---------- Rentsouq.ae: FHI Global Property's posters on the Rentsouq.ae template ----------

/**
 * Another brand's look of a brand's posters. Rentsouq.ae shows FHI Global Property's posters (same days,
 * times, texts, photo, caption and details) drawn on the Rentsouq.ae template: nothing is saved as
 * Rentsouq.ae, so editing there edits the FHI poster and the Daily Report only ever sees FHI.
 */
export type PosterLook = "rentsouq"

/** The brand whose posters a look shows. */
export const LOOK_BRAND: Record<PosterLook, PosterBrand> = { rentsouq: "fhi" }

/** The tab's look, or null for a brand's own tab. */
export const lookOfTab = (tab: PosterTab): PosterLook | null => (tab === "rentsouq" ? "rentsouq" : null)

/** The template a poster's Rentsouq.ae version is drawn on: the New Template unless the Old one was picked for it. */
export const rentsouqLayoutOf = (design: Pick<SlideDesign, "rentsouqLayout">): PosterLayout => (design.rentsouqLayout === "square" ? "square" : "portrait")

/** The parts of a poster both its versions (FHI, Rentsouq.ae) lay out the same way: the photo card and the text. */
const SHARED_PARTS = new Set(["Photo Frame", "Photo", "Photo Border", "Photo Credit", "Headline", "Subtext"])
const TEXT_LAYOUT = ["fontSize", "lineHeight", "letterSpacing", "fontFamily", "fontWeight", "align", "textCase", "boxFit", "autoFit"] as const

/**
 * The sizes and positions of a poster's photo card and text (changed in the editor) on another template of the
 * same size: the FHI poster's on its Rentsouq.ae version. Logos, footers and colors stay the template's own.
 */
export function carryLayout(from: SlideDesign, to: SlideDesign): SlideDesign {
  if (from.width !== to.width || from.height !== to.height) return to
  const byName = new Map(from.elements.map((e) => [e.name, e]))
  // The same part in both (the stack and a shared headline / subtext fit point at it by id).
  const ids = new Map<string, string>()
  for (const el of to.elements) {
    const f = byName.get(el.name)
    if (f && f.type === el.type) ids.set(f.id, el.id)
  }
  let changed = false
  const elements = to.elements.map((el) => {
    const f = byName.get(el.name)
    if (!SHARED_PARTS.has(el.name) || !f || f.type !== el.type) return el
    const next = { ...el, x: f.x, y: f.y, width: f.width, rotation: f.rotation } as typeof el
    if ("height" in f && "height" in next) Object.assign(next, { height: f.height })
    if ("cornerRadius" in f && "cornerRadius" in next) Object.assign(next, { cornerRadius: f.cornerRadius })
    if (next.type === "text" && f.type === "text") {
      for (const key of TEXT_LAYOUT) Object.assign(next, { [key]: f[key] })
      const share = next.boxFit?.shareWith
      if (share) next.boxFit = { ...next.boxFit!, shareWith: { ...share, id: ids.get(share.id) ?? share.id } }
    }
    changed = true
    return next
  })
  if (!changed) return to
  const stack = from.stack && to.stack ? { ...from.stack, items: from.stack.items.filter((i) => ids.has(i.id)).map((i) => ({ ...i, id: ids.get(i.id)! })) } : to.stack
  return { ...to, elements, stack }
}

/**
 * A poster as a look shows it: an FHI poster on the Rentsouq.ae template (New or Old, its own choice) with its
 * headline, highlighted words, subtext and its look, photo credit, and the photo where it was moved and zoomed
 * to. Its Rentsouq.ae version edited in the editor keeps its own sizes and layout; until then it takes the FHI
 * poster's text and photo sizes. Other designs (and no look) are returned as they are.
 */
export function lookDesign(design: SlideDesign, look: PosterLook | null | undefined): SlideDesign {
  if (look !== "rentsouq" || !isBrandPoster(design, LOOK_BRAND.rentsouq)) return design
  const templateId = rentsouqTemplateId(rentsouqLayoutOf(design))
  const own = design.rentsouqDesign
  if (own && own.templateId === templateId) return syncPosterContent({ ...own, rentsouqDesign: null }, design)
  const { rentsouqDesign: _own, ...poster } = design
  void _own
  return carryLayout(poster, applyNewsChange(poster, { templateId }))
}

/**
 * The FHI poster after its Rentsouq.ae version was edited (in the editor): the text and photo changed there go
 * to the poster, and the Rentsouq.ae version is kept as it was edited (its own sizes and layout).
 */
export function fromLookDesign(poster: SlideDesign, edited: SlideDesign): SlideDesign {
  const own: SlideDesign = { ...edited, rentsouqDesign: null }
  return { ...syncPosterContent(poster, own), rentsouqDesign: own }
}

export const ymd = (d: Date) => format(d, "yyyy-MM-dd")

export function posterBrandOf(design: Pick<SlideDesign, "templateId">): PosterBrand {
  const brand = newsBrandOf(design)
  return brand === "pickleplay" || brand === "homes" || brand === "gensan" || brand === "bayanihan" ? brand : "fhi"
}

/** A Poster Maker poster (not a News Article post) of this brand; `kind`: its navigation (Poster when left out). */
export function isBrandPoster(design: SlideDesign | undefined, brand: PosterBrand, kind: BrandPostKind = "news"): design is SlideDesign {
  return !!design && isPosterTemplate(design.templateId) && posterKindOf(design.templateId) === kind && posterBrandOf(design) === brand
}

// ---------- Homes.ph pages ----------

/** The Homes.ph page a poster is for: its page (Homes.ph CARAGA when it has none), Homes.ph Gensan for Gensan posters. */
export function posterPageOf(design: Pick<SlideDesign, "templateId" | "page">): string {
  return posterBrandOf(design) === "gensan" ? GENSAN_PAGE : design.page?.trim() || HOMES_POSTER_PAGE
}

/** A Homes.ph poster for this page (Homes.ph Gensan posters are the Gensan page's); `kind`: its navigation. */
export function isPagePoster(design: SlideDesign | undefined, page: string, kind: BrandPostKind = "news"): design is SlideDesign {
  if (!design || !isPosterTemplate(design.templateId) || posterKindOf(design.templateId) !== kind) return false
  const brand = posterBrandOf(design)
  return (brand === "homes" || brand === "gensan") && samePage(posterPageOf(design), page)
}

/** A new poster's brand for a Homes.ph page: the Gensan page has its own template, the others are Homes.ph. */
export const brandForPage = (page: string): PosterBrand => (isGensanPage(page) ? "gensan" : "homes")

/** Which posters a board shows: a brand's, or one Homes.ph page's. */
export interface PosterScope {
  brand: PosterBrand
  /** The Homes.ph page (Homes.ph tab only). */
  page: string | null
  /** Drawn on another brand's template: Rentsouq.ae (the brand is FHI). */
  look?: PosterLook | null
  /** The Poster Maker's navigation (1.52): Poster (when left out), Did You Know or Engagement Posts. */
  kind?: BrandPostKind
}

export function inScope(design: SlideDesign | undefined, scope: PosterScope): design is SlideDesign {
  const kind = scope.kind ?? "news"
  return scope.page ? isPagePoster(design, scope.page, kind) : isBrandPoster(design, scope.brand, kind)
}

/** "FHI Global Property", "Rentsouq.ae", "PicklePlay PH", "Homes.ph CARAGA", "Homes.ph Cebu". */
export function scopeName(scope: PosterScope): string {
  if (scope.look === "rentsouq") return RENTSOUQ_BRAND.name
  return scope.page ? newsPostLabel("homes", scope.page) : POSTER_BRANDS.find((b) => b.id === scope.brand)!.name
}

/** The Homes.ph page in the address ("cebu") → its name in the list ("Homes.ph Cebu"). */
export function pageFromSlug(slug: string | null | undefined, pages: readonly string[]): string | null {
  if (!slug) return null
  return pages.find((p) => pageSlug(p) === slug) ?? DEFAULT_HOMES_PAGES.find((p) => pageSlug(p) === slug) ?? null
}

const LAST_PAGE_KEY = "dcm-poster-page"

/** The Homes.ph page last picked in the Poster Maker. */
export function readLastPage(): string | null {
  try {
    return localStorage.getItem(LAST_PAGE_KEY) || null
  } catch {
    return null
  }
}

export function rememberPage(page: string) {
  try {
    localStorage.setItem(LAST_PAGE_KEY, page)
  } catch {
    // remembered for this session only
  }
}

/** Every news post of one day: the same query everywhere, so the list is fetched once and shared. */
export function dayQuery(dayStart: Date): ProjectQuery {
  return {
    kind: "news",
    from: dayStart.toISOString(),
    to: addDays(dayStart, 1).toISOString(),
    orderBy: "scheduled_at",
    ascending: true,
    limit: 200,
  }
}

/** The Poster Maker tab last used (the sidebar link opens it). */
const LAST_BRAND_KEY = "dcm-poster-brand"

/** The tab last used ("gensan" from before 1.38 is the Homes.ph tab on the Gensan page). */
export function readLastBrand(): PosterTabParam | null {
  try {
    const v = localStorage.getItem(LAST_BRAND_KEY)
    return isPosterTabParam(v) ? v : null
  } catch {
    return null
  }
}

export function rememberBrand(brand: PosterTab) {
  try {
    localStorage.setItem(LAST_BRAND_KEY, brand)
  } catch {
    // remembered for this session only
  }
}

/**
 * A new poster's posting time: 9:00 AM on an empty day, otherwise two hours after the
 * day's last poster (11:30 PM at the latest). It can be changed to any time.
 */
export function nextPosterTime(times: string[]): string {
  const minutes = times.map((t) => {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
  })
  if (!minutes.length) return "09:00"
  const next = Math.min(Math.max(...minutes) + 120, 23 * 60 + 30)
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`
}
