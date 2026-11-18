import { CARAGA_NAMES, GENSAN_NAMES } from "./area-names"
import { cleanSlideText } from "./carousel-draft"
import { hostOf } from "./carousel-research"
import type { HomesPlace } from "./homes-places"
import { lookOfKind } from "./trend-looks"
import type { AiSource, SourceKind, TrendBrand, TrendLook } from "./types"

/**
 * Poster Maker → Trending news: each brand's search keywords (the team's lists by default, editable),
 * the stories Groq's web search finds, and the checks that keep them new, positive and not posted yet.
 */

export const DEFAULT_TREND_KEYWORDS: Record<TrendBrand, readonly string[]> = {
  pickleplay: [
    "Pickleball Philippines",
    "Pickleball News",
    "Pickleball Tournament Philippines",
    "Pickleball Championship 2026",
    "Philippine Pickleball League",
    "Pickleball Events Philippines",
    "Pickleball Court Opening",
    "Pickleball Court Owners",
    "Pickleball Community Philippines",
    "Pickleball Business Philippines",
    "Pickleball Club Philippines",
    "Pickleball Coaching Philippines",
    "Pickleball Sports News",
    "Pickleball Equipment",
    "Pickleball Paddle Reviews",
    "Pickleball Growth Philippines",
    "Pickleball Sponsorship",
    "Pickleball Business Opportunities",
    "Pickleball Player Achievements",
    "Pickleball Sports Partnerships",
  ],
  fhi: [
    "Dubai Real Estate",
    "Dubai Property Market",
    "Dubai Property Investment",
    "Dubai Luxury Real Estate",
    "Dubai Property Sales",
    "Dubai Off-Plan Properties",
    "Dubai Real Estate News",
    "Dubai Business News",
    "Dubai Business Opportunities",
    "Dubai Investment News",
    "Dubai Property Developers",
    "Dubai New Property Launches",
    "Dubai Mega Projects",
    "Dubai Real Estate Market Trends",
    "Dubai Commercial Properties",
    "Dubai Property Prices",
    "Dubai Business Expansion",
    "Dubai Economic Growth",
    "Dubai Real Estate Record Sales",
    "Dubai Infrastructure Developments",
    // The partner developers' cities (the team's list).
    "Abu Dhabi Real Estate",
    "Sharjah Real Estate",
    "Ajman Real Estate",
    "Ras Al Khaimah Real Estate",
    "Umm Al Quwain Real Estate",
    "Fujairah Real Estate",
    "Dubai South Properties",
    "Dubai Studio City Properties",
  ],
  homes: [
    "Caraga Real Estate",
    "Caraga Property Market",
    "Butuan City Real Estate",
    "Caraga Properties for Sale",
    "Caraga Property Investment",
    "Caraga Housing Developments",
    "Butuan House and Lot",
    "Caraga Land for Sale",
    "Caraga Real Estate News",
    "Caraga New Housing Projects",
    "Caraga Subdivision Developments",
    "Caraga Business News",
    "Caraga Infrastructure Projects",
    "Caraga Economic Growth",
    "Siargao Property Investment",
    "Surigao Real Estate",
    "Agusan del Sur Properties",
    "Agusan del Norte Real Estate",
    "Caraga Commercial Properties",
    "Caraga Property Developers",
  ],
  // The team's six Homes.ph Gensan lists (real estate, homes, infrastructure, business, property), each
  // keyword once; General Santos City only (1.47: the keywords for Koronadal, Polomolok, South Cotabato,
  // Sarangani and the rest of SOCCSKSARGEN were taken out).
  gensan: [
    "General Santos City Real Estate",
    "GenSan Property Market",
    "GenSan Real Estate News",
    "GenSan Properties for Sale",
    "GenSan Property Investment",
    "GenSan Housing Developments",
    "GenSan Land for Sale",
    "GenSan Business News",
    "GenSan Infrastructure Projects",
    "GenSan New Housing Projects",
    "GenSan Subdivision Developments",
    "GenSan Economic Growth",
    "GenSan Commercial Properties",
    "GenSan Urban Development",
    "GenSan Affordable Housing",
    "GenSan Dream Homes",
    "GenSan Modern Houses",
    "GenSan House and Lot Packages",
    "GenSan Residential Communities",
    "GenSan Family Homes",
    "GenSan First-Time Homebuyers",
    "GenSan Homeownership Opportunities",
    "GenSan Housing Market Trends",
    "GenSan Property Buying Guide",
    "GenSan Real Estate Tips",
    "GenSan Subdivision Living",
    "GenSan Modern Architecture",
    "GenSan Home Construction",
    "GenSan Residential Property Investment",
    "GenSan Housing Demand",
    "GenSan Rental Market",
    "GenSan New Residential Communities",
    "GenSan Property Ownership",
    "GenSan Home Financing News",
    "General Santos City Road Projects",
    "GenSan Road Expansion",
    "GenSan Housing Projects",
    "GenSan Public Infrastructure",
    "GenSan City Development Projects",
    "GenSan Transportation Development",
    "GenSan Airport Development",
    "GenSan Port Development",
    "GenSan Flood Control Projects",
    "GenSan New Bridges",
    "GenSan Urbanization",
    "GenSan Commercial District Development",
    "GenSan Public Market Development",
    "GenSan Government Development Projects",
    "GenSan New Communities",
    "GenSan Land Development",
    "GenSan City Expansion",
    "GenSan Infrastructure News",
    "General Santos City Business News",
    "GenSan Business Developments",
    "GenSan Investment Opportunities",
    "GenSan Business Expansion",
    "GenSan New Business Openings",
    "GenSan Commercial Investment",
    "GenSan Entrepreneurs",
    "GenSan Business District Development",
    "GenSan New Establishments",
    "GenSan Industrial Development",
    "GenSan Business Opportunities",
    "GenSan Startup Businesses",
    "GenSan Market Growth",
    "GenSan Foreign Investment",
    "GenSan Retail Developments",
    "GenSan Business Partnerships",
    "GenSan Infrastructure Investment",
    "GenSan Local Economy News",
    "GenSan House and Lot",
    "GenSan Property Developers",
    "GenSan Residential Properties",
    "GenSan Property Prices",
    "GenSan Real Estate Market Trends",
    "GenSan Real Estate Opportunities",
    "GenSan Property Sales",
    "GenSan Condo Developments",
    "GenSan Real Estate Growth",
  ],
}

/** FHI Global Property's partner developers (the team's list). */
const FHI_DEVELOPERS: readonly string[] = [
  "Acube Developments",
  "Albatha Real Estate",
  "Aldar Development",
  "AQUA Developments",
  "Ardee Developments",
  "Azizi Developments",
  "BARCO Developers",
  "Binghatti Developers",
  "BNW Developments",
  "Casagrand Premier Builders Ltd",
  "Damac Properties",
  "Danube Properties",
  "DAR Global",
  "Deca Properties",
  "Deniz Properties",
  "Dugasta Properties",
  "Ellington Properties",
  "Emaar Properties",
  "Enso Development",
  "Expo City Dubai",
  "GFS Developments",
  "H&H Development",
  "Imtiaz Development",
  "Leos Development",
  "One Yard Development",
  "Peace Homes Development",
  "Qube Development",
  "Reportage Properties",
  "Rove Residences Developers",
  "Samana Developers",
  "Sobha Realty",
  "Tarrad Development",
  "Tiger Properties",
  "Union Properties",
]

/** Homes.ph's partner developers (the team's list), for Homes.ph CARAGA and Homes.ph Gensan. */
const HOMES_DEVELOPERS: readonly string[] = [
  "8990 Holdings Inc.",
  "Aboitizland",
  "Avida Land",
  "Amaia Land",
  "Arthaland Corporation",
  "AppleOne Properties Inc.",
  "BE Residences",
  "Bria Homes Inc.",
  "Camella Homes",
  "Cebu Landmasters Inc.",
  "Century Properties",
  "Contempo Property Holdings",
  "Deca Homes",
  "Duros Land",
  "Filinvest Land Inc.",
  "Federal Land",
  "Grand Land Inc.",
  "Megaworld Corporation",
  "Johndorf Ventures Corporation",
  "King Properties Inc.",
  "PHINMA Property Holdings",
  "Priland Development Corporation",
  "Primary Homes Inc.",
  "Pueblo de Oro Development Corporation",
  "Robinsons Land Corporation",
  "Rockwell Land Corporation",
  "SMDC",
  "Sta. Lucia Land Inc.",
  "Suntrust Properties Inc.",
  "Taft Properties",
  "Vista Land",
  "Wee Community Developers Inc.",
  "Worldwide Central Properties Inc.",
  "PH1 World Developers",
  "Empire East Land Holdings",
  "Italpinas Development Corporation",
  "Danube Properties",
  "Cebu Property Ventures and Development Corporation",
  "Golden Topper",
  "InnoLand",
  "MLD Dreambuilders Inc.",
  "Nexus Real Estate Corporation",
  "Primeworld Land Holdings Inc.",
  "Saekyung Realty Corporation",
  "Sterling Land",
  "Tytans Properties and Development Inc.",
  "Vibo Land",
  "Widia Properties and Development Corporation",
]

/**
 * Each brand's partner developers (editable in Trending news, like the keywords). Each search looks for
 * one of them, and their positive news (new projects, launches, awards) goes first.
 */
export const DEFAULT_TREND_DEVELOPERS: Record<TrendBrand, readonly string[]> = {
  pickleplay: [],
  fhi: FHI_DEVELOPERS,
  homes: HOMES_DEVELOPERS,
  gensan: HOMES_DEVELOPERS,
}

/** Company words a story usually leaves out ("Filinvest Land Inc." is "Filinvest" in the news). */
const COMPANY_WORDS = new Set(
  "inc inc. corporation corp corp. ltd ltd. co co. company group holdings development developments developer developers properties property real estate realty land homes builders premier ventures and".split(" "),
)
/** Short names too common to stand alone ("Grand", "Federal", "Union"…) or that are places. */
const COMMON_NAMES = new Set("all one new the grand federal primary union vista golden peace tiger century empire sterling king global expo city nexus cebu dubai manila davao".split(" "))

/** The ways a story can name a developer: "Filinvest Land" / "Filinvest", "SMDC", "Sta. Lucia Land" / "Sta. Lucia". */
function developerNames(name: string): { text: string; exact: boolean }[] {
  const words = name.replace(/\s+/g, " ").trim().split(" ")
  const trimmed = words.filter((w, i) => i === 0 || !/^(inc\.?|corporation|corp\.?|ltd\.?|co\.?)$/i.test(w)).join(" ")
  const names = [{ text: trimmed, exact: false }]
  const core = words.filter((w, i) => i === 0 || !COMPANY_WORDS.has(w.toLowerCase()))
  const short = core.join(" ")
  const acronym = core.length === 1 && /^[A-Z0-9&]{3,}$/.test(core[0])
  const ok = core.length >= 2 || acronym || (core[0].length >= 5 && !COMMON_NAMES.has(core[0].toLowerCase()))
  if (ok && short !== trimmed && !COMMON_NAMES.has(short.toLowerCase())) names.push({ text: short, exact: acronym })
  return names
}

/** The partner developer a story names ("" when none): its title and summary, by full or short name. */
export function partnerIn(text: string, developers: readonly string[]): string {
  for (const developer of developers) {
    for (const { text: name, exact } of developerNames(developer)) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, exact ? "u" : "iu")
      if (re.test(text)) return developer
    }
  }
  return ""
}

export interface TrendStory {
  title: string
  /** "2026-11-08" as the AI read it on the page ("" when it gave none). */
  dateText: string
  /** The publication day (local midnight), or null when it couldn't be read. */
  date: Date | null
  url: string
  /** "gulfnews.com" */
  site: string
  /** The story is one of the pages the search really found or opened (or the same site). */
  verified: boolean
  summary: string
  why: string
  /** A news or web page, a public Facebook post (found by a search engine) or a post read from a Facebook Page. */
  kind: SourceKind
  /** The source's picture (Google's thumbnail, the post's photo), when it has one. */
  image?: string
  /** Facebook Page posts: the Page's name. */
  from?: string
  /** Its kind, when the search looked for kinds ("Look for"): an opening, an event, helpful info… */
  look?: TrendLook
  /** Where it is, as the AI read it: "Butuan City, Agusan del Norte". */
  where?: string
  /** Who published it: "PIA Caraga", "City Government of Butuan (Facebook)". */
  sourceName?: string
  /** An upcoming event's, opening's or deadline's day ("2026-11-20"). */
  eventDate?: string
  /** How hot the AI rates it, 1–100. */
  trending?: number
  /** When the AI says to post it. */
  timing?: PostTiming
}

/** When to post a story: it's happening now, it's the day's news, or it stays useful for days. */
export type PostTiming = "now" | "today" | "week"
export const POST_TIMING_TEXT: Record<PostTiming, string> = { now: "Post immediately", today: "Post today", week: "Good this week" }

/** "Post immediately", "post today", "Good this week" → the timing; null for anything else. */
export function timingOf(text: string): PostTiming | null {
  const t = text.toLowerCase()
  if (/immediate|right away|asap|now\b/.test(t)) return "now"
  if (/today/.test(t)) return "today"
  if (/week/.test(t)) return "week"
  return null
}

/**
 * When to post a story: the AI's word, unless the dates say otherwise. An event today or tomorrow (as
 * of `day`) goes out immediately; one that has passed, or news two days old or more, is only "good this week".
 */
export function postTiming(story: Pick<TrendStory, "date" | "eventDate" | "timing">, day: Date): PostTiming {
  const event = story.eventDate ? storyAgeDays({ date: storyDate(story.eventDate) }, day) : null
  if (event !== null && event <= 0 && event >= -1) return "now"
  if (event !== null && event > 0) return "week"
  const age = storyAgeDays(story, day)
  if (age !== null && age >= 2) return "week"
  return story.timing ?? (age !== null && age <= 0 ? "today" : "week")
}

/** A story line's labeled parts: "place: Butuan City", "trending: 85", "post: Post today", "kind: Event". */
const STORY_TAG = /^\[?\s*(kind|place|source|event(?:\s*date)?|trending|post(?:\s*timing)?)\s*\]?\s*:\s*(.*)$/i
const EMPTY_TAG = /^(\[.*\]|empty|none|n\/?a|-+|unknown|not (?:stated|given|available))?$/i

function storyTags(parts: string[]): { rest: string[]; tags: Partial<Pick<TrendStory, "look" | "where" | "sourceName" | "eventDate" | "trending" | "timing">> } {
  const tags: ReturnType<typeof storyTags>["tags"] = {}
  const rest: string[] = []
  parts.forEach((part, i) => {
    // The headline, the date and the summary are never labels ("Event: …" can start a headline).
    const m = i >= 3 ? STORY_TAG.exec(part.trim()) : null
    if (!m) return void rest.push(part)
    const name = m[1].toLowerCase().replace(/\s+/g, "")
    const raw = m[2].trim()
    // The format's own placeholder copied back ("[1-100]", "[city or municipality, province]") says nothing.
    if (name !== "kind" && /^\[.*\]$/.test(raw) && !/^\[\s*\d{1,3}\s*%?\s*\]$/.test(raw)) return
    const value = raw.replace(/^\[|\]$/g, "").trim()
    if (EMPTY_TAG.test(value)) return
    if (name === "kind") {
      const look = lookOfKind(value)
      if (look) tags.look = look
    } else if (name === "place") tags.where = cleanSlideText(value, 80)
    else if (name === "source") tags.sourceName = cleanSlideText(value, 80)
    else if (name.startsWith("event")) {
      const d = storyDate(value)
      if (d) tags.eventDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    } else if (name === "trending") {
      const n = Number(/\d{1,3}/.exec(value)?.[0])
      if (n >= 1 && n <= 100) tags.trending = n
    } else {
      const timing = timingOf(value)
      if (timing) tags.timing = timing
    }
  })
  return { rest, tags }
}

/** Facebook's own addresses: a story there is a Facebook post. */
export const isFacebookLink = (url: string) => /^https?:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.watch)(\/|$)/i.test(url.trim())

/** "2026-11-08", "November 8, 2026", "Nov 8 2026" → that day at local midnight; null otherwise. */
export function storyDate(text: string): Date | null {
  const t = text.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const parsed = Date.parse(t)
  if (Number.isNaN(parsed) || !/\d{4}/.test(t)) return null
  const d = new Date(parsed)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function samePage(a: string, b: string) {
  // Facebook's m. and web. addresses are the same post as www.
  const norm = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.|m\.|web\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "")
  return norm(a) === norm(b)
}

/** The AI's STORIES lines with the pages the search really used. Repeats are left out. */
export function parseTrendStories(text: string, found: AiSource[]): TrendStory[] {
  const stories: TrendStory[] = []
  for (const raw of text.split(/\n/)) {
    const line = raw.replace(/【[^】]*】/g, "").replace(/\*\*|__/g, "").trim()
    if (!/^(\d+[.)]|[-*•])\s*/.test(line)) continue
    const parts = line.replace(/^(?:\d+[.)]|[-*•])\s*/, "").split(/\s*\|\s*/)
    if (parts.length < 3) continue
    const urlIndex = parts.findIndex((p, i) => i > 0 && /https?:\/\//i.test(p))
    const url = urlIndex >= 0 ? (/https?:\/\/[^\s)\]]+/i.exec(parts[urlIndex])?.[0] ?? "").replace(/[.,;]+$/, "") : ""
    // The labeled parts ("place: …", "trending: 85") come off; the rest is the headline, date, summary and hook.
    const { rest, tags } = storyTags(parts.filter((_, i) => i !== urlIndex))
    // The kind at the end without its label ("| Event"), when the search looked for kinds.
    const bare = !tags.look && rest.length >= 4 ? lookOfKind(rest[rest.length - 1]) : null
    if (bare) rest.pop()
    const look = tags.look ?? bare
    const title = cleanSlideText(rest[0] ?? "", 200)
    if (!title || stories.some((s) => similarHeadline(s.title, title))) continue
    const site = hostOf(url)
    // The source's own date beats the one the AI wrote (the publication day, not the search day).
    const source = url ? found.find((s) => samePage(s.url, url)) : undefined
    const written = (rest[1] ?? "").trim().slice(0, 40)
    const dateText = source?.date && /^\d{4}-\d{2}-\d{2}$/.test(source.date) ? source.date : written
    const kind: SourceKind = source?.kind ?? (isFacebookLink(url) ? "facebook" : "news")
    stories.push({
      title,
      dateText,
      date: storyDate(dateText),
      url,
      site,
      verified: !!url && found.some((s) => samePage(s.url, url) || (site !== "" && !isFacebookLink(url) && hostOf(s.url) === site)),
      summary: cleanSlideText(rest[2] ?? "", 700),
      why: cleanSlideText(rest.slice(3).join(" | "), 160),
      kind,
      ...(source?.image ? { image: source.image } : {}),
      ...(source?.from ? { from: source.from } : {}),
      ...(look ? { look } : {}),
      ...(tags.where ? { where: tags.where } : {}),
      ...(tags.sourceName ? { sourceName: tags.sourceName } : {}),
      ...(tags.eventDate ? { eventDate: tags.eventDate } : {}),
      ...(tags.trending ? { trending: tags.trending } : {}),
      ...(tags.timing ? { timing: tags.timing } : {}),
    })
  }
  return stories.slice(0, 8)
}

/** Whole days between the story's date and `day` (0 = the same day; negative = after it). null without a date. */
export function storyAgeDays(story: Pick<TrendStory, "date">, day: Date): number | null {
  if (!story.date) return null
  const a = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  return Math.round((a - story.date.getTime()) / 86_400_000)
}

/** Words that mean bad news: such a story is flagged (the AI is told to skip them, this double-checks). */
const BAD =
  /\b(die[sd]?|death|dead|deaths|kill(?:s|ed|ing)?|murder|crash(?:es|ed)?|accident|injur(?:y|ies|ed)|fire|blaze|flood(?:s|ing|ed)?|typhoon|earthquake|scam|fraud|arrest(?:ed)?|charged|lawsuit|sue[sd]?|collapse[sd]?|crisis|recession|layoffs?|bankrupt(?:cy)?|protest|scandal|controvers(?:y|ial)|dispute|war|attack)\b/i

/**
 * Words that are bad news in a positive-only search, but fine in helpful information ("Look for" →
 * Helpful info): a price drop for buyers, a road closure for a festival, an advisory.
 */
const SOFT = /\b(ban(?:s|ned)?|slump(?:s|ed)?|plunge[sd]?|closure|shut(?:s|down)?|warning|loss(?:es)?|decline[sd]?|drop(?:s|ped)?|fall(?:s|ing)?)\b/i

/**
 * Not bad news, though it has such a word: a flood control project, a fire station, a waterfall
 * ("Tinuy-an Falls", but not "Prices Falls").
 */
const NOT_BAD = /flood[- ]?(?:control|way|gate)s?|fire (?:station|truck|safety|prevention|protection|department|volunteer|exit)s?/gi
const WATERFALL =
  /\b(?!(?:Prices?|Rents?|Sales|Markets?|Rates?|Stocks?|Values?|Demand|Supply|Index|Profits?|Revenues?|Income|Inflation|Output|Arrivals|Numbers?|Shares?)\s)\p{Lu}[\p{L}'’-]*\s+Falls\b/gu

/** The words that make a story look negative ("" when it looks fine). `helpful`: useful information is wanted too. */
export function negativeIn(text: string, helpful = false): string {
  const t = text.replace(NOT_BAD, " ").replace(WATERFALL, " ")
  return BAD.exec(t)?.[0] ?? (helpful ? "" : (SOFT.exec(t)?.[0] ?? ""))
}

const HEAD_STOP = new Set("the a an of in on at to for and with from by is are its it as new news ph philippines philippine dubai uae".split(" "))
const headWords = (t: string) =>
  new Set(
    t
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[’']s\b/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !HEAD_STOP.has(w)),
  )

/** The same story: most of their meaningful words in common (at least 3, half of the shorter headline). */
export function similarHeadline(a: string, b: string): boolean {
  const x = headWords(a)
  const y = headWords(b)
  if (!x.size || !y.size) return false
  const shared = [...x].filter((w) => y.has(w)).length
  return shared >= 3 && shared / Math.min(x.size, y.size) >= 0.5
}

/** The newest day the search may look at: the poster's day, or today when the poster is for a later day. */
export function newsAnchor(day: Date, today = new Date()): Date {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return day.getTime() > t.getTime() ? t : new Date(day.getFullYear(), day.getMonth(), day.getDate())
}

/** When the full article can't be read: the story as the AI found it, to write the poster from. */
export function trendStoryText(story: TrendStory): string {
  const source = story.kind === "page" ? `Facebook post by ${story.from || "the Page"}` : story.kind === "facebook" ? `Facebook post (${story.url})` : story.site && `Source: ${story.sourceName ? `${story.sourceName} (${story.site})` : story.site}`
  const facts = [source, story.dateText && `Published: ${story.dateText}`, story.where && `Place: ${story.where}`, story.eventDate && `Event date: ${story.eventDate}`]
  return [story.title, facts.filter(Boolean).join(" · "), "", story.summary].join("\n").trim()
}

// ---------- Checks shown on each story: keywords, place, source, relevance ----------

const KEYWORD_STOP = new Set("the a an of in on at to for and with news ph".split(" "))
const words = (t: string) =>
  t
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !KEYWORD_STOP.has(w))

/** The keywords a story is about: every word of the keyword is in its title or summary (at most `max`). */
export function keywordsIn(text: string, keywords: readonly string[], max = 4): string[] {
  const have = new Set(words(text))
  const found: string[] = []
  for (const k of keywords) {
    const need = words(k)
    if (need.length && need.every((w) => have.has(w) || (w.length > 3 && have.has(`${w}s`)) || (w.endsWith("s") && have.has(w.slice(0, -1))))) found.push(k)
    if (found.length >= max) break
  }
  return found
}

/** Each brand's places, the most specific first: the one a story names is shown on it. */
const PLACES: Record<TrendBrand, readonly string[]> = {
  pickleplay: [
    "Metro Manila", "Quezon City", "Makati", "Taguig", "BGC", "Pasig", "Mandaluyong", "Parañaque", "Pasay", "Alabang", "Muntinlupa", "Manila",
    "Cebu City", "Mandaue", "Lapu-Lapu", "Cebu", "Davao City", "Davao", "Iloilo", "Bacolod", "Cagayan de Oro", "Baguio", "Clark", "Pampanga",
    "Laguna", "Cavite", "Batangas", "Tagaytay", "Boracay", "Palawan", "Zamboanga", "General Santos", "Butuan", "Dumaguete", "Tacloban", "Philippines",
  ],
  fhi: [
    "Dubai South", "Dubai Studio City", "Dubai Marina", "Downtown Dubai", "Business Bay", "Palm Jumeirah", "Jumeirah Village Circle", "Dubai Hills",
    "Dubai Creek Harbour", "Expo City", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Umm Al Quwain", "Fujairah", "Dubai", "UAE",
  ],
  homes: CARAGA_NAMES,
  // General Santos City only (1.47).
  gensan: GENSAN_NAMES,
}

/** The place a story names (the brand's places, or the Homes.ph page's; "" when none). */
export function placeIn(text: string, brand: TrendBrand, page?: HomesPlace | null): string {
  for (const place of page?.names ?? PLACES[brand]) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("'", "['’]?")}(?![\\p{L}\\p{N}])`, "iu")
    if (re.test(text)) return place
  }
  return ""
}

/** News sites the team trusts (national and regional outlets, wire services); government sites count as official. */
const TRUSTED_SITES = [
  "inquirer.net", "philstar.com", "mb.com.ph", "manilatimes.net", "gmanetwork.com", "abs-cbn.com", "rappler.com", "sunstar.com.ph", "mindanaotimes.com.ph",
  "mindanews.com", "bworldonline.com", "businessmirror.com.ph", "manilastandard.net", "tribune.net.ph", "onenews.ph", "spin.ph", "tiebreakertimes.com.ph",
  "edgedavao.net", "brigadanews.ph", "bomboradyo.com", "gulfnews.com", "khaleejtimes.com", "thenationalnews.com", "arabianbusiness.com", "zawya.com",
  "gulfbusiness.com", "wam.ae", "reuters.com", "apnews.com", "bloomberg.com", "cnbc.com", "espn.com", "usapickleball.org", "ppatour.com", "pickleball.com",
]

/** What's known about the story's source, shown on it. */
export type SourceCheck = "official" | "trusted" | "found" | "page" | "post" | "unconfirmed"

export function sourceCheck(story: Pick<TrendStory, "kind" | "verified" | "site" | "url">): SourceCheck {
  if (story.kind === "page") return "page"
  if (story.kind === "facebook") return "post"
  if (!story.verified) return "unconfirmed"
  const site = story.site.toLowerCase()
  if (/\.gov(\.[a-z]{2})?$|\.gov\.ph$|\.gov\.ae$/.test(site)) return "official"
  if (TRUSTED_SITES.some((d) => site === d || site.endsWith(`.${d}`))) return "trusted"
  return "found"
}

export const SOURCE_CHECK_TEXT: Record<SourceCheck, string> = {
  official: "Official site",
  trusted: "Trusted news site",
  found: "Found in the search",
  page: "From the Facebook Page itself",
  post: "Facebook post: check it's the official Page",
  unconfirmed: "Source not confirmed",
}

/**
 * How well a story fits the brand's day, 0–100: new, on the keywords and the place, a partner
 * developer, a trusted source; less for an undated post, much less when it sounds negative or was posted.
 */
export function relevanceScore(r: {
  age: number | null
  days: number
  check: SourceCheck
  partner: boolean
  keywords: number
  place: boolean
  negative: boolean
  repeat: boolean
  trending: boolean
  /** One of the "Look for" kinds (an opening, an event…): counts like two keywords. */
  look?: boolean
  /** The AI's trending rate, 1–100 (none: it doesn't count). */
  hot?: number
}): number {
  let score = 30
  if (r.check === "official" || r.check === "trusted" || r.check === "page") score += 14
  else if (r.check === "found") score += 8
  else if (r.check === "post") score += 2
  if (r.partner) score += 18
  score += Math.min(3, r.keywords + (r.look ? 2 : 0)) * 6
  if (r.place) score += 8
  const fresh = r.age !== null && r.age >= -1 && r.age < r.days
  if (fresh) score += r.age !== null && r.age <= 0 ? 14 : r.age === 1 ? 11 : 8
  else score -= r.age === null ? 6 : 18
  if (r.trending) score += 2
  // The AI's own rating moves it a little: a hot story up to 4 more, a weak one up to 4 less.
  if (r.hot) score += Math.round((Math.max(1, Math.min(100, r.hot)) - 50) / 12.5)
  if (r.negative) score -= 35
  if (r.repeat) score -= 40
  return Math.max(0, Math.min(100, Math.round(score)))
}

// ---------- Write article ----------

/** Trending news → Write article: one story as ready-to-post content. */
export interface NewsArticleDraft {
  headline: string
  short: string
  detailed: string
  caption: string
  hashtags: string[]
  carousel: { title: string; text: string }[]
  imagePrompt: string
  /** Facts the story states. */
  facts: string[]
  /** The AI's own reading, kept apart from the facts. */
  notes: string[]
}

const ARTICLE_LABELS = /^(HEADLINE|SHORT ARTICLE|DETAILED ARTICLE|CAPTION|HASHTAGS|CAROUSEL|IMAGE PROMPT|CONFIRMED FACTS|AI NOTES)\s*:\s*(.*)$/i

/** The AI's labeled answer → the article's parts (null when it has none of the writing). */
export function parseNewsArticle(text: string): NewsArticleDraft | null {
  const parts: Record<string, string[]> = {}
  let label = ""
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\*\*|__/g, "").trimEnd()
    const m = ARTICLE_LABELS.exec(line.trim())
    if (m) {
      label = m[1].toUpperCase()
      parts[label] = m[2].trim() ? [m[2].trim()] : []
      continue
    }
    if (label) parts[label].push(line)
  }
  const block = (name: string) => (parts[name] ?? []).join("\n").replace(/\n{3,}/g, "\n\n").trim()
  const items = (name: string) =>
    (parts[name] ?? [])
      .map((l) => l.trim().replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
  const headline = block("HEADLINE").split("\n")[0].replace(/^["“]+|["”]+$/g, "").trim()
  let caption = block("CAPTION")
  let hashtags = block("HASHTAGS").match(/#[\p{L}\p{N}_]+/gu) ?? []
  if (!hashtags.length) {
    // Hashtags written at the end of the caption instead.
    hashtags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? []
  }
  caption = caption.replace(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim()
  const carousel = items("CAROUSEL").flatMap((l) => {
    const [title, ...rest] = l.split(/\s*\|\s*/)
    return title ? [{ title: title.trim(), text: rest.join(" | ").trim() }] : []
  })
  const draft: NewsArticleDraft = {
    headline,
    short: block("SHORT ARTICLE"),
    detailed: block("DETAILED ARTICLE"),
    caption,
    hashtags: [...new Set(hashtags)].slice(0, 10),
    carousel: carousel.slice(0, 8),
    imagePrompt: block("IMAGE PROMPT").replace(/\s+/g, " "),
    facts: items("CONFIRMED FACTS").slice(0, 12),
    notes: items("AI NOTES").slice(0, 8),
  }
  return draft.headline || draft.short || draft.detailed ? draft : null
}
