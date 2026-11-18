import { shortId } from "@/lib/utils"
import { COLLAGE_LAYOUTS } from "./cover-collage-data"
import { CANVAS_SIZE, type DesignElement, type ImageElement, type PhotoSlot, type SlideDesign } from "./types"

/**
 * Cover photo collage: instead of one background photo, the cover shows several photos in the
 * shaped slots of a template (public/brand/carousel/Carousel Cover Templates). Slot N shows the
 * photo of Card N and follows it; a slot can also get its own photo. Each photo can be moved and
 * zoomed inside its slot, and the photos can be swapped or shuffled between slots.
 */

export interface CollageSlotDef {
  /** The slot's shape: SVG path in canvas px (1254 × 1254). */
  path: string
  /** The part of the canvas the photo is fitted to (the shape's box, inside the canvas). */
  box: { x: number; y: number; width: number; height: number }
  /** Shown while the slot has no photo. */
  color: string
  /** The layer under all the shapes: it shows wherever no other slot covers the canvas. */
  base?: boolean
}

export interface CollageLayout {
  id: string
  name: string
  description: string
  /** Small picture for the template picker. */
  preview: string
  /** Glowing lines drawn over the photos (null = none). */
  lines: string | null
  slots: CollageSlotDef[]
}

export { COLLAGE_LAYOUTS }

export type SlotElement = ImageElement & { slot: PhotoSlot }

const LINES_NAME = "Collage Lines"

export function getCollageLayout(id: string | null | undefined): CollageLayout | undefined {
  return id ? COLLAGE_LAYOUTS.find((l) => l.id === id) : undefined
}

export function slotDef(slot: PhotoSlot | null | undefined): CollageSlotDef | undefined {
  return slot ? getCollageLayout(slot.layout)?.slots[slot.index - 1] : undefined
}

export function isPhotoSlot(el: DesignElement | null | undefined): el is SlotElement {
  return !!el && el.type === "image" && !!el.slot
}

export function isCollageLines(el: DesignElement): boolean {
  return el.type === "image" && el.name === LINES_NAME && !!el.src?.startsWith("/brand/carousel/collage/")
}

/** The cover's photo slots, Photo 1 first. */
export function photoSlots(design: SlideDesign): SlotElement[] {
  return design.elements.filter(isPhotoSlot).sort((a, b) => a.slot.index - b.slot.index)
}

/** Collages are drawn for the 1254 × 1254 carousel cover. */
export function canUseCollage(design: Pick<SlideDesign, "width" | "height">): boolean {
  return design.width === CANVAS_SIZE && design.height === CANVAS_SIZE
}

type PhotoFields = Pick<ImageElement, "src" | "assetId" | "publicId" | "uploadId" | "naturalWidth" | "naturalHeight">

const NO_PHOTO: PhotoFields = { src: null, assetId: null, publicId: null, uploadId: null, naturalWidth: 0, naturalHeight: 0 }
const CENTERED = { zoom: 1, focusX: 0.5, focusY: 0.5 }

function photoOf(el: ImageElement | undefined): PhotoFields {
  if (!el?.src) return NO_PHOTO
  return {
    src: el.src,
    assetId: el.assetId ?? null,
    publicId: el.publicId ?? null,
    uploadId: el.uploadId ?? null,
    naturalWidth: el.naturalWidth,
    naturalHeight: el.naturalHeight,
  }
}

function newSlot(layout: CollageLayout, index: number): SlotElement {
  const def = layout.slots[index - 1]
  return {
    id: shortId(),
    type: "image",
    name: `Photo ${index}`,
    ...def.box,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    ...NO_PHOTO,
    fit: "cover",
    ...CENTERED,
    slot: { layout: layout.id, index, card: index },
  }
}

function linesElement(src: string): ImageElement {
  return {
    id: shortId(),
    type: "image",
    name: LINES_NAME,
    role: "decoration",
    x: 0,
    y: 0,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: true,
    src,
    assetId: null,
    publicId: null,
    naturalWidth: CANVAS_SIZE,
    naturalHeight: CANVAS_SIZE,
    fit: "contain",
    ...CENTERED,
  }
}

const isBackground = (el: DesignElement): el is ImageElement => el.type === "image" && el.role === "background" && !el.slot

/**
 * Puts the cover's photos in a collage layout. The single background photo is kept but hidden (it
 * comes back with removeCollage). Switching between layouts keeps what each slot number shows.
 */
export function applyCollage(design: SlideDesign, layoutId: string): SlideDesign {
  const layout = getCollageLayout(layoutId)
  if (!layout || !canUseCollage(design)) return design
  const previous = photoSlots(design)
  const rest = design.elements.filter((el) => !isPhotoSlot(el) && !isCollageLines(el)).map((el) => (isBackground(el) && el.visible ? { ...el, visible: false } : el))
  const slots = layout.slots.map((_, i) => {
    const slot = newSlot(layout, i + 1)
    const prev = previous.find((p) => p.slot.index === i + 1)
    // The shape changed, so the photo starts centered again.
    return prev ? { ...slot, id: prev.id, ...photoOf(prev), slot: { ...slot.slot, card: prev.slot.card } } : slot
  })
  const layers: DesignElement[] = layout.lines ? [...slots, linesElement(layout.lines)] : slots
  // Right above the (hidden) background photo, under the gradients, logo and text.
  const at = rest.reduce((last, el, i) => (isBackground(el) ? i + 1 : last), 0)
  return { ...design, collage: layout.id, elements: [...rest.slice(0, at), ...layers, ...rest.slice(at)] }
}

/** Back to one background photo. A cover that never had one gets the first slot's photo. */
export function removeCollage(design: SlideDesign): SlideDesign {
  if (!design.collage && !design.elements.some(isPhotoSlot)) return design
  const first = photoSlots(design).find((s) => s.src)
  const elements = design.elements
    .filter((el) => !isPhotoSlot(el) && !isCollageLines(el))
    .map((el) => (isBackground(el) ? { ...el, visible: true, ...(!el.src && first ? { ...photoOf(first), ...CENTERED } : {}) } : el))
  const { collage: _collage, ...rest } = design
  void _collage
  return { ...rest, elements }
}

/** Carries a cover's collage over to a rebuilt cover (another brand's template of the same slide). */
export function transferCollage(from: SlideDesign, to: SlideDesign): SlideDesign {
  if (!from.collage || !getCollageLayout(from.collage)) return to
  const kept = new Map(photoSlots(from).map((s) => [s.slot.index, s]))
  const next = applyCollage(to, from.collage)
  return {
    ...next,
    elements: next.elements.map((el) => {
      if (!isPhotoSlot(el)) return el
      const old = kept.get(el.slot.index)
      return old ? { ...el, ...photoOf(old), zoom: old.zoom, focusX: old.focusX, focusY: old.focusY, slot: { ...el.slot, card: old.slot.card } } : el
    }),
  }
}

/** A card's photo: its background photo, or else the first picture placed on it. */
export function cardPhoto(design: SlideDesign): ImageElement | undefined {
  const images = design.elements.filter((el): el is ImageElement => el.type === "image" && !!el.src && !el.slot)
  return images.find((el) => el.role === "background") ?? images.find((el) => !el.role)
}

/**
 * Keeps the cover's slots showing their cards' photos (slides[0] is the cover, slides[N] is Card N):
 * a new or replaced card photo appears in its slot, a removed one empties it. Slots with their own
 * photo are left alone. Returns the same array when nothing changed.
 */
export function syncCollagePhotos<T extends { design: SlideDesign }>(slides: T[]): T[] {
  const cover = slides[0]
  if (!cover?.design.collage) return slides
  let changed = false
  const elements = cover.design.elements.map((el) => {
    if (!isPhotoSlot(el) || el.slot.card === null) return el
    const card = slides[el.slot.card]
    const photo = photoOf(card ? cardPhoto(card.design) : undefined)
    if (el.src === photo.src && (el.uploadId ?? null) === photo.uploadId && (el.assetId ?? null) === photo.assetId) return el
    changed = true
    // Another photo starts centered; the same photo (e.g. its upload finished) keeps its place.
    return { ...el, ...photo, ...(el.src === photo.src ? {} : CENTERED) }
  })
  if (!changed) return slides
  return [{ ...cover, design: { ...cover.design, elements } }, ...slides.slice(1)]
}

type SlotContent = PhotoFields & { card: number | null }

const contentOf = (el: SlotElement): SlotContent => ({ ...photoOf(el), card: el.slot.card })

function withContents(design: SlideDesign, contents: Map<string, SlotContent>): SlideDesign {
  return {
    ...design,
    elements: design.elements.map((el) => {
      const content = isPhotoSlot(el) ? contents.get(el.id) : undefined
      if (!content || !isPhotoSlot(el)) return el
      const { card, ...photo } = content
      return { ...el, ...photo, ...CENTERED, slot: { ...el.slot, card } }
    }),
  }
}

/** Mixes the photos between the slots (each slot keeps following the card its new photo comes from). */
export function shuffleCollage(design: SlideDesign, random: () => number = Math.random): SlideDesign {
  const slots = photoSlots(design)
  if (slots.length < 2) return design
  const before = slots.map(contentOf)
  const key = (c: SlotContent) => `${c.card}|${c.src}`
  let after = before
  // A shuffle that changes nothing looks broken: try again while the order is the same.
  for (let attempt = 0; attempt < 12; attempt++) {
    after = [...before]
    for (let i = after.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[after[i], after[j]] = [after[j], after[i]]
    }
    if (after.some((c, i) => key(c) !== key(before[i]))) break
  }
  return withContents(design, new Map(slots.map((s, i) => [s.id, after[i]])))
}

/** Swaps the photos of two slots. */
export function swapSlotPhotos(design: SlideDesign, aId: string, bId: string): SlideDesign {
  const a = design.elements.find((el) => el.id === aId)
  const b = design.elements.find((el) => el.id === bId)
  if (!isPhotoSlot(a) || !isPhotoSlot(b) || a.id === b.id) return design
  return withContents(design, new Map([[a.id, contentOf(b)], [b.id, contentOf(a)]]))
}

/** Every slot shows the card with its own number again (Photo 1 = Card 1 …). */
export function matchCardOrder(design: SlideDesign): SlideDesign {
  return {
    ...design,
    elements: design.elements.map((el) => (isPhotoSlot(el) && el.slot.card !== el.slot.index ? { ...el, ...NO_PHOTO, ...CENTERED, slot: { ...el.slot, card: el.slot.index } } : el)),
  }
}

/** The cover's title layers: everything that isn't a photo (gradients, logo, headline, footer…). */
const isTitleLayer = (el: DesignElement) => !isPhotoSlot(el) && !isCollageLines(el) && !isBackground(el)

/** Whether the title, logo and footer are shown over the collage. */
export function collageTitleShown(design: SlideDesign): boolean {
  return design.elements.some((el) => isTitleLayer(el) && el.visible)
}

/** Shows or hides everything over the photos (a photos-only cover). */
export function setCollageTitleShown(design: SlideDesign, shown: boolean): SlideDesign {
  return { ...design, elements: design.elements.map((el) => (isTitleLayer(el) && el.visible !== shown ? { ...el, visible: shown } : el)) }
}

/** The photo the lists and previews use for a collage cover: its first slot that has one. */
export function collagePhoto(design: SlideDesign): ImageElement | undefined {
  return design.collage ? photoSlots(design).find((s) => !!s.src) : undefined
}

// ---------- drawing (browser only) ----------

const clipPaths = new Map<string, Path2D>()

/** The slot's shape in the element's own coordinates (stretched with the frame if it was resized). */
export function slotClipPath(el: Pick<ImageElement, "slot" | "width" | "height">): Path2D | null {
  const def = slotDef(el.slot)
  if (!def || !el.slot || typeof Path2D === "undefined" || typeof DOMMatrix === "undefined") return null
  const key = `${el.slot.layout}:${el.slot.index}:${el.width}:${el.height}`
  let path = clipPaths.get(key)
  if (!path) {
    path = new Path2D()
    path.addPath(new Path2D(def.path), new DOMMatrix().scaleSelf(el.width / def.box.width, el.height / def.box.height).translateSelf(-def.box.x, -def.box.y))
    if (clipPaths.size > 200) clipPaths.clear()
    clipPaths.set(key, path)
  }
  return path
}

let probe: CanvasRenderingContext2D | null = null

/** The topmost photo slot under a canvas point (e.g. where a photo was dropped). */
export function slotAt(design: SlideDesign, x: number, y: number): SlotElement | undefined {
  if (typeof document === "undefined") return undefined
  probe ??= document.createElement("canvas").getContext("2d")
  if (!probe) return undefined
  for (let i = design.elements.length - 1; i >= 0; i--) {
    const el = design.elements[i]
    if (!isPhotoSlot(el) || !el.visible) continue
    const path = slotClipPath(el)
    if (path && probe.isPointInPath(path, x - el.x, y - el.y)) return el
  }
  return undefined
}
