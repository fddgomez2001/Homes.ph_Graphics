import { describe, expect, it } from "vitest"
import { strToU8, zipSync } from "fflate"
import { BACKUP_FORMAT, BackupError, backupImageSources, readBackup } from "@/lib/backup"
import { findContentIssues, lineCount, lowResolutionPhotos } from "@/lib/design/content-rules"
import { coverTitle, mergeTitle } from "@/lib/design/cover-title"
import type { MeasureText } from "@/lib/design/layout"
import { buildCardDesign, buildCoverDesign, DEFAULT_TEMPLATE_CONTEXT, imageElement } from "@/lib/design/templates"
import type { SlideDesign, TextElement } from "@/lib/design/types"
import { slideTextFields } from "@/lib/float"

/** One rendered line per "\n"-separated line. */
const measure: MeasureText = (el) => el.lineHeight * el.text.split("\n").length

const withText = (design: SlideDesign, role: string, text: string): SlideDesign => ({
  ...design,
  elements: design.elements.map((e) => (e.type === "text" && e.role === role ? { ...e, text } : e)),
})

describe("carousel title from the cover", () => {
  it("merges Headline 1 and Headline 2 into one clean title", () => {
    expect(mergeTitle("Every Sound", "Carries A Story.")).toBe("Every Sound Carries A Story.")
    expect(mergeTitle("  Rent  or\nBuy? ", "")).toBe("Rent or Buy?")
    expect(mergeTitle("", "Only Gold")).toBe("Only Gold")
    expect(mergeTitle(" ", " ")).toBe("")
  })

  it("reads the visible headline lines of a cover", () => {
    const cover = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT, { white: "Every Sound", yellow: "Carries A Story.", description: "6 Instruments" })
    expect(coverTitle(cover)).toBe("Every Sound Carries A Story.")
    const hidden = { ...cover, elements: cover.elements.map((e) => (e.role === "highlight" ? { ...e, visible: false } : e)) }
    expect(coverTitle(hidden)).toBe("Every Sound")
  })
})

describe("card description: 2–3 lines", () => {
  const card = buildCardDesign()
  const description = (d: SlideDesign) => d.elements.find((e): e is TextElement => e.type === "text" && e.role === "description")!

  it("accepts 2 and 3 lines", () => {
    for (const text of ["Line one\nLine two", "One\nTwo\nThree"]) {
      expect(findContentIssues(withText(card, "description", text), measure)).toEqual([])
    }
  })

  it("asks for more when it is empty or a single line", () => {
    const empty = findContentIssues(withText(card, "description", "  "), measure)
    expect(empty).toMatchObject([{ kind: "description-short", lines: 0 }])
    const one = findContentIssues(withText(card, "description", "Just one line"), measure)
    expect(one).toMatchObject([{ kind: "description-short", lines: 1 }])
    expect(one[0].message).toMatch(/2 to 3 lines/)
  })

  it("asks to shorten it above 3 lines", () => {
    const issues = findContentIssues(withText(card, "description", "1\n2\n3\n4"), measure)
    expect(issues).toMatchObject([{ kind: "description-long", lines: 4 }])
    expect(issues[0].message).toMatch(/shorten it to 3 lines/)
  })

  it("only applies to the Homes.ph content card", () => {
    expect(findContentIssues(buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT), measure)).toEqual([])
    expect(lineCount(description(withText(card, "description", "a\nb")), measure)).toBe(2)
  })
})

describe("floating editor fields", () => {
  it("lists the cover's headline lines and subtitle in order", () => {
    const fields = slideTextFields(buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT))
    // The cover's subtitle line uses the "description" role.
    expect(fields.map((f) => f.role)).toEqual(["headline", "highlight", "description"])
  })

  it("lists a card's title, subtitle and description", () => {
    const fields = slideTextFields(buildCardDesign())
    expect(fields.map((f) => f.role)).toEqual(["title", "subtitle", "description"])
  })
})

describe("backup files", () => {
  const cover = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT, { white: "Rent", yellow: "Or Buy?" })
  const photo = "https://res.cloudinary.com/demo/image/upload/v1/user/photo.jpg"
  const withPhoto: SlideDesign = { ...cover, elements: [imageElement({ name: "Photo", src: photo, naturalWidth: 10, naturalHeight: 10 }), ...cover.elements] }
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

  const zip = (manifest: unknown, extra: Record<string, Uint8Array> = {}) =>
    zipSync({ "backup.json": strToU8(JSON.stringify(manifest)), ...extra })

  it("collects the photos to include, without the bundled brand files", () => {
    const sources = backupImageSources([withPhoto, withPhoto])
    expect(sources).toEqual([photo])
    expect(sources.some((s) => s.startsWith("/brand/"))).toBe(false)
  })

  it("reads a backup back with its carousels and images", () => {
    const bytes = zip(
      {
        format: BACKUP_FORMAT,
        version: 1,
        projects: [
          {
            title: "Rent Or Buy?",
            caption: "Caption here",
            topic: null,
            scheduled_at: "2026-11-02T01:00:00.000Z",
            status: "scheduled",
            archived_at: null,
            slides: [
              { slide_type: "cover", design: withPhoto },
              { slide_type: "cover", design: buildCardDesign() },
            ],
          },
        ],
        images: [
          { file: "images/0001.png", src: photo, name: "photo.jpg" },
          { file: "images/missing.png", src: "https://example.com/x.png", name: null },
        ],
      },
      { "images/0001.png": png },
    )
    const { manifest, files } = readBackup(bytes)
    expect(manifest.projects).toHaveLength(1)
    const p = manifest.projects[0]
    expect(p).toMatchObject({ title: "Rent Or Buy?", caption: "Caption here", status: "scheduled", scheduled_at: "2026-11-02T01:00:00.000Z" })
    // Slide types are always cover first, then cards.
    expect(p.slides.map((s) => s.slide_type)).toEqual(["cover", "card"])
    expect(manifest.images).toEqual([{ file: "images/0001.png", src: photo, name: "photo.jpg" }])
    expect(files["images/0001.png"]).toEqual(png)
  })

  it("cleans up odd values instead of trusting them", () => {
    const { manifest } = readBackup(
      zip({
        format: BACKUP_FORMAT,
        version: 1,
        projects: [
          { title: "", caption: 42, status: "hacked", scheduled_at: "not a date", slides: [{ design: cover }] },
          { title: "No slides", slides: [] },
        ],
      }),
    )
    expect(manifest.projects).toHaveLength(1)
    expect(manifest.projects[0]).toMatchObject({ title: "Untitled carousel", caption: "", status: "draft", scheduled_at: null })
  })

  it("explains what's wrong with files that aren't backups", () => {
    expect(() => readBackup(new Uint8Array([1, 2, 3]))).toThrow(BackupError)
    expect(() => readBackup(zipSync({ "notes.txt": strToU8("hi") }))).toThrow(/backup.json is missing/)
    expect(() => readBackup(zip({ format: "something-else", version: 1, projects: [] }))).toThrow(/isn't a carousel backup/)
    expect(() => readBackup(zip({ format: BACKUP_FORMAT, version: 99, projects: [] }))).toThrow(/newer version/)
    expect(() => readBackup(zip({ format: BACKUP_FORMAT, version: 1, projects: [] }))).toThrow(/doesn't contain any carousels/)
  })
})

describe("export quality: soft (enlarged) photos are flagged", () => {
  const cover = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT)
  const withPhoto = (w: number, h: number): SlideDesign => ({
    ...cover,
    elements: cover.elements.map((e) => (e.role === "background" ? { ...e, src: "https://res.cloudinary.com/x/photo.png", naturalWidth: w, naturalHeight: h } : e)),
  })

  it("passes photos at least 1254 px (any larger original is drawn at full detail)", () => {
    expect(lowResolutionPhotos(withPhoto(1254, 1254))).toEqual([])
    expect(lowResolutionPhotos(withPhoto(4032, 3024))).toEqual([])
  })

  it("warns about a 1024 × 1024 photo (e.g. from ChatGPT) and says the size needed", () => {
    const [warning] = lowResolutionPhotos(withPhoto(1024, 1024))
    expect(warning.message).toMatch(/1024 × 1024 px, so it's enlarged 1\.2×/)
    expect(warning.message).toMatch(/at least 1254 × 1254 px/)
  })

  it("never flags the bundled brand files (logo, icons, swoosh)", () => {
    expect(lowResolutionPhotos(cover)).toEqual([])
  })
})

describe("export file names", () => {
  it("numbers the slides in order: the cover is 1.png, then 2.png, 3.png…", async () => {
    const { slideFileName } = await import("@/lib/export")
    expect([0, 1, 2, 6].map((i) => slideFileName(i, "png"))).toEqual(["1.png", "2.png", "3.png", "7.png"])
    expect(slideFileName(0, "jpeg")).toBe("1.jpg")
  })

  it("puts 1.png … n.png and summary.txt in the ZIP", async () => {
    const { buildZip } = await import("@/lib/export")
    const { unzipSync } = await import("fflate")
    const slides = [buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT), buildCardDesign()].map((design, i) => ({ type: i ? ("card" as const) : ("cover" as const), design }))
    const files = slides.map((_, i) => ({ index: i, name: `${i + 1}.png`, blob: new Blob([new Uint8Array([i])]) }))
    const zip = await buildZip({ title: "Hello", caption: "Caption", status: "scheduled", scheduled_at: null }, files, slides)
    const names = Object.keys(unzipSync(new Uint8Array(await zip.arrayBuffer())))
    expect(names).toEqual(["1.png", "2.png", "summary.txt"])
  })
})

describe("one carousel a day, posted at 11 PM", () => {
  const at = (d: string, t = "23:00") => new Date(`${d}T${t}:00`).toISOString()

  it("starts on the first day without a carousel (Oct 30 – Nov 3 taken → Nov 4)", async () => {
    const { nextFreeDay, DEFAULT_PUBLISH_TIME } = await import("@/lib/dates")
    expect(DEFAULT_PUBLISH_TIME).toBe("23:00")
    const taken = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"].map((d) => at(d))
    const day = nextFreeDay(taken, new Date("2026-10-30T10:00:00"))
    expect([day.getFullYear(), day.getMonth() + 1, day.getDate()]).toEqual([2026, 11, 4])
  })

  it("fills a gap first, and skips today once 11 PM has passed", async () => {
    const { nextFreeDay } = await import("@/lib/dates")
    const gap = nextFreeDay([at("2026-10-30"), at("2026-11-01")], new Date("2026-10-30T10:00:00"))
    expect(gap.getDate()).toBe(31)
    const late = nextFreeDay([], new Date("2026-10-30T23:30:00"))
    expect(late.getDate()).toBe(31)
    const free = nextFreeDay([null, undefined], new Date("2026-10-30T08:00:00"))
    expect(free.getDate()).toBe(30)
  })

  it("labels carousels made early, on the day, or late", async () => {
    const { madeTiming, madeTimingLabel } = await import("@/lib/dates")
    const early = madeTiming("2026-10-30T10:00:00", at("2026-11-04"))!
    expect(early).toEqual({ kind: "early", days: 5 })
    expect(madeTimingLabel(early)).toBe("Made early · 5 days ahead")
    expect(madeTimingLabel(madeTiming("2026-11-03T22:00:00", at("2026-11-04"))!)).toBe("Made early · 1 day ahead")
    expect(madeTimingLabel(madeTiming("2026-11-04T09:00:00", at("2026-11-04"))!)).toBe("Made on the day")
    expect(madeTimingLabel(madeTiming("2026-11-05T09:00:00", at("2026-11-04"))!)).toBe("Made late")
    expect(madeTiming("2026-11-04T09:00:00", null)).toBeNull()
  })
})
