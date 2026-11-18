import { describe, expect, it } from "vitest"
import { areaLine, searchedPrompt } from "@/lib/ai/groq"
import { homesPlace } from "@/lib/ai/homes-places"
import { pickStories } from "@/lib/ai/story-pick"
import { pageDay, searchableKeywords, trendSearchPlan } from "@/lib/ai/tavily"
import { areaOf, cleanAreaKeywords, foreignKeyword, keywordsInTurn, otherPlaceIn, trendArea } from "@/lib/ai/trend-area"
import { DEFAULT_TREND_DEVELOPERS, DEFAULT_TREND_KEYWORDS, type TrendStory } from "@/lib/ai/trend-news"
import type { TrendBrand, TrendLook } from "@/lib/ai/types"
import { perplexityResults } from "@/lib/ai/web-search"

const trend = (brand: TrendBrand, keywords: string[], extra: Record<string, unknown> = {}) => ({
  task: "trend-search" as const,
  brand,
  keywords,
  day: "2026-11-16",
  days: 2,
  avoid: [],
  ...extra,
})

describe("each page's news stays in its own place (1.47)", () => {
  it("Homes.ph Gensan is General Santos City only: Koronadal, Polomolok, South Cotabato, Sarangani are other places", () => {
    const gensan = trendArea("gensan")
    expect(gensan?.label).toBe("General Santos City")
    expect(areaOf("New mall opens in General Santos City", gensan)).toBe("inside")
    expect(areaOf("GenSan's Tuna Festival draws thousands", gensan)).toBe("inside")
    expect(areaOf("Barangay Labangal gets a new health center", gensan)).toBe("inside")
    expect(areaOf("South Cotabato Launches Drug Abuse Prevention Month", gensan)).toBe("outside")
    expect(otherPlaceIn("South Cotabato Launches Drug Abuse Prevention Month", gensan)).toBe("South Cotabato")
    expect(areaOf("Koronadal City opens a new public market", gensan)).toBe("outside")
    expect(areaOf("Davao City hosts a food festival", gensan)).toBe("outside")
    // Naming GenSan too keeps it (a story about both).
    expect(areaOf("South Cotabato and General Santos City sign a water deal", gensan)).toBe("inside")
    // No place at all: neither (the picker asks for one).
    expect(areaOf("A new coffee shop opens", gensan)).toBe("none")
  })

  it("Homes.ph CARAGA: the Caraga region (Butuan, Agusan, Surigao, Siargao…); Davao, CDO and GenSan are other places", () => {
    const caraga = trendArea("homes")
    expect(caraga?.label).toBe("the Caraga region")
    expect(areaOf("Siargao surf festival opens", caraga)).toBe("inside")
    expect(areaOf("New bridge in Bayugan, Agusan del Sur", caraga)).toBe("inside")
    expect(areaOf("Cagayan de Oro opens a new mall", caraga)).toBe("outside")
    expect(areaOf("General Santos City hosts the Tuna Festival", caraga)).toBe("outside")
    // A Homes.ph page has its own place; the nationwide Main Page and FHI aren't checked.
    expect(areaOf("Mandaue gets a new mall", trendArea("homes", homesPlace("Cebu")))).toBe("inside")
    expect(areaOf("Butuan gets a new mall", trendArea("homes", homesPlace("Cebu")))).toBe("outside")
    expect(trendArea("homes", homesPlace("Main Page"))).toBeNull()
    expect(trendArea("fhi")).toBeNull()
  })

  it("PicklePlay: pickleball in the Philippines, or Filipino players anywhere", () => {
    const ph = trendArea("pickleplay")
    expect(areaOf("Pickleball open draws 400 players in Cebu City", ph)).toBe("inside")
    expect(areaOf("Filipino duo wins gold at the Asian pickleball championship in Vietnam", ph)).toBe("inside")
    expect(areaOf("PPA Tour crowns new champions in Florida", ph)).toBe("outside")
    expect(areaOf("New pickleball paddle released", ph)).toBe("none")
  })

  it("stories from other places are never picked; PicklePlay's need the Philippines", () => {
    const base = (title: string, area: "inside" | "outside" | "none", place = "x"): Parameters<typeof pickStories>[0][number] => ({
      story: { title, summary: "", url: `https://pna.gov.ph/articles/${title.length}`, site: "pna.gov.ph", kind: "news", verified: true, date: new Date(2026, 10, 16), dateText: "2026-11-16" } as TrendStory,
      age: 0,
      fresh: true,
      negative: "",
      repeat: "",
      partner: "",
      matched: [],
      place,
      check: "official",
      area,
      elsewhere: area === "outside" ? "Koronadal" : "",
    })
    const day = new Date(2026, 10, 16)
    const gensan = pickStories([base("Koronadal opens a market", "outside"), base("GenSan opens a market", "inside")], { brand: "gensan", day })
    expect(gensan.pick?.c.story.title).toBe("GenSan opens a market")
    expect(gensan.rejected[0].reason).toBe("Another place (“Koronadal”)")
    const pickle = pickStories([base("New paddle released", "none", "")], { brand: "pickleplay", day })
    expect(pickle.pick).toBeNull()
    expect(pickle.rejected[0].reason).toMatch(/Not shown to be in the Philippines/)
  })
})

describe("keywords: about other places taken out, developers kept, every keyword in turn (1.47)", () => {
  const developers = [...DEFAULT_TREND_DEVELOPERS.gensan]

  it("a keyword about another town isn't searched or kept on Homes.ph Gensan; a developer's name is never a place", () => {
    const gensan = trendArea("gensan")
    expect(foreignKeyword("Koronadal City Properties", gensan)).toBe(true)
    expect(foreignKeyword("SOCCSKSARGEN Housing Projects", gensan)).toBe(true)
    expect(foreignKeyword("GenSan Real Estate News", gensan)).toBe(false)
    expect(foreignKeyword("Real Estate Tips", gensan)).toBe(false)
    expect(foreignKeyword("Cebu Landmasters", gensan, developers)).toBe(false)
    const { kept, removed } = cleanAreaKeywords(["GenSan Real Estate", "Koronadal City Properties", "Lake Sebu Tourism Development", "Cebu Landmasters", "Events"], gensan, null, developers)
    expect(kept).toEqual(["GenSan Real Estate", "Cebu Landmasters", "Events"])
    expect(removed).toEqual(["Koronadal City Properties", "Lake Sebu Tourism Development"])
    // The team's own Gensan and CARAGA lists have none left.
    expect(cleanAreaKeywords(DEFAULT_TREND_KEYWORDS.gensan, gensan, null, developers).removed).toEqual([])
    expect(cleanAreaKeywords(DEFAULT_TREND_KEYWORDS.homes, trendArea("homes"), null, developers).removed).toEqual([])
  })

  it("Caraga's keywords copied to Homes.ph Cebu get Cebu's place; those naming Caraga's towns go", () => {
    const cebu = homesPlace("Cebu")
    const { kept, removed } = cleanAreaKeywords(
      ["Cebu Real Estate", "Caraga Restaurant Grand Opening", "Butuan Restaurant Opening", "General Luna Siargao Cafe Opening", "Pag-IBIG Housing Loan", "Cebu Restaurant Grand Opening"],
      trendArea("homes", cebu),
      cebu,
    )
    // The copy that already had Cebu's place is the same keyword now: once.
    expect(kept).toEqual(["Cebu Real Estate", "Cebu Restaurant Grand Opening", "Pag-IBIG Housing Loan"])
    expect(removed).toEqual(["Butuan Restaurant Opening", "General Luna Siargao Cafe Opening"])
  })

  it("the search never uses a keyword about another place, and says which", () => {
    const req = trend("gensan", ["GenSan Real Estate", "Koronadal City Properties", "GenSan Business News", "Cebu Landmasters"], { developers })
    expect(searchableKeywords(req)).toEqual(["GenSan Real Estate", "GenSan Business News", "Cebu Landmasters"])
    const plan = trendSearchPlan(req, () => 0)
    expect(plan.queries.map((q) => q.query).join(" | ")).not.toMatch(/Koronadal/)
    expect(plan.queries.map((q) => q.query)).toContain("Cebu Landmasters General Santos City news")
  })

  it("the keywords take turns: each search starts where the last one stopped, and goes around", () => {
    const list = ["Main", "A", "B", "C", "D", "E", "F", "G"]
    expect(keywordsInTurn(list, 0)).toEqual(list)
    expect(keywordsInTurn(list, 4)).toEqual(["Main", "E", "F", "G", "A", "B", "C", "D"])
    expect(keywordsInTurn(list, 11)).toEqual(["Main", "E", "F", "G", "A", "B", "C", "D"])
    // 5 searches: the main keyword and the next 4; the next search starts 4 further on.
    const plan = trendSearchPlan(trend("pickleplay", keywordsInTurn(list, 4)), () => 0)
    expect(plan.keywords).toBe(5)
    expect(plan.queries.map((q) => q.query)).toEqual(["Main Philippines news", "E Philippines news", "F Philippines news", "G Philippines news", "A Philippines news"])
    // With "Look for" kinds: 6 searches, up to 3 of them for the kinds.
    const looks: TrendLook[] = ["events", "openings", "tourism", "projects"]
    const withKinds = trendSearchPlan(trend("gensan", ["GenSan Real Estate", "GenSan Business News", "GenSan Events"], { look: looks }), () => 0)
    expect(withKinds.queries).toHaveLength(6)
    expect(withKinds.queries.filter((q) => /November 2026|tourism news|infrastructure project|road bridge/.test(q.query))).toHaveLength(3)
    expect(withKinds.queries.every((q) => /General Santos City|GenSan/.test(q.query))).toBe(true)
  })
})

describe("the AI reads keywords as topics and keeps to the place (1.47)", () => {
  it("the PLACE line: General Santos City only, with the nearby towns named as other places", () => {
    const line = areaLine(trend("gensan", ["GenSan Real Estate"]))
    expect(line).toMatch(/^PLACE \(only here\): General Santos City \(General Santos City, General Santos/)
    expect(line).toContain("Koronadal, Polomolok, South Cotabato, Sarangani")
    expect(areaLine(trend("pickleplay", ["Pickleball"]))).toMatch(/pickleball in the Philippines, or Filipino players and teams anywhere/)
    expect(areaLine(trend("fhi", ["Dubai Real Estate"]))).toBe("")
  })

  it("keywords are topics: a developer's name is its news, 'Events' is any event", () => {
    const p = searchedPrompt(trend("gensan", ["GenSan Real Estate", "Cebu Landmasters", "Events"]) as never, [])
    expect(p.user).toContain("a story fits a keyword when it's about what the keyword means, even without its words")
    expect(p.user).toContain("A company or developer's name means that company's news")
    expect(p.user).toContain('"Events" means any event or festival')
    expect(p.system).toContain("it doesn't have to use the keyword's words")
    expect(p.system).toContain("Give every story that qualifies, up to 8")
    expect(p.system).toContain("news from another city or province is left out, even when it fits a keyword")
  })
})

describe("newer pages: a date from the page's address or text when the engine gives none (1.47)", () => {
  it("reads /2026/11/15/ in the address, or 'Nov 15, 2026' at the start of the text", () => {
    expect(pageDay("https://www.pna.gov.ph/2026/11/15/gensan-tuna-festival")).toBe("2026-11-15")
    expect(pageDay("https://mindanaotimes.com.ph/2026-11-16-new-mall")).toBe("2026-11-16")
    expect(pageDay("https://x.ph/story", "Nov 15, 2026 — GenSan opens a new mall")).toBe("2026-11-15")
    expect(pageDay("https://x.ph/story", "15 November 2026: Butuan…")).toBe("2026-11-15")
    expect(pageDay("https://x.ph/2026/02/30/bad")).toBeNull()
    expect(pageDay("https://x.ph/story/123456", "A story without a date")).toBeNull()
    // Perplexity's results without a date keep the page's own (never the day it was last read).
    const list = [
      { title: "Dated in the address", url: "https://news.ph/2026/11/16/a", snippet: "…", date: null, last_updated: "2026-11-16" },
      { title: "No date at all", url: "https://news.ph/b", snippet: "…", date: null, last_updated: "2026-11-16" },
    ]
    expect(perplexityResults(list, true).map((r) => [r.title, r.published])).toEqual([["Dated in the address", "2026-11-16"]])
  })
})
