import type { SearchSetup } from "./groq"
import { BRAND_LOOKS } from "./trend-looks"
import { AI_HEADERS, aiProvider, POSTS_MODES, SEARCH_ENGINE_ORDER, type AiProviderConfig, type AiRequest, type CarouselText, type PostsMode, type SearchEngineId } from "./types"

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback

function carouselFrom(v: unknown): CarouselText | null {
  if (!v || typeof v !== "object") return null
  const c = v as Record<string, unknown>
  const cards = (Array.isArray(c.cards) ? c.cards : []).slice(0, 30).map((card) => {
    const k = (card ?? {}) as Record<string, unknown>
    return { title: str(k.title, 300), subtitle: str(k.subtitle, 300), description: str(k.description, 1500) }
  })
  return { title: str(c.title, 300), subtitle: str(c.subtitle, 300), cards, caption: str(c.caption, 3000), brand: carouselBrand(c.brand) }
}

/** How many content cards a carousel made from an article can have. */
export const CAROUSEL_CARDS = { min: 2, max: 10, default: 6 } as const

/** Longest article accepted (characters); the prompt uses the first part of longer ones. */
export const ARTICLE_MAX = 30_000

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim()

/** The carousel's brand (Homes.ph unless Homes.ph Gensan, FHI Global Property or PicklePlay is named). */
const carouselBrand = (v: unknown): "homes" | "gensan" | "fhi" | "pickleplay" => (v === "fhi" || v === "pickleplay" || v === "gensan" ? v : "homes")

/** A short list of short strings (no blanks, no repeats). */
function list(v: unknown, max: number, maxChars: number): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    const t = oneLine(str(item, maxChars))
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= max) break
  }
  return out
}

/** A pasted article: paragraphs kept apart, but no runs of blank lines or spaces. */
function articleText(v: unknown): string {
  return str(v, ARTICLE_MAX)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
}

/**
 * The user's own AI key from the request headers (Poster Maker tasks only).
 * null = none sent (use the built-in Groq); a string = what's wrong with it.
 */
export function parseAiProvider(headers: Headers): AiProviderConfig | null | string {
  const id = headers.get(AI_HEADERS.provider)?.trim()
  const key = headers.get(AI_HEADERS.key)?.trim()
  if (!id && !key) return null
  const provider = aiProvider(id)
  if (!provider) return "Unknown AI provider. Choose one in Settings → AI."
  if (!key || key.length < 10 || key.length > 400 || /\s/.test(key)) return `The ${provider.name} API key doesn't look right. Check it in Settings → AI.`
  const model = headers.get(AI_HEADERS.model)?.trim() ?? ""
  if (model && !/^[\w.:/-]{1,100}$/.test(model)) return "The model name has characters that aren't allowed."
  return { provider: provider.id, key, ...(model ? { model } : {}) }
}

/**
 * Web searches: the engine the person chose and the saved keys that can search (each checked for its
 * service's format, so a key is never sent to the wrong service). Unknown or malformed values are ignored.
 */
export function parseSearchSetup(headers: Headers): SearchSetup {
  const pick = (name: string, pattern: RegExp, max = 400) => {
    const v = headers.get(name)?.trim() ?? ""
    return v && v.length <= max && pattern.test(v) ? v : null
  }
  const engine = headers.get(AI_HEADERS.searchEngine)?.trim() ?? ""
  return {
    engine: (SEARCH_ENGINE_ORDER as readonly string[]).includes(engine) ? (engine as SearchEngineId) : "auto",
    tavily: pick(AI_HEADERS.tavily, /^tvly-[A-Za-z0-9_-]{10,200}$/),
    perplexity: pick(AI_HEADERS.perplexity, /^[A-Za-z0-9_-]{16,200}$/),
    groq: pick(AI_HEADERS.groq, /^gsk_[A-Za-z0-9]{10,200}$/),
    gemini: pick(AI_HEADERS.gemini, /^AIza[A-Za-z0-9_-]{10,200}$/),
    serpapi: pick(AI_HEADERS.serpapi, /^[A-Za-z0-9]{32,128}$/),
    meta: pick(AI_HEADERS.meta, /^EA[A-Za-z0-9]{20,1000}$/, 1100),
  }
}

/**
 * Accepts only the fixed writing tasks with bounded carousel text (the AI key
 * can't be used for anything else). Returns the request or a reason.
 */
export function parseAiRequest(body: unknown): AiRequest | string {
  if (!body || typeof body !== "object") return "Nothing to write about."
  const b = body as Record<string, unknown>
  if (b.task === "trend-details") {
    const headline = oneLine(str(b.headline, 300))
    if (!headline) return "Type the headline first."
    // The article when it's at hand; otherwise the poster's own words are enough for 2 sentences.
    const article = articleText(b.article)
    return {
      task: "trend-details",
      article: article.length >= 60 ? article : "",
      brand: oneLine(str(b.brand, 60)) || "Homes.ph",
      headline,
      subtext: oneLine(str(b.subtext, 200)),
      caption: str(b.caption, 3000).trim(),
    }
  }
  if (b.task === "carousel-research") {
    const topic = oneLine(str(b.topic, 200))
    if (topic.length < 3) return "Type the topic first."
    return { task: "carousel-research", topic, cards: int(b.cards, CAROUSEL_CARDS.min, CAROUSEL_CARDS.max, CAROUSEL_CARDS.default), avoid: list(b.avoid, 150, 80), brand: carouselBrand(b.brand) }
  }
  if (b.task === "trend-search") {
    const brand = b.brand === "pickleplay" || b.brand === "fhi" || b.brand === "homes" || b.brand === "gensan" ? b.brand : null
    if (!brand) return "Unknown brand."
    const day = typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : ""
    if (!day) return "Pick the day first."
    // No word limit on a keyword (the team pastes whole lists): 200 characters each, 500 of them.
    const keywords = list(b.keywords, 500, 200)
    if (!keywords.length) return "Add at least one keyword."
    const developers = list(b.developers, 100, 80)
    const posts: PostsMode = POSTS_MODES.find((m) => m === b.posts) ?? "fallback"
    // Facebook Pages to read with the person's Meta token (names, IDs or links).
    const pages = list(b.pages, 10, 200)
    // A Homes.ph page's place ("Cebu"): only for Homes.ph posters.
    const place = brand === "homes" ? oneLine(str(b.place, 60)) : ""
    // "Look for": the kinds of news besides the keywords, only those the brand offers.
    const look = Array.isArray(b.look) ? BRAND_LOOKS[brand].filter((l) => (b.look as unknown[]).includes(l)) : []
    return {
      task: "trend-search",
      brand,
      keywords,
      ...(developers.length ? { developers } : {}),
      day,
      days: int(b.days, 1, 7, 2),
      avoid: list(b.avoid, 100, 160),
      posts,
      ...(pages.length ? { pages } : {}),
      ...(place ? { place } : {}),
      ...(look.length ? { look } : {}),
    }
  }
  if (b.task === "news-article") {
    const article = articleText(b.article)
    if (article.length < 60) return "The story is too short to write an article from. Open its page and paste the article."
    return { task: "news-article", article, brand: oneLine(str(b.brand, 60)) || "Homes.ph", source: oneLine(str(b.source, 300)) }
  }
  if (b.task === "pickleball-post") {
    const kinds = ["history", "trivia", "funfact", "courtowner", "comingsoon", "nowopen"] as const
    const kind = kinds.find((k) => k === b.kind)
    if (!kind) return "Choose History, Trivia, Fun Facts, Court Owners, Coming Soon or Now Open."
    const base = { task: "pickleball-post" as const, kind, topic: oneLine(str(b.topic, 160)), avoid: list(b.avoid, 80, 90) }
    if (kind !== "comingsoon" && kind !== "nowopen") return base
    // A court's own post: its details as typed, and an article about it when pasted.
    const c = (b.court && typeof b.court === "object" ? b.court : {}) as Record<string, unknown>
    const court = { name: oneLine(str(c.name, 80)), barangay: oneLine(str(c.barangay, 60)), city: oneLine(str(c.city, 60)), hours: oneLine(str(c.hours, 80)) }
    const article = articleText(b.article).slice(0, 8000)
    return { ...base, court, ...(article ? { article } : {}) }
  }
  if (b.task === "brand-post") {
    const kind = b.kind === "dyk" || b.kind === "engagement" ? b.kind : null
    if (!kind) return "Choose Did You Know or Engagement Posts."
    const all = ["kicker", "title", "subtitle", "question", "labels", "options", "facts", "cta"] as const
    const fields = Array.isArray(b.fields) ? all.filter((f) => (b.fields as unknown[]).includes(f)) : []
    if (!fields.length) return "The template has no texts."
    return {
      task: "brand-post",
      kind,
      brand: oneLine(str(b.brand, 60)) || "Homes.ph",
      template: oneLine(str(b.template, 40)),
      fields: [...fields],
      topic: oneLine(str(b.topic, 200)),
      avoid: list(b.avoid, 30, 160),
    }
  }
  if (b.task === "carousel-topics") {
    return { task: "carousel-topics", month: oneLine(str(b.month, 40)) || "this month", count: int(b.count, 3, 8, 6), avoid: list(b.avoid, 80, 140), brand: carouselBrand(b.brand) }
  }
  if (b.task === "carousel-from-article") {
    const article = articleText(b.article)
    if (article.length < 60) return "Paste the whole article first (at least a few sentences)."
    return { task: "carousel-from-article", article, cards: int(b.cards, CAROUSEL_CARDS.min, CAROUSEL_CARDS.max, CAROUSEL_CARDS.default), brand: carouselBrand(b.brand) }
  }
  if (b.task === "article-headline" || b.task === "poster-caption") {
    const article = articleText(b.article)
    if (article.length < 60) return "Paste the whole article first (at least a few sentences)."
    const brand = str(b.brand, 60).trim() || "Homes.ph"
    if (b.task === "poster-caption") return { task: "poster-caption", article, brand, headline: str(b.headline, 300).replace(/\s+/g, " ").trim() }
    return { task: "article-headline", article, brand, count: int(b.count, 1, 5, 3) }
  }
  if (b.task === "headline-highlight") {
    const headline = str(b.headline, 400).replace(/\s+/g, " ").trim()
    return headline ? { task: "headline-highlight", headline } : "Type the headline first."
  }
  const carousel = carouselFrom(b.carousel)
  if (!carousel) return "The carousel text is missing."
  if (b.task === "card-description") {
    const cardIndex = int(b.cardIndex, 0, 29, -1)
    if (cardIndex < 0 || cardIndex >= carousel.cards.length) return "That card doesn't exist."
    const minChars = int(b.minChars, 40, 300, 100)
    return { task: "card-description", carousel, cardIndex, minChars, maxChars: int(b.maxChars, minChars + 10, 400, 160) }
  }
  if (b.task === "cover-subtitle") return { task: "cover-subtitle", carousel, maxChars: int(b.maxChars, 20, 120, 60) }
  if (b.task === "caption") {
    if (!carousel.title && !carousel.cards.length) return "Add some text to the slides first."
    return { task: "caption", carousel }
  }
  return "Unknown writing task."
}
