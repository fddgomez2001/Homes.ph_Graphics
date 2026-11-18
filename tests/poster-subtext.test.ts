import { describe, expect, it } from "vitest"
import { applyNewsChange, newsHeadline, newsPhotoFrame, newsSubtext, newsSubtextState } from "@/lib/data/news"
import { applyBoxFit } from "@/lib/design/box-fit"
import { applyTextStack, type MeasureText } from "@/lib/design/layout"
import { articleTemplatesFor, isPosterTemplate, newsTemplatesFor } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildFhiPoster, buildHomesPoster, buildPickleplayEventPoster, buildPickleplayPoster } from "@/lib/design/templates"
import type { ImageElement, SlideDesign, TextElement } from "@/lib/design/types"

const HEADLINE_2 = "More than 600 cyclists take on Pampanga’s dirt roads at"
const SUBTEXT = "November 22, 2026 | Cebu City | ₱50,000 Prize Pool"
const byName = <T,>(d: SlideDesign, name: string) => d.elements.find((e) => e.name === name) as T
const headlineOf = (d: SlideDesign) => byName<TextElement>(d, "Headline")
const subtextOf = (d: SlideDesign) => byName<TextElement>(d, "Subtext")

/** Rough text layout: 0.5 em per character, words wrap at the width; one-line (auto-fit) text is one line. */
const fakeMeasure: MeasureText = (el) => {
  if (el.autoFit) return el.lineHeight
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

describe("poster subtext (Figma: SUBTEXT SAMPLE | SUBTEXT SAMPLE | SUBTEXT SAMPLE)", () => {
  for (const [label, build, color] of [
    ["FHI", buildFhiPoster, "#F8C563"],
    ["PicklePlay", buildPickleplayPoster, "#AED038"],
    ["Homes.ph", buildHomesPoster, "#F4AA1D"],
  ] as const) {
    it(`${label}: League Spartan 600, 30 / 30, centered in 1003 at 124 (line 1127–1157), ${color}, sizes itself, hidden until written`, () => {
      const d = build()
      expect(subtextOf(d)).toMatchObject({
        role: "subtitle",
        text: "",
        visible: false,
        x: 124,
        y: 1127,
        width: 1003,
        fontFamily: "League Spartan",
        fontWeight: 600,
        fontSize: 30,
        lineHeight: 30,
        align: "center",
        fill: color,
        textCase: "upper",
        shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
        // 30 px in the design; a short one grows to 44 px (at most half the headline), a long one wraps onto 2 lines and shrinks.
        boxFit: { maxHeight: 64, maxSize: 30, minSize: 18, growTo: 44, maxRatioOf: { id: headlineOf(d).id, ratio: 0.5 } },
      })
      expect(subtextOf(d).autoFit).toBeFalsy()
      expect(subtextOf(d).highlight).toBeUndefined()
      expect(newsSubtext(d)).toBe("")
      // Headline only (as before): centered in its 1006 × 231 box.
      expect(d.stack).toMatchObject({ anchor: "center", center: 936 + 231 / 2 })
      expect(headlineOf(d).boxFit?.maxHeight).toBe(231)
    })
  }

  it("with a 30 px subtext (Figma): the subtext on its line (1127–1157), the 2-line headline ending right above it (1119.5)", () => {
    // 65 characters: one line at 30 px, too long for 31 px (so it stays at the design's size).
    const figma = "November 22, 2026 | Cebu City Sports Center | ₱50,000 Prize Money"
    const d = applyNewsChange(buildPickleplayPoster(), { headline: HEADLINE_2, subtext: `  ${figma}  ` })
    expect(subtextOf(d)).toMatchObject({ text: figma, visible: true })
    expect(newsSubtext(d)).toBe(figma)
    expect(d.stack).toMatchObject({ anchor: "bottom", bottom: 1157, minTop: 936, maxBottom: 1173 })
    expect(headlineOf(d).boxFit).toMatchObject({ maxHeight: 1157 - 936, shareWith: { id: subtextOf(d).id, gap: 7.5 } })
    const placed = laidOut(d)
    const head = headlineOf(placed)
    expect(subtextOf(placed).fontSize).toBe(30)
    // Two lines: 68 px in Figma (it may grow a little when the lines have room, never onto a 3rd line).
    expect(head.fontSize).toBeGreaterThanOrEqual(68)
    expect(fakeMeasure(head) / head.fontSize).toBe(2)
    expect(Math.abs(head.y + fakeMeasure(head) - 1119.5)).toBeLessThanOrEqual(0.5)
    expect(subtextOf(placed).y).toBe(1127)
  })

  it("a short subtext gets bigger (up to 44 px, never more than half the headline); the headline makes room", () => {
    for (const short of ["Sep 5, 2026 | SM Seaside Cebu", "Now Open"]) {
      const placed = laidOut(applyNewsChange(buildHomesPoster(), { headline: "Power Couple's OPM Show Sep 5, 2026", subtext: short }))
      const head = headlineOf(placed)
      const sub = subtextOf(placed)
      expect(sub.fontSize).toBeGreaterThan(30)
      expect(sub.fontSize).toBeLessThanOrEqual(44)
      expect(sub.fontSize).toBeLessThanOrEqual(head.fontSize / 2)
      expect(fakeMeasure(sub)).toBe(sub.lineHeight) // still one line
      // The subtext ends on Figma's line; the headline sits 7.5 px above it, inside its box.
      expect(Math.abs(sub.y + fakeMeasure(sub) - (1157))).toBeLessThanOrEqual(0.5)
      expect(Math.abs(head.y + fakeMeasure(head) - (sub.y - 7.5))).toBeLessThanOrEqual(0.5)
      expect(head.y).toBeGreaterThanOrEqual(936)
    }
  })

  it("a long subtext (a key point or quote) wraps onto two lines and gets smaller, never more", () => {
    const point = "Philippine Pair Takes Gold In Mixed Doubles After Three Close Sets Against Japan"
    const placed = laidOut(applyNewsChange(buildPickleplayPoster(), { headline: "PH Wins Asian Pickleball Gold", subtext: point }))
    const sub = subtextOf(placed)
    expect(fakeMeasure(sub) / sub.lineHeight).toBe(2)
    expect(sub.fontSize).toBeLessThanOrEqual(32)
    expect(sub.fontSize).toBeGreaterThanOrEqual(18)
    expect(Math.abs(sub.y + fakeMeasure(sub) - (1157))).toBeLessThanOrEqual(0.5)
    expect(headlineOf(placed).y + fakeMeasure(headlineOf(placed))).toBeLessThanOrEqual(sub.y - 7.5 + 0.5)
  })

  it("a longer headline shrinks to stay between the photo credit and the subtext", () => {
    const d = laidOut(applyNewsChange(buildFhiPoster(), { headline: `${HEADLINE_2} Gravelton Clark 2026 in the biggest race of the year`, subtext: SUBTEXT }))
    expect(headlineOf(d).fontSize).toBeLessThan(68)
    expect(headlineOf(d).y).toBeGreaterThanOrEqual(936)
    expect(headlineOf(d).y + fakeMeasure(headlineOf(d))).toBeLessThanOrEqual(subtextOf(d).y - 7.5 + 0.5)
    expect(Math.abs(subtextOf(d).y + fakeMeasure(subtextOf(d)) - (1157))).toBeLessThanOrEqual(0.5)
  })

  it("the subtext can be switched off: the text is kept, the poster is headline-only", () => {
    const on = applyNewsChange(buildHomesPoster(), { subtext: SUBTEXT })
    const off = applyNewsChange(on, { subtextOn: false })
    expect(subtextOf(off)).toMatchObject({ text: SUBTEXT, visible: false })
    expect(newsSubtext(off)).toBe("")
    expect(newsSubtextState(off)).toEqual({ text: SUBTEXT, on: false })
    expect(off.stack).toMatchObject({ anchor: "center", center: 1051.5 })
    expect(headlineOf(off).boxFit).toMatchObject({ maxHeight: 231, shareWith: null })
    // Saved and loaded, then switched back on.
    const back = applyNewsChange(normalizeDesign(JSON.parse(JSON.stringify(off))), { subtextOn: true })
    expect(newsSubtextState(back)).toEqual({ text: SUBTEXT, on: true })
    expect(back.stack?.anchor).toBe("bottom")
    // Off survives switching brands.
    expect(newsSubtextState(applyNewsChange(off, { templateId: "fhi-poster-news" }))).toEqual({ text: SUBTEXT, on: false })
  })

  it("clearing the subtext goes back to the headline-only layout", () => {
    const withSub = applyNewsChange(buildHomesPoster(), { subtext: SUBTEXT })
    const cleared = applyNewsChange(withSub, { subtext: "   " })
    expect(subtextOf(cleared).visible).toBe(false)
    expect(newsSubtext(cleared)).toBe("")
    expect(cleared.stack).toMatchObject({ anchor: "center", center: 1051.5 })
    expect(headlineOf(cleared).boxFit?.maxHeight).toBe(231)
  })

  it("survives saving and loading, and switching brands (in the new brand's color)", () => {
    const fhi = applyNewsChange(buildFhiPoster(), { headline: HEADLINE_2, subtext: SUBTEXT })
    const back = normalizeDesign(JSON.parse(JSON.stringify(fhi)))
    expect(newsSubtext(back)).toBe(SUBTEXT)
    expect(back.stack?.anchor).toBe("bottom")
    const pp = applyNewsChange(back, { templateId: "pickleplay-poster-news" })
    expect(newsSubtext(pp)).toBe(SUBTEXT)
    expect(subtextOf(pp).fill).toBe("#AED038")
    expect(pp.stack?.anchor).toBe("bottom")
    expect(newsHeadline(pp)).toBe(HEADLINE_2)
  })

  it("the event poster has no subtext line (it has the location and time)", () => {
    const event = buildPickleplayEventPoster()
    expect(newsSubtext(event)).toBeNull()
    expect(event.elements.some((e) => e.name === "Subtext")).toBe(false)
    const fromNews = applyNewsChange(applyNewsChange(buildPickleplayPoster(), { subtext: SUBTEXT }), { templateId: "pickleplay-event-poster-news" })
    expect(newsSubtext(fromNews)).toBeNull()
    expect(applyNewsChange(event, { subtext: SUBTEXT })).toEqual(event)
  })
})

describe("logos with a drop shadow (0 4px 4px rgba(0, 0, 0, 0.25))", () => {
  it("PicklePlay and Homes.ph", () => {
    const shadow = { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 }
    expect(byName<ImageElement>(buildPickleplayPoster(), "PicklePlay Logo")).toMatchObject({ x: 558, y: 40, width: 139, height: 139, shadow })
    expect(byName<ImageElement>(buildPickleplayEventPoster(), "PicklePlay Logo").shadow).toEqual(shadow)
    expect(byName<ImageElement>(buildHomesPoster(), "Homes.ph Logo")).toMatchObject({ x: 568.06, y: 35, width: 117.88, height: 115, shadow })
  })
})

describe("posters made before 1.19 are upgraded once", () => {
  /** A 1.18 poster: no subtext line, logos without the shadow. */
  const old = (d: SlideDesign) => ({
    ...d,
    version: 4,
    elements: d.elements.filter((e) => e.name !== "Subtext").map((e) => (e.type === "image" && e.name.endsWith("Logo") ? { ...e, shadow: null } : e)),
    stack: { ...d.stack!, items: d.stack!.items.filter((i) => d.elements.find((e) => e.id === i.id)?.name !== "Subtext") },
  })

  it("adds the hidden subtext under the headline and the logo shadow, the same way every load", () => {
    for (const build of [buildPickleplayPoster, buildHomesPoster, buildFhiPoster]) {
      const saved = JSON.stringify(old(build({ headline: HEADLINE_2 })))
      const d = normalizeDesign(JSON.parse(saved))
      const headline = headlineOf(d)
      const subtext = subtextOf(d)
      expect(subtext).toMatchObject({ id: `${headline.id}-subtext`, text: "", visible: false })
      expect(d.elements.indexOf(subtext)).toBe(d.elements.indexOf(headline) + 1)
      expect(d.stack?.items.map((i) => i.id)).toEqual([headline.id, subtext.id])
      expect(normalizeDesign(JSON.parse(saved))).toEqual(d)
      // Then it works like a new poster.
      expect(newsSubtext(applyNewsChange(d, { subtext: SUBTEXT }))).toBe(SUBTEXT)
    }
    expect(byName<ImageElement>(normalizeDesign(JSON.parse(JSON.stringify(old(buildPickleplayPoster())))), "PicklePlay Logo").shadow?.enabled).toBe(true)
    expect(byName<ImageElement>(normalizeDesign(JSON.parse(JSON.stringify(old(buildHomesPoster())))), "Homes.ph Logo").shadow?.enabled).toBe(true)
  })

  it("an event poster only gets the logo shadow", () => {
    const d = normalizeDesign(JSON.parse(JSON.stringify(old(buildPickleplayEventPoster()))))
    expect(byName<ImageElement>(d, "PicklePlay Logo").shadow?.enabled).toBe(true)
    expect(newsSubtext(d)).toBeNull()
  })
})

describe("moving and zooming the photo in the photo card", () => {
  const photo = { src: "https://example.com/p.jpg", naturalWidth: 1600, naturalHeight: 900 }

  it("changes only the card photo (not the faded background)", () => {
    const d = applyNewsChange(applyNewsChange(buildFhiPoster(), { photo }), { photoFrame: { zoom: 1.5, focusX: 0.2, focusY: 0.8 } })
    expect(newsPhotoFrame(d)).toMatchObject({ zoom: 1.5, focusX: 0.2, focusY: 0.8, src: photo.src, box: { x: 125, y: 229, width: 1003, height: 661 } })
    expect(byName<ImageElement>(d, "Poster Background")).toMatchObject({ zoom: 1, focusX: 0.5, focusY: 0.5 })
  })

  it("stays within limits, survives saving and switching brands; a new photo starts centered", () => {
    const d = applyNewsChange(applyNewsChange(buildPickleplayPoster(), { photo }), { photoFrame: { zoom: 9, focusX: -1, focusY: 2 } })
    expect(newsPhotoFrame(d)).toMatchObject({ zoom: 5, focusX: 0, focusY: 1 })
    const back = normalizeDesign(JSON.parse(JSON.stringify(applyNewsChange(d, { photoFrame: { zoom: 1.4, focusX: 0.3, focusY: 0.6 } }))))
    expect(newsPhotoFrame(back)).toMatchObject({ zoom: 1.4, focusX: 0.3, focusY: 0.6 })
    expect(newsPhotoFrame(applyNewsChange(back, { templateId: "homes-poster-news" }))).toMatchObject({ zoom: 1.4, focusX: 0.3, focusY: 0.6 })
    expect(newsPhotoFrame(applyNewsChange(back, { photo: { ...photo, src: "https://example.com/new.jpg" } }))).toMatchObject({ zoom: 1, focusX: 0.5, focusY: 0.5 })
  })
})

describe("Poster Maker and News Article are separate", () => {
  it("News Article offers only its own templates (no posters)", () => {
    // PicklePlay PH and Homes.ph: the New Template (1126 × 1408) first (the default), then the Old Template.
    expect(articleTemplatesFor("pickleplay").map((t) => t.id)).toEqual(["pickleplay-portrait-news", "pickleplay-news"])
    expect(articleTemplatesFor("fhi").map((t) => t.id)).toEqual(["fhi-portrait-news", "fhi-wide-news"])
    expect(articleTemplatesFor("caraga").map((t) => t.id)).toEqual(["caraga-portrait-news", "caraga-news"])
    expect(articleTemplatesFor("gensan").map((t) => t.id)).toEqual(["gensan-portrait-news", "gensan-news"])
    expect(articleTemplatesFor("pickleplay").map((t) => `${t.name} ${t.width}x${t.height}`)).toEqual(["New Template 1126x1408", "Old Template 1408x1408"])
    // 1.50: the other Homes.ph pages (Cebu, BGC Taguig…) have News Article posts on the Homes.ph design.
    expect(articleTemplatesFor("homes").map((t) => t.id)).toEqual(["homes-portrait-news", "homes-news"])
    // The posters are still known templates (the Poster Maker opens them).
    for (const brand of ["pickleplay", "fhi", "homes"] as const) expect(newsTemplatesFor(brand).some((t) => isPosterTemplate(t.id))).toBe(true)
  })
})
