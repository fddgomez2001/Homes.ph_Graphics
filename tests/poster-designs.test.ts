import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { applyNewsChange, newsHeadline, newsPhotoFrame, newsSubtext, newsSubtextLook, newsSubtextState } from "@/lib/data/news"
import { getNewsTemplate, isPosterTemplate, newsBrandOf, posterLayoutOf, posterTemplateId } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildDesignPoster, DESIGN_ART, DESIGN_THUMB, designSizes, designTemplateId, isDesignPoster, POSTER_DESIGN_COUNT, posterDesignOf, splitSubtext } from "@/lib/design/poster-designs"
import { applyTitleFit } from "@/lib/design/title-fit"
import type { ImageElement, SlideDesign, TextElement } from "@/lib/design/types"

const PHOTO = { src: "https://res.cloudinary.com/x/image/upload/v1/bini.jpg", naturalWidth: 1600, naturalHeight: 2000 }
const text = (d: SlideDesign, name: string) => d.elements.find((e): e is TextElement => e.type === "text" && e.name === name)!
const image = (d: SlideDesign, name: string) => d.elements.find((e): e is ImageElement => e.type === "image" && e.name === name)

describe("Homes.ph poster designs 1–10 (1.51)", () => {
  it("are Homes.ph (and Gensan page) posters, 1126 × 1408, with their art and previews in the app", () => {
    expect(POSTER_DESIGN_COUNT).toBe(10)
    for (let n = 1; n <= 10; n++) {
      for (const brand of ["homes", "gensan"] as const) {
        const id = designTemplateId(brand, n)
        const t = getNewsTemplate(id)!
        expect(t).toMatchObject({ brand, width: 1126, height: 1408, name: `Design ${n}` })
        const d = t.build()
        expect([d.width, d.height, d.templateId, newsBrandOf(d)]).toEqual([1126, 1408, id, brand])
        expect(isPosterTemplate(id) && isDesignPoster(id) && posterDesignOf(id) === n && posterLayoutOf(id) === "portrait").toBe(true)
      }
      for (const file of [DESIGN_ART(n), DESIGN_THUMB(n)]) expect(fs.existsSync(path.join(__dirname, "..", "public", file))).toBe(true)
    }
    expect(fs.existsSync(path.join(__dirname, "..", "public", "brand/poster/designs/design-6-under.webp"))).toBe(true)
    expect(posterTemplateId("homes", "news", "portrait", 3)).toBe("homes-d3-poster-news")
    expect(posterTemplateId("gensan", "news", "portrait", 3)).toBe("gensan-d3-poster-news")
    // Not for other brands, or event posters.
    expect(posterTemplateId("fhi", "news", "portrait", 3)).toBe("fhi-portrait-poster-news")
    expect(isDesignPoster("homes-portrait-poster-news")).toBe(false)
  })

  it("the photo fills the poster under the design's art (Template 6: a card over its blurred copy); the photo can be replaced and moved", () => {
    const d1 = applyNewsChange(buildDesignPoster(1, "homes-d1-poster-news"), { photo: PHOTO })
    expect(image(d1, "Photo")).toMatchObject({ x: 0, y: 0, width: 1126, height: 1408, src: PHOTO.src, fit: "cover", locked: true })
    expect(image(d1, "Design Art")).toMatchObject({ role: "overlay", src: DESIGN_ART(1), locked: true })
    // The art is drawn over the photo, the text over the art.
    const order = d1.elements.map((e) => e.name)
    expect(order.indexOf("Photo") < order.indexOf("Design Art") && order.indexOf("Design Art") < order.indexOf("Headline")).toBe(true)
    expect(newsPhotoFrame(d1)).toMatchObject({ src: PHOTO.src, box: { x: 0, y: 0, width: 1126, height: 1408 } })
    const moved = applyNewsChange(d1, { photoFrame: { zoom: 1.4, focusX: 0.3, focusY: 0.2 } })
    expect(image(moved, "Photo")).toMatchObject({ zoom: 1.4, focusX: 0.3, focusY: 0.2 })

    const d6 = applyNewsChange(buildDesignPoster(6, "homes-d6-poster-news"), { photo: PHOTO })
    expect(image(d6, "Photo")).toMatchObject({ x: 48.2, y: 190.4, width: 1029, cornerRadius: 35, src: PHOTO.src })
    expect(image(d6, "Photo Backdrop")).toMatchObject({ width: 1126, height: 1408, src: PHOTO.src, blurred: true })
    // Saved and read back: the blurred backdrop stays.
    expect(image(normalizeDesign(JSON.parse(JSON.stringify(d6))), "Photo Backdrop")?.blurred).toBe(true)
  })

  it("the headline is ONE line: it shrinks to fit the width, on the design's baseline", () => {
    const d = applyNewsChange(buildDesignPoster(1, "homes-d1-poster-news"), { headline: "Bini Wins Favorite Global Music Star At The Kids' Choice Awards" })
    const h = text(d, "Headline")
    expect(h).toMatchObject({ fontFamily: "Poppins", fontWeight: 900, fontSize: 82, textCase: "upper" })
    expect(h.autoFit).toMatchObject({ maxSize: 82, maxWidth: h.width, anchor: { baseline: 1157.1, ratio: 0.85 } })
    // A measure that makes it twice the width at 82 px: it fits at 41 px, its top moved down to keep the baseline.
    const fitted = text(applyTitleFit(d, (el) => (el.fontSize / 82) * h.width * 2), "Headline")
    expect(fitted.fontSize).toBe(41)
    expect(fitted.y + 0.85 * fitted.fontSize).toBeCloseTo(1157.1, 1)
  })

  it("the subtext is TWO lines: as typed with Enter, else split for their sizes; its gold words typed or automatic", () => {
    let d = buildDesignPoster(1, "homes-d1-poster-news")
    d = applyNewsChange(d, { subtext: "Wins Favorite Global Music Star\nat the Nickelodeon Kids' Choice Awards 2026.", subtextHook: "Nickelodeon Kids' Choice Awards 2026" })
    expect([text(d, "Subtext").text, text(d, "Subtext Line 2").text]).toEqual(["Wins Favorite Global Music Star", "at the Nickelodeon Kids' Choice Awards 2026."])
    expect(text(d, "Subtext").visible && text(d, "Subtext Line 2").visible).toBe(true)
    expect(text(d, "Subtext Line 2").highlight).toEqual({ phrases: ["Nickelodeon Kids' Choice Awards 2026"], fill: "#EEA023" })
    expect(newsSubtextState(d)).toEqual({ text: "Wins Favorite Global Music Star\nat the Nickelodeon Kids' Choice Awards 2026.", on: true })
    expect(newsSubtext(d)).toBe("Wins Favorite Global Music Star at the Nickelodeon Kids' Choice Awards 2026.")
    expect(newsSubtextLook(d)).toEqual({ style: "classic", hook: "Nickelodeon Kids' Choice Awards 2026" })
    // Typed on one line: split at the word that keeps the widest line narrowest.
    expect(splitSubtext("Steps Into the Iconic Role of James Bond", { sub1: 46, sub2: 46 })).toEqual(["Steps Into the Iconic", "Role of James Bond"])
    expect(splitSubtext("A B", { sub1: 82, sub2: null })).toEqual(["A B", ""])
    // Each line is one line too.
    expect(text(d, "Subtext").autoFit).toMatchObject({ maxSize: designSizes(1)!.sub1, anchor: { baseline: 1237 } })
    // One line given: line 2 hidden; turned off: both hidden (the text kept).
    const one = applyNewsChange(d, { subtext: "Wins Favorite Global Music Star\n" })
    expect([text(one, "Subtext").visible, text(one, "Subtext Line 2").visible]).toEqual([true, false])
    const off = applyNewsChange(d, { subtextOn: false })
    expect([text(off, "Subtext").visible, text(off, "Subtext Line 2").visible, newsSubtextState(off)?.on]).toEqual([false, false, false])
    // Template 10: one subtext line.
    const t10 = applyNewsChange(buildDesignPoster(10, "homes-d10-poster-news"), { subtext: "Of Santa Barbara\nextra words" })
    expect(text(t10, "Subtext").text).toBe("Of Santa Barbara extra words")
    expect(t10.elements.some((e) => e.name === "Subtext Line 2")).toBe(false)
  })

  it("switching designs, or to the New Template and back, keeps the headline, subtext, gold words and photo", () => {
    let d = applyNewsChange(buildDesignPoster(2, "homes-d2-poster-news"), { headline: "SB19", photo: PHOTO, subtext: 'SB19 to Perform "Together in Motion"\nat the ASEAN Closing Ceremony', subtextHook: "Together in Motion, ASEAN Closing Ceremony" })
    d = applyNewsChange(d, { templateId: "homes-d7-poster-news" })
    expect(d.templateId).toBe("homes-d7-poster-news")
    expect(newsHeadline(d)).toBe("SB19")
    expect(newsSubtextState(d)?.text).toBe('SB19 to Perform "Together in Motion"\nat the ASEAN Closing Ceremony')
    expect(text(d, "Subtext").highlight?.phrases).toEqual(["Together in Motion", "ASEAN Closing Ceremony"])
    expect(image(d, "Photo")?.src).toBe(PHOTO.src)
    const classic = applyNewsChange(d, { templateId: "homes-portrait-poster-news" })
    expect(newsSubtextState(classic)?.text).toBe('SB19 to Perform "Together in Motion" at the ASEAN Closing Ceremony')
    const back = applyNewsChange(classic, { templateId: "homes-d1-poster-news" })
    expect(newsHeadline(back)).toBe("SB19")
    expect(newsSubtextState(back)?.on).toBe(true)
  })
})
