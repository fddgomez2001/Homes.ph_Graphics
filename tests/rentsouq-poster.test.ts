import { describe, expect, it } from "vitest"
import {
  inScope,
  isBrandPoster,
  isPosterTabParam,
  LOOK_BRAND,
  lookDesign,
  lookOfTab,
  POSTER_TABS,
  posterBrandOf,
  rentsouqLayoutOf,
  scopeName,
  tabOfParam,
} from "@/components/posters/poster-shared"
import type { ReportPoster } from "@/lib/data/report"
import { applyNewsChange, newsCredit, newsHeadline, newsHighlight, newsPhotoFrame, newsSubtextLook, newsSubtextState } from "@/lib/data/news"
import {
  articleTemplatesFor,
  getNewsTemplate,
  isDailyBrand,
  isPosterTemplate,
  isRentsouqTemplate,
  NEWS_BRANDS,
  NEWS_TEMPLATES,
  NEWS_TIMES,
  newsBrandOf,
  newsFileName,
  newsTemplatesFor,
  posterLayoutOf,
  posterTemplateId,
  RENTSOUQ_BRAND,
  RENTSOUQ_TEMPLATE_IDS,
  RENTSOUQ_TEMPLATES,
  rentsouqTemplateId,
} from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildFhiPortraitPoster, buildPickleplayPortraitPoster, buildRentsouqPortraitPoster, buildRentsouqPoster, isPosterSubtext, POSTER_SUBTEXT_COLORS } from "@/lib/design/templates"
import type { ImageElement, ShapeElement, SlideDesign, TextElement } from "@/lib/design/types"
import { TREND_GROUPS, trendEntries } from "@/lib/report/trend-news"
import type { ProjectRow } from "@/lib/types"

const HEADLINE = "More than 600 cyclists take on Pampanga’s dirt roads at Gravelton Clark 2026"
const byName = <T,>(d: SlideDesign, name: string) => d.elements.find((e) => e.name === name) as T
const PHOTO = { src: "https://res.cloudinary.com/demo/image/upload/dubai.jpg", naturalWidth: 2000, naturalHeight: 1200 }

/** An FHI Global Property poster as the Poster Maker saves it (New Template unless asked). */
function fhiPoster(layout: "portrait" | "square" = "portrait"): SlideDesign {
  const base = getNewsTemplate(posterTemplateId("fhi", "news", layout))!.build()
  return applyNewsChange(applyNewsChange(base, { photo: PHOTO }), {
    headline: HEADLINE,
    highlight: ["600 cyclists"],
    credit: { enabled: true, name: "Frank Gomez" },
    subtext: "November 22, 2026 | Clark | 600 Riders",
    subtextOn: true,
    subtextStyle: "highlight",
    subtextHook: "Clark",
    photoFrame: { zoom: 1.6, focusX: 0.2, focusY: 0.7 },
  })
}

describe("Rentsouq.ae poster templates (Figma Resnsouq_Poster / Old_Template_Resnsouq Poster)", () => {
  it("New Template (1126 × 1408) is the default, Old Template is 1254 × 1254; both are posters, never News Article templates", () => {
    expect(RENTSOUQ_TEMPLATE_IDS).toEqual({ portrait: "rentsouq-portrait-poster-news", square: "rentsouq-poster-news" })
    expect(rentsouqTemplateId()).toBe("rentsouq-portrait-poster-news")
    expect(rentsouqTemplateId("square")).toBe("rentsouq-poster-news")
    expect(RENTSOUQ_TEMPLATES.map((t) => [t.id, t.width, t.height])).toEqual([
      ["rentsouq-portrait-poster-news", 1126, 1408],
      ["rentsouq-poster-news", 1254, 1254],
    ])
    for (const t of RENTSOUQ_TEMPLATES) {
      const d = t.build()
      expect([d.width, d.height, d.templateId]).toEqual([t.width, t.height, t.id])
      expect(getNewsTemplate(t.id)).toBe(t)
      expect(isPosterTemplate(t.id)).toBe(true)
      expect(isRentsouqTemplate(t.id)).toBe(true)
    }
    expect(posterLayoutOf("rentsouq-portrait-poster-news")).toBe("portrait")
    expect(posterLayoutOf("rentsouq-poster-news")).toBe("square")
    // Not in the editor's / News Article's lists, not a brand of its own.
    expect(NEWS_TEMPLATES.some((t) => t.id.startsWith("rentsouq"))).toBe(false)
    expect(newsTemplatesFor("fhi").some((t) => t.id.startsWith("rentsouq"))).toBe(false)
    expect(articleTemplatesFor("fhi").some((t) => t.id.startsWith("rentsouq"))).toBe(false)
    expect(isRentsouqTemplate("fhi-portrait-poster-news")).toBe(false)
  })

  it("New Template: the Rentsouq.ae gradient, logo, #1B4FD8 frame with a #F4AA1D border, orange highlight and subtext, rentsouq.ae footer", () => {
    const d = buildRentsouqPortraitPoster({ headline: HEADLINE })
    expect(byName<ShapeElement>(d, "Base").fill).toEqual({ type: "solid", color: "#2D59A8" })
    expect(byName<ShapeElement>(d, "Brand Gradient")).toMatchObject({
      opacity: 0.7,
      fill: {
        type: "linear",
        angle: 0.41,
        stops: [
          { offset: 0, color: "#001F3F" },
          { offset: 0.0358, color: "#001F3F" },
          { offset: 0.3111, color: "#205ED7" },
          { offset: 1, color: "#205ED7" },
        ],
      },
    })
    expect(byName<ImageElement>(d, "Poster Background").opacity).toBe(0.5)
    expect(byName<ImageElement>(d, "Rentsouq Logo")).toMatchObject({
      src: "/brand/poster/rentsouq-logo.png",
      x: 346,
      y: 21,
      width: 433.68,
      height: 136.5,
      shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 3.12, offsetX: 0, offsetY: 3.12 },
    })
    expect(byName<ShapeElement>(d, "Photo Frame")).toMatchObject({ x: 50, y: 188, width: 1026, height: 785, cornerRadius: 30, fill: { type: "solid", color: "#1B4FD8" } })
    expect(byName<ImageElement>(d, "Photo")).toMatchObject({ x: 50, y: 188, width: 1026, height: 785, cornerRadius: 30, blurFill: true })
    expect(byName<ShapeElement>(d, "Photo Border").stroke).toMatchObject({ color: "#F4AA1D", width: 6 })
    expect(byName<TextElement>(d, "Headline").highlight?.fill).toBe("#EFA01C")
    expect(d.elements.find(isPosterSubtext)?.fill).toBe("#EFA01C")
    expect(POSTER_SUBTEXT_COLORS["rentsouq-portrait-poster-news"]).toBe("#EFA01C")
    expect(byName<TextElement>(d, "Website")).toMatchObject({ text: "www.rentsouq.ae", x: 320.05, y: 1349.95 })
    expect(byName<TextElement>(d, "Facebook")).toMatchObject({ text: "facebook.com/rentsouq", x: 562.03, y: 1352.06 })
    expect(byName<ImageElement>(d, "Website icon")).toMatchObject({ x: 289, y: 1354.91 })
    expect(byName<ImageElement>(d, "Facebook icon")).toMatchObject({ x: 531, y: 1355.26 })
    // The text sits where FHI's does (the SVGs' glyphs are at the same places).
    const fhi = buildFhiPortraitPoster({ headline: HEADLINE })
    for (const name of ["Headline", "Subtext", "Photo Credit"]) {
      const { x, y, width } = byName<TextElement>(fhi, name)
      expect(byName<TextElement>(d, name)).toMatchObject({ x, y, width })
    }
  })

  it("New Template with a subtext: the logo moves to y 23 and the gradient's blue starts a little lower (Figma's subtext frame)", () => {
    const d = applyNewsChange(buildRentsouqPortraitPoster({ headline: HEADLINE }), { subtext: "Subtext sample | Subtext sample", subtextOn: true })
    expect(byName<ImageElement>(d, "Rentsouq Logo")).toMatchObject({ x: 346, y: 23, width: 433.68, height: 136.5 })
    const fill = byName<ShapeElement>(d, "Brand Gradient").fill
    expect(fill.type === "linear" && fill.stops[2]).toEqual({ offset: 0.305, color: "#205ED7" })
    // Off again: back to the headline-only frame.
    const off = applyNewsChange(d, { subtextOn: false })
    expect(byName<ImageElement>(off, "Rentsouq Logo").y).toBe(21)
    const back = byName<ShapeElement>(off, "Brand Gradient").fill
    expect(back.type === "linear" && back.stops[2].offset).toBe(0.3111)
  })

  it("Old Template: FHI's layout with the Rentsouq.ae logo (556 × 175 at 349, 22), gradient and colors", () => {
    const d = buildRentsouqPoster({ headline: HEADLINE })
    expect([d.width, d.height]).toEqual([1254, 1254])
    expect(byName<ImageElement>(d, "Rentsouq Logo")).toMatchObject({
      x: 349,
      y: 22,
      width: 556,
      height: 175,
      naturalWidth: 1112,
      naturalHeight: 350,
      shadow: { enabled: true, blur: 4, offsetY: 4 },
    })
    expect(byName<ShapeElement>(d, "Photo Frame")).toMatchObject({
      x: 125,
      y: 229,
      width: 1003,
      height: 661,
      fill: { type: "solid", color: "#1B4FD8" },
      shadow: { enabled: true, color: "rgba(5, 15, 64, 0.35)", blur: 50, offsetY: 20 },
    })
    expect(byName<ShapeElement>(d, "Photo Border").stroke?.color).toBe("#F4AA1D")
    const gradient = byName<ShapeElement>(d, "Brand Gradient").fill
    expect(gradient).toMatchObject({ type: "linear", angle: 0.51 })
    expect(gradient.type === "linear" && gradient.stops.map((s) => s.offset)).toEqual([0, 0.0373, 0.3117, 1])
    expect(byName<TextElement>(d, "Headline").highlight?.fill).toBe("#EFA01C")
    expect(byName<TextElement>(d, "Website")).toMatchObject({ text: "www.rentsouq.ae", x: 383.05, y: 1196 })
    expect(byName<TextElement>(d, "Facebook")).toMatchObject({ text: "facebook.com/rentsouq", x: 625.05, y: 1198 })
    const sub = applyNewsChange(d, { subtext: "Subtext sample", subtextOn: true })
    const subFill = byName<ShapeElement>(sub, "Brand Gradient").fill
    expect(subFill.type === "linear" && subFill.stops[2].offset).toBe(0.3056)
    expect(byName<ImageElement>(sub, "Rentsouq Logo").y).toBe(22)
  })
})

describe("Rentsouq.ae tab: FHI Global Property's posters on the Rentsouq.ae template", () => {
  it("is a tab after FHI Global Property; ?brand=rentsouq opens it; its posters are FHI's", () => {
    expect(POSTER_TABS.map((t) => t.id)).toEqual(["fhi", "rentsouq", "pickleplay", "homes", "bayanihan"])
    expect(POSTER_TABS[1]).toMatchObject({ name: "Rentsouq.ae", accent: "#EFA01C" })
    expect(isPosterTabParam("rentsouq")).toBe(true)
    expect(isPosterTabParam("gensan")).toBe(true)
    expect(isPosterTabParam("rentsouq.ae")).toBe(false)
    expect(tabOfParam("rentsouq")).toBe("rentsouq")
    expect(tabOfParam("gensan")).toBe("homes")
    expect(lookOfTab("rentsouq")).toBe("rentsouq")
    expect(lookOfTab("fhi")).toBeNull()
    expect(LOOK_BRAND.rentsouq).toBe("fhi")
    const scope = { brand: LOOK_BRAND.rentsouq, page: null, look: "rentsouq" as const }
    expect(scopeName(scope)).toBe("Rentsouq.ae")
    expect(scopeName({ brand: "fhi", page: null })).toBe("FHI Global Property")
    expect(inScope(fhiPoster(), scope)).toBe(true)
    expect(inScope(fhiPoster("square"), scope)).toBe(true)
    expect(inScope(buildPickleplayPortraitPoster({ headline: HEADLINE }), scope)).toBe(false)
  })

  it("shows the FHI poster on the Rentsouq.ae New Template with everything on it (nothing changes on the FHI poster)", () => {
    const fhi = fhiPoster()
    const before = JSON.stringify(fhi)
    const r = lookDesign(fhi, "rentsouq")
    expect(JSON.stringify(fhi)).toBe(before)
    expect(r.templateId).toBe("rentsouq-portrait-poster-news")
    expect([r.width, r.height]).toEqual([1126, 1408])
    expect(newsHeadline(r)).toBe(HEADLINE)
    expect(newsHighlight(r)).toEqual(["600 cyclists"])
    expect(newsCredit(r)).toEqual({ enabled: true, name: "Frank Gomez" })
    expect(newsSubtextState(r)).toEqual({ text: "November 22, 2026 | Clark | 600 Riders", on: true })
    expect(newsSubtextLook(r)).toEqual({ style: "highlight", hook: "Clark" })
    expect(newsPhotoFrame(r)).toMatchObject({ src: PHOTO.src, zoom: 1.6, focusX: 0.2, focusY: 0.7, box: { x: 50, y: 188, width: 1026, height: 785 } })
    // The faded photo behind everything is the poster's photo too.
    expect(byName<ImageElement>(r, "Poster Background").src).toBe(PHOTO.src)
    // With the subtext: the logo and gradient of Figma's subtext frame.
    expect(byName<ImageElement>(r, "Rentsouq Logo").y).toBe(23)
    // Still an FHI poster (it's never saved as anything else).
    expect(posterBrandOf(r)).toBe("fhi")
    expect(newsBrandOf(r)).toBe("fhi")
  })

  it("New Template by default whatever FHI uses; the Old Template when picked for Rentsouq.ae, kept apart from FHI's choice", () => {
    expect(lookDesign(fhiPoster("square"), "rentsouq").templateId).toBe("rentsouq-portrait-poster-news")
    expect(rentsouqLayoutOf(fhiPoster())).toBe("portrait")
    const picked = applyNewsChange(fhiPoster(), { rentsouqLayout: "square" })
    expect(picked.templateId).toBe("fhi-portrait-poster-news")
    expect(rentsouqLayoutOf(picked)).toBe("square")
    const old = lookDesign(picked, "rentsouq")
    expect(old.templateId).toBe("rentsouq-poster-news")
    expect([old.width, old.height]).toEqual([1254, 1254])
    expect(newsHeadline(old)).toBe(HEADLINE)
    expect(newsPhotoFrame(old)).toMatchObject({ zoom: 1.6, focusX: 0.2, focusY: 0.7, box: { x: 125, y: 229, width: 1003, height: 661 } })
    // FHI New ↔ Old keeps the Rentsouq.ae choice, and the choice survives saving and loading.
    const fhiOld = applyNewsChange(picked, { templateId: "fhi-poster-news" })
    expect(rentsouqLayoutOf(fhiOld)).toBe("square")
    expect(normalizeDesign(JSON.parse(JSON.stringify(fhiOld))).rentsouqLayout).toBe("square")
    // Back to the New Template: nothing is kept for it (the default).
    const back = applyNewsChange(fhiOld, { rentsouqLayout: "portrait" })
    expect(rentsouqLayoutOf(back)).toBe("portrait")
    expect("rentsouqLayout" in normalizeDesign(JSON.parse(JSON.stringify(back)))).toBe(false)
  })

  it("only FHI posters get the Rentsouq.ae look; no look leaves the poster as it is", () => {
    const fhi = fhiPoster()
    expect(lookDesign(fhi, null)).toBe(fhi)
    const pickleplay = buildPickleplayPortraitPoster({ headline: HEADLINE })
    expect(lookDesign(pickleplay, "rentsouq")).toBe(pickleplay)
    expect(isBrandPoster(lookDesign(fhi, "rentsouq"), "fhi")).toBe(true)
  })

  it("Save PNG names the picture for Rentsouq.ae", () => {
    expect(newsFileName(new Date(2026, 10, 13), NEWS_TIMES[0], RENTSOUQ_BRAND.name)).toBe("2026-11-13 9AM Rentsouq.ae.png")
  })
})

describe("Rentsouq.ae isn't in the Daily Report or the Chrome extension's Daily Trend News", () => {
  const project = (id: string, at: string) => ({ id, title: HEADLINE, scheduled_at: at, caption: "", topic: "" }) as unknown as ProjectRow
  const posters: ReportPoster[] = [
    { project: project("fhi-1", "2026-11-13T09:00:00"), design: fhiPoster(), brand: "fhi", time: "09:00" },
    { project: project("fhi-2", "2026-11-13T11:00:00"), design: applyNewsChange(fhiPoster(), { rentsouqLayout: "square" }), brand: "fhi", time: "11:00" },
    { project: project("pp-1", "2026-11-13T15:00:00"), design: buildPickleplayPortraitPoster({ headline: HEADLINE }), brand: "pickleplay", time: "15:00" },
  ]

  it("no Rentsouq.ae brand, group or entry; FHI's posters are counted once, as FHI", () => {
    expect(NEWS_BRANDS.map((b) => b.id)).toEqual(["pickleplay", "fhi", "caraga", "gensan"])
    expect(isDailyBrand("rentsouq" as never)).toBe(false)
    expect(TREND_GROUPS.map((g) => g.id)).toEqual(["pickleplay", "fhi", "homes", "gensan"])
    const entries = trendEntries(posters)
    expect(entries.map((e) => e.label)).toEqual(["Pickleplay.ph DTN 1", "FHI Global DTN 1", "FHI Global DTN 2"])
    expect(entries.filter((e) => e.group === "fhi")).toHaveLength(2)
    expect(JSON.stringify(entries.map(({ group, groupName, label }) => ({ group, groupName, label }))).toLowerCase()).not.toContain("rentsouq")
    // The Rentsouq.ae choice changes nothing in the report's text.
    expect(entries[2].headline).toBe(entries[1].headline)
    expect(entries[2].subtext).toBe(entries[1].subtext)
  })
})
