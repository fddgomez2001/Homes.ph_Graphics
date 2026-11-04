"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getSupabase } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/env"

/**
 * Client cache: memory first, then IndexedDB, scoped to the signed-in user.
 * Screens show the last known data instantly (also after restarting the app)
 * and refresh it in the background ("stale-while-revalidate"). Only the
 * user's own rows (already readable by them under RLS) are stored, on their
 * own device, and everything is wiped on sign-out.
 */

const DB_NAME = "dcm-cache"
const STORE = "entries"
/** Old entries are ignored after an app update (cached shapes or rendering may have changed). */
const FORMAT = `1.${process.env.APP_VERSION ?? "dev"}`

interface Entry<T = unknown> {
  data: T
  at: number
}

const memory = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()
export const cacheEvents = new EventTarget()

let scopePromise: Promise<string> | null = null
let scopeId: string | null = null

let watching = false

/** The signed-in user's id, read from the local session (no network). */
function scope(): Promise<string> {
  if (!scopePromise) {
    scopePromise = (async () => {
      if (!isSupabaseConfigured()) return "anon"
      const auth = getSupabase().auth
      if (!watching) {
        watching = true
        // Another account signed in on this device: never show the previous user's cached data.
        auth.onAuthStateChange((_event, session) => {
          const id = session?.user.id ?? "anon"
          if (scopeId && id !== scopeId) {
            memory.clear()
            inflight.clear()
            scopePromise = Promise.resolve(id)
            scopeId = id
          }
        })
      }
      const { data } = await auth.getSession()
      return data.session?.user.id ?? "anon"
    })()
      .catch(() => "anon")
      .then((id) => (scopeId = id))
  }
  return scopePromise
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function db(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve) => {
        if (!d) return resolve(undefined)
        try {
          const req = op(d.transaction(STORE, mode).objectStore(STORE))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(undefined)
        } catch {
          resolve(undefined)
        }
      }),
  )
}

async function fullKey(key: string) {
  return `${FORMAT}|${await scope()}|${key}`
}

/** Reads an entry from memory or disk. */
export async function readCache<T>(key: string): Promise<Entry<T> | undefined> {
  const k = await fullKey(key)
  const hit = memory.get(k) as Entry<T> | undefined
  if (hit) return hit
  const stored = await run<Entry<T>>("readonly", (s) => s.get(k))
  if (stored) memory.set(k, stored)
  return stored
}

/** Synchronous memory lookup (for the first render). */
export function peekCache<T>(key: string): Entry<T> | undefined {
  if (!scopeId) return undefined
  return memory.get(`${FORMAT}|${scopeId}|${key}`) as Entry<T> | undefined
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  const k = await fullKey(key)
  const entry = { data, at: Date.now() }
  memory.set(k, entry)
  await run("readwrite", (s) => s.put(entry, k))
}

/** Marks entries stale (matching a key prefix) and tells mounted queries to refresh. */
export function invalidate(prefix: string) {
  for (const [k, entry] of memory) {
    if (k.split("|").slice(2).join("|").startsWith(prefix)) memory.set(k, { ...entry, at: 0 })
  }
  // Remembered across reloads and windows: anything cached before this moment is refetched.
  try {
    localStorage.setItem(`${INVALIDATED}${prefix}`, String(Date.now()))
  } catch {
    // storage blocked: memory entries are still marked stale
  }
  cacheEvents.dispatchEvent(new CustomEvent("invalidate", { detail: prefix }))
}

const INVALIDATED = "dcm-invalidated:"

/** Latest invalidation that covers this key (0 when none). */
function invalidatedAt(key: string): number {
  let latest = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i)
      if (name?.startsWith(INVALIDATED) && key.startsWith(name.slice(INVALIDATED.length))) latest = Math.max(latest, Number(localStorage.getItem(name)) || 0)
    }
  } catch {
    // no storage: rely on memory
  }
  return latest
}

/** Updates every cached array under a key prefix (e.g. drop a deleted carousel from all lists right away). */
export function updateCachedLists<T>(prefix: string, update: (rows: T[]) => T[]) {
  for (const [k, entry] of memory) {
    const key = k.split("|").slice(2).join("|")
    if (!key.startsWith(prefix) || !Array.isArray(entry.data)) continue
    // Synchronous, and marked stale (at 0): the next screen shows the change at once and still refreshes.
    const next = { data: update(entry.data as T[]), at: 0 }
    memory.set(k, next)
    void run("readwrite", (store) => store.put(next, k))
  }
}

/** Forgets everything (sign-out / switching accounts). */
export async function clearCache() {
  memory.clear()
  inflight.clear()
  scopePromise = null
  scopeId = null
  await run("readwrite", (s) => s.clear())
}

/** Runs the fetcher once per key at a time and stores the result. */
export function fetchShared<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined
  if (running) return running
  const p = fetcher()
    .then(async (data) => {
      await writeCache(key, data)
      return data
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

interface QueryState<T> {
  key: string | null
  data: T | undefined
  error: string | null
  /** True while the network request runs (cached data may already be shown). */
  validating: boolean
}

export interface CachedQueryOptions {
  /** Skip the network if the cached copy is younger than this (ms). Infinity for immutable keys. */
  freshFor?: number
  /** Turns errors into messages. */
  errorMessage?: (e: unknown) => string
}

/**
 * Stale-while-revalidate hook: returns cached data immediately (memory, then
 * IndexedDB) and refreshes it in the background. Refreshes again when the
 * window regains focus or someone invalidates the key.
 */
export function useCachedQuery<T>(key: string | null, fetcher: () => Promise<T>, options: CachedQueryOptions = {}) {
  const { freshFor = 10_000, errorMessage = (e) => (e as Error)?.message ?? String(e) } = options
  const [state, setState] = useState<QueryState<T>>(() => ({
    key,
    data: key ? peekCache<T>(key)?.data : undefined,
    error: null,
    validating: false,
  }))
  const fetcherRef = useRef(fetcher)
  const errorRef = useRef(errorMessage)
  useEffect(() => {
    fetcherRef.current = fetcher
    errorRef.current = errorMessage
  })
  const [version, setVersion] = useState(0)
  const forceRef = useRef(false)

  if (state.key !== key) {
    // New key: show what we have for it right away (render-time reset, no effect needed).
    setState({ key, data: key ? peekCache<T>(key)?.data : undefined, error: null, validating: false })
  }

  useEffect(() => {
    if (!key) return
    let cancelled = false
    ;(async () => {
      const cached = await readCache<T>(key)
      if (cancelled) return
      if (cached) setState((s) => (s.key === key && s.data !== cached.data ? { ...s, data: cached.data } : s))
      const force = forceRef.current
      forceRef.current = false
      if (!force && cached?.at && Date.now() - cached.at < freshFor && cached.at > invalidatedAt(key)) return
      setState((s) => (s.key === key ? { ...s, validating: true } : s))
      try {
        const data = await fetchShared(key, () => fetcherRef.current())
        if (!cancelled) setState((s) => (s.key === key ? { ...s, data, error: null, validating: false } : s))
      } catch (e) {
        if (!cancelled) setState((s) => (s.key === key ? { ...s, error: errorRef.current(e), validating: false } : s))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, version, freshFor])

  // Refresh when invalidated or when the user comes back to the window.
  useEffect(() => {
    if (!key) return
    let last = Date.now()
    const refresh = () => {
      forceRef.current = true
      setVersion((v) => v + 1)
    }
    const onInvalidate = (e: Event) => {
      if (key.startsWith((e as CustomEvent<string>).detail)) refresh()
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible" || freshFor === Infinity || Date.now() - last < 15_000) return
      last = Date.now()
      refresh()
    }
    cacheEvents.addEventListener("invalidate", onInvalidate)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      cacheEvents.removeEventListener("invalidate", onInvalidate)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [key, freshFor])

  const reload = useCallback(() => {
    forceRef.current = true
    setVersion((v) => v + 1)
  }, [])

  /** Changes the shown (and cached) data locally, e.g. right after a mutation. */
  const mutate = useCallback(
    (update: (data: T | undefined) => T | undefined) => {
      setState((s) => {
        const data = update(s.data)
        if (key && data !== undefined) void writeCache(key, data)
        return { ...s, data }
      })
    },
    [key],
  )

  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : null,
    validating: state.validating,
    reload,
    mutate,
  }
}

/**
 * Effect-friendly stale-while-revalidate: calls onData with the cached copy
 * (if any), then with fresh data. Returns a cancel function for the cleanup.
 */
export function swr<T>(key: string, fetcher: () => Promise<T>, onData: (data: T, fresh: boolean) => void, onError?: (e: unknown) => void) {
  let cancelled = false
  let gotFresh = false
  void readCache<T>(key).then((cached) => {
    if (cached && !cancelled && !gotFresh) onData(cached.data, false)
  })
  fetchShared(key, fetcher).then(
    (data) => {
      gotFresh = true
      if (!cancelled) onData(data, true)
    },
    (e) => !cancelled && onError?.(e),
  )
  return () => {
    cancelled = true
  }
}

/** Removes entries not refreshed for a while (old previews of edited slides). Runs once per session. */
let pruned = false
export function pruneCache(maxAgeMs = 21 * 24 * 3600_000) {
  if (pruned) return
  pruned = true
  void db().then((d) => {
    if (!d) return
    try {
      const req = d.transaction(STORE, "readwrite").objectStore(STORE).openCursor()
      const cutoff = Date.now() - maxAgeMs
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        const entry = cursor.value as Entry | undefined
        if (!entry || typeof entry.at !== "number" || entry.at < cutoff || !String(cursor.key).startsWith(`${FORMAT}|`)) cursor.delete()
        cursor.continue()
      }
    } catch {
      // nothing to prune
    }
  })
}

/** Binary cache for rendered previews (Blobs keep IndexedDB small and fast). */
export async function readBlob(key: string): Promise<Blob | undefined> {
  const entry = await readCache<Blob>(`blob:${key}`)
  return entry?.data instanceof Blob ? entry.data : undefined
}

export function writeBlob(key: string, blob: Blob): Promise<void> {
  return writeCache(`blob:${key}`, blob)
}
