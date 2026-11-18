import type { BrandPostAiRequest } from "./brand-post-ai"
/** Carousel text sent to the AI (no images, no styling: keeps requests small). */
export interface CarouselText {
  /** Cover title: Headline 1 + Headline 2. */
  title: string
  /** Cover subtitle. */
  subtitle: string
  cards: { title: string; subtitle: string; description: string }[]
  caption?: string
  /** Whose carousel it is (from its cover's template); Homes.ph when not given. */
  brand?: CarouselBrandId
}

export type AiRequest =
  /** A shorter (or fuller) description for one card that fits 2–3 lines. */
  | { task: "card-description"; carousel: CarouselText; cardIndex: number; minChars: number; maxChars: number }
  /** One short line for the cover subtitle, summing up the cards. */
  | { task: "cover-subtitle"; carousel: CarouselText; maxChars: number }
  /** The Facebook post caption, from all slides. */
  | { task: "caption"; carousel: CarouselText }
  /** The words of a poster headline to show in the accent color (the hook). */
  | { task: "headline-highlight"; headline: string }
  /** Poster headlines (recommended + alternatives, with hook words), subtext choices and the Facebook caption from a pasted article. */
  | { task: "article-headline"; article: string; brand: string; count: number }
  /** A new Facebook caption (with hashtags) for a poster, from its article. */
  | { task: "poster-caption"; article: string; brand: string; headline: string }
  /**
   * Daily report "Details" for a poster (Daily Trend News): what the news is about and why it's a
   * timely trend, from the article ("" when it isn't at hand: then from the headline, subtext and caption).
   */
  | { task: "trend-details"; article: string; brand: string; headline: string; subtext: string; caption: string }
  /**
   * Create New Carousel → from an article: the cover (Headline 1, Headline 2, subtitle), the
   * Facebook caption and `cards` content cards (title, subtitle, description), only from the article.
   */
  | { task: "carousel-from-article"; article: string; cards: number; brand?: CarouselBrandId }
  /**
   * Create New Carousel → search a topic: Groq searches the web and lists `cards` places (name,
   * location, facts, source), none from `avoid` (places already featured in earlier carousels).
   */
  | { task: "carousel-research"; topic: string; cards: number; avoid: string[]; brand?: CarouselBrandId }
  /**
   * Poster Maker → Trending news: Groq searches the web for the newest positive stories about the
   * brand's `keywords`, published on `day` or the `days - 1` days before it, none of the `avoid` headlines.
   */
  /**
   * `developers`: the brand's partner developers (searched too; their positive news goes first).
   * `posts`: public Facebook posts (the ones search engines have indexed) are searched only when no
   * news with a link is found ("fallback", the default), always, or never. `pages`: Facebook Pages
   * read with the person's own Meta access token (only Pages that token may read). `place`: a Homes.ph
   * page's short name ("Cebu", "BGC Taguig"): its news must be in that place (Homes.ph CARAGA has none).
   * `look`: the kinds of news to find besides the keywords (none: real estate and positive news only).
   */
  | { task: "trend-search"; brand: TrendBrand; keywords: string[]; developers?: string[]; day: string; days: number; avoid: string[]; posts?: PostsMode; pages?: string[]; place?: string; look?: TrendLook[] }
  /**
   * Trending news → Write article: a Facebook headline, a short and a detailed article, the caption,
   * carousel cards and an image prompt from one story, keeping its facts apart from the AI's notes.
   */
  | { task: "news-article"; article: string; brand: string; source: string }
  /** Create New Carousel → suggested topics for `month`, different from `avoid` (topics already done). */
  | { task: "carousel-topics"; month: string; count: number; avoid: string[]; brand?: CarouselBrandId }
  /**
   * Advertisement → PicklePlay: the text of a Pickleball History, Trivia or Fun Fact poster (all
   * four templates' fields), about `topic` (or any fact), none of the `avoid` facts already posted.
   */
  | {
      task: "pickleball-post"
      kind: "history" | "trivia" | "funfact" | "courtowner" | "comingsoon" | "nowopen"
      topic: string
      avoid: string[]
      /** Coming Soon / Now Open: an article or announcement about the court (optional). */
      article?: string
      /** Coming Soon / Now Open: the court's details as typed (never changed by the AI). */
      court?: { name: string; barangay: string; city: string; hours: string }
    }

  /** Poster Maker → Did You Know / Engagement Posts (1.52): a post's texts for its template, and its caption. */
  | ({ task: "brand-post" } & BrandPostAiRequest)

export type AiTask = AiRequest["task"]

/** Whose carousel the AI writes: Homes.ph (the default), Homes.ph Gensan, FHI Global Property or PicklePlay. */
export type CarouselBrandId = "homes" | "gensan" | "fhi" | "pickleplay"

/** The Poster Maker's brands, for the trending-news search. */
export type TrendBrand = "pickleplay" | "fhi" | "homes" | "gensan"

/**
 * Trending news → "Look for": the kinds of news searched besides the brand's keywords (real estate
 * and partner developers, new businesses, festivals and events, tourism, city projects, helpful information).
 */
export type TrendLook = "realestate" | "openings" | "events" | "tourism" | "projects" | "helpful"

/** Trending news → public Facebook posts: when no news with a link is found (default), always, or never. */
export type PostsMode = "fallback" | "always" | "off"
export const POSTS_MODES: readonly PostsMode[] = ["fallback", "always", "off"]

/** Poster Maker, floating report and "carousel from an article" tasks: these can use the user's own AI key (Settings → Poster Maker AI). */
export const POSTER_AI_TASKS: readonly AiTask[] = ["article-headline", "headline-highlight", "poster-caption", "trend-details", "carousel-from-article", "carousel-research", "carousel-topics", "trend-search", "pickleball-post", "news-article", "brand-post"]

/** What a found page is: a news or web page, a public Facebook post a search engine indexed, or a post read from a Facebook Page with the Meta API. */
export type SourceKind = "news" | "facebook" | "page"

/** A web page the AI's search found or opened. */
export interface AiSource {
  title: string
  url: string
  /** The publication day the source itself gives (YYYY-MM-DD), when it gives one. */
  date?: string
  /** Set for Facebook posts ("facebook", "page"); news and web pages leave it out. */
  kind?: SourceKind
  /** A picture of the story (Google's thumbnail, the post's photo), when the source has one. */
  image?: string
  /** Facebook Page posts: the Page's name. */
  from?: string
}

/** How a web search was done: Tavily (credits it used), or Groq's built-in browser (and why, when Tavily failed). */
export interface AiSearchInfo {
  engine: SearchEngineId
  /** Tavily credits, or Perplexity searches (each is billed). */
  credits?: number
  /** Why the chosen engine didn't search ("Perplexity: the key was rejected."); another one did. */
  note?: string
  /**
   * Trending news: public Facebook posts were searched too, always or because no news with a link was
   * found ("no-news"), by `engine` (credits it used), with `found` posts; `error` when that search failed.
   */
  posts?: { why: "always" | "no-news"; engine: SearchEngineId; found: number; credits?: number; error?: string }
  /** Trending news: posts read from Facebook Pages with the person's Meta token (and the Pages it couldn't read). */
  meta?: { pages: number; posts: number; errors: string[] }
  /** Trending news: what was searched ("General Santos City grand opening November 2026"…). */
  queries?: string[]
  /** Trending news: how many of the keywords sent were searched (the next search starts after them). */
  keywordsUsed?: number
  /** Trending news: keywords about another place that weren't searched. */
  skipped?: string[]
}

/**
 * Who searches the web for Trending news, Search a topic and PicklePlay facts. Tavily and Perplexity
 * return the pages and the writing AI picks from them; Groq and Gemini search and write in one go.
 */
export type SearchEngineId = "tavily" | "serpapi" | "perplexity" | "groq" | "gemini"

/** Automatic: the first engine with a key, in this order (the free plans first). */
export const SEARCH_ENGINE_ORDER: readonly SearchEngineId[] = ["tavily", "serpapi", "perplexity", "groq", "gemini"]

/** The engines that return pages (the writing AI picks from them); Groq and Gemini search and write in one go. */
export const PAGE_ENGINES: readonly SearchEngineId[] = ["tavily", "serpapi", "perplexity"]

export const SEARCH_ENGINES: { id: SearchEngineId; name: string; about: string; cost: string }[] = [
  { id: "tavily", name: "Tavily", about: "A search API made for AI: finds the pages, then your writing AI picks the stories.", cost: "Free plan: 1,000 credits a month (a trending search uses 3)." },
  {
    id: "serpapi",
    name: "Google Search (SerpApi)",
    about: "Real Google results through SerpApi: Google News, and the public Facebook posts Google has indexed. Your writing AI picks the stories.",
    cost: "Free plan: 250 searches a month (a trending search uses 3; Facebook posts 2 more).",
  },
  { id: "perplexity", name: "Perplexity", about: "Perplexity's Search API: fresh, ranked web results with dates, then your writing AI picks the stories.", cost: "Paid: about $5 per 1,000 searches (a trending search makes 3)." },
  { id: "groq", name: "Groq web search", about: "Groq's AI browses the web and writes the answer itself.", cost: "Free, but one search uses a lot of Groq's daily limit." },
  { id: "gemini", name: "Gemini + Google Search", about: "Gemini searches Google and writes the answer itself.", cost: "Google's free daily allowance, then billed per search." },
]

export const searchEngineName = (id: string | null | undefined) => SEARCH_ENGINES.find((e) => e.id === id)?.name ?? "the web search"

export interface AiResponse {
  text: string
  /** carousel-research / trend-search / pickleball-post: the pages the web search really found. */
  sources?: AiSource[]
  /** carousel-research / trend-search: which search engine did it. */
  search?: AiSearchInfo
  /** With the user's own key: the model that answered (picked automatically when none was chosen). */
  model?: string
}

/** /api/ai/tavily: which Tavily key the web searches use, and (when checked) its credits this month. */
export interface TavilyStatus {
  source: "own" | "built-in" | "none"
  used?: number
  limit?: number | null
  plan?: string
}

/** /api/ai/models: the provider a key belongs to and the models it can use. */
export interface AiModelsResponse {
  provider: AiProviderId
  models: string[]
  recommended: string | null
}

export interface AiErrorBody {
  error: string
  /** The user's own key or model failed (not the built-in Groq), so Groq can be tried instead. */
  own?: boolean
}

export type AiProviderId = "groq" | "openai" | "anthropic" | "gemini" | "perplexity" | "openrouter" | "deepseek" | "xai" | "mistral"

/** The user's own AI key for the Poster Maker. Kept on this computer only. */
export interface AiProviderConfig {
  provider: AiProviderId
  key: string
  /** Empty = automatic: the provider's default, or a model the key has when that one isn't available. */
  model?: string
}

export const AI_PROVIDERS: { id: AiProviderId; name: string; defaultModel: string; keyHint: string; keyUrl: string }[] = [
  { id: "groq", name: "Groq", defaultModel: "openai/gpt-oss-120b", keyHint: "gsk_…", keyUrl: "https://console.groq.com/keys" },
  { id: "openai", name: "OpenAI (ChatGPT)", defaultModel: "gpt-5-mini", keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic (Claude)", defaultModel: "claude-haiku-5-5", keyHint: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", name: "Google Gemini", defaultModel: "gemini-2.5-flash", keyHint: "AIza…", keyUrl: "https://aistudio.google.com/app/apikey" },
  // Perplexity's Agent API (its Sonar chat API was retired on 2026-09-27); also a web search engine.
  { id: "perplexity", name: "Perplexity", defaultModel: "perplexity/sonar", keyHint: "pplx-…", keyUrl: "https://console.perplexity.ai/project/keys" },
  { id: "openrouter", name: "OpenRouter", defaultModel: "openrouter/auto", keyHint: "sk-or-…", keyUrl: "https://openrouter.ai/settings/keys" },
  { id: "deepseek", name: "DeepSeek", defaultModel: "deepseek-chat", keyHint: "sk-…", keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "xai", name: "xAI (Grok)", defaultModel: "grok-3-mini", keyHint: "xai-…", keyUrl: "https://console.x.ai" },
  { id: "mistral", name: "Mistral", defaultModel: "mistral-small-latest", keyHint: "32 letters and numbers", keyUrl: "https://console.mistral.ai/api-keys" },
]

export function aiProvider(id: string | null | undefined) {
  return AI_PROVIDERS.find((p) => p.id === id)
}

/** Request headers that carry the user's own key to /api/ai (read on the server for that request only). */
export const AI_HEADERS = {
  provider: "x-dcm-ai-provider",
  key: "x-dcm-ai-key",
  model: "x-dcm-ai-model",
  tavily: "x-dcm-tavily-key",
  /** Web searches only: the chosen engine ("auto" or a SearchEngineId) and the saved keys that can search. */
  searchEngine: "x-dcm-search-engine",
  perplexity: "x-dcm-perplexity-key",
  groq: "x-dcm-groq-key",
  gemini: "x-dcm-gemini-key",
  serpapi: "x-dcm-serpapi-key",
  /** Trending news → Facebook Pages: the person's own Meta (Graph API) access token. */
  meta: "x-dcm-meta-token",
} as const

/** The tasks that search the web (Tavily, or Groq's browser; a PicklePlay post only for a typed topic). */
export const SEARCH_AI_TASKS: readonly AiRequest["task"][] = ["carousel-research", "trend-search", "pickleball-post"]

/** /api/ai/search-check: a SerpApi key's searches left, or the Facebook Page(s) a Meta token reads. */
export interface SearchCheckResult {
  /** "212 of 250 searches left this month · Free plan", "Reads: PicklePlay PH". */
  text: string
}

/** One AI headline choice. `highlight` is "" when the AI's hook words aren't in the headline. */
export interface HeadlineOption {
  headline: string
  highlight: string
}

/**
 * What a poster subtext says: the key details ("Nov 22, 2026 | Cebu City"), the article's key
 * point, a one-line summary, or a short quote from it.
 */
export type SubtextKind = "details" | "key point" | "summary" | "quote"

export interface SubtextOption {
  text: string
  kind: SubtextKind
}

/** Poster content written from an article: headline choices (the recommended one first) and the subtext. */
export interface PosterCopy {
  /** "Pickleball Tournaments", "Real Estate News"… ("" if the AI didn't say). */
  category: string
  options: HeadlineOption[]
  /** The recommended subtext, e.g. "November 22, 2026 | Cebu City | ₱50,000 Prize Pool" ("" when none). */
  subtext: string
  /** Subtext choices of different kinds (the recommended one first). */
  subtexts: SubtextOption[]
  /** The AI recommends no subtext: the headline says it all (the choices are still there). */
  noSubtext: boolean
  /** The Facebook caption for the post (null when the AI didn't write one). */
  caption: PosterCaption | null
  /** Daily report "Details" (Daily Trend News): what the news is about and why it's a trend ("" when not written). */
  details: string
}

/** A poster's social media caption: a few short paragraphs (no emojis) and the hashtags to post with it. */
export interface PosterCaption {
  text: string
  /** "#HomesPH", "#BGCTaguig"…: the brand's own first. */
  hashtags: string[]
}

/** The caption as it's posted: the text, a blank line, the hashtags. */
export function captionForPost(caption: PosterCaption): string {
  return caption.hashtags.length ? `${caption.text}\n\n${caption.hashtags.join(" ")}` : caption.text
}
