"use client"

import type { LinkedArticle } from "@/lib/ai/client"
import { cleanHashtags } from "@/lib/ai/headlines"
import { trendScope } from "@/lib/ai/homes-places"
import type { PosterCaption, PosterCopy, TrendBrand } from "@/lib/ai/types"

/**
 * The last article read in "Write from article" and what the AI wrote from it, kept on this
 * computer apart for each brand and each Homes.ph page (FHI Global Property, PicklePlay PH,
 * Homes.ph CARAGA, Homes.ph Gensan, Homes.ph Cebu…): what was searched and written for one never
 * shows in another. Kept until that brand's next "Write" (closing the dialog, another poster or
 * restarting the app keeps it), so the choices and the caption are always a click away.
 */
export interface ArticleMemory {
  mode: "paste" | "link" | "trend"
  article: string
  link: string
  source: LinkedArticle | null
  copy: PosterCopy | null
  fellBack: string | null
  /** Who the results were written for ("PicklePlay PH", "Homes.ph BGC Taguig"). */
  brand: string
}

/** Every brand's and page's memory: { fhi: …, gensan: …, "homes@cebu": … }. */
const KEY = "dcm-poster-articles"
/** Before 1.47: one memory for every brand (it moves to the brand it was written for). */
const OLD_KEY = "dcm-poster-article"
/** The brands and pages remembered (the ones written for longest ago go first). */
const MAX_SCOPES = 24

export const EMPTY_MEMORY: ArticleMemory = { mode: "paste", article: "", link: "", source: null, copy: null, fellBack: null, brand: "" }

type Stored = ArticleMemory & { at?: number }

/** Whose memory a poster's name is: "FHI Global Property" → fhi, "Homes.ph Gensan" → gensan, "Homes.ph Cebu" → homes@cebu. */
export function articleScope(brandName: string): string {
  const name = brandName.replace(/\s+/g, " ").trim()
  if (/fhi|rentsouq/i.test(name)) return "fhi"
  if (/pickle/i.test(name)) return "pickleplay"
  if (/gensan|general santos/i.test(name)) return "gensan"
  return trendScope("homes", /^homes\.?ph\s+\S/i.test(name) ? name : null)
}

/** The memory's place for a poster: its brand, or its Homes.ph page. */
export const posterArticleScope = (brand: TrendBrand, page?: string | null) => trendScope(brand, page)

function clean(raw: Partial<ArticleMemory> | null | undefined): ArticleMemory {
  if (!raw || typeof raw !== "object") return EMPTY_MEMORY
  // Results saved by an older version lack the newer fields.
  const copy: PosterCopy | null =
    raw.copy && Array.isArray(raw.copy.options)
      ? { ...raw.copy, subtexts: raw.copy.subtexts ?? [], noSubtext: raw.copy.noSubtext ?? false, caption: raw.copy.caption ?? null, details: raw.copy.details ?? "" }
      : null
  return {
    mode: raw.mode === "link" || raw.mode === "trend" ? raw.mode : "paste",
    article: typeof raw.article === "string" ? raw.article : "",
    link: typeof raw.link === "string" ? raw.link : "",
    source: raw.source && typeof raw.source === "object" ? raw.source : null,
    copy,
    fellBack: typeof raw.fellBack === "string" ? raw.fellBack : null,
    brand: typeof raw.brand === "string" ? raw.brand : "",
  }
}

function readAll(): Record<string, Stored> {
  if (typeof window === "undefined") return {}
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "null") as Record<string, Stored> | null
    if (all && typeof all === "object") return all
    // The one memory from before: it belongs to the brand it was written for (none: it's dropped).
    const old = clean(JSON.parse(localStorage.getItem(OLD_KEY) ?? "null") as Partial<ArticleMemory> | null)
    return old.brand && (old.article || old.copy) ? { [articleScope(old.brand)]: old } : {}
  } catch {
    return {}
  }
}

/** A brand's or page's memory (empty when nothing was written for it yet). */
export function loadArticleMemory(scope: string): ArticleMemory {
  return clean(readAll()[scope])
}

export function saveArticleMemory(scope: string, memory: ArticleMemory) {
  try {
    const all = readAll()
    const empty = !memory.article && !memory.link && !memory.copy && !memory.source
    if (empty) delete all[scope]
    else all[scope] = { ...memory, at: Date.now() }
    const keep = Object.entries(all)
      .sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0))
      .slice(0, MAX_SCOPES)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep)))
    localStorage.removeItem(OLD_KEY)
  } catch {
    // Too big or private mode: kept until the page closes.
  }
}

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase()

/**
 * The article a poster's headline was written from: the memory (the poster's own brand first, then
 * any other) whose AI choices include that headline; null when it isn't one of them.
 */
export function articleMemoryOf(headline: string, brandName = ""): ArticleMemory | null {
  if (!headline.trim()) return null
  const all = readAll()
  const own = brandName ? articleScope(brandName) : ""
  const scopes = [...(own && all[own] ? [own] : []), ...Object.keys(all).filter((s) => s !== own)]
  for (const scope of scopes) {
    const memory = clean(all[scope])
    if (memory.copy?.options.some((o) => same(o.headline, headline))) return memory
  }
  return null
}

/** Keeps the caption in the brand's memory (e.g. after "Rewrite with AI" in the form). */
export function rememberCaption(caption: PosterCaption, brand: string) {
  const scope = articleScope(brand)
  const memory = loadArticleMemory(scope)
  if (!memory.copy) return
  saveArticleMemory(scope, { ...memory, copy: { ...memory.copy, caption }, brand: memory.brand || brand })
}

/** The caption's hashtags for this poster's brand (a caption written for another brand loses that brand's tag). */
export function captionFor(caption: PosterCaption, brand: string): PosterCaption {
  return { ...caption, hashtags: cleanHashtags(caption.hashtags.join(" "), brand) }
}
