import { describe, expect, it } from "vitest"
import { prompt, searchedPrompt, trendFocus } from "@/lib/ai/groq"
import { trendQueries } from "@/lib/ai/tavily"
import { BRAND_LOOKS, lookLabel, lookOfKind, lookQuery, TREND_LOOKS } from "@/lib/ai/trend-looks"
import { DEFAULT_TREND_DEVELOPERS, DEFAULT_TREND_KEYWORDS, negativeIn, parseTrendStories, relevanceScore } from "@/lib/ai/trend-news"
import type { TrendBrand, TrendLook } from "@/lib/ai/types"
import { parseAiRequest } from "@/lib/ai/validate"

const trend = (brand: TrendBrand, look?: TrendLook[], extra: Record<string, unknown> = {}) => ({
  task: "trend-search" as const,
  brand,
  keywords: [...DEFAULT_TREND_KEYWORDS[brand]],
  developers: [...DEFAULT_TREND_DEVELOPERS[brand]],
  day: "2026-11-13",
  days: 2,
  avoid: [],
  ...(look ? { look } : {}),
  ...extra,
})

const RESULT = [{ title: "Butuan Balangay fest draws crowds", url: "https://pna.gov.ph/articles/1", content: "…", published: "2026-11-13" }]

describe("Trending news → Look for (openings, festivals, tourism, city projects, helpful info)", () => {
  it("each brand's kinds and their names (PicklePlay: courts, tournaments, tips)", () => {
    expect(BRAND_LOOKS.homes).toEqual(TREND_LOOKS)
    expect(BRAND_LOOKS.pickleplay).toEqual(["openings", "events", "helpful"])
    expect(lookLabel("events", "homes")).toBe("Festivals & events")
    expect(lookLabel("events", "pickleplay")).toBe("Tournaments & events")
    expect(lookLabel("openings", "gensan")).toBe("New businesses & openings")
  })

  it("the request keeps only the brand's kinds; none asked = keywords only, as before", () => {
    const req = parseAiRequest({ ...trend("pickleplay"), look: ["events", "tourism", "realestate", "nope"] })
    if (typeof req === "string") throw new Error(req)
    expect(req).toMatchObject({ look: ["events"] })
    const none = parseAiRequest({ ...trend("homes"), look: [] })
    if (typeof none === "string") throw new Error(none)
    expect(none).not.toHaveProperty("look")
  })

  it("a kind's search names the place and the month: 'Butuan City festival November 2026'", () => {
    expect(lookQuery("events", "homes", "2026-11-13", null, () => 0.3)).toBe("Butuan City festival November 2026")
    expect(lookQuery("openings", "homes", "2026-11-13", "Cebu", () => 0)).toBe("Cebu grand opening November 2026")
    expect(lookQuery("events", "pickleplay", "2026-11-13", null, () => 0)).toBe("pickleball tournament Philippines November 2026")
    expect(lookQuery("realestate", "fhi", "2026-11-13", null)).toBe("")
  })

  it("6 searches with kinds: the main keyword, a partner developer, 3 kinds and the next keyword (5 without, 1.47)", () => {
    const before = trendQueries(trend("homes"), () => 0)
    expect(before).toHaveLength(5)
    const qs = trendQueries(trend("homes", [...TREND_LOOKS]), () => 0).map((q) => q.query)
    expect(qs).toHaveLength(6)
    expect(qs[0]).toBe("Caraga Real Estate news")
    expect(qs[1]).toMatch(/Caraga news$/)
    // Up to 3 kinds each time (they take turns), then the keywords in the order sent.
    expect(qs.slice(2)).toEqual(["Caraga festival November 2026", "Caraga tourism news", "Caraga infrastructure project", "Caraga Property Market news"])
    // Real estate off: no partner developer search; every kind turned on is searched.
    const noRe = trendQueries(trend("homes", ["events", "openings"]), () => 0).map((q) => q.query)
    expect(noRe).toHaveLength(6)
    expect(noRe.some((q) => DEFAULT_TREND_DEVELOPERS.homes.some((d) => q.startsWith(d)))).toBe(false)
    expect(noRe.some((q) => /festival|events/.test(q))).toBe(true)
    expect(noRe.some((q) => /opening/.test(q))).toBe(true)
    // Only real estate: the main keyword, a developer and the next keywords.
    expect(trendQueries(trend("homes", ["realestate"]), () => 0)).toHaveLength(5)
  })

  it("the AI is told to look for the kinds, positive or useful, a mix, with each story's kind", () => {
    const p = prompt(trend("gensan", [...TREND_LOOKS]))
    expect(p.system).toMatch(/Positive or useful news/)
    expect(p.system).toMatch(/one of the LOOK FOR kinds/)
    expect(p.system).toMatch(/Give a mix of the LOOK FOR kinds/)
    expect(p.system).not.toMatch(/Only positive or hopeful news/)
    // Keywords are topics, read with common sense (1.47), and the place is General Santos City only.
    expect(p.user).toContain("KEYWORDS (topics, read with common sense")
    expect(p.user).toContain("): General Santos City Real Estate")
    expect(p.user).toContain("PLACE (only here): General Santos City")
    expect(p.user).toContain("LOOK FOR (besides the keywords")
    expect(p.user).toContain("- Event: festivals and events")
    expect(p.user).toContain("Pag-IBIG")
    expect(p.user).toContain("| kind: [Real estate, Opening, Event, Tourism, City project or Helpful info] | place: [")
    expect(p.user).toContain("TOP PRIORITY")
    // No helpful info: positive only, festivals included.
    const positive = searchedPrompt(trend("homes", ["realestate", "events"]), RESULT)
    expect(positive.system).toMatch(/Only positive or hopeful news: .*festivals/)
    expect(positive.user).toContain("Pick every story (up to 8, all different)")
    expect(positive.user).toContain("kind: [Real estate or Event]")
    // Real estate off: no partner developers or real-estate priority.
    expect(trendFocus(trend("homes", ["events"]))).toBe("")
    expect(trendFocus(trend("homes", ["realestate", "events"]))).toContain("PARTNER DEVELOPERS")
    // No kinds: the old prompt.
    const old = searchedPrompt(trend("homes"), RESULT)
    expect(old.system).toMatch(/Only positive or hopeful news/)
    expect(old.user).toContain("KEYWORDS (topics, read with common sense")
    expect(old.user).not.toContain("LOOK FOR")
    expect(old.user).not.toContain("kind: [")
  })

  it("reads each story's kind; a hook is never taken for a kind", () => {
    const [a, b, c] = parseTrendStories(
      `STORIES:
1. Butuan Balangay Festival Opens | 2026-11-13 | https://pna.gov.ph/articles/1 | The festival runs until Sunday. | Thousands expected downtown | Event
2. New Mall Opens in Butuan | 2026-11-12 | https://pna.gov.ph/articles/2 | A 3-storey mall opened. | First mall of its size | [kind: Opening]
3. Caraga Housing Project Launched | 2026-11-13 | https://pna.gov.ph/articles/3 | 500 homes. | Biggest festival of homes`,
      RESULT,
    )
    expect(a).toMatchObject({ look: "events", why: "Thousands expected downtown" })
    expect(b).toMatchObject({ look: "openings", why: "First mall of its size" })
    expect(c.look).toBeUndefined()
    expect(c.why).toBe("Biggest festival of homes")
    expect(lookOfKind("City project")).toBe("projects")
    expect(lookOfKind("Festival")).toBe("events")
    expect(lookOfKind("Helpful info")).toBe("helpful")
    expect(lookOfKind("Why people will care about this one")).toBeNull()
  })

  it("good stories aren't flagged negative: waterfalls, flood control, fire stations; helpful info allows a price drop", () => {
    expect(negativeIn("Tinuy-an Falls draws record tourists")).toBe("")
    expect(negativeIn("Butuan flood control project 80% done")).toBe("")
    expect(negativeIn("New Fire Station opens in GenSan")).toBe("")
    expect(negativeIn("Dubai Rent Falls 5% in October")).toBe("Falls")
    expect(negativeIn("Condo prices drop in Butuan")).toBe("drop")
    expect(negativeIn("Condo prices drop in Butuan", true)).toBe("")
    expect(negativeIn("Road closure for the Tuna Festival parade", true)).toBe("")
    expect(negativeIn("Fire hits Butuan market", true)).toBe("Fire")
    expect(negativeIn("Flooding in Surigao")).toBe("Flooding")
  })

  it("a story of a Look-for kind counts like two keywords in its relevance", () => {
    const base = { age: 0, days: 2, check: "trusted" as const, partner: false, keywords: 0, place: true, negative: false, repeat: false, trending: true }
    expect(relevanceScore({ ...base, look: true }) - relevanceScore(base)).toBe(12)
    expect(relevanceScore({ ...base, keywords: 3, look: true })).toBe(relevanceScore({ ...base, keywords: 3 }))
  })
})
