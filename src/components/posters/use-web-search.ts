"use client"

import { useEffect, useState } from "react"
import { searchEngineInUse, tavilyStatus } from "@/lib/ai/client"
import type { SearchEngineId } from "@/lib/ai/types"
import { getIntegrationStatus } from "@/lib/data/assets"

/** The app's own keys (asked once): Tavily's from the server, Groq's from the health check. */
let builtIn: { tavily: boolean; groq: boolean } | null = null

/**
 * Which engine searches the web for Trending news and Search a topic: the one chosen in Settings → AI
 * when it has a key, else the first with one (Tavily, SerpApi, Perplexity, Groq, Gemini). Nothing is searched.
 */
export function useWebSearchEngine(): SearchEngineId | null {
  const [engine, setEngine] = useState<SearchEngineId | null>(() => (builtIn ? searchEngineInUse(builtIn) : null))
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!builtIn) {
        const [tavily, status] = await Promise.all([tavilyStatus().catch(() => null), getIntegrationStatus().catch(() => null)])
        builtIn = { tavily: tavily?.source === "built-in", groq: !!status?.ai }
      }
      if (!cancelled) setEngine(searchEngineInUse(builtIn))
    }
    const reload = () => void load()
    reload()
    const events = ["dcm-tavily-key", "dcm-ai-keys", "dcm-search-engine", "dcm-poster-ai", "dcm-search-keys"]
    for (const name of events) window.addEventListener(name, reload)
    return () => {
      cancelled = true
      for (const name of events) window.removeEventListener(name, reload)
    }
  }, [])
  return engine
}

/**
 * What one search costs with each engine (Trending news makes 5 searches, 6 with "Look for" kinds;
 * a topic 1–3). `kinds`: how many "Look for" kinds besides real estate are on.
 */
export function searchCostText(engine: SearchEngineId | null, developers: boolean, kinds = 0): string {
  const n = kinds > 0 ? 6 : 5
  const looks = kinds === 0 ? "" : kinds === 1 ? ", the “Look for” kind" : kinds <= 3 ? ", each “Look for” kind" : ", 3 of the “Look for” kinds (taking turns)"
  const each = `Each time it searches the first keyword${developers ? ", a partner developer" : ""}${looks} and the next keywords in your list: they take turns, so every keyword gets searched. Keywords are read as topics (a developer's name finds that developer's news; “Events” finds events).`
  if (engine === "tavily") return `from the web with Tavily (${n} credits a search; the free plan has 1,000 a month). ${each}`
  if (engine === "serpapi") return `from Google with SerpApi (${n} searches each time; the free plan has 250 a month). ${each}`
  if (engine === "perplexity") return `from the web with Perplexity (${n} searches each time, about $${(0.005 * n).toFixed(3)}). ${each}`
  if (engine === "gemini") return "from the web with Gemini + Google Search (Google's free daily allowance, then billed per search)."
  if (engine === "groq") return "from the web with Groq. One search uses a lot of Groq's free limit: about one search every 2–3 minutes."
  return "from the web, once a web search is set up in Settings → AI (Tavily and Groq are free)."
}
