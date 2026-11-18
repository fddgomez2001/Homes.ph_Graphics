import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanAnswer, generate, prompt } from "@/lib/ai/groq"
import { metaError, pagePost, pageRef, readPagePosts } from "@/lib/ai/meta-pages"
import { cachedSearch, clearSearchCache } from "@/lib/ai/search-cache"
import { isFacebookUrl, postQuery, postsInWindow, resultsBlock, resultSources, trendPostQueries, type TavilyResult } from "@/lib/ai/tavily"
import { keywordsIn, parseNewsArticle, parseTrendStories, placeIn, relevanceScore, sourceCheck } from "@/lib/ai/trend-news"
import { AI_HEADERS } from "@/lib/ai/types"
import { parseAiRequest, parseSearchSetup } from "@/lib/ai/validate"
import { perplexitySearchBody, SearchFailed, serpDay, serpError, serpParams, serpResults } from "@/lib/ai/web-search"

const TAVILY = "tvly-dev-abcdefghijklmnop1234"
const SERP = "a".repeat(64)
const META = `EAA${"b".repeat(40)}`

const trend = (over: Record<string, unknown> = {}) => ({
  task: "trend-search" as const,
  brand: "homes" as const,
  keywords: ["Caraga Real Estate News", "Butuan House and Lot", "Siargao Property Investment"],
  developers: ["Camella Homes"],
  day: "2026-11-10",
  days: 2,
  avoid: [],
  ...over,
})

describe("Public Facebook posts: the searches", () => {
  it("2 searches limited to facebook.com, without the word news, in the same days", () => {
    const qs = trendPostQueries(trend(), () => 0)
    expect(qs.map((q) => q.query)).toEqual(["Caraga Real Estate", "Camella Homes Caraga"])
    expect(qs.every((q) => q.include?.[0] === "facebook.com" && q.topic === "general" && !q.datedOnly && q.startDate === "2026-11-08" && q.endDate === "2026-11-11" && q.region === "PH")).toBe(true)
    // Without developers: the second is another keyword.
    expect(trendPostQueries(trend({ developers: [] }), () => 0).map((q) => q.query)).toEqual(["Caraga Real Estate", "Butuan House and Lot"])
    expect(postQuery("Pickleball News", "pickleplay")).toBe("Pickleball Philippines")
  })

  it("Facebook addresses, and posts kept when undated but never when older or later", () => {
    expect(isFacebookUrl("https://m.facebook.com/story.php?id=1")).toBe(true)
    expect(isFacebookUrl("https://www.facebook.com/CamellaHomes/posts/123")).toBe(true)
    expect(isFacebookUrl("https://notfacebook.com/x")).toBe(false)
    const r = (published: string | null): TavilyResult => ({ title: "t", url: "https://www.facebook.com/x", content: "", published })
    expect(postsInWindow([r(null), r("2026-11-09"), r("2026-11-01"), r("2026-11-11")], "2026-11-10", 2).map((x) => x.published)).toEqual([null, "2026-11-09"])
  })

  it("Perplexity searches only facebook.com for posts (its allow list), and leaves sites out otherwise", () => {
    const [q] = trendPostQueries(trend(), () => 0)
    expect(perplexitySearchBody(q).search_domain_filter).toEqual(["facebook.com"])
    expect(perplexitySearchBody({ ...q, include: undefined }).search_domain_filter).toEqual(expect.arrayContaining(["-facebook.com"]))
  })

  it("the AI is told which results are Facebook posts, and sources keep their date, kind and picture", () => {
    const results: TavilyResult[] = [
      { title: "Camella Caraga turnover", url: "https://www.facebook.com/camella/posts/1", content: "Turnover of 50 homes.", published: null, kind: "facebook" },
      { title: "Groundbreaking", url: "https://www.facebook.com/lgu/posts/2", content: "…", published: "2026-11-09", kind: "page", from: "Butuan City LGU", image: "https://scontent.example/p.jpg" },
    ]
    const block = resultsBlock(results)
    expect(block).toContain("TYPE: public Facebook post")
    expect(block).toContain("TYPE: Facebook Page post by Butuan City LGU")
    expect(resultSources(results)[1]).toEqual({ title: "Groundbreaking", url: "https://www.facebook.com/lgu/posts/2", date: "2026-11-09", kind: "page", from: "Butuan City LGU", image: "https://scontent.example/p.jpg" })
  })
})

describe("Google through SerpApi", () => {
  it("news searches use Google News with the days asked; posts use site:facebook.com", () => {
    const news = serpParams({ query: "Caraga Real Estate news", topic: "general", depth: "basic", maxResults: 8, startDate: "2026-11-08", endDate: "2026-11-11", datedOnly: true, country: "philippines", region: "PH" })
    expect(news).toMatchObject({ engine: "google", q: "Caraga Real Estate news", tbm: "nws", gl: "ph", hl: "en", num: "8", tbs: "cdr:1,cd_min:11/8/2026,cd_max:11/10/2026" })
    const [post] = trendPostQueries(trend(), () => 0)
    const p = serpParams(post)
    expect(p.q).toBe("site:facebook.com Caraga Real Estate")
    expect(p.tbm).toBeUndefined()
    // A topic search: Google's web results, no dates.
    expect(serpParams({ query: "lighthouses", topic: "general", depth: "advanced", maxResults: 14, country: "united arab emirates" })).toEqual({ engine: "google", q: "lighthouses", hl: "en", num: "10", gl: "ae" })
  })

  it("reads Google's dates: published_at first, then '3 hours ago', 'Yesterday' or 'Nov 8, 2026'", () => {
    const now = new Date("2026-11-10T06:00:00Z")
    expect(serpDay("3 hours ago", "2026-11-09 22:15:00 UTC", now)).toBe("2026-11-09")
    expect(serpDay("2 days ago", null, now)).toBe("2026-11-08")
    expect(serpDay("1 week ago", null, now)).toBe("2026-11-03")
    expect(serpDay("Yesterday", null, now)).toBe("2026-11-09")
    expect(serpDay("Nov 8, 2026", null, now)).toBe("2026-11-08")
    expect(serpDay("Sponsored", null, now)).toBeNull()
    expect(serpDay(undefined, undefined, now)).toBeNull()
  })

  it("results: left-out sites dropped (Google News can't take -site:), Facebook posts marked, thumbnails kept", () => {
    const now = new Date("2026-11-10T06:00:00Z")
    const body = {
      news_results: [
        { title: "Butuan gets new mall", link: "https://www.pna.gov.ph/articles/1", source: "PNA", date: "5 hours ago", snippet: "A new mall…", thumbnail: "https://serpapi.com/t.jpg" },
        { title: "Listing", link: "https://www.facebook.com/x", date: "1 day ago" },
        { title: "No date", link: "https://news.ph/x" },
        { title: "Own site", link: "https://homes.ph/news/1", date: "1 day ago" },
      ],
    }
    const out = serpResults(body, { query: "q", topic: "news", depth: "basic", maxResults: 8, datedOnly: true, exclude: ["homes.ph"] }, now)
    expect(out).toEqual([{ title: "Butuan gets new mall", url: "https://www.pna.gov.ph/articles/1", content: "PNA. A new mall…", published: "2026-11-10", image: "https://serpapi.com/t.jpg" }])
    const posts = serpResults({ organic_results: [{ title: "Camella Caraga | Facebook", link: "https://m.facebook.com/camella/posts/9", snippet: "Turnover…", date: "2 days ago" }, { title: "x", link: "https://other.ph/a" }] }, trendPostQueries(trend(), () => 0)[0], now)
    expect(posts).toEqual([{ title: "Camella Caraga | Facebook", url: "https://m.facebook.com/camella/posts/9", content: "Turnover…", published: "2026-11-08", kind: "facebook" }])
  })

  it("errors in plain words", () => {
    expect(serpError(401).message).toMatch(/SerpApi key was rejected/)
    expect(serpError(429, "Your account has run out of searches.").message).toMatch(/used up \(the free plan has 250\)/)
    expect(serpError(429).message).toMatch(/too many searches this hour/)
    expect(serpError(503).status).toBe(503)
  })
})

describe("Facebook Pages with a Meta token", () => {
  it("what was typed → the Page for the Graph API (groups, events and post links aren't Pages)", () => {
    expect(pageRef("https://www.facebook.com/CamellaHomesOfficial/")).toBe("CamellaHomesOfficial")
    expect(pageRef("facebook.com/profile.php?id=100064123456789")).toBe("100064123456789")
    expect(pageRef("https://web.facebook.com/pages/Some-Page/123456789012")).toBe("123456789012")
    expect(pageRef("@pickleplayph")).toBe("pickleplayph")
    expect(pageRef("1234567890")).toBe("1234567890")
    expect(pageRef("https://www.facebook.com/groups/abc")).toBeNull()
    expect(pageRef("https://www.facebook.com/events/123")).toBeNull()
    expect(pageRef("not a page!")).toBeNull()
  })

  it("Graph API errors in plain words", () => {
    expect(metaError({ code: 190, message: "Session expired" })).toMatch(/expired or was rejected/)
    expect(metaError({ code: 10, message: "x" }, "SMDC")).toMatch(/didn't allow reading SMDC: a token reads only the Pages you manage/)
    expect(metaError({ code: 200 }, "SMDC")).toMatch(/Page Public Content Access/)
    expect(metaError({ code: 100, message: "Object with ID 'x' does not exist, cannot be loaded due to missing permissions" }, "x")).toMatch(/wasn't found/)
    expect(metaError({ code: 4 })).toMatch(/limit/)
  })

  it("a post → a result (its permalink, day, photo and Page); posts without words are left out", () => {
    const post = pagePost({ id: "1_2", message: "Groundbreaking of our new Butuan township today!\nMore soon.", created_time: "2026-11-09T03:15:00+0000", permalink_url: "https://www.facebook.com/1/posts/2", full_picture: "https://scontent.example/x.jpg", from: { name: "Camella Caraga" } }, "camella")
    expect(post).toEqual({
      title: "Groundbreaking of our new Butuan township today!",
      url: "https://www.facebook.com/1/posts/2",
      content: "Groundbreaking of our new Butuan township today! More soon.",
      published: "2026-11-09",
      kind: "page",
      from: "Camella Caraga",
      image: "https://scontent.example/x.jpg",
    })
    expect(pagePost({ id: "1_3", message: "Hi" }, "camella")).toBeNull()
  })

  it("reads each Page (the token in the request only); a Page it may not read is an error, the rest still count", async () => {
    const urls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        urls.push(url)
        if (url.includes("/SMDC/")) return new Response(JSON.stringify({ error: { code: 10, message: "Requires pages_read_engagement" } }), { status: 403 })
        return new Response(JSON.stringify({ data: [{ id: "1_2", message: "Turnover of 50 new homes in Butuan City this week.", created_time: "2026-11-09T03:15:00+0000", permalink_url: "https://www.facebook.com/1/posts/2" }] }), { status: 200 })
      }),
    )
    try {
      const out = await readPagePosts(META, ["facebook.com/CamellaCaraga", "SMDC", "facebook.com/groups/x"], "2026-11-10", 2, AbortSignal.timeout(5000))
      expect(out.read).toBe(1)
      expect(out.results).toHaveLength(1)
      expect(out.errors[0]).toMatch(/didn't allow reading SMDC/)
      expect(urls).toHaveLength(2)
      expect(urls[0]).toContain("https://graph.facebook.com/v27.0/CamellaCaraga/posts?")
      expect(urls[0]).toContain(`since=${Date.parse("2026-11-08T00:00:00Z") / 1000}`)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe("Trending news: Facebook posts when no news with a link is found", () => {
  type Call = { url: string; body: Record<string, unknown> }
  let calls: Call[]
  let newsResults: unknown[]
  const POSTS_ANSWER = "STORIES:\n1. Camella Caraga turns over 50 homes in Butuan | 2026-11-09 | https://www.facebook.com/camellacaraga/posts/123 | Camella Caraga posted that 50 families got their homes. | homes turned over"
  const NEWS_ANSWER = "STORIES:\n1. Butuan gets a new mall | 2026-11-09 | https://www.pna.gov.ph/articles/1 | A new mall opens in Butuan City. | first big mall"

  beforeEach(() => {
    calls = []
    newsResults = []
    vi.stubEnv("GROQ_API_KEY", "gsk_test")
    vi.stubEnv("TAVILY_API_KEY", "")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
        calls.push({ url, body })
        if (url.startsWith("https://api.tavily.com/search")) {
          if (Array.isArray(body.include_domains)) {
            return new Response(JSON.stringify({ results: [{ title: "Camella Caraga", url: "https://www.facebook.com/camellacaraga/posts/123", content: "50 families got their homes.", published_date: "Mon, 09 Nov 2026 02:00:00 GMT" }], usage: { credits: 1 } }))
          }
          return new Response(JSON.stringify({ results: newsResults, usage: { credits: 1 } }))
        }
        if (url.startsWith("https://serpapi.com/search.json")) {
          return new Response(JSON.stringify({ news_results: [{ title: "Butuan gets a new mall", link: "https://www.pna.gov.ph/articles/1", date: "1 day ago", published_at: "2026-11-09 03:00:00 UTC", snippet: "A new mall…" }] }))
        }
        if (url.startsWith("https://graph.facebook.com/")) {
          return new Response(JSON.stringify({ data: [{ id: "9_9", message: "Groundbreaking of the Butuan City township today, with 300 homes.", created_time: "2026-11-09T03:15:00+0000", permalink_url: "https://www.facebook.com/9/posts/9" }] }))
        }
        // Groq: the posts answer when it was given Facebook posts only, else no story.
        const messages = JSON.stringify(body.messages ?? "")
        const content = messages.includes("no news article was found") ? POSTS_ANSWER : messages.includes("pna.gov.ph") ? NEWS_ANSWER : "STORIES:"
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }))
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("no news: 2 Facebook searches, then the AI picks from the posts", async () => {
    const out = await generate(trend(), null, { engine: "auto", tavily: TAVILY })
    const tavily = calls.filter((c) => c.url.includes("tavily"))
    // 4 news searches (the main keyword, the developer, the 2 other keywords: 1.47), then 2 for Facebook posts.
    expect(tavily).toHaveLength(6)
    expect(tavily.filter((c) => Array.isArray(c.body.include_domains))).toHaveLength(2)
    expect(out.search?.posts).toMatchObject({ why: "no-news", engine: "tavily", found: 1, credits: 2 })
    const stories = parseTrendStories(out.text, out.sources ?? [])
    expect(stories[0]).toMatchObject({ title: "Camella Caraga turns over 50 homes in Butuan", kind: "facebook", verified: true, dateText: "2026-11-09" })
  })

  it("news found: no Facebook search; 'Off' never searches them; 'Always' searches them with the news", async () => {
    newsResults = [{ title: "Butuan gets a new mall", url: "https://www.pna.gov.ph/articles/1", content: "A new mall…", published_date: "Mon, 09 Nov 2026 02:00:00 GMT" }]
    const found = await generate(trend(), null, { engine: "auto", tavily: TAVILY })
    expect(calls.filter((c) => c.url.includes("tavily"))).toHaveLength(4)
    expect(found.search?.posts).toBeUndefined()
    calls = []
    newsResults = []
    const off = await generate(trend({ posts: "off" }), null, { engine: "auto", tavily: TAVILY })
    expect(calls.filter((c) => c.url.includes("tavily"))).toHaveLength(4)
    expect(off.text).toBe("STORIES:")
    calls = []
    newsResults = [{ title: "Butuan gets a new mall", url: "https://www.pna.gov.ph/articles/1", content: "A new mall…", published_date: "Mon, 09 Nov 2026 02:00:00 GMT" }]
    const always = await generate(trend({ posts: "always" }), null, { engine: "auto", tavily: TAVILY })
    expect(calls.filter((c) => c.url.includes("tavily"))).toHaveLength(6)
    expect(always.search?.posts).toMatchObject({ why: "always", found: 1 })
    expect(JSON.stringify(calls.find((c) => c.url.includes("groq"))?.body)).toContain("TYPE: public Facebook post")
  })

  it("Google (SerpApi): Google News searches with the key in the request; its Facebook posts go first when no news", async () => {
    const out = await generate(trend(), null, { engine: "serpapi", serpapi: SERP, tavily: TAVILY })
    const serp = calls.filter((c) => c.url.includes("serpapi.com"))
    expect(serp).toHaveLength(4)
    expect(serp.every((c) => c.url.includes("tbm=nws") && c.url.includes(`api_key=${SERP}`))).toBe(true)
    expect(out.search).toMatchObject({ engine: "serpapi", credits: 4, keywordsUsed: 3 })
    expect(parseTrendStories(out.text, out.sources ?? [])[0]).toMatchObject({ url: "https://www.pna.gov.ph/articles/1", dateText: "2026-11-09" })
  })

  it("Facebook Pages (Meta token): their posts are read first and given to the AI", async () => {
    newsResults = []
    const out = await generate(trend({ pages: ["facebook.com/ButuanCityLGU"], posts: "off" }), null, { engine: "auto", tavily: TAVILY, meta: META })
    expect(calls.some((c) => c.url.startsWith("https://graph.facebook.com/v27.0/ButuanCityLGU/posts"))).toBe(true)
    expect(out.search?.meta).toEqual({ pages: 1, posts: 1, errors: [] })
    expect(JSON.stringify(calls.find((c) => c.url.includes("groq"))?.body)).toContain("TYPE: Facebook Page post")
    expect(out.sources?.some((s) => s.kind === "page")).toBe(true)
  })
})

describe("Search cache and one retry", () => {
  const q = { query: "Caraga", topic: "news" as const, depth: "basic" as const, maxResults: 8 }
  beforeEach(() => {
    vi.stubEnv("DCM_SEARCH_CACHE", "1")
    clearSearchCache()
  })
  afterEach(() => vi.unstubAllEnvs())

  it("the same search again within 30 minutes is free; another key isn't answered from it", async () => {
    const run = vi.fn(async () => ({ results: [{ title: "a", url: "https://a.ph", content: "", published: null }], credits: 1 }))
    const signal = AbortSignal.timeout(5000)
    expect((await cachedSearch("tavily", TAVILY, q, signal, run)).credits).toBe(1)
    expect((await cachedSearch("tavily", TAVILY, q, signal, run)).credits).toBe(0)
    expect(run).toHaveBeenCalledTimes(1)
    await cachedSearch("tavily", "tvly-other-key-0123456789", q, signal, run)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("a service failure (5xx) is tried once more; a rejected key isn't", async () => {
    const signal = AbortSignal.timeout(5000)
    let n = 0
    const flaky = vi.fn(async () => {
      if (n++ === 0) throw new SearchFailed("down", 503, "serpapi")
      return { results: [], credits: 1 }
    })
    await expect(cachedSearch("serpapi", SERP, q, signal, flaky, 1)).resolves.toEqual({ results: [], credits: 1 })
    expect(flaky).toHaveBeenCalledTimes(2)
    const bad = vi.fn(async () => {
      throw new SearchFailed("rejected", 401, "serpapi")
    })
    await expect(cachedSearch("serpapi", SERP, { ...q, query: "x" }, signal, bad, 1)).rejects.toThrow("rejected")
    expect(bad).toHaveBeenCalledTimes(1)
  })
})

describe("Each story's checks", () => {
  it("the source's own date beats the AI's; Facebook links are posts; the picture comes from the source", () => {
    const text = "STORIES:\n1. Mall opens | 2026-11-10 | https://www.pna.gov.ph/a | A mall. | big\n2. Turnover | | https://m.facebook.com/camella/posts/1 | 50 homes. | homes"
    const stories = parseTrendStories(text, [
      { title: "Mall", url: "https://www.pna.gov.ph/a", date: "2026-11-09", image: "https://serpapi.com/t.jpg" },
      { title: "Camella", url: "https://www.facebook.com/camella/posts/1", kind: "facebook" },
    ])
    expect(stories[0]).toMatchObject({ dateText: "2026-11-09", kind: "news", image: "https://serpapi.com/t.jpg" })
    expect(stories[1]).toMatchObject({ dateText: "", kind: "facebook", verified: true })
  })

  it("keywords and place named, the source checked, and the score", () => {
    expect(keywordsIn("New house and lot project opens in Butuan City", ["Butuan House and Lot", "Siargao Property Investment"])).toEqual(["Butuan House and Lot"])
    expect(placeIn("A township in Surigao del Norte", "homes")).toBe("Surigao del Norte")
    // Homes.ph Gensan is General Santos City only (1.47): T'boli is another town.
    expect(placeIn("A new mall in Barangay Lagao, GenSan", "gensan")).toBe("GenSan")
    expect(placeIn("A resort opens in Lagao", "gensan")).toBe("Lagao")
    expect(placeIn("Tboli and T'boli", "gensan")).toBe("")
    expect(sourceCheck({ kind: "news", verified: true, site: "pna.gov.ph", url: "" })).toBe("official")
    expect(sourceCheck({ kind: "news", verified: true, site: "inquirer.net", url: "" })).toBe("trusted")
    expect(sourceCheck({ kind: "news", verified: false, site: "x.ph", url: "" })).toBe("unconfirmed")
    expect(sourceCheck({ kind: "facebook", verified: true, site: "facebook.com", url: "" })).toBe("post")
    const base = { age: 0, days: 2, check: "trusted" as const, partner: true, keywords: 2, place: true, negative: false, repeat: false, trending: true }
    const best = relevanceScore(base)
    expect(best).toBeGreaterThanOrEqual(80)
    expect(relevanceScore({ ...base, negative: true })).toBeLessThan(best - 30)
    expect(relevanceScore({ ...base, age: null, check: "post", partner: false })).toBeLessThan(relevanceScore({ ...base, partner: false }))
  })
})

describe("Write article", () => {
  const ANSWER = `HEADLINE: Butuan Gets Its First Big Mall
SHORT ARTICLE:
A new mall opened in Butuan City on November 9, 2026.

DETAILED ARTICLE:
Paragraph one.

Paragraph two.
CAPTION:
Butuan has a new place to shop. #HomesPH #ButuanCity
HASHTAGS:
CAROUSEL:
1. Butuan's New Mall | A first for the city
2. What's inside | 120 shops
IMAGE PROMPT: A bright modern mall at dusk, no people, no logos.
CONFIRMED FACTS:
- The mall opened on November 9, 2026.
- It has 120 shops.
AI NOTES:
- This may draw more buyers to nearby subdivisions.`

  it("reads every part; hashtags from the caption when the line is empty; paragraphs kept", () => {
    const d = parseNewsArticle(cleanAnswer(ANSWER, "news-article"))!
    expect(d.headline).toBe("Butuan Gets Its First Big Mall")
    expect(d.detailed).toBe("Paragraph one.\n\nParagraph two.")
    expect(d.caption).toBe("Butuan has a new place to shop.")
    expect(d.hashtags).toEqual(["#HomesPH", "#ButuanCity"])
    expect(d.carousel).toEqual([
      { title: "Butuan's New Mall", text: "A first for the city" },
      { title: "What's inside", text: "120 shops" },
    ])
    expect(d.facts).toHaveLength(2)
    expect(d.notes[0]).toMatch(/^This may/)
    expect(parseNewsArticle("nothing useful")).toBeNull()
  })

  it("the request and its prompt: only the story's facts, no invented quotes", () => {
    expect(parseAiRequest({ task: "news-article", article: "short", brand: "Homes.ph CARAGA" })).toMatch(/too short/)
    const req = parseAiRequest({ task: "news-article", article: "A new mall opened in Butuan City on November 9, 2026, with 120 shops and a cinema.", brand: "Homes.ph CARAGA", source: "pna.gov.ph" })
    if (typeof req === "string") throw new Error(req)
    const p = prompt(req)
    expect(p.system).toMatch(/Never invent quotes, numbers/)
    expect(p.system).toMatch(/CONFIRMED FACTS lists only facts the story states/)
    expect(p.user).toContain("SOURCE: pna.gov.ph")
    expect(p.user).toContain("PLACE: name where in Caraga")
  })
})

describe("Requests and headers", () => {
  it("trend-search: the posts choice (fallback by default) and at most 10 Pages", () => {
    const req = parseAiRequest({ ...trend(), posts: "always", pages: Array.from({ length: 14 }, (_, i) => `Page${i}`) })
    if (typeof req === "string") throw new Error(req)
    expect(req).toMatchObject({ posts: "always" })
    expect((req as { pages?: string[] }).pages).toHaveLength(10)
    expect(parseAiRequest({ ...trend(), posts: "sometimes" })).toMatchObject({ posts: "fallback" })
  })

  it("SerpApi and Meta keys only when they look right", () => {
    const h = new Headers({ [AI_HEADERS.serpapi]: SERP, [AI_HEADERS.meta]: META })
    expect(parseSearchSetup(h)).toMatchObject({ serpapi: SERP, meta: META })
    expect(parseSearchSetup(new Headers({ [AI_HEADERS.serpapi]: "short", [AI_HEADERS.meta]: "not-a-token" }))).toMatchObject({ serpapi: null, meta: null })
    expect(parseSearchSetup(new Headers({ [AI_HEADERS.searchEngine]: "serpapi" })).engine).toBe("serpapi")
  })
})
