import { newsTimesFor, type DailyBrand } from "@/lib/design/news-templates"
import { AD_KINDS, type AdContent, type AdKind } from "./render"

/**
 * When to post an advertisement: never closer than 1 hour to the brand's News Article postings or
 * to its other advertisements that day (60 minutes apart is fine). Poster Maker trend posters close
 * by only give a warning. Recommended times are on the half hour from 7:00 AM to 11:30 PM, spread
 * over the day, preferring 10 AM – 9 PM. Pure functions (no dates, no storage): unit tested.
 */

/** The Advertisement page's brands. */
export type AdBrand = "pickleplay" | "fhi" | "homes" | "gensan"
export const AD_BRAND_IDS: readonly AdBrand[] = ["pickleplay", "fhi", "homes", "gensan"]
export const isAdBrand = (v: unknown): v is AdBrand => typeof v === "string" && (AD_BRAND_IDS as readonly string[]).includes(v)

/** Whose News Article times an ad keeps clear of: Homes.ph ads go on the Homes.ph CARAGA page. */
export const AD_NEWS_BRAND: Record<AdBrand, DailyBrand> = { pickleplay: "pickleplay", fhi: "fhi", homes: "caraga", gensan: "gensan" }

/** The brand in messages ("the 3:00 PM PicklePlay article") and file names. */
export const AD_BRAND_NAME: Record<AdBrand, string> = { pickleplay: "PicklePlay", fhi: "FHI Global", homes: "Homes.ph CARAGA", gensan: "Homes.ph Gensan" }

/** Minutes an ad keeps from an article, another ad or (a warning only) a trend poster. */
export const AD_GAP = 60
const SLOT_STEP = 30
const FIRST_SLOT = 7 * 60
const LAST_SLOT = 23 * 60 + 30
/** Recommended first: 10:00 AM – 9:00 PM. */
const PREFERRED: [number, number] = [10 * 60, 21 * 60]
/** Recommended times are at least this far apart (spread over the day) while there are enough. */
const SPREAD = 120

/** "13:30" → 810 (null when it isn't a time). */
export function toMinutes(time: string | null | undefined): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time ?? "").trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** 810 → "13:30" */
export function fromMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** "13:00" → "1:00 PM" */
export function adTimeLabel(time: string): string {
  const m = toMinutes(time)
  if (m == null) return time
  const h = Math.floor(m / 60)
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

/** What else is on the brand's day. */
export interface AdTimeContext {
  brand: AdBrand
  /** The brand's other ads that day (not the one being edited): "13:00", "Trivia". */
  ads?: { time: string; label: string }[]
  /** The brand's Poster Maker trend posters that day (only a warning). */
  posters?: { time: string; label?: string }[]
  /**
   * Minutes since midnight now when the day is today (that time and earlier have passed), 1440 for a
   * day that has passed, null or left out for a day ahead.
   */
  now?: number | null
}

interface Taken {
  at: number
  /** "3:00 PM PicklePlay article" */
  what: string
}

function blockers(ctx: AdTimeContext): Taken[] {
  const name = AD_BRAND_NAME[ctx.brand]
  const articles = newsTimesFor(AD_NEWS_BRAND[ctx.brand]).map((t) => ({ at: toMinutes(t.time)!, what: `${adTimeLabel(t.time)} ${name} article` }))
  const ads = (ctx.ads ?? []).flatMap((a) => {
    const at = toMinutes(a.time)
    return at == null ? [] : [{ at, what: `${adTimeLabel(a.time)} ${a.label} ad`.replace(/\s+/g, " ") }]
  })
  return [...articles, ...ads]
}

function posterTimes(ctx: AdTimeContext): Taken[] {
  const name = AD_BRAND_NAME[ctx.brand]
  return (ctx.posters ?? []).flatMap((p) => {
    const at = toMinutes(p.time)
    return at == null ? [] : [{ at, what: `${adTimeLabel(p.time)} ${p.label?.trim() || `${name} trend poster`}` }]
  })
}

/** The closest of `list` less than an hour from `at`. */
function tooClose(list: Taken[], at: number): Taken | null {
  let best: Taken | null = null
  for (const t of list) if (Math.abs(t.at - at) < AD_GAP && (!best || Math.abs(t.at - at) < Math.abs(best.at - at))) best = t
  return best
}

export interface AdTimeProblem {
  reason: "invalid" | "past" | "article" | "ad"
  message: string
}

/** Why the ad can't go at `time` ("13:30"), or null when it can. */
export function adTimeProblem(time: string, ctx: AdTimeContext): AdTimeProblem | null {
  const at = toMinutes(time)
  if (at == null) return { reason: "invalid", message: "Pick a time." }
  if (ctx.now != null && at <= ctx.now) return { reason: "past", message: ctx.now >= 1440 ? "That day has passed: pick today or a day ahead" : `${adTimeLabel(time)} has already passed today` }
  const near = tooClose(blockers(ctx), at)
  if (!near) return null
  return { reason: near.what.endsWith(" article") ? "article" : "ad", message: `Too close to the ${near.what}: keep 1 hour apart` }
}

/** A trend poster less than an hour away (posting is still allowed), or null. */
export function adTimeWarning(time: string, ctx: AdTimeContext): string | null {
  const at = toMinutes(time)
  if (at == null) return null
  const near = tooClose(posterTimes(ctx), at)
  return near ? `Close to the ${near.what} (Poster Maker): best to keep 1 hour apart` : null
}

/**
 * The best times for the ad, best first (up to `count`): on the half hour from 7:00 AM to 11:30 PM,
 * never too close to an article or another ad, nor in the past; away from trend posters, between
 * 10 AM and 9 PM and farthest from everything else first, spread over the day.
 */
export function recommendAdTimes(ctx: AdTimeContext, count = 4): string[] {
  const taken = [...blockers(ctx), ...posterTimes(ctx)]
  const scored: { at: number; clear: boolean; preferred: boolean; room: number }[] = []
  for (let at = FIRST_SLOT; at <= LAST_SLOT; at += SLOT_STEP) {
    const time = fromMinutes(at)
    if (adTimeProblem(time, ctx)) continue
    scored.push({
      at,
      clear: !adTimeWarning(time, ctx),
      preferred: at >= PREFERRED[0] && at <= PREFERRED[1],
      room: taken.reduce((min, t) => Math.min(min, Math.abs(t.at - at)), 1440),
    })
  }
  scored.sort((a, b) => Number(b.clear) - Number(a.clear) || Number(b.preferred) - Number(a.preferred) || b.room - a.room || a.at - b.at)
  const picked: typeof scored = []
  for (const s of scored) if (picked.length < count && picked.every((p) => Math.abs(p.at - s.at) >= SPREAD)) picked.push(s)
  for (const s of scored) if (picked.length < count && !picked.includes(s)) picked.push(s)
  return picked.map((s) => fromMinutes(s.at))
}

/** The OK time nearest to `time` (5-minute steps; the earlier one on a tie), or null when the day is full. */
export function nearestAdTime(time: string, ctx: AdTimeContext): string | null {
  const at = toMinutes(time) ?? 12 * 60
  for (let d = 0; d < 1440; d += 5) {
    for (const m of d ? [at - d, at + d] : [at]) {
      if (m < 0 || m >= 1440) continue
      const t = fromMinutes(m)
      if (!adTimeProblem(t, ctx)) return t
    }
  }
  return null
}

// ---------- names ----------

/** "History", "Trivia", "Fun Facts", "Court Owners", "Coming Soon", "Now Open" */
export function adKindLabel(kind: AdKind): string {
  return AD_KINDS.find((k) => k.id === kind)?.short ?? kind
}

const plain = (text: string | null | undefined) => (text ?? "").replace(/[[\]{}]/g, "").replace(/\s+/g, " ").trim()

/** The ad's main words on one line, for lists and reports. */
export function adTitle(content: AdContent): string {
  const c = content
  const words =
    c.kind === "history"
      ? c.headline || [c.focus, c.shortHeadline].join(" ")
      : c.kind === "trivia"
        ? c.question || c.longQuestion || c.shortQuestion
        : c.kind === "funfact"
          ? [c.lead, c.big, c.word].join(" ")
          : c.kind === "courtowner"
            ? [c.headline, c.highlight].join(" ")
            : [plain(c.courtName) || "Court", plain([c.barangay, c.city].map(plain).filter(Boolean).join(", "))].filter(Boolean).join(" · ")
  return plain(words).slice(0, 160) || adKindLabel(c.kind)
}

/** "2026-11-12 1-00 PM PicklePlay History.png" (no ":" in Windows file names). */
export function adImageName(ad: { day: string; time: string; brand: AdBrand; kind: AdKind }): string {
  return `${ad.day} ${adTimeLabel(ad.time).replace(":", "-")} ${AD_BRAND_NAME[ad.brand]} ${adKindLabel(ad.kind)}.png`.replace(/[\\/:*?"<>|]/g, "")
}
