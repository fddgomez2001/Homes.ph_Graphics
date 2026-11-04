import { describe, expect, it } from "vitest"
import { formatColor, parseColor } from "@/lib/design/color"
import { coverLayout, containLayout, gradientPoints, imageUpscaleFactor, konvaFillAttrs } from "@/lib/design/geometry"
import { applyTextStack, findTextWarnings, shrinkStackToFit, type MeasureText } from "@/lib/design/layout"
import { draftCaption, toSentencePhrase } from "@/lib/design/caption"
import { logoDrawBox, logoForLuminance, logoSource, meanLuminance } from "@/lib/design/logo"
import { normalizeDesign } from "@/lib/design/normalize"
import { coverTitle } from "@/lib/design/cover-title"
import { applyTitleFit, fitLineSize, titleFitReport } from "@/lib/design/title-fit"
import {
  applyTemplateKeepingContent,
  BUILT_IN_TEMPLATES,
  buildPickleplayNews,
  buildCardDesign,
  buildCoverDesign,
  cloneDesignWithNewIds,
  DEFAULT_TEMPLATE_CONTEXT,
  getBuiltInTemplate,
  summarizeDesign,
} from "@/lib/design/templates"
import { CANVAS_SIZE, DESIGN_VERSION, type DesignElement, type ImageElement, type ShapeElement, type TextElement } from "@/lib/design/types"

/** Fake measurement: assumes ~0.55em average glyph width and word wrapping. */
const measure: MeasureText = (el) => {
  // Auto-fit lines never wrap (Konva wrap: "none").
  if (el.autoFit) return el.lineHeight * el.text.split(String.fromCharCode(10)).length
  const charsPerLine = Math.max(1, Math.floor(el.width / (el.fontSize * 0.55)))
  const lines = el.text.split("\n").reduce((n, para) => n + Math.max(1, Math.ceil(para.length / charsPerLine)), 0)
  const pad = el.background.enabled ? el.background.padding * 2 : 0
  return lines * el.lineHeight + pad
}

const byRole = <T,>(design: { elements: unknown[] }, role: string) =>
  design.elements.find((e) => (e as { role?: string }).role === role) as T

/** Fake single-line width: proportional to size, with a per-text factor so tests can target exact fits. */
const lineWidth = (factors: Record<string, number>) => (el: TextElement) => (factors[el.text] ?? el.text.length * 0.55) * el.fontSize

describe("Homes.ph cover template (Carousel Cover Template)", () => {
  const cover = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT, { white: "Every Sound", yellow: "Carries A Story.", description: "6 Traditional Filipino Instruments" })
  const byName = <T,>(name: string) => cover.elements.find((e) => e.name === name) as T

  it("is an exact 1254 x 1254 canvas with the photo first", () => {
    expect(cover.width).toBe(1254)
    expect(cover.height).toBe(1254)
    expect(cover.elements[0]).toMatchObject({ type: "image", role: "background", x: 0, y: 0, width: 1254, height: 1254, fit: "cover" })
  })

  it("has the two blurred Title Glow gradients (the second at 41%)", () => {
    for (const [name, opacity] of [["Title Glow Gradient", 1], ["Title Glow Gradient 2", 0.41]] as const) {
      expect(byName<ShapeElement>(name)).toMatchObject({
        x: -200,
        y: 251,
        width: 1627,
        height: 655,
        blur: 156.5,
        opacity,
        fill: {
          type: "radial",
          cx: 0.5,
          cy: 0.5,
          rx: 0.5449,
          ry: 0.5449,
          stops: [
            { offset: 0.2788, color: "rgba(10, 26, 126, 0.88)" },
            { offset: 0.7404, color: "rgba(11, 31, 142, 0.6)" },
            { offset: 1, color: "rgba(11, 31, 142, 0)" },
          ],
        },
      })
    }
  })

  it("has the navy Top Band, the Top Right Swoosh, the bottom blue gradient and the white H at 583, 39 (88 × 86)", () => {
    // Rectangle 13120: linear-gradient(0deg, #0D1969 -49.56%, transparent 92.7%), flipped: 65% navy at the top.
    expect(byName<ShapeElement>("Top Band")).toMatchObject({
      x: 0,
      y: 0,
      width: 1254,
      height: 226,
      fill: { type: "linear", angle: 180, stops: [{ offset: 0, color: "rgba(13, 25, 105, 0.65)" }, { offset: 0.927, color: "rgba(13, 25, 105, 0)" }] },
    })
    expect(byName<ImageElement>("Top Right Swoosh")).toMatchObject({ src: "/brand/top-right-swoosh.png", x: 0, y: 0, width: 1254, height: 1254, locked: true })
    // The same corner swoosh mirrored at the top left (Corner Blue / Corner Gold Swoosh, flipped).
    expect(byName<ImageElement>("Top Left Swoosh")).toMatchObject({ src: "/brand/top-left-swoosh.png", x: 0, y: 0, width: 1254, height: 1254, locked: true })
    // Figma frame color under the photo.
    expect(cover.background).toBe("#0B1F8E")
    expect(byName<ShapeElement>("Bottom Band")).toMatchObject({
      y: 876,
      height: 378,
      fill: { type: "linear", angle: 0, stops: [{ offset: 0, color: "#0D1969" }, { offset: 0.7407, color: "rgba(13, 25, 105, 0)" }] },
    })
    const logo = byRole<ImageElement>(cover, "logo")
    expect(logo).toMatchObject({ x: 583, y: 39, width: 88, height: 86, logoVariant: "auto", src: "/brand/homes-ph-logo-white.png" })
    expect(logo.x + logo.width / 2).toBe(627)
    // Layer order: photo, glows, top band, swoosh, bottom band, logo, then the text.
    const order = cover.elements.map((e) => e.name)
    expect(order.indexOf("Top Band")).toBeLessThan(order.indexOf("Top Right Swoosh"))
    expect(order.indexOf("Top Right Swoosh")).toBeLessThan(order.indexOf("Homes.ph Logo"))
  })

  it("uses the Title Block typography (white 900 / 172, gold gradient 900 / 148, subtitle 600 / 50 on 63, soft navy shadow)", () => {
    const shadow = { enabled: true, color: "rgba(5, 13, 64, 0.45)", blur: 18, offsetX: 0, offsetY: 6 }
    expect(byRole<TextElement>(cover, "headline")).toMatchObject({ name: "Headline Line 1 (White)", fontWeight: 900, fontSize: 172, lineHeight: 172, letterSpacing: 0, fill: "#FFFFFF", align: "center", x: 96, width: 1062, shadow })
    const gold = byRole<TextElement>(cover, "highlight")
    expect(gold).toMatchObject({ name: "Headline Line 2 (Gold)", fontWeight: 900, fontSize: 148, lineHeight: 148, x: 96, width: 1062, shadow })
    expect(gold.fillGradient).toEqual({
      type: "linear",
      angle: 90,
      stops: [
        { offset: 0.0817, color: "#FDBA2F" },
        { offset: 0.9135, color: "#FEDF69" },
      ],
    })
    expect(byRole<TextElement>(cover, "description")).toMatchObject({ name: "Subtitle", fontWeight: 600, fontSize: 50, lineHeight: 63, shadow })
  })

  it("short title: keeps 172 / 148 / 50 px with gaps 5 / 20, Title Block 394-802 (centered at y 598)", () => {
    const fitted = applyTextStack(applyTitleFit(cover, lineWidth({ "Every Sound": 5, "Carries A Story.": 6, "6 Traditional Filipino Instruments": 20 })), measure)
    const [l1, l2, sub] = ["headline", "highlight", "description"].map((r) => byRole<TextElement>(fitted, r))
    expect([l1.fontSize, l2.fontSize, sub.fontSize]).toEqual([172, 148, 50])
    expect([l1.lineHeight, l2.lineHeight, sub.lineHeight]).toEqual([172, 148, 63])
    // 172 + 5 + 148 + 20 + 63 = 408 tall, exactly the Figma Title Block (top 394)
    expect(l1.y).toBe(394)
    expect(l2.y).toBe(571)
    expect(sub.y).toBe(739)
    expect(titleFitReport(fitted)).toEqual(["Headline Line 1: 172px", "Headline Line 2: 148px", "Subtitle: 50px", "Line gap: 5px"])
  })

  it("long title: every line shrinks to one line, the gap shrinks with it and the block stays centered", () => {
    const long = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT, { white: "A", yellow: "B", description: "C" })
    // Widths chosen so each line fits at exactly 98 / 103 / 40 px inside 1062 px.
    const fitted = applyTextStack(applyTitleFit(long, lineWidth({ A: 1062 / 98.5, B: 1062 / 103.5, C: 1062 / 40.5 })), measure)
    const [l1, l2, sub] = ["headline", "highlight", "description"].map((r) => byRole<TextElement>(fitted, r))
    expect([l1.fontSize, l2.fontSize, sub.fontSize]).toEqual([98, 103, 40])
    // The subtitle keeps its 63 / 50 line height.
    expect([l1.lineHeight, l2.lineHeight, sub.lineHeight]).toEqual([98, 103, 50.4])
    // Each line compared with its own max (98/172 is the most shrunk): round(5 × 0.57²) = 2
    expect(fitted.stack!.items[1].gap).toBe(2)
    expect(l2.y - l1.y).toBe(98 + 2)
    expect(sub.y - l2.y).toBe(103 + 20)
    expect(Math.abs((l1.y + sub.y + 50.4) / 2 - 598)).toBeLessThanOrEqual(1)
  })

  it("follows the plugin: fit by proportional guess then 1 px steps, never above max, minimum 8", () => {
    const el = { ...byRole<TextElement>(cover, "headline"), text: "X" }
    expect(fitLineSize(el, () => 500)).toBe(172)
    expect(fitLineSize(el, (e) => e.fontSize * 20)).toBe(53) // floor(172 x 1062 / 3440) = 53, 53 x 20 = 1060 fits
    expect(fitLineSize(el, (e) => e.fontSize * 1000)).toBe(8)
  })

  it("'Same size for white & gold lines' uses the smaller size for both", () => {
    const matched = buildCoverDesign({ ...DEFAULT_TEMPLATE_CONTEXT, titleMatchHeadlines: true }, { white: "A", yellow: "B", description: "C" })
    const fitted = applyTitleFit(matched, lineWidth({ A: 1062 / 98.5, B: 1062 / 103.5, C: 1 }))
    expect(byRole<TextElement>(fitted, "headline").fontSize).toBe(98)
    expect(byRole<TextElement>(fitted, "highlight").fontSize).toBe(98)
  })
})

describe("Classic cover template (first Figma spec)", () => {
  const cover = getBuiltInTemplate("classic-cover")!.build(DEFAULT_TEMPLATE_CONTEXT, { white: "Every Sound", yellow: "Carries A Story.", description: "6 Traditional Filipino Instruments With Stories Behind Their Sound" })

  it("is an exact 1254 × 1254 canvas on white", () => {
    expect(cover.width).toBe(1254)
    expect(cover.height).toBe(1254)
    expect(CANVAS_SIZE).toBe(1254)
    expect(cover.background).toBe("#FFFFFF")
  })

  it("has a full-canvas cover-fit photo, then the Blue Fade", () => {
    const [bg, overlay] = cover.elements as [ImageElement, ShapeElement]
    expect(bg).toMatchObject({ type: "image", role: "background", x: 0, y: 0, width: 1254, height: 1254, fit: "cover" })
    expect(overlay).toMatchObject({ type: "shape", role: "overlay", name: "Blue Fade", x: 0, y: 0, width: 1254, height: 1254 })
    expect(overlay.fill).toEqual({
      type: "linear",
      angle: 180,
      stops: [
        { offset: 0, color: "rgba(7, 48, 163, 0.7)" },
        { offset: 1, color: "rgba(11, 23, 103, 0.8)" },
      ],
    })
  })

  it("places the Homes.ph logo (white H) at x 583, y 37, 88 × 86 in automatic color mode", () => {
    const logo = byRole<ImageElement>(cover, "logo")
    expect(logo).toMatchObject({ x: 583, y: 39, width: 88, height: 86, fit: "contain", logoVariant: "auto", src: "/brand/homes-ph-logo-white.png" })
    expect(logo.x + logo.width / 2).toBe(627)
  })

  it("uses the White First Line / Yellow First Line / Cover Description typography (no shadows)", () => {
    const white = byRole<TextElement>(cover, "headline")
    const yellow = byRole<TextElement>(cover, "highlight")
    const description = byRole<TextElement>(cover, "description")
    expect(white).toMatchObject({ name: "White First Line", fontFamily: "Outfit", fontWeight: 900, fontSize: 120, lineHeight: 118, align: "center", fill: "#FFFFFF", x: 68, width: 1119 })
    expect(yellow).toMatchObject({ name: "Yellow First Line", fontWeight: 900, fontSize: 105, lineHeight: 118, fill: "#F8C563", align: "center", x: 68, width: 1119 })
    expect(description).toMatchObject({ name: "Cover Description", fontWeight: 600, fontSize: 60, lineHeight: 76, width: 1030, x: 112, align: "center" })
    expect([white, yellow, description].every((t) => !t.shadow.enabled)).toBe(true)
  })

  it("lays the text group out where Figma has it (one-line headlines, 3-line description box)", () => {
    const laidOut = applyTextStack(cover, measure)
    // Figma: white line box 261-408 (text centered -> 275.5), yellow 369-543 (-> 397), description at 519.
    expect(byRole<TextElement>(laidOut, "headline").y).toBe(276)
    expect(byRole<TextElement>(laidOut, "highlight").y).toBe(397)
    expect(byRole<TextElement>(laidOut, "description").y).toBe(519)
  })

  it("keeps the group centered when a line is left empty", () => {
    const noYellow = { ...cover, elements: cover.elements.map((e) => (e.role === "highlight" ? { ...e, text: "" } : e)) }
    const laidOut = applyTextStack(noYellow, measure)
    const white = byRole<TextElement>(laidOut, "headline")
    const description = byRole<TextElement>(laidOut, "description")
    expect(description.y - (white.y + 118)).toBe(4)
    expect(Math.abs((white.y + description.y + 228) / 2 - 511.25)).toBeLessThanOrEqual(1)
  })

  it("has the footer: web icon + www.homes.ph and Facebook icon + page name", () => {
    const [web, facebook] = cover.elements.filter((e) => e.role === "footer") as TextElement[]
    const [webIcon, fbIcon] = cover.elements.filter((e) => e.role === "icon") as ImageElement[]
    expect(webIcon).toMatchObject({ x: 193, y: 1169, width: 34, height: 34, src: "/brand/icon-web.png" })
    expect(web).toMatchObject({ text: "www.homes.ph", x: 237, y: 1170, fontSize: 35, fontWeight: 300, lineHeight: 25, fill: "#FFFFFF" })
    expect(fbIcon).toMatchObject({ x: 535, y: 1169, width: 34, height: 34, src: "/brand/icon-facebook.png" })
    expect(facebook).toMatchObject({ text: "facebook.com/homesphofficial", x: 579, y: 1173, fontSize: 35, fontWeight: 300, lineHeight: 25 })
  })
})

describe("Homes.ph content card template (Figma spec)", () => {
  const card = buildCardDesign()

  it("has the same navy Top Band and white H logo (88 × 86 at 583, 39) as the cover, logo on top", () => {
    const band = card.elements.find((e) => e.name === "Top Band") as ShapeElement
    expect(band).toMatchObject({ x: 0, y: 0, width: 1254, height: 226, fill: { type: "linear", angle: 180 } })
    const logo = byRole<ImageElement>(card, "logo")
    expect(logo).toMatchObject({ x: 583, y: 39, width: 88, height: 86, logoVariant: "auto" })
    expect(card.elements.indexOf(band)).toBeLessThan(card.elements.indexOf(logo))
    for (const id of ["text-card", "full-image", "quote-stat"]) {
      const other = getBuiltInTemplate(id)!.build(DEFAULT_TEMPLATE_CONTEXT)
      expect(other.elements.some((e) => e.name === "Top Band"), id).toBe(true)
      expect(byRole<ImageElement>(other, "logo"), id).toMatchObject({ x: 583, y: 39, width: 88, height: 86 })
    }
  })

  it("has the blue gradient from y 440, 814 tall, opaque navy at the bottom", () => {
    const gradient = byRole<ShapeElement>(card, "overlay")
    expect(gradient).toMatchObject({ x: 0, y: 440, width: 1254, height: 814 })
    expect(gradient.fill).toEqual({
      type: "linear",
      angle: 0,
      stops: [
        { offset: 0, color: "#0D1969" },
        { offset: 1, color: "rgba(13, 25, 105, 0)" },
      ],
    })
  })

  it("uses the Card Title / Card Subtitle (#FFF1B9) / Card Description specs", () => {
    expect(byRole<TextElement>(card, "title")).toMatchObject({ x: 40, y: 955, width: 1174, fontSize: 90, fontWeight: 700, lineHeight: 80, fill: "#FFFFFF" })
    expect(byRole<TextElement>(card, "subtitle")).toMatchObject({ x: 40, y: 1028, fontSize: 40, fontWeight: 700, lineHeight: 80, fill: "#FFF1B9" })
    expect(byRole<TextElement>(card, "description")).toMatchObject({ x: 40, y: 1114, width: 1174, fontSize: 40, fontWeight: 400, lineHeight: 50 })
  })

  it("with a subtitle: title 955, subtitle 1028, description 1114 (even with a one-line description)", () => {
    for (const text of ["Two lines of description text that wrap onto a second line in the card layout here", "Short"]) {
      const d = { ...card, elements: card.elements.map((e) => (e.role === "description" ? { ...e, text } : e)) }
      const laidOut = applyTextStack(d, measure)
      expect(byRole<TextElement>(laidOut, "title").y).toBe(955)
      expect(byRole<TextElement>(laidOut, "subtitle").y).toBe(1028)
      expect(byRole<TextElement>(laidOut, "description").y).toBe(1114)
    }
  })

  it("without a subtitle: switches to the no-subtitle layout (title 1016, description 1114)", () => {
    const noSubtitle = { ...card, elements: card.elements.map((e) => (e.role === "subtitle" ? { ...e, text: "  " } : e)) }
    const laidOut = applyTextStack(noSubtitle, measure)
    expect(byRole<TextElement>(laidOut, "title").y).toBe(1016)
    expect(byRole<TextElement>(laidOut, "description").y).toBe(1114)
  })

  it("pushes the text block up when the title wraps, instead of overlapping", () => {
    const longTitle = {
      ...card,
      elements: card.elements.map((e) => (e.role === "title" ? { ...e, text: "A much longer card title that wraps onto a second line" } : e)),
    }
    const laidOut = applyTextStack(longTitle, measure)
    const title = byRole<TextElement>(laidOut, "title")
    const subtitle = byRole<TextElement>(laidOut, "subtitle")
    expect(title.y).toBeLessThan(955)
    expect(title.y + measure(title) - 7).toBe(subtitle.y)
  })
})

describe("templates", () => {
  it("provides the five starting templates", () => {
    expect(BUILT_IN_TEMPLATES.map((t) => t.id)).toEqual(["homes-cover", "classic-cover", "homes-card", "text-card", "full-image", "quote-stat"])
    for (const t of BUILT_IN_TEMPLATES) {
      const d = t.build(DEFAULT_TEMPLATE_CONTEXT)
      expect(d.width).toBe(1254)
      expect(new Set(d.elements.map((e) => e.id)).size).toBe(d.elements.length)
    }
  })

  it("clones with fresh ids and remaps the text stack", () => {
    const card = buildCardDesign()
    const clone = cloneDesignWithNewIds(card)
    const originalIds = new Set(card.elements.map((e) => e.id))
    expect(clone.elements.every((e) => !originalIds.has(e.id))).toBe(true)
    const cloneIds = new Set(clone.elements.map((e) => e.id))
    expect(clone.stack!.items.every((i) => cloneIds.has(i.id))).toBe(true)
  })

  it("applying a template keeps the slide's text and photo", () => {
    const card = buildCardDesign()
    card.elements = card.elements.map((e) => {
      if (e.role === "title") return { ...e, text: "My title" } as TextElement
      if (e.role === "background") return { ...e, src: "https://res.cloudinary.com/x/image/upload/v1/a.jpg", naturalWidth: 4000, naturalHeight: 3000, zoom: 1.4 } as ImageElement
      return e
    })
    const textCard = BUILT_IN_TEMPLATES.find((t) => t.id === "text-card")!.build(DEFAULT_TEMPLATE_CONTEXT)
    const applied = applyTemplateKeepingContent(card, textCard)
    expect(byRole<TextElement>(applied, "title").text).toBe("My title")
    const bg = byRole<ImageElement>(applied, "background")
    expect(bg.src).toContain("a.jpg")
    expect(bg.zoom).toBe(1.4)
    expect(applied.elements[0]).toBe(bg) // photo stays at the bottom
  })

  it("summarizes searchable fields and never stores temporary blob URLs", () => {
    const cover = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT, { white: "Title" })
    expect(summarizeDesign(cover)).toMatchObject({ title: "Title", subtitle: "Goes Here", background_image_url: null })
    cover.elements[0] = { ...(cover.elements[0] as ImageElement), src: "blob:http://localhost/abc" }
    expect(summarizeDesign(cover).background_image_url).toBeNull()
  })
})

describe("cover-fit math", () => {
  it("fills the frame exactly (object-fit: cover)", () => {
    const { crop, scale } = coverLayout(4000, 3000, 1254, 1254)
    expect(scale).toBeCloseTo(1254 / 3000)
    expect(crop.height).toBeCloseTo(3000)
    expect(crop.width).toBeCloseTo(3000) // square crop from a 4:3 photo
    expect(crop.x).toBeCloseTo(500) // centered
  })

  it("zoom narrows the crop and focus moves it", () => {
    const left = coverLayout(4000, 3000, 1254, 1254, 2, 0, 0.5)
    expect(left.crop.width).toBeCloseTo(1500)
    expect(left.crop.x).toBeCloseTo(0)
    const right = coverLayout(4000, 3000, 1254, 1254, 2, 1, 0.5)
    expect(right.crop.x + right.crop.width).toBeCloseTo(4000)
  })

  it("contain-fit keeps the whole image and aspect ratio", () => {
    const { image } = containLayout(512, 500, 72, 70)
    expect(image.width / image.height).toBeCloseTo(512 / 500)
    expect(image.width).toBeLessThanOrEqual(72)
    expect(image.height).toBeLessThanOrEqual(70)
  })

  it("flags upscaling of small photos", () => {
    expect(imageUpscaleFactor({ naturalWidth: 4000, naturalHeight: 3000, width: 1254, height: 1254, fit: "cover", zoom: 1 })).toBeLessThan(1)
    expect(imageUpscaleFactor({ naturalWidth: 600, naturalHeight: 400, width: 1254, height: 1254, fit: "cover", zoom: 1 })).toBeGreaterThan(3)
  })
})

describe("CSS gradient angles", () => {
  it("180deg runs top → bottom, 0deg bottom → top, 90deg left → right", () => {
    expect(gradientPoints(180, 1254, 814)).toMatchObject({ start: { x: 627, y: 0 }, end: { x: 627, y: 814 } })
    const up = gradientPoints(0, 1254, 814)
    expect(up.start.y).toBeCloseTo(814)
    expect(up.end.y).toBeCloseTo(0)
    const right = gradientPoints(90, 100, 50)
    expect(right.start.x).toBeCloseTo(0)
    expect(right.end.x).toBeCloseTo(100)
  })

  it("maps fills to Konva attributes", () => {
    const attrs = konvaFillAttrs({ type: "linear", angle: 180, stops: [{ offset: 1, color: "red" }, { offset: 0, color: "blue" }] }, 10, 10)
    expect(attrs.fillLinearGradientColorStops).toEqual([0, "blue", 1, "red"])
    expect(konvaFillAttrs({ type: "solid", color: "#fff" }, 1, 1)).toMatchObject({ fill: "#fff" })
  })
})

describe("colors", () => {
  it("parses and formats hex and rgba", () => {
    expect(parseColor("rgba(7, 48, 163, 0.7)")).toEqual({ hex: "#0730A3", alpha: 0.7 })
    expect(parseColor("#f8c563")).toEqual({ hex: "#F8C563", alpha: 1 })
    expect(formatColor("#0D1969", 0)).toBe("rgba(13, 25, 105, 0)")
    expect(formatColor("#0d1969", 1)).toBe("#0D1969")
  })
})

describe("text warnings and fitting", () => {
  it("warns when text would be cut off at the canvas edge, and shrink-to-fit fixes it", () => {
    const cover = getBuiltInTemplate("classic-cover")!.build(DEFAULT_TEMPLATE_CONTEXT, {
      white: "THIS IS AN EXTREMELY LONG HEADLINE THAT KEEPS GOING AND GOING FOR MANY MANY LINES ON THE COVER AND THEN EVEN MORE",
    })
    const laidOut = applyTextStack(cover, measure)
    expect(findTextWarnings(laidOut, measure).length).toBeGreaterThan(0)
    const fitted = shrinkStackToFit(laidOut, measure)
    expect(findTextWarnings(fitted, measure)).toEqual([])
    expect(byRole<TextElement>(fitted, "headline").fontSize).toBeLessThan(120)
  })

  it("does not warn for the default templates", () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(findTextWarnings(applyTextStack(t.build(DEFAULT_TEMPLATE_CONTEXT), measure), measure)).toEqual([])
    }
  })
})

describe("normalizeDesign", () => {
  it("survives malformed data and always yields a 1254 canvas", () => {
    const d = normalizeDesign({ elements: [{ type: "text" }, { type: "unknown" }, null, { type: "shape", fill: { type: "linear", stops: [] } }] })
    expect(d.width).toBe(1254)
    expect(d.elements).toHaveLength(2)
    expect(d.elements[1]).toMatchObject({ type: "shape", fill: { type: "solid" } })
    expect(normalizeDesign(null).elements).toEqual([])
  })
})

describe("automatic logo color", () => {
  it("uses white on dark backgrounds and blue on light ones", () => {
    const pixels = (r: number, g: number, b: number) => new Uint8ClampedArray(Array.from({ length: 100 }, () => [r, g, b, 255]).flat())
    expect(logoForLuminance(meanLuminance(pixels(13, 25, 105)))).toBe("white") // card gradient navy
    expect(logoForLuminance(meanLuminance(pixels(40, 60, 140)))).toBe("white") // blue fade over a photo
    expect(logoForLuminance(meanLuminance(pixels(120, 120, 120)))).toBe("white") // mid-dark gray
    expect(logoForLuminance(meanLuminance(pixels(170, 200, 235)))).toBe("blue") // daytime sky
    expect(logoForLuminance(meanLuminance(pixels(250, 250, 250)))).toBe("blue") // white wall
    expect(meanLuminance(new Uint8ClampedArray([0, 0, 0, 0]))).toBe(1) // transparent counts as white
  })

  it("draws the blue logo at 65 x 63 centered in the 72 x 70 slot", () => {
    expect(logoDrawBox({ role: "logo", width: 72, height: 70, logoResolved: "blue" })).toEqual({ x: 3.5, y: 3.5, width: 65, height: 63 })
    expect(logoDrawBox({ role: "logo", width: 72, height: 70, logoResolved: "white" })).toEqual({ x: 0, y: 0, width: 72, height: 70 })
    // Same proportions in the 88 × 86 slot.
    const big = logoDrawBox({ role: "logo", width: 88, height: 86, logoResolved: "blue" })
    expect(big.width).toBeCloseTo(79.44, 2)
    expect(big.height).toBeCloseTo(77.4, 2)
    expect(big.x).toBeCloseTo((88 - big.width) / 2, 5)
    expect(logoSource("blue")).toMatchObject({ src: "/brand/homes-ph-logo-blue.png", naturalWidth: 260, naturalHeight: 252 })
  })
})

describe("caption draft", () => {
  it("follows the Homes.ph caption style from the cover and card titles", () => {
    const cover = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT, {
      white: "Every Sound",
      yellow: "Carries A Story.",
      description: "6 Traditional Filipino Instruments With Stories Behind Their Sound",
    })
    const cards = ["Kulintang", "Gangsa", "Kudyapi", "Kubing", "Tongali", "Gabbang"].map((title) => {
      const d = buildCardDesign()
      d.elements = d.elements.map((e) => (e.role === "title" ? { ...e, text: title } : e))
      return { design: d }
    })
    expect(draftCaption([{ design: cover }, ...cards])).toBe(
      "Discover 6 traditional Filipino instruments with stories behind their sound! From kulintang and gangsa to kudyapi, kubing, tongali, and gabbang, swipe through to see what makes each of these instruments special.",
    )
  })

  it("keeps multi-word place names", () => {
    expect(toSentencePhrase("6 Condos In Bonifacio Global City Under ₱10M")).toBe("6 condos in Bonifacio Global City under ₱10M")
    expect(toSentencePhrase("Homes In quezon city")).toBe("homes in Quezon City")
  })

  it("keeps acronyms and proper nouns", () => {
    expect(toSentencePhrase("Top BGC Condos Under ₱10M In Metro Manila")).toBe("top BGC condos under ₱10M in Metro Manila")
  })
})

describe("PicklePlay news article template (1408 × 1408)", () => {
  const news = buildPickleplayNews({ headline: "Why Location and Community Are the Real Keys to Surviving the Pickleball Business Boom" })
  const named = <T,>(name: string) => news.elements.find((e) => e.name === name) as T

  it("is a 1408 × 1408 canvas, kept at that size when saved and loaded", () => {
    expect([news.width, news.height]).toEqual([1408, 1408])
    const reloaded = normalizeDesign(JSON.parse(JSON.stringify(news)))
    expect([reloaded.width, reloaded.height]).toEqual([1408, 1408])
    expect(normalizeDesign({ elements: [] }).width).toBe(1254)
  })

  it("has the background art, the PicklePlay logo and the photo card from Figma", () => {
    expect(named<ImageElement>("News Background")).toMatchObject({ src: "/brand/news/pickleplay-background.png", x: 0, y: 0, width: 1408, height: 1408, locked: true })
    expect(named<ImageElement>("PicklePlay Logo")).toMatchObject({ x: 595, y: 38, width: 191, height: 191, fit: "contain" })
    expect(named<ShapeElement>("Photo Card")).toMatchObject({
      x: 74,
      y: 266,
      width: 1260,
      height: 652,
      cornerRadius: 36,
      fill: { type: "solid", color: "#1B4FD8" },
      shadow: { enabled: true, color: "rgba(5, 15, 64, 0.35)", blur: 50, offsetX: 0, offsetY: 20 },
    })
    expect(named<ImageElement>("Photo")).toMatchObject({ role: "background", x: 74, y: 266, width: 1260, height: 652, cornerRadius: 36, fit: "cover" })
    expect(named<ShapeElement>("Photo Card Border")).toMatchObject({ stroke: { color: "rgba(255, 255, 255, 0.45)", width: 3 } })
    // Card, photo, border: the border sits on top of the photo.
    const order = news.elements.map((e) => e.name)
    expect(order.indexOf("Photo Card")).toBeLessThan(order.indexOf("Photo"))
    expect(order.indexOf("Photo")).toBeLessThan(order.indexOf("Photo Card Border"))
  })

  it("uses the headline and footer typography", () => {
    expect(named<TextElement>("Headline")).toMatchObject({ role: "title", fontFamily: "Outfit", fontWeight: 600, fontSize: 76, lineHeight: 77, letterSpacing: -0.76, align: "center", width: 1260 })
    expect(named<TextElement>("Website")).toMatchObject({ text: "www.pickleplay.ph", fontFamily: "Inter", fontWeight: 500, fontSize: 26.7, lineHeight: 34, fill: "#F6FAFF" })
    expect(named<TextElement>("Facebook")).toMatchObject({ text: "facebook.com/pickleplayofficial" })
  })

  it("keeps the headline block centered on the 3-line box (y 988-1219)", () => {
    const laidOut = applyTextStack(news, measure)
    const h = named<TextElement>("Headline")
    const placed = laidOut.elements.find((e) => e.id === h.id) as TextElement
    const height = measure(placed)
    expect(Math.abs(placed.y + height / 2 - 1103.5)).toBeLessThanOrEqual(1)
  })

  it("names the project after the headline", () => {
    expect(coverTitle(news)).toBe("Why Location and Community Are the Real Keys to Surviving the Pickleball Business Boom")
  })
})

describe("FHI portrait headlines in capital letters", () => {
  it("Template 1 shows the headline in capitals; the text stays as typed, and Template 2 shows it as typed", async () => {
    const { buildFhiPortraitNews, buildFhiWideNews } = await import("@/lib/design/templates")
    const { displayText, textAttrs } = await import("@/lib/design/konva-attrs")
    const headline = "Dubai Residential Plot Resells For Six Hundred Million Dirhams"
    const title = (d: { elements: DesignElement[] }) => d.elements.find((e) => e.type === "text" && e.role === "title") as TextElement
    const portrait = title(buildFhiPortraitNews({ headline }))
    expect(portrait.text).toBe(headline)
    expect(displayText(portrait)).toBe("DUBAI RESIDENTIAL PLOT RESELLS FOR SIX HUNDRED MILLION DIRHAMS")
    expect(textAttrs(portrait).text).toBe("DUBAI RESIDENTIAL PLOT RESELLS FOR SIX HUNDRED MILLION DIRHAMS")
    const wide = title(buildFhiWideNews({ headline }))
    expect(displayText(wide)).toBe(headline)
    // Kept through saving and loading; other text is untouched.
    expect(title(normalizeDesign(JSON.parse(JSON.stringify(buildFhiPortraitNews({ headline }))))).textCase).toBe("upper")
    expect(title(normalizeDesign(JSON.parse(JSON.stringify(buildFhiWideNews({ headline }))))).textCase).toBeUndefined()
  })

  it("FHI portrait posts saved before get capitals once; turning it off afterwards sticks", async () => {
    const { buildFhiPortraitNews, buildFhiWideNews } = await import("@/lib/design/templates")
    const title = (d: { elements: DesignElement[] }) => d.elements.find((e) => e.type === "text" && e.role === "title") as TextElement
    const old = JSON.parse(JSON.stringify(buildFhiPortraitNews({ headline: "Old post" })))
    old.version = 2
    for (const el of old.elements) delete el.textCase
    const upgraded = normalizeDesign(old)
    expect(title(upgraded).textCase).toBe("upper")
    expect(upgraded.elements.filter((e) => e.type === "text" && e.textCase === "upper")).toHaveLength(1)
    // Switched off in the editor (saved at the current version): stays off.
    const off = { ...upgraded, elements: upgraded.elements.map((e) => (e.type === "text" && e.role === "title" ? { ...e, textCase: null } : e)) }
    expect(title(normalizeDesign(JSON.parse(JSON.stringify(off)))).textCase).toBeUndefined()
    // Older wide posts are left as typed.
    const oldWide = JSON.parse(JSON.stringify(buildFhiWideNews({ headline: "Old wide" })))
    oldWide.version = 2
    expect(title(normalizeDesign(oldWide)).textCase).toBeUndefined()
  })
})

describe("older covers get the left corner swoosh once", () => {
  const rightSwoosh = { id: "sw1", type: "image", name: "Top Right Swoosh", src: "/brand/top-right-swoosh.png", x: 0, y: 0, width: 1254, height: 1254, locked: true }
  const photo = { id: "bg", type: "image", name: "BG Photo", src: "https://res.cloudinary.com/x/image/upload/a.jpg", x: 0, y: 0, width: 1254, height: 1254 }

  it("adds it right above the top-right swoosh, with a stable id", () => {
    const first = normalizeDesign({ version: 1, elements: [photo, rightSwoosh] })
    expect(first.elements.map((e) => e.name)).toEqual(["BG Photo", "Top Right Swoosh", "Top Left Swoosh"])
    expect(first.elements[2]).toMatchObject({ id: "sw1-left", src: "/brand/top-left-swoosh.png", x: 0, y: 0, width: 1254, height: 1254, locked: true })
    expect(first.version).toBe(DESIGN_VERSION)
    // Loading the same saved design again gives the same result.
    expect(normalizeDesign({ version: 1, elements: [photo, rightSwoosh] })).toEqual(first)
    // Already upgraded: unchanged.
    expect(normalizeDesign(JSON.parse(JSON.stringify(first)))).toEqual(first)
  })

  it("respects a left swoosh deleted after the upgrade, and leaves cards alone", () => {
    const deleted = normalizeDesign({ version: 2, elements: [photo, rightSwoosh] })
    expect(deleted.elements.map((e) => e.name)).toEqual(["BG Photo", "Top Right Swoosh"])
    const card = normalizeDesign({ version: 1, elements: [photo] })
    expect(card.elements.map((e) => e.name)).toEqual(["BG Photo"])
  })

  it("new covers already have both swooshes", () => {
    const cover = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT)
    expect(cover.version).toBe(DESIGN_VERSION)
    expect(normalizeDesign(JSON.parse(JSON.stringify(cover))).elements.filter((e) => e.name.endsWith("Swoosh"))).toHaveLength(2)
  })
})

describe("FHI Global Property news templates", () => {
  const named = <T,>(d: { elements: { name: string }[] }, name: string) => d.elements.find((e) => e.name === name) as T

  it("Template 1 (post 6pm): 1152 × 1408 navy, logo + headline on top, photo filling the bottom 933 px", async () => {
    const { buildFhiPortraitNews } = await import("@/lib/design/templates")
    const d = buildFhiPortraitNews({ headline: "AI Freej Gardener: Sustainable Home Landscaping Scheme Launched" })
    expect([d.width, d.height, d.background, d.templateId]).toEqual([1152, 1408, "#002D5C", "fhi-portrait-news"])
    expect(named<ImageElement>(d, "Photo")).toMatchObject({ role: "background", x: 0, y: 475, width: 1152, height: 933, fit: "cover" })
    expect(named<ShapeElement>(d, "Photo Frame")).toMatchObject({ x: 0, y: 475, width: 1152, height: 933, fill: { type: "solid", color: "#D9D9D9" } })
    expect(named<ImageElement>(d, "FHI Global Logo")).toMatchObject({ src: "/brand/news/fhi-global-logo.png", x: 74, y: 44, width: 231, height: 85, fit: "contain" })
    expect(named<TextElement>(d, "Headline")).toMatchObject({ role: "title", fontFamily: "Outfit", fontWeight: 700, fontSize: 55, lineHeight: 65, x: 71, y: 180, width: 1008, align: "left", fill: "#FFFFFF" })
    expect(named<TextElement>(d, "Website")).toMatchObject({ text: "www.fhiglobal.ae", fontWeight: 300, fontSize: 35, x: 74, y: 399 })
    expect(coverTitle(d)).toBe("AI Freej Gardener: Sustainable Home Landscaping Scheme Launched")
  })

  it("Template 2 (post): 1742 × 1436, photo under a navy fade, shadowed logo, centered headline", async () => {
    const { buildFhiWideNews } = await import("@/lib/design/templates")
    const d = buildFhiWideNews({ headline: "A Visual Journey Inside the Massive Indoor Snow Sanctuary Hidden in the Desert" })
    expect([d.width, d.height, d.templateId]).toEqual([1742, 1436, "fhi-wide-news"])
    expect(named<ImageElement>(d, "Photo")).toMatchObject({ role: "background", x: 0, y: 0, width: 1742, height: 1422, fit: "cover" })
    expect(named<ShapeElement>(d, "Bottom Fade")).toMatchObject({
      y: 728,
      height: 712,
      fill: { type: "linear", angle: 0, stops: [{ offset: 0, color: "#002D5C" }, { offset: 1, color: "rgba(0, 45, 92, 0)" }] },
    })
    expect(named<ImageElement>(d, "FHI Global Logo")).toMatchObject({ x: 106, y: 48, width: 340, height: 125, shadow: { enabled: true, color: "#000000", blur: 4, offsetY: 4 } })
    expect(named<TextElement>(d, "Headline")).toMatchObject({ fontWeight: 800, fontSize: 70, lineHeight: 80, align: "center", width: 1497 })
    expect(named<TextElement>(d, "Website")).toMatchObject({ text: "www.fhiglobal.ae", fontSize: 50, align: "center", y: 1341 })
    // Order: photo, fade, then logo and text on top.
    const order = d.elements.map((e) => e.name)
    expect(order.indexOf("Photo")).toBeLessThan(order.indexOf("Bottom Fade"))
    expect(order.indexOf("Bottom Fade")).toBeLessThan(order.indexOf("Headline"))
  })

  it("the wide headline grows upwards: two lines sit at y 1142, above the website", async () => {
    const { buildFhiWideNews } = await import("@/lib/design/templates")
    const d = buildFhiWideNews({ headline: "Two lines" })
    const twoLines = applyTextStack(d, (el) => (el.type === "text" && el.role === "title" ? 160 : measure(el)))
    expect((twoLines.elements.find((e) => e.name === "Headline") as TextElement).y).toBe(1142)
    const threeLines = applyTextStack(d, (el) => (el.type === "text" && el.role === "title" ? 240 : measure(el)))
    expect((threeLines.elements.find((e) => e.name === "Headline") as TextElement).y).toBe(1062)
  })

  it("non-square sizes survive saving and loading; the news registry knows every template", async () => {
    const { buildFhiPortraitNews, buildFhiWideNews } = await import("@/lib/design/templates")
    const { NEWS_TEMPLATES, NEWS_TIMES, newsBrandOf, newsFileName, newsTemplatesFor, newsTimeLabel, newsTimesFor } = await import("@/lib/design/news-templates")
    for (const d of [buildFhiPortraitNews(), buildFhiWideNews()]) {
      const back = normalizeDesign(JSON.parse(JSON.stringify(d)))
      expect([back.width, back.height]).toEqual([d.width, d.height])
    }
    expect(NEWS_TEMPLATES.map((t) => `${t.id}:${t.width}x${t.height}`)).toEqual([
      "pickleplay-news:1408x1408",
      "fhi-portrait-news:1152x1408",
      "fhi-wide-news:1742x1436",
      "caraga-news:1408x1408",
    ])
    expect(NEWS_TEMPLATES.every((t) => t.build().width === t.width && t.build().height === t.height && t.id.endsWith("-news"))).toBe(true)
    expect(newsTemplatesFor("fhi").map((t) => t.id)).toEqual(["fhi-portrait-news", "fhi-wide-news"])
    expect(newsBrandOf(buildFhiWideNews())).toBe("fhi")
    expect(newsBrandOf({ templateId: "pickleplay-news" })).toBe("pickleplay")
    expect(NEWS_TIMES.map((t) => t.label)).toEqual(["9 AM", "11 AM", "3 PM", "7 PM", "10 PM"])
    // Homes.ph CARAGA: its own times, and file names without ":" (not allowed on Windows).
    expect(newsTimesFor("caraga").map((t) => t.label)).toEqual(["11 AM", "1:30 PM", "6 PM", "8 PM", "10 PM"])
    expect(newsTimesFor("fhi")).toBe(NEWS_TIMES)
    expect(newsTimeLabel("13:30")).toBe("1:30 PM")
    expect(newsTimeLabel("16:00")).toBe("4 PM")
    expect(newsFileName(new Date(2026, 10, 1), newsTimesFor("caraga")[1], "Homes.ph CARAGA")).toBe("2026-11-01 1.30PM Homes.ph CARAGA.png")
    expect(newsFileName(new Date(2026, 10, 1), NEWS_TIMES[2], "FHI Global Property")).toBe("2026-11-01 3PM FHI Global Property.png")
  })

  it("Homes.ph CARAGA news: Figma boxes on Homes.ph blue, photo framed in the rounded card, white H", async () => {
    const { buildCaragaNews } = await import("@/lib/design/templates")
    const { newsBrandOf } = await import("@/lib/design/news-templates")
    const d = buildCaragaNews({ headline: "Radisson RED Cebu Makes Historic Debut" })
    expect([d.width, d.height, d.background, d.templateId]).toEqual([1408, 1408, "#1428AE", "caraga-news"])
    expect(newsBrandOf(d)).toBe("caraga")
    const byName = (name: string) => d.elements.find((e) => e.name === name)!
    expect(byName("Photo")).toMatchObject({ role: "background", x: 87, y: 188, width: 1234, height: 808, cornerRadius: 30, fit: "cover" })
    expect(byName("Headline")).toMatchObject({ text: "Radisson RED Cebu Makes Historic Debut", fontSize: 76, fontWeight: 600, lineHeight: 90, align: "center" })
    expect(byName("Homes.ph Logo")).toMatchObject({ src: "/brand/homes-ph-logo-white.png" })
    expect((byName("Website") as TextElement).text).toBe("www.homes.ph")
    expect((byName("Facebook") as TextElement).text).toBe("facebook.com/homesphofficial")
    const back = normalizeDesign(JSON.parse(JSON.stringify(d)))
    expect(back.templateId).toBe("caraga-news")
  })
})
