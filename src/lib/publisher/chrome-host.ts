/**
 * Homes.ph Publisher on the phone: what `chrome` is to the Chrome extension's background and panel, made from
 * the phone app's own parts. The extension's files run unchanged: storage is kept on the phone, "tabs" are the
 * app's own pages (PublisherPlugin), and "Daily Carousel Maker on this computer" (127.0.0.1) is this app.
 * Nothing here touches the page or the phone, so it's tested as it is (tests/mobile-publisher.test.ts).
 */

/** Where the storage is kept (IndexedDB on the phone). */
export interface KvBackend {
  all(): Promise<Record<string, unknown>>
  put(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
}

/** The app's pages (android: PublisherPlugin). */
export interface TabsBackend {
  createTab(options: { url: string; active: boolean }): Promise<{ tabId: number }>
  removeTab(options: { tabId: number }): Promise<void>
  updateTab(options: { tabId: number; url?: string; active?: boolean }): Promise<{ tabId: number }>
  send(options: { tabId: number; data: string }): Promise<void>
  broadcast(options: { data: string }): Promise<void>
}

export interface Badge {
  text: string
  color: string
  title: string
}

export interface HostEvents {
  /** An alert (Chrome's notification). */
  notify(title: string, message: string): void
  /** The number on the Publisher tab. */
  badge(badge: Badge): void
  /** Show the panel (a notification was clicked, the startup alert). */
  panel(): void
  /** Open the extension's options. */
  options(): void
}

type Listener<A extends unknown[]> = (...args: A) => unknown

function event<A extends unknown[]>() {
  const fns = new Set<Listener<A>>()
  return {
    addListener: (fn: Listener<A>) => void fns.add(fn),
    removeListener: (fn: Listener<A>) => void fns.delete(fn),
    fire: (...args: A) => {
      for (const fn of [...fns]) {
        try {
          const r = fn(...args)
          if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch((e) => console.warn("[Homes.ph Publisher]", e))
        } catch (e) {
          console.warn("[Homes.ph Publisher]", e)
        }
      }
    },
    fns,
  }
}

const clone = <T>(value: T): T => (value === undefined ? value : typeof structuredClone === "function" ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T))

/** Kept on the phone but never sent to the pages: pictures (a quote's, the job's, Today's report). */
const PRIVATE_KEY = /^(qimg:|jobImage$|dailyFile$)/

export type StorageChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>

export interface Sender {
  tab?: { id: number; windowId: number }
}

export async function createChromeHost(deps: { kv: KvBackend; tabs: TabsBackend; events: HostEvents }) {
  const { kv, tabs, events } = deps
  const cache = new Map<string, unknown>(Object.entries(await kv.all()))

  // ---------- storage ----------

  const onChanged = event<[StorageChanges, string]>()
  const changed = async (changes: StorageChanges) => {
    if (!Object.keys(changes).length) return
    onChanged.fire(changes, "local")
    const forPages = Object.fromEntries(Object.entries(changes).filter(([k]) => !PRIVATE_KEY.test(k)))
    if (Object.keys(forPages).length) await tabs.broadcast({ data: JSON.stringify({ kind: "storage", changes: forPages }) }).catch(() => {})
  }
  const local = {
    async get(keys?: null | string | string[] | Record<string, unknown>) {
      const out: Record<string, unknown> = {}
      if (keys == null) for (const [k, v] of cache) out[k] = clone(v)
      else if (typeof keys === "string") {
        if (cache.has(keys)) out[keys] = clone(cache.get(keys))
      } else if (Array.isArray(keys)) {
        for (const k of keys) if (cache.has(k)) out[k] = clone(cache.get(k))
      } else for (const [k, fallback] of Object.entries(keys)) out[k] = cache.has(k) ? clone(cache.get(k)) : fallback
      return out
    },
    async set(items: Record<string, unknown>) {
      const changes: StorageChanges = {}
      for (const [k, v] of Object.entries(items || {})) {
        if (v === undefined) continue
        const value = clone(v)
        changes[k] = { ...(cache.has(k) ? { oldValue: cache.get(k) } : {}), newValue: value }
        cache.set(k, value)
        await kv.put(k, value)
      }
      await changed(changes)
    },
    async remove(keys: string | string[]) {
      const changes: StorageChanges = {}
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (!cache.has(k)) continue
        changes[k] = { oldValue: cache.get(k) }
        cache.delete(k)
        await kv.del(k)
      }
      await changed(changes)
    },
  }

  // ---------- messages ----------

  const onMessage = event<[unknown, Sender, (response?: unknown) => void]>()
  /** A message to the background: its answer (undefined when nothing answers). */
  const dispatch = (msg: unknown, sender: Sender) =>
    new Promise<unknown>((resolve) => {
      let later = false
      let done = false
      const reply = (response?: unknown) => {
        if (done) return
        done = true
        resolve(response)
      }
      for (const fn of [...onMessage.fns]) {
        try {
          if (fn(msg, sender, reply) === true) later = true
        } catch (e) {
          console.warn("[Homes.ph Publisher]", e)
        }
      }
      if (!later) reply(undefined)
    })

  /** What a page's scripts sent through HPNative: a message for the background, or storage. */
  const fromTab = async (tabId: number, data: string) => {
    let m: { id?: number; kind?: string; body?: unknown } | null = null
    try {
      m = JSON.parse(data)
    } catch {
      return
    }
    if (!m || typeof m.id !== "number") return
    let res: unknown
    try {
      if (m.kind === "message") res = await dispatch(m.body, { tab: { id: tabId, windowId: 1 } })
      else if (m.kind === "get") res = await local.get(m.body as string[] | null)
      else if (m.kind === "set") await local.set((m.body || {}) as Record<string, unknown>)
      else if (m.kind === "remove") await local.remove(m.body as string[])
    } catch (e) {
      res = { error: e instanceof Error ? e.message : String(e) }
    }
    await tabs.send({ tabId, data: JSON.stringify({ kind: "reply", id: m.id, res }) }).catch(() => {})
  }

  // ---------- tabs, alarms, the badge ----------

  const onRemoved = event<[number]>()
  const onInstalled = event<[]>()
  const onStartup = event<[]>()
  const onAlarm = event<[{ name: string }]>()
  const alarms = new Map<string, ReturnType<typeof setInterval>>()
  const badge: Badge = { text: "", color: "#1428AE", title: "Homes.ph Publisher" }
  const setBadge = (patch: Partial<Badge>) => {
    Object.assign(badge, patch)
    events.badge({ ...badge })
  }

  const chrome = {
    runtime: {
      id: "homes-ph-publisher-phone",
      lastError: undefined as undefined | { message: string },
      getURL: (path: string) => `/publisher/${String(path).replace(/^\//, "")}`,
      sendMessage: (msg: unknown, reply?: (response?: unknown) => void) => {
        const answer = dispatch(msg, {})
        if (typeof reply === "function") void answer.then(reply)
        else return answer
      },
      onMessage,
      onInstalled,
      onStartup,
      openOptionsPage: async () => events.options(),
    },
    storage: { local, onChanged },
    tabs: {
      create: async ({ url, active }: { url: string; active?: boolean }) => {
        const { tabId } = await tabs.createTab({ url, active: active !== false })
        return { id: tabId, windowId: 1 }
      },
      remove: async (tabId: number) => tabs.removeTab({ tabId }),
      update: async (tabId: number, props: { url?: string; active?: boolean }) => {
        await tabs.updateTab({ tabId, ...props })
        return { id: tabId, windowId: 1 }
      },
      onRemoved,
    },
    windows: {
      create: async () => {
        events.panel()
        return { id: 1 }
      },
      update: async () => ({ id: 1 }),
    },
    alarms: {
      create: (name: string, info: { periodInMinutes?: number }) => {
        clearInterval(alarms.get(name))
        alarms.set(
          name,
          setInterval(() => onAlarm.fire({ name }), Math.max(0.5, info.periodInMinutes || 1) * 60_000),
        )
      },
      onAlarm,
    },
    notifications: {
      create: (_id: string, options: { title?: string; message?: string }) => events.notify(options.title || "Homes.ph Publisher", options.message || ""),
      clear: () => {},
      onClicked: { addListener: () => {} },
    },
    action: {
      setBadgeText: async ({ text }: { text: string }) => setBadge({ text: text || "" }),
      setBadgeBackgroundColor: async ({ color }: { color: string }) => setBadge({ color }),
      setTitle: async ({ title }: { title: string }) => setBadge({ title }),
    },
  }

  return {
    chrome,
    dispatch,
    fromTab,
    /** A page was closed (by you, or it crashed). */
    tabRemoved: (tabId: number) => onRemoved.fire(tabId),
    /** The background's "installed or updated" and "Chrome opened". */
    installed: () => onInstalled.fire(),
    startup: () => onStartup.fire(),
    stop: () => {
      for (const t of alarms.values()) clearInterval(t)
      alarms.clear()
    },
  }
}

export type ChromeHost = Awaited<ReturnType<typeof createChromeHost>>

// ---------- "Daily Carousel Maker on this computer": this app ----------

/** The one address that answers (the extension tries 39390–39394). */
export const APP_PORT = 39390
/** The extension keeps a token once connected: on the phone it's connected from the start. */
export const PHONE_TOKEN = "homes-ph-publisher-phone-app"

export interface FetchAnswer {
  ok: boolean
  status: number
  json(): Promise<unknown>
  blob(): Promise<Blob>
}

const answer = (status: number, body: unknown): FetchAnswer => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  blob: async () => new Blob([JSON.stringify(body)], { type: "application/json" }),
})

/**
 * The background's `fetch`: requests to the desktop app's bridge (http://127.0.0.1:39390/v1/…) are answered
 * by this app (`app`, the same answers the desktop app gives); anything else (an article's photo) goes out
 * through `remote`.
 */
export function createHostFetch(deps: { version: string; app(route: string, body: Record<string, unknown>): Promise<unknown>; remote(url: string, init?: RequestInit): Promise<FetchAnswer> }) {
  return async (input: string | URL, init?: RequestInit): Promise<FetchAnswer> => {
    const url = String(input)
    const m = /^http:\/\/127\.0\.0\.1:(\d+)(\/v1\/[a-z-]+)$/.exec(url)
    if (!m) return deps.remote(url, init)
    if (Number(m[1]) !== APP_PORT) throw new TypeError("Failed to fetch")
    const route = m[2]
    if (route === "/v1/ping") return answer(200, { app: "Daily Carousel Maker", version: deps.version, paired: true })
    if (route === "/v1/pair") return answer(200, { token: PHONE_TOKEN })
    let body: Record<string, unknown> = {}
    try {
      body = init && typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {}
    } catch {
      return answer(400, { error: "Bad request" })
    }
    try {
      const result = await deps.app(route, body)
      return result === undefined ? answer(404, { error: "Not found" }) : answer(200, result)
    } catch (e) {
      return answer(500, { error: e instanceof Error ? e.message : String(e) })
    }
  }
}

// ---------- the page scripts each site gets ----------

/** The Publisher's sites (the extension's content_scripts), with their scripts in order. */
export const SITE_SCRIPTS: { pattern: string; files: string[] }[] = [
  { pattern: "^https://dash\\.homes\\.ph/", files: ["shared.js", "page-ui.js", "dash-dialogs.js", "dash-posts.js", "dash-article.js"] },
  { pattern: "^https://(www\\.)?homes\\.ph/", files: ["shared.js", "page-ui.js", "fb-autopost.js", "homes-news.js"] },
  { pattern: "^https://dtr\\.homes\\.ph/", files: ["shared.js", "page-ui.js", "dtr.js"] },
  { pattern: "^https://www\\.messenger\\.com/", files: ["shared.js", "page-ui.js", "messenger.js"] },
]

/** Only these sites' pages may talk to the app. */
export const SITE_ORIGINS = ["https://dash.homes.ph", "https://homes.ph", "https://www.homes.ph", "https://dtr.homes.ph", "https://www.messenger.com"]

/** The pictures the page scripts show (the banner's icon, the brands' logos). */
export const SITE_ASSETS = ["icon-48.png", "icon-128.png", "logo-fhi.png", "logo-homes.png", "logo-pickleplay.png"]

/**
 * What PublisherPlugin is given: the script every page gets first (`start`: computer layout, and homes.ph's
 * in-page script) and each site's scripts, to run once per page after it loads (`rules`).
 */
export function buildPageScripts(sources: Record<string, string>, assets: Record<string, string>) {
  const need = (name: string) => {
    const text = sources[name]
    if (typeof text !== "string" || !text) throw new Error(`The Publisher's file ${name} is missing from the app.`)
    return text
  }
  // A function as the replacement: the scripts' own "$&" and "$1" stay as they are.
  const shim = need("tab-shim.js").replace("__HP_ASSETS__", () => JSON.stringify(assets))
  return {
    origins: SITE_ORIGINS,
    start: need("page-start.js").replace("__HP_MAIN__", () => need("homes-copy-main.js")),
    rules: SITE_SCRIPTS.map((site) => ({
      pattern: site.pattern,
      js: `if(!window.__hpPage){Object.defineProperty(window,"__hpPage",{value:true});\n${[shim, ...site.files.map(need)].join("\n;\n")}\n}`,
    })),
  }
}
