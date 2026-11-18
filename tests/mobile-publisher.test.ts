import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { describe, expect, it, vi } from "vitest"
import { APP_PORT, buildPageScripts, createChromeHost, createHostFetch, PHONE_TOKEN, SITE_ASSETS, SITE_ORIGINS, SITE_SCRIPTS, type KvBackend, type TabsBackend } from "@/lib/publisher/chrome-host"

const ROOT = path.resolve(__dirname, "..")
const ext = (name: string) => fs.readFileSync(path.join(ROOT, "chrome-extension", name), "utf8")
const own = (name: string) => fs.readFileSync(path.join(ROOT, "scripts", "publisher", name), "utf8")

function memory(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial))
  const kv: KvBackend = {
    all: async () => Object.fromEntries(data),
    put: async (k, v) => void data.set(k, v),
    del: async (k) => void data.delete(k),
  }
  return { kv, data }
}

function fakeTabs() {
  const sent: { tabId: number; data: string }[] = []
  const broadcasts: string[] = []
  const created: { url: string; active: boolean }[] = []
  const tabs: TabsBackend = {
    createTab: async (o) => {
      created.push(o)
      return { tabId: created.length }
    },
    removeTab: async () => {},
    updateTab: async (o) => ({ tabId: o.tabId }),
    send: async (o) => void sent.push(o),
    broadcast: async (o) => void broadcasts.push(o.data),
  }
  return { tabs, sent, broadcasts, created }
}

const events = () => ({ notify: vi.fn(), badge: vi.fn(), panel: vi.fn(), options: vi.fn() })

describe("the phone app as the extension's Chrome (1.47)", () => {
  it("storage: kept on the phone, read back as copies, and changes reach the panel and the pages", async () => {
    const { kv, data } = memory({ settings: { a: 1 } })
    const t = fakeTabs()
    const host = await createChromeHost({ kv, tabs: t.tabs, events: events() })
    const { local, onChanged } = host.chrome.storage
    expect(await local.get("settings")).toEqual({ settings: { a: 1 } })
    expect(await local.get(["settings", "nothing"])).toEqual({ settings: { a: 1 } })
    expect(await local.get({ nothing: 5 })).toEqual({ nothing: 5 })

    const seen: unknown[] = []
    onChanged.addListener((changes, area) => void seen.push([changes, area]))
    const job = { id: "j1", log: [] as string[] }
    await local.set({ job })
    job.log.push("changed after it was saved")
    expect((await local.get("job")).job).toEqual({ id: "j1", log: [] })
    expect(data.get("job")).toEqual({ id: "j1", log: [] })
    expect(seen).toEqual([[{ job: { newValue: { id: "j1", log: [] } } }, "local"]])
    expect(JSON.parse(t.broadcasts[0])).toEqual({ kind: "storage", changes: { job: { newValue: { id: "j1", log: [] } } } })

    await local.remove(["job", "never-there"])
    expect(await local.get(null)).toEqual({ settings: { a: 1 } })
    expect(data.has("job")).toBe(false)
    expect(JSON.parse(t.broadcasts[1]).changes).toEqual({ job: { oldValue: { id: "j1", log: [] } } })
  })

  it("pictures stay in the app: a quote's picture, the job's and Today's report are never sent to the pages", async () => {
    const t = fakeTabs()
    const host = await createChromeHost({ kv: memory().kv, tabs: t.tabs, events: events() })
    await host.chrome.storage.local.set({ "qimg:abc": { dataUrl: "data:image/png;base64,AAAA" }, jobImage: { picture: 1 }, dailyFile: { base64: "AAAA" } })
    expect(t.broadcasts).toEqual([])
  })

  it("messages: the panel and a page's scripts reach the background, which knows the page's tab", async () => {
    const t = fakeTabs()
    const host = await createChromeHost({ kv: memory().kv, tabs: t.tabs, events: events() })
    host.chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      const m = msg as { type: string }
      if (m.type !== "whoami") return false
      setTimeout(() => reply({ tabId: sender.tab ? sender.tab.id : null }), 1)
      return true
    })
    // The panel (in the app's page): no tab.
    expect(await host.chrome.runtime.sendMessage({ type: "whoami" })).toEqual({ tabId: null })
    // Nothing answers: no answer, not a hang.
    expect(await host.dispatch({ type: "unknown" }, {})).toBeUndefined()
    // A page (tab 7), through HPNative.
    await host.fromTab(7, JSON.stringify({ id: 3, kind: "message", body: { type: "whoami" } }))
    expect(JSON.parse(t.sent[0].data)).toEqual({ kind: "reply", id: 3, res: { tabId: 7 } })
    expect(t.sent[0].tabId).toBe(7)
    // A page's storage.
    await host.fromTab(7, JSON.stringify({ id: 4, kind: "set", body: { boards: { x: 1 } } }))
    await host.fromTab(7, JSON.stringify({ id: 5, kind: "get", body: ["boards"] }))
    expect(JSON.parse(t.sent[2].data)).toEqual({ kind: "reply", id: 5, res: { boards: { x: 1 } } })
    // Not a message: ignored.
    await host.fromTab(7, "not json")
    expect(t.sent).toHaveLength(3)
  })

  it("tabs, the number to post, alerts and the options", async () => {
    const t = fakeTabs()
    const ev = events()
    const host = await createChromeHost({ kv: memory().kv, tabs: t.tabs, events: ev })
    const { chrome } = host
    expect(await chrome.tabs.create({ url: "https://dash.homes.ph/x", active: false })).toEqual({ id: 1, windowId: 1 })
    expect(await chrome.tabs.create({ url: "https://homes.ph/y" })).toEqual({ id: 2, windowId: 1 })
    expect(t.created).toEqual([
      { url: "https://dash.homes.ph/x", active: false },
      { url: "https://homes.ph/y", active: true },
    ])
    const closed: number[] = []
    chrome.tabs.onRemoved.addListener((id) => void closed.push(id))
    host.tabRemoved(2)
    expect(closed).toEqual([2])

    await chrome.action.setBadgeText({ text: "3" })
    await chrome.action.setBadgeBackgroundColor({ color: "#D97706" })
    expect(ev.badge).toHaveBeenLastCalledWith({ text: "3", color: "#D97706", title: "Homes.ph Publisher" })
    chrome.notifications.create("hp-1", { title: "To post today", message: "Today: 3 not on Facebook yet." })
    expect(ev.notify).toHaveBeenCalledWith("To post today", "Today: 3 not on Facebook yet.")
    await chrome.windows.create()
    expect(ev.panel).toHaveBeenCalledTimes(1)
    await chrome.runtime.openOptionsPage()
    expect(ev.options).toHaveBeenCalledTimes(1)
    expect(chrome.runtime.getURL("logo-fhi.png")).toBe("/publisher/logo-fhi.png")
    host.stop()
  })
})

describe("the phone app as \"Daily Carousel Maker on this computer\" (1.47)", () => {
  const make = () => {
    const app = vi.fn(async (route: string, body: Record<string, unknown>) => {
      if (route === "/v1/carousel-day") return { day: body.day, carousels: [] }
      if (route === "/v1/ad-image") throw new Error("This advertisement was deleted.")
      return undefined
    })
    const remote = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), blob: async () => new Blob(["x"], { type: "image/jpeg" }) }))
    return { app, remote, fetch: createHostFetch({ version: "1.47.0", app, remote }) }
  }
  const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) })

  it("answers the extension's bridge address: found, connected, and the app's own answers", async () => {
    const { fetch, app, remote } = make()
    const ping = await fetch(`http://127.0.0.1:${APP_PORT}/v1/ping`)
    expect(ping.ok).toBe(true)
    expect(await ping.json()).toEqual({ app: "Daily Carousel Maker", version: "1.47.0", paired: true })
    expect(await (await fetch(`http://127.0.0.1:${APP_PORT}/v1/pair`, post({}))).json()).toEqual({ token: PHONE_TOKEN })
    const day = await fetch(`http://127.0.0.1:${APP_PORT}/v1/carousel-day`, post({ day: "2026-11-14" }))
    expect(await day.json()).toEqual({ day: "2026-11-14", carousels: [] })
    expect(app).toHaveBeenCalledWith("/v1/carousel-day", { day: "2026-11-14" })
    expect(remote).not.toHaveBeenCalled()
  })

  it("an error is the app's message; a request it doesn't know is \"Not found\"; the other ports are closed", async () => {
    const { fetch } = make()
    const gone = await fetch(`http://127.0.0.1:${APP_PORT}/v1/ad-image`, post({ id: "a" }))
    expect([gone.ok, gone.status, await gone.json()]).toEqual([false, 500, { error: "This advertisement was deleted." }])
    const unknown = await fetch(`http://127.0.0.1:${APP_PORT}/v1/something-new`, post({}))
    expect([unknown.status, await unknown.json()]).toEqual([404, { error: "Not found" }])
    await expect(fetch("http://127.0.0.1:39391/v1/ping")).rejects.toThrow("Failed to fetch")
  })

  it("anything else (an article's photo) goes out through the phone", async () => {
    const { fetch, remote, app } = make()
    const res = await fetch("https://filipinohomes123.s3.ap-southeast-1.amazonaws.com/a.jpg", { credentials: "omit" })
    expect((await res.blob()).type).toBe("image/jpeg")
    expect(remote).toHaveBeenCalledTimes(1)
    expect(app).not.toHaveBeenCalled()
  })
})

describe("the extension's own files run on the phone (1.47)", () => {
  const sources = () => {
    const names = [...new Set(SITE_SCRIPTS.flatMap((s) => s.files)), "homes-copy-main.js"]
    return { ...Object.fromEntries(names.map((n) => [n, ext(n)])), "tab-shim.js": own("tab-shim.js"), "page-start.js": own("page-start.js") }
  }

  it("every site of the extension's manifest gets the same page scripts, in the same order", () => {
    const manifest = JSON.parse(ext("manifest.json")) as { content_scripts: { matches: string[]; js: string[]; world?: string }[] }
    const sites = manifest.content_scripts.filter((c) => !c.matches.includes("https://*/*") && c.world !== "MAIN")
    expect(sites.map((c) => c.js)).toEqual(SITE_SCRIPTS.map((s) => s.files))
    for (const [i, site] of sites.entries())
      for (const match of site.matches) {
        const url = match.replace("*", "some/page")
        expect(new RegExp(SITE_SCRIPTS[i].pattern).test(url), url).toBe(true)
        expect(SITE_ORIGINS).toContain(new URL(url).origin)
      }
    // Its in-page script (homes.ph articles) is in the script every page starts with.
    expect(manifest.content_scripts.find((c) => c.world === "MAIN")?.js).toEqual(["homes-copy-main.js"])
    for (const name of SITE_ASSETS) expect(fs.existsSync(path.join(ROOT, "chrome-extension", name)), name).toBe(true)
  })

  it("the scripts are put together whole (their own $& and $1 untouched), once per page", () => {
    const built = buildPageScripts(sources(), { "icon-48.png": "data:image/png;base64,AAAA" })
    expect(built.origins).toEqual(SITE_ORIGINS)
    expect(built.rules).toHaveLength(SITE_SCRIPTS.length)
    for (const [i, rule] of built.rules.entries()) {
      for (const file of SITE_SCRIPTS[i].files) expect(rule.js.includes(ext(file)), file).toBe(true)
      expect(rule.js.startsWith("if(!window.__hpPage){")).toBe(true)
      expect(rule.js).not.toContain("__HP_ASSETS__")
      // It parses as one script.
      expect(() => new vm.Script(rule.js)).not.toThrow()
    }
    expect(built.start).toContain(ext("homes-copy-main.js"))
    expect(built.start).not.toContain("__HP_MAIN__")
    expect(() => new vm.Script(built.start)).not.toThrow()
    expect(() => buildPageScripts({ ...sources(), "dtr.js": "" }, {})).toThrow("dtr.js")
  })

  it("in a page: shared.js finds its chrome, a message gets its answer, storage changes arrive", async () => {
    const built = buildPageScripts(sources(), { "icon-48.png": "data:image/png;base64,AAAA" })
    const posted: { id: number; kind: string; body: unknown }[] = []
    const win: Record<string, unknown> = {
      HPNative: { postMessage: (text: string) => void posted.push(JSON.parse(text)) },
      addEventListener: () => {},
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Promise,
      JSON,
      Map,
      Set,
      Object,
      String,
      Date,
    }
    win.window = win
    win.globalThis = win
    const context = vm.createContext(win)
    // The shim and shared.js (the site's own scripts need a real page).
    const shim = own("tab-shim.js").replace("__HP_ASSETS__", () => JSON.stringify({ "icon-48.png": "data:image/png;base64,AAAA" }))
    vm.runInContext(`${shim}\n;${ext("shared.js")}`, context)
    const HP = win.HP as { alive(): boolean; url(p: string): string; send(m: unknown): Promise<unknown>; store: { get(k: string[]): Promise<unknown> }; onStorage(fn: (c: unknown, a: string) => void): () => void }
    const hpIn = win.__hpIn as (text: string) => void
    expect(HP.alive()).toBe(true)
    expect(HP.url("icon-48.png")).toBe("data:image/png;base64,AAAA")
    expect(built.rules[0].js).toContain(shim)

    const answer = HP.send({ type: "whoami" })
    expect(posted[0]).toEqual({ id: 1, kind: "message", body: { type: "whoami" } })
    hpIn(JSON.stringify({ kind: "reply", id: 1, res: { tabId: 4 } }))
    expect(await answer).toEqual({ tabId: 4 })

    const got = HP.store.get(["job"])
    expect(posted[1]).toEqual({ id: 2, kind: "get", body: ["job"] })
    hpIn(JSON.stringify({ kind: "reply", id: 2, res: { job: { id: "j" } } }))
    expect(await got).toEqual({ job: { id: "j" } })

    const changes: unknown[] = []
    HP.onStorage((c, area) => void changes.push([c, area]))
    hpIn(JSON.stringify({ kind: "storage", changes: { job: { newValue: { id: "j2" } } } }))
    expect(changes).toEqual([[{ job: { newValue: { id: "j2" } } }, "local"]])
  })

  it("the extension's background runs on the app's chrome: connected to the app, the day's carousel, pages opened", async () => {
    const t = fakeTabs()
    const ev = events()
    const host = await createChromeHost({ kv: memory().kv, tabs: t.tabs, events: ev })
    const app = vi.fn(async (route: string, body: Record<string, unknown>) => (route === "/v1/carousel-day" ? { day: body.day, pages: [], carousels: [] } : undefined))
    const hostFetch = createHostFetch({ version: "1.47.0", app, remote: async () => ({ ok: false, status: 404, json: async () => ({}), blob: async () => new Blob([]) }) })
    await host.chrome.storage.local.set({ app: { port: APP_PORT, token: PHONE_TOKEN } })
    // As the app starts it: shared.js, then background.js with the app's chrome and fetch.
    new Function("chrome", "importScripts", "fetch", `${ext("shared.js")}
;${ext("background.js")}`)(host.chrome, () => {}, hostFetch)

    host.installed()
    await vi.waitFor(async () => expect((await host.chrome.storage.local.get("settings")).settings).toBeTruthy())
    await vi.waitFor(() => expect(ev.badge).toHaveBeenCalled())

    expect(await host.dispatch({ type: "app-status" }, {})).toEqual({ open: true, paired: true, version: "1.47.0" })
    const day = (await host.dispatch({ type: "carousel-refresh", day: "2026-11-14" }, {})) as { data: unknown; error: string | null }
    expect(day.error).toBeNull()
    expect(day.data).toEqual({ day: "2026-11-14", pages: [], carousels: [] })
    expect(app).toHaveBeenCalledWith("/v1/carousel-day", { day: "2026-11-14" })
    // An app that doesn't know a request: the extension's own "install a newer one" message.
    const ads = (await host.dispatch({ type: "ads-refresh", day: "2026-11-14" }, {})) as { error: string }
    expect(ads.error).toContain("Install Homes.ph SocMedSystem")

    // A link in the panel opens as a page of the app, shown.
    expect(await host.dispatch({ type: "open", url: "https://dtr.homes.ph/m/tasks" }, {})).toEqual({ ok: true })
    expect(t.created).toEqual([{ url: "https://dtr.homes.ph/m/tasks", active: true }])
    // The page asks who it is (tab 1): the background knows it.
    await host.fromTab(1, JSON.stringify({ id: 1, kind: "message", body: { type: "whoami" } }))
    expect(JSON.parse(t.sent[0].data)).toEqual({ kind: "reply", id: 1, res: { tabId: 1, want: null } })
    host.stop()
  })

  it("the APK build copies the extension's files and makes Options fit the app", () => {
    const build = fs.readFileSync(path.join(ROOT, "scripts", "build-mobile.mjs"), "utf8")
    expect(build).toContain('path.join(root, "chrome-extension")')
    expect(build).toContain("window.chrome = parent.chrome")
    expect(ext("options.html")).toContain('<meta charset="utf-8" />')
  })
})
