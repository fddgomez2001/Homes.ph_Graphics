import "server-only"

import { createHash } from "node:crypto"
import type { TavilyQuery, TavilyResult } from "./tavily"

/**
 * Web searches (Tavily, SerpApi, Perplexity) are kept for 30 minutes: the same search again ("Search
 * again" with the brand's main keyword, the Facebook posts of the same keyword) costs no credit. A
 * search that fails because the service is down or slow is tried once more. Keys are never kept here:
 * only a short fingerprint, so one person's results never answer another person's key.
 */

const TTL_MS = 30 * 60_000
const MAX_ENTRIES = 200

type Found = { results: TavilyResult[]; credits: number }
const cache = new Map<string, { at: number; value: Found }>()

/** Off in tests (each test sets up its own answers), unless a test turns it on. */
const enabled = () => process.env.NODE_ENV !== "test" || process.env.DCM_SEARCH_CACHE === "1"

export function searchCacheKey(engine: string, key: string, q: TavilyQuery): string {
  return `${engine}:${createHash("sha256").update(key.trim()).digest("hex").slice(0, 16)}:${JSON.stringify(q)}`
}

export function clearSearchCache() {
  cache.clear()
}

/** A failure worth one more try: the service is down (5xx) or didn't answer, and the search wasn't stopped. */
function worthRetry(e: unknown, signal: AbortSignal) {
  const status = (e as { status?: unknown })?.status
  return !signal.aborted && typeof status === "number" && status >= 500
}

/**
 * One search through the cache: a fresh copy is returned for free (credits 0); otherwise the search
 * runs (once more after a short wait when the service failed) and its results are kept.
 */
export async function cachedSearch(
  engine: string,
  key: string,
  q: TavilyQuery,
  signal: AbortSignal,
  run: (q: TavilyQuery, signal: AbortSignal) => Promise<Found>,
  retryWaitMs = 700,
): Promise<Found> {
  const k = searchCacheKey(engine, key, q)
  const hit = enabled() ? cache.get(k) : undefined
  if (hit && Date.now() - hit.at < TTL_MS) return { results: hit.value.results, credits: 0 }
  let value: Found
  try {
    value = await run(q, signal)
  } catch (e) {
    if (!worthRetry(e, signal)) throw e
    await new Promise((r) => setTimeout(r, retryWaitMs))
    if (signal.aborted) throw e
    value = await run(q, signal)
  }
  if (enabled()) {
    cache.set(k, { at: Date.now(), value })
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  }
  return value
}
