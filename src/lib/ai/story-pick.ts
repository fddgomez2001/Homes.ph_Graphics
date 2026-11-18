import type { HomesPlace } from "./homes-places"
import { placeIn, storyAgeDays, storyDate, type SourceCheck, type TrendStory } from "./trend-news"
import type { TrendBrand } from "./types"

/**
 * Poster Maker → Trending news → the story picker (the team's brief): of the stories a search found,
 * the BEST one for the page's poster and up to 3 backups. Each story is first rejected or kept
 * (step 1), its source ranked in tiers (step 2), scored 0–100 (step 3), and close scores settled by
 * the team's tie-breakers (step 4). Worked out here from what each story says and where it's from:
 * nothing is asked of the AI again, so it's instant, costs nothing and never changes a fact.
 */

/** A story with the panel's checks (see `checkStory`). */
export interface PickCandidate {
  story: TrendStory
  /** Days between its publication and the newest day searched (null: no date). */
  age: number | null
  fresh: boolean
  negative: string
  /** The headline already posted that it repeats ("" when new). */
  repeat: string
  /** The partner developer it names. */
  partner: string
  /** The keywords it's about. */
  matched: string[]
  /** The place it names. */
  place: string
  check: SourceCheck
  /** In the page's area (it names one of its places), elsewhere (only other places), or neither (1.47). */
  area?: "inside" | "outside" | "none"
  /** The other place it names, when it's elsewhere. */
  elsewhere?: string
}

export interface PickContext {
  brand: TrendBrand
  /** The poster's day. */
  day: Date
  /** The Homes.ph page's place (none for other brands and Homes.ph CARAGA). */
  page?: HomesPlace | null
  /** Headlines posted lately, the newest first (for the places covered). */
  posted?: readonly string[]
}

export type SourceTier = 1 | 2 | 3

/** Official offices, as a Page or a source names itself (Tier 1 when the story is theirs). */
const OFFICIAL =
  /\b(PIA|PNA|DTI|DOST|DPWH|DHSUD|DOT|DOLE|TESDA|NEDA|DepDev|DILG|LGU|Pag-?IBIG|Philippine Information Agency|Philippine News Agency|city government|provincial government|municipal government|municipality of|province of|city of|local government|tourism office|city information|public information office|Dubai Land Department|Dubai Media Office|Government of Dubai|RERA|Philippine Pickleball Federation|Pickleball Federation)\b/i

const OFFICIAL_SITES = ["pia.gov.ph", "pna.gov.ph", "dubailand.gov.ae", "mediaoffice.ae", "wam.ae"]

/**
 * How far a story's source can be trusted. 1: government and official offices (their sites and
 * Pages) and a partner developer's own Page. 2: established news outlets and the Pages the team
 * reads itself. 3: other sites and Facebook posts (local community news, radio): only picked when
 * no Tier 1 or 2 story qualifies.
 */
export function sourceTier(c: Pick<PickCandidate, "story" | "check" | "partner">): SourceTier {
  const { story } = c
  const site = story.site.toLowerCase()
  const name = `${story.sourceName ?? ""} ${story.from ?? ""}`
  if (c.check === "official" || OFFICIAL_SITES.some((d) => site === d || site.endsWith(`.${d}`))) return 1
  if (story.kind !== "news") {
    if (OFFICIAL.test(name)) return 1
    // A partner developer's news on its own Page ("Camella Caraga").
    if (c.partner && name.toLowerCase().includes(c.partner.split(/\s+/)[0].toLowerCase())) return 1
    return story.kind === "page" ? 2 : 3
  }
  if (c.check === "trusted") return 2
  return 3
}

/** Election and partisan content: candidates, campaigns, party announcements. */
const PARTISAN =
  /\b(elections?|electoral|candidates?|candidacy|campaign rally|campaign sortie|proclamation rally|re-?election|party-?list|senatoriables?|mayoral(?:ty)? (?:bid|race|bet)|gubernatorial (?:bid|race|bet)|running mate|vote for|endorse[sd]? (?:the )?(?:candidate|bid))\b/i

/** A paid ad or a listing by a seller, not news. */
const LISTING =
  /\b(for sale|for rent|for lease|rush sale|rfo units?|pm (?:me|us)|dm (?:me|us)|message (?:me|us) for|inquire now|reserve now|reservation fee|sponsored|paid partnership|share this post|like and share|tag (?:a friend|your friends))\b/i

/** A homepage, a section or a search page instead of the story itself. */
export function isHomepageLink(url: string): boolean {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/+$/, "")
    if (/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/i.test(u.hostname)) return !/\/(posts|videos|photos?|reel|share|permalink|events|watch|story)\b|story_fbid|fbid=|\/p\//i.test(`${path}${u.search}`)
    return path === "" || /^\/(news|latest|category|tag|search|home|index(\.[a-z]+)?)$/i.test(path)
  } catch {
    return true
  }
}

/** Days from the poster's day to the story's event (0 today, 1 tomorrow, negative: it has passed). null without one. */
export function eventIn(story: Pick<TrendStory, "eventDate">, day: Date): number | null {
  if (!story.eventDate) return null
  const age = storyAgeDays({ date: storyDate(story.eventDate) }, day)
  return age === null ? null : -age
}

/**
 * Step 1: why a story can't be the day's poster ("" when it can). The first reason that applies.
 */
export function rejectReason(c: PickCandidate, ctx: PickContext): string {
  const { story } = c
  const text = `${story.title} ${story.summary}`
  if (!story.url) return "No source link"
  if (story.kind === "news" && !story.verified) return "Its link wasn't one of the pages the search found"
  if (isHomepageLink(story.url)) return "The link is a homepage or a section, not the story itself"
  const event = eventIn(story, ctx.day)
  if (event !== null && event < -2) return "The event was more than 2 days before the poster's day"
  // News outside the days picked stays in when it announces something still to come.
  if (!c.fresh && !(event !== null && event >= 0)) return c.age === null ? "Its date isn't shown, so it can't be confirmed as new" : "Published outside the days picked"
  // Each page's news is in its own place (1.47): PicklePlay's in the Philippines (or about Filipino players).
  if (c.area === "outside") return `Another place (“${c.elsewhere || "not in the page's area"}”)`
  if (ctx.brand === "pickleplay" && c.area === "none") return "Not shown to be in the Philippines or about Filipino players"
  if (ctx.brand !== "pickleplay" && !c.place) return "No place named in the brand's area"
  if (c.negative) return `May be negative or sensitive (“${c.negative}”)`
  const partisan = PARTISAN.exec(text)?.[0]
  if (partisan) return `Election or partisan content (“${partisan}”)`
  const listing = LISTING.exec(text)?.[0]
  if (listing) return `Looks like an ad or a listing (“${listing}”)`
  if (c.repeat) return `Same story as one already posted (“${c.repeat}”)`
  return ""
}

export interface PickScore {
  total: number
  /** Fit to the page's audience, 0–25. */
  fit: number
  /** A partner developer's news in the place, 0–20. */
  partner: number
  /** Freshness and timing, 0–15. */
  timing: number
  /** Something to do, know or attend, 0–15. */
  useful: number
  /** Keywords and "Look for" kinds, 0–10. */
  match: number
  /** A short headline, a clear subject, a photo, 0–10. */
  poster: number
  /** How much it's talked about, 0–5. */
  buzz: number
}

/** A date, a time, a venue, a price or how to join: something readers can act on. */
const ACTIONABLE =
  /\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)|venue|register|registration|apply|application|deadline|until|free (?:entry|admission)|admission|tickets?|schedule|how to|requirements?|open to|walk-?ins?|slots?|₱\s?\d|php\s?\d|aed\s?\d)\b/i

/** Step 3: the team's score, 0–100, from what the story says and where it's from. */
export function pickScore(c: PickCandidate, ctx: PickContext): PickScore {
  const { story } = c
  const keywords = Math.min(2, c.matched.length)
  const fit = Math.min(25, 6 + (story.look ? 5 : 0) + keywords * 4 + Math.round(((story.trending ?? 50) / 100) * 6))
  const partner = c.partner ? (c.place ? 20 : 12) : 0
  const event = eventIn(story, ctx.day)
  const byEvent = event === null || event < 0 ? 0 : event <= 1 ? 15 : event <= 7 ? 12 : 9
  const byAge = !c.fresh || c.age === null ? 0 : c.age <= 0 ? 13 : c.age === 1 ? 10 : c.age === 2 ? 7 : 5
  const timing = Math.max(byEvent, byAge)
  const kindHelps = story.look === "events" || story.look === "openings" || story.look === "helpful"
  const useful = Math.min(15, (event !== null && event >= 0 ? 7 : 0) + (kindHelps ? 4 : 0) + (ACTIONABLE.test(`${story.title} ${story.summary}`) ? 4 : 0))
  const match = Math.min(10, keywords * 3 + (story.look ? 4 : 0))
  const words = story.title.split(/\s+/).filter(Boolean).length
  const poster = (story.image ? 5 : 0) + (words <= 12 ? 3 : words <= 16 ? 1 : 0) + (c.place ? 2 : 0)
  const buzz = story.trending === undefined ? 1 : story.trending >= 80 ? 5 : story.trending >= 60 ? 3 : story.trending >= 40 ? 2 : 1
  return { total: fit + partner + timing + useful + match + poster + buzz, fit, partner, timing, useful, match, poster, buzz }
}

export interface PickedStory<C extends PickCandidate = PickCandidate> {
  c: C
  score: PickScore
  tier: SourceTier
  /** Why it's the pick (or a good backup): its strongest points. */
  why: string
  /** What the team should check before posting. */
  notes: string[]
}

export interface PickResult<C extends PickCandidate = PickCandidate> {
  pick: PickedStory<C> | null
  /** At most 3, the best first. */
  backups: PickedStory<C>[]
  rejected: { c: C; reason: string }[]
  /** When there's no pick: what was missing. */
  notes: string
}

const TIER_TEXT: Record<SourceTier, string> = { 1: "an official source", 2: "an established news outlet", 3: "a local page or site" }

function whyOf(c: PickCandidate, score: PickScore, tier: SourceTier, ctx: PickContext): string {
  const points: string[] = []
  const event = eventIn(c.story, ctx.day)
  if (c.partner) points.push(`news of partner developer ${c.partner}${c.place ? ` in ${c.place}` : ""}`)
  if (event !== null && event >= 0) points.push(event === 0 ? "it happens on the poster's day" : event === 1 ? "it happens the next day" : "an upcoming date people can act on")
  else if (c.fresh && c.age !== null && c.age <= 1) points.push("fresh news")
  points.push(`from ${TIER_TEXT[tier]}`)
  if (score.useful >= 8) points.push("gives readers something to do or attend")
  if (c.matched.length) points.push(`on your keyword${c.matched.length > 1 ? "s" : ""} (${c.matched.slice(0, 2).join(", ")})`)
  if (!c.partner && c.place) points.push(`in ${c.place}`)
  const text = points.slice(0, 4).join(", ")
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}.` : ""
}

function notesOf(c: PickCandidate, tier: SourceTier, ctx: PickContext, onlyTier3: boolean): string[] {
  const notes: string[] = []
  if (tier === 3 && onlyTier3) notes.push("No official or established source had a story that qualifies: this one is from a local page or site, so read it before posting.")
  if (c.story.kind === "facebook") notes.push("A Facebook post found by a search: open it and check it's the official Page.")
  if (c.story.eventDate) notes.push("The event's date comes from this one source: check it there before posting.")
  if (!c.fresh && eventIn(c.story, ctx.day) !== null) notes.push("Published before the days picked; kept because its event is still to come.")
  if (!c.story.image) notes.push("No photo came with it: you'll need one for the poster.")
  return notes
}

/**
 * Steps 1 to 5: the pick and up to 3 backups. Tier 1 and 2 stories come before Tier 3. Scores within
 * 5 points are settled in this order: a partner developer's story in the place, a Tier 1 source, an
 * upcoming event or deadline, then a place not covered lately (the last 12 posts).
 */
export function pickStories<C extends PickCandidate>(candidates: readonly C[], ctx: PickContext): PickResult<C> {
  const rejected: { c: C; reason: string }[] = []
  const kept: { c: C; score: PickScore; tier: SourceTier }[] = []
  for (const c of candidates) {
    const reason = rejectReason(c, ctx)
    if (reason) rejected.push({ c, reason })
    else kept.push({ c, score: pickScore(c, ctx), tier: sourceTier(c) })
  }
  const covered = new Set((ctx.posted ?? []).slice(0, 12).map((t) => placeIn(t, ctx.brand, ctx.page).toLowerCase()).filter(Boolean))
  const breakers = (k: (typeof kept)[number]) => {
    const event = eventIn(k.c.story, ctx.day)
    const specific = placeIn(`${k.c.story.title} ${k.c.story.summary}`, ctx.brand, ctx.page).toLowerCase()
    return [k.c.partner && k.c.place ? 1 : 0, k.tier === 1 ? 1 : 0, event !== null && event >= 0 ? 1 : 0, specific && !covered.has(specific) ? 1 : 0]
  }
  // The best of a list: the top score, unless one within 5 points wins the tie-breakers.
  const best = (list: typeof kept) => {
    const top = Math.max(...list.map((k) => k.score.total))
    return list
      .filter((k) => top - k.score.total <= 5)
      .sort((a, b) => {
        const x = breakers(a)
        const y = breakers(b)
        for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]
        return b.score.total - a.score.total
      })[0]
  }
  const rank = (list: typeof kept) => {
    const left = [...list]
    const out: typeof kept = []
    while (left.length) {
      const next = best(left)
      out.push(next)
      left.splice(left.indexOf(next), 1)
    }
    return out
  }
  const trusted = kept.filter((k) => k.tier < 3)
  const ordered = [...rank(trusted), ...rank(kept.filter((k) => k.tier === 3))]
  const picked = ordered.slice(0, 4).map((k): PickedStory<C> => ({ ...k, why: whyOf(k.c, k.score, k.tier, ctx), notes: notesOf(k.c, k.tier, ctx, !trusted.length) }))
  let notes = ""
  if (!picked.length) {
    const counts = new Map<string, number>()
    for (const r of rejected) {
      const key = r.reason.replace(/\s*\(“.*$/, "")
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([reason, n]) => `${reason.charAt(0).toLowerCase()}${reason.slice(1)} (${n})`)
    notes = candidates.length ? `No story is good enough to post: ${main.join("; ")}. Try more days or other keywords.` : ""
  }
  return { pick: picked[0] ?? null, backups: picked.slice(1), rejected, notes }
}
