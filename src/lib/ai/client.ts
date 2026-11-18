"use client"

import { getDesktop } from "@/lib/desktop"
import { cookieMode } from "@/lib/local/shared"
import { lineCount, DESCRIPTION_LINES } from "@/lib/design/content-rules"
import { coverTitle } from "@/lib/design/cover-title"
import { carouselBrandOfSlides } from "@/lib/design/templates"
import { findPhrase } from "@/lib/design/konva-attrs"
import type { MeasureText } from "@/lib/design/layout"
import type { ElementRole, SlideDesign, SlideType, TextElement } from "@/lib/design/types"
import { parseCarouselDraft, type CarouselDraft } from "./carousel-draft"
import { parseResearch, parseTopicIdeas, type ResearchResult, type TopicIdea } from "./carousel-research"
import { parseNewsArticle, parseTrendStories, type NewsArticleDraft, type TrendStory } from "./trend-news"
import { parsePickleballPost, type PickleballPost } from "./pickleball-posts"
import { parseBrandPost, type BrandPostAiRequest, type BrandPostAiResult } from "./brand-post-ai"
import { cleanTrendDetails, keepRealQuotes, parsePosterCaption, parsePosterCopy } from "./headlines"
import {
  type SearchEngineId,
  SEARCH_ENGINE_ORDER,
  AI_HEADERS,
  aiProvider,
  SEARCH_AI_TASKS,
  type AiErrorBody,
  type AiModelsResponse,
  type AiProviderConfig,
  type AiProviderId,
  type AiRequest,
  type AiResponse,
  type AiSearchInfo,
  type AiSource,
  type CarouselBrandId,
  type TrendBrand,
  type TrendLook,
  type CarouselText,
  type PosterCaption,
  type PosterCopy,
  type PostsMode,
  type SearchCheckResult,
  type TavilyStatus,
} from "./types"

interface SlideLike {
  type: SlideType
  design: SlideDesign
}

function textOf(design: SlideDesign, ...roles: ElementRole[]) {
  for (const role of roles) {
    const el = design.elements.find((e): e is TextElement => e.type === "text" && e.role === role && e.visible && !!e.text.trim())
    if (el) return el.text.replace(/\s+/g, " ").trim()
  }
  return ""
}

/** Just the words of the carousel (cover first), for the AI. */
export function carouselText(slides: SlideLike[], caption = ""): CarouselText {
  const [cover, ...cards] = slides
  return {
    title: cover ? coverTitle(cover.design) : "",
    subtitle: cover ? textOf(cover.design, "description", "subtitle") : "",
    cards: cards.map((s) => ({ title: textOf(s.design, "title", "stat"), subtitle: textOf(s.design, "subtitle", "label"), description: textOf(s.design, "description") })),
    caption,
    brand: carouselBrandOfSlides(slides.map((s) => s.design)),
  }
}

/** An AI request failed; `own` = it was the user's own key or model, not the built-in Groq. */
export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly own = false,
  ) {
    super(message)
  }
}

async function requestWithModel(req: AiRequest, own?: AiProviderConfig | null): Promise<{ text: string; model?: string; sources?: AiSource[]; search?: AiSearchInfo }> {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (own) {
    headers[AI_HEADERS.provider] = own.provider
    headers[AI_HEADERS.key] = own.key
    if (own.model?.trim()) headers[AI_HEADERS.model] = own.model.trim()
  }
  // Web searches: the engine chosen in Settings → AI and the saved keys that can search.
  if (SEARCH_AI_TASKS.includes(req.task)) Object.assign(headers, searchHeaders())
  const res = await fetch("/api/ai", { method: "POST", headers, body: JSON.stringify(req) })
  const body = (await res.json().catch(() => ({}))) as Partial<AiResponse> & Partial<AiErrorBody>
  if (!res.ok || !body.text) throw new AiRequestError(body.error || `The AI request failed (${res.status}).`, !!own && body.own === true)
  return { text: body.text, model: body.model, sources: body.sources, search: body.search }
}

async function request(req: AiRequest, own?: AiProviderConfig | null): Promise<string> {
  return (await requestWithModel(req, own)).text
}

/** Any AI request: with the person's own AI when it's set up (else the built-in Groq, when there is one). */
export async function aiWrite(req: AiRequest): Promise<string> {
  return (await posterAiWrite(req)).text
}

// ---------- Poster Maker AI: the user's own key, or the built-in Groq ----------

/** Where the user's own AI key is kept (this computer only, never in the database). */
const POSTER_AI_KEY = "dcm-poster-ai"

export function getPosterAiConfig(): AiProviderConfig | null {
  try {
    const raw = JSON.parse(localStorage.getItem(POSTER_AI_KEY) ?? "null") as Partial<AiProviderConfig> | null
    if (!raw || !aiProvider(raw.provider) || typeof raw.key !== "string" || !raw.key.trim()) return null
    return { provider: raw.provider!, key: raw.key.trim(), ...(typeof raw.model === "string" && raw.model.trim() ? { model: raw.model.trim() } : {}) }
  } catch {
    return null
  }
}

/**
 * Saves the AI that writes (with null: none). Its key is also kept in the saved keys, so it stays
 * listed when another AI writes.
 */
export function setPosterAiConfig(config: AiProviderConfig | null) {
  try {
    if (config) {
      localStorage.setItem(POSTER_AI_KEY, JSON.stringify(config))
      localStorage.setItem(AI_KEYS, JSON.stringify({ ...readAiKeys(), [config.provider]: { key: config.key, ...(config.model ? { model: config.model } : {}) } }))
    } else localStorage.removeItem(POSTER_AI_KEY)
  } catch {
    throw new Error("Couldn't save the key on this computer.")
  }
  window.dispatchEvent(new Event("dcm-poster-ai"))
  window.dispatchEvent(new Event("dcm-ai-keys"))
  mirrorKeysToDesktop()
}

// ---------- Saved API keys (one per service) and the web search choice ----------

/** Every saved AI key, one per service (this computer only): any of them can write, some can search. */
const AI_KEYS = "dcm-ai-keys"
/** Settings → AI → Web search: "auto" or one engine. */
const SEARCH_ENGINE_KEY = "dcm-search-engine"

export type SavedAiKeys = Partial<Record<AiProviderId, { key: string; model?: string }>>

function readAiKeys(): SavedAiKeys {
  const out: SavedAiKeys = {}
  try {
    const raw = JSON.parse(localStorage.getItem(AI_KEYS) ?? "null") as Record<string, { key?: unknown; model?: unknown }> | null
    for (const [id, v] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
      if (!aiProvider(id) || typeof v?.key !== "string" || !v.key.trim()) continue
      out[id as AiProviderId] = { key: v.key.trim(), ...(typeof v.model === "string" && v.model.trim() ? { model: v.model.trim() } : {}) }
    }
  } catch {
    // none saved
  }
  return out
}

/** The saved keys (the writing AI's key included, also when it was saved before 1.35). */
export function getAiKeys(): SavedAiKeys {
  const keys = readAiKeys()
  const writing = getPosterAiConfig()
  if (writing && !keys[writing.provider]) keys[writing.provider] = { key: writing.key, ...(writing.model ? { model: writing.model } : {}) }
  return keys
}

/**
 * Saves (or with null removes) one service's key. A changed key of the writing AI is used for writing
 * right away; a removed one stops the writing too (pick another AI).
 */
export function setAiKey(provider: AiProviderId, value: { key: string; model?: string } | null) {
  const writing = getPosterAiConfig()
  const keys = readAiKeys()
  try {
    if (writing?.provider === provider) {
      if (value) localStorage.setItem(POSTER_AI_KEY, JSON.stringify({ provider, key: value.key.trim(), ...(value.model ? { model: value.model } : {}) }))
      else localStorage.removeItem(POSTER_AI_KEY)
    }
    if (value) keys[provider] = { key: value.key.trim(), ...(value.model ? { model: value.model } : {}) }
    else delete keys[provider]
    localStorage.setItem(AI_KEYS, JSON.stringify(keys))
  } catch {
    throw new Error("Couldn't save the key on this computer.")
  }
  window.dispatchEvent(new Event("dcm-ai-keys"))
  window.dispatchEvent(new Event("dcm-poster-ai"))
  mirrorKeysToDesktop()
}

/** Makes one of the saved keys the AI that writes. */
export function writeWith(provider: AiProviderId) {
  const saved = getAiKeys()[provider]
  if (!saved) throw new Error(`Save a ${aiProvider(provider)?.name ?? provider} key first.`)
  setPosterAiConfig({ provider, key: saved.key, ...(saved.model ? { model: saved.model } : {}) })
}

export function getSearchEngine(): SearchEngineId | "auto" {
  try {
    const v = localStorage.getItem(SEARCH_ENGINE_KEY) ?? ""
    return (SEARCH_ENGINE_ORDER as readonly string[]).includes(v) ? (v as SearchEngineId) : "auto"
  } catch {
    return "auto"
  }
}

export function setSearchEngine(engine: SearchEngineId | "auto") {
  try {
    if (engine === "auto") localStorage.removeItem(SEARCH_ENGINE_KEY)
    else localStorage.setItem(SEARCH_ENGINE_KEY, engine)
  } catch {
    throw new Error("Couldn't save the choice on this computer.")
  }
  window.dispatchEvent(new Event("dcm-search-engine"))
  mirrorKeysToDesktop()
}

/** The headers of a web search: the chosen engine and every saved key that can search. */
function searchHeaders(): Record<string, string> {
  const keys = getAiKeys()
  const headers: Record<string, string> = { [AI_HEADERS.searchEngine]: getSearchEngine() }
  const tavily = getTavilyKey()
  const search = getSearchKeys()
  if (tavily) headers[AI_HEADERS.tavily] = tavily
  if (search.serpapi) headers[AI_HEADERS.serpapi] = search.serpapi
  if (search.meta) headers[AI_HEADERS.meta] = search.meta
  if (keys.perplexity) headers[AI_HEADERS.perplexity] = keys.perplexity.key
  if (keys.groq) headers[AI_HEADERS.groq] = keys.groq.key
  if (keys.gemini) headers[AI_HEADERS.gemini] = keys.gemini.key
  return headers
}

// ---------- Keys that search but don't write: SerpApi (Google) and a Meta token (Facebook Pages) ----------

const SEARCH_KEYS = "dcm-search-keys"
export type SearchKeyId = "serpapi" | "meta"
export type SavedSearchKeys = Partial<Record<SearchKeyId, string>>

/** "64 letters and numbers" (SerpApi) and "EA…" (Meta): checked before saving. */
export const SEARCH_KEY_PATTERNS: Record<SearchKeyId, RegExp> = { serpapi: /^[A-Za-z0-9]{32,128}$/, meta: /^EA[A-Za-z0-9]{20,1000}$/ }

export function getSearchKeys(): SavedSearchKeys {
  const out: SavedSearchKeys = {}
  try {
    const raw = JSON.parse(localStorage.getItem(SEARCH_KEYS) ?? "null") as Record<string, unknown> | null
    for (const id of ["serpapi", "meta"] as const) {
      const v = raw?.[id]
      if (typeof v === "string" && SEARCH_KEY_PATTERNS[id].test(v.trim())) out[id] = v.trim()
    }
  } catch {
    // none saved
  }
  return out
}

/** Saves (or with null removes) the SerpApi key or the Meta access token (this computer only). */
export function setSearchKey(id: SearchKeyId, value: string | null) {
  if (value !== null && !SEARCH_KEY_PATTERNS[id].test(value.trim())) {
    throw new Error(id === "serpapi" ? "That doesn't look like a SerpApi key (64 letters and numbers)." : "That doesn't look like a Meta access token (it starts with EA…).")
  }
  const keys = getSearchKeys()
  if (value) keys[id] = value.trim()
  else delete keys[id]
  try {
    localStorage.setItem(SEARCH_KEYS, JSON.stringify(keys))
  } catch {
    throw new Error("Couldn't save the key on this computer.")
  }
  window.dispatchEvent(new Event("dcm-search-keys"))
  mirrorKeysToDesktop()
}

/** Settings → Check & save / Test: a SerpApi key's searches left, or who a Meta token is and its Pages. */
export async function checkSearchKey(id: SearchKeyId, key: string): Promise<string> {
  const res = await fetch("/api/ai/search-check", {
    method: "POST",
    headers: { "content-type": "application/json", [id === "serpapi" ? AI_HEADERS.serpapi : AI_HEADERS.meta]: key.trim() },
    body: JSON.stringify({ service: id }),
  })
  const body = (await res.json().catch(() => ({}))) as Partial<SearchCheckResult> & { error?: string }
  if (!res.ok || !body.text) throw new Error(body.error || `Couldn't check the key (${res.status}).`)
  return body.text
}

// ---------- What the web searches used this month (this computer) ----------

const USAGE_KEY = "dcm-search-usage"
export type SearchUsage = { month: string; counts: Partial<Record<SearchEngineId, number>> }

const thisMonth = () => new Date().toISOString().slice(0, 7)

export function getSearchUsage(): SearchUsage {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) ?? "null") as SearchUsage | null
    if (raw && raw.month === thisMonth() && raw.counts && typeof raw.counts === "object") return raw
  } catch {
    // a new month
  }
  return { month: thisMonth(), counts: {} }
}

/** Counts a search's credits (Tavily) or billed searches (SerpApi, Perplexity), Facebook posts included. */
export function recordSearchUsage(search: AiSearchInfo | undefined) {
  if (!search) return
  const usage = getSearchUsage()
  const add = (engine: SearchEngineId, n: number | undefined) => {
    if (typeof n === "number" && n > 0) usage.counts[engine] = (usage.counts[engine] ?? 0) + n
  }
  add(search.engine, search.credits ?? (search.engine === "groq" || search.engine === "gemini" ? 1 : 0))
  if (search.posts && search.posts.engine !== search.engine) add(search.posts.engine, search.posts.credits)
  else if (search.posts) add(search.engine, search.posts.credits)
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage))
  } catch {
    return
  }
  window.dispatchEvent(new Event("dcm-search-usage"))
}

/**
 * Which engine will search: the chosen one when it has a key, else the first with one (Tavily,
 * Perplexity, Groq, Gemini). `builtIn`: the app's own Tavily / Groq keys, when it has them.
 */
export function searchEngineInUse(builtIn: { tavily: boolean; groq: boolean }): SearchEngineId | null {
  const keys = getAiKeys()
  const has: Record<SearchEngineId, boolean> = {
    tavily: !!getTavilyKey() || builtIn.tavily,
    serpapi: !!getSearchKeys().serpapi,
    perplexity: !!keys.perplexity,
    groq: !!keys.groq || builtIn.groq,
    gemini: !!keys.gemini,
  }
  const choice = getSearchEngine()
  if (choice !== "auto" && has[choice]) return choice
  return SEARCH_ENGINE_ORDER.find((e) => has[e]) ?? null
}

/**
 * The desktop app keeps a copy of the keys and choices (encrypted by Windows): the page's own storage
 * belongs to the local server's port, so they would be lost when the app has to start on another port.
 */
function mirrorKeysToDesktop() {
  const bridge = getDesktop()?.aiConfig
  if (bridge) void bridge.set({ ai: getPosterAiConfig(), tavily: getTavilyKey(), keys: readAiKeys(), engine: getSearchEngine(), search: getSearchKeys() }).catch(() => {})
}

/** Desktop app: brings the keys back from the app's copy when the page's storage lost them (or sends them there). */
export async function syncKeysWithDesktop(): Promise<void> {
  const bridge = getDesktop()?.aiConfig
  if (!bridge) return
  const stored = await bridge.get().catch(() => null)
  const ai = getPosterAiConfig()
  const tavily = getTavilyKey()
  const keys = readAiKeys()
  const hasKeys = Object.keys(keys).length > 0
  const storedKeys = stored?.keys && typeof stored.keys === "object" ? stored.keys : {}
  let restored = false
  try {
    if (!ai && stored?.ai && aiProvider(stored.ai.provider) && stored.ai.key) {
      localStorage.setItem(POSTER_AI_KEY, JSON.stringify(stored.ai))
      restored = true
    }
    if (!tavily && stored?.tavily && looksLikeTavilyKey(stored.tavily)) {
      localStorage.setItem(TAVILY_KEY, stored.tavily)
      restored = true
    }
    if (!hasKeys && Object.keys(storedKeys).length) {
      localStorage.setItem(AI_KEYS, JSON.stringify(storedKeys))
      restored = true
    }
    if (getSearchEngine() === "auto" && stored?.engine && stored.engine !== "auto" && (SEARCH_ENGINE_ORDER as readonly string[]).includes(stored.engine)) {
      localStorage.setItem(SEARCH_ENGINE_KEY, stored.engine)
      restored = true
    }
    if (!Object.keys(getSearchKeys()).length && stored?.search && typeof stored.search === "object") {
      const back: SavedSearchKeys = {}
      for (const id of ["serpapi", "meta"] as const) {
        const v = stored.search[id]
        if (typeof v === "string" && SEARCH_KEY_PATTERNS[id].test(v)) back[id] = v
      }
      if (Object.keys(back).length) {
        localStorage.setItem(SEARCH_KEYS, JSON.stringify(back))
        restored = true
      }
    }
  } catch {
    return
  }
  if (restored) {
    for (const name of ["dcm-poster-ai", "dcm-tavily-key", "dcm-ai-keys", "dcm-search-engine", "dcm-search-keys"]) window.dispatchEvent(new Event(name))
  }
  // Keys saved before the app kept a copy (1.34 and older): keep one now.
  const searchKeys = Object.keys(getSearchKeys()).length > 0
  if ((ai && !stored?.ai) || (tavily && !stored?.tavily) || (hasKeys && !Object.keys(storedKeys).length) || (searchKeys && !stored?.search)) mirrorKeysToDesktop()
}

// ---------- Web search: the user's own Tavily key (or the app's) ----------

/** Where the user's own Tavily key is kept (this computer only). */
const TAVILY_KEY = "dcm-tavily-key"
const TAVILY_PATTERN = /^tvly-[A-Za-z0-9_-]{10,200}$/

/** "tvly-…": a Tavily (web search) key, not an AI key. */
export const looksLikeTavilyKey = (key: string) => TAVILY_PATTERN.test(key.trim())

export function getTavilyKey(): string | null {
  try {
    const key = localStorage.getItem(TAVILY_KEY)?.trim() ?? ""
    return looksLikeTavilyKey(key) ? key : null
  } catch {
    return null
  }
}

/** Saves (or with null removes) the user's own Tavily key. */
export function setTavilyKey(key: string | null) {
  if (key !== null && !looksLikeTavilyKey(key)) throw new Error("That doesn't look like a Tavily key (it starts with tvly-).")
  try {
    if (key) localStorage.setItem(TAVILY_KEY, key.trim())
    else localStorage.removeItem(TAVILY_KEY)
  } catch {
    throw new Error("Couldn't save the key on this computer.")
  }
  window.dispatchEvent(new Event("dcm-tavily-key"))
  mirrorKeysToDesktop()
}

/**
 * Which Tavily key the web searches use (`key` to try one before saving it; else the saved one,
 * else the app's); with `check`, also its credits this month (costs no credit).
 */
export async function tavilyStatus(options: { key?: string; check?: boolean } = {}): Promise<TavilyStatus> {
  const key = options.key?.trim() || getTavilyKey()
  const res = await fetch("/api/ai/tavily", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { [AI_HEADERS.tavily]: key } : {}) },
    body: JSON.stringify({ check: !!options.check }),
  })
  const body = (await res.json().catch(() => ({}))) as Partial<TavilyStatus> & { error?: string }
  if (!res.ok || !body.source) throw new Error(body.error || `Couldn't check the Tavily key (${res.status}).`)
  return { source: body.source, used: body.used, limit: body.limit, plan: body.plan }
}

/** "Groq (built-in)", "Not set up" (desktop app) or "OpenAI (ChatGPT) · gpt-5-mini". */
export function posterAiLabel(config = getPosterAiConfig()): string {
  if (!config) return cookieMode() ? "no AI yet (Settings → AI)" : "Groq (built-in)"
  const info = aiProvider(config.provider)!
  return `${info.name} · ${config.model || info.defaultModel}`
}

export interface PosterAiResult {
  text: string
  /** carousel-research / trend-search: the pages the web search found. */
  sources?: AiSource[]
  /** carousel-research / trend-search: Tavily or Groq's browser (and why Tavily wasn't used). */
  search?: AiSearchInfo
  /** Set when the user's own key failed and the built-in Groq answered instead: what went wrong. */
  fellBack?: string
}

/**
 * A Poster Maker request: with the user's own key when one is saved, otherwise the
 * built-in Groq. When the own key or model fails, Groq answers instead (and says why).
 */
export async function posterAiWrite(req: AiRequest): Promise<PosterAiResult> {
  const own = getPosterAiConfig()
  if (!own) {
    const { text, sources, search } = await requestWithModel(req)
    return { text, sources, search }
  }
  try {
    const { text, model, sources, search } = await requestWithModel(req, own)
    // No model chosen and the default wasn't available: remember the one that worked.
    if (!own.model && model && model !== aiProvider(own.provider)?.defaultModel) {
      try {
        setPosterAiConfig({ ...own, model })
      } catch {
        // used for this request only
      }
    }
    return { text, sources, search }
  } catch (e) {
    if (!(e instanceof AiRequestError) || !e.own) throw e
    // The desktop app has no built-in AI to fall back on: the person's own AI's error is the answer.
    if (cookieMode()) throw e
    try {
      const { text, sources, search } = await requestWithModel(req)
      return { text, sources, search, fellBack: e.message }
    } catch {
      throw e
    }
  }
}

/** An article read from a link (Poster Maker → Write from article). */
export interface LinkedArticle {
  title: string
  site: string
  published: string
  text: string
  url: string
}

/** Downloads a web page on the server and returns the article in it. */
export async function readArticleLink(url: string): Promise<LinkedArticle> {
  const res = await fetch("/api/article", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: url.trim() }) })
  const body = (await res.json().catch(() => ({}))) as Partial<LinkedArticle> & { error?: string }
  if (!res.ok || !body.text) throw new Error(body.error || `Couldn't read that page (${res.status}).`)
  return { title: body.title ?? "", site: body.site ?? "", published: body.published ?? "", text: body.text, url: body.url ?? url }
}

/**
 * Settings → Check key: the service the key belongs to (found from the key when the
 * provider is "auto") and the models it can use, with the one we'd pick.
 */
export async function detectAiKey(key: string, provider: AiProviderId | "auto"): Promise<AiModelsResponse> {
  const res = await fetch("/api/ai/models", {
    method: "POST",
    headers: { "content-type": "application/json", [AI_HEADERS.key]: key.trim() },
    body: JSON.stringify({ provider }),
  })
  const body = (await res.json().catch(() => ({}))) as Partial<AiModelsResponse> & { error?: string }
  if (!res.ok || !body.provider) throw new Error(body.error || `Couldn't check the key (${res.status}).`)
  return { provider: body.provider, models: body.models ?? [], recommended: body.recommended ?? null }
}

/** One small request with the given key (no fallback), to check it in Settings. */
export async function testPosterAi(config: AiProviderConfig): Promise<string> {
  return request({ task: "headline-highlight", headline: "More than 600 cyclists take on Pampanga's dirt roads at Gravelton Clark 2026" }, config)
}

/**
 * Poster content from a pasted article: three headlines (the recommended one first), each
 * with its hook words to highlight, the poster category and subtext choices (key details,
 * the key point, a summary or a real quote; or none recommended). Written by the user's own
 * AI key or the built-in Groq.
 */
export async function suggestPosterCopy(article: string, brand: string): Promise<PosterCopy & { fellBack?: string }> {
  const { text, fellBack } = await posterAiWrite({ task: "article-headline", article, brand, count: 4 })
  const copy = keepRealQuotes(parsePosterCopy(text, brand), article)
  if (!copy.options.length) throw new Error("The AI didn't return a headline. Please try again.")
  return { ...copy, fellBack }
}

/**
 * A new Facebook caption for a poster from its article (hook, key facts, a warm closing
 * line, hashtags; no emojis). Written by the user's own AI key or the built-in Groq.
 */
export async function suggestPosterCaption(article: string, brand: string, headline: string): Promise<PosterCaption & { fellBack?: string }> {
  const { text, fellBack } = await posterAiWrite({ task: "poster-caption", article, brand, headline })
  const caption = parsePosterCaption(text, brand)
  if (!caption) throw new Error("The AI didn't return a caption. Please try again.")
  return { ...caption, fellBack }
}

/**
 * A poster's "Details" for the daily report (Daily Trend News): what the news is about and why
 * it's a timely trend, in 1–2 sentences. From the article when it's at hand ("" otherwise: then
 * from the headline, subtext and caption, which were written from it).
 */
export async function suggestTrendDetails(input: { article: string; brand: string; headline: string; subtext: string; caption: string }): Promise<{ details: string; fellBack?: string }> {
  const { text, fellBack } = await posterAiWrite({ task: "trend-details", ...input })
  const details = cleanTrendDetails(text)
  if (details.length < 20) throw new Error("The AI didn't return the details. Please try again.")
  return { details, fellBack }
}

/**
 * Advertisement → PicklePlay: a Pickleball History, Trivia or Fun Fact for the posters (with the
 * user's own AI key when one is saved). `number` is the poster's number (#01); `avoid`: facts
 * already made, so the AI picks a new one.
 */
export async function writePickleballPost(input: {
  kind: "history" | "trivia" | "funfact" | "courtowner" | "comingsoon" | "nowopen"
  topic: string
  avoid: string[]
  number: string
  /** Coming Soon / Now Open: an article or announcement about the court. */
  article?: string
  /** Coming Soon / Now Open: the court's details as typed (they stay as typed). */
  court?: { name: string; barangay: string; city: string; hours: string }
}): Promise<PickleballPost & { sources: AiSource[]; fellBack?: string }> {
  const court = input.kind === "comingsoon" || input.kind === "nowopen" ? input.court : undefined
  const { text, sources = [], fellBack } = await posterAiWrite({
    task: "pickleball-post",
    kind: input.kind,
    topic: input.topic,
    avoid: input.avoid,
    ...(court ? { court, ...(input.article?.trim() ? { article: input.article.trim() } : {}) } : {}),
  })
  const post = parsePickleballPost(input.kind, text, input.number)
  // The court's name, barangay, city and hours: as typed (the AI's only fill the empty ones).
  if (court && (post.content.kind === "comingsoon" || post.content.kind === "nowopen")) {
    const keep = (typed: string, ai: string) => typed.trim() || ai
    post.content = {
      ...post.content,
      courtName: keep(court.name, post.content.courtName),
      barangay: keep(court.barangay, post.content.barangay),
      city: keep(court.city, post.content.city),
      ...(post.content.kind === "nowopen" ? { hours: keep(court.hours, post.content.hours), spotlight: post.content.spotlight || court.city } : {}),
    } as typeof post.content
  }
  return { ...post, sources, fellBack }
}

/**
 * Poster Maker → Did You Know / Engagement Posts (1.52): the post's texts for its template (only its fields) and a
 * Facebook caption, about `topic` (or one the AI picks), different from the `avoid` posts.
 */
export async function writeBrandPostText(input: BrandPostAiRequest): Promise<BrandPostAiResult & { fellBack?: string }> {
  const { text, fellBack } = await posterAiWrite({ task: "brand-post", ...input })
  const post = parseBrandPost(text, input.fields)
  if (!post.title && !post.question && !post.subtitle && !post.facts?.length) throw new Error("The AI didn't return the post. Please try again.")
  return { ...post, fellBack }
}

/**
 * Create New Carousel → search a topic: Groq searches the web and lists up to `cards` places with
 * facts and the source of each (checked against the pages it really opened). `avoid`: places
 * already featured in earlier carousels.
 */
export async function researchCarouselTopic(topic: string, cards: number, avoid: string[], brand: CarouselBrandId = "homes"): Promise<ResearchResult & { search?: AiSearchInfo }> {
  const { text, sources, search } = await posterAiWrite({ task: "carousel-research", topic, cards, avoid, brand })
  recordSearchUsage(search)
  const result = parseResearch(text, sources ?? [])
  if (!result.items.length) throw new Error("The search didn't find places for this topic. Try a broader or clearer topic.")
  return { ...result, search }
}

/**
 * Poster Maker → Trending news: the newest positive stories about the brand's keywords, published on
 * `day` (yyyy-MM-dd) or the `days - 1` days before it, with their sources. `avoid`: headlines already posted.
 */
export async function searchTrendingNews(input: {
  brand: TrendBrand
  keywords: string[]
  /** Partner developers: one is searched each time, and their positive news comes first. */
  developers?: string[]
  day: string
  days: number
  avoid: string[]
  /** Public Facebook posts: when no news with a link is found (default), always, or never. */
  posts?: PostsMode
  /** Facebook Pages read with the saved Meta token. */
  pages?: string[]
  /** A Homes.ph page's place ("Cebu"): the news must be there. */
  place?: string
  /** "Look for": the kinds of news besides the keywords (openings, festivals, tourism, city projects, helpful info). */
  look?: TrendLook[]
}): Promise<{ stories: TrendStory[]; sources: AiSource[]; search?: AiSearchInfo }> {
  const { text, sources = [], search } = await posterAiWrite({ task: "trend-search", ...input })
  recordSearchUsage(search)
  const stories = parseTrendStories(text, sources)
  if (!stories.length) {
    const posts = search?.posts
    const why = posts?.error ? ` The Facebook post search failed: ${posts.error}` : posts ? " Public Facebook posts were searched too." : ""
    const what = input.look?.length ? "No new stories were found for these keywords and kinds." : "No new positive stories were found for these keywords."
    throw new Error(`${what}${why} Try more days, or other keywords (each search picks a few of them).`)
  }
  return { stories, sources, search }
}

/** Trending news → Write article: the headline, short and detailed article, caption, carousel cards and image prompt from one story. */
export async function writeNewsArticle(input: { article: string; brand: string; source: string }): Promise<NewsArticleDraft & { fellBack?: string }> {
  const { text, fellBack } = await posterAiWrite({ task: "news-article", ...input })
  const draft = parseNewsArticle(text)
  if (!draft) throw new Error("The AI didn't return the article. Please try again.")
  return { ...draft, fellBack }
}

/** Create New Carousel → topic ideas for this month, different from the topics already done. */
export async function suggestCarouselTopics(month: string, avoid: string[], count = 6, brand: CarouselBrandId = "homes"): Promise<TopicIdea[]> {
  const { text } = await posterAiWrite({ task: "carousel-topics", month, count, avoid, brand })
  const ideas = parseTopicIdeas(text)
  if (!ideas.length) throw new Error("The AI didn't suggest topics. Please try again.")
  return ideas
}

/**
 * Create New Carousel → from an article: the cover (Headline 1, Headline 2, subtitle), the caption
 * and up to `cards` content cards, only from the article. Your own AI key or the built-in Groq.
 */
export async function suggestCarouselDraft(article: string, cards: number, brand: CarouselBrandId = "homes"): Promise<CarouselDraft & { fellBack?: string }> {
  const { text, fellBack } = await posterAiWrite({ task: "carousel-from-article", article, cards, brand })
  const draft = parseCarouselDraft(text, cards)
  if (!draft) throw new Error("The AI didn't return a carousel. Please try again.")
  return { ...draft, fellBack }
}

/**
 * A card description that fits 2–3 lines of the card. The length target comes
 * from the text box (width and font size); one stricter retry if it's still too long.
 */
export async function suggestCardDescription(slides: SlideLike[], slideIndex: number, el: TextElement, measure: MeasureText): Promise<string> {
  const perLine = Math.max(20, el.width / (el.fontSize * 0.5))
  const base = { task: "card-description" as const, carousel: carouselText(slides), cardIndex: slideIndex - 1 }
  let maxChars = Math.round(perLine * 2.6)
  const minChars = Math.round(perLine * 1.3)
  let text = await aiWrite({ ...base, minChars, maxChars })
  if (lineCount({ ...el, text }, measure) > DESCRIPTION_LINES.max) {
    maxChars = Math.round(maxChars * 0.8)
    text = await aiWrite({ ...base, minChars: Math.min(minChars, maxChars - 20), maxChars })
  }
  return text
}

/** A short one-line cover subtitle from the title, the current subtitle and every card. */
export async function suggestCoverSubtitle(slides: SlideLike[]): Promise<string> {
  const carousel = carouselText(slides)
  let text = await aiWrite({ task: "cover-subtitle", carousel, maxChars: 60 })
  if (text.length > 70) text = await aiWrite({ task: "cover-subtitle", carousel, maxChars: 48 })
  return text
}

/**
 * The words of a poster headline worth highlighting, exactly as they're written in
 * the headline (the AI's answer must be found in it).
 */
export async function suggestHighlight(headline: string): Promise<string> {
  const { text } = await posterAiWrite({ task: "headline-highlight", headline })
  const at = findPhrase(headline, text)
  if (!at) throw new Error("The AI picked words that aren't in the headline. Please try again.")
  return Array.from(headline).slice(at.start, at.end).join("")
}

/** A short, hook-first post caption from every slide's text. */
export function suggestCaption(slides: SlideLike[], caption: string): Promise<string> {
  return aiWrite({ task: "caption", carousel: carouselText(slides, caption) })
}
