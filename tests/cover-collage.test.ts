import { describe, expect, it } from "vitest"
import { createEditorStore } from "@/components/editor/store"
import {
  applyCollage,
  COLLAGE_LAYOUTS,
  collageTitleShown,
  matchCardOrder,
  photoSlots,
  removeCollage,
  setCollageTitleShown,
  shuffleCollage,
  swapSlotPhotos,
  syncCollagePhotos,
} from "@/lib/design/cover-collage"
import type { MeasureText } from "@/lib/design/layout"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildCardDesign, buildCoverDesign, DEFAULT_TEMPLATE_CONTEXT, rebrandDesign, summarizeDesign } from "@/lib/design/templates"
import type { ImageElement, SlideDesign } from "@/lib/design/types"

const measure: MeasureText = (el) => el.lineHeight

const cover = () => buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT)

/** A content card whose background photo is `src`. */
function card(src: string | null): SlideDesign {
  const design = buildCardDesign()
  return {
    ...design,
    elements: design.elements.map((el) => (el.type === "image" && el.role === "background" ? { ...el, src, naturalWidth: src ? 1600 : 0, naturalHeight: src ? 900 : 0 } : el)),
  }
}

const sources = (design: SlideDesign) => photoSlots(design).map((s) => s.src)

function makeStore(cards: (string | null)[]) {
  return createEditorStore({
    project: { id: "p1", title: "Test", topic: null, caption: "", scheduled_at: null, status: "draft" },
    slides: [{ id: "cover", type: "cover", design: cover() }, ...cards.map((src, i) => ({ id: `card-${i + 1}`, type: "card" as const, design: card(src) }))],
    revision: 1,
    templateContext: DEFAULT_TEMPLATE_CONTEXT,
    measure,
  })
}

describe("cover collage: templates", () => {
  it("has the five templates, each with six photo slots inside the canvas", () => {
    expect(COLLAGE_LAYOUTS.map((l) => l.id)).toEqual(["collage-1", "collage-2", "collage-3", "collage-4", "collage-5"])
    for (const layout of COLLAGE_LAYOUTS) {
      expect(layout.slots).toHaveLength(6)
      for (const slot of layout.slots) {
        expect(slot.path.startsWith("M")).toBe(true)
        expect(slot.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(slot.box.x).toBeGreaterThanOrEqual(0)
        expect(slot.box.y).toBeGreaterThanOrEqual(0)
        expect(slot.box.x + slot.box.width).toBeLessThanOrEqual(1254)
        expect(slot.box.y + slot.box.height).toBeLessThanOrEqual(1254)
      }
    }
    // The swirl and pinwheel templates have glowing lines over the photos.
    expect(COLLAGE_LAYOUTS.filter((l) => l.lines).map((l) => l.id)).toEqual(["collage-2", "collage-3", "collage-4"])
  })

  it("puts the slots under the title and keeps the single photo hidden, and can go back", () => {
    const base = cover()
    const withPhoto = { ...base, elements: base.elements.map((el) => (el.role === "background" ? ({ ...el, src: "cover.jpg" } as ImageElement) : el)) }
    const collage = applyCollage(withPhoto, "collage-3")
    expect(collage.collage).toBe("collage-3")
    expect(photoSlots(collage).map((s) => [s.name, s.slot.card])).toEqual([1, 2, 3, 4, 5, 6].map((n) => [`Photo ${n}`, n]))
    const names = collage.elements.map((el) => el.name)
    expect(names.slice(0, 8)).toEqual(["Background image", "Photo 1", "Photo 2", "Photo 3", "Photo 4", "Photo 5", "Photo 6", "Collage Lines"])
    expect(collage.elements[0].visible).toBe(false)
    // Every title layer is still there, above the photos.
    expect(collage.elements.length).toBe(withPhoto.elements.length + 7)
    const back = removeCollage(collage)
    expect(back.collage).toBeUndefined()
    expect(back.elements.map((el) => el.name)).toEqual(withPhoto.elements.map((el) => el.name))
    expect(back.elements[0]).toMatchObject({ visible: true, src: "cover.jpg" })
  })

  it("keeps what each slot shows when switching templates", () => {
    const first = shuffleCollage(applyCollage(cover(), "collage-1"), () => 0.3)
    const cardsBefore = photoSlots(first).map((s) => s.slot.card)
    const second = applyCollage(first, "collage-5")
    expect(photoSlots(second).map((s) => s.slot.card)).toEqual(cardsBefore)
    expect(photoSlots(second).every((s) => s.slot.layout === "collage-5")).toBe(true)
    expect(second.elements.some((el) => el.name === "Collage Lines")).toBe(false)
  })

  it("survives saving and loading, and drops slots of unknown templates", () => {
    const design = applyCollage(cover(), "collage-2")
    const loaded = normalizeDesign(JSON.parse(JSON.stringify(design)))
    expect(loaded.collage).toBe("collage-2")
    expect(photoSlots(loaded).map((s) => s.slot)).toEqual(photoSlots(design).map((s) => s.slot))
    const unknown = JSON.parse(JSON.stringify(design).replaceAll("collage-2", "collage-99"))
    const cleaned = normalizeDesign(unknown)
    expect(cleaned.collage).toBeUndefined()
    expect(photoSlots(cleaned)).toHaveLength(0)
  })
})

describe("cover collage: photos follow the cards", () => {
  it("slot N shows card N's photo and follows it", () => {
    const store = makeStore(["a.jpg", null, "c.jpg"])
    const s = () => store.getState()
    s().updateDesign("cover", (d) => applyCollage(d, "collage-1"))
    expect(sources(s().slides[0].design)).toEqual(["a.jpg", null, "c.jpg", null, null, null])

    // Card 2 gets a photo → Photo 2 shows it.
    const bg2 = s().slides[2].design.elements.find((el) => el.role === "background")!
    s().updateElement(bg2.id, { src: "b.jpg", naturalWidth: 800, naturalHeight: 600 } as Partial<ImageElement>)
    expect(sources(s().slides[0].design)).toEqual(["a.jpg", "b.jpg", "c.jpg", null, null, null])

    // A new card 4 with a photo → Photo 4.
    s().addSlide(card("d.jpg"))
    expect(sources(s().slides[0].design)[3]).toBe("d.jpg")

    // Reordering the cards reorders the cover.
    s().moveSlide("card-3", 1)
    expect(sources(s().slides[0].design).slice(0, 3)).toEqual(["c.jpg", "a.jpg", "b.jpg"])

    // Undo brings the old order back.
    s().undo()
    expect(sources(s().slides[0].design).slice(0, 3)).toEqual(["a.jpg", "b.jpg", "c.jpg"])
  })

  it("keeps the move and zoom of a photo while its card's photo stays the same", () => {
    const store = makeStore(["a.jpg", "b.jpg"])
    const s = () => store.getState()
    s().updateDesign("cover", (d) => applyCollage(d, "collage-5"))
    const slot1 = photoSlots(s().slides[0].design)[0]
    s().updateElement(slot1.id, { zoom: 2, focusX: 0.1 } as Partial<ImageElement>)
    s().addSlide(card("c.jpg"))
    expect(photoSlots(s().slides[0].design)[0]).toMatchObject({ src: "a.jpg", zoom: 2, focusX: 0.1 })
    // Another photo on the card starts centered.
    const bg1 = s().slides[1].design.elements.find((el) => el.role === "background")!
    s().updateElement(bg1.id, { src: "new.jpg" } as Partial<ImageElement>)
    expect(photoSlots(s().slides[0].design)[0]).toMatchObject({ src: "new.jpg", zoom: 1, focusX: 0.5 })
  })

  it("leaves a slot's own photo alone", () => {
    const design = applyCollage(cover(), "collage-4")
    const own = { ...design, elements: design.elements.map((el) => (el.name === "Photo 2" ? ({ ...el, src: "own.jpg", slot: { ...(el as ImageElement).slot!, card: null } } as ImageElement) : el)) }
    const [synced] = syncCollagePhotos([{ design: own }, { design: card("a.jpg") }, { design: card("b.jpg") }])
    expect(sources(synced.design).slice(0, 3)).toEqual(["a.jpg", "own.jpg", null])
  })

  it("returns the same slides when nothing changed or there is no collage", () => {
    const plain = [{ design: cover() }, { design: card("a.jpg") }]
    expect(syncCollagePhotos(plain)).toBe(plain)
    const once = syncCollagePhotos([{ design: applyCollage(cover(), "collage-1") }, { design: card("a.jpg") }])
    expect(syncCollagePhotos(once)).toBe(once)
  })
})

describe("cover collage: arranging", () => {
  const filled = () => syncCollagePhotos([{ design: applyCollage(cover(), "collage-3") }, ...["a", "b", "c", "d", "e", "f"].map((n) => ({ design: card(`${n}.jpg`) }))])

  it("shuffles the photos between the slots and they keep following their cards", () => {
    const slides = filled()
    const shuffled = shuffleCollage(slides[0].design)
    expect(sources(shuffled)).not.toEqual(sources(slides[0].design))
    expect([...sources(shuffled)].sort()).toEqual(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"])
    // Still in sync: nothing to change.
    const again = [{ design: shuffled }, ...slides.slice(1)]
    expect(syncCollagePhotos(again)).toBe(again)
    // Card order puts them back.
    const [ordered] = syncCollagePhotos([{ design: matchCardOrder(shuffled) }, ...slides.slice(1)])
    expect(sources(ordered.design)).toEqual(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"])
  })

  it("swaps two slots", () => {
    const design = filled()[0].design
    const [one, , three] = photoSlots(design)
    const swapped = swapSlotPhotos(design, one.id, three.id)
    expect(sources(swapped).slice(0, 3)).toEqual(["c.jpg", "b.jpg", "a.jpg"])
    expect(photoSlots(swapped).slice(0, 3).map((s) => s.slot.card)).toEqual([3, 2, 1])
  })

  it("hides and shows the title layers for a photos-only cover", () => {
    const design = filled()[0].design
    expect(collageTitleShown(design)).toBe(true)
    const photosOnly = setCollageTitleShown(design, false)
    expect(collageTitleShown(photosOnly)).toBe(false)
    expect(photoSlots(photosOnly).every((s) => s.visible)).toBe(true)
    expect(photosOnly.elements.find((el) => el.name === "Collage Lines")?.visible).toBe(true)
    expect(collageTitleShown(setCollageTitleShown(photosOnly, true))).toBe(true)
  })

  it("stays when the carousel changes brand, and is listed with its first photo", () => {
    const design = filled()[0].design
    const zoomed = { ...design, elements: design.elements.map((el) => (el.name === "Photo 2" ? ({ ...el, zoom: 1.8 } as ImageElement) : el)) }
    const fhi = rebrandDesign(zoomed, "fhi", DEFAULT_TEMPLATE_CONTEXT)
    expect(fhi.templateId).toBe("fhi-cover")
    expect(fhi.collage).toBe("collage-3")
    expect(sources(fhi)).toEqual(sources(design))
    expect(photoSlots(fhi)[1].zoom).toBe(1.8)
    expect(photoSlots(fhi)).toHaveLength(6)
    expect(summarizeDesign(fhi).background_image_url).toBe("a.jpg")
  })
})
