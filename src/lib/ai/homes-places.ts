import { CARAGA_NAMES, GENSAN_NAMES } from "./area-names"
import { DEFAULT_TREND_KEYWORDS } from "./trend-news"
import type { TrendBrand } from "./types"

/**
 * The Homes.ph Facebook pages as places, for Poster Maker → Trending news. Each page searches its own
 * place: its default keywords are the team's Homes.ph keywords written for it ("Cebu Real Estate" on
 * Homes.ph Cebu), the search adds the place when a keyword doesn't name it, and the AI keeps every
 * story in that place. Homes.ph CARAGA and Homes.ph Gensan keep the team's own lists.
 */
export interface HomesPlace {
  /** The page's short name: "Cebu", "BGC Taguig", "Main Page". */
  page: string
  /** The place in keywords: "Cebu", "Cagayan de Oro", "Philippines" (Main Page). */
  keyword: string
  /** Other ways a keyword names it ("CDO"): swapped too when a keyword is copied to another page. */
  aliases: string[]
  /** Added to a search that doesn't name the place. */
  search: string
  /** The places a story may name, the most specific first (the one found is shown on the story). */
  names: string[]
  /** For the AI: where the news must be. */
  region: string
}

/** Philippine places for the nationwide Main Page (the most specific first). */
const PHILIPPINE_PLACES = [
  "Metro Manila", "Quezon City", "Makati", "Taguig", "BGC", "Pasig", "Mandaluyong", "Parañaque", "Pasay", "Muntinlupa", "Manila",
  "Cebu City", "Cebu", "Davao City", "Davao", "Iloilo", "Bacolod", "Cagayan de Oro", "Clark", "Pampanga", "Laguna", "Cavite", "Batangas",
  "Bulacan", "Palawan", "Bohol", "Dumaguete", "Tacloban", "Leyte", "General Santos", "Butuan", "Caraga", "Mindanao", "Visayas", "Luzon", "Philippines",
]

const place = (p: Omit<HomesPlace, "aliases"> & { aliases?: string[] }): HomesPlace => ({ aliases: [], ...p })

/** Every page of the posting checklist, by its short name (lowercase). */
const PLACES: Record<string, HomesPlace> = {
  "main page": place({
    page: "Main Page",
    keyword: "Philippines",
    aliases: ["Philippine"],
    search: "Philippines",
    names: PHILIPPINE_PLACES,
    region: "the Philippines (nationwide: any city or province)",
  }),
  ozamiz: place({
    page: "Ozamiz",
    keyword: "Ozamiz",
    aliases: ["Ozamiz City", "Ozamis City", "Ozamis"],
    search: "Ozamiz City",
    names: ["Ozamiz City", "Ozamis City", "Ozamiz", "Ozamis", "Oroquieta", "Tangub", "Misamis Occidental"],
    region: "Ozamiz City and Misamis Occidental (Oroquieta, Tangub), Northern Mindanao",
  }),
  dumaguete: place({
    page: "Dumaguete",
    keyword: "Dumaguete",
    aliases: ["Dumaguete City"],
    search: "Dumaguete City",
    names: ["Dumaguete City", "Dumaguete", "Sibulan", "Valencia", "Bais", "Negros Oriental"],
    region: "Dumaguete City and Negros Oriental (Sibulan, Valencia, Bais), Central Visayas",
  }),
  "bgc taguig": place({
    page: "BGC Taguig",
    keyword: "BGC Taguig",
    aliases: ["Bonifacio Global City", "BGC", "Taguig City", "Taguig"],
    search: "BGC Taguig",
    names: ["Bonifacio Global City", "BGC", "Fort Bonifacio", "McKinley", "Taguig City", "Taguig"],
    region: "Bonifacio Global City (BGC) and Taguig City, Metro Manila",
  }),
  cebu: place({
    page: "Cebu",
    keyword: "Cebu",
    aliases: ["Cebu City"],
    search: "Cebu",
    names: ["Cebu City", "Mandaue", "Lapu-Lapu", "Mactan", "Talisay", "Consolacion", "Liloan", "Minglanilla", "Cebu"],
    region: "Cebu City and Cebu province (Mandaue, Lapu-Lapu, Mactan, Talisay, Consolacion), Central Visayas",
  }),
  pampanga: place({
    page: "Pampanga",
    keyword: "Pampanga",
    search: "Pampanga",
    names: ["Clark Freeport", "Clark", "Angeles City", "City of San Fernando", "San Fernando", "Mabalacat", "Porac", "Pampanga"],
    region: "Pampanga (Clark, Angeles City, City of San Fernando, Mabalacat, Porac), Central Luzon",
  }),
  cavite: place({
    page: "Cavite",
    keyword: "Cavite",
    search: "Cavite",
    names: ["General Trias", "Dasmariñas", "Dasmarinas", "Imus", "Bacoor", "Silang", "Tagaytay", "Kawit", "Cavite City", "Cavite"],
    region: "Cavite province (Imus, Bacoor, Dasmariñas, General Trias, Silang, Tagaytay), CALABARZON",
  }),
  iloilo: place({
    page: "Iloilo",
    keyword: "Iloilo",
    aliases: ["Iloilo City"],
    search: "Iloilo",
    names: ["Iloilo City", "Iloilo Business Park", "Oton", "Pavia", "Iloilo"],
    region: "Iloilo City and Iloilo province, Western Visayas",
  }),
  bacolod: place({
    page: "Bacolod",
    keyword: "Bacolod",
    aliases: ["Bacolod City"],
    search: "Bacolod City",
    names: ["Bacolod City", "Bacolod", "Talisay City", "Silay", "Negros Occidental"],
    region: "Bacolod City and Negros Occidental (Talisay, Silay), Western Visayas",
  }),
  davao: place({
    page: "Davao",
    keyword: "Davao",
    aliases: ["Davao City"],
    search: "Davao",
    names: ["Davao City", "Davao del Norte", "Davao del Sur", "Tagum", "Panabo", "Samal", "Davao"],
    region: "Davao City and the Davao Region (Tagum, Panabo, Samal), Mindanao",
  }),
  palawan: place({
    page: "Palawan",
    keyword: "Palawan",
    search: "Palawan",
    names: ["Puerto Princesa", "El Nido", "Coron", "San Vicente", "Palawan"],
    region: "Palawan (Puerto Princesa, El Nido, Coron, San Vicente), MIMAROPA",
  }),
  bohol: place({
    page: "Bohol",
    keyword: "Bohol",
    search: "Bohol",
    names: ["Tagbilaran City", "Tagbilaran", "Panglao", "Bohol"],
    region: "Bohol (Tagbilaran City, Panglao), Central Visayas",
  }),
  makati: place({
    page: "Makati",
    keyword: "Makati",
    aliases: ["Makati City"],
    search: "Makati City",
    names: ["Makati City", "Makati CBD", "Ayala Avenue", "Rockwell", "Makati"],
    region: "Makati City, Metro Manila",
  }),
  cdo: place({
    page: "CDO",
    keyword: "Cagayan de Oro",
    aliases: ["Cagayan de Oro City", "CDO"],
    search: "Cagayan de Oro",
    names: ["Cagayan de Oro City", "Cagayan de Oro", "CDO", "Opol", "El Salvador City", "Misamis Oriental"],
    region: "Cagayan de Oro City and Misamis Oriental (Opol, El Salvador), Northern Mindanao",
  }),
  gensan: place({
    page: "Gensan",
    keyword: "GenSan",
    aliases: ["General Santos City", "General Santos"],
    search: "General Santos City",
    // General Santos City only (1.47): Koronadal, Polomolok, South Cotabato, Sarangani… are other places.
    names: [...GENSAN_NAMES],
    region: "General Santos City (GenSan), Mindanao: the city itself, not Koronadal, Polomolok or the rest of South Cotabato and Sarangani",
  }),
  caraga: place({
    page: "Caraga",
    keyword: "Caraga",
    search: "Caraga",
    names: [...CARAGA_NAMES],
    region: "the Caraga region of Mindanao (Butuan, Agusan del Norte, Agusan del Sur, Surigao del Norte, Surigao del Sur, Siargao, Dinagat Islands)",
  }),
  leyte: place({
    page: "Leyte",
    keyword: "Leyte",
    search: "Leyte",
    names: ["Tacloban City", "Tacloban", "Ormoc City", "Ormoc", "Palo", "Baybay", "Leyte"],
    region: "Leyte (Tacloban City, Ormoc City, Palo, Baybay), Eastern Visayas",
  }),
}

/** "Homes.ph BGC Taguig" → "BGC Taguig"; "Cebu" stays "Cebu". */
export function pageShortName(page: string): string {
  return page.replace(/\s+/g, " ").trim().replace(/^homes\.?ph\s+/i, "") || page.trim()
}

/** "Homes.ph BGC Taguig" → "bgc-taguig" (the page in the Poster Maker's address). */
export function pageSlug(page: string): string {
  return (
    pageShortName(page)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page"
  )
}

/** Two names of the same page ("Homes.ph Caraga" / "Homes.ph CARAGA" / "Caraga"). */
export function samePage(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && pageShortName(a).toLowerCase() === pageShortName(b).toLowerCase()
}

export const isCaragaPage = (page: string | null | undefined) => samePage(page, "Caraga")
export const isGensanPage = (page: string | null | undefined) => samePage(page, "Gensan")

/** A page's place (a page the team added later: its own name, in the Philippines). */
export function homesPlace(page: string): HomesPlace {
  const short = pageShortName(page)
  return PLACES[short.toLowerCase()] ?? place({ page: short, keyword: short, search: short, names: [short], region: `${short}, Philippines` })
}

/**
 * The team's Homes.ph keywords for any place (from the Homes.ph CARAGA list): "{place}" is the page's
 * place. Real estate first (the first one is searched every time), then business and growth.
 */
export const HOMES_KEYWORD_TEMPLATES: readonly string[] = [
  "{place} Real Estate",
  "{place} Property Market",
  "{place} Real Estate News",
  "{place} Properties for Sale",
  "{place} Property Investment",
  "{place} Housing Developments",
  "{place} House and Lot",
  "{place} Land for Sale",
  "{place} New Housing Projects",
  "{place} Subdivision Developments",
  "{place} Condo Developments",
  "{place} Commercial Properties",
  "{place} Property Developers",
  "{place} Business News",
  "{place} New Business Openings",
  "{place} Infrastructure Projects",
  "{place} Economic Growth",
  "{place} Tourism Development",
]

/** A page's default keywords: the templates with its place ("Cebu Real Estate", …). */
export function homesPlaceKeywords(p: HomesPlace): string[] {
  return HOMES_KEYWORD_TEMPLATES.map((t) => t.replace("{place}", p.keyword))
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** A whole-word, any-case test for any of these names ("T'boli" also matches "T’boli" and "Tboli"). */
export function namesPattern(names: readonly string[]): RegExp {
  const parts = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length).map((n) => escape(n).replace("'", "['’]?"))
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join("|")})(?![\\p{L}\\p{N}])`, "iu")
}

/**
 * A keyword written for one page, for another: its place becomes the other page's place
 * ("Caraga Restaurant Grand Opening" → "Cebu Restaurant Grand Opening"). A keyword that doesn't
 * name the place stays as it is ("Pag-IBIG Housing Loan").
 */
export function swapPlace(keyword: string, from: HomesPlace, to: HomesPlace): string {
  const re = new RegExp(namesPattern([from.keyword, ...from.aliases]).source, "giu")
  return keyword.replace(re, to.keyword).replace(/\s+/g, " ").trim()
}

/**
 * Where Trending news keeps a poster's lists (keywords, developers, Pages, saved stories) on this
 * computer: one per brand, and one per Homes.ph page. Homes.ph CARAGA keeps "homes" and Homes.ph
 * Gensan "gensan", so the lists saved before 1.38 stay theirs.
 */
export function trendScope(brand: TrendBrand, page?: string | null): string {
  if (brand !== "homes" || !page || isCaragaPage(page)) return brand
  return isGensanPage(page) ? "gensan" : `homes@${pageSlug(page)}`
}

/** The page's place for the search: only Homes.ph pages other than CARAGA (Gensan has its own brand). */
export function trendPlace(brand: TrendBrand, page?: string | null): HomesPlace | null {
  return brand === "homes" && page && !isCaragaPage(page) && !isGensanPage(page) ? homesPlace(page) : null
}

/** The search keywords a list starts with: the team's list, or the Homes.ph keywords written for the page's place. */
export function defaultTrendKeywords(brand: TrendBrand, page?: string | null): readonly string[] {
  const p = trendPlace(brand, page)
  return p ? homesPlaceKeywords(p) : DEFAULT_TREND_KEYWORDS[brand]
}

/** A Homes.ph page's brand in Trending news (Gensan has its own; the others are Homes.ph). */
export const trendBrandOfPage = (page: string): TrendBrand => (isGensanPage(page) ? "gensan" : "homes")

/**
 * Typed or pasted keywords → one each: separated by commas, semicolons, "|" or new lines, extra
 * spaces gone, no length limit (a sanity cap of 200 characters), each once.
 */
export function splitTerms(text: string, max = 200): string[] {
  const out: string[] = []
  for (const raw of text.split(/[,;|\n\r\t]+/)) {
    const t = raw.replace(/\s+/g, " ").trim().replace(/^[-•*·]+\s*/, "").slice(0, max).trim()
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out
}
