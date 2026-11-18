import type { TrendBrand, TrendLook } from "./types"

/**
 * Poster Maker → Trending news → "Look for": the kinds of news a search finds besides the brand's
 * keywords. Real estate news in Caraga or GenSan isn't there every day, so the search can also look
 * for new businesses, festivals and events, tourism, city projects and helpful information in the
 * same place: positive or useful news that people read, share and act on.
 */

export const TREND_LOOKS: readonly TrendLook[] = ["realestate", "openings", "events", "tourism", "projects", "helpful"]

/** The kinds each brand offers (PicklePlay: courts, tournaments and tips; its keywords are the sport). */
export const BRAND_LOOKS: Record<TrendBrand, readonly TrendLook[]> = {
  pickleplay: ["openings", "events", "helpful"],
  fhi: TREND_LOOKS,
  homes: TREND_LOOKS,
  gensan: TREND_LOOKS,
}

const LABELS: Record<TrendLook, string> = {
  realestate: "Real estate & developers",
  openings: "New businesses & openings",
  events: "Festivals & events",
  tourism: "Tourism & travel",
  projects: "City projects",
  helpful: "Helpful info",
}

const PICKLEBALL_LABELS: Partial<Record<TrendLook, string>> = {
  openings: "Court & club openings",
  events: "Tournaments & events",
  helpful: "Tips & helpful info",
}

/** The kind's name on its button in Trending news. */
export function lookLabel(look: TrendLook, brand: TrendBrand): string {
  return (brand === "pickleplay" ? PICKLEBALL_LABELS[look] : undefined) ?? LABELS[look]
}

/** A story's kind as the AI writes it (the last part of a STORIES line) and as its badge shows it. */
export const LOOK_KIND: Record<TrendLook, string> = {
  realestate: "Real estate",
  openings: "Opening",
  events: "Event",
  tourism: "Tourism",
  projects: "City project",
  helpful: "Helpful info",
}

/** Other ways the AI may write a kind. */
const KIND_WORDS: [RegExp, TrendLook][] = [
  [/^(real estate|property|properties|housing|developer|development)$/, "realestate"],
  [/^(openings?|grand opening|new business(es)?|business opening|court opening|club opening)$/, "openings"],
  [/^(events?|festivals?|fiesta|tournaments?|concerts?|expo)$/, "events"],
  [/^(tourism|travel|destination)$/, "tourism"],
  [/^(city projects?|projects?|infrastructure)$/, "projects"],
  [/^(helpful( info(rmation)?)?|info(rmation)?|tips?|advisory|public service)$/, "helpful"],
]

/** "Event", "[kind: Festival]", "City project" → the kind; null for anything else (a hook sentence). */
export function lookOfKind(text: string): TrendLook | null {
  const t = text
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/^kind\s*:\s*/i, "")
    .replace(/[.!]+$/, "")
    .trim()
    .toLowerCase()
  if (!t || t.length > 30) return null
  const exact = TREND_LOOKS.find((l) => LOOK_KIND[l].toLowerCase() === t)
  return exact ?? KIND_WORDS.find(([re]) => re.test(t))?.[1] ?? null
}

/** The kinds of a request that the brand offers, in order; null when none were asked for (keywords only). */
export function requestLooks(brand: TrendBrand, look: readonly TrendLook[] | undefined): TrendLook[] | null {
  if (!look) return null
  return BRAND_LOOKS[brand].filter((l) => look.includes(l))
}

/** The kinds that add searches and widen the rules (everything but real estate, which the keywords cover). */
export const extraLooks = (looks: readonly TrendLook[] | null | undefined): TrendLook[] => (looks ?? []).filter((l) => l !== "realestate")

/**
 * The partner developers and the brand's real-estate priority count: real estate is asked for, or
 * the kinds weren't chosen at all (searches made before "Look for"), or the brand has no real estate.
 */
export const wantsRealEstate = (brand: TrendBrand, looks: readonly TrendLook[] | null): boolean =>
  !looks || looks.includes("realestate") || !BRAND_LOOKS[brand].includes("realestate")

/** For the AI: what each kind covers, for the brand. */
export function lookAbout(look: TrendLook, brand: TrendBrand): string {
  const pickleball = brand === "pickleplay"
  const uae = brand === "fhi"
  switch (look) {
    case "realestate":
      return uae
        ? "partner developers' and other developers' launches, projects, sold-out phases, handovers, record sales and property market news"
        : "new, proposed or launched projects (subdivisions, condominiums, townships, malls, hotels), partner developers, housing and property market news"
    case "openings":
      return pickleball
        ? "new pickleball courts, clubs and venues opening or coming soon"
        : "new businesses: grand openings and soon-to-open restaurants, cafés, shops, malls, hotels, branches and services"
    case "events":
      return pickleball
        ? "tournaments, leagues, open plays, clinics and community events, upcoming ones too (dates, venue, how to join)"
        : "festivals and events: fiestas, festivals, concerts, fairs, expos, sports and holiday events and things to do, upcoming ones too (dates, venue, what to expect)"
    case "tourism":
      return "tourism and travel: destinations and attractions, new resorts, flights and routes, tourist arrivals, travel tips"
    case "projects":
      return "city projects: roads, bridges, airports, ports, flood control, public markets and other public or private projects, and their progress"
    case "helpful":
      return pickleball
        ? "helpful information for players: tips, rules, gear guides, clinics, free play, how to start"
        : uae
          ? "helpful information for residents, buyers and investors: new rules, visas and residency, government services, fees, schedules, advisories, price and market updates"
          : "helpful information people can use: government services and programs (housing loans, Pag-IBIG, permits, job fairs, scholarships, aid), new rules, schedules, advisories, price and market updates"
  }
}

/** Where a kind's searches look when the request has no Homes.ph page: a few places, one picked each time. */
const LOOK_PLACES: Record<TrendBrand, readonly string[]> = {
  pickleplay: ["Philippines"],
  fhi: ["Dubai", "Dubai", "Abu Dhabi", "UAE"],
  homes: ["Caraga", "Butuan City", "Surigao", "Siargao"],
  // General Santos City only (1.47).
  gensan: ["General Santos City", "GenSan", "General Santos City", "GenSan City"],
}

/** The searches a kind can run ("{w}": the place, "{m}": the month and year, e.g. "November 2026"). */
function lookTemplates(look: TrendLook, brand: TrendBrand): readonly string[] {
  if (brand === "pickleplay") {
    if (look === "openings") return ["pickleball court opening Philippines {m}", "new pickleball club Philippines"]
    if (look === "events") return ["pickleball tournament Philippines {m}", "pickleball open play clinic Philippines {m}"]
    if (look === "helpful") return ["pickleball tips beginners Philippines", "pickleball clinic free play Philippines {m}"]
    return []
  }
  switch (look) {
    case "realestate":
      return []
    case "openings":
      return ["{w} grand opening {m}", "{w} new restaurant cafe opening", "{w} new mall store opening"]
    case "events":
      return ["{w} festival {m}", "{w} events {m}"]
    case "tourism":
      return ["{w} tourism news", "{w} tourist destination {m}"]
    case "projects":
      return ["{w} infrastructure project", "{w} road bridge project completed"]
    case "helpful":
      return brand === "fhi"
        ? ["UAE new rules residents {m}", "{w} government services residents announcement"]
        : ["{w} job fair {m}", "{w} government services residents announcement", "Pag-IBIG housing loan {w}"]
  }
}

/**
 * One search for a kind of news: "Butuan City festival November 2026", "Cebu grand opening November 2026".
 * `place`: a Homes.ph page's search word ("Cebu"), else one of the brand's places. "" when the kind has none.
 */
export function lookQuery(look: TrendLook, brand: TrendBrand, day: string, place: string | null, random: () => number = Math.random): string {
  const templates = lookTemplates(look, brand)
  if (!templates.length) return ""
  const pick = <T,>(list: readonly T[]) => list[Math.min(list.length - 1, Math.floor(random() * list.length))]
  const where = place || pick(LOOK_PLACES[brand])
  const at = new Date(`${day}T12:00:00Z`)
  const month = Number.isNaN(at.getTime()) ? "" : at.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  return pick(templates).replace("{w}", where).replace("{m}", month).replace(/\s+/g, " ").trim().slice(0, 380)
}
