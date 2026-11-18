import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { SAMPLE_CONTENT } from "@/lib/ads/render"
import {
  AD_BRAND_IDS,
  AD_NEWS_BRAND,
  adImageName,
  adKindLabel,
  adTimeLabel,
  adTimeProblem,
  adTimeWarning,
  adTitle,
  nearestAdTime,
  recommendAdTimes,
  toMinutes,
  type AdTimeContext,
} from "@/lib/ads/schedule-time"
import { newsTimesFor } from "@/lib/design/news-templates"

const require = createRequire(import.meta.url)
const bridge = require("../electron/extension-bridge.cjs")

const pickleplay: AdTimeContext = { brand: "pickleplay" }

describe("Advertisement times: 1 hour from the News Article postings and the other ads", () => {
  it("PicklePlay: 3:30 PM is too close to the 3 PM article; 1 PM and 5 PM are fine", () => {
    expect(adTimeProblem("15:30", pickleplay)).toEqual({ reason: "article", message: "Too close to the 3:00 PM PicklePlay article: keep 1 hour apart" })
    expect(adTimeProblem("13:00", pickleplay)).toBeNull()
    expect(adTimeProblem("17:00", pickleplay)).toBeNull()
    expect(adTimeProblem("09:20", pickleplay)?.message).toMatch(/9:00 AM PicklePlay article/)
  })

  it("60 minutes apart exactly is OK, 59 is not", () => {
    // 10 AM is exactly 1 hour from the 9 AM and 11 AM articles.
    expect(adTimeProblem("10:00", pickleplay)).toBeNull()
    expect(adTimeProblem("14:00", pickleplay)).toBeNull()
    expect(adTimeProblem("14:01", pickleplay)?.reason).toBe("article")
    expect(adTimeProblem("23:00", pickleplay)).toBeNull()
    expect(adTimeProblem("22:59", pickleplay)?.reason).toBe("article")
  })

  it("another ad of the brand that day blocks the hour around it (60 minutes is OK)", () => {
    const ctx: AdTimeContext = { brand: "pickleplay", ads: [{ time: "13:00", label: "Trivia" }] }
    expect(adTimeProblem("13:30", ctx)).toEqual({ reason: "ad", message: "Too close to the 1:00 PM Trivia ad: keep 1 hour apart" })
    expect(adTimeProblem("12:30", ctx)?.reason).toBe("ad")
    expect(adTimeProblem("12:00", ctx)).toBeNull()
    expect(adTimeProblem("14:00", ctx)).toBeNull()
    expect(recommendAdTimes(ctx)).not.toContain("13:00")
    expect(recommendAdTimes(ctx).every((t) => Math.abs(toMinutes(t)! - 13 * 60) >= 60)).toBe(true)
  })

  it("each brand keeps clear of its own posting times (Homes.ph ads: Homes.ph CARAGA's)", () => {
    expect(AD_NEWS_BRAND).toEqual({ pickleplay: "pickleplay", fhi: "fhi", homes: "caraga", gensan: "gensan" })
    expect(adTimeProblem("13:00", { brand: "homes" })?.message).toBe("Too close to the 1:30 PM Homes.ph CARAGA article: keep 1 hour apart")
    expect(adTimeProblem("13:00", { brand: "gensan" })?.message).toMatch(/1:30 PM Homes.ph Gensan article/)
    // 1 PM is fine for PicklePlay and FHI (their 1:30 PM has no article).
    expect(adTimeProblem("13:00", { brand: "fhi" })).toBeNull()
    expect(adTimeProblem("15:00", { brand: "homes" })).toBeNull()
  })

  it("recommends times spread over the day, the best (farthest, 10 AM – 9 PM) first", () => {
    const times = recommendAdTimes(pickleplay)
    expect(times[0]).toBe("13:00")
    expect([...times].sort()).toEqual(["10:00", "13:00", "17:00", "20:30"])
    expect(times.map(adTimeLabel)).toContain("8:30 PM")
    for (const brand of AD_BRAND_IDS) {
      const recommended = recommendAdTimes({ brand })
      expect(recommended).toHaveLength(4)
      for (const t of recommended) {
        expect(adTimeProblem(t, { brand })).toBeNull()
        for (const a of newsTimesFor(AD_NEWS_BRAND[brand])) expect(Math.abs(toMinutes(t)! - toMinutes(a.time)!)).toBeGreaterThanOrEqual(60)
        // On the half hour, 7:00 AM – 11:30 PM.
        expect(toMinutes(t)! % 30).toBe(0)
        expect(toMinutes(t)!).toBeGreaterThanOrEqual(7 * 60)
        expect(toMinutes(t)!).toBeLessThanOrEqual(23 * 60 + 30)
      }
    }
  })

  it("today: never a time that has passed; a past day has none", () => {
    const ctx: AdTimeContext = { brand: "pickleplay", now: 14 * 60 + 10 }
    expect(adTimeProblem("13:00", ctx)).toEqual({ reason: "past", message: "1:00 PM has already passed today" })
    expect(adTimeProblem("14:10", ctx)?.reason).toBe("past")
    expect(recommendAdTimes(ctx).every((t) => toMinutes(t)! > 14 * 60 + 10)).toBe(true)
    expect(recommendAdTimes(ctx)[0]).toBe("17:00")
    expect(recommendAdTimes({ brand: "pickleplay", now: 1440 })).toEqual([])
    expect(adTimeProblem("17:00", { brand: "pickleplay", now: 1440 })?.reason).toBe("past")
  })

  it("a trend poster close by is a warning only (and recommended times keep away from it)", () => {
    const ctx: AdTimeContext = { brand: "pickleplay", posters: [{ time: "17:00", label: "Pickleplay.ph DTN 1 trend poster" }] }
    expect(adTimeProblem("17:00", ctx)).toBeNull()
    expect(adTimeWarning("17:30", ctx)).toBe("Close to the 5:00 PM Pickleplay.ph DTN 1 trend poster (Poster Maker): best to keep 1 hour apart")
    expect(adTimeWarning("13:00", ctx)).toBeNull()
    const times = recommendAdTimes(ctx)
    expect(times).not.toContain("17:00")
    expect(times.every((t) => !adTimeWarning(t, ctx))).toBe(true)
  })

  it("offers the nearest time that works", () => {
    expect(nearestAdTime("15:30", pickleplay)).toBe("16:00")
    expect(nearestAdTime("15:00", pickleplay)).toBe("14:00")
    expect(nearestAdTime("13:30", { brand: "pickleplay", ads: [{ time: "13:00", label: "History" }] })).toBe("14:00")
    expect(nearestAdTime("13:00", { brand: "pickleplay", now: 1440 })).toBeNull()
  })

  it("a time that isn't one is a problem", () => {
    expect(adTimeProblem("", pickleplay)?.reason).toBe("invalid")
    expect(adTimeProblem("25:00", pickleplay)?.reason).toBe("invalid")
    expect(toMinutes("7:00")).toBeNull()
    expect(adTimeLabel("00:30")).toBe("12:30 AM")
    expect(adTimeLabel("12:00")).toBe("12:00 PM")
  })
})

describe("Scheduled advertisements: names and titles", () => {
  it("names the PNG by day, time, brand and kind (no ':' for Windows)", () => {
    expect(adImageName({ day: "2026-11-12", time: "13:00", brand: "pickleplay", kind: "history" })).toBe("2026-11-12 1-00 PM PicklePlay History.png")
    expect(adImageName({ day: "2026-11-12", time: "20:30", brand: "pickleplay", kind: "funfact" })).toBe("2026-11-12 8-30 PM PicklePlay Fun Facts.png")
    expect(["history", "trivia", "funfact", "courtowner", "comingsoon", "nowopen"].map((k) => adKindLabel(k as "history"))).toEqual(["History", "Trivia", "Fun Facts", "Court Owners", "Coming Soon", "Now Open"])
  })

  it("titles an ad with its main words on one line", () => {
    expect(adTitle(SAMPLE_CONTENT.history)).toBe("Pickleball was born in a backyard in 1965.")
    expect(adTitle(SAMPLE_CONTENT.trivia)).toBe("What were the first paddles made of?")
    expect(adTitle(SAMPLE_CONTENT.funfact)).toBe("An outdoor pickleball has 40 holes!")
    expect(adTitle(SAMPLE_CONTENT.courtowner)).toBe("Fill your courts!")
    expect(adTitle({ ...SAMPLE_CONTENT.nowopen, courtName: "Bouncy  Kitchen", barangay: "Brgy. Tacunan", city: "Davao City" })).toBe("Bouncy Kitchen · Brgy. Tacunan, Davao City")
  })
})

describe("Daily Carousel Maker's bridge: advertisements and Daily Trend News", () => {
  const id = "0b6f2c1e-1234-4abc-9def-001122334455"
  it("checks what the extension sends", () => {
    expect(bridge.adsDayInput({ day: "2026-11-12" }).value).toEqual({ day: "2026-11-12" })
    for (const day of ["2026-02-30", "12/11/2026", "", 20261112, "2026-13-01"]) expect(bridge.adsDayInput({ day }).error).toBeTruthy()
    expect(bridge.adsDayInput(null).error).toBeTruthy()
    expect(bridge.trendsDayInput({ day: "2026-11-12" }).value).toEqual({ day: "2026-11-12" })
    expect(bridge.trendsDayInput({ day: "2026-11-31" }).error).toBeTruthy()

    expect(bridge.adImageInput({ id, save: true }).value).toEqual({ id, save: true })
    expect(bridge.adImageInput({ id, save: false }).value).toEqual({ id, save: false })
    expect(bridge.adImageInput({ id }).value).toEqual({ id, save: true })
    for (const bad of ["../etc/passwd", "short", 12345678, "x".repeat(65), "<script>alert(1)</script>"]) expect(bridge.adImageInput({ id: bad }).error).toBeTruthy()
    expect(bridge.trendImageInput({ id, save: false }).value).toEqual({ id, save: false })
    expect(bridge.trendImageInput({}).error).toBeTruthy()

    expect(bridge.adPostedInput({ id, facebook: "posted" }).value).toEqual({ id, facebook: "posted" })
    expect(bridge.adPostedInput({ id, facebook: "scheduled" }).value).toEqual({ id, facebook: "scheduled" })
    expect(bridge.adPostedInput({ id, facebook: "deleted" }).error).toBeTruthy()
    expect(bridge.adPostedInput({ id }).error).toBeTruthy()
    expect(bridge.adPostedInput({ facebook: "posted" }).error).toBeTruthy()

    const other = "abc12345-x"
    expect(bridge.trendTextsInput({ ids: [id, id, "<bad>", 7, other] }).value).toEqual({ ids: [id, other] })
    expect(bridge.trendTextsInput({ ids: Array.from({ length: 30 }, (_, i) => `poster-${String(i).padStart(4, "0")}`) }).value.ids).toHaveLength(30)
    expect(bridge.trendTextsInput({ ids: Array.from({ length: 31 }, (_, i) => `poster-${String(i).padStart(4, "0")}`) }).error).toMatch(/30/)
    expect(bridge.trendTextsInput({ ids: [] }).error).toBeTruthy()
    expect(bridge.trendTextsInput({ ids: "abc12345" }).error).toBeTruthy()
  })

  it("routes each request to the app's window by its own type", () => {
    const table = Object.fromEntries(Object.entries(bridge.ROUTES as Record<string, [string, unknown]>).map(([p, [type]]) => [p, type]))
    expect(table).toEqual({
      "/v1/carousel-day": "carousel-day",
      "/v1/carousel-images": "carousel-images",
      "/v1/carousel-posted": "carousel-posted",
      "/v1/ads-day": "ads-day",
      "/v1/ad-image": "ad-image",
      "/v1/ad-posted": "ad-posted",
      "/v1/trends-day": "trends-day",
      "/v1/trend-image": "trend-image",
      "/v1/trend-texts": "trend-texts",
    })
    expect(bridge.ROUTES["/v1/ads-day"][1]).toBe(bridge.adsDayInput)
    expect(bridge.ROUTES["/v1/trend-texts"][1]).toBe(bridge.trendTextsInput)
    for (const p of ["__proto__", "constructor", "toString", "/v1/news-post"]) expect(Object.hasOwn(bridge.ROUTES, p)).toBe(false)
  })

  describe("the server", () => {
    const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
    const forwarded: { type: string; payload: unknown }[] = []
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "dcm-bridge-ads-")), "bridge.json")
    let server: { ready: Promise<number | null>; port: number | null; close: () => void }
    beforeAll(async () => {
      server = bridge.startBridge({
        file,
        version: "9.9.9",
        forward: async (type: string, payload: unknown) => {
          forwarded.push({ type, payload })
          return { ok: true }
        },
        askToPair: async () => true,
      })
      await server.ready
    })
    afterAll(() => server.close())
    const call = (p: string, body: unknown, token?: string) =>
      fetch(`http://127.0.0.1:${server.port}${p}`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json() }))

    it("needs the token, checks the input, then forwards it", async () => {
      expect(server.port).not.toBeNull()
      expect((await call("/v1/ads-day", { day: "2026-11-12" })).status).toBe(401)
      const { body } = await call("/v1/pair", { name: "Homes.ph Publisher", browser: "Chrome" })
      const token = body.token as string
      expect((await call("/v1/ads-day", { day: "2026-02-30" }, token)).status).toBe(400)
      expect(await call("/v1/ads-day", { day: "2026-11-12" }, token)).toEqual({ status: 200, body: { ok: true } })
      expect((await call("/v1/ad-posted", { id, facebook: "maybe" }, token)).status).toBe(400)
      expect((await call("/v1/ad-posted", { id, facebook: "scheduled" }, token)).status).toBe(200)
      expect((await call("/v1/trend-texts", { ids: [id] }, token)).status).toBe(200)
      expect((await call("/v1/ad-images", { id }, token)).status).toBe(404)
      expect(forwarded).toEqual([
        { type: "ads-day", payload: { day: "2026-11-12" } },
        { type: "ad-posted", payload: { id, facebook: "scheduled" } },
        { type: "trend-texts", payload: { ids: [id] } },
      ])
    })
  })
})
