import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import vm from "node:vm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { articleLink, articleSlug, CAROUSEL_DETAILS, CAROUSEL_TITLE_LINE, carouselUpdateText, postingDetails, postingLine, postingTitle, trendText } from "@/lib/report/report-texts"

/** The extension's shared.js (a plain script that defines globalThis.HP), run as the extension runs it. */
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

describe("Homes.ph Publisher (Chrome extension): shared logic", () => {
  it("makes the article's address like the websites (and Daily Carousel Maker's report)", () => {
    const headline = "UAE Capital Markets Focus On Tokenisation And AI Innovation"
    const fhi = HP.DEFAULT_BRANDS.find((b: { id: string }) => b.id === "fhi")
    expect(HP.articleLink(fhi, headline)).toBe("https://fhiglobal.ae/news/uae-capital-markets-focus-on-tokenisation-and-ai-innovation")
    expect(HP.articleLink(fhi, headline)).toBe(articleLink("fhi", headline))
    for (const h of ["Porky's Lechon & Barbecue Serves Cebu-Style Lechon", "Piña to Modern Wardrobe: TAN-GAN's Tailored Traditions", "USA Pickleball Revokes CPX Hyper+ Certification", "Big fuel price rollback — ₱16.80 per liter! ⛽"])
      expect(HP.slug(h)).toBe(articleSlug(h))
    expect(HP.readMore("https://fhiglobal.ae/news/x")).toBe("READ MORE: https://fhiglobal.ae/news/x")
  })

  it("reads the board's time columns and labels them", () => {
    expect(["09:00 AM", "11:00 AM", "03:00 PM", "07:00 PM", "10:00 PM", "01:30 PM", "11:00 PM", "12:00 PM", "12:30 AM", "22:00"].map(HP.timeFromLabel)).toEqual(["09:00", "11:00", "15:00", "19:00", "22:00", "13:30", "23:00", "12:00", "00:30", "22:00"])
    expect(HP.timeFromLabel("Target Hub")).toBe("")
    expect(["09:00", "13:30", "22:00", "00:30"].map(HP.timeLabel)).toEqual(["9 AM", "1:30 PM", "10 PM", "12:30 AM"])
  })

  it("schedules the Facebook post at the slot's time, or posts it now when the slot's time has passed", () => {
    const at = (h: number, m: number) => new Date(2026, 10, 10, h, m)
    expect(HP.timing("2026-11-10", "22:00", at(18, 0), 2)).toEqual({ mode: "later", date: "2026-11-10", time: "22:00" })
    expect(HP.timing("2026-11-10", "19:00", at(19, 25), 2)).toEqual({ mode: "now", date: "2026-11-10", time: "19:25" })
    // Within the window before the time: now.
    expect(HP.timing("2026-11-10", "19:00", at(18, 59), 2).mode).toBe("now")
    expect(HP.timing("2026-11-11", "09:00", at(23, 0), 2)).toEqual({ mode: "later", date: "2026-11-11", time: "09:00" })
  })

  it("tells each slot's state: green once it's done (checked on the board, or its Facebook post scheduled / posted)", () => {
    const now = new Date(2026, 10, 10, 18, 0)
    const card = (o: object) => ({ title: "A", posted: false, due: false, fb: null, ...o })
    const rec = (r: object) => () => r
    expect(HP.slotState([], "2026-11-10", "22:00", now)).toBe("empty")
    expect(HP.slotState([card({ posted: true, fb: "posted" })], "2026-11-10", "09:00", now)).toBe("published")
    expect(HP.slotState([card({ fb: "scheduled" })], "2026-11-10", "22:00", now)).toBe("published")
    // Checked on the board ("Posted"), no Facebook mark: done too, not yellow.
    expect(HP.slotState([card({ posted: true })], "2026-11-10", "22:00", now)).toBe("published")
    expect(HP.slotState([card({ posted: true, due: true })], "2026-11-10", "09:00", now)).toBe("published")
    expect(HP.slotState([card({})], "2026-11-10", "22:00", now)).toBe("ready")
    expect(HP.slotState([card({ due: true })], "2026-11-10", "22:00", now)).toBe("due")
    expect(HP.slotState([card({})], "2026-11-10", "15:00", now)).toBe("due")
    expect(HP.slotState([card({ fb: "posted" }), card({ title: "B" })], "2026-11-10", "22:00", now)).toBe("ready")
    // This extension's record makes it green until the board shows it; a scheduled post deleted on homes.ph
    // isn't green any more, even while the card is checked and the dash still shows its f.
    expect(HP.slotState([card({})], "2026-11-10", "22:00", now, rec({ facebook: "scheduled" }))).toBe("published")
    expect(HP.slotState([card({ posted: true, fb: "scheduled" })], "2026-11-10", "22:00", now, rec({ facebook: "scheduled", deleted: true }))).toBe("ready")
    expect(HP.slotState([card({ posted: true, fb: "scheduled" })], "2026-11-10", "09:00", now, rec({ facebook: "scheduled", deleted: true }))).toBe("due")
  })

  it("knows homes.ph's short link (Copy link) for Caraga and Gensan's READ MORE", () => {
    expect(["https://homes.ph/s/hey2K", "https://www.homes.ph/s/hey2K", "https://homes.ph/s/a_b-9/"].map(HP.isShortLink)).toEqual([true, true, true])
    expect(["https://homes.ph/news/stronger-partnerships", "https://evil.example/s/hey2K", "https://homes.ph/s/", "", null].map(HP.isShortLink)).toEqual([false, false, false, false, false])
    const brands = HP.withDefaults(null).brands
    expect(brands.filter((b: { shortLink?: boolean }) => b.shortLink).map((b: { id: string }) => b.id)).toEqual(["caraga", "gensan"])
  })

  it("only calls a scheduled Facebook post deleted when it's sure (1.1.1)", () => {
    expect(HP.dashWhen("Nov 14, 2026, 4:00 PM PHT")).toEqual({ day: "2026-11-14", time: "16:00" })
    expect(HP.dashWhen("November 14, 2026 at 12:30 AM")).toEqual({ day: "2026-11-14", time: "00:30" })
    expect(HP.dashWhen("Scheduled on Facebook")).toBeNull()
    const post = (key: string, title: string, time: string, fbPage: string, caption = "") => ({ key, title, caption, day: "2026-11-14", time, fbPage })
    const caraga = post("c", "Siargao Businesses Go Cashless", "17:00", "Homes.ph Caraga", "Siargao's tourism businesses are making it easier for visitors to pay digitally.")
    const fhi = post("f", "UAE Capital Markets Focus On Tokenisation", "19:00", "FHI Global Dubai", "UAE Capital Markets Focus On Tokenisation")
    const old = post("o", "An Article Scheduled By An Older Version", "22:00", "PicklePlay")
    // Scheduled Posts filtered to one Page (Homes.ph Caraga): the caption there isn't the board's title.
    const filtered = [
      { text: "What's Your Biggest Home-Buying Worry? Meta Native Homes.ph Caraga Nov 14, 2026, 4:00 PM PHT Scheduled on Facebook" },
      { text: "Siargao's tourism businesses are making it easier for visitors to pay digitally. Visa and UMSI… Meta Native Homes.ph Caraga Nov 14, 2026, 5:00 PM PHT Scheduled on Facebook" },
    ]
    // Found by its caption; the other Pages' posts aren't in a filtered list: nothing is concluded about them.
    expect(HP.checkScheduled([caraga, fhi, old], filtered, false)).toEqual({ present: ["c"], removed: [], missing: [], unknown: ["f", "o"] })
    // The whole list: a post whose caption is known and isn't there is missing; one without a known caption stays unknown.
    expect(HP.checkScheduled([caraga, fhi, old], filtered, true)).toEqual({ present: ["c"], removed: [], missing: ["f"], unknown: ["o"] })
    // Found by its Page and its date and time when the words differ.
    const byTime = [{ text: "A caption typed by hand Meta Native FHI Global Dubai Nov 14, 2026, 7:00 PM PHT Scheduled on Facebook" }]
    expect(HP.checkScheduled([fhi], byTime, true).present).toEqual(["f"])
    expect(HP.checkScheduled([fhi], [{ text: "A caption typed by hand FHI Global Dubai Nov 14, 2026, 9:00 PM PHT Scheduled on Facebook" }], true).missing).toEqual(["f"])
    // A row that says it was deleted or cancelled.
    expect(HP.checkScheduled([fhi], [{ text: "UAE Capital Markets Focus On Tokenisation FHI Global Dubai Nov 14, 2026, 7:00 PM PHT Cancelled" }], false).removed).toEqual(["f"])
    // "cancelled" in the caption of a post that is still scheduled isn't a deleted post.
    expect(HP.checkScheduled([fhi], [{ text: "UAE Capital Markets Focus On Tokenisation as cancelled listings return FHI Global Dubai Nov 14, 2026, 7:00 PM PHT Scheduled on Facebook" }], true).present).toEqual(["f"])
    expect(HP.checkScheduled([], filtered, true)).toEqual({ present: [], removed: [], missing: [], unknown: [] })
  })

  it("counts the slots not on Facebook yet for the badge, the deleted scheduled posts, and the past days not posted", () => {
    const now = new Date(2026, 10, 10, 18, 0)
    const settings = HP.withDefaults(null)
    const boards = {
      "site|2026-11-10": {
        times: ["09:00", "11:00", "15:00", "19:00", "22:00"],
        hubs: [
          {
            hub: "fhiglobal",
            slots: {
              "09:00": [{ title: "Emaar", posted: true, fb: "posted" }],
              "15:00": [{ title: "Sharjah", posted: true }],
              "19:00": [{ title: "Waterfront", posted: false }],
              "22:00": [{ title: "UAE Capital Markets", posted: false, due: true }],
            },
          },
          { hub: "PicklePlay", slots: { "09:00": [{ title: "JW Johnson", posted: true, fb: "posted" }], "15:00": [] } },
          { hub: "Bayanihan", slots: { "09:00": [{ title: "Fiesta", posted: false }] } },
        ],
      },
      "city|2026-11-10": { times: ["11:00", "22:00"], hubs: [{ hub: "GENERAL SANTOS", slots: { "22:00": [{ title: "GenSan Hosts NSTW 2026", posted: false }] } }] },
      "site|2026-11-08": { times: ["09:00"], hubs: [{ hub: "fhiglobal", slots: { "09:00": [{ title: "Old one", posted: false }] } }] },
      "site|2026-11-09": { times: ["09:00"], hubs: [{ hub: "fhiglobal", slots: { "09:00": [{ title: "All done", posted: true }] } }] },
    }
    // Checked on the board (FHI 3 PM "Sharjah") counts as done; 7 PM, 10 PM (due) and Gensan 10 PM are to post.
    expect(HP.countToday(settings, boards, {}, now)).toEqual({ open: 3, late: 1, read: true, deleted: [] })
    const done = { [HP.doneKey("fhi", "2026-11-10", "22:00", "UAE Capital Markets")]: { at: 1, facebook: "scheduled" } }
    expect(HP.countToday(settings, boards, done, now)).toMatchObject({ open: 2, late: 0 })
    const gone = { [HP.doneKey("fhi", "2026-11-10", "09:00", "Emaar")]: { at: 1, facebook: "scheduled", deleted: true } }
    const c = HP.countToday(settings, boards, gone, now)
    expect([c.open, c.late, c.deleted.map((d: { brand: { id: string }; time: string; title: string }) => `${d.brand.id} ${d.time} ${d.title}`)]).toEqual([4, 2, ["fhi 09:00 Emaar"]])
    expect(HP.countToday(settings, {}, {}, now)).toEqual({ open: 0, late: 0, read: false, deleted: [] })
    expect(HP.missedDays(settings, boards, {}, now)).toEqual([{ day: "2026-11-08", open: 1 }])
  })

  it("takes READ MORE from the published article's site pill: the brand's own site, never the dash", () => {
    const a = (href: string, textContent: string) => ({ href, textContent })
    const page = (links: object[]) => ({ querySelectorAll: () => links })
    const brand = (id: string) => HP.DEFAULT_BRANDS.find((b: { id: string }) => b.id === id)
    const pp = "https://www.pickleplay.ph/news/team-alfonso-siklab-claims-championship-victory-at-maharlika-pilipinas-pickleball-tour-leg-three"
    expect(HP.publishedLink(page([a("https://dash.homes.ph/super_editor/articles/x", "Edit"), a("https://homes.ph/news/team-alfonso", "Main News Portal"), a(pp, "PicklePlay")]), brand("pickleplay"))).toBe(pp)
    expect(HP.readMore(HP.publishedLink(page([a(pp, "PicklePlay")]), brand("pickleplay")))).toBe(`READ MORE: ${pp}`)
    expect(HP.publishedLink(page([a("https://fhiglobal.ae/news/emaar-2026", "fhiglobal"), a("https://rentsouq.com/news/emaar", "Rentsouq")]), brand("fhi"))).toBe("https://fhiglobal.ae/news/emaar-2026")
    expect(HP.publishedLink(page([a("https://homes.ph/news/make-room-2026", "Homes.ph Caraga"), a("https://homes.ph/news/make-room", "Main News Portal")]), brand("caraga"))).toBe("https://homes.ph/news/make-room-2026")
    // Not published yet: no pill (a dash link or a non-article link isn't one).
    expect(HP.publishedLink(page([a("https://dash.homes.ph/news/x", "PicklePlay"), a("https://www.pickleplay.ph/", "PicklePlay")]), brand("pickleplay"))).toBe("")
    expect(HP.publishedLink(page([]), brand("fhi"))).toBe("")
  })

  it("clicks Publish by itself (the old setting kept) but leaves Schedule Post to you, unless turned on", () => {
    const s = HP.withDefaults(null)
    expect([s.autoPublish, s.autoSchedule, "autoSubmit" in s]).toEqual([true, false, false])
    const old = HP.withDefaults({ autoSubmit: false, cityUrl: "https://dash.homes.ph/super_editor/posts?group=city" })
    expect([old.autoPublish, old.autoSchedule, old.cityUrl, "autoSubmit" in old]).toEqual([false, false, "https://dash.homes.ph/super_editor/posts", false])
    expect(HP.withDefaults({ autoSchedule: true, autoPublish: false })).toMatchObject({ autoSchedule: true, autoPublish: false })
  })

  it("has the team's brands: FHI → fhiglobal + Rentsouq and FHI Global Dubai; rows and boards; saved changes kept", () => {
    const s = HP.withDefaults(null)
    expect(s.brands.map((b: { hub: string; group: string }) => `${b.hub}/${b.group}`)).toEqual(["fhiglobal/site", "PicklePlay/site", "Caraga/city", "General Santos/city"])
    const fhi = s.brands[0]
    expect([fhi.publishTo, fhi.fbPage, fhi.appBrand]).toEqual([["fhiglobal", "Rentsouq"], "FHI Global Dubai", "fhi"])
    const changed = HP.withDefaults({ countdown: 99, brands: [{ id: "caraga", fbPage: "Homes.ph CARAGA", logo: "evil.png" }] })
    expect(changed.countdown).toBe(30)
    expect(changed.brands.find((b: { id: string }) => b.id === "caraga")).toMatchObject({ fbPage: "Homes.ph CARAGA", logo: "logo-homes.png", hub: "Caraga" })
    expect(HP.sameName("Homes,ph BGC Taguig", "Homes.ph BGC Taguig")).toBe(true)
    expect(HP.sameName("GENERAL SANTOS", "General Santos")).toBe(true)
    expect(HP.boardWhere("https://dash.homes.ph/super_editor/posts?date=2026-11-10&group=site&post=18838")).toEqual({ group: "site", date: "2026-11-10" })
  })
})

describe("Homes.ph Publisher: the right board and day", () => {
  const board = (hubs: string[]) => ({ times: ["11:00"], hubs: hubs.map((hub) => ({ hub, slots: {} })) })
  it("tells Cities from Sites by their rows (Sites has \"Homes.ph Caraga\", Cities has \"Caraga\")", () => {
    const s = HP.withDefaults(null)
    expect(HP.detectGroup(board(["Bayanihan", "fhiglobal", "PicklePlay", "Homes.ph Caraga", "Homes,ph BGC Taguig"]), s)).toBe("site")
    expect(HP.detectGroup(board(["Cebu", "Makati", "BGC", "Davao", "Ozamiz", "Leyte", "Caraga"]), s)).toBe("city")
    expect(HP.detectGroup(board(["Somewhere"]), s)).toBeNull()
    expect(HP.detectGroup(null, s)).toBeNull()
  })

  it("reads the day the board shows", () => {
    expect(HP.dateFromLabel("NOV 10, 2026")).toBe("2026-11-10")
    expect(HP.dateFromLabel("November 9, 2026")).toBe("2026-11-09")
    expect(HP.dateFromLabel("Dec 31 2026")).toBe("2026-12-31")
    expect(HP.dateFromLabel("PUBLISHED 84 / 86")).toBe("")
    expect(HP.dateFromLabel("Calling all coffee lovers, November 20–22")).toBe("")
  })

  it("opens a board at the address the dash really uses (learned), unless one is typed in Options", () => {
    const s = HP.withDefaults(null)
    expect(HP.boardUrl(s, "city", {})).toBe("https://dash.homes.ph/super_editor/posts")
    expect(HP.boardUrl(s, "site", {})).toBe("https://dash.homes.ph/super_editor/posts?group=site")
    expect(HP.boardWhere("https://dash.homes.ph/super_editor/posts?date=2026-11-10")).toEqual({ group: null, date: "2026-11-10" })
    expect(HP.boardUrl(s, "city", { city: "https://dash.homes.ph/super_editor/posts?group=cities" })).toBe("https://dash.homes.ph/super_editor/posts?group=cities")
    const typed = HP.withDefaults({ cityUrl: "https://dash.homes.ph/super_editor/posts?group=town" })
    expect(HP.boardUrl(typed, "city", { city: "https://dash.homes.ph/super_editor/posts?group=cities" })).toBe("https://dash.homes.ph/super_editor/posts?group=town")
  })

  it('reads the new board: a row\'s name without its count ("fhiglobal" / "3 posts"), a column\'s time without "No posts"', () => {
    const cell = (first: string | null, all: string) => ({ querySelector: (sel: string) => (sel === "p" && first != null ? { textContent: first } : null), textContent: all })
    expect(HP.cellLabel(cell("fhiglobal", "fhiglobal3 posts"))).toBe("fhiglobal")
    expect(HP.cellLabel(cell("General Santos", "General Santos5 posts"))).toBe("General Santos")
    expect(HP.cellLabel(cell(null, "Caraga 1 post"))).toBe("Caraga")
    expect(HP.cellLabel(cell(null, "Homes.ph Leyte No posts"))).toBe("Homes.ph Leyte")
    expect(HP.timeFromLabel(HP.cellLabel(cell("11:00 AM", "11:00 AM11 posts")))).toBe("11:00")
    expect(HP.timeFromLabel(HP.cellLabel(cell("11:00 PM", "11:00 PMNo posts")))).toBe("23:00")
    expect(HP.cellLabel(null)).toBe("")
  })

  it("tells Sites by its \"Homes.ph …\" rows (a later page may have only those), never Cities' \"Caraga\"", () => {
    const s = HP.withDefaults(null)
    expect(HP.detectGroup(board(["Homes.ph Palawan", "Homes.ph Pampanga", "Homes;ph Makati"]), s)).toBe("site")
    expect(HP.detectGroup(board(["Homes", "Apply Na"]), s)).toBe("site")
    expect(HP.detectGroup(board(["Caraga", "General Santos", "Iloilo"]), s)).toBe("city")
  })

  it("keeps every page of a board: a page's rows replace that page's rows, the other pages' rows stay", () => {
    const hub = (name: string, page?: number) => ({ hub: name, slots: {}, ...(page ? { page } : {}) })
    const page1 = HP.mergeBoard(undefined, { times: ["09:00"], hubs: [hub("fhiglobal"), hub("Apply Na")] }, 1)
    expect(page1.hubs.map((h: { hub: string; page: number }) => `${h.hub}@${h.page}`)).toEqual(["fhiglobal@1", "Apply Na@1"])
    const both = HP.mergeBoard(page1, { times: ["09:00"], hubs: [hub("PicklePlay"), hub("Rentsouq")] }, 2)
    expect(both.hubs.map((h: { hub: string; page: number }) => `${h.hub}@${h.page}`)).toEqual(["PicklePlay@2", "Rentsouq@2", "fhiglobal@1", "Apply Na@1"])
    // Page 1 read again (PicklePlay has articles now, so it's on page 1): its old page-2 row goes.
    const again = HP.mergeBoard(both, { times: ["09:00"], hubs: [hub("PicklePlay"), hub("fhiglobal")] }, 1)
    expect(again.hubs.map((h: { hub: string; page: number }) => `${h.hub}@${h.page}`)).toEqual(["PicklePlay@1", "fhiglobal@1", "Rentsouq@2"])
    // A board saved before pages (no page): page 1 replaces it.
    expect(HP.mergeBoard({ hubs: [hub("Old one")] }, { times: [], hubs: [hub("fhiglobal")] }, undefined).hubs.map((h: { hub: string }) => h.hub)).toEqual(["fhiglobal"])
  })

  it("finds the board's pages: the page shown and its Next link (none on the last page)", () => {
    const link = (text: string, attrs: Record<string, string> = {}, className = "") => ({ textContent: text, className, disabled: false, getAttribute: (n: string) => attrs[n] ?? null })
    const docWith = (links: ReturnType<typeof link>[]) => {
      const nav = { querySelectorAll: () => links, querySelector: () => links.find((l) => l.getAttribute("aria-label") === "Go to next page") || null }
      return { querySelector: () => nav }
    }
    const first = docWith([link("Previous", { "aria-label": "Go to previous page" }, "gap-1 pointer-events-none opacity-50"), link("1", { "aria-current": "page", "data-active": "true" }), link("2", { "data-active": "false" }), link("Next", { "aria-label": "Go to next page" }, "gap-1 px-2.5")])
    const p1 = HP.pager(first)
    expect([p1.page, !!p1.next, p1.first && p1.first.textContent]).toEqual([1, true, "1"])
    const last = docWith([link("1", { "data-active": "false" }), link("2", { "aria-current": "page" }), link("Next", { "aria-label": "Go to next page" }, "gap-1 pointer-events-none opacity-50")])
    expect([HP.pager(last).page, HP.pager(last).next]).toEqual([2, null])
    expect(HP.pager({ querySelector: () => null })).toEqual({ page: 1, next: null, first: null })
  })

  it("publishes Caraga and Gensan to Homes and Main News Portal (old saved settings moved over; your own kept)", () => {
    const s = HP.withDefaults(null)
    const sites = (x: ReturnType<typeof HP.withDefaults>, id: string) => x.brands.find((b: { id: string }) => b.id === id).publishTo
    expect([sites(s, "caraga"), sites(s, "gensan"), sites(s, "fhi")]).toEqual([["Homes", "Main News Portal"], ["Homes", "Main News Portal"], ["fhiglobal", "Rentsouq"]])
    const old = HP.withDefaults({ brands: [{ id: "caraga", publishTo: ["Homes.ph Caraga"] }, { id: "gensan", publishTo: ["Homes.ph Gensan"] }] })
    expect([sites(old, "caraga"), sites(old, "gensan")]).toEqual([["Homes", "Main News Portal"], ["Homes", "Main News Portal"]])
    expect(sites(HP.withDefaults({ brands: [{ id: "caraga", publishTo: ["Homes", "Homes.ph Caraga"] }] }), "caraga")).toEqual(["Homes", "Homes.ph Caraga"])
    // READ MORE for Caraga: its "Homes" pill.
    const page = { querySelectorAll: () => [{ href: "https://homes.ph/news/make-room-2026", textContent: "Homes" }, { href: "https://homes.ph/news/make-room", textContent: "Main News Portal" }] }
    expect(HP.publishedLink(page, s.brands.find((b: { id: string }) => b.id === "caraga"))).toBe("https://homes.ph/news/make-room-2026")
  })

  it("schedules a future day's Facebook post on that day", () => {
    expect(HP.timing("2026-11-12", "09:00", new Date(2026, 10, 10, 19, 30), 2)).toEqual({ mode: "later", date: "2026-11-12", time: "09:00" })
    expect(HP.slotState([{ title: "A", posted: false, due: false }], "2026-11-12", "09:00", new Date(2026, 10, 10, 19, 30))).toBe("ready")
  })
})

describe("Homes.ph Publisher: Reports (My Tasks on dtr.homes.ph)", () => {
  const task = (id: string) => HP.REPORT_TASKS.find((t: { id: string }) => t.id === id)

  it("adds the day's 7 tasks with the report's own titles and details (as Daily Carousel Maker writes them); HR's trending task is only found", () => {
    expect(HP.REPORT_TASKS.map((t: { name: string }) => t.name)).toEqual(["PicklePlay", "FHI", "Caraga", "Gensan", "Carousel", "Ads", "Quotes", "Trending"])
    expect(HP.ADD_TASKS.map((t: { id: string }) => t.id)).toEqual(["pickleplay", "fhi", "caraga", "gensan", "carousel", "ads", "quotes"])
    expect(task("trending")).toMatchObject({ hr: true, title: "Search a Trending News Daily" })
    expect(task("ads").title).toBe("Daily Advertisement Posting – Pickleplay.ph")
    expect(task("quotes").title).toBe("Daily Quote Posting – Pickleplay.ph, FHI Global, Homes.ph CARAGA and Homes.ph Gensan")
    for (const t of HP.ADD_TASKS) expect(t.details.length).toBeGreaterThan(40)
    for (const b of ["pickleplay", "fhi", "caraga", "gensan"] as const) {
      expect(task(b).title).toBe(postingTitle(b))
      expect(task(b).details).toBe(postingDetails(b))
    }
    expect(task("pickleplay").title).toBe("Daily Social Media Posting – Pickleplay.ph")
    expect(task("caraga").details).toBe("Posted and scheduled daily articles on the Homes.ph CARAGA social media page at 11:00 AM, 1:30 PM, 6:00 PM, 8:00 PM, and 10:00 PM.")
    expect(task("carousel").title).toBe(CAROUSEL_TITLE_LINE)
    expect(task("carousel").details).toBe(CAROUSEL_DETAILS)
    expect(HP.DTR_HOURS).toEqual({ from: "09:00", to: "18:00" })
  })

  it("writes each time's update like the report: bold time, headline, bold Article Link", () => {
    const h = "Pickleball Inclusion In Palarong Pambansa Could Boost Philippine Youth Sports"
    const pp = HP.withDefaults(null).brands.find((b: { id: string }) => b.id === "pickleplay")
    expect(HP.reportLine("09:00", h, HP.articleLink(pp, h))).toBe(
      "[𝟵 𝗔𝗠] - Pickleball Inclusion In Palarong Pambansa Could Boost Philippine Youth Sports\n\n𝗔𝗿𝘁𝗶𝗰𝗹𝗲 𝗟𝗶𝗻𝗸: https://www.pickleplay.ph/news/pickleball-inclusion-in-palarong-pambansa-could-boost-philippine-youth-sports",
    )
    expect(HP.reportLine("13:30", h, HP.articleLink(pp, h))).toBe(postingLine("pickleplay", "13:30", h))
    const at = new Date(2026, 10, 12, 23, 0)
    const pages = [{ name: "Homes.ph Main Page", short_name: "Main Page" }, { name: "Homes.ph BGC Taguig", short_name: "BGC Taguig" }]
    expect(HP.carouselUpdateText({ title: "From Their Fields To Our Tables.", at, pages: pages.map((p) => ({ name: p.name, short: p.short_name })) })).toBe(carouselUpdateText({ title: "From Their Fields To Our Tables.", at, pages }))
  })

  it("reads My Tasks: today's tasks by their title (Today, or today's date), In progress / Done", () => {
    const rows = [
      { title: "Daily Social Media Posting – Pickleplay.ph", url: "https://dtr.homes.ph/m/tasks/491", meta: ["Fri, Nov 13", "09:00 AM – 06:00 PM", "In progress", "Self-reported"] },
      { title: "Daily Social Media Posting - FHI Global", url: "https://dtr.homes.ph/m/tasks/492", meta: ["Today", "Done"] },
      { title: "Advertise with us promotions on our website and facebook pages", url: "https://dtr.homes.ph/m/tasks/449", meta: ["Today"] },
      { title: "Daily Social Media Posting – Homes.ph CARAGA", url: "https://dtr.homes.ph/m/tasks/300", meta: ["Thu, Nov 12", "In progress"] },
    ]
    const found = HP.dtrFound(rows, new Date(2026, 10, 13, 9, 30))
    expect(found).toEqual({ pickleplay: { status: "in_progress", url: "https://dtr.homes.ph/m/tasks/491", count: 1 }, fhi: { status: "done", url: "https://dtr.homes.ph/m/tasks/492", count: 1 } })
    const day = { tasks: found }
    expect(["pickleplay", "fhi", "caraga"].map((id) => HP.dtrState(day, id))).toEqual(["progress", "done", "none"])
    expect(HP.dtrState(undefined, "fhi")).toBe("none")
  })

  it("traces today's tasks row by row in My Tasks: To do (Today) and Done today (Done Nov 12), so none is added twice", () => {
    // The user's own My Tasks (Nov 12): the morning's tasks Done, some added again (In progress), HR's task Done.
    const row = (id: number, title: string, ...meta: string[]) => ({ title, url: `https://dtr.homes.ph/m/tasks/${id}`, meta })
    const rows = [
      row(498, "Daily Social Media Posting – Homes.ph Gensan", "Today", "09:00 AM – 06:00 PM", "In progress", "Self-reported"),
      row(491, "Daily Social Media Posting – Pickleplay.ph", "Today", "09:00 AM – 06:00 PM", "In progress", "Self-reported"),
      row(417, "Restaurant Promotional Ads For Homes.ph For Restaurant Owners and Restaurant Promotions", "Today"),
      row(402, "Search a Trending News Daily", "Done Nov 12", "09:15 AM – 12:00 PM", "6"),
      row(464, "Daily Carousel Content Creation and Scheduling – Homes.ph Social Media Pages", "Done Nov 12", "09:00 AM – 06:00 PM", "Self-reported", "2"),
      row(463, "Daily Social Media Posting – Homes.ph Gensan", "Done Nov 12", "09:00 AM – 06:00 PM", "Self-reported", "6"),
      row(462, "Daily Social Media Posting – Homes.ph CARAGA", "Done Nov 12", "09:00 AM – 06:00 PM", "Self-reported", "6"),
      row(460, "Daily Social Media Posting – Pickleplay.ph", "Done Nov 12", "09:00 AM – 06:00 PM", "Self-reported", "7"),
      row(218, "Daily Carousel Content Creation and Scheduling – Homes.ph Social Media Pages", "Done Nov 10", "Self-reported"),
      row(214, "Daily Social Media Posting – Pickleplay.ph", "Done Nov 09", "09:00 AM – 06:00 PM"),
      row(73, "Daily Social Media Posting – FHI Global", "Done Nov 06", "09:00 AM – 06:00 PM", "Self-reported"),
    ]
    const found = HP.dtrFound(rows, new Date(2026, 10, 12, 15, 0))
    expect(found).toEqual({
      gensan: { status: "in_progress", url: "https://dtr.homes.ph/m/tasks/498", count: 2 },
      pickleplay: { status: "in_progress", url: "https://dtr.homes.ph/m/tasks/491", count: 2 },
      trending: { status: "done", url: "https://dtr.homes.ph/m/tasks/402", count: 1 },
      carousel: { status: "done", url: "https://dtr.homes.ph/m/tasks/464", count: 1 },
      caraga: { status: "done", url: "https://dtr.homes.ph/m/tasks/462", count: 1 },
    })
    // FHI was last done Nov 6: it's the one task Start Your Day would add (with Ads and Quotes).
    expect(HP.ADD_TASKS.filter((t: { id: string }) => !found[t.id]).map((t: { id: string }) => t.id)).toEqual(["fhi", "ads", "quotes"])
    // The next day, nothing of Nov 12 counts.
    expect(HP.dtrFound(rows.filter((r) => r.meta[0] !== "Today"), new Date(2026, 10, 13, 9))).toEqual({})
    expect(HP.dtrWhen(["Done Nov 9"], new Date(2026, 10, 9))).toBe("done")
    expect(HP.dtrWhen(["Done Today"], new Date(2026, 10, 9))).toBe("done")
    expect(HP.dtrWhen(["Mon, Nov 9"], new Date(2026, 10, 9))).toBe("today")
    expect(HP.dtrWhen(["In progress", "Self-reported", "09:00 AM – 06:00 PM"], new Date(2026, 10, 9))).toBeNull()
  })

  it("a report is ready when each of its times has its article on Facebook (or checked); it lists one update per article", () => {
    const s = HP.withDefaults(null)
    const day = "2026-11-12"
    const card = (title: string, extra = {}) => ({ title, posted: false, due: false, ...extra })
    const ppSlots = {
      "09:00": [card("Nine", { fb: "posted" })],
      "11:00": [card("Eleven", { posted: true })],
      "15:00": [card("Three")],
      "19:00": [card("Seven", { fb: "scheduled" })],
      "22:00": [card("Ten", { fb: "scheduled" })],
    }
    const boards = { [`site|${day}`]: { times: [], hubs: [{ hub: "PicklePlay", slots: ppSlots }] } }
    const done = { [HP.doneKey("pickleplay", day, "15:00", "Three")]: { facebook: "posted", articleUrl: "https://www.pickleplay.ph/news/three-2026" } }
    const plan = HP.reportPlan(task("pickleplay"), { settings: s, boards, done, carousels: {}, carouselDone: {} }, day)
    expect(plan.ready).toBe(true)
    expect(plan.updates.map((u: { text: string }) => u.text.split("\n")[0])).toEqual(["[𝟵 𝗔𝗠] - Nine", "[𝟭𝟭 𝗔𝗠] - Eleven", "[𝟯 𝗣𝗠] - Three", "[𝟳 𝗣𝗠] - Seven", "[𝟭𝟬 𝗣𝗠] - Ten"])
    // The article's real link when the extension posted it, else its address made from the headline.
    expect(plan.updates[2].text).toContain("𝗔𝗿𝘁𝗶𝗰𝗹𝗲 𝗟𝗶𝗻𝗸: https://www.pickleplay.ph/news/three-2026")
    expect(plan.updates[0].text).toContain("𝗔𝗿𝘁𝗶𝗰𝗹𝗲 𝗟𝗶𝗻𝗸: https://www.pickleplay.ph/news/nine")
    const notYet = HP.reportPlan(task("pickleplay"), { settings: s, boards, done: {}, carousels: {}, carouselDone: {} }, day)
    expect(notYet).toMatchObject({ ready: false, posted: 4, total: 5 })
    // A deleted Facebook post isn't posted.
    const deleted = { [HP.doneKey("pickleplay", day, "15:00", "Three")]: { facebook: "scheduled", deleted: true } }
    expect(HP.reportPlan(task("pickleplay"), { settings: s, boards, done: deleted, carousels: {}, carouselDone: {} }, day).ready).toBe(false)
    // Caraga: 11 PM with no article doesn't hold it; a time with no article does.
    const cg = (slots: Record<string, unknown[]>) => HP.reportPlan(task("caraga"), { settings: s, boards: { [`city|${day}`]: { times: [], hubs: [{ hub: "Caraga", slots }] } }, done: {}, carousels: {}, carouselDone: {} }, day)
    const five = { "11:00": [card("A", { fb: "posted" })], "13:30": [card("B", { fb: "posted" })], "18:00": [card("C", { posted: true })], "20:00": [card("D", { fb: "posted" })], "22:00": [card("E", { fb: "scheduled" })], "23:00": [] }
    expect(cg(five).ready).toBe(true)
    expect(cg(five).updates).toHaveLength(5)
    expect(cg({ ...five, "20:00": [] })).toMatchObject({ ready: false, posted: 4 })
    // An 11 PM article not posted yet holds it; posted, it's a sixth update.
    expect(cg({ ...five, "23:00": [card("F")] }).ready).toBe(false)
    expect(cg({ ...five, "23:00": [card("F", { fb: "scheduled" })] }).updates).toHaveLength(6)
    // No board read: not ready.
    expect(HP.reportPlan(task("gensan"), { settings: s, boards: {}, done: {}, carousels: {}, carouselDone: {} }, day).ready).toBe(false)
  })

  it("the Carousel's report is ready once all its pages are posted", () => {
    const pages = [
      { key: "main", name: "Homes.ph Main Page", short: "Main Page", sort: 1 },
      { key: "ozamiz", name: "Homes.ph Ozamiz", short: "Ozamiz", sort: 2 },
    ]
    const entry = (checks: { key: string }[]) => ({ "2026-11-12": { at: 1, data: { pages, carousels: [{ id: "c1", title: "From Their Fields To Our Tables.", scheduledAt: new Date(2026, 10, 12, 23).toISOString(), checks }] } } })
    const ctx = (checks: { key: string }[]) => ({ settings: HP.withDefaults(null), boards: {}, done: {}, carousels: entry(checks), carouselDone: {} })
    expect(HP.reportPlan(task("carousel"), ctx([{ key: "main" }]), "2026-11-12")).toMatchObject({ ready: false, posted: 1, total: 2 })
    const plan = HP.reportPlan(task("carousel"), ctx([{ key: "main" }, { key: "ozamiz" }]), "2026-11-12")
    expect(plan.ready).toBe(true)
    expect(plan.updates[0].text).toBe("𝗖𝗮𝗿𝗼𝘂𝘀𝗲𝗹 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 𝗦𝗰𝗵𝗲𝗱𝘂𝗹𝗲𝗱:\n12/11/2026 | 11 PM\n\n𝗙𝗿𝗼𝗺 𝗧𝗵𝗲𝗶𝗿 𝗙𝗶𝗲𝗹𝗱𝘀 𝗧𝗼 𝗢𝘂𝗿 𝗧𝗮𝗯𝗹𝗲𝘀.\n\nHomes.ph Main Page ✅ | Ozamiz ✅ |")
    expect(HP.reportPlan(task("carousel"), { settings: HP.withDefaults(null), boards: {}, done: {}, carousels: {}, carouselDone: {} }, "2026-11-12").ready).toBe(false)
  })

  it("Ads and Trending News reports: ready when every one of the day's is posted; one update each (Trending = the floating report's copy)", () => {
    const day = "2026-11-12"
    const ad = (id: string, time: string, extra = {}) => ({ id, brand: "pickleplay", kind: "history", kindLabel: "History", title: "The kitchen keeps volleys out of play.", caption: "Ready to master the kitchen?", time, revision: 1, postedAt: null, ...extra })
    const ctx = (extra: Record<string, unknown>) => ({ settings: HP.withDefaults(null), boards: {}, done: {}, carousels: {}, carouselDone: {}, ads: {}, trends: {}, quotes: {}, posted: {}, ...extra })
    const ads = { [day]: { at: 1, data: { day, ads: [ad("a1", "13:00"), ad("a2", "17:00", { postedAt: 5 })] } } }
    expect(HP.reportPlan(task("ads"), ctx({ ads }), day)).toMatchObject({ ready: false, posted: 1, total: 2 })
    const plan = HP.reportPlan(task("ads"), ctx({ ads, posted: { [day]: { "ad:a1": { at: 1, facebook: "scheduled" } } } }), day)
    expect(plan.ready).toBe(true)
    expect(plan.updates[0].text).toBe("[𝟭 𝗣𝗠] - History Advertisement: The kitchen keeps volleys out of play.\n\n𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗣𝗮𝗴𝗲: Pickleplay.ph")
    expect(HP.reportPlan(task("ads"), ctx({ ads: { [day]: { at: 1, data: { day, ads: [] } } } }), day)).toMatchObject({ ready: false, why: "no advertisement scheduled for today" })
    expect(HP.reportPlan(task("ads"), ctx({}), day).ready).toBe(false)

    const poster = { id: "p1", group: "fhi", groupName: "FHI Global", page: null, n: 1, time: "09:00", headline: "Danube Launches Shahrukhz Residences", subtext: "Apartments start at AED 1.65 million", caption: "c", details: "Danube Properties launched Shahrukhz Residences in Dubai.", revision: 3 }
    const trends = { [day]: { at: 1, data: { day, posters: [poster] } } }
    expect(HP.reportPlan(task("trending"), ctx({ trends }), day).ready).toBe(false)
    const tplan = HP.reportPlan(task("trending"), ctx({ trends, posted: { [day]: { "trend:p1": { at: 1 } } } }), day)
    expect(tplan.ready).toBe(true)
    expect(tplan.updates[0].text).toBe(trendText({ name: "FHI Global", n: 1, day: new Date(2026, 10, 12, 9), headline: poster.headline, subtext: poster.subtext, details: poster.details }))
    expect(HP.trendUpdateText({ ...poster, details: "" }, day)).toBe(trendText({ name: "FHI Global", n: 1, day: new Date(2026, 10, 12), headline: poster.headline, subtext: poster.subtext }))
  })

  it("Quotes report: ready when every quote set up that day is posted; one update per page", () => {
    const day = "2026-11-12"
    const q = (brandId: string, time = "16:00") => ({ brandId, day, caption: "Small steps every day.\nSecond line", time, imageId: `i-${brandId}`, revision: 1 })
    const ctx = (quotes: Record<string, unknown>, posted: Record<string, unknown> = {}) => ({ settings: HP.withDefaults(null), boards: {}, done: {}, carousels: {}, carouselDone: {}, ads: {}, trends: {}, quotes: { [day]: quotes }, posted: { [day]: posted } })
    expect(HP.reportPlan(task("quotes"), ctx({}), day)).toMatchObject({ ready: false, why: "no quote set up today (Quotes tab)" })
    expect(HP.reportPlan(task("quotes"), ctx({ gensan: q("gensan"), fhi: q("fhi", "16:30") }, { "quote:gensan": { at: 1 } }), day)).toMatchObject({ ready: false, posted: 1, total: 2 })
    const plan = HP.reportPlan(task("quotes"), ctx({ gensan: q("gensan"), fhi: q("fhi", "16:30") }, { "quote:gensan": { at: 1 }, "quote:fhi": { at: 1 } }), day)
    expect(plan.ready).toBe(true)
    expect(plan.updates.map((u: { text: string }) => u.text)).toEqual([
      "[𝟰:𝟯𝟬 𝗣𝗠] - Daily Quote posted on FHI Global\n\n𝗖𝗮𝗽𝘁𝗶𝗼𝗻: Small steps every day.",
      "[𝟰 𝗣𝗠] - Daily Quote posted on Homes.ph Gensan\n\n𝗖𝗮𝗽𝘁𝗶𝗼𝗻: Small steps every day.",
    ])
    expect(HP.QUOTE_TIME).toBe("16:00")
  })

  it("a report can go before everything is posted: only what's posted is in it (1.1.2)", () => {
    const s = HP.withDefaults(null)
    const day = "2026-11-14"
    const card = (title: string, extra = {}) => ({ title, posted: false, due: false, ...extra })
    const slots = { "09:00": [card("Nine", { fb: "scheduled" })], "11:00": [card("Eleven", { posted: true })], "15:00": [card("Three")], "19:00": [], "22:00": [] }
    const boards = { [`site|${day}`]: { times: [], hubs: [{ hub: "PicklePlay", slots }] } }
    const base = { settings: s, boards, done: {}, carousels: {}, carouselDone: {}, ads: {}, trends: {}, quotes: {}, posted: {} }
    const plan = HP.reportPlan(task("pickleplay"), base, day)
    expect(plan).toMatchObject({ ready: false, known: true, posted: 2, total: 5 })
    expect(plan.sent.map((u: { text: string }) => u.text.split("\n")[0])).toEqual(["[𝟵 𝗔𝗠] - Nine", "[𝟭𝟭 𝗔𝗠] - Eleven"])
    // Nothing posted: known, nothing to say. No board read: not known (nothing can be sent).
    expect(HP.reportPlan(task("fhi"), { ...base, boards: { [`site|${day}`]: { times: [], hubs: [{ hub: "FHI Global", slots: {} }] } } }, day)).toMatchObject({ ready: false, sent: [] })
    expect(HP.reportPlan(task("gensan"), base, day)).toMatchObject({ ready: false, known: false, sent: [] })
    // Everything posted: the whole report.
    const full = HP.reportPlan(task("pickleplay"), { ...base, boards: { [`site|${day}`]: { times: [], hubs: [{ hub: "PicklePlay", slots: Object.fromEntries(["09:00", "11:00", "15:00", "19:00", "22:00"].map((t) => [t, [card(t, { fb: "scheduled" })]])) }] } } }, day)
    expect(full.ready).toBe(true)
    expect(full.sent).toEqual(full.updates)
    // Ads and quotes: the posted ones only.
    const ad = (id: string, postedAt: number | null) => ({ id, brand: "pickleplay", kind: "history", kindLabel: "History", title: `Ad ${id}`, caption: "c", time: "13:00", revision: 1, postedAt })
    const ads = HP.reportPlan(task("ads"), { ...base, ads: { [day]: { at: 1, data: { day, ads: [ad("a1", null), ad("a2", 5)] } } } }, day)
    expect(ads).toMatchObject({ ready: false, known: true })
    expect(ads.sent.map((u: { key: string }) => u.key)).toEqual(["ad|a2"])
    expect(HP.reportPlan(task("ads"), base, day)).toMatchObject({ known: false, sent: [] })
    const q = (brandId: string) => ({ brandId, day, caption: "Small steps.", time: "16:00", imageId: `i-${brandId}`, revision: 1 })
    const quotes = HP.reportPlan(task("quotes"), { ...base, quotes: { [day]: { fhi: q("fhi"), gensan: q("gensan") } }, posted: { [day]: { "quote:gensan": { at: 1 } } } }, day)
    expect(quotes.sent.map((u: { key: string }) => u.key)).toEqual(["quote|gensan"])
    // A carousel posted on some pages: its line, with the pages still to go marked.
    const pages = [{ key: "main", name: "Homes.ph Main Page", short: "Main Page", sort: 1 }, { key: "ozamiz", name: "Homes.ph Ozamiz", short: "Ozamiz", sort: 2 }]
    const car = (checks: { key: string }[]) => HP.reportPlan(task("carousel"), { ...base, carousels: { [day]: { at: 1, data: { pages, carousels: [{ id: "c1", title: "T", scheduledAt: null, checks }] } } } }, day)
    expect(car([]).sent).toEqual([])
    expect(car([{ key: "main" }]).sent[0].text).toContain("Homes.ph Main Page ✅ | Ozamiz ⏳ |")
  })

  it("Saturday is a half day: 9 AM – 12 PM and Good Afternoon; the other days 9 AM – 6 PM and Good Evening (1.1.2)", () => {
    const sat = "2026-11-14"
    const fri = "2026-11-13"
    expect(HP.workHours(sat)).toEqual({ from: "09:00", to: "12:00" })
    expect(HP.workHours(fri)).toEqual({ from: "09:00", to: "18:00" })
    expect(HP.workHours(new Date(2026, 10, 16, 8))).toEqual({ from: "09:00", to: "18:00" })
    expect(HP.workHoursLabel(sat)).toBe("9:00 AM – 12:00 PM")
    expect(HP.workHoursLabel(fri)).toBe("9:00 AM – 6:00 PM")
    expect(HP.greetingText(sat)).toBe("Good Afternoon Sir @Anthony Orais Leuterio, Sir @Hernan Malubay and Sir @Johnry Fibra ,\n\nHere's my report today:")
    expect(HP.greetingText(fri)).toBe("Good Evening Sir @Anthony Orais Leuterio, Sir @Hernan Malubay and Sir @Johnry Fibra ,\n\nHere's my report today:")
    expect(HP.greetingText(new Date(2026, 10, 14, 23))).toMatch(/^Good Afternoon Sir /)
    expect(HP.dailyGreeting(sat).filter((p: { mention?: string }) => p.mention)).toHaveLength(3)
  })

  it("names a job in the panel; reports never go out by themselves (the old switch is dropped)", () => {
    expect(HP.jobName({ label: "Start Your Day", brandName: "Reports", time: "09:00" })).toBe("Start Your Day")
    expect(HP.jobName({ brandName: "FHI Global", time: "22:00" })).toBe("FHI Global 10 PM")
    expect(HP.withDefaults(null).autoReport).toBeUndefined()
    expect(HP.withDefaults({ autoReport: true }).autoReport).toBeUndefined()
  })

  it("the daily report: offered once every task is Done; the greeting with its 3 mentions, as written", () => {
    expect(HP.greetingText("2026-11-12")).toBe("Good Evening Sir @Anthony Orais Leuterio, Sir @Hernan Malubay and Sir @Johnry Fibra ,\n\nHere's my report today:")
    expect(HP.DAILY_MENTIONS).toEqual(["Anthony Orais Leuterio", "Hernan Malubay", "Johnry Fibra"])
    expect(HP.MESSENGER_REPORT_URL).toBe("https://www.messenger.com/t/974484561951117")
    expect(HP.DTR_REPORT_URL).toBe("https://dtr.homes.ph/m/tasks/report")
    const done = (ids: string[], extra = {}) => ({ tasks: { ...Object.fromEntries(ids.map((id) => [id, { status: "done" }])), ...extra } })
    const all = HP.ADD_TASKS.map((t: { id: string }) => t.id)
    expect(HP.allReportsDone(done(all))).toBe(true)
    expect(HP.allReportsDone(done(all, { trending: { status: "done" } }))).toBe(true)
    expect(HP.allReportsDone(done(all, { trending: { status: "in_progress" } }))).toBe(false)
    expect(HP.allReportsDone(done(all.filter((id: string) => id !== "gensan"), { gensan: { status: "in_progress" } }))).toBe(false)
    expect(HP.allReportsDone(done(all.slice(1)))).toBe(false)
    expect(HP.allReportsDone(undefined)).toBe(false)
  })

  it("an old copy of the page scripts (the extension reloaded) stops quietly instead of throwing", async () => {
    // No chrome.runtime here: like a page's old copy after a reload.
    expect(HP.alive()).toBe(false)
    expect(HP.url("icon-48.png")).toBe("")
    let settled = false
    void HP.store.get("job").then(() => (settled = true), () => (settled = true))
    void HP.send({ type: "whoami" }).then(() => (settled = true), () => (settled = true))
    await new Promise((r) => setTimeout(r, 20))
    expect(settled).toBe(false)
    let undone = false
    HP.onDead(() => (undone = true))
    expect(undone).toBe(true)
    expect(HP.cutOff(new Error("Extension context invalidated."))).toBe(true)
  })
})

describe("Homes.ph Publisher: the day's carousel on its Facebook pages", () => {
  // Daily Carousel Maker's 17-page checklist (its default pages).
  const shorts = ["Main Page", "Ozamiz", "Dumaguete", "BGC Taguig", "Cebu", "Pampanga", "Cavite", "Iloilo", "Bacolod", "Davao", "Palawan", "Bohol", "Makati", "CDO", "Gensan", "Caraga", "Leyte"]
  const keys = ["main", "ozamiz", "dumaguete", "bgc-taguig", "cebu", "pampanga", "cavite", "iloilo", "bacolod", "davao", "palawan", "bohol", "makati", "cdo", "gensan", "caraga", "leyte"]
  const pages = keys.map((key, i) => ({ key, name: `Homes.ph ${shorts[i]}`, short: shorts[i], sort: i + 1 }))

  it("posts at 11:00 PM, to 4 Pages at a time, in the checklist's order", () => {
    expect(HP.CAROUSEL_TIME).toBe("23:00")
    const groups = HP.carouselGroups([...pages].reverse())
    expect(groups.map((g: { pages: { short: string }[] }) => g.pages.length)).toEqual([4, 4, 4, 4, 1])
    expect(groups[0].pages.map((p: { short: string }) => p.short)).toEqual(["Main Page", "Ozamiz", "Dumaguete", "BGC Taguig"])
    expect(groups.map((g: { n: number }) => g.n)).toEqual([1, 2, 3, 4, 5])
    expect(groups[4].pages[0].short).toBe("Leyte")
  })

  it("finds each Page in Target Facebook Pages: Main Page = \"Homes.ph\" (by its ID), a city = the Homes.ph Page with its name", () => {
    const rows = [
      { name: "Homes.ph Caraga", text: "Homes.ph Caraga ID: 111" },
      { name: "Homes.ph", text: "Homes.ph ID: 253657525049795" },
      { name: "Rentals.ph Cebu", text: "Rentals.ph Cebu ID: 222" },
      { name: "Homes.ph Cebu", text: "Homes.ph Cebu ID: 333" },
      { name: "Homes.ph Ozamis City", text: "Homes.ph Ozamis City ID: 444" },
      { name: "Homes.ph BGC", text: "Homes.ph BGC ID: 555" },
      { name: "Homes.ph General Santos", text: "Homes.ph General Santos ID: 666" },
      { name: "PicklePlay", text: "PicklePlay ID: 777" },
    ]
    const s = HP.withDefaults(null)
    const find = (key: string) => HP.matchCarouselPage(rows, HP.carouselTarget(pages.find((p) => p.key === key), s))
    expect(find("main")).toBe(1)
    expect(find("cebu")).toBe(3)
    expect(find("ozamiz")).toBe(4)
    expect(find("bgc-taguig")).toBe(5)
    expect(find("gensan")).toBe(6)
    expect(find("caraga")).toBe(0)
    expect(find("leyte")).toBe(-1)
    // Without its ID, "Homes.ph" is still only the main Page (an exact name), never "Homes.ph Caraga".
    expect(HP.matchCarouselPage([rows[0], { name: "Homes.ph", text: "Homes.ph" }], HP.carouselTarget(pages[0], s))).toBe(1)
    expect(HP.matchCarouselPage([rows[0]], HP.carouselTarget(pages[0], s))).toBe(-1)
    // Two Homes.ph Pages with the word: not one only, so none.
    expect(HP.matchCarouselPage([{ name: "Homes.ph Cebu North", text: "" }, { name: "Homes.ph Cebu South", text: "" }], HP.carouselTarget(pages[4], s))).toBe(-1)
  })

  it("uses the Facebook names typed in Options", () => {
    expect(HP.parseCarouselNames("Ozamiz = Homes.ph Ozamiz City\n\nbad line\n CDO=Homes.ph Cagayan de Oro ")).toEqual({ ozamiz: "Homes.ph Ozamiz City", cdo: "Homes.ph Cagayan de Oro" })
    const s = HP.withDefaults({ carouselPages: "Leyte = Homes.ph Tacloban" })
    expect(HP.withDefaults(null).carouselPages).toBe("")
    const leyte = HP.carouselTarget(pages[16], s)
    expect(leyte).toMatchObject({ names: ["Homes.ph Tacloban"], keywords: [], search: "Homes.ph Tacloban" })
    expect(HP.matchCarouselPage([{ name: "Homes.ph Leyte Old", text: "" }, { name: "Homes.ph Tacloban", text: "" }], leyte)).toBe(1)
  })

  it("a Page is posted when the app's checklist has it ticked, or the extension posted it since the checklist was read", () => {
    const carousel = { id: "c1", checks: [{ key: "main" }] }
    const entry = { at: 1000 }
    expect(HP.carouselPosted(entry, carousel, "main", {})).toBe(true)
    expect(HP.carouselPosted(entry, carousel, "ozamiz", {})).toBe(false)
    expect(HP.carouselPosted(entry, carousel, "ozamiz", { c1: { ozamiz: { at: 2000 } } })).toBe(true)
    // Unticked in the app after it was posted: not posted.
    expect(HP.carouselPosted(entry, carousel, "ozamiz", { c1: { ozamiz: { at: 500 } } })).toBe(false)
  })
})

describe("Daily Carousel Maker's bridge for the extension", () => {
  const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
  it("only lets a browser extension in, at 127.0.0.1 (no website, no other host name)", () => {
    expect(bridge.checkRequest({ host: "127.0.0.1:39390", origin }, 39390)).toBeNull()
    expect(bridge.checkRequest({ host: "evil.example:39390", origin }, 39390)).toMatch(/address/)
    expect(bridge.checkRequest({ host: "127.0.0.1:39390", origin: "https://evil.example" }, 39390)).toMatch(/extension/)
    expect(bridge.checkRequest({ host: "127.0.0.1:39390" }, 39390)).toMatch(/extension/)
    // Chrome leaves the Origin out of an extension's GET: the check-in may come without one (never a website's).
    expect(bridge.checkRequest({ host: "127.0.0.1:39390" }, 39390, "GET")).toBeNull()
    expect(bridge.checkRequest({ host: "127.0.0.1:39390", origin: "https://evil.example" }, 39390, "GET")).toMatch(/extension/)
  })

  it("checks what the extension sends", () => {
    const ok = { brand: "fhi", day: "2026-11-10", time: "22:00", headline: "  UAE Capital  Markets ", articleUrl: "https://fhiglobal.ae/news/x", image: { type: "image/webp", base64: "AAAA", name: "a/b.webp" } }
    expect(bridge.newsPostInput(ok).value).toMatchObject({ brand: "fhi", headline: "UAE Capital Markets", image: { type: "image/webp", name: "a b.webp" } })
    expect(bridge.newsPostInput({ ...ok, brand: "x" }).error).toBeTruthy()
    expect(bridge.newsPostInput({ ...ok, time: "25:00" }).error).toBeTruthy()
    expect(bridge.newsPostInput({ ...ok, headline: "" }).error).toBeTruthy()
    expect(bridge.newsPostInput({ ...ok, image: { type: "text/html", base64: "AAAA" } }).error).toBeTruthy()
    expect(bridge.newsPostInput({ ...ok, articleUrl: "javascript:alert(1)" }).value.articleUrl).toBe("")
    expect(bridge.newsStatusInput({ ...ok, facebook: "scheduled", projectId: "abc12345-x" }).value).toMatchObject({ facebook: "scheduled", projectId: "abc12345-x" })
    // Carousels: the day's, its slides, the pages it was posted to.
    expect(bridge.carouselDayInput({ day: "2026-11-12" }).value).toEqual({ day: "2026-11-12" })
    expect(bridge.carouselDayInput({ day: "12/11/2026" }).error).toBeTruthy()
    expect(bridge.carouselImagesInput({ projectId: "0b6f2c1e-1234-4abc-9def-001122334455" }).value).toEqual({ projectId: "0b6f2c1e-1234-4abc-9def-001122334455", save: true })
    expect(bridge.carouselImagesInput({ projectId: "../etc" }).error).toBeTruthy()
    expect(bridge.carouselPostedInput({ projectId: "abc12345-x", pageKeys: ["main", "ozamiz", "main", "<bad>"], facebook: "scheduled" }).value).toEqual({ projectId: "abc12345-x", pageKeys: ["main", "ozamiz"], facebook: "scheduled" })
    expect(bridge.carouselPostedInput({ projectId: "abc12345-x", pageKeys: [] }).error).toBeTruthy()
  })

  describe("the server", () => {
    let server: { ready: Promise<number | null>; port: number | null; close: () => void }
    const forwarded: unknown[] = []
    const file = path.join(fs.mkdtempSync(path.join(require("node:os").tmpdir(), "dcm-bridge-")), "bridge.json")
    let allow = true
    beforeAll(async () => {
      server = bridge.startBridge({
        file,
        version: "9.9.9",
        forward: async (type: string, payload: unknown) => {
          forwarded.push({ type, payload })
          return { projectId: "p1", png: "iVBORw0KGgo=" }
        },
        askToPair: async () => allow,
      })
      await server.ready
    })
    afterAll(() => server.close())
    const call = (p: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
      fetch(`http://127.0.0.1:${server.port}${p}`, { ...init, headers: { Origin: origin, ...(init.headers ?? {}) } }).then(async (r) => ({ status: r.status, body: await r.json() }))

    it("pairs once the person allows it, then answers only with the token", async () => {
      expect(server.port).toBeGreaterThanOrEqual(39390)
      expect((await call("/v1/ping")).body).toEqual({ app: "Daily Carousel Maker", name: "Homes.ph SocMedSystem", version: "9.9.9", paired: false })
      expect((await call("/v1/news-post", { method: "POST", body: "{}" })).status).toBe(401)
      allow = false
      expect((await call("/v1/pair", { method: "POST", body: JSON.stringify({ name: "Homes.ph Publisher" }) })).status).toBe(403)
      allow = true
      const paired = await call("/v1/pair", { method: "POST", body: JSON.stringify({ name: "Homes.ph Publisher", browser: "Chrome" }) })
      expect(paired.status).toBe(200)
      const auth = { Authorization: `Bearer ${paired.body.token}` }
      expect((await call("/v1/ping", { headers: auth })).body.paired).toBe(true)
      const post = await call("/v1/news-post", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ brand: "fhi", day: "2026-11-10", time: "22:00", headline: "UAE Capital Markets" }) })
      expect(post).toEqual({ status: 200, body: { projectId: "p1", png: "iVBORw0KGgo=" } })
      expect(forwarded).toEqual([{ type: "news-post", payload: { brand: "fhi", day: "2026-11-10", time: "22:00", headline: "UAE Capital Markets", articleUrl: "" } }])
      // Another extension (other origin) with the same token: no.
      const other = await fetch(`http://127.0.0.1:${server.port}/v1/ping`, { headers: { Origin: "chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba", ...auth } }).then((r) => r.json())
      expect(other.paired).toBe(false)
      // A website: no.
      expect((await fetch(`http://127.0.0.1:${server.port}/v1/ping`, { headers: { Origin: "https://evil.example" } })).status).toBe(403)
      // The extension's GET check-in (no Origin), with its token: paired. Anything else without an Origin: no.
      expect(await fetch(`http://127.0.0.1:${server.port}/v1/ping`, { headers: auth }).then((r) => r.json())).toMatchObject({ paired: true })
      expect((await fetch(`http://127.0.0.1:${server.port}/v1/news-post`, { method: "POST", headers: auth, body: "{}" })).status).toBe(403)
      // The day's carousel: forwarded to the app's window, checked first.
      expect((await call("/v1/carousel-day", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ day: "nope" }) })).status).toBe(400)
      expect((await call("/v1/carousel-day", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ day: "2026-11-12" }) })).status).toBe(200)
      expect(forwarded.at(-1)).toEqual({ type: "carousel-day", payload: { day: "2026-11-12" } })
      expect((await call("/v1/carousel-posted", { method: "POST", body: JSON.stringify({ projectId: "abc12345-x", pageKeys: ["main"] }) })).status).toBe(401)
      // The token is kept (the app remembers the extension).
      expect(JSON.parse(fs.readFileSync(file, "utf8")).clients).toHaveLength(1)
    })
  })
})
