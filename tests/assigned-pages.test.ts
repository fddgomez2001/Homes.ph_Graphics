import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import vm from "node:vm"
import { describe, expect, it } from "vitest"
import { articleTemplatesFor, defaultArticleTemplate } from "@/lib/design/news-templates"
import { laneOfDesign, laneTimesOf, newsLane, reportBrandLabel, reportBrandOfDesign, reportBrandsOf, slotKeyOf } from "@/lib/news-lanes"
import { assignedPageIds, LEGACY_ASSIGNMENT, normalizeAssignment, pageName, pageTabs, type Assignment } from "@/lib/pages"
import { articleLink, postingDetails, postingTitle } from "@/lib/report/report-texts"

type HPType = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
function loadHP(): HPType {
  const context: Record<string, unknown> = { URL, Date, setTimeout, clearTimeout, atob, btoa, Blob }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "chrome-extension", "shared.js"), "utf8"), context)
  return context.HP as HPType
}
const HP = loadHP()
const require = createRequire(import.meta.url)
const bridge = require("../electron/extension-bridge.cjs")

const CEBU_BGC: Assignment = { homes: ["bgc-taguig", "cebu"], sites: ["bayanihan"], carousel: false }

describe("assigned pages (1.50): the choice", () => {
  it("keeps known pages only, in the lists' order, no repeats", () => {
    expect(normalizeAssignment({ homes: ["cebu", "nowhere", "bgc-taguig", "cebu"], sites: ["rentsouq", "fhi", 3], carousel: "yes" })).toEqual({
      homes: ["bgc-taguig", "cebu"],
      sites: ["fhi", "rentsouq"],
      carousel: false,
    })
    expect(normalizeAssignment(null)).toBeNull()
    expect(normalizeAssignment({ homes: [] })).toBeNull()
  })

  it("one Homes.ph tab (a dropdown of several, the page's name when one), then each site", () => {
    expect(pageTabs(assignedPageIds(CEBU_BGC))).toEqual([
      { id: "homes", label: "Homes.ph", pages: ["homes:bgc-taguig", "homes:cebu"] },
      { id: "site:bayanihan", label: "Bayanihan", pages: ["site:bayanihan"] },
    ])
    expect(pageTabs(assignedPageIds({ homes: ["gensan"], sites: ["fhi", "pickleplay"], carousel: true })).map((t) => t.label)).toEqual(["Homes.ph Gensan", "FHI Global Dubai", "Pickleplay.ph"])
    expect(pageName("homes:caraga")).toBe("Homes.ph CARAGA")
  })
})

describe("assigned pages (1.50): News Article rows", () => {
  it("a Homes.ph page beyond CARAGA and Gensan: the Homes.ph design, its name on the post, the Cities board's times", () => {
    const cebu = newsLane("homes:cebu")
    expect(cebu).toMatchObject({ brand: "homes", page: "Homes.ph Cebu", name: "Homes.ph Cebu" })
    expect(cebu.times.map((t) => t.time)).toEqual(["11:00", "13:30", "18:00", "20:00", "22:00"])
    expect(articleTemplatesFor("homes").map((t) => t.id)).toEqual(["homes-portrait-news", "homes-news"])
    const design = defaultArticleTemplate("homes", new Date()).build()
    expect(laneOfDesign({ ...design, page: "Homes.ph Cebu" })).toBe("homes:cebu")
    expect(slotKeyOf({ ...design, page: "Homes.ph Cebu" }, new Date(2026, 10, 17, 13, 30).toISOString())).toBe("homes:cebu@13:30")
    expect(slotKeyOf({ ...design, page: "Homes.ph Cebu" }, new Date(2026, 10, 17, 9, 0).toISOString())).toBeNull()
    // CARAGA and Gensan keep their own rows; a site without a template has none.
    expect(newsLane("homes:caraga")).toMatchObject({ brand: "caraga", page: null })
    expect(newsLane("site:bayanihan")).toMatchObject({ brand: null, times: [] })
    expect(laneOfDesign(articleTemplatesFor("gensan")[0].build())).toBe("homes:gensan")
  })

  it("the Daily Report: the assigned pages' rows, PicklePlay, FHI, CARAGA, Gensan first", () => {
    expect(reportBrandsOf(LEGACY_ASSIGNMENT)).toEqual(["pickleplay", "fhi", "caraga", "gensan"])
    expect(reportBrandsOf({ homes: ["cebu", "gensan"], sites: ["bayanihan", "pickleplay"], carousel: false })).toEqual(["pickleplay", "gensan", "homes:cebu"])
    const design = { ...articleTemplatesFor("homes")[0].build(), page: "Homes.ph Cebu" }
    expect(reportBrandOfDesign(design)).toBe("homes:cebu")
    expect(reportBrandLabel("homes:cebu")).toBe("Homes.ph Cebu")
    expect(laneTimesOf("homes:cebu").length).toBe(5)
    expect(articleLink("homes:cebu", "Cebu Opens New Park")).toBe("https://homes.ph/news/cebu-opens-new-park")
  })
})

describe("assigned pages (1.50): the Homes.ph Publisher extension", () => {
  it("shows only the assigned pages (FHI, PicklePlay, CARAGA, Gensan and the carousel until the app says)", () => {
    const legacy = HP.withDefaults(null, null)
    expect(legacy.brands.map((b: { id: string }) => b.id)).toEqual(["fhi", "pickleplay", "caraga", "gensan"])
    expect(legacy.carousel).toBe(true)
    const s = HP.withDefaults(null, CEBU_BGC)
    expect(s.brands.map((b: { id: string; group: string; hub: string }) => `${b.id}:${b.group}/${b.hub}`)).toEqual(["bayanihan:site/Bayanihan", "bgc-taguig:city/BGC", "cebu:city/Cebu"])
    expect(s.carousel).toBe(false)
    expect(s.allBrands).toHaveLength(23)
    // Main Page: the Sites board's "Homes" row; its Facebook Page "Homes.ph".
    expect(s.allBrands.find((b: { id: string }) => b.id === "main")).toMatchObject({ group: "site", hub: "Homes", fbPage: "Homes.ph", appBrand: "homes:main" })
  })

  it("ticks only the page's sites after Clear all: Main News Portal + Homes; FHI also fhiglobal and Rentsouq", () => {
    const s = HP.withDefaults(null, { homes: ["cebu"], sites: ["fhi", "pickleplay", "rentsouq"], carousel: false })
    const sites = (id: string) => HP.publishSites(s.allBrands.find((b: { id: string }) => b.id === id))
    expect(sites("cebu")).toEqual(["Main News Portal", "Homes"])
    expect(sites("fhi")).toEqual(["Main News Portal", "fhiglobal", "Rentsouq"])
    expect(sites("pickleplay")).toEqual(["Main News Portal", "PicklePlay"])
    expect(sites("rentsouq")).toEqual(["Main News Portal", "Rentsouq"])
    expect(sites("caraga")).toEqual(["Main News Portal", "Homes"])
  })

  it("adds the assigned pages' tasks in My Tasks, titled as the app's report (no carousel when it isn't assigned)", () => {
    const s = HP.withDefaults(null, { homes: ["cebu"], sites: ["pickleplay"], carousel: false })
    const tasks = HP.reportTasks(s)
    expect(tasks.map((t: { id: string }) => t.id)).toEqual(["pickleplay", "cebu", "ads", "quotes", "trending"])
    const cebu = tasks.find((t: { id: string }) => t.id === "cebu")
    expect(cebu.title).toBe(postingTitle("homes:cebu"))
    expect(cebu.details).toBe(postingDetails("homes:cebu"))
    expect(tasks.find((t: { id: string }) => t.id === "quotes").title).toBe("Daily Quote Posting – Pickleplay.ph and Homes.ph Cebu")
    expect(HP.addTasks(s).map((t: { id: string }) => t.id)).not.toContain("trending")
    // No PicklePlay: no ads task (the other pages have no advertisements yet).
    expect(HP.reportTasks(HP.withDefaults(null, CEBU_BGC)).map((t: { id: string }) => t.id)).toEqual(["bayanihan", "bgc-taguig", "cebu", "quotes", "trending"])
    // Before: the same 8 tasks as 1.1.2.
    expect(HP.REPORT_TASKS.map((t: { id: string }) => t.id)).toEqual(["pickleplay", "fhi", "caraga", "gensan", "carousel", "ads", "quotes", "trending"])
    // My Tasks rows are matched to the assigned pages' tasks.
    const found = HP.dtrFound([{ title: postingTitle("homes:cebu"), meta: ["Today"], url: "u" }], new Date(), tasks)
    expect(Object.keys(found)).toEqual(["cebu"])
  })

  it("posts the carousel to every page at once on the dash (posts of 4 the old way)", () => {
    const pages = Array.from({ length: 17 }, (_, i) => ({ key: `p${i}`, sort: i }))
    expect(HP.carouselGroups(pages, HP.carouselPer(HP.withDefaults(null, null)))).toHaveLength(1)
    expect(HP.carouselGroups(pages, HP.carouselPer(HP.withDefaults({ postWay: "autopost" }, null)))).toHaveLength(5)
    expect(["Homes.ph", "Homes.ph Caraga", "Homes,ph BGC Taguig", "Homes;ph Makati", "Pickleplay.ph", "Bayanihan.com", "Rentsouq.ae", "FHI Global Dubai"].map((n) => /^homes[.,;]?\s?ph\b/i.test(n))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it("Options saves the settings, not the assigned pages worked out from them", () => {
    const s = HP.withDefaults({ countdown: 3 }, CEBU_BGC)
    const saved = HP.savedSettings(s)
    expect(saved.brands).toHaveLength(23)
    expect("allBrands" in saved || "assigned" in saved || "carousel" in saved).toBe(false)
    expect(HP.withDefaults(saved, CEBU_BGC).brands.map((b: { id: string }) => b.id)).toEqual(["bayanihan", "bgc-taguig", "cebu"])
  })
})

describe("assigned pages (1.50): the app's bridge for the extension", () => {
  it("tells the connected extension the assigned pages, and makes News Article pictures for any Homes.ph page", async () => {
    const file = path.join(fs.mkdtempSync(path.join(require("node:os").tmpdir(), "bridge-")), "clients.json")
    const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
    const forwarded: unknown[] = []
    const b = bridge.startBridge({
      file,
      version: "1.50.0",
      forward: async (type: string, payload: unknown) => (forwarded.push({ type, payload }), { ok: true }),
      askToPair: async () => true,
      assignment: () => CEBU_BGC,
    })
    const port = await b.ready
    const call = async (p: string, body?: object, token?: string) => {
      const res = await fetch(`http://127.0.0.1:${port}${p}`, {
        method: body ? "POST" : "GET",
        headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: res.status, body: await res.json() }
    }
    try {
      expect((await call("/v1/assignment", {})).status).toBe(401)
      const { token } = (await call("/v1/pair", { name: "Homes.ph Publisher" })).body
      expect((await call("/v1/assignment", {}, token)).body).toEqual({ pages: CEBU_BGC })
      const post = await call("/v1/news-post", { brand: "homes:cebu", day: "2026-11-17", time: "13:30", headline: "Cebu Opens New Park" }, token)
      expect(post.status).toBe(200)
      expect(forwarded).toEqual([{ type: "news-post", payload: { brand: "homes:cebu", day: "2026-11-17", time: "13:30", headline: "Cebu Opens New Park", articleUrl: "" } }])
      expect((await call("/v1/news-post", { brand: "homes:nowhere", day: "2026-11-17", time: "13:30", headline: "x" }, token)).status).toBe(400)
    } finally {
      b.close?.()
    }
  })
})
