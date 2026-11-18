import { cleanSlideText } from "./carousel-draft"
import type { AiSource } from "./types"

/**
 * Create New Carousel → search a topic: the places Groq's web search found (each with its source,
 * checked against the pages it really opened), the topic ideas, and the checks that keep the team
 * from repeating a topic or a place that an earlier carousel already featured.
 */

export interface ResearchItem {
  name: string
  location: string
  facts: string
  /** The page the facts came from ("" when the AI gave none). */
  url: string
  /** "spot.ph" */
  site: string
  /** The source is one of the pages the search really found or opened. */
  verified: boolean
}

export interface ResearchResult {
  topic: string
  items: ResearchItem[]
  /** The pages the search found and opened. */
  sources: AiSource[]
}

export interface TopicIdea {
  topic: string
  why: string
}

const LABELS = ["TOPIC", "ITEMS", "SOURCES"]
const labelOf = (line: string) => LABELS.find((label) => new RegExp(`^${label}\\s*:`, "i").test(line))

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

/** Same page, ignoring http/https, www, a trailing slash and the query. */
function samePage(a: string, b: string) {
  const norm = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "")
  return norm(a) === norm(b)
}

/**
 * The AI's research (TOPIC / ITEMS / SOURCES) with the pages the search really used. An item's
 * source counts as verified when it's one of those pages (or the same site, when the AI shortened
 * the address). Repeats are left out.
 */
export function parseResearch(text: string, found: AiSource[]): ResearchResult {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/【[^】]*】/g, "").replace(/\*\*|__/g, "").trim())
    .filter(Boolean)
  const topicLine = lines.find((l) => labelOf(l) === "TOPIC")
  const items: ResearchItem[] = []
  const from = lines.findIndex((l) => labelOf(l) === "ITEMS")
  for (const line of from >= 0 ? lines.slice(from + 1) : lines) {
    if (labelOf(line)) break
    if (!/^\s*(\d+[.)]|[-*•])\s*/.test(line)) continue
    const parts = line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").split(/\s*\|\s*/)
    if (parts.length < 2) continue
    const urlPart = parts.find((p, i) => i > 0 && /https?:\/\//i.test(p)) ?? ""
    const url = (/https?:\/\/[^\s)\]]+/i.exec(urlPart)?.[0] ?? "").replace(/[.,;]+$/, "")
    const rest = parts.filter((p) => p !== urlPart)
    const name = cleanSlideText(rest[0] ?? "", 80)
    if (!name || items.some((it) => sameName(it.name, name))) continue
    const site = hostOf(url)
    const verified = !!url && found.some((s) => samePage(s.url, url) || (site !== "" && hostOf(s.url) === site))
    items.push({ name, location: cleanSlideText(rest[1] ?? "", 80), facts: cleanSlideText(rest.slice(2).join(" | "), 400), url, site, verified })
  }
  return { topic: cleanSlideText(topicLine ? topicLine.slice(topicLine.indexOf(":") + 1) : "", 120), items, sources: [...found] }
}

/**
 * The picked places as the article the carousel is written from: only these facts, each with its
 * source, so the cover, cards and caption stay true to them.
 */
export function researchNotes(topic: string, items: ResearchItem[]): string {
  const lines = items.map((it, i) => `${i + 1}. ${it.name}${it.location ? `, ${it.location}` : ""}. ${it.facts}${it.site ? ` (Source: ${it.site})` : ""}`)
  return `${topic}\n\nPlaces found on the web for this topic (use only these facts, in this order):\n\n${lines.join("\n\n")}`
}

/** "1. Topic | why" lines. */
export function parseTopicIdeas(text: string): TopicIdea[] {
  const ideas: TopicIdea[] = []
  for (const line of text.split(/\n/)) {
    const m = /^\s*(?:\d+[.)]|[-*•])\s*(.+)$/.exec(line.replace(/\*\*|__/g, ""))
    if (!m) continue
    const [topic = "", why = ""] = m[1].split(/\s*\|\s*/)
    const t = cleanSlideText(topic, 140)
    if (t.length >= 8 && !ideas.some((i) => i.topic.toLowerCase() === t.toLowerCase())) ideas.push({ topic: t, why: cleanSlideText(why, 120) })
  }
  return ideas.slice(0, 8)
}

// ---------- repeats: topics and places featured before ----------

export interface PastTopic {
  /** Headline 1 + Headline 2. */
  title: string
  /** The cover subtitle ("6 Philippine Lighthouses With Views Worth The Journey"). */
  subtitle: string
  /** ISO day it was posted (or scheduled). */
  date: string | null
}

export interface PastPlace {
  name: string
  carousel: string
  date: string | null
}

export interface CarouselHistory {
  topics: PastTopic[]
  places: PastPlace[]
}

/**
 * What earlier carousels featured: their titles and cover subtitles, and every card title (the
 * places). From the projects and their slides' saved titles.
 */
export function buildHistory(
  projects: { id: string; title: string; scheduled_at: string | null }[],
  slides: { project_id: string; slide_order: number; title: string | null; description: string | null }[],
): CarouselHistory {
  const topics: PastTopic[] = []
  const places: PastPlace[] = []
  for (const p of projects) {
    const own = slides.filter((s) => s.project_id === p.id).sort((a, b) => a.slide_order - b.slide_order)
    const cover = own.find((s) => s.slide_order === 0)
    topics.push({ title: p.title, subtitle: cover?.description?.trim() ?? "", date: p.scheduled_at })
    for (const card of own.filter((s) => s.slide_order > 0)) {
      const name = card.title?.replace(/\s+/g, " ").trim()
      if (name && !/^card title$/i.test(name)) places.push({ name, carousel: p.title, date: p.scheduled_at })
    }
  }
  return { topics, places }
}

const STOP = new Set(
  "a an and the of in on at to for with from by your our their this that these those top best must try visit where what why how you we is are be it its near new most more than up worth around philippines philippine ph pinoy filipino city cities edition list guide places spots things".split(
    " ",
  ),
)
/** Words that mean the same kind of thing for spotting a repeated topic. */
const SAME: Record<string, string> = {
  restaurant: "food", restaurants: "food", food: "food", foods: "food", eats: "food", eat: "food", dining: "food", cuisine: "food", dishes: "food", dish: "food", cafe: "cafe", cafes: "cafe", coffee: "cafe",
  resort: "stay", resorts: "stay", hotel: "stay", hotels: "stay", stays: "stay", stay: "stay", staycation: "stay", staycations: "stay",
  beach: "beach", beaches: "beach", island: "island", islands: "island",
  church: "church", churches: "church", lighthouse: "lighthouse", lighthouses: "lighthouse", tree: "tree", trees: "tree",
  christmas: "christmas", holiday: "holiday", holidays: "holiday", festival: "festival", festivals: "festival", fiesta: "festival",
  condo: "condo", condos: "condo", condominium: "condo", condominiums: "condo", home: "home", homes: "home", house: "home", houses: "home",
}

function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // "Cebu's" → "cebu", "Rico’s" → "rico".
    .replace(/[’']s\b/g, "")
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !/^\d+$/.test(w))
}

/** The topic's meaningful words (synonyms merged). */
export function topicWords(text: string): Set<string> {
  return new Set(
    words(text)
      .filter((w) => !STOP.has(w))
      .map((w) => SAME[w] ?? w),
  )
}

/** Kinds of places and things a carousel lists ("food", "stay", "lighthouse"…). */
const THEMES = new Set(Object.values(SAME))
/** Areas of the Philippines: the same theme somewhere else isn't a repeat. */
const AREAS = new Set(
  "luzon visayas mindanao manila metro ncr quezon makati taguig bgc pasig mandaluyong paranaque pasay alabang ortigas cebu mactan lapu bohol panglao davao palawan coron puerto princesa el nido boracay aklan iloilo bacolod negros dumaguete siquijor camiguin siargao surigao caraga butuan agusan cagayan cdo oro gensan santos zamboanga leyte samar tacloban bicol albay legazpi naga camarines sorsogon baguio benguet ilocos vigan laoag pangasinan zambales subic clark pampanga tarlac bulacan nueva ecija bataan cavite tagaytay laguna batangas rizal antipolo quezon mindoro romblon marinduque batanes sagada banaue ifugao abra la union".split(
    " ",
  ),
)

/**
 * An earlier carousel this topic is close to, or null: the same theme in the same area (or neither
 * names an area), or most of their meaningful words in common.
 */
export function similarTopic(topic: string, past: PastTopic[]): PastTopic | null {
  const a = topicWords(topic)
  if (!a.size) return null
  const areasA = [...a].filter((w) => AREAS.has(w))
  let best: { t: PastTopic; score: number } | null = null
  for (const t of past) {
    const b = topicWords(`${t.title} ${t.subtitle}`)
    if (!b.size) continue
    const shared = [...a].filter((w) => b.has(w))
    const areasB = [...b].filter((w) => AREAS.has(w))
    const sameArea = areasA.length && areasB.length ? areasA.some((w) => areasB.includes(w)) : !areasA.length && !areasB.length
    const sameTheme = shared.some((w) => THEMES.has(w))
    const score = shared.length / Math.min(a.size, b.size)
    const similar = (sameTheme && sameArea) || (shared.length >= 2 && score >= 0.6 && sameArea)
    if (similar && (!best || score > best.score)) best = { t, score }
  }
  return best?.t ?? null
}

/** The island group of well-known provinces, cities and islands (longest names first when matching). */
const REGION_OF: Record<string, "Luzon" | "Visayas" | "Mindanao"> = {}
for (const [region, list] of [
  ["Luzon", "metro manila,manila,quezon city,makati,taguig,bgc,pasig,mandaluyong,paranaque,pasay,alabang,ortigas,baguio,benguet,ilocos norte,ilocos sur,ilocos,vigan,laoag,pagudpud,pangasinan,zambales,subic,clark,pampanga,tarlac,bulacan,bataan,cavite,tagaytay,laguna,batangas,anilao,rizal,antipolo,bicol,albay,legazpi,naga,camarines sur,camarines norte,sorsogon,donsol,catanduanes,palawan,coron,el nido,puerto princesa,san vicente,pamalican,mindoro,puerto galera,romblon,marinduque,batanes,sagada,banaue,ifugao,la union,aurora,baler,nueva ecija,isabela"],
  ["Visayas", "cebu,mactan,lapu-lapu,moalboal,oslob,bantayan,malapascua,bohol,panglao,iloilo,guimaras,bacolod,negros occidental,negros oriental,negros,dumaguete,siquijor,boracay,aklan,antique,capiz,leyte,tacloban,samar,biliran,kalanggaman"],
  ["Mindanao", "davao,samal,siargao,surigao,camiguin,zamboanga,cagayan de oro,cdo,bukidnon,gensan,general santos,cotabato,butuan,agusan,caraga,dinagat,lanao,misamis,iligan,sarangani,sultan kudarat,tawi-tawi,sulu,basilan,dapitan"],
] as const) {
  for (const name of list.split(",")) REGION_OF[name] = region
}
const REGION_NAMES = Object.keys(REGION_OF).sort((a, b) => b.length - a.length)

/**
 * A location that looks wrong: a place put in the wrong island group ("Visayas" for Davao), or one
 * that mixes places of different groups ("Panglao Island, Palawan"). null when it looks fine.
 */
export function locationIssue(location: string): string | null {
  let text = ` ${location.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9-]+/g, " ")} `
  const group = /^\s*(luzon|visayas|mindanao)\b/.exec(text)?.[1]
  const original = text
  const found: { name: string; region: string; at: number }[] = []
  for (const name of REGION_NAMES) {
    if (!text.includes(` ${name} `)) continue
    found.push({ name, region: REGION_OF[name], at: original.indexOf(` ${name} `) })
    // "cagayan de oro" is matched once (not "oro" or "de" again).
    text = text.replace(` ${name} `, " ")
  }
  found.sort((a, b) => a.at - b.at)
  const title = (w: string) => w.replace(/\b\w/g, (c) => c.toUpperCase())
  if (group) {
    const wrong = found.find((f) => f.region.toLowerCase() !== group)
    if (wrong) return `${title(wrong.name)} is in ${wrong.region}, not ${title(group)}`
    return null
  }
  const regions = [...new Set(found.map((f) => f.region))]
  return regions.length > 1 ? `The location mixes ${found.map((f) => title(f.name)).join(" and ")} (different regions)` : null
}

/** Generic words in a place's name ("restaurant", "the"): names match on what's left. */
const NAME_STOP = new Set("the a an of and at in restaurant restaurants resort hotel".split(" "))
const nameWords = (name: string) => words(name).filter((w) => !NAME_STOP.has(w))

/** Same place: the same name, or one name inside the other with at least 2 meaningful words ("Cape Bojeador" / "Cape Bojeador Lighthouse"). */
export function sameName(a: string, b: string): boolean {
  const x = nameWords(a)
  const y = nameWords(b)
  if (!x.length || !y.length) return false
  if (x.join(" ") === y.join(" ")) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length >= 2 && long.join(" ").includes(short.join(" "))
}

/** The earlier carousel that already featured this place, or null. */
export function featuredBefore(name: string, places: PastPlace[]): PastPlace | null {
  return places.find((p) => sameName(p.name, name)) ?? null
}
