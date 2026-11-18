"use client"

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core"
import { toast } from "sonner"
import { invalidateProjects } from "@/components/projects/use-projects"
import { errorMessage } from "@/lib/utils"
import { buildPageScripts, createChromeHost, createHostFetch, PHONE_TOKEN, APP_PORT, SITE_ASSETS, SITE_SCRIPTS, type Badge, type ChromeHost, type FetchAnswer, type KvBackend, type TabsBackend } from "./chrome-host"

/**
 * Homes.ph Publisher inside the phone app: the Chrome extension's own files (copied into the app as
 * /publisher/*, see scripts/build-mobile.mjs) run here. Its background and its panel run in the app's page;
 * dash.homes.ph, homes.ph, dtr.homes.ph and messenger.com open in the app's own pages (PublisherPlugin) with
 * the extension's page scripts. What the extension asks "Daily Carousel Maker on this computer" is answered
 * by this app.
 */

export interface PublisherTabs {
  tabs: { tabId: number; url: string | null; title: string | null }[]
  shown: number
}

interface PublisherPlugin extends TabsBackend {
  configure(options: { origins: string[]; start: string; rules: { pattern: string; js: string }[] }): Promise<{ supported: boolean }>
  setStatus(options: { text: string; running: boolean }): Promise<void>
  hide(): Promise<void>
  back(): Promise<{ handled: boolean }>
  state(): Promise<PublisherTabs>
  addListener(event: "message", fn: (e: { tabId: number; data: string }) => void): Promise<PluginListenerHandle>
  addListener(event: "tabRemoved", fn: (e: { tabId: number }) => void): Promise<PluginListenerHandle>
  addListener(event: "tabs", fn: (e: PublisherTabs) => void): Promise<PluginListenerHandle>
  addListener(event: "stop", fn: () => void): Promise<PluginListenerHandle>
}

const Plugin = registerPlugin<PublisherPlugin>("Publisher")

/** The phone app has the Publisher's pages (not a browser preview). */
export const publisherAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Publisher")

const ONLY_APP = "The Publisher opens its pages inside the phone app only."

/** A browser (no phone): nothing can be opened. */
const noTabs: TabsBackend = {
  createTab: async () => {
    throw new Error(ONLY_APP)
  },
  removeTab: async () => {},
  updateTab: async () => {
    throw new Error(ONLY_APP)
  },
  send: async () => {},
  broadcast: async () => {},
}

// ---------- storage: IndexedDB (a quote's picture is too big for localStorage) ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("homes-ph-publisher", 1)
    req.onupgradeneeded = () => req.result.createObjectStore("kv")
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("The phone's storage didn't open."))
  })
}

async function idbBackend(): Promise<KvBackend> {
  const db = await openDb()
  const run = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void) =>
    new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction("kv", mode)
      const req = fn(tx.objectStore("kv"))
      tx.oncomplete = () => resolve(req ? req.result : undefined)
      tx.onerror = () => reject(tx.error ?? new Error("The phone's storage didn't answer."))
      tx.onabort = () => reject(tx.error ?? new Error("The phone's storage is full."))
    })
  return {
    all: () =>
      new Promise((resolve, reject) => {
        const out: Record<string, unknown> = {}
        const tx = db.transaction("kv", "readonly")
        const cursor = tx.objectStore("kv").openCursor()
        cursor.onsuccess = () => {
          const c = cursor.result
          if (!c) return
          out[String(c.key)] = c.value
          c.continue()
        }
        tx.oncomplete = () => resolve(out)
        tx.onerror = () => reject(tx.error ?? new Error("The phone's storage didn't answer."))
      }),
    put: async (key, value) => void (await run("readwrite", (s) => s.put(value, key))),
    del: async (key) => void (await run("readwrite", (s) => s.delete(key))),
  }
}

// ---------- what the extension asks Daily Carousel Maker ----------

/** The same answers the desktop app gives the extension (see extension-bridge.tsx); undefined: not known. */
async function appRoute(route: string, body: Record<string, unknown>): Promise<unknown> {
  // Pictures aren't saved in a download folder here: they go straight to the Facebook post.
  const input = { ...body, save: false } as never
  if (route === "/v1/news-post" || route === "/v1/news-status") {
    const news = await import("@/lib/extension-news")
    const result = route === "/v1/news-post" ? await news.extensionNewsPost(input) : await news.extensionNewsStatus(input)
    invalidateProjects()
    return result
  }
  if (route.startsWith("/v1/carousel-")) {
    const carousel = await import("@/lib/extension-carousel")
    if (route === "/v1/carousel-day") return carousel.extensionCarouselDay(input)
    if (route === "/v1/carousel-images") return carousel.extensionCarouselImages(input)
    if (route === "/v1/carousel-posted") {
      const result = await carousel.extensionCarouselPosted(input)
      invalidateProjects()
      return result
    }
    return undefined
  }
  const ads = await import("@/lib/extension-ads")
  const withoutLabel = <T extends { label: string }>(result: T) => {
    const rest: Partial<T> = { ...result }
    delete rest.label
    return rest
  }
  if (route === "/v1/ads-day") return ads.extensionAdsDay(input)
  if (route === "/v1/ad-image") return withoutLabel(await ads.extensionAdImage(input))
  if (route === "/v1/ad-posted") return withoutLabel(await ads.extensionAdPosted(input))
  if (route === "/v1/trends-day") return ads.extensionTrendsDay(input)
  if (route === "/v1/trend-image") return withoutLabel(await ads.extensionTrendImage(input))
  if (route === "/v1/trend-texts") {
    const { written, ...result } = await ads.extensionTrendTexts(input)
    if (written) invalidateProjects()
    return result
  }
  return undefined
}

const bytesOf = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

/** An article's photo from another site: through the phone (a page's own fetch is stopped by the site's CORS). */
async function remoteFetch(url: string, init?: RequestInit): Promise<FetchAnswer> {
  if (!Capacitor.isNativePlatform()) return fetch(url, init)
  const { CapacitorHttp } = await import("@capacitor/core")
  const res = await CapacitorHttp.request({ url, method: "GET", responseType: "blob" })
  const type = String(res.headers["Content-Type"] ?? res.headers["content-type"] ?? "").split(";")[0].trim()
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    json: async () => JSON.parse(atob(String(res.data))),
    blob: async () => new Blob([bytesOf(String(res.data))], { type }),
  }
}

/** Today's report, read from My Tasks for Messenger: a copy goes to the phone's gallery (Chrome keeps one in Downloads). */
function keepDailyReport(data: string) {
  if (!data.includes('"daily-file"')) return
  try {
    const body = (JSON.parse(data) as { body?: { type?: string; name?: string; mime?: string; base64?: string } }).body
    if (body?.type !== "daily-file" || !body.base64 || !/^image\//.test(body.mime ?? "image/png")) return
    const name = String(body.name || "Daily report.png").replace(/[\\/:*?"<>|]/g, " ")
    const blob = new Blob([bytesOf(body.base64)], { type: body.mime || "image/png" })
    void import("@/lib/native")
      .then(({ saveToGallery }) => saveToGallery([{ name, blob }], "Reports"))
      .then((album) => toast.success("Today's report saved", { description: `${name} · ${album}` }))
      .catch(() => {})
  } catch {
    // not a report
  }
}

// ---------- the extension's files ----------

async function textOf(name: string) {
  const res = await fetch(`/publisher/${name}`)
  if (!res.ok) throw new Error(`The Publisher's file ${name} is missing from the app.`)
  return res.text()
}

async function dataUrlOf(name: string) {
  const res = await fetch(`/publisher/${name}`)
  if (!res.ok) return ""
  const blob = await res.blob()
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => resolve("")
    reader.readAsDataURL(blob)
  })
}

function loadScript(name: string) {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement("script")
    el.src = `/publisher/${name}`
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`The Publisher's file ${name} is missing from the app.`))
    document.head.appendChild(el)
  })
}

// ---------- the running Publisher ----------

type HP = {
  mountPanel(root: HTMLElement, options?: { onStarted?: () => void; onClose?: () => void; autoRefresh?: boolean }): { destroy(): void }
  PANEL_CSS: string
  jobName(job: unknown): string
  ymd(day: Date): string
}

export interface Publisher {
  HP: HP
  host: ChromeHost
  /** A message to the extension's background (what the panel's buttons send). */
  send(msg: Record<string, unknown>): Promise<unknown>
  /** Opens a page in the app (to sign in to a site). */
  open(url: string): Promise<void>
  /** Shows a page that's still open. */
  show(tabId: number): Promise<void>
}

interface Job {
  step?: string
  updatedAt?: number
  log?: { text: string }[]
}

type Watcher = { badge?(badge: Badge): void; panel?(): void; options?(): void; tabs?(state: PublisherTabs): void }
const watchers = new Set<Watcher>()
let lastBadge: Badge = { text: "", color: "#1428AE", title: "Homes.ph Publisher" }
let lastTabs: PublisherTabs = { tabs: [], shown: -1 }

/** Follows the Publisher (its number, "show the panel", "open the options", its open pages). Returns the way to stop. */
export function watchPublisher(watcher: Watcher) {
  watchers.add(watcher)
  watcher.badge?.(lastBadge)
  watcher.tabs?.(lastTabs)
  return () => void watchers.delete(watcher)
}

let starting: Promise<Publisher> | null = null

/** Starts the Publisher once (the extension's background and panel code, its storage, its pages). */
export function startPublisher(): Promise<Publisher> {
  starting ??= start().catch((e) => {
    starting = null
    throw e
  })
  return starting
}

async function start(): Promise<Publisher> {
  const native = publisherAvailable()
  const host = await createChromeHost({
    kv: await idbBackend(),
    tabs: native ? Plugin : noTabs,
    events: {
      notify: (title, message) => toast(title, { description: message, duration: 9000 }),
      badge: (badge) => {
        lastBadge = badge
        for (const w of watchers) w.badge?.(badge)
      },
      panel: () => {
        if (native) void Plugin.hide().catch(() => {})
        for (const w of watchers) w.panel?.()
      },
      options: () => {
        if (native) void Plugin.hide().catch(() => {})
        for (const w of watchers) w.options?.()
      },
    },
  })
  const { chrome } = host
  const win = window as unknown as { chrome?: object; HP?: HP }
  try {
    Object.defineProperty(win, "chrome", { value: chrome, configurable: true, writable: true })
  } catch {
    Object.assign(win.chrome ?? {}, chrome)
  }

  // Connected to "Daily Carousel Maker" (this app) from the start.
  await chrome.storage.local.set({ app: { port: APP_PORT, token: PHONE_TOKEN, connectedAt: Date.now() } })

  await loadScript("shared.js")
  await loadScript("panel.js")
  const HP = win.HP
  if (!HP?.mountPanel) throw new Error("The Publisher's panel didn't load.")

  if (native) {
    const names = [...new Set(["tab-shim.js", "page-start.js", "homes-copy-main.js", ...SITE_SCRIPTS.flatMap((s) => s.files)])]
    const sources = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await textOf(n)] as const)))
    const assets = Object.fromEntries(await Promise.all(SITE_ASSETS.map(async (n) => [n, await dataUrlOf(n)] as const)))
    const { supported } = await Plugin.configure(buildPageScripts(sources, assets))
    if (!supported) toast.error("Update “Android System WebView” in the Play Store", { description: "The Publisher needs a newer one to open its pages on this phone." })
    await Plugin.addListener("message", (e) => {
      void host.fromTab(e.tabId, e.data)
      keepDailyReport(e.data)
    })
    await Plugin.addListener("tabRemoved", (e) => host.tabRemoved(e.tabId))
    await Plugin.addListener("tabs", (state) => {
      lastTabs = state
      for (const w of watchers) w.tabs?.(state)
    })
    await Plugin.addListener("stop", () => void host.dispatch({ type: "stop-job" }, {}))
    // The bar over a page says what the job is doing there (the page's own banner is small on a phone).
    const status = (job: Job | null | undefined) => {
      const running = !!job && !["done", "failed", "stopped"].includes(job.step ?? "")
      const last = job?.log?.length ? job.log[job.log.length - 1].text : ""
      void Plugin.setStatus({ text: job ? `${HP.jobName(job)}${last ? `\n${last}` : ""}` : "Homes.ph Publisher", running }).catch(() => {})
    }
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.job) status(changes.job.newValue as Job | undefined)
    })
    status(((await chrome.storage.local.get("job")) as { job?: Job }).job)
  }

  // The extension's background, with this app as its Chrome (and as "Daily Carousel Maker on this computer").
  const hostFetch = createHostFetch({ version: process.env.APP_VERSION ?? "dev", app: appRoute, remote: remoteFetch })
  const background = await textOf("background.js")
  new Function("importScripts", "fetch", background)(() => {}, hostFetch)

  // "Installed or updated" once per app version; "Chrome opened" once a day (the boards are read, the alert shows).
  const { hostVersion, hostStartedOn } = (await chrome.storage.local.get(["hostVersion", "hostStartedOn"])) as { hostVersion?: string; hostStartedOn?: string }
  const version = process.env.APP_VERSION ?? "dev"
  const today = HP.ymd(new Date())
  if (hostVersion !== version) {
    host.installed()
    await chrome.storage.local.set({ hostVersion: version })
  }
  // Every minute: the number to post, and a job that stopped moving is ended. Once now, for the number.
  chrome.alarms.create("tick", { periodInMinutes: 1 })
  chrome.alarms.onAlarm.fire({ name: "tick" })
  if (native && hostStartedOn !== today) {
    await chrome.storage.local.set({ hostStartedOn: today })
    host.startup()
  }

  return {
    HP,
    host,
    send: (msg) => host.dispatch(msg, {}),
    open: async (url) => {
      try {
        await chrome.tabs.create({ url, active: true })
      } catch (e) {
        toast.error(errorMessage(e))
      }
    },
    show: async (tabId) => {
      await Plugin.updateTab({ tabId, active: true }).catch((e) => toast.error(errorMessage(e)))
    },
  }
}

/** Android's Back while one of the Publisher's pages is shown: true when it was used there. */
export async function publisherBack(): Promise<boolean> {
  if (!starting || !publisherAvailable()) return false
  try {
    return (await Plugin.back()).handled
  } catch {
    return false
  }
}
