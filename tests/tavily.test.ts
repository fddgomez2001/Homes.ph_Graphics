import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generate, searchedPrompt } from "@/lib/ai/groq"
import {
  inWindow,
  isTavilyKey,
  keywordQuery,
  mergeResults,
  PH_LISTING_SITES,
  publishedDay,
  researchQueries,
  resultsBlock,
  SKIP_DOMAINS,
  tavilyError,
  trendQueries,
  type TavilyResult,
} from "@/lib/ai/tavily"
import { parseTrendStories } from "@/lib/ai/trend-news"
import { SEARCH_AI_TASKS } from "@/lib/ai/types"

const KEY = "tvly-dev-abcdefghijklmnop1234"
const trend = (over: Partial<{ keywords: string[]; day: string; days: number }> = {}) => ({
  task: "trend-search" as const,
  brand: "pickleplay" as const,
  keywords: ["Pickleball Philippines", "Pickleball News", "Pickleball Equipment", "Pickleball Tournament Philippines", "Pickleball Court Opening"],
  day: "2026-11-09",
  days: 2,
  avoid: [],
  ...over,
})
const result = (url: string, published: string | null = "2026-11-08", title = "A story"): TavilyResult => ({ title, url, content: "Bacolod hosts a pickleball tournament in December.", published })

describe("Tavily: keys, dates and errors", () => {
  it("knows a Tavily key", () => {
    expect(isTavilyKey(KEY)).toBe(true)
    expect(isTavilyKey("tvly-AbCdEf-gHiJkLmNoPqRsTuVw")).toBe(true)
    expect(isTavilyKey("gsk_abcdefghijklmnopqrstuvwxyz")).toBe(false)
    expect(isTavilyKey("tvly-short")).toBe(false)
    expect(isTavilyKey("tvly-abc def ghi jkl mno")).toBe(false)
  })

  it("reads Tavily's dates as UTC days", () => {
    expect(publishedDay("Sun, 08 Nov 2026 16:00:00 GMT")).toBe("2026-11-08")
    expect(publishedDay(null)).toBeNull()
    expect(publishedDay("not a date")).toBeNull()
  })

  it("explains Tavily's errors in plain words", () => {
    expect(tavilyError(401).message).toMatch(/key was rejected/)
    expect(tavilyError(432).message).toMatch(/credits for this month are used up/)
    expect(tavilyError(429).message).toMatch(/too many searches/)
    expect(tavilyError(500).message).toMatch(/didn't answer/)
    expect(tavilyError(400, "Invalid topic").message).toBe("Tavily: Invalid topic")
  })
})

describe("Tavily: what is searched", () => {
  it("one keyword per search, with the brand's place and 'news'", () => {
    expect(keywordQuery("Pickleball Philippines", "pickleplay")).toBe("Pickleball Philippines news")
    expect(keywordQuery("Pickleball Equipment", "pickleplay")).toBe("Pickleball Equipment Philippines news")
    expect(keywordQuery("Pickleball News", "pickleplay")).toBe("Pickleball News Philippines")
    expect(keywordQuery("Dubai Off-Plan Properties", "fhi")).toBe("Dubai Off-Plan Properties news")
    expect(keywordQuery("Butuan House and Lot", "homes")).toBe("Butuan House and Lot news")
    expect(keywordQuery("Property Developers", "homes")).toBe("Property Developers Caraga news")
  })

  it("trending news: 5 news searches (the main keyword, then the next ones in the order sent), dated, in the window (1.47)", () => {
    const qs = trendQueries(trend(), () => 0)
    expect(qs.map((q) => q.query)).toEqual([
      "Pickleball Philippines news",
      "Pickleball News Philippines",
      "Pickleball Equipment Philippines news",
      "Pickleball Tournament Philippines news",
      "Pickleball Court Opening Philippines news",
    ])
    // PicklePlay keeps to the Philippines (the country goes with every search).
    for (const q of qs)
      expect(q).toMatchObject({ topic: "news", depth: "basic", maxResults: 10, datedOnly: true, startDate: "2026-11-07", endDate: "2026-11-10", exclude: ["pickleplay.ph"], country: "philippines" })
    // The order sent is the order searched (the panel starts where its last search stopped): no shuffling.
    expect(trendQueries(trend(), () => 0.99).map((q) => q.query)).toEqual(qs.map((q) => q.query))
    const long = trend({ keywords: ["Pickleball Philippines", ...Array.from({ length: 10 }, (_, i) => `Pickleball Topic ${i + 1}`)] })
    expect(trendQueries(long, () => 0).map((q) => q.query)).toEqual([
      "Pickleball Philippines news",
      "Pickleball Topic 1 Philippines news",
      "Pickleball Topic 2 Philippines news",
      "Pickleball Topic 3 Philippines news",
      "Pickleball Topic 4 Philippines news",
    ])
    expect(trendQueries({ ...trend({ keywords: ["Dubai Real Estate"] }), brand: "fhi" }).map((q) => q.query)).toEqual(["Dubai Real Estate news"])
    // Caraga: the whole web, in the Philippines; never the same search twice; not homes.ph's own articles.
    const caraga = trendQueries({ ...trend({ keywords: ["Caraga Real Estate", "Caraga Real Estate News", "Butuan House and Lot"] }), brand: "homes" }, () => 0)
    expect(caraga.map((q) => q.query)).toEqual(["Caraga Real Estate news", "Butuan House and Lot news"])
    expect(caraga[0]).toMatchObject({ topic: "general", country: "philippines", exclude: ["homes.ph", ...PH_LISTING_SITES], datedOnly: true })
  })

  it("search a topic: one advanced search, or one per island group", () => {
    expect(researchQueries({ task: "carousel-research", topic: "Top Restaurants In Cebu City 2026", cards: 6, avoid: [] })).toEqual([
      { query: "Top Restaurants In Cebu City 2026", topic: "general", depth: "advanced", maxResults: 10, country: "philippines" },
    ])
    const groups = researchQueries({ task: "carousel-research", topic: "Top 2 Resorts Each In Luzon, Visayas And Mindanao", cards: 6, avoid: [] })
    expect(groups.map((q) => q.query)).toEqual(["Top 2 Resorts in Luzon, Philippines", "Top 2 Resorts in Visayas, Philippines", "Top 2 Resorts in Mindanao, Philippines"])
    expect(groups.every((q) => q.depth === "basic")).toBe(true)
    expect(researchQueries({ task: "carousel-research", topic: "Best Dubai Marina towers", cards: 6, avoid: [], brand: "fhi" })[0].country).toBe("united arab emirates")
  })

  it("skips pages that aren't articles (social posts, Tavily's own pages)", () => {
    expect(SKIP_DOMAINS).toEqual(expect.arrayContaining(["tavily.com", "facebook.com", "instagram.com", "tiktok.com"]))
  })
})

describe("Tavily: results for the AI", () => {
  it("merges the searches best-first, each page once", () => {
    const a = [result("https://a.ph/1"), result("https://b.ph/2")]
    const b = [result("https://www.a.ph/1/"), result("https://c.ph/3")]
    expect(mergeResults([a, b], 10).map((r) => r.url)).toEqual(["https://a.ph/1", "https://b.ph/2", "https://c.ph/3"])
    expect(mergeResults([a, b], 2)).toHaveLength(2)
  })

  it("keeps trending news in the window (a UTC day of slack, never after the day)", () => {
    const list = [result("https://a.ph", "2026-11-09"), result("https://b.ph", "2026-11-07"), result("https://c.ph", "2026-11-06"), result("https://d.ph", "2026-11-10"), result("https://e.ph", null)]
    expect(inWindow(list, "2026-11-09", 2).map((r) => r.url)).toEqual(["https://a.ph", "https://b.ph"])
  })

  it("writes them as numbered text within the limit", () => {
    const block = resultsBlock([{ ...result("https://a.ph/x", "2026-11-08", "Bacolod to host Pickleball Invasion"), content: "word ".repeat(2000) }], 1500)
    expect(block).toMatch(/^\[1\] Bacolod to host Pickleball Invasion\nURL: https:\/\/a\.ph\/x\nPUBLISHED: 2026-11-08\nTEXT: /)
    expect(block.length).toBeLessThan(1600)
    expect(resultsBlock([])).toBe("(no results)")
  })

  it("the prompt says the search is done: pick only from the results", () => {
    const p = searchedPrompt(trend(), [result("https://a.ph/x")])
    expect(p.system).toMatch(/The web search is already done/)
    expect(p.system).not.toMatch(/Search the web with/)
    expect(p.system).toMatch(/never a listings or for-sale page/)
    expect(p.user).toContain("SEARCH RESULTS")
    expect(p.user).toContain("https://a.ph/x")
    expect(p.user).toContain("from 2026-11-08 to 2026-11-09")
    const r = searchedPrompt({ task: "carousel-research", topic: "Cebu food", cards: 5, avoid: [] }, [result("https://a.ph/x")])
    expect(r.system).toMatch(/use only the SEARCH RESULTS/)
    expect(r.system).toMatch(/never add details the text doesn't give/)
    const manyPages = Array.from({ length: 14 }, (_, i) => ({ ...result(`https://site${i}.ph/list`), content: "y ".repeat(3000) }))
    const topic = searchedPrompt({ task: "carousel-research", topic: "Cebu food", cards: 10, avoid: [] }, manyPages)
    expect((topic.system.length + topic.user.length) / 4 + topic.maxTokens).toBeLessThan(7600)
    expect(r.system).toMatch(/URL of the search result/)
    // Groq's free plan: about 8,000 tokens a minute (prompt + answer).
    const many = Array.from({ length: 18 }, (_, i) => ({ ...result(`https://site${i}.ph/story`), content: "x ".repeat(3000) }))
    const big = searchedPrompt(trend(), many)
    expect((big.system.length + big.user.length) / 4 + big.maxTokens).toBeLessThan(7600)
  })
})

describe("Tavily: the search tasks use it, with Groq as the fallback", () => {
  type Call = { url: string; body: Record<string, unknown>; auth: string }
  let calls: Call[]
  let tavilyStatus = 200
  const ANSWER = "STORIES:\n1. Bacolod to host Pickleball Invasion tournament in December | 2026-11-08 | https://www.dailyguardian.com.ph/bacolod-pickleball | Bacolod City will host a major pickleball event. | big regional tournament"

  beforeEach(() => {
    calls = []
    tavilyStatus = 200
    vi.stubEnv("GROQ_API_KEY", "gsk_test")
    vi.stubEnv("TAVILY_API_KEY", "")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
        calls.push({ url, body, auth: String((init?.headers as Record<string, string>)?.authorization ?? "") })
        if (url.startsWith("https://api.tavily.com/search")) {
          if (tavilyStatus !== 200) return new Response(JSON.stringify({ detail: { error: "limit" } }), { status: tavilyStatus })
          return new Response(
            JSON.stringify({
              results: [
                { title: "Bacolod to host Pickleball Invasion tournament in December", url: "https://www.dailyguardian.com.ph/bacolod-pickleball", content: "Bacolod City is preparing…", published_date: "Sun, 08 Nov 2026 16:00:00 GMT" },
                { title: "Old story", url: "https://old.ph/x", content: "…", published_date: "Mon, 02 Nov 2026 10:00:00 GMT" },
              ],
              usage: { credits: 1 },
            }),
            { status: 200 },
          )
        }
        // Groq chat completions
        return new Response(JSON.stringify({ choices: [{ message: { content: ANSWER, executed_tools: [] } }] }), { status: 200 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("lists the search tasks", () => {
    expect([...SEARCH_AI_TASKS].sort()).toEqual(["carousel-research", "pickleball-post", "trend-search"])
  })

  it("with a Tavily key: 5 Tavily searches, then Groq writes without browsing", async () => {
    const out = await generate(trend(), null, KEY)
    const tavily = calls.filter((c) => c.url.includes("tavily"))
    expect(tavily).toHaveLength(5)
    expect(tavily.every((c) => c.auth === `Bearer ${KEY}` && c.body.topic === "news" && c.body.filter_by_published_date === true)).toBe(true)
    const groq = calls.filter((c) => c.url.includes("groq"))
    expect(groq).toHaveLength(1)
    expect(groq[0].body.tools).toBeUndefined()
    expect(JSON.stringify(groq[0].body.messages)).toContain("SEARCH RESULTS")
    expect(JSON.stringify(groq[0].body.messages)).not.toContain("old.ph")
    // What was searched and how many keywords it used (the panel's next search starts after them).
    expect(out.search).toEqual({ engine: "tavily", credits: 5, queries: tavily.map((c) => c.body.query), keywordsUsed: 5 })
    expect(out.sources?.map(({ title, url }) => ({ title, url }))).toEqual([{ title: "Bacolod to host Pickleball Invasion tournament in December", url: "https://www.dailyguardian.com.ph/bacolod-pickleball" }])
    // The source's own publication day comes with it (the story's date is taken from it).
    expect(out.sources?.[0].date).toMatch(/^2026-11-0\d$/)
    const stories = parseTrendStories(out.text, out.sources ?? [])
    expect(stories[0]).toMatchObject({ title: "Bacolod to host Pickleball Invasion tournament in December", verified: true })
  })

  it("uses the app's key when the user has none", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-app-key-0123456789")
    const out = await generate(trend(), null, null)
    expect(calls.filter((c) => c.url.includes("tavily")).every((c) => c.auth === "Bearer tvly-app-key-0123456789")).toBe(true)
    expect(out.search?.engine).toBe("tavily")
  })

  it("Tavily out of credits: Groq's web search instead, and says why", async () => {
    tavilyStatus = 432
    const out = await generate(trend(), null, KEY)
    const groq = calls.filter((c) => c.url.includes("groq"))
    expect(groq[0].body.tools).toEqual([{ type: "browser_search" }])
    expect(out.search).toEqual({ engine: "groq", note: expect.stringMatching(/credits for this month are used up/) })
  })

  it("no Tavily key at all: Groq's web search, as before", async () => {
    const out = await generate({ task: "carousel-research", topic: "Cebu food", cards: 5, avoid: [] }, null, null)
    expect(calls.some((c) => c.url.includes("tavily"))).toBe(false)
    expect(calls[0].body.tools).toEqual([{ type: "browser_search" }])
    expect(out.search).toEqual({ engine: "groq" })
  })

  it("no news in the window: an empty list (the panel says nothing new was found)", async () => {
    const out = await generate(trend({ day: "2026-11-20", days: 1 }), null, KEY)
    expect(out.text).toBe("STORIES:")
    expect(calls.some((c) => c.url.includes("groq"))).toBe(false)
  })
})
