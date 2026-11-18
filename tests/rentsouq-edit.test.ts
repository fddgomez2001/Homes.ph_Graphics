import { describe, expect, it } from "vitest"
import { carryLayout, fromLookDesign, lookDesign } from "@/components/posters/poster-shared"
import { applyNewsChange, newsHeadline, newsPhotoFrame, newsSubtextState, syncPosterContent } from "@/lib/data/news"
import { posterTemplateId, rentsouqTemplateId } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildFhiPortraitPoster } from "@/lib/design/templates"
import type { SlideDesign, TextElement } from "@/lib/design/types"

const PHOTO = { src: "https://res.cloudinary.com/x/image/upload/v1/resort.jpg", naturalWidth: 2000, naturalHeight: 1400 }
const named = (d: SlideDesign, name: string) => d.elements.find((e) => e.name === name)!
const headline = (d: SlideDesign) => named(d, "Headline") as TextElement

/** An FHI poster as the Poster Maker saves it: headline, subtext, a photo. */
const poster = () =>
  applyNewsChange(buildFhiPortraitPoster(), {
    headline: "1,500-Room Resort Hits Milestone",
    highlight: ["Hits Milestone"],
    subtext: "Planned opening in early 2029",
    photo: PHOTO,
    photoFrame: { zoom: 1.35, focusX: 0.4, focusY: 0.6 },
  })

/** The headline made bigger in the editor (its size, and the box it fits). */
const bigger = (d: SlideDesign, size = 96): SlideDesign => ({
  ...d,
  elements: d.elements.map((e) => (e.type === "text" && e.role === "title" ? { ...e, fontSize: size, lineHeight: Math.round(size * 1.05), boxFit: e.boxFit ? { ...e.boxFit, maxSize: size, growTo: size } : e.boxFit } : e)),
})

describe("the Rentsouq.ae preview follows the editor (1.49)", () => {
  it("a size changed in the editor on the FHI poster shows on its Rentsouq.ae version; the logo and footer stay Rentsouq.ae's", () => {
    const edited = bigger(poster())
    const card = named(edited, "Photo")
    const moved: SlideDesign = { ...edited, elements: edited.elements.map((e) => (e.name === "Photo" || e.name === "Photo Frame" ? { ...e, y: card.y + 20 } : e)) }
    const look = lookDesign(moved, "rentsouq")
    expect(look.templateId).toBe(rentsouqTemplateId("portrait"))
    expect(headline(look)).toMatchObject({ fontSize: 96, lineHeight: 101, boxFit: expect.objectContaining({ maxSize: 96, growTo: 96 }) })
    expect(named(look, "Photo").y).toBe(card.y + 20)
    // The headline and subtext still share their space (the stack and the fit point at the Rentsouq.ae parts).
    const sub = named(look, "Subtext")
    expect(headline(look).boxFit?.shareWith?.id).toBe(sub.id)
    expect(look.stack?.items.map((i) => i.id)).toEqual([headline(look).id, sub.id])
    // Not FHI's logo or footer.
    expect(look.elements.some((e) => e.name === "Rentsouq Logo")).toBe(true)
    expect(look.elements.some((e) => e.name === "FHI Global Logo")).toBe(false)
    expect((named(look, "Website") as TextElement).text).toBe("www.rentsouq.ae")
    // The text and photo are the poster's.
    expect(newsHeadline(look)).toBe("1,500-Room Resort Hits Milestone")
    expect(newsPhotoFrame(look)).toMatchObject({ src: PHOTO.src, zoom: 1.35, focusX: 0.4, focusY: 0.6 })
  })

  it("another size of template (FHI New, Rentsouq.ae Old) isn't laid out from the poster", () => {
    const square = applyNewsChange(bigger(poster()), { rentsouqLayout: "square" })
    const look = lookDesign(square, "rentsouq")
    expect(look.templateId).toBe(rentsouqTemplateId("square"))
    expect(headline(look).fontSize).not.toBe(96)
    expect(carryLayout(square, look)).toBe(look)
  })
})

describe("the Rentsouq.ae version can be edited in the editor (1.49)", () => {
  it("its own sizes are kept for it; the text and photo changed there go to the FHI poster, which keeps its own sizes", () => {
    const fhi = poster()
    const fhiSize = headline(fhi).fontSize
    // Opened from the Rentsouq.ae tab: the editor shows the Rentsouq.ae version; there the headline is made bigger and changed.
    const inEditor = bigger(lookDesign(fhi, "rentsouq"), 104)
    const changed = applyNewsChange(inEditor, { headline: "1,500-Room Dubai Resort Hits Milestone", subtext: "Opening in early 2029" })
    const saved = fromLookDesign(fhi, changed)
    // The FHI poster: the new text, its own size, its own template, the Rentsouq.ae version inside.
    expect(saved.templateId).toBe(posterTemplateId("fhi", "news", "portrait"))
    expect(newsHeadline(saved)).toBe("1,500-Room Dubai Resort Hits Milestone")
    expect(newsSubtextState(saved)?.text).toBe("Opening in early 2029")
    expect(headline(saved).fontSize).toBe(fhiSize)
    expect(saved.rentsouqDesign?.templateId).toBe(rentsouqTemplateId("portrait"))
    expect(saved.rentsouqDesign?.rentsouqDesign ?? null).toBeNull()
    // The Rentsouq.ae tab shows it as edited.
    const again = lookDesign(saved, "rentsouq")
    expect(headline(again).fontSize).toBe(104)
    expect(newsHeadline(again)).toBe("1,500-Room Dubai Resort Hits Milestone")
    // A headline typed later in the Poster Maker (on the FHI poster) shows on it too, at its own size.
    const typed = applyNewsChange(saved, { headline: "Dubai Resort Hits Milestone" })
    expect(newsHeadline(lookDesign(typed, "rentsouq"))).toBe("Dubai Resort Hits Milestone")
    expect(headline(lookDesign(typed, "rentsouq")).fontSize).toBe(104)
    // The FHI tab is never the Rentsouq.ae version.
    expect(lookDesign(typed, null)).toBe(typed)
  })

  it("a new photo on the poster goes to its Rentsouq.ae version; the same photo leaves its card alone", () => {
    const saved = fromLookDesign(poster(), bigger(lookDesign(poster(), "rentsouq"), 100))
    const photo = { src: "https://res.cloudinary.com/x/image/upload/v2/other.jpg", naturalWidth: 1600, naturalHeight: 1200 }
    const withNew = applyNewsChange(saved, { photo, photoFrame: { zoom: 1, focusX: 0.5, focusY: 0.5 } })
    expect(newsPhotoFrame(lookDesign(withNew, "rentsouq"))?.src).toBe(photo.src)
    const same = syncPosterContent(saved.rentsouqDesign!, saved)
    expect(newsPhotoFrame(same)).toMatchObject({ src: PHOTO.src, zoom: 1.35 })
  })

  it("is kept when the poster is opened again (saved and read back) and when FHI switches New ↔ Old", () => {
    const saved = fromLookDesign(poster(), bigger(lookDesign(poster(), "rentsouq"), 100))
    const read = normalizeDesign(JSON.parse(JSON.stringify(saved)))
    expect(headline(read.rentsouqDesign!).fontSize).toBe(100)
    expect(read.rentsouqDesign?.rentsouqDesign ?? null).toBeNull()
    expect(normalizeDesign(JSON.parse(JSON.stringify(read)))).toEqual(read)
    const old = applyNewsChange(saved, { templateId: posterTemplateId("fhi", "news", "square") })
    expect(old.rentsouqDesign?.templateId).toBe(rentsouqTemplateId("portrait"))
    expect(headline(lookDesign(old, "rentsouq")).fontSize).toBe(100)
    // Its Old Template is another design: built fresh.
    expect(lookDesign(applyNewsChange(saved, { rentsouqLayout: "square" }), "rentsouq").templateId).toBe(rentsouqTemplateId("square"))
  })
})
