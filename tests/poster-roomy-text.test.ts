import { describe, expect, it } from "vitest"
import { articleScope, posterArticleScope } from "@/components/posters/article-memory"
import { applyNewsChange } from "@/lib/data/news"
import { applyBoxFit } from "@/lib/design/box-fit"
import { applyTextStack, type MeasureText } from "@/lib/design/layout"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildCaragaPortraitNews, buildFhiPortraitPoster, buildFhiPoster, buildPickleplayPoster } from "@/lib/design/templates"
import { DESIGN_VERSION, type SlideDesign, type TextElement } from "@/lib/design/types"

const headlineOf = (d: SlideDesign) => d.elements.find((e) => e.name === "Headline") as TextElement
const subtextOf = (d: SlideDesign) => d.elements.find((e) => e.name === "Subtext") as TextElement

/** Rough text layout: 0.5 em per character, words wrap at the width. */
const fakeMeasure: MeasureText = (el) => {
  const perLine = Math.max(1, Math.floor(el.width / (el.fontSize * 0.5)))
  let lines = 1
  let used = 0
  for (const word of el.text.split(/\s+/).filter(Boolean)) {
    const need = used ? used + 1 + word.length : word.length
    if (need > perLine && used) {
      lines += 1
      used = word.length
    } else used = need
  }
  return lines * el.lineHeight
}
const laidOut = (d: SlideDesign) => applyTextStack(applyBoxFit(d, fakeMeasure), fakeMeasure)

const LONG = { headline: "Crate & Barrel Expands At Dubai Mall", subtext: "Expanded to 1,100 sqm with kids' department and personalization services" }

describe("poster text that would be small uses the spare room under it (1.47)", () => {
  it("New Template: a two-line subtext no longer squeezes the headline under the design's 68 px", () => {
    const d = applyNewsChange(buildFhiPortraitPoster(), LONG)
    expect(d.stack).toMatchObject({ anchor: "bottom", bottom: 1251.7, minTop: 1055.7, maxBottom: 1295.7, spill: true })
    expect(headlineOf(d).boxFit?.shareWith).toMatchObject({ gap: 7.5, spare: 44 })
    const placed = laidOut(d)
    const head = headlineOf(placed)
    const sub = subtextOf(placed)
    // Without the spare room this pair came out at 62 and 31 px.
    expect(head.fontSize).toBeGreaterThanOrEqual(68)
    expect(sub.fontSize).toBeGreaterThanOrEqual(34)
    // Not too big: the headline keeps its two lines and leads; the subtext keeps its two lines.
    expect(fakeMeasure(head) / head.lineHeight).toBe(2)
    expect(fakeMeasure(sub) / sub.lineHeight).toBe(2)
    expect(head.fontSize).toBeLessThanOrEqual(100)
    expect(sub.fontSize).toBeLessThanOrEqual(Math.floor(head.fontSize * 0.55))
    // It starts at the top of the headline's space and ends above the footer (1350), within the spare room.
    expect(head.y).toBeGreaterThanOrEqual(1055)
    expect(sub.y + fakeMeasure(sub)).toBeLessThanOrEqual(1295.7 + 0.5)
    expect(sub.y).toBeGreaterThanOrEqual(head.y + fakeMeasure(head) + 7)
  })

  it("Old Template: the same text grows into the 16 px under the subtext line, never past it", () => {
    const placed = laidOut(applyNewsChange(buildFhiPoster(), LONG))
    const head = headlineOf(placed)
    const sub = subtextOf(placed)
    expect(head.fontSize).toBeGreaterThanOrEqual(68)
    expect(head.y).toBeGreaterThanOrEqual(935)
    expect(sub.y + fakeMeasure(sub)).toBeLessThanOrEqual(1173 + 0.5)
  })

  it("text already at the design's size stays on Figma's lines (no spare room used)", () => {
    const placed = laidOut(applyNewsChange(buildPickleplayPoster(), { headline: "More than 600 cyclists take on Pampanga’s dirt roads at", subtext: "November 22, 2026 | Cebu City Sports Center | ₱50,000 Prize Money" }))
    expect(subtextOf(placed)).toMatchObject({ fontSize: 30, y: 1127 })
    expect(Math.abs(headlineOf(placed).y + fakeMeasure(headlineOf(placed)) - 1119.5)).toBeLessThanOrEqual(0.5)
  })

  it("posters saved before get the spare room when they open; their text stays", () => {
    const now = applyNewsChange(buildFhiPortraitPoster(), LONG)
    const before: SlideDesign = {
      ...now,
      version: 7,
      stack: { ...now.stack!, maxBottom: 1267.7, spill: undefined },
      elements: now.elements.map((el) => (el.type === "text" && el.role === "title" ? { ...el, boxFit: { ...el.boxFit!, shareWith: { id: el.boxFit!.shareWith!.id, gap: 7.5 } } } : el)),
    }
    const opened = normalizeDesign(JSON.parse(JSON.stringify(before)))
    expect(opened.version).toBe(DESIGN_VERSION)
    expect(opened.stack).toMatchObject({ maxBottom: 1295.7, spill: true })
    expect(headlineOf(opened).boxFit?.shareWith?.spare).toBe(44)
    expect(headlineOf(opened).text).toBe(LONG.headline)
    expect(subtextOf(opened).text).toBe(LONG.subtext)
    // Saved at this version: left as it is.
    expect(normalizeDesign(JSON.parse(JSON.stringify(opened)))).toEqual(opened)
  })
})

describe("News Article, New Template: the headline sizes itself to its three lines (1.47)", () => {
  const withHeadline = (text: string) => {
    const d = buildCaragaPortraitNews({ headline: text })
    return headlineOf(applyTextStack(applyBoxFit(d, fakeMeasure), fakeMeasure))
  }

  it("a short headline gets bigger (up to 82 px, the same number of lines); a long one gets smaller instead of a fourth line", () => {
    const short = withHeadline("Butuan Opens New Public Market")
    expect(short.fontSize).toBeGreaterThan(65)
    expect(short.fontSize).toBeLessThanOrEqual(82)
    expect(fakeMeasure(short) / short.lineHeight).toBe(1)
    // Three full lines at 65 px stay at the design's size.
    const three = withHeadline("Butuan City Government Opens New Public Market With Two Hundred Stalls For Vendors")
    expect(three.fontSize).toBe(65)
    expect(three.lineHeight).toBe(90)
    const long = withHeadline(`${"Butuan City Government Opens Its New Public Market With Two Hundred Stalls For Local Vendors "}And Farmers From Every Barangay In The Province This Coming Weekend`)
    expect(long.fontSize).toBeLessThan(65)
    expect(long.fontSize).toBeGreaterThanOrEqual(34)
    expect(fakeMeasure(long)).toBeLessThanOrEqual(270.5)
  })

  it("posts saved before: a headline still at 65 px gets the rule; one resized by hand is left alone", () => {
    const d = buildCaragaPortraitNews({ headline: "Butuan Opens New Public Market" })
    const strip = (size: number): SlideDesign => ({
      ...d,
      version: 7,
      elements: d.elements.map((el) => {
        if (el.type !== "text" || el.role !== "title") return el
        const { boxFit: _fit, ...rest } = el
        void _fit
        return { ...rest, fontSize: size }
      }),
    })
    expect(headlineOf(normalizeDesign(JSON.parse(JSON.stringify(strip(65))))).boxFit).toMatchObject({ maxHeight: 270, maxSize: 65, growTo: 82 })
    expect(headlineOf(normalizeDesign(JSON.parse(JSON.stringify(strip(50))))).boxFit ?? null).toBeNull()
  })
})

describe("the AI's last article and results are kept apart for each brand and Homes.ph page (1.47)", () => {
  it("each poster name has its own place", () => {
    expect(articleScope("FHI Global Property")).toBe("fhi")
    expect(articleScope("Rentsouq.ae")).toBe("fhi")
    expect(articleScope("PicklePlay PH")).toBe("pickleplay")
    expect(articleScope("Homes.ph Gensan")).toBe("gensan")
    expect(articleScope("Homes.ph CARAGA")).toBe("homes")
    expect(articleScope("Homes.ph")).toBe("homes")
    expect(articleScope("Homes.ph Cebu")).toBe(posterArticleScope("homes", "Homes.ph Cebu"))
    const scopes = ["FHI Global Property", "PicklePlay PH", "Homes.ph Gensan", "Homes.ph CARAGA", "Homes.ph Cebu", "Homes.ph BGC Taguig"].map(articleScope)
    expect(new Set(scopes).size).toBe(scopes.length)
    // The dialog's place for a poster is the same as its name's.
    expect(posterArticleScope("fhi")).toBe("fhi")
    expect(posterArticleScope("gensan")).toBe("gensan")
    expect(posterArticleScope("homes", "Homes.ph Caraga")).toBe("homes")
    expect(posterArticleScope("homes", "Homes.ph Gensan")).toBe("gensan")
  })
})
