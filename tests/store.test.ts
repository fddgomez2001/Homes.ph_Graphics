import { describe, expect, it } from "vitest"
import { createEditorStore } from "@/components/editor/store"
import type { MeasureText } from "@/lib/design/layout"
import { buildCardDesign, buildCoverDesign, DEFAULT_TEMPLATE_CONTEXT, imageElement } from "@/lib/design/templates"
import type { ImageElement } from "@/lib/design/types"

const measure: MeasureText = (el) => el.lineHeight * Math.max(1, Math.ceil(el.text.length / Math.max(1, el.width / (el.fontSize * 0.55))))

function makeStore() {
  return createEditorStore({
    project: { id: "p1", title: "Test", topic: null, caption: "", scheduled_at: null, status: "draft" },
    slides: [{ id: crypto.randomUUID(), type: "cover", design: buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT) }],
    revision: 3,
    templateContext: DEFAULT_TEMPLATE_CONTEXT,
    measure,
  })
}

describe("editor store: slides", () => {
  it("keeps the cover first and undeletable", () => {
    const store = makeStore()
    const s = store.getState()
    const coverId = s.slides[0].id
    const a = s.addSlide(buildCardDesign())
    const b = store.getState().addSlide(buildCardDesign())
    store.getState().deleteSlide(coverId)
    expect(store.getState().slides[0].id).toBe(coverId)
    store.getState().moveSlide(b, 0) // can't go before the cover
    expect(store.getState().slides.map((x) => x.id)).toEqual([coverId, b, a])
    expect(store.getState().slides.map((x) => x.type)).toEqual(["cover", "card", "card"])
    store.getState().deleteSlide(a)
    expect(store.getState().slides.map((x) => x.id)).toEqual([coverId, b])
  })

  it("duplicating the cover makes a card right after it", () => {
    const store = makeStore()
    const coverId = store.getState().slides[0].id
    store.getState().duplicateSlide(coverId)
    const slides = store.getState().slides
    expect(slides).toHaveLength(2)
    expect(slides[0].type).toBe("cover")
    expect(slides[1].type).toBe("card")
    expect(slides[1].design.elements.map((e) => e.id)).not.toContain(slides[0].design.elements[0].id)
  })
})

describe("editor store: history", () => {
  it("undo/redo restores slides and coalesces continuous edits", () => {
    const store = makeStore()
    const headline = store.getState().slides[0].design.elements.find((e) => e.role === "headline")!
    store.getState().updateElement(headline.id, { opacity: 0.9 }, { history: "slider" })
    store.getState().updateElement(headline.id, { opacity: 0.8 }, { history: "slider" })
    store.getState().updateElement(headline.id, { opacity: 0.7 }, { history: "slider" })
    expect(store.getState().past).toHaveLength(1)
    store.getState().undo()
    expect(store.getState().slides[0].design.elements.find((e) => e.id === headline.id)!.opacity).toBe(1)
    store.getState().redo()
    expect(store.getState().slides[0].design.elements.find((e) => e.id === headline.id)!.opacity).toBe(0.7)
  })

  it("every change bumps the version that autosave watches", () => {
    const store = makeStore()
    const v0 = store.getState().changeVersion
    store.getState().setMeta({ caption: "Hi" })
    expect(store.getState().changeVersion).toBe(v0 + 1)
    expect(store.getState().dirtyMeta.caption).toBe(v0 + 1)
    store.getState().markSaved(4, v0 + 1)
    expect(store.getState().dirtyMeta).toEqual({})
    expect(store.getState().revision).toBe(4)
  })

  it("edits during a save stay dirty", () => {
    const store = makeStore()
    store.getState().setMeta({ title: "A" })
    const savingVersion = store.getState().changeVersion
    store.getState().setMeta({ title: "B" }) // typed while the request was in flight
    store.getState().markSaved(4, savingVersion)
    expect(store.getState().changeVersion).toBeGreaterThan(store.getState().savedVersion)
    expect(store.getState().dirtyMeta.title).toBeDefined()
  })
})

describe("editor store: uploads", () => {
  it("swaps the temporary local image for the Cloudinary original everywhere, including undo history", () => {
    const store = makeStore()
    const img = imageElement({ name: "Photo", src: "blob:local-1", uploadId: "u1", naturalWidth: 4000, naturalHeight: 3000, width: 400, height: 300 })
    store.getState().addElement(img)
    store.getState().updateElement(img.id, { x: 10 })
    store.getState().resolveUpload("u1", { src: "https://res.cloudinary.com/demo/image/upload/v1/x.jpg", assetId: "a1", publicId: "x" })
    const find = () => store.getState().slides[0].design.elements.find((e) => e.id === img.id) as ImageElement | undefined
    expect(find()).toMatchObject({ src: "https://res.cloudinary.com/demo/image/upload/v1/x.jpg", uploadId: null, publicId: "x" })
    store.getState().undo()
    expect(find()?.src).toBe("https://res.cloudinary.com/demo/image/upload/v1/x.jpg")
  })
})

describe("editor store: auto-arrange", () => {
  it("dragging a stacked text box vertically turns auto-arrange off; resizing doesn't", () => {
    const store = makeStore()
    const desc = store.getState().slides[0].design.elements.find((e) => e.role === "description")!
    store.getState().updateElement(desc.id, { y: desc.y - 1 + 1, width: 900 })
    expect(store.getState().slides[0].design.stack?.enabled).toBe(true)
    store.getState().updateElement(desc.id, { y: 400 }, { manualMove: true })
    expect(store.getState().slides[0].design.stack?.enabled).toBe(false)
  })
})

describe("editor store: title follows the cover", () => {
  it("sets the carousel title to Headline 1 + Headline 2 and keeps it in sync", () => {
    const store = createEditorStore({
      project: { id: "p1", title: "Old title", topic: null, caption: "", scheduled_at: null, status: "draft" },
      slides: [{ id: crypto.randomUUID(), type: "cover", design: buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT, { white: "Every Sound", yellow: "Carries A Story." }) }],
      revision: 1,
      templateContext: DEFAULT_TEMPLATE_CONTEXT,
      measure,
    })
    expect(store.getState().project.title).toBe("Every Sound Carries A Story.")
    expect(store.getState().dirtyMeta.title).toBeDefined()

    const headline = store.getState().slides[0].design.elements.find((e) => e.role === "headline")!
    store.getState().updateElement(headline.id, { text: "Every Song" })
    expect(store.getState().project.title).toBe("Every Song Carries A Story.")
    store.getState().undo()
    expect(store.getState().project.title).toBe("Every Sound Carries A Story.")
    store.getState().redo()
    expect(store.getState().project.title).toBe("Every Song Carries A Story.")
  })
})
