import "server-only"

import { listModels, recommendModel } from "./providers"
import { isFacebookUrl, pageDay, publishedDay, SKIP_DOMAINS, type TavilyQuery, type TavilyResult } from "./tavily"
import type { AiSource, SearchEngineId } from "./types"

/**
 * The web searches besides Tavily (server-only):
 *   - Google through SerpApi: Google News results with dates, and Google's results limited to a site
 *     (public Facebook posts Google has indexed); the writing AI then picks from them;
 *   - Perplexity's Search API: ranked pages with dates, like Tavily (the writing AI then picks from them);
 *   - Gemini with Google Search: Gemini searches and writes the answer itself (its sources come back as
 *     Google redirect links, turned into the real page addresses here).
 * Keys come from the person's own settings, for the one request.
 */

/** A web search engine refused or failed (bad key, no credits, down): another engine may try. */
export class SearchFailed extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly engine: SearchEngineId,
  ) {
    super(message)
  }
}

// ---------- Perplexity Search API ----------

const PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search"

/** Tavily's country names → the two-letter codes Perplexity takes. */
const COUNTRY_CODE: Record<string, string> = { philippines: "PH", "united arab emirates": "AE" }

/** "2026-11-08" → "11/08/2026" (Perplexity's date filters). */
const usDate = (day: string) => `${day.slice(5, 7)}/${day.slice(8, 10)}/${day.slice(0, 4)}`

/** Perplexity's error answers in plain words. */
export function perplexityError(status: number, detail = ""): SearchFailed {
  if (status === 401 || status === 403) return new SearchFailed("The Perplexity API key was rejected. Check it in Settings → AI.", status, "perplexity")
  if (status === 402) return new SearchFailed("Your Perplexity API credits are used up (console.perplexity.ai → Billing).", status, "perplexity")
  if (status === 429) return new SearchFailed("Perplexity got too many searches at once. Wait a moment and try again.", status, "perplexity")
  if (status >= 500) return new SearchFailed("Perplexity didn't answer. Please try again in a moment.", status, "perplexity")
  return new SearchFailed(detail ? `Perplexity: ${detail}` : `Perplexity answered ${status}.`, status, "perplexity")
}

/** The request body for one search (the same searches the app makes with Tavily). */
export function perplexitySearchBody(q: TavilyQuery): Record<string, unknown> {
  // Sites to leave out ("-site"), or the only sites to search (Facebook posts); Perplexity takes at most 20.
  const exclude = q.include?.length ? q.include.slice(0, 20) : [...new Set([...SKIP_DOMAINS, ...(q.exclude ?? [])])].slice(0, 20).map((d) => `-${d}`)
  const country = q.country ? COUNTRY_CODE[q.country.toLowerCase()] : q.region
  return {
    query: q.query,
    max_results: Math.min(20, Math.max(1, q.maxResults)),
    max_tokens_per_page: q.depth === "advanced" ? 1024 : 512,
    search_domain_filter: exclude,
    ...(country ? { country } : {}),
    ...(q.startDate ? { search_after_date_filter: usDate(q.startDate) } : {}),
    ...(q.endDate ? { search_before_date_filter: usDate(q.endDate) } : {}),
  }
}

/** One Perplexity search: the pages as Tavily-style results (1 billed request). */
export async function perplexitySearch(key: string, q: TavilyQuery, signal?: AbortSignal): Promise<{ results: TavilyResult[]; credits: number }> {
  let res: Response
  try {
    res = await fetch(PERPLEXITY_SEARCH_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key.trim()}`, "content-type": "application/json" },
      body: JSON.stringify(perplexitySearchBody(q)),
      signal,
    })
  } catch {
    throw new SearchFailed(signal?.aborted ? "The Perplexity search took too long." : "Couldn't reach Perplexity. Check your connection.", 504, "perplexity")
  }
  const body = (await res.json().catch(() => ({}))) as {
    results?: { title?: unknown; url?: unknown; snippet?: unknown; date?: unknown; last_updated?: unknown }[]
    detail?: { msg?: unknown }[] | unknown
    error?: { message?: unknown }
  }
  if (!res.ok) {
    const detail = Array.isArray(body.detail) ? String(body.detail[0]?.msg ?? "") : typeof body.error?.message === "string" ? body.error.message : ""
    throw perplexityError(res.status, detail.slice(0, 200))
  }
  return { results: perplexityResults(body.results, !!q.datedOnly), credits: 1 }
}

/** Perplexity's results → Tavily-style results (news searches keep only pages with a publication date). */
export function perplexityResults(list: unknown, datedOnly: boolean): TavilyResult[] {
  const out: TavilyResult[] = []
  for (const r of Array.isArray(list) ? (list as Record<string, unknown>[]) : []) {
    if (typeof r?.url !== "string" || !/^https?:\/\//i.test(r.url)) continue
    // No date from Perplexity: the one in the address or at the start of the text (never the day it was last read).
    const published = publishedDay(r.date) ?? pageDay(r.url, typeof r.snippet === "string" ? r.snippet : "") ?? (datedOnly ? null : publishedDay(r.last_updated))
    if (datedOnly && !published) continue
    const url = r.url.trim().slice(0, 500)
    out.push({
      title: typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim().slice(0, 200) : "",
      url,
      content: typeof r.snippet === "string" ? r.snippet.replace(/\s+/g, " ").trim() : "",
      published,
      ...(isFacebookUrl(url) ? { kind: "facebook" as const } : {}),
    })
  }
  return out
}

// ---------- Google through SerpApi ----------

const SERPAPI_URL = "https://serpapi.com/search.json"
const SERPAPI_ACCOUNT_URL = "https://serpapi.com/account.json"

/** A SerpApi key: letters and numbers (64 today); checked before it's sent anywhere. */
export const SERPAPI_KEY_PATTERN = /^[A-Za-z0-9]{32,128}$/

/** SerpApi's error answers in plain words (its body always has an `error` text). */
export function serpError(status: number, detail = ""): SearchFailed {
  if (status === 401 || /invalid api key/i.test(detail)) return new SearchFailed("The SerpApi key was rejected. Check it in Settings → AI.", 401, "serpapi")
  if (/run out of searches/i.test(detail)) return new SearchFailed("Your SerpApi searches for this month are used up (the free plan has 250).", 429, "serpapi")
  if (status === 429) return new SearchFailed("SerpApi got too many searches this hour. Wait a while, then try again.", 429, "serpapi")
  if (status >= 500) return new SearchFailed("SerpApi didn't answer. Please try again in a moment.", status, "serpapi")
  return new SearchFailed(detail ? `SerpApi: ${detail}` : `SerpApi answered ${status}.`, status, "serpapi")
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** "2026-11-08" → "11/8/2026" (Google's date range). */
const googleDate = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}/${day.slice(0, 4)}`

/**
 * The Google search for one of the app's searches: news searches use Google News (tbm=nws, which can't
 * take "site:"), searches limited to sites use "site:" on the web results (Facebook posts), and both
 * keep to the days asked (Google's custom date range).
 */
export function serpParams(q: TavilyQuery): Record<string, string> {
  const sites = q.include ?? []
  const news = !sites.length && (q.topic === "news" || !!q.datedOnly)
  const gl = q.region ?? (q.country ? COUNTRY_CODE[q.country.toLowerCase()] : undefined)
  const params: Record<string, string> = {
    engine: "google",
    q: sites.length ? `${sites.map((d) => `site:${d}`).join(" OR ")} ${q.query}` : q.query,
    hl: "en",
    num: String(Math.min(10, Math.max(1, q.maxResults))),
  }
  if (gl) params.gl = gl.toLowerCase()
  if (news) params.tbm = "nws"
  if (q.startDate) {
    // The app's end date is the day after the window; Google's is the last day.
    params.tbs = `cdr:1,cd_min:${googleDate(q.startDate)}${q.endDate ? `,cd_max:${googleDate(addDays(q.endDate, -1))}` : ""}`
  }
  return params
}

const UNIT_MS: Record<string, number> = { minute: 60_000, min: 60_000, hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000, year: 365 * 86_400_000 }

/**
 * Google's dates → "2026-11-08": `published_at` ("2026-11-08 09:22:45 UTC", news) first, else the shown
 * date: "3 hours ago", "2 days ago", "Yesterday" or "Nov 8, 2026". null when there's none.
 */
export function serpDay(date: unknown, publishedAt: unknown, now = new Date()): string | null {
  if (typeof publishedAt === "string" && publishedAt.trim()) {
    const t = Date.parse(publishedAt.trim().replace(" UTC", "Z").replace(" ", "T"))
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  }
  if (typeof date !== "string" || !date.trim()) return null
  const text = date.trim()
  const ago = /^(\d+)\s+(minute|min|hour|day|week|month|year)s?\s+ago$/i.exec(text)
  if (ago) return new Date(now.getTime() - Number(ago[1]) * UNIT_MS[ago[2].toLowerCase()]).toISOString().slice(0, 10)
  if (/^yesterday$/i.test(text)) return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
  if (!/\d{4}/.test(text)) return null
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return null
  const d = new Date(parsed)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

/** Google's results → the app's results (sites the search leaves out are dropped here: Google News can't take "-site:"). */
export function serpResults(body: Record<string, unknown>, q: TavilyQuery, now = new Date()): TavilyResult[] {
  const sites = q.include ?? []
  const skip = sites.length ? (q.exclude ?? []) : [...SKIP_DOMAINS, ...(q.exclude ?? [])]
  const news = Array.isArray(body.news_results) && body.news_results.length
  const list = (news ? body.news_results : body.organic_results) as Record<string, unknown>[] | undefined
  const out: TavilyResult[] = []
  for (const r of Array.isArray(list) ? list : []) {
    if (typeof r?.link !== "string" || !/^https?:\/\//i.test(r.link)) continue
    const host = hostOf(r.link)
    if (skip.some((d) => host === d || host.endsWith(`.${d}`))) continue
    if (sites.length && !sites.some((d) => host === d || host.endsWith(`.${d}`))) continue
    const published = serpDay(r.date, r.published_at, now)
    if (q.datedOnly && !published) continue
    const url = r.link.trim().slice(0, 500)
    const image = typeof r.thumbnail === "string" && /^https:\/\//i.test(r.thumbnail) ? r.thumbnail.slice(0, 1000) : ""
    out.push({
      title: typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim().slice(0, 200) : "",
      url,
      content: [typeof r.source === "string" && news ? `${r.source}.` : "", typeof r.snippet === "string" ? r.snippet : ""].join(" ").replace(/\s+/g, " ").trim(),
      published,
      ...(isFacebookUrl(url) ? { kind: "facebook" as const } : {}),
      ...(image ? { image } : {}),
    })
  }
  return out
}

/** One Google search through SerpApi (1 search of the plan; repeated searches within an hour are free). */
export async function serpSearch(key: string, q: TavilyQuery, signal?: AbortSignal): Promise<{ results: TavilyResult[]; credits: number }> {
  let res: Response
  try {
    res = await fetch(`${SERPAPI_URL}?${new URLSearchParams({ ...serpParams(q), api_key: key.trim() })}`, { signal })
  } catch {
    throw new SearchFailed(signal?.aborted ? "The Google search took too long." : "Couldn't reach SerpApi. Check your connection.", 504, "serpapi")
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  // "Google hasn't returned any results for this query." comes with 200: no results, not a failure.
  if (!res.ok) throw serpError(res.status, typeof body.error === "string" ? body.error.slice(0, 200) : "")
  return { results: serpResults(body, q), credits: 1 }
}

/** Settings → Test: the key's searches left this month (SerpApi's account call is free). */
export async function serpAccount(key: string, signal?: AbortSignal): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${SERPAPI_ACCOUNT_URL}?${new URLSearchParams({ api_key: key.trim() })}`, { signal })
  } catch {
    throw new SearchFailed("Couldn't reach SerpApi. Check your connection.", 504, "serpapi")
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || typeof body.error === "string") throw serpError(res.ok ? 400 : res.status, typeof body.error === "string" ? body.error.slice(0, 200) : "")
  const left = typeof body.total_searches_left === "number" ? body.total_searches_left : typeof body.plan_searches_left === "number" ? body.plan_searches_left : null
  const perMonth = typeof body.searches_per_month === "number" ? body.searches_per_month : null
  const plan = typeof body.plan_name === "string" ? body.plan_name : ""
  if (left === null) return "SerpApi answered."
  return `${left.toLocaleString("en-US")}${perMonth ? ` of ${perMonth.toLocaleString("en-US")}` : ""} searches left this month${plan ? ` · ${plan}` : ""}`
}

// ---------- Gemini with Google Search ----------

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models"
const GOOGLE_REDIRECT = /^https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\//

/** A Gemini model that can search: the one chosen in Settings, else the best "flash" the key has. */
async function geminiModel(key: string, chosen: string | undefined, signal: AbortSignal): Promise<string> {
  if (chosen && /^gemini-/i.test(chosen)) return chosen
  const models = await listModels("gemini", key, signal).catch(() => [])
  return recommendModel("gemini", models) ?? "gemini-2.5-flash"
}

/** Google's redirect links → the pages they point to (a few at a time, quickly; unresolved ones are kept). */
export async function resolveGoogleLinks(urls: string[], fetcher: typeof fetch = fetch): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const todo = [...new Set(urls.filter((u) => GOOGLE_REDIRECT.test(u)))].slice(0, 20)
  await Promise.all(
    todo.map(async (u) => {
      try {
        const res = await fetcher(u, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5_000) })
        const to = res.headers.get("location")
        if (to && /^https?:\/\//i.test(to)) out.set(u, to.slice(0, 500))
      } catch {
        // kept as Google's link (it still opens the page)
      }
    }),
  )
  return out
}

/**
 * Gemini answers the search prompt with Google Search turned on. Returns its answer (Google links
 * in it replaced by the real pages) and the pages it used.
 */
export async function geminiResearch(
  key: string,
  model: string | undefined,
  p: { system: string; user: string; maxTokens: number; temperature?: number },
  signal: AbortSignal,
): Promise<{ text: string; sources: AiSource[]; model: string }> {
  const use = await geminiModel(key, model, signal)
  let res: Response
  try {
    res = await fetch(`${GEMINI_API}/${encodeURIComponent(use)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key.trim(), "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: p.system }] },
        contents: [{ role: "user", parts: [{ text: p.user }] }],
        tools: [{ google_search: {} }],
        // Thinking counts toward the limit on newer models: room for it.
        generationConfig: { temperature: p.temperature ?? 0.3, maxOutputTokens: Math.max(p.maxTokens * 4, 4096) },
      }),
      signal,
    })
  } catch {
    throw new SearchFailed(signal.aborted ? "The Gemini search took too long." : "Couldn't reach Gemini. Check your connection.", 504, "gemini")
  }
  const body = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[]
    error?: { message?: string; status?: string }
  }
  const message = body.error?.message ?? ""
  if (res.status === 400 && /api key/i.test(message)) throw new SearchFailed("The Gemini API key was rejected. Check it in Settings → AI.", 401, "gemini")
  if (res.status === 401 || res.status === 403) throw new SearchFailed(`Gemini refused the search${message ? ` (${message})` : ""}.`, res.status, "gemini")
  if (res.status === 429) throw new SearchFailed("Gemini's limit for searches was reached. Try again later, or choose another web search in Settings → AI.", 429, "gemini")
  if (!res.ok) throw new SearchFailed(`Gemini answered ${res.status}${message ? `: ${message}` : ""}.`, res.status, "gemini")
  const candidate = body.candidates?.[0]
  let text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("")
  const chunks = (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((c) => (c.web?.uri ? [{ uri: c.web.uri, title: c.web.title ?? "" }] : []))
  const links = await resolveGoogleLinks([...chunks.map((c) => c.uri), ...(text.match(/https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[^\s|)\]]+/g) ?? [])])
  for (const [from, to] of links) text = text.split(from).join(to)
  const seen = new Set<string>()
  const sources: AiSource[] = []
  for (const c of chunks) {
    const url = links.get(c.uri) ?? c.uri
    if (seen.has(url)) continue
    seen.add(url)
    let host = c.title
    try {
      host = new URL(url).hostname.replace(/^www\./, "")
    } catch {
      // keep Google's title
    }
    sources.push({ title: (c.title && !/^[\w.-]+\.[a-z]{2,}$/i.test(c.title) ? c.title : host).slice(0, 200), url })
  }
  return { text, sources: sources.slice(0, 40), model: use }
}
