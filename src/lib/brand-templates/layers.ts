/**
 * A brand post's layers (1.53): the template draws itself in two layers, "back" (background, photo, fades,
 * photo frames) and "front" (logo, headline, subtext, pills, footer). Layers added in the editor (pictures,
 * cut-out people, text, shapes) go under, between or over them; the post's own texts and photos ("carriers")
 * are kept in the design but drawn by the template, never as layers.
 */
import { shortId } from "@/lib/utils"
import type { DesignElement, ImageElement, SlideDesign } from "@/lib/design/types"
import { brandPostTemplate } from "./catalog"

/** What the template draws (its texts and photos), by name. */
export const CARRIER_NAMES = new Set(["Photo", "Photo 2", "Headline", "Subtext", "Photo Credit"])

export const PART_NAMES = { back: "Template: background & photo", front: "Template: text & logo" } as const

export const isTemplatePart = (el: DesignElement): el is ImageElement & { templatePart: "back" | "front" } => el.type === "image" && !!el.templatePart
export const isCarrier = (el: DesignElement) => el.carrier === true

/** A layer the person added (not the template's own). */
export const isUserLayer = (el: DesignElement) => !isCarrier(el) && !isTemplatePart(el)

const isBrandPost = (d: Pick<SlideDesign, "brandPost" | "templateId">) => !!d.brandPost && !!brandPostTemplate(d.templateId)

/** One of the template's layers, covering the post. */
export function partElement(part: "back" | "front", width: number, height: number): ImageElement {
  return {
    id: shortId(),
    type: "image",
    name: PART_NAMES[part],
    role: "decoration",
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: true,
    src: null,
    assetId: null,
    publicId: null,
    naturalWidth: width,
    naturalHeight: height,
    fit: "cover",
    zoom: 1,
    focusX: 0.5,
    focusY: 0.5,
    templatePart: part,
  }
}

/**
 * A brand post with its two template layers (posts saved before 1.53 get them: their texts and photos are then
 * marked as the template's). Any other design comes back as it is.
 */
export function withTemplateLayers(design: SlideDesign): SlideDesign {
  if (!isBrandPost(design)) return design
  const parts = design.elements.filter(isTemplatePart)
  if (parts.some((p) => p.templatePart === "back") && parts.some((p) => p.templatePart === "front")) return design
  // Before 1.53 a brand post had only its carriers.
  const carriers = design.elements.filter((e) => !isTemplatePart(e) && (e.carrier || CARRIER_NAMES.has(e.name))).map((e) => ({ ...e, carrier: true }) as DesignElement)
  const others = design.elements.filter((e) => !isTemplatePart(e) && !(e.carrier || CARRIER_NAMES.has(e.name)))
  return { ...design, elements: [...carriers, partElement("back", design.width, design.height), ...others, partElement("front", design.width, design.height)] }
}

/** The layers the person added. */
export const userLayers = (design: SlideDesign) => design.elements.filter(isUserLayer)

/** The post has layers of its own to draw with the template (then it's drawn layer by layer). */
export const hasUserLayers = (design: SlideDesign) => isBrandPost(design) && design.elements.some((e) => isUserLayer(e) && e.visible)

/** The template layers are hidden or see-through (also drawn layer by layer). */
export const partsChanged = (design: SlideDesign) => design.elements.some((e) => isTemplatePart(e) && (!e.visible || e.opacity < 1))

/**
 * The person's layers of `from` put on `to` (another template of the same size): under, between or over the
 * template's layers as they were; the template layers keep their shown / hidden state.
 */
export function carryLayers(from: SlideDesign, to: SlideDesign): SlideDesign {
  if (!isBrandPost(from) || !isBrandPost(to) || from.width !== to.width || from.height !== to.height) return to
  const src = withTemplateLayers(from)
  const dst = withTemplateLayers(to)
  const order = src.elements.filter((e) => !isCarrier(e))
  const iBack = order.findIndex((e) => isTemplatePart(e) && e.templatePart === "back")
  const iFront = order.findIndex((e) => isTemplatePart(e) && e.templatePart === "front")
  const under = order.slice(0, Math.max(0, iBack)).filter(isUserLayer)
  const between = order.slice(iBack + 1, iFront).filter(isUserLayer)
  const over = order.slice(iFront + 1).filter(isUserLayer)
  const part = (p: "back" | "front") => {
    const mine = dst.elements.find((e) => isTemplatePart(e) && e.templatePart === p) as ImageElement
    const old = order.find((e) => isTemplatePart(e) && e.templatePart === p)
    return old ? { ...mine, visible: old.visible, opacity: old.opacity } : mine
  }
  const carriers = dst.elements.filter(isCarrier)
  return { ...dst, elements: [...carriers, ...under, part("back"), ...between, part("front"), ...over] }
}
