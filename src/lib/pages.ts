import type { DailyBrand } from "@/lib/design/news-templates"

/**
 * The pages a person can be assigned (the first-run setup and Settings → Assigned pages): the 17 Homes.ph
 * Facebook pages, the 6 site pages, and the carousel. The sidebar, Home, News Article, Poster Maker,
 * Advertisement, the Daily Report and the Homes.ph Publisher extension show only what's assigned.
 */

export type HomesPageKey =
  | "main"
  | "ozamiz"
  | "dumaguete"
  | "bgc-taguig"
  | "cebu"
  | "pampanga"
  | "cavite"
  | "iloilo"
  | "bacolod"
  | "davao"
  | "palawan"
  | "bohol"
  | "makati"
  | "cdo"
  | "gensan"
  | "caraga"
  | "leyte"

export type SitePageKey = "fhi" | "pickleplay" | "bayanihan" | "filipinohomes" | "bayanihan-dubai" | "rentsouq"

export interface HomesPage {
  key: HomesPageKey
  /** "Homes.ph Cebu": the name on the posting checklist and on Homes.ph posters. */
  name: string
  /** "Cebu" */
  short: string
}

export interface SitePage {
  key: SitePageKey
  /** "FHI Global Dubai": its Facebook page. */
  name: string
  /** "FHI Global": shorter, for tabs. */
  short: string
  site: string
}

/** The Homes.ph pages, in the posting checklist's order. */
export const HOMES_PAGE_LIST: readonly HomesPage[] = (
  [
    ["main", "Homes.ph Main Page", "Main Page"],
    ["ozamiz", "Homes.ph Ozamiz", "Ozamiz"],
    ["dumaguete", "Homes.ph Dumaguete", "Dumaguete"],
    ["bgc-taguig", "Homes.ph BGC Taguig", "BGC Taguig"],
    ["cebu", "Homes.ph Cebu", "Cebu"],
    ["pampanga", "Homes.ph Pampanga", "Pampanga"],
    ["cavite", "Homes.ph Cavite", "Cavite"],
    ["iloilo", "Homes.ph Iloilo", "Iloilo"],
    ["bacolod", "Homes.ph Bacolod", "Bacolod"],
    ["davao", "Homes.ph Davao", "Davao"],
    ["palawan", "Homes.ph Palawan", "Palawan"],
    ["bohol", "Homes.ph Bohol", "Bohol"],
    ["makati", "Homes.ph Makati", "Makati"],
    ["cdo", "Homes.ph CDO", "CDO"],
    ["gensan", "Homes.ph Gensan", "Gensan"],
    ["caraga", "Homes.ph Caraga", "Caraga"],
    ["leyte", "Homes.ph Leyte", "Leyte"],
  ] as const
).map(([key, name, short]) => ({ key, name, short }))

/** The site pages. */
export const SITE_PAGE_LIST: readonly SitePage[] = [
  { key: "fhi", name: "FHI Global Dubai", short: "FHI Global", site: "fhiglobal.ae" },
  { key: "pickleplay", name: "Pickleplay.ph", short: "PicklePlay", site: "pickleplay.ph" },
  { key: "bayanihan", name: "Bayanihan", short: "Bayanihan", site: "bayanihan.com" },
  { key: "filipinohomes", name: "Filipino Homes", short: "Filipino Homes", site: "filipinohomes.com" },
  { key: "bayanihan-dubai", name: "Bayanihan Dubai", short: "Bayanihan Dubai", site: "bayanihan.com" },
  { key: "rentsouq", name: "Rentsouq.ae", short: "Rentsouq.ae", site: "rentsouq.ae" },
]

export interface Assignment {
  homes: HomesPageKey[]
  sites: SitePageKey[]
  /** Makes the day's carousel (Calendar, Day Board, the carousel on Home and in the Daily Report). */
  carousel: boolean
}

/** What the app always showed before pages could be assigned: FHI, PicklePlay, Gensan, CARAGA and the carousel. */
export const LEGACY_ASSIGNMENT: Assignment = { homes: ["gensan", "caraga"], sites: ["fhi", "pickleplay"], carousel: true }

/** A new person's starting point in the setup: nothing ticked, the carousel off. */
export const EMPTY_ASSIGNMENT: Assignment = { homes: [], sites: [], carousel: false }

const HOMES_KEYS = new Set<string>(HOMES_PAGE_LIST.map((p) => p.key))
const SITE_KEYS = new Set<string>(SITE_PAGE_LIST.map((p) => p.key))

/** A saved assignment, checked: known pages only, in the lists' order, no repeats. Null when it isn't one. */
export function normalizeAssignment(raw: unknown): Assignment | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.homes) || !Array.isArray(r.sites)) return null
  const homes = new Set(r.homes.filter((k): k is string => typeof k === "string" && HOMES_KEYS.has(k)))
  const sites = new Set(r.sites.filter((k): k is string => typeof k === "string" && SITE_KEYS.has(k)))
  return {
    homes: HOMES_PAGE_LIST.filter((p) => homes.has(p.key)).map((p) => p.key),
    sites: SITE_PAGE_LIST.filter((p) => sites.has(p.key)).map((p) => p.key),
    carousel: r.carousel === true,
  }
}

export const sameAssignment = (a: Assignment, b: Assignment) =>
  a.carousel === b.carousel && a.homes.join() === b.homes.join() && a.sites.join() === b.sites.join()

/** "homes:cebu", "site:fhi": a page, in addresses (?page=) and lists. */
export type PageId = `homes:${HomesPageKey}` | `site:${SitePageKey}`

export const homesPage = (key: HomesPageKey) => HOMES_PAGE_LIST.find((p) => p.key === key)!
export const sitePage = (key: SitePageKey) => SITE_PAGE_LIST.find((p) => p.key === key)!

/** A Homes.ph page by its name ("Homes.ph Caraga", "Caraga", "Homes.ph CARAGA"), or undefined. */
export function homesPageByName(name: string | null | undefined): HomesPage | undefined {
  const n = String(name ?? "")
    .toLowerCase()
    .replace(/^homes\.?ph\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!n) return undefined
  return HOMES_PAGE_LIST.find((p) => p.short.toLowerCase() === n || p.name.toLowerCase() === n || p.key === n)
}

export function parsePageId(id: string | null | undefined): { kind: "homes"; page: HomesPage } | { kind: "site"; page: SitePage } | null {
  const m = /^(homes|site):(.+)$/.exec(String(id ?? ""))
  if (!m) return null
  if (m[1] === "homes") {
    const page = HOMES_PAGE_LIST.find((p) => p.key === m[2])
    return page ? { kind: "homes", page } : null
  }
  const page = SITE_PAGE_LIST.find((p) => p.key === m[2])
  return page ? { kind: "site", page } : null
}

/** "Homes.ph Cebu", "Homes.ph CARAGA", "FHI Global Dubai". */
export function pageName(id: PageId): string {
  const p = parsePageId(id)
  if (!p) return id
  return p.kind === "homes" ? p.page.name.replace(/\bCaraga\b/, "CARAGA") : p.page.name
}

/** The assigned Homes.ph pages and sites, as ids (Homes.ph first). */
export function assignedPageIds(a: Assignment): PageId[] {
  return [...a.homes.map((k) => `homes:${k}` as const), ...a.sites.map((k) => `site:${k}` as const)]
}

export const hasAnyPage = (a: Assignment) => a.homes.length + a.sites.length > 0

/**
 * A page's News Article lane: PicklePlay, FHI, CARAGA and Gensan have their own daily brand (their posts,
 * templates and report rows); the other Homes.ph pages use the Homes.ph design with the page's name on the
 * post; the other sites have no News Article template yet (null).
 */
export function newsLaneOf(id: PageId): { brand: DailyBrand; page: null } | { brand: "homes"; page: string } | null {
  const p = parsePageId(id)
  if (!p) return null
  if (p.kind === "site") return p.page.key === "fhi" || p.page.key === "pickleplay" ? { brand: p.page.key, page: null } : null
  if (p.page.key === "caraga" || p.page.key === "gensan") return { brand: p.page.key, page: null }
  return { brand: "homes", page: p.page.name }
}

/** The page of a daily brand (PicklePlay → site:pickleplay, CARAGA → homes:caraga). */
export function pageIdOfBrand(brand: DailyBrand): PageId {
  return brand === "fhi" || brand === "pickleplay" ? `site:${brand}` : `homes:${brand}`
}

/**
 * The tabs of a page switcher (News Article, Poster Maker, Advertisement): one "Homes.ph" tab for the Homes.ph
 * pages (a dropdown of them when there are several; named after the page when there's one), then each site.
 */
export interface PageTab {
  /** "homes" for the Homes.ph tab, else the site's id ("site:fhi"). */
  id: "homes" | PageId
  label: string
  /** The Homes.ph tab's pages (several = a dropdown). */
  pages: PageId[]
}

export function pageTabs(ids: readonly PageId[]): PageTab[] {
  const homes = ids.filter((id) => id.startsWith("homes:"))
  const tabs: PageTab[] = []
  if (homes.length) tabs.push({ id: "homes", label: homes.length === 1 ? pageName(homes[0]) : "Homes.ph", pages: homes })
  for (const id of ids) if (id.startsWith("site:")) tabs.push({ id, label: pageName(id), pages: [id] })
  return tabs
}

/** The tab a page is on. */
export const tabOfPage = (id: PageId): "homes" | PageId => (id.startsWith("homes:") ? "homes" : id)
