import { describe, expect, it } from "vitest"
import { applyNewsChange, newsCredit, newsEvent, newsHeadline, newsHighlight, newsPhotoFrame, newsSubtextLook, newsSubtextState } from "@/lib/data/news"
import { applyBoxFit } from "@/lib/design/box-fit"
import { applyTextStack, type MeasureText } from "@/lib/design/layout"
import { getNewsTemplate, isEventPosterTemplate, isPosterTemplate, newsBrandOf, POSTER_LAYOUTS, posterLayoutOf, posterTemplateId } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import {
  buildFhiPortraitPoster,
  buildHomesPortraitPoster,
  buildPickleplayPortraitEventPoster,
  buildPickleplayPortraitPoster,
  posterGeometry,
  POSTER_SUBTEXT_COLORS,
} from "@/lib/design/templates"
import type { ImageElement, ShapeElement, SlideDesign, TextElement } from "@/lib/design/types"

const byName = <T,>(d: SlideDesign, name: string) => d.elements.find((e) => e.name === name) as T
const headlineOf = (d: SlideDesign) => byName<TextElement>(d, "Headline")
const subtextOf = (d: SlideDesign) => byName<TextElement>(d, "Subtext")

/** Rough text layout: 0.5 em per character, words wrap at the width (as in the other poster tests). */
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

const BUILDS = [
  // Figma (2026-11-10): PicklePlay 139 × 139 at 494, 29 (the re-exported SVG), FHI 104 tall at left 37.48% / top 42, Homes.ph left 44.76% / top 2.63%.
  ["PicklePlay", () => buildPickleplayPortraitPoster(), "pickleplay-portrait-poster-news", "PicklePlay Logo", { x: 494, y: 29, width: 139, height: 139 }],
  ["FHI", () => buildFhiPortraitPoster(), "fhi-portrait-poster-news", "FHI Global Logo", { x: 422, y: 42, width: 282, height: 104 }],
  ["Homes.ph", () => buildHomesPortraitPoster(), "homes-portrait-poster-news", "Homes.ph Logo", { x: 504, y: 37, width: 118, height: 115 }],
  ["Homes.ph Gensan", () => buildHomesPortraitPoster(undefined, "gensan-portrait-poster-news"), "gensan-portrait-poster-news", "Homes.ph Logo", { x: 504, y: 37, width: 118, height: 115 }],
] as const

describe("Poster Maker → New Template (1126 × 1408, Figma Pickleplay_Poster / FHI_Poster / Homes_Poster)", () => {
  for (const [label, build, id, logoName, logoBox] of BUILDS) {
    it(`${label}: 1126 × 1408, the logo centered at the top, the photo 1026 × 785 at 50, 188 with its 6 px border`, () => {
      const d = build()
      expect([d.width, d.height, d.templateId]).toEqual([1126, 1408, id])
      const logo = byName<ImageElement>(d, logoName)
      expect({ x: logo.x, y: logo.y, width: logo.width, height: logo.height }).toEqual(logoBox)
      // Centered on the poster (x 563; PicklePlay's Figma box is half a pixel right of it).
      expect(Math.abs(logo.x + logo.width / 2 - 563)).toBeLessThanOrEqual(0.5)
      expect(logo.shadow).toMatchObject({ blur: 4, offsetY: 4 })
      const photo = byName<ImageElement>(d, "Photo")
      expect({ x: photo.x, y: photo.y, width: photo.width, height: photo.height, role: photo.role, blurFill: photo.blurFill, cornerRadius: photo.cornerRadius }).toEqual({
        x: 50,
        y: 188,
        width: 1026,
        height: 785,
        role: "background",
        blurFill: true,
        cornerRadius: 30,
      })
      // Figma: the card's corners are 30 px curves, the 6 px border inside it 27 px.
      const card = d.elements.find((e): e is ShapeElement => e.type === "shape" && (e.name === "Photo Card" || e.name === "Photo Frame"))!
      expect(card.cornerRadius).toBe(30)
      const border = byName<ShapeElement>(d, "Photo Border")
      expect([border.x, border.y, border.width, border.height, border.stroke?.width, border.cornerRadius]).toEqual([53, 191, 1020, 779, 6, 27])
      // Nothing is drawn past the poster's edges.
      for (const el of d.elements) expect(el.x + el.width <= 1126.5 && el.x >= -0.5).toBe(true)
    })

    it(`${label}: the headline (League Spartan 700, 68 / 68, 1026 wide) centered on its block; the credit right-aligned under the photo`, () => {
      const d = build()
      const h = headlineOf(d)
      expect([h.x, h.width, h.fontFamily, h.fontWeight, h.fontSize, h.lineHeight, h.align, h.textCase]).toEqual([50, 1026, "League Spartan", 700, 68, 68, "center", "upper"])
      // Centered on 1171.2: three lines run from 1069.2 (Figma's glyphs: 1073.8 to 1256.3).
      const laid = laidOut(d)
      const head = headlineOf(laid)
      expect(Math.abs(head.y + fakeMeasure(head) / 2 - 1171.2)).toBeLessThan(1)
      expect(1171.2 - (3 * 68) / 2).toBeCloseTo(1069.2, 5)
      const credit = byName<TextElement>(d, "Photo Credit")
      expect([credit.x + credit.width, credit.y, credit.align, credit.visible]).toEqual([1076, 978.75, "right", false])
      expect(subtextOf(d).fill).toBe(POSTER_SUBTEXT_COLORS[id])
    })

    it(`${label}: with a subtext, it ends on Figma's line (1251.7) and a 2-line headline sits 7.5 px above it`, () => {
      const d = applyNewsChange(build(), { headline: "More than 600 cyclists take on Pampanga’s dirt roads at", subtext: "November 22, 2026 | Cebu City | ₱50,000 Prize Pool" })
      const laid = laidOut(d)
      const sub = subtextOf(laid)
      const head = headlineOf(laid)
      expect([sub.x, sub.width]).toEqual([50, 1026])
      expect(sub.y + fakeMeasure(sub)).toBeCloseTo(1251.7, 0)
      expect(Math.abs(head.y + fakeMeasure(head) + 7.5 - sub.y)).toBeLessThan(1)
      // Above the footer (1350).
      expect(sub.y + fakeMeasure(sub)).toBeLessThan(1340)
    })
  }

  it("PicklePlay (the re-exported Figma): navy, its photo faded over the whole poster, the lime-to-blue gradient, the pickleball, the blue-to-lime border", () => {
    const d = buildPickleplayPortraitPoster()
    expect(d.elements.some((e) => e.name === "Poster Background Art")).toBe(false)
    expect(byName<ShapeElement>(d, "Base").fill).toEqual({ type: "solid", color: "#2D59A8" })
    const bg = byName<ImageElement>(d, "Poster Background")
    expect([bg.x, bg.y, bg.width, bg.height, bg.opacity, bg.role]).toEqual([0, 0, 1126, 1408, 0.5, "background"])
    // Figma: from (593, -505) to (550, 1307), #AFD137 at 42.79%, #0A2CAA at 100% → 181.36deg, 19.75% to 92.05%.
    const gradient = byName<ShapeElement>(d, "Brand Gradient")
    expect([gradient.width, gradient.height, gradient.opacity]).toEqual([1126, 1408, 0.7])
    expect(gradient.fill).toMatchObject({ type: "linear", angle: 181.36 })
    expect(gradient.fill.type === "linear" && gradient.fill.stops.map((s) => [s.offset, s.color])).toEqual([
      [0, "#AFD137"],
      [0.1975, "#AFD137"],
      [0.9205, "#0A2CAA"],
      [1, "#0A2CAA"],
    ])
    // The pickleball: the same 234 × 187 corner as the Old Template, at 892, 1221 (to the edges), over everything.
    const ball = byName<ImageElement>(d, "Pickleball")
    expect([ball.src, ball.x, ball.y, ball.width, ball.height]).toEqual(["/brand/poster/pickleball.png", 892, 1221, 234, 187])
    expect(d.elements.at(-1)?.name).toBe("Pickleball")
    const border = byName<ShapeElement>(d, "Photo Border")
    expect(border.stroke?.gradient?.stops.map((s) => s.color)).toEqual(["#0A2EAC", "#AFD137"])
    expect(headlineOf(d).highlight?.fill).toBe("#AED038")
    // A new photo goes in the card and behind the whole poster.
    const withPhoto = applyNewsChange(d, { photo: { src: "blob:photo", naturalWidth: 1600, naturalHeight: 900 } })
    expect(byName<ImageElement>(withPhoto, "Poster Background").src).toBe("blob:photo")
    expect(byName<ImageElement>(withPhoto, "Photo").src).toBe("blob:photo")
    expect(newsPhotoFrame(withPhoto)?.box).toMatchObject({ x: 50, y: 188, width: 1026, height: 785 })
  })

  it("PicklePlay posters made with 1.37 (the fixed background picture) get the real design when they open; text and photo stay", () => {
    const now = applyNewsChange(buildPickleplayPortraitPoster(), { headline: "Cebu Open draws 300 players", photo: { src: "blob:court", naturalWidth: 1600, naturalHeight: 900 } })
    const card = byName<ImageElement>(now, "Photo")
    // As 1.37 saved it: the art picture first, no faded photo, gradient or pickleball, the logo at y 25.
    const old: SlideDesign = {
      ...now,
      elements: [
        { ...byName<ImageElement>(now, "Poster Background"), id: "art", name: "Poster Background Art", role: "decoration", src: "/brand/news/pickleplay-poster-background-portrait.png", opacity: 1 },
        ...now.elements.filter((e) => !["Base", "Poster Background", "Brand Gradient", "Pickleball"].includes(e.name)).map((e) => (e.name === "PicklePlay Logo" ? { ...e, y: 25 } : e)),
      ],
    }
    const fixed = normalizeDesign(JSON.parse(JSON.stringify(old)))
    expect(fixed.elements.some((e) => e.name === "Poster Background Art")).toBe(false)
    expect(fixed.elements.slice(0, 3).map((e) => e.name)).toEqual(["Base", "Poster Background", "Brand Gradient"])
    expect(byName<ImageElement>(fixed, "Poster Background")).toMatchObject({ src: "blob:court", naturalWidth: 1600, opacity: 0.5, visible: true })
    expect(byName<ImageElement>(fixed, "Pickleball")).toMatchObject({ x: 892, y: 1221 })
    expect(byName<ImageElement>(fixed, "PicklePlay Logo").y).toBe(29)
    expect(byName<ImageElement>(fixed, "Photo")).toMatchObject({ src: card.src, x: 50, y: 188, cornerRadius: 30 })
    expect(newsHeadline(fixed)).toBe("Cebu Open draws 300 players")
    // Opening it again changes nothing more.
    expect(normalizeDesign(JSON.parse(JSON.stringify(fixed))).elements.map((e) => e.name)).toEqual(fixed.elements.map((e) => e.name))
    // The event poster is the same design.
    const event = buildPickleplayPortraitEventPoster()
    expect(event.elements.filter((e) => ["Base", "Poster Background", "Brand Gradient", "Pickleball"].includes(e.name))).toHaveLength(4)
  })

  it("FHI and Homes.ph: the photo faded over the whole poster under the brand gradient (the Old Template's colors, re-fitted)", () => {
    for (const d of [buildFhiPortraitPoster(), buildHomesPortraitPoster()]) {
      const bg = byName<ImageElement>(d, "Poster Background")
      expect([bg.x, bg.y, bg.width, bg.height, bg.opacity]).toEqual([0, 0, 1126, 1408, 0.5])
      const gradient = byName<ShapeElement>(d, "Brand Gradient")
      expect([gradient.width, gradient.height, gradient.opacity]).toEqual([1126, 1408, 0.7])
    }
    // Figma CSS: linear-gradient(180.33deg, #1428AE 19.22%, #0D1969 92.59%) and (0.33deg, #001F3F 3.58%, #D6B357 128.53%).
    expect(byName<ShapeElement>(buildHomesPortraitPoster(), "Brand Gradient").fill).toMatchObject({ type: "linear", angle: 180.33 })
    expect(byName<ShapeElement>(buildFhiPortraitPoster(), "Brand Gradient").fill).toMatchObject({ type: "linear", angle: 0.33 })
    expect(byName<ImageElement>(buildFhiPortraitPoster(), "FHI Global Logo").src).toBe("/brand/news/fhi-global-logo-hd.png")
  })

  it("the footers sit where Figma has them (icons 24 × 24 at y ≈ 1355)", () => {
    const icons = (d: SlideDesign) => d.elements.filter((e): e is ImageElement => e.type === "image" && e.role === "icon" && /icon/i.test(e.name)).map((e) => [e.x, e.y])
    expect(icons(buildPickleplayPortraitPoster())).toEqual([
      [241.5, 1356],
      [492.5, 1355.26],
    ])
    expect(icons(buildFhiPortraitPoster())).toEqual([
      [291, 1354.91],
      [533, 1355.26],
    ])
    expect(icons(buildHomesPortraitPoster())).toEqual([
      [251.5, 1357],
      [487.5, 1355.26],
    ])
    const footer = buildPickleplayPortraitPoster().elements.filter((e): e is TextElement => e.type === "text" && e.role === "footer")
    expect(footer.map((e) => e.text)).toEqual(["www.pickleplay.ph", "facebook.com/pickleplayofficial"])
    // Figma: the website in Inter 24 with -1 px letter spacing (its glyphs are 196.4 px wide), the Facebook line Poppins 24, -0.75.
    expect(footer.map((e) => [e.fontFamily, e.fontSize, e.letterSpacing])).toEqual([
      ["Inter", 24, -1],
      ["Poppins", 24, -0.75],
    ])
  })

  it("PicklePlay event poster on the New Template: the headline and LOCATION / DATE & TIME between the credit and the footer", () => {
    const d = buildPickleplayPortraitEventPoster({ headline: "Cebu Pickleball Open", location: "IT Park, Cebu City", when: "Nov 22, 2026 · 8 AM" })
    expect([d.width, d.height, d.templateId]).toEqual([1126, 1408, "pickleplay-portrait-event-poster-news"])
    expect(isEventPosterTemplate(d.templateId)).toBe(true)
    expect(newsEvent(d)).toEqual({ location: "IT Park, Cebu City", when: "Nov 22, 2026 · 8 AM" })
    const laid = laidOut(d)
    const lines = laid.elements.filter((e): e is TextElement => e.type === "text" && (e.name === "Event Location" || e.name === "Event Date & Time"))
    expect(lines.map((l) => [l.x, l.width])).toEqual([
      [113, 900],
      [113, 900],
    ])
    const top = headlineOf(laid).y
    const bottom = Math.max(...lines.map((l) => l.y + l.lineHeight))
    expect(top).toBeGreaterThanOrEqual(1020)
    expect(bottom).toBeLessThanOrEqual(1332.5)
    expect(subtextOf(d)).toBeUndefined()
  })
})

describe("New Template logos with and without the subtext (Figma's two frames)", () => {
  const withSub = (d: SlideDesign) => applyNewsChange(d, { subtext: "SUBTEXT SAMPLE | SUBTEXT SAMPLE" })
  const logo = (d: SlideDesign, name: string) => byName<ImageElement>(d, name)

  it("PicklePlay: y 29 (the re-exported Pickleplay_Poster), y 27 with a subtext; back to 29 when it's turned off", () => {
    const d = buildPickleplayPortraitPoster()
    expect(logo(d, "PicklePlay Logo").y).toBe(29)
    const sub = withSub(d)
    expect(logo(sub, "PicklePlay Logo").y).toBe(27)
    expect(logo(applyNewsChange(sub, { subtextOn: false }), "PicklePlay Logo").y).toBe(29)
    expect(logo(sub, "PicklePlay Logo").shadow?.enabled).toBe(true)
  })

  it("Homes.ph: the drop shadow is on the subtext frame only; FHI keeps its shadow on both", () => {
    expect(logo(buildHomesPortraitPoster(), "Homes.ph Logo").shadow?.enabled).toBe(false)
    expect(logo(withSub(buildHomesPortraitPoster()), "Homes.ph Logo").shadow?.enabled).toBe(true)
    expect(logo(withSub(buildHomesPortraitPoster(undefined, "gensan-portrait-poster-news")), "Homes.ph Logo").shadow?.enabled).toBe(true)
    expect(logo(buildFhiPortraitPoster(), "FHI Global Logo").shadow?.enabled).toBe(true)
    expect(logo(withSub(buildFhiPortraitPoster()), "FHI Global Logo")).toMatchObject({ x: 422, y: 42, width: 282, height: 104 })
  })

  it("posters saved with 1.37.0 get the update when they open (corners, logo, gradient); text and photo stay", () => {
    const now = applyNewsChange(buildFhiPortraitPoster(), { headline: "Dubai sales hit a record", photo: { src: "blob:p", naturalWidth: 1600, naturalHeight: 900 } })
    // As 1.37.0 saved it: square corners, the logo 348 × 128 at 389, 34, the gradient at 0.41deg.
    const old: SlideDesign = {
      ...now,
      elements: now.elements.map((el) =>
        el.type === "image" && el.name === "FHI Global Logo"
          ? { ...el, x: 389, y: 34, width: 348, height: 128 }
          : el.type === "image" || el.type === "shape"
            ? el.type === "shape" && el.name === "Brand Gradient" && el.fill.type === "linear"
              ? { ...el, cornerRadius: 0, fill: { ...el.fill, angle: 0.41 } }
              : { ...el, cornerRadius: 0 }
            : el,
      ),
    }
    const back = normalizeDesign(JSON.parse(JSON.stringify(old)))
    expect(logo(back, "FHI Global Logo")).toMatchObject({ x: 422, y: 42, width: 282, height: 104 })
    expect(byName<ImageElement>(back, "Photo")).toMatchObject({ cornerRadius: 30, src: "blob:p" })
    expect(byName<ShapeElement>(back, "Photo Border").cornerRadius).toBe(27)
    expect(byName<ShapeElement>(back, "Brand Gradient").fill).toMatchObject({ angle: 0.33 })
    expect(newsHeadline(back)).toBe("Dubai sales hit a record")
    // The Old Template is never touched.
    const square = getNewsTemplate("fhi-poster-news")!.build()
    expect(normalizeDesign(JSON.parse(JSON.stringify(square))).elements.map((e) => [e.name, e.x, e.y])).toEqual(square.elements.map((e) => [e.name, e.x, e.y]))
    expect(newsPhotoFrame(back)?.radius).toBe(30)
    expect(newsPhotoFrame(square)?.radius).toBe(0)
  })
})

describe("New Template ↔ Old Template", () => {
  it("each brand: the New Template is the default, the Old Template the other choice; event posters too", () => {
    expect(POSTER_LAYOUTS.map((l) => `${l.name} ${l.size}`)).toEqual(["New Template 1126 × 1408", "Old Template 1254 × 1254"])
    expect(posterTemplateId("pickleplay")).toBe("pickleplay-portrait-poster-news")
    expect(posterTemplateId("pickleplay", "news", "square")).toBe("pickleplay-poster-news")
    expect(posterTemplateId("pickleplay", "event")).toBe("pickleplay-portrait-event-poster-news")
    expect(posterTemplateId("pickleplay", "event", "square")).toBe("pickleplay-event-poster-news")
    expect(posterTemplateId("fhi")).toBe("fhi-portrait-poster-news")
    expect(posterTemplateId("fhi", "event")).toBe("fhi-portrait-poster-news")
    expect(posterTemplateId("homes", "news", "square")).toBe("homes-poster-news")
    expect(posterTemplateId("gensan")).toBe("gensan-portrait-poster-news")
    for (const id of ["pickleplay-portrait-poster-news", "fhi-portrait-poster-news", "homes-portrait-poster-news", "gensan-portrait-poster-news", "pickleplay-portrait-event-poster-news"]) {
      expect(isPosterTemplate(id)).toBe(true)
      expect(posterLayoutOf(id)).toBe("portrait")
      expect(getNewsTemplate(id)?.size).toBe("1126 × 1408")
    }
    expect(posterLayoutOf("fhi-poster-news")).toBe("square")
    expect(newsBrandOf({ templateId: "gensan-portrait-poster-news" })).toBe("gensan")
    expect(newsBrandOf({ templateId: "fhi-portrait-poster-news" })).toBe("fhi")
  })

  it("switching keeps the headline, highlight, photo (and where it was moved), credit, page, subtext and its look", () => {
    let d = applyNewsChange(getNewsTemplate("homes-poster-news")!.build(), {
      headline: "New township rises in Butuan City",
      highlight: ["Butuan City"],
      photo: { src: "blob:photo", naturalWidth: 1600, naturalHeight: 1000 },
      credit: { enabled: true, name: "Frank Gomez" },
      page: "Homes.ph Caraga",
      subtext: "300 homes | Phase 1",
      subtextStyle: "banner",
    })
    d = applyNewsChange(d, { photoFrame: { zoom: 1.4, focusX: 0.3, focusY: 0.6 } })
    const portrait = applyNewsChange(d, { templateId: "homes-portrait-poster-news" })
    expect([portrait.width, portrait.height]).toEqual([1126, 1408])
    expect(newsHeadline(portrait)).toBe("New township rises in Butuan City")
    expect(newsHighlight(portrait)).toEqual(["Butuan City"])
    expect(newsCredit(portrait)).toEqual({ enabled: true, name: "Frank Gomez" })
    expect(portrait.page).toBe("Homes.ph Caraga")
    expect(newsSubtextState(portrait)).toEqual({ text: "300 homes | Phase 1", on: true })
    expect(newsSubtextLook(portrait)?.style).toBe("banner")
    // The banner centers on the New Template's subtext box.
    expect(subtextOf(portrait).hug).toEqual({ centerX: 563, maxWidth: 1026 })
    expect(newsPhotoFrame(portrait)).toMatchObject({ src: "blob:photo", zoom: 1.4, focusX: 0.3, focusY: 0.6, box: { x: 50, y: 188, width: 1026, height: 785 } })
    // And back to the Old Template.
    const square = applyNewsChange(portrait, { templateId: "homes-poster-news" })
    expect([square.width, square.height]).toEqual([1254, 1254])
    expect(subtextOf(square).hug).toEqual({ centerX: 625.5, maxWidth: 1003 })
    expect(newsPhotoFrame(square)?.box).toEqual({ x: 125, y: 229, width: 1003, height: 661 })
  })

  it("a New Template poster survives saving and loading (size, layout, colors)", () => {
    for (const [, build] of BUILDS) {
      const d = build()
      const back = normalizeDesign(JSON.parse(JSON.stringify(d)))
      expect([back.width, back.height, back.templateId]).toEqual([1126, 1408, d.templateId])
      expect(back.stack).toEqual(d.stack)
    }
    expect(posterGeometry("fhi-portrait-poster-news").card).toEqual({ x: 50, y: 188, width: 1026, height: 785 })
    expect(posterGeometry("fhi-poster-news").card).toEqual({ x: 125, y: 229, width: 1003, height: 661 })
  })
})
