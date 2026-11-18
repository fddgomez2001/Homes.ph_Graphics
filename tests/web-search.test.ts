import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generate, searchEngines } from "@/lib/ai/groq"
import { callProvider, perplexityText, providersForKey } from "@/lib/ai/providers"
import { trendQueries } from "@/lib/ai/tavily"
import { parseTrendStories } from "@/lib/ai/trend-news"
import { AI_HEADERS, aiProvider } from "@/lib/ai/types"
import { parseSearchSetup } from "@/lib/ai/validate"
import { perplexityResults, perplexitySearchBody, resolveGoogleLinks } from "@/lib/ai/web-search"

const PPLX = "pplx-test0123456789abcdefABCDEF"
const TAVILY = "tvly-dev-abcdefghijklmnop1234"
const GEMINI = "AIzaSyTest0123456789abcdefghijk"

const trend = (over: Partial<{ day: string; days: number }> = {}) => ({
  task: "trend-search" as const,
  brand: "pickleplay" as const,
  keywords: ["Pickleball Philippines", "Pickleball News", "Pickleball Equipment"],
  day: "2026-11-09",
  days: 2,
  avoid: [],
  ...over,
})

describe("Perplexity: the Search API request and its results", () => {
  it("asks for the same searches as Tavily: dates (MM/DD/YYYY), sites left out, country code", () => {
    const [q] = trendQueries(trend(), () => 0)
    const body = perplexitySearchBody(q)
    expect(body.query).toBe(q.query)
    expect(body.max_results).toBe(10)
    // PicklePlay keeps to the Philippines (1.47).
    expect(body.country).toBe("PH")
    expect(body.search_after_date_filter).toBe("11/07/2026")
    expect(body.search_before_date_filter).toBe("11/10/2026")
    expect(body.search_domain_filter).toEqual(expect.arrayContaining(["-facebook.com", "-pickleplay.ph"]))
    expect((body.search_domain_filter as string[]).length).toBeLessThanOrEqual(20)
    const homes = perplexitySearchBody({ query: "Caraga news", topic: "general", depth: "advanced", maxResults: 40, country: "philippines" })
    expect(homes).toMatchObject({ country: "PH", max_results: 20, max_tokens_per_page: 1024 })
  })

  it("reads the results like Tavily's (news keeps only dated pages)", () => {
    const list = [
      { title: "Bacolod hosts a pickleball open", url: "https://news.ph/a", snippet: "Bacolod…", date: "2026-11-08" },
      { title: "No date", url: "https://news.ph/b", snippet: "…", date: null, last_updated: "2026-11-08" },
      { title: "Bad", url: "ftp://x" },
    ]
    expect(perplexityResults(list, true)).toEqual([{ title: "Bacolod hosts a pickleball open", url: "https://news.ph/a", content: "Bacolod…", published: "2026-11-08" }])
    expect(perplexityResults(list, false).map((r) => r.published)).toEqual(["2026-11-08", "2026-11-08"])
  })
})

describe("Choosing the web search", () => {
  type Call = { url: string; body: Record<string, unknown>; auth: string; method: string }
  let calls: Call[]
  let perplexityStatus = 200
  const ANSWER = "STORIES:\n1. Bacolod hosts a pickleball open | 2026-11-08 | https://news.ph/a | Bacolod City hosts a big open. | big regional tournament"

  beforeEach(() => {
    calls = []
    perplexityStatus = 200
    vi.stubEnv("GROQ_API_KEY", "gsk_test")
    vi.stubEnv("TAVILY_API_KEY", "")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const headers = (init?.headers ?? {}) as Record<string, string>
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
        calls.push({ url, body, auth: headers.authorization ?? headers["x-goog-api-key"] ?? "", method: init?.method ?? "GET" })
        if (url === "https://api.perplexity.ai/search") {
          if (perplexityStatus !== 200) return new Response(JSON.stringify({ error: { message: "bad key" } }), { status: perplexityStatus })
          return new Response(JSON.stringify({ id: "s1", results: [{ title: "Bacolod hosts a pickleball open", url: "https://news.ph/a", snippet: "Bacolod City…", date: "2026-11-08" }] }), { status: 200 })
        }
        if (url.startsWith("https://api.tavily.com/search")) {
          return new Response(JSON.stringify({ results: [{ title: "Bacolod hosts a pickleball open", url: "https://news.ph/a", content: "…", published_date: "2026-11-08" }], usage: { credits: 1 } }), { status: 200 })
        }
        if (url.includes("generativelanguage.googleapis.com") && url.endsWith(":generateContent")) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: { parts: [{ text: ANSWER.replace("https://news.ph/a", "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC123") }] },
                  groundingMetadata: { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC123", title: "news.ph" } }] },
                },
              ],
            }),
            { status: 200 },
          )
        }
        if (url.includes("generativelanguage.googleapis.com/v1beta/models?")) {
          return new Response(JSON.stringify({ models: [{ name: "models/gemini-3.6-flash", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 })
        }
        if (url.startsWith("https://vertexaisearch.cloud.google.com/")) return new Response(null, { status: 302, headers: { location: "https://news.ph/a" } })
        // Groq (writing, or browsing)
        return new Response(JSON.stringify({ choices: [{ message: { content: ANSWER, executed_tools: [] } }] }), { status: 200 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("Perplexity chosen: 3 Perplexity searches, then the writing AI picks from them", async () => {
    const out = await generate(trend(), null, { engine: "perplexity", perplexity: PPLX })
    const searches = calls.filter((c) => c.url === "https://api.perplexity.ai/search")
    expect(searches).toHaveLength(3)
    expect(searches.every((c) => c.auth === `Bearer ${PPLX}` && c.method === "POST")).toBe(true)
    const writing = calls.filter((c) => c.url.includes("groq"))
    expect(writing).toHaveLength(1)
    expect(writing[0].body.tools).toBeUndefined()
    expect(JSON.stringify(writing[0].body.messages)).toContain("SEARCH RESULTS")
    expect(out.search).toEqual({ engine: "perplexity", credits: 3, queries: searches.map((c) => c.body.query), keywordsUsed: 3 })
    expect(parseTrendStories(out.text, out.sources ?? [])[0]).toMatchObject({ verified: true })
  })

  it("Perplexity refuses: the next engine with a key searches, and says why", async () => {
    perplexityStatus = 401
    const out = await generate(trend(), null, { engine: "perplexity", perplexity: PPLX, tavily: TAVILY })
    expect(calls.some((c) => c.url.startsWith("https://api.tavily.com/search"))).toBe(true)
    expect(out.search).toMatchObject({ engine: "tavily", credits: 3, note: expect.stringMatching(/Perplexity API key was rejected/) })
  })

  it("Gemini chosen: Google Search in one go, Google's links turned into the real pages", async () => {
    const out = await generate(trend(), null, { engine: "gemini", gemini: GEMINI })
    const call = calls.find((c) => c.url.endsWith(":generateContent"))!
    expect(call.url).toContain("/models/gemini-3.6-flash:generateContent")
    expect(call.auth).toBe(GEMINI)
    expect(call.body.tools).toEqual([{ google_search: {} }])
    expect(out.text).toContain("https://news.ph/a")
    expect(out.text).not.toContain("vertexaisearch")
    expect(out.sources).toEqual([{ title: "news.ph", url: "https://news.ph/a" }])
    expect(out.search).toEqual({ engine: "gemini" })
  })

  it("Automatic: Tavily, then Perplexity, Groq, Gemini (only those with a key)", () => {
    expect(searchEngines({ engine: "auto", perplexity: PPLX, gemini: GEMINI }).map((e) => e.id)).toEqual(["perplexity", "groq", "gemini"])
    expect(searchEngines({ engine: "gemini", perplexity: PPLX, gemini: GEMINI }).map((e) => e.id)).toEqual(["gemini", "perplexity", "groq"])
    vi.stubEnv("GROQ_API_KEY", "")
    expect(searchEngines({ engine: "auto" }).map((e) => e.id)).toEqual([])
    // The writing AI's own key can search too.
    expect(searchEngines({ engine: "auto" }, { provider: "perplexity", key: PPLX }).map((e) => e.id)).toEqual(["perplexity"])
  })

  it("no key that can search: a clear message (no request is made)", async () => {
    vi.stubEnv("GROQ_API_KEY", "")
    await expect(generate(trend(), null, { engine: "auto" })).rejects.toThrow(/needs a web search key: Tavily, SerpApi \(Google\), Perplexity, Groq or Gemini/)
    expect(calls).toHaveLength(0)
  })

  it("PicklePlay facts look up their links with Perplexity when it's chosen", async () => {
    await generate({ task: "pickleball-post", kind: "trivia", topic: "the Erne", avoid: [] }, null, { engine: "perplexity", perplexity: PPLX })
    expect(calls.some((c) => c.url === "https://api.perplexity.ai/search" && /Erne/.test(String(c.body.query)))).toBe(true)
  })
})

describe("Keys and headers", () => {
  it("a pplx- key is Perplexity's", () => {
    expect(providersForKey(PPLX)).toEqual(["perplexity"])
    expect(aiProvider("perplexity")?.defaultModel).toBe("perplexity/sonar")
  })

  it("search headers: only well-formed keys, a known engine (else Automatic)", () => {
    const h = new Headers({
      [AI_HEADERS.searchEngine]: "perplexity",
      [AI_HEADERS.perplexity]: PPLX,
      [AI_HEADERS.gemini]: "not-a-gemini-key",
      [AI_HEADERS.groq]: "gsk_abcdefghijklmnop",
      [AI_HEADERS.tavily]: TAVILY,
    })
    expect(parseSearchSetup(h)).toEqual({ engine: "perplexity", perplexity: PPLX, gemini: null, groq: "gsk_abcdefghijklmnop", tavily: TAVILY, serpapi: null, meta: null })
    expect(parseSearchSetup(new Headers({ [AI_HEADERS.searchEngine]: "bing" })).engine).toBe("auto")
  })

  it("Google's redirect links: resolved without following them (others left alone)", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://real.example/page" } })) as unknown as typeof fetch
    const map = await resolveGoogleLinks(["https://vertexaisearch.cloud.google.com/grounding-api-redirect/x", "https://other.example/"], fetcher)
    expect([...map]).toEqual([["https://vertexaisearch.cloud.google.com/grounding-api-redirect/x", "https://real.example/page"]])
  })
})

describe("Perplexity writes through its Agent API", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("sends instructions + input (no web search tool) and reads the message text", async () => {
    let sent: { url: string; body: Record<string, unknown> } | null = null
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        sent = { url: String(input), body: JSON.parse(String(init?.body)) }
        return new Response(
          JSON.stringify({ id: "resp_1", object: "response", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Pickleball Courts Open [1] In Cebu" }] }] }),
          { status: 200 },
        )
      }),
    )
    const out = await callProvider({ provider: "perplexity", key: PPLX }, { system: "rules", user: "article", maxTokens: 100, temperature: 0.5, signal: AbortSignal.timeout(5000) })
    expect(sent!.url).toBe("https://api.perplexity.ai/v1/agent")
    expect(sent!.body).toMatchObject({ model: "perplexity/sonar", instructions: "rules", input: "article", temperature: 0.5 })
    expect(sent!.body.tools).toBeUndefined()
    expect(Number(sent!.body.max_output_tokens)).toBeGreaterThanOrEqual(100)
    expect(out).toEqual({ text: "Pickleball Courts Open In Cebu", model: "perplexity/sonar" })
  })

  it("reads output_text when given, and drops [web:1] marks", () => {
    expect(perplexityText({ output_text: "A fact [web:2]." })).toBe("A fact.")
  })
})
