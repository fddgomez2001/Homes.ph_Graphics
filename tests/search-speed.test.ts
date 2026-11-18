import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generate, searchAll, soonestRetry } from "@/lib/ai/groq"

const KEY = "tvly-dev-abcdefghijklmnop1234"
const trend = () => ({
  task: "trend-search" as const,
  brand: "pickleplay" as const,
  keywords: ["Pickleball Philippines", "Pickleball News", "Pickleball Equipment", "Pickleball Tournament Philippines"],
  day: "2026-11-09",
  days: 2,
  avoid: [],
})
const ANSWER = "STORIES:\n1. Bacolod to host Pickleball Invasion tournament in December | 2026-11-08 | https://www.dailyguardian.com.ph/bacolod-pickleball | Bacolod City will host a major pickleball event. | big regional tournament"
const TAVILY_RESULTS = JSON.stringify({
  results: [{ title: "Bacolod to host Pickleball Invasion tournament in December", url: "https://www.dailyguardian.com.ph/bacolod-pickleball", content: "Bacolod City is preparing…", published_date: "Sun, 08 Nov 2026 16:00:00 GMT" }],
  usage: { credits: 1 },
})

describe("soonestRetry: wait only when every Groq model is at its limit", () => {
  it("tries the next model first (no waiting)", () => {
    expect(soonestRetry([{ at: 0, wait: 16 }], 0, 3, false, 20)).toBeNull()
    expect(soonestRetry([{ at: 0, wait: 16 }, { at: 1, wait: 9 }], 1, 3, false, 20)).toBeNull()
  })
  it("all limited: the model that frees up soonest, once", () => {
    const limited = [
      { at: 0, wait: 16 },
      { at: 1, wait: 9 },
      { at: 2, wait: 30 },
    ]
    expect(soonestRetry(limited, 2, 3, false, 20)).toEqual({ at: 1, wait: 9 })
    expect(soonestRetry(limited, 2, 3, true, 20)).toBeNull()
  })
  it("all limited for longer than a short wait: gives up (the message says how long)", () => {
    expect(soonestRetry([{ at: 0, wait: 45 }, { at: 1, wait: 0 }], 1, 2, false, 25)).toBeNull()
  })
})

describe("searchAll: one slow Tavily search doesn't hold up the others", () => {
  const sleep = (ms: number, signal: AbortSignal, value: string) =>
    new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => resolve(value), ms)
      signal.addEventListener("abort", () => {
        clearTimeout(t)
        reject(new Error("aborted"))
      })
    })

  it("all quick: every result, nothing cut", async () => {
    const out = await searchAll([10, 20, 30], (ms, s) => sleep(ms, s, `r${ms}`), 1000, 200)
    expect(out.settled.map((s) => s.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"])
    expect(out.cutShort).toEqual([])
  })

  it("a straggler is stopped a grace period after the first answer", async () => {
    const start = Date.now()
    const out = await searchAll([10, 20, 5000], (ms, s) => sleep(ms, s, `r${ms}`), 10_000, 100)
    expect(Date.now() - start).toBeLessThan(1000)
    expect(out.settled.map((s) => s.status)).toEqual(["fulfilled", "fulfilled", "rejected"])
    expect(out.cutShort).toEqual([5000])
  })

  it("a search that failed on its own isn't counted as cut short", async () => {
    const out = await searchAll([10, -1], (ms, s) => (ms < 0 ? Promise.reject(new Error("432")) : sleep(ms, s, "ok")), 1000, 100)
    expect(out.settled.map((s) => s.status)).toEqual(["fulfilled", "rejected"])
    expect(out.cutShort).toEqual([])
  })

  it("nothing answers: everything is stopped at the timeout", async () => {
    const start = Date.now()
    const out = await searchAll([5000, 5000], (ms, s) => sleep(ms, s, "x"), 100, 50)
    expect(Date.now() - start).toBeLessThan(1000)
    expect(out.settled.every((s) => s.status === "rejected")).toBe(true)
    expect(out.cutShort).toEqual([])
  })
})

describe("Trending news when Groq's per-minute limit is hit", () => {
  let groqModels: string[]
  let limitedModels: Record<string, number>
  beforeEach(() => {
    groqModels = []
    limitedModels = {}
    vi.stubEnv("GROQ_API_KEY", "gsk_test")
    vi.stubEnv("GROQ_MODEL", "")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.startsWith("https://api.tavily.com/search")) return new Response(TAVILY_RESULTS, { status: 200 })
        const model = String(JSON.parse(String(init?.body)).model)
        groqModels.push(model)
        const wait = limitedModels[model]
        if (wait !== undefined) return new Response(JSON.stringify({ error: { message: "Rate limit reached" } }), { status: 429, headers: { "retry-after": String(wait) } })
        return new Response(JSON.stringify({ choices: [{ message: { content: ANSWER } }] }), { status: 200 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("the second model answers at once (it used to wait up to 20 seconds for the first)", async () => {
    limitedModels = { "openai/gpt-oss-120b": 16 }
    const start = Date.now()
    const out = await generate(trend(), null, KEY)
    expect(Date.now() - start).toBeLessThan(2000)
    expect(groqModels).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"])
    expect(out.text).toContain("Bacolod")
    // One search per keyword (4 here; 5 at most without "Look for" kinds: 1.47).
    expect(out.search).toMatchObject({ engine: "tavily", credits: 4, keywordsUsed: 4 })
  })

  it("every model limited for long: says when to try again, without waiting", async () => {
    limitedModels = { "openai/gpt-oss-120b": 50, "openai/gpt-oss-20b": 45, "qwen/qwen3.8-27b": 60 }
    const start = Date.now()
    await expect(generate(trend(), null, KEY)).rejects.toThrow(/try again in about \d+ seconds/)
    expect(Date.now() - start).toBeLessThan(2000)
    expect(groqModels).toHaveLength(3)
  })
})
