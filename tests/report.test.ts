import { describe, expect, it } from "vitest"
import type { ReportCarousel, ReportData, ReportPost } from "@/lib/data/report"
import type { PostPage } from "@/lib/data/posting"
import type { NewsBrand } from "@/lib/design/news-templates"
import { buildCaragaNews, buildFhiPortraitNews, buildPickleplayNews } from "@/lib/design/templates"
import type { ProjectRow } from "@/lib/types"
import { doneCarousels, planPending } from "@/lib/report/daily-report"

const PAGES: PostPage[] = ["main", "cebu", "ozamiz"].map((key, i) => ({ key, name: `Homes.ph ${key}`, short_name: key === "main" ? "Main Page" : key[0].toUpperCase() + key.slice(1), sort: i }))
const day = new Date("2026-10-28T00:00:00")
const tomorrow = new Date("2026-10-29T00:00:00")

const project = (patch: Partial<ProjectRow>): ProjectRow =>
  ({ id: Math.random().toString(36), title: "Carousel", caption: "", status: "scheduled", scheduled_at: "2026-10-28T15:00:00Z", ...patch }) as ProjectRow
const post = (brand: NewsBrand, time: string): ReportPost => ({
  project: project({}),
  design: brand === "pickleplay" ? buildPickleplayNews() : brand === "fhi" ? buildFhiPortraitNews() : buildCaragaNews(),
  brand,
  time,
})
const carousel = (posted: string[], status: ProjectRow["status"] = "scheduled"): ReportCarousel => ({
  project: project({ status }),
  slides: [],
  postedPages: PAGES.filter((p) => posted.includes(p.key)),
  pagesLeft: PAGES.filter((p) => !posted.includes(p.key)),
})
const ALL = ["09:00", "11:00", "15:00", "19:00", "22:00"]
/** Homes.ph CARAGA posts at its own times. */
const CARAGA = ["11:00", "13:30", "18:00", "20:00", "22:00"]
const caragaDay = () => CARAGA.map((t) => post("caraga", t))

describe("Daily Tasks report: done and pending", () => {
  it("a full day: nothing pending today; tomorrow's PicklePlay + FHI slots are one line, CARAGA (own times) another", () => {
    const data: ReportData = {
      pages: PAGES,
      today: {
        day,
        posts: [...ALL.map((t) => post("pickleplay", t)), ...ALL.map((t) => post("fhi", t)), ...caragaDay()],
        carousels: [carousel(["main", "cebu", "ozamiz"], "published")],
      },
      tomorrow: { day: tomorrow, posts: [], carousels: [carousel([])] },
    }
    expect(doneCarousels(data.today)).toHaveLength(1)
    expect(planPending(data)).toEqual([
      { kind: "articles", brands: ["pickleplay", "fhi"], day: tomorrow, times: ALL },
      { kind: "articles", brands: ["caraga"], day: tomorrow, times: CARAGA },
    ])
  })

  it("CARAGA's 1:30 PM slot is its own; a post at another brand's time doesn't fill it", () => {
    const data: ReportData = {
      pages: PAGES,
      today: { day, posts: [...ALL.map((t) => post("pickleplay", t)), ...ALL.map((t) => post("fhi", t)), post("caraga", "11:00"), post("caraga", "13:30")], carousels: [carousel(["main", "cebu", "ozamiz"], "published")] },
      tomorrow: { day: tomorrow, posts: [...ALL.map((t) => post("pickleplay", t)), ...ALL.map((t) => post("fhi", t)), ...caragaDay()], carousels: [carousel([])] },
    }
    expect(planPending(data)).toEqual([{ kind: "articles", brands: ["caraga"], day, times: ["18:00", "20:00", "22:00"] }])
  })

  it("missing slots per brand, a part-posted carousel with its pages left, and no carousel made for tomorrow", () => {
    const data: ReportData = {
      pages: PAGES,
      today: { day, posts: [post("pickleplay", "09:00"), ...ALL.map((t) => post("fhi", t)), ...caragaDay()], carousels: [carousel(["main"])] },
      tomorrow: { day: tomorrow, posts: [...ALL.map((t) => post("pickleplay", t)), ...caragaDay()], carousels: [] },
    }
    const pending = planPending(data)
    expect(pending).toContainEqual({ kind: "articles", brands: ["pickleplay"], day, times: ["11:00", "15:00", "19:00", "22:00"] })
    expect(pending).toContainEqual({ kind: "carousel", day, time: expect.any(String), state: "partial", pagesLeft: ["Cebu", "Ozamiz"], title: "Carousel" })
    expect(pending).toContainEqual({ kind: "articles", brands: ["fhi"], day: tomorrow, times: ALL })
    expect(pending).toContainEqual({ kind: "carousel", day: tomorrow, time: "23:00", state: "not-made", pagesLeft: [] })
    expect(doneCarousels(data.today)).toHaveLength(1)
  })

  it("a carousel not posted on any page is pending, not done", () => {
    const data: ReportData = { pages: PAGES, today: { day, posts: [], carousels: [carousel([])] }, tomorrow: { day: tomorrow, posts: [], carousels: [carousel([])] } }
    expect(doneCarousels(data.today)).toHaveLength(0)
    expect(planPending(data).filter((p) => p.kind === "carousel")).toEqual([
      { kind: "carousel", day, time: expect.any(String), state: "not-posted", pagesLeft: ["Main Page", "Cebu", "Ozamiz"], title: "Carousel" },
    ])
  })
})
