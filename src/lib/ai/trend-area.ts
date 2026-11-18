import { CARAGA_NAMES, FOREIGN_PLACES, GENSAN_NAMES, PH_MARKERS, PH_PLACES } from "./area-names"
import { homesPlace, namesPattern, type HomesPlace } from "./homes-places"
import { partnerIn } from "./trend-news"
import type { TrendBrand } from "./types"

/**
 * Trending news keeps each page's news in its own place (1.47): Homes.ph CARAGA's in the Caraga region,
 * Homes.ph Gensan's in General Santos City, PicklePlay's in the Philippines, a Homes.ph page's in its city
 * or province. A story (or a keyword) that names another place and none of the page's own is left out.
 * FHI and the nationwide Homes.ph Main Page aren't checked.
 */
export interface TrendArea {
  /** For people and the AI: "General Santos City", "the Caraga region", "the Philippines", "Cebu". */
  label: string
  /** What a story in the area names (the most specific first). */
  inside: readonly string[]
  /** Places outside it. */
  outside: readonly string[]
}

const without = (list: readonly string[], inside: readonly string[]) => {
  const own = namesPattern(inside)
  // A name that is (or contains) one of the area's own names is never "outside" ("Cebu" vs "Cebu City").
  return list.filter((n) => !own.test(n) && !inside.some((i) => i.toLowerCase().includes(n.toLowerCase())))
}

const CARAGA_AREA: TrendArea = { label: "the Caraga region", inside: CARAGA_NAMES, outside: without(PH_PLACES, CARAGA_NAMES) }
const GENSAN_AREA: TrendArea = { label: "General Santos City", inside: GENSAN_NAMES, outside: without(PH_PLACES, GENSAN_NAMES) }
const PICKLEBALL_AREA: TrendArea = { label: "the Philippines", inside: [...PH_MARKERS, ...PH_PLACES], outside: FOREIGN_PLACES }

const pageAreas = new Map<string, TrendArea>()

/** The area a Trending news search keeps to (null: not checked). `place`: a Homes.ph page's place (its name or itself). */
export function trendArea(brand: TrendBrand, place?: HomesPlace | string | null): TrendArea | null {
  if (brand === "pickleplay") return PICKLEBALL_AREA
  if (brand === "gensan") return GENSAN_AREA
  if (brand === "fhi") return null
  const p = typeof place === "string" ? homesPlace(place) : place
  if (!p || /^caraga$/i.test(p.page)) return CARAGA_AREA
  if (/^gensan$/i.test(p.page)) return GENSAN_AREA
  if (p.page === "Main Page") return null
  let area = pageAreas.get(p.page)
  if (!area) {
    area = { label: p.keyword, inside: p.names, outside: without(PH_PLACES, p.names) }
    pageAreas.set(p.page, area)
  }
  return area
}

const patterns = new WeakMap<TrendArea, { inside: RegExp; outside: RegExp | null }>()
function patternsOf(area: TrendArea) {
  let p = patterns.get(area)
  if (!p) {
    p = { inside: namesPattern(area.inside), outside: area.outside.length ? namesPattern(area.outside) : null }
    patterns.set(area, p)
  }
  return p
}

/** Where a text is: in the area (it names one of its places), elsewhere (it names only other places), or "none". */
export function areaOf(text: string, area: TrendArea | null): "inside" | "outside" | "none" {
  if (!area) return "inside"
  const { inside, outside } = patternsOf(area)
  if (inside.test(text)) return "inside"
  return outside?.test(text) ? "outside" : "none"
}

/** The other place a text names ("Koronadal"), or "". */
export function otherPlaceIn(text: string, area: TrendArea | null): string {
  if (!area) return ""
  const { inside, outside } = patternsOf(area)
  if (!outside || inside.test(text)) return ""
  return outside.exec(text)?.[0] ?? ""
}

/**
 * A keyword about another place ("Koronadal City Properties" on Homes.ph Gensan): never searched,
 * removed from the list. A developer's name isn't a place ("Cebu Landmasters": that developer's news).
 */
export const foreignKeyword = (keyword: string, area: TrendArea | null, developers: readonly string[] = []): boolean =>
  areaOf(keyword, area) === "outside" && !partnerIn(keyword, developers)

/**
 * A keyword list cleaned for its area: keywords about other places go. A Homes.ph page's keywords copied
 * from Homes.ph CARAGA ("Caraga Restaurant Grand Opening" on Homes.ph Cebu) get the page's place instead.
 */
export function cleanAreaKeywords(
  keywords: readonly string[],
  area: TrendArea | null,
  place?: HomesPlace | null,
  developers: readonly string[] = [],
): { kept: string[]; removed: string[] } {
  const kept: string[] = []
  const removed: string[] = []
  const seen = new Set<string>()
  const caraga = place && !/^caraga$/i.test(place.page) && place.page !== "Main Page" ? namesPattern(["Caraga"]) : null
  for (const k of keywords) {
    const swapped = caraga ? k.replace(new RegExp(caraga.source, "giu"), place!.keyword).replace(/\s+/g, " ").trim() : k
    if (foreignKeyword(swapped, area, developers)) {
      removed.push(k)
      continue
    }
    if (seen.has(swapped.toLowerCase())) {
      if (swapped !== k) removed.push(k)
      continue
    }
    seen.add(swapped.toLowerCase())
    kept.push(swapped)
  }
  return { kept, removed }
}

/** The first keyword, then the others starting at `at` (and around): the order a search uses them. */
export function keywordsInTurn(keywords: string[], at: number): string[] {
  if (keywords.length <= 2) return keywords
  const rest = keywords.slice(1)
  const start = ((at % rest.length) + rest.length) % rest.length
  return [keywords[0], ...rest.slice(start), ...rest.slice(0, start)]
}
