import "server-only"

import { namesPattern, trendPlace, type HomesPlace } from "./homes-places"
import { foreignKeyword, trendArea } from "./trend-area"
import { extraLooks, lookQuery, requestLooks, wantsRealEstate } from "./trend-looks"
import { DEFAULT_TREND_DEVELOPERS } from "./trend-news"
import type { AiRequest, AiSource, SourceKind, TrendBrand } from "./types"

/**
 * Tavily web search (server-only): finds the news and pages for Trending news (Poster Maker) and
 * Search a topic (Create New Carousel); Groq or the user's own AI then writes from the results.
 * Basic searches cost 1 credit, advanced 2; the free plan has 1,000 credits a month.
 */

const API = "https://api.tavily.com"

/** "tvly-…" (also "tvly-dev-…"); checked before a key is sent anywhere. */
export const TAVILY_KEY_PATTERN = /^tvly-[A-Za-z0-9_-]{10,200}$/

export const isTavilyKey = (v: unknown): v is string => typeof v === "string" && TAVILY_KEY_PATTERN.test(v.trim())

/** Pages that aren't news articles or can't be read: social posts, videos, Tavily's own topic pages. */
export const SKIP_DOMAINS = [
  "tavily.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "pinterest.com",
  "reddit.com",
  "linkedin.com",
]

export interface TavilyQuery {
  query: string
  topic: "news" | "general"
  depth: "basic" | "advanced"
  maxResults: number
  /** YYYY-MM-DD (news window). */
  startDate?: string
  /** YYYY-MM-DD, the day after the window. */
  endDate?: string
  /** Boosts one country's pages (general searches only). */
  country?: string
  /** Leave out results without a publication date inside the window. */
  datedOnly?: boolean
  /** More sites to leave out (the brand's own site: its articles aren't "trending news"). */
  exclude?: string[]
  /** Search only these sites (["facebook.com"]: public Facebook posts). The usual left-out sites then don't apply. */
  include?: string[]
  /** The brand's country (two letters), for engines that take one on every search (Google). */
  region?: "PH" | "AE"
}

export interface TavilyResult {
  title: string
  url: string
  content: string
  /** YYYY-MM-DD, or null when Tavily found no date. */
  published: string | null
  /** Facebook posts: "facebook" (found by a search engine) or "page" (read with the Meta API). */
  kind?: SourceKind
  /** A picture of the story, when the engine gives one. */
  image?: string
  /** Facebook Page posts: the Page's name. */
  from?: string
}

/** Facebook's own addresses (www, m., web., fb.com…): such a result is a Facebook post. */
export const isFacebookUrl = (url: string) => /^https?:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.watch)(\/|$)/i.test(url.trim())

export class TavilyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** Tavily's error answers in plain words. */
export function tavilyError(status: number, detail = ""): TavilyError {
  if (status === 401 || status === 403) return new TavilyError("The Tavily API key was rejected. Check it in Settings → AI.", status)
  if (status === 432) return new TavilyError("Your Tavily credits for this month are used up (the free plan has 1,000 a month).", status)
  if (status === 433) return new TavilyError("Your Tavily pay-as-you-go limit was reached. You can raise it on app.tavily.com.", status)
  if (status === 429) return new TavilyError("Tavily got too many searches at once. Wait a moment and try again.", status)
  if (status >= 500) return new TavilyError("Tavily didn't answer. Please try again in a moment.", status)
  return new TavilyError(detail ? `Tavily: ${detail}` : `Tavily answered ${status}.`, status)
}

/** "Sun, 08 Nov 2026 16:00:00 GMT" → "2026-11-08" (UTC); null when there's no usable date. */
export function publishedDay(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10)
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** One Tavily search. Throws TavilyError (with a plain message) when Tavily refuses or fails. */
export async function tavilySearch(key: string, q: TavilyQuery, signal?: AbortSignal): Promise<{ results: TavilyResult[]; credits: number }> {
  let res: Response
  try {
    res = await fetch(`${API}/search`, {
      method: "POST",
      headers: { authorization: `Bearer ${key.trim()}`, "content-type": "application/json" },
      body: JSON.stringify({
        query: q.query,
        topic: q.topic,
        search_depth: q.depth,
        max_results: q.maxResults,
        chunks_per_source: q.depth === "advanced" ? 3 : 2,
        ...(q.include?.length ? { include_domains: q.include, ...(q.exclude?.length ? { exclude_domains: q.exclude } : {}) } : { exclude_domains: [...SKIP_DOMAINS, ...(q.exclude ?? [])] }),
        include_usage: true,
        ...(q.startDate ? { start_date: q.startDate } : {}),
        ...(q.endDate ? { end_date: q.endDate } : {}),
        ...(q.datedOnly ? { filter_by_published_date: true } : { include_published_date: true }),
        ...(q.topic === "general" && q.country ? { country: q.country } : {}),
      }),
      signal,
    })
  } catch {
    throw new TavilyError(signal?.aborted ? "The Tavily search took too long." : "Couldn't reach Tavily. Check your connection.", 504)
  }
  const body = (await res.json().catch(() => ({}))) as {
    results?: { title?: unknown; url?: unknown; content?: unknown; published_date?: unknown }[]
    usage?: { credits?: unknown }
    detail?: { error?: unknown } | unknown
  }
  if (!res.ok) {
    const detail = body.detail && typeof body.detail === "object" && "error" in body.detail ? String((body.detail as { error?: unknown }).error ?? "") : ""
    throw tavilyError(res.status, detail.slice(0, 200))
  }
  const results: TavilyResult[] = []
  for (const r of body.results ?? []) {
    if (typeof r?.url !== "string" || !/^https?:\/\//i.test(r.url)) continue
    const url = r.url.trim().slice(0, 500)
    results.push({
      title: typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim().slice(0, 200) : "",
      url,
      content: typeof r.content === "string" ? r.content.replace(/\s+/g, " ").trim() : "",
      published: publishedDay(r.published_date),
      ...(isFacebookUrl(url) ? { kind: "facebook" as const } : {}),
    })
  }
  const credits = typeof body.usage?.credits === "number" ? body.usage.credits : q.depth === "advanced" ? 2 : 1
  return { results, credits }
}

/** The key's credits this month (Settings → Test; costs no credit). */
export async function tavilyUsage(key: string, signal?: AbortSignal): Promise<{ used: number; limit: number | null; plan: string }> {
  let res: Response
  try {
    res = await fetch(`${API}/usage`, { headers: { authorization: `Bearer ${key.trim()}` }, signal })
  } catch {
    throw new TavilyError("Couldn't reach Tavily. Check your connection.", 504)
  }
  const body = (await res.json().catch(() => ({}))) as {
    key?: { usage?: unknown; limit?: unknown }
    account?: { current_plan?: unknown; plan_usage?: unknown; plan_limit?: unknown }
  }
  if (!res.ok) throw tavilyError(res.status)
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
  const used = num(body.account?.plan_usage) ?? num(body.key?.usage) ?? 0
  const limit = num(body.key?.limit) ?? num(body.account?.plan_limit)
  return { used, limit, plan: typeof body.account?.current_plan === "string" ? body.account.current_plan : "" }
}

/**
 * Philippine property listing and classifieds sites: a whole-web search for "… for Sale" or
 * "Rental Market" keywords finds their listings, which aren't news. Left out of the Homes.ph searches.
 */
export const PH_LISTING_SITES = ["rent.ph", "filipinohomes.com", "myproperty.ph", "onepropertee.com", "property24.com.ph", "carousell.ph", "olx.ph", "zipmatch.com", "realestate.com.ph"]

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec"
const MDY = new RegExp(String.raw`^\W*(${MONTHS})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b`, "i")
const DMY = new RegExp(String.raw`^\W*(\d{1,2})\s+(${MONTHS})[a-z]*\.?,?\s+(20\d{2})\b`, "i")

/** Pages without a date from the engine: the day in the address ("/2026/11/15/") or at the start of the text ("Nov 15, 2026 —"). */
export function pageDay(url: string, text = ""): string | null {
  const iso = (y: number, m: number, d: number) => {
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
    const at = new Date(Date.UTC(y, m - 1, d))
    return at.getUTCMonth() === m - 1 ? at.toISOString().slice(0, 10) : null
  }
  const inUrl = /\/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})(?=[/\-_.]|$)/.exec(url)
  const fromUrl = inUrl ? iso(Number(inUrl[1]), Number(inUrl[2]), Number(inUrl[3])) : null
  if (fromUrl) return fromUrl
  const head = text.slice(0, 60)
  const monthOf = (m: string) => ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m.toLowerCase().slice(0, 3)) + 1
  const mdy = MDY.exec(head)
  if (mdy) return iso(Number(mdy[3]), monthOf(mdy[1]), Number(mdy[2]))
  const dmy = DMY.exec(head)
  if (dmy) return iso(Number(dmy[3]), monthOf(dmy[2]), Number(dmy[1]))
  return null
}

/** Where each brand's news happens: added to a keyword that doesn't name the place. */
const BRAND_PLACE: Record<TrendBrand, { test: RegExp; word: string }> = {
  pickleplay: { test: /philippin|pinoy|filipino|manila|cebu|davao|\bph\b/i, word: "Philippines" },
  fhi: { test: /dubai|\buae\b|emirates|abu dhabi|sharjah|ajman|ras al khaimah|umm al quwain|fujairah|studio city/i, word: "Dubai" },
  homes: { test: /caraga|butuan|siargao|surigao|agusan|dinagat|bislig|tandag|bayugan|cabadbaran/i, word: "Caraga" },
  // General Santos City only (1.47).
  gensan: { test: /gensan|general santos|gen. santos|dadiangas/i, word: "General Santos City" },
}

/**
 * How each brand's news is searched. Tavily's news index covers pickleball in the Philippines and
 * Dubai well; Caraga and General Santos have few stories there, so they search the whole web, limited
 * to the Philippines (regional sites like PNA, PIA, Mindanao Times). Each brand's own site is left out.
 */
const TREND_STYLE: Record<TrendBrand, { topic: "news" | "general"; country?: string; own: string[] }> = {
  // The Philippines only (1.47): Perplexity and Google keep to Philippine pages with the country.
  pickleplay: { topic: "news", country: "philippines", own: ["pickleplay.ph"] },
  fhi: { topic: "news", own: ["fhiglobal.ae"] },
  homes: { topic: "general", country: "philippines", own: ["homes.ph", ...PH_LISTING_SITES] },
  gensan: { topic: "general", country: "philippines", own: ["homes.ph", ...PH_LISTING_SITES] },
}

/** Each brand's country, for engines that take one (Google through SerpApi). */
const BRAND_REGION: Record<TrendBrand, "PH" | "AE"> = { pickleplay: "PH", fhi: "AE", homes: "PH", gensan: "PH" }

/** Added to a partner developer's name: FHI's developers build across the UAE, not only in Dubai. */
const DEVELOPER_PLACE: Record<TrendBrand, string> = { pickleplay: "Philippines", fhi: "UAE", homes: "Caraga", gensan: "General Santos" }

/** Where a search's news happens: the brand's place, or a Homes.ph page's ("Cebu", "BGC Taguig"). */
function searchPlace(brand: TrendBrand, place?: HomesPlace | null): { test: RegExp; word: string; developer: string } {
  return place
    ? { test: namesPattern([place.keyword, ...place.aliases, ...place.names]), word: place.search, developer: place.search }
    : { ...BRAND_PLACE[brand], developer: DEVELOPER_PLACE[brand] }
}

/** The Homes.ph page's place a trending-news request searches (none for other brands and Homes.ph CARAGA). */
export const requestPlace = (req: { brand: TrendBrand; place?: string }): HomesPlace | null => trendPlace(req.brand, req.place)

/** "Emaar Properties" → "Emaar Properties UAE news"; "Camella Homes" → "Camella Homes Caraga news" (Homes.ph). */
export function developerQuery(developer: string, brand: TrendBrand, place?: HomesPlace | null): string {
  const where = searchPlace(brand, place)
  let q = developer.replace(/\s+/g, " ").trim()
  if (!where.test.test(q)) q += ` ${where.developer}`
  return `${q} news`.slice(0, 380)
}

/** "Pickleball Equipment" → "Pickleball Equipment Philippines news" (one keyword per search works best). */
export function keywordQuery(keyword: string, brand: TrendBrand, place?: HomesPlace | null): string {
  const where = searchPlace(brand, place)
  let q = keyword.replace(/\s+/g, " ").trim()
  if (!where.test.test(q)) q += ` ${where.word}`
  if (!/\bnews\b/i.test(q)) q += " news"
  return q.slice(0, 380)
}

/** Trending news makes this many news searches (one more with "Look for" kinds besides real estate). */
export const TREND_SEARCHES = { plain: 5, withKinds: 6 }
/** At most this many "Look for" kinds get a search of their own each time (they take turns). */
const KIND_SEARCHES = 3

/**
 * The keywords a Trending news search may use: each once, without those about another place
 * ("Koronadal City Properties" on Homes.ph Gensan). A developer's name is never "another place"
 * ("Cebu Landmasters" on Homes.ph Gensan means that developer's news in GenSan).
 */
export function searchableKeywords(req: Extract<AiRequest, { task: "trend-search" }>): string[] {
  const area = trendArea(req.brand, requestPlace(req))
  const developers = [...(req.developers ?? []), ...DEFAULT_TREND_DEVELOPERS[req.brand]]
  return [...new Set(req.keywords.map((k) => k.replace(/\s+/g, " ").trim()).filter(Boolean))].filter((k) => !foreignKeyword(k, area, developers))
}

/**
 * Trending news: 5 news searches in the window (6 with "Look for" kinds): the brand's main keyword
 * (the first one), one partner developer (when real estate is on), the "Look for" kinds (up to 3,
 * taking turns: "Butuan City festival November 2026"), then the other keywords in the order given.
 * The panel sends them starting where its last search stopped, so every keyword is searched in turn.
 * `keywords`: how many of the list's keywords this search used (the main one too).
 */
export function trendSearchPlan(req: Extract<AiRequest, { task: "trend-search" }>, random: () => number = Math.random): { queries: TavilyQuery[]; keywords: number } {
  const keywords = searchableKeywords(req)
  const rest = keywords.slice(1)
  const developers = [...new Set((req.developers ?? []).map((d) => d.replace(/\s+/g, " ").trim()).filter(Boolean))]
  const looks = requestLooks(req.brand, req.look)
  const developer = developers.length && wantsRealEstate(req.brand, looks) ? developers[Math.min(developers.length - 1, Math.floor(random() * developers.length))] : null
  const kinds = extraLooks(looks)
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  // Different searches ("Caraga Real Estate" and "Caraga Real Estate News" are the same one).
  const max = kinds.length ? TREND_SEARCHES.withKinds : TREND_SEARCHES.plain
  const queries: string[] = []
  const add = (q: string) => {
    if (q && queries.length < max && !queries.some((x) => x.toLowerCase() === q.toLowerCase())) queries.push(q)
  }
  const place = requestPlace(req)
  let used = 0
  if (keywords[0]) {
    add(keywordQuery(keywords[0], req.brand, place))
    used++
  }
  if (developer) add(developerQuery(developer, req.brand, place))
  for (const k of kinds.slice(0, KIND_SEARCHES)) add(lookQuery(k, req.brand, req.day, place?.search ?? null, random))
  for (const k of rest) {
    if (queries.length >= max) break
    // A keyword whose search is one already made still counts as used.
    add(keywordQuery(k, req.brand, place))
    used++
  }
  // One extra day before: Tavily's dates are UTC, and Manila or Dubai mornings are still "yesterday" in UTC.
  const startDate = addDays(req.day, -req.days)
  const endDate = addDays(req.day, 1)
  const style = TREND_STYLE[req.brand]
  return {
    keywords: used,
    queries: queries.map((query) => ({
      query,
      topic: style.topic,
      depth: "basic",
      maxResults: 10,
      startDate,
      endDate,
      datedOnly: true,
      exclude: style.own,
      region: BRAND_REGION[req.brand],
      ...(style.country ? { country: style.country } : {}),
    })),
  }
}

/** The Trending news searches (see trendSearchPlan). */
export const trendQueries = (req: Extract<AiRequest, { task: "trend-search" }>, random: () => number = Math.random): TavilyQuery[] => trendSearchPlan(req, random).queries

/** "Caraga Real Estate News" → "Caraga Real Estate" (a post isn't "news"); the place is added when missing. */
export function postQuery(keyword: string, brand: TrendBrand, place?: HomesPlace | null): string {
  const where = searchPlace(brand, place)
  let q = keyword.replace(/\s+/g, " ").replace(/\bnews\b/gi, " ").replace(/\s+/g, " ").trim()
  if (!where.test.test(q)) q += ` ${where.word}`
  return q.slice(0, 300)
}

/**
 * Trending news → public Facebook posts (search engines index some public Page posts): 2 searches
 * limited to facebook.com, for the main keyword and a partner developer (or another keyword), in the
 * same days as the news. Posts often have no date a search engine can read, so undated ones are kept
 * (the AI and the panel flag them).
 */
export function trendPostQueries(req: Extract<AiRequest, { task: "trend-search" }>, random: () => number = Math.random): TavilyQuery[] {
  const keywords = searchableKeywords(req)
  const developers = [...new Set((req.developers ?? []).map((d) => d.replace(/\s+/g, " ").trim()).filter(Boolean))]
  const place = requestPlace(req)
  const second = developers.length
    ? postQuery(developers[Math.min(developers.length - 1, Math.floor(random() * developers.length))], req.brand, place)
    : keywords.length > 1
      ? postQuery(keywords[1 + Math.min(keywords.length - 2, Math.floor(random() * (keywords.length - 1)))], req.brand, place)
      : ""
  const queries = [keywords[0] ? postQuery(keywords[0], req.brand, place) : "", second].filter((q, i, all) => q && all.findIndex((x) => x.toLowerCase() === q.toLowerCase()) === i)
  return queries.map((query) => ({
    query,
    topic: "general" as const,
    depth: "basic" as const,
    maxResults: 8,
    startDate: addDays(req.day, -req.days),
    endDate: addDays(req.day, 1),
    include: ["facebook.com"],
    region: BRAND_REGION[req.brand],
  }))
}

const GROUPS = ["Luzon", "Visayas", "Mindanao"] as const

/**
 * Search a topic: one advanced search (2 credits) for the topic, or one basic search per island
 * group when the topic asks for several ("Top 2 resorts each in Luzon, Visayas and Mindanao").
 */
export function researchQueries(req: Extract<AiRequest, { task: "carousel-research" }>): TavilyQuery[] {
  const country = req.brand === "fhi" ? "united arab emirates" : "philippines"
  const topic = req.topic.replace(/\s+/g, " ").trim()
  const groups = GROUPS.filter((g) => new RegExp(`\\b${g}\\b`, "i").test(topic))
  if (groups.length >= 2) {
    const base = topic
      .replace(/\b(?:each\s+)?(?:in|from|across)\s+(?:luzon|visayas|mindanao)(?:\s*(?:,|and|&)\s*(?:and\s+)?(?:luzon|visayas|mindanao))*/gi, " ")
      .replace(/\b(?:luzon|visayas|mindanao)\b/gi, " ")
      .replace(/\beach\b/gi, " ")
      .replace(/\s*,\s*(?=,|$)/g, "")
      .replace(/\s+/g, " ")
      .trim()
    return groups.map((g) => ({ query: `${base} in ${g}, Philippines`.slice(0, 380), topic: "general", depth: "basic", maxResults: 8, country }))
  }
  return [{ query: topic.slice(0, 380), topic: "general", depth: "advanced", maxResults: 10, country }]
}

/** Every search's results, best-ranked first and alternating between searches, each page once. */
export function mergeResults(lists: TavilyResult[][], max: number): TavilyResult[] {
  const seen = new Set<string>()
  const out: TavilyResult[] = []
  const key = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase()
  for (let rank = 0; out.length < max && lists.some((l) => rank < l.length); rank++) {
    for (const list of lists) {
      const r = list[rank]
      if (!r || seen.has(key(r.url))) continue
      seen.add(key(r.url))
      out.push(r)
      if (out.length >= max) break
    }
  }
  return out
}

/** The results as text for the AI, within `maxChars` (Groq's free plan allows about 8,000 tokens a minute). */
export function resultsBlock(results: TavilyResult[], maxChars = 10_000): string {
  if (!results.length) return "(no results)"
  const each = Math.max(250, Math.min(1200, Math.floor(maxChars / results.length) - 120))
  return results
    .map((r, i) => {
      const text = r.content.length > each ? `${r.content.slice(0, each).replace(/\s+\S*$/, "")}…` : r.content
      const type =
        r.kind === "page"
          ? [`TYPE: Facebook Page post${r.from ? ` by ${r.from}` : ""} (read from the Page itself)`]
          : r.kind === "facebook"
            ? ["TYPE: public Facebook post (found by a search engine; check whose Page posted it)"]
            : []
      return [`[${i + 1}] ${r.title || hostOf(r.url)}`, `URL: ${r.url}`, ...type, ...(r.published ? [`PUBLISHED: ${r.published}`] : []), `TEXT: ${text || "(no text)"}`].join("\n")
    })
    .join("\n\n")
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** The pages Tavily found, as sources for the panels (each is a page the AI was given). */
export const resultSources = (results: TavilyResult[]): AiSource[] =>
  results.map((r) => ({
    title: r.title || hostOf(r.url),
    url: r.url,
    ...(r.published ? { date: r.published } : {}),
    ...(r.kind ? { kind: r.kind } : {}),
    ...(r.image ? { image: r.image } : {}),
    ...(r.from ? { from: r.from } : {}),
  }))

/** Trending news: only results dated inside the window (one UTC day of slack before it, never after the poster's day). */
export function inWindow(results: TavilyResult[], day: string, days: number): TavilyResult[] {
  const start = addDays(day, -days)
  return results.filter((r) => !!r.published && r.published >= start && r.published <= day)
}

/** Facebook posts: those dated inside the window, and those without a date (flagged later); never later ones or older ones. */
export function postsInWindow(results: TavilyResult[], day: string, days: number): TavilyResult[] {
  const start = addDays(day, -days)
  return results.filter((r) => !r.published || (r.published >= start && r.published <= day))
}
