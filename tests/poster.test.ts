import { describe, expect, it } from "vitest"
import { applyNewsChange, newsCredit, newsHeadline, newsHighlight } from "@/lib/data/news"
import { findPhrase, highlightFlags, textAttrs } from "@/lib/design/konva-attrs"
import { isPosterTemplate, newsBrandOf, newsTemplatesFor, POSTER_TEMPLATE_IDS } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildFhiPoster, buildHomesPoster, buildPickleplayPoster, NEWS_HEADLINE_PLACEHOLDER } from "@/lib/design/templates"
import type { ImageElement, ShapeElement, SlideDesign, TextElement } from "@/lib/design/types"

const HEADLINE = "More than 600 cyclists take on Pampanga’s dirt roads at Gravelton Clark 2026"
const byName = <T,>(d: SlideDesign, name: string) => d.elements.find((e) => e.name === name) as T

describe("poster templates (Figma FHI Poster / Pickleplay Poster)", () => {
  for (const [label, build, accent, brand] of [
    ["FHI", buildFhiPoster, "#F8C563", "fhi"],
    ["PicklePlay", buildPickleplayPoster, "#AFD137", "pickleplay"],
    ["Homes.ph", buildHomesPoster, "#F4AA1D", "homes"],
  ] as const) {
    it(`${label}: 1254 × 1254, photo twice (faded behind, in the card), the headline as specified`, () => {
      const d = build({ headline: HEADLINE })
      expect([d.width, d.height, d.background]).toEqual([1254, 1254, "#2D59A8"])
      const photos = d.elements.filter((e): e is ImageElement => e.type === "image" && e.role === "background")
      expect(photos.map((p) => [p.name, p.x, p.y, p.width, p.height, p.opacity])).toEqual([
        ["Poster Background", 0, 0, 1254, 1254, 0.5],
        ["Photo", 125, 229, 1003, 661, 1],
      ])
      expect(byName<ShapeElement>(d, "Brand Gradient")).toMatchObject({ opacity: 0.7, width: 1254, height: 1254 })
      expect(byName<TextElement>(d, "Headline")).toMatchObject({
        role: "title",
        text: HEADLINE,
        x: 122,
        width: 1006,
        fontFamily: "League Spartan",
        fontWeight: 700,
        fontSize: 68,
        lineHeight: 68,
        align: "center",
        fill: "#FFFFFF",
        textCase: "upper",
        shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
        highlight: { phrases: [], fill: accent },
        // Shrinks to fit the 1006 × 231 box, 68 px at most.
        boxFit: { maxHeight: 231, maxSize: 68, minSize: 24, lineHeightRatio: 1 },
      })
      // Centered on the 231 px block at y 936, and kept inside it.
      expect(d.stack).toMatchObject({ anchor: "center", center: 936 + 231 / 2, minTop: 936, maxBottom: 936 + 231 })
      // The photo credit is off by default; right edge on the card's (1128), Poppins 400 24 / 30.
      expect(byName<TextElement>(d, "Photo Credit")).toMatchObject({ visible: false, x: 1128 - 700, width: 700, y: 890, align: "right", fontFamily: "Poppins", fontSize: 24, lineHeight: 30 })
      expect(newsBrandOf(d)).toBe(brand)
      expect(isPosterTemplate(d.templateId)).toBe(true)
    })
  }

  it("FHI: gold 6 px border inside the #1B4FD8 frame, the emblem with a drop shadow", () => {
    const d = buildFhiPoster()
    expect(byName<ShapeElement>(d, "Photo Frame")).toMatchObject({ x: 125, y: 229, width: 1003, height: 661, fill: { type: "solid", color: "#1B4FD8" } })
    expect(byName<ShapeElement>(d, "Photo Border")).toMatchObject({ x: 128, y: 232, width: 997, height: 655, stroke: { color: "#F8C563", width: 6 } })
    expect(byName<ImageElement>(d, "FHI Emblem")).toMatchObject({ x: 572, y: 40, width: 110, height: 131, shadow: { enabled: true, blur: 4, offsetY: 4 } })
    expect(byName<TextElement>(d, "Website")).toMatchObject({ text: "www.fhiglobal.ae", x: 383.05, y: 1196, fontFamily: "Inter" })
    expect(byName<TextElement>(d, "Facebook")).toMatchObject({ text: "facebook.com/fhiglobal", x: 625.05, y: 1198, fontFamily: "Poppins" })
  })

  it("PicklePlay: white card with the lime-to-blue gradient border, logo, the Figma pickleball", () => {
    const d = buildPickleplayPoster()
    expect(byName<ShapeElement>(d, "Photo Card")).toMatchObject({ fill: { type: "solid", color: "#FFFFFF" }, shadow: { blur: 50, offsetY: 20 } })
    // 6 px inside the card, over the photo, in the brand gradient.
    const border = byName<ShapeElement>(d, "Photo Border")
    expect(border).toMatchObject({ x: 128, y: 232, width: 997, height: 655, stroke: { width: 6, gradient: { type: "linear", angle: 181.68 } } })
    expect(border.stroke?.gradient?.stops.map((s) => [s.offset, s.color])).toEqual([
      [0, "#AFD137"],
      [0.2006, "#AFD137"],
      [0.9164, "#0A2CAA"],
      [1, "#0A2CAA"],
    ])
    expect(d.elements.indexOf(border)).toBe(d.elements.findIndex((e) => e.name === "Photo") + 1)
    expect(byName<ImageElement>(d, "PicklePlay Logo")).toMatchObject({ x: 558, y: 40, width: 139, height: 139 })
    // left 81.34% (1020) to the right edge, 187 tall at y 1067. The PNG carries the 50%, so it's drawn at 100%.
    expect(byName<ImageElement>(d, "Pickleball")).toMatchObject({ x: 1020, y: 1067, width: 234, height: 187, opacity: 1, naturalWidth: 234, naturalHeight: 187 })
    expect(byName<TextElement>(d, "Website")).toMatchObject({ text: "www.pickleplay.ph", x: 330, y: 1196 })
    expect(byName<TextElement>(d, "Facebook")).toMatchObject({ text: "facebook.com/pickleplayofficial", x: 584, y: 1198 })
  })

  it("the sample poster highlights its sample words", () => {
    expect(byName<TextElement>(buildFhiPoster(), "Headline")).toMatchObject({ text: NEWS_HEADLINE_PLACEHOLDER, highlight: { phrases: ["Goes Here"] } })
  })

  it("each brand offers its poster as a news template", () => {
    expect(newsTemplatesFor("fhi").map((t) => t.id)).toContain(POSTER_TEMPLATE_IDS.fhi)
    expect(newsTemplatesFor("pickleplay").map((t) => t.id)).toContain(POSTER_TEMPLATE_IDS.pickleplay)
    expect(isPosterTemplate("fhi-wide-news")).toBe(false)
  })
})

describe("highlighted words", () => {
  it("finds a phrase ignoring case, spacing and line breaks", () => {
    const text = HEADLINE.toUpperCase()
    expect(findPhrase(text, "gravelton   clark 2026")).toEqual({ start: text.length - 20, end: text.length })
    expect(findPhrase("AT GRAVELTON\nCLARK", "gravelton clark")).toEqual({ start: 3, end: 18 })
    expect(findPhrase(text, "not here")).toBeNull()
    expect(findPhrase(text, "   ")).toBeNull()
    // Regex characters in the phrase are plain text.
    expect(findPhrase("UP 50% (YES)", "50% (yes)")).toEqual({ start: 3, end: 12 })
  })

  it("flags the letters to color, skipping spaces (Konva drops them at line breaks)", () => {
    expect(highlightFlags("AB CD EF", ["cd"])).toEqual([false, false, true, true, false, false])
    expect(highlightFlags("AB CD EF", ["xy"])).toBeNull()
    expect(highlightFlags("AB CD EF", ["ab", "ef"])).toEqual([true, true, false, false, true, true])
  })

  it("draws with a custom scene function only when something is highlighted", () => {
    const headline = byName<TextElement>(buildPickleplayPoster({ headline: HEADLINE }), "Headline")
    expect(textAttrs(headline).sceneFunc).toBeUndefined()
    expect(typeof textAttrs({ ...headline, highlight: { phrases: ["Gravelton Clark 2026"], fill: "#AFD137" } }).sceneFunc).toBe("function")
    expect(textAttrs({ ...headline, highlight: { phrases: ["nowhere"], fill: "#AFD137" } }).sceneFunc).toBeUndefined()
  })

  it("survives saving and loading", () => {
    const d = buildFhiPoster({ headline: HEADLINE })
    const withWords = applyNewsChange(d, { highlight: ["Gravelton Clark 2026"] })
    const back = normalizeDesign(JSON.parse(JSON.stringify(withWords)))
    expect(newsHighlight(back)).toEqual(["Gravelton Clark 2026"])
    expect(byName<TextElement>(back, "Headline").highlight?.fill).toBe("#F8C563")
    // Older designs without the field have no highlight.
    expect(byName<TextElement>(normalizeDesign({ elements: [{ type: "text", name: "Headline", role: "title", text: "x" }] }), "Headline").highlight).toBeUndefined()
  })
})

describe("poster changes (Poster Maker / News Article)", () => {
  it("sets the headline, highlighted words and photo credit", () => {
    const d = applyNewsChange(buildPickleplayPoster(), {
      headline: HEADLINE,
      highlight: ["  Gravelton  Clark 2026 "],
      credit: { enabled: true, name: " Frank  Gomez " },
    })
    expect(newsHeadline(d)).toBe(HEADLINE)
    expect(newsHighlight(d)).toEqual(["Gravelton Clark 2026"])
    expect(byName<TextElement>(d, "Photo Credit")).toMatchObject({ text: "PHOTO OF: Frank Gomez", visible: true, textCase: "upper" })
    expect(newsCredit(d)).toEqual({ enabled: true, name: "Frank Gomez" })
  })

  it("keeps the credit hidden when it's off or has no name", () => {
    const off = applyNewsChange(buildFhiPoster(), { credit: { enabled: false, name: "Frank Gomez" } })
    expect(byName<TextElement>(off, "Photo Credit").visible).toBe(false)
    expect(newsCredit(off)).toEqual({ enabled: false, name: "Frank Gomez" })
    const noName = applyNewsChange(buildFhiPoster(), { credit: { enabled: true, name: "  " } })
    expect(byName<TextElement>(noName, "Photo Credit").visible).toBe(false)
  })

  it("switching brand keeps the photo, headline, highlight and credit", () => {
    const photo = { src: "https://example.com/p.jpg", naturalWidth: 1600, naturalHeight: 900 }
    const fhi = applyNewsChange(buildFhiPoster(), { photo, headline: HEADLINE, highlight: ["Gravelton Clark 2026"], credit: { enabled: true, name: "Frank Gomez" } })
    const pp = applyNewsChange(fhi, { templateId: "pickleplay-poster-news" })
    expect(pp.templateId).toBe("pickleplay-poster-news")
    expect(pp.elements.filter((e) => e.type === "image" && e.role === "background").map((e) => (e as ImageElement).src)).toEqual([photo.src, photo.src])
    expect(newsHeadline(pp)).toBe(HEADLINE)
    expect(newsHighlight(pp)).toEqual(["Gravelton Clark 2026"])
    expect(byName<TextElement>(pp, "Headline").highlight?.fill).toBe("#AFD137")
    expect(newsCredit(pp)).toEqual({ enabled: true, name: "Frank Gomez" })
  })

  it("other news templates ignore highlight and credit", () => {
    const d = applyNewsChange(buildFhiPoster({ headline: HEADLINE }), { templateId: "fhi-wide-news", highlight: ["Gravelton"] })
    expect(d.templateId).toBe("fhi-wide-news")
    expect(newsHighlight(d)).toEqual([])
    expect(newsCredit(d)).toBeNull()
    expect(newsHeadline(d)).toBe(HEADLINE)
  })
})
