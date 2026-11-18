/**
 * A brand post's layers. 1.54: every top-level part of the template's SVG is a layer of its own, as in the file
 * (background gradient, photo, dark fade or tint, decorations, logo, credit, headline & subtext, footer…), drawn
 * from the template; 1.53 had two ("back" and "front"). Layers added in the editor (pictures, cut-out people,
 * text, shapes) go under, between or over them; a template layer can be hidden or made see-through. The post's
 * own texts and photos ("carriers") are kept in the design but drawn by the template, never as layers.
 */
import { shortId } from "@/lib/utils"
import type { DesignElement, ImageElement, SlideDesign } from "@/lib/design/types"
import { brandPostTemplate } from "./catalog"

/** What the template draws (its texts and photos), by name. */
export const CARRIER_NAMES = new Set(["Photo", "Photo 2", "Headline", "Subtext", "Photo Credit"])

/** The template layers' names in the editor (by their id in the SVG). */
const LAYER_NAMES: Record<string, string> = {
  "layer-background": "Background (gradient)",
  "layer-split-background": "Background (bottom color)",
  "layer-photo": "Photo (with its top fade)",
  "layer-photo-background": "Photo (blurred, behind)",
  "photo-background": "Photo (blurred background)",
  "photo-frame": "Photo (in its frame)",
  "frame-border": "Photo frame border",
  "frame-accents": "Frame accents",
  "layer-overlay": "Dark fade (for the text)",
  "layer-tint": "Color tint (over the photo)",
  decor: "Decorations",
  "decor-ball": "Pickleball",
  "decor-squares": "Decoration: squares",
  "decor-stripes-top-right": "Decoration: stripes (top right)",
  "decor-stripes-bottom-left": "Decoration: stripes (bottom left)",
  "brand-logo": "Logo",
  "photo-credit": "Photo credit",
  "text-card": "Text card",
  "accent-bar": "Accent bar",
  "text-block": "Headline & subtext",
  "photo-area": "Photos (labels, answers, facts)",
  content: "Title & texts",
  footer: "Footer (website, Facebook)",
  back: "Template: background & photo",
  front: "Template: text & logo",
}

export const layerName = (id: string) => LAYER_NAMES[id] ?? id.replace(/-/g, " ")

/** Template layers that show the post's photo(s): their panel has the photo's filters and tools. */
const PHOTO_LAYERS = new Set(["layer-photo", "layer-photo-background", "photo-background", "photo-frame", "photo-area"])
export const isPhotoLayer = (id: string | null | undefined) => !!id && PHOTO_LAYERS.has(id)

/** What 1.53's "front" layer held (the rest was "back"). */
const FRONT = new Set(["brand-logo", "photo-credit", "text-card", "accent-bar", "text-block", "content", "footer"])

export const isTemplatePart = (el: DesignElement): el is ImageElement & { templatePart: string } => el.type === "image" && !!el.templatePart
export const isCarrier = (el: DesignElement) => el.carrier === true

/** A layer the person added (not the template's own). */
export const isUserLayer = (el: DesignElement) => !isCarrier(el) && !isTemplatePart(el)

const isBrandPost = (d: Pick<SlideDesign, "brandPost" | "templateId">) => !!d.brandPost && !!brandPostTemplate(d.templateId)

/** The template's layer ids, bottom to top. */
export const templateLayerIds = (d: Pick<SlideDesign, "templateId">) => brandPostTemplate(d.templateId)?.info.layers ?? []

/** One of the template's layers, covering the post. */
export function partElement(part: string, width: number, height: number): ImageElement {
  return {
    id: shortId(),
    type: "image",
    name: layerName(part),
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
 * The template's layers in `ids` order with the person's layers put back where they were: each one just over the
 * template layer it was over (1.53's "back" / "front": over the last layer of that half). Template layers keep
 * their shown / hidden state and see-through.
 */
function relayer(source: DesignElement[], carriers: DesignElement[], ids: readonly string[], width: number, height: number): DesignElement[] {
  const order = source.filter((e) => !isCarrier(e))
  const parts = new Map<string, ImageElement>()
  for (const e of order) if (isTemplatePart(e)) parts.set(e.templatePart, e)
  const lastBack = [...ids].reverse().find((id) => !FRONT.has(id)) ?? ids[0]
  const lastFront = ids[ids.length - 1]
  const anchorOf = (id: string | null): string | null => {
    if (id === null) return null
    if (id === "back") return lastBack
    if (id === "front") return lastFront
    if (ids.includes(id)) return id
    // Not on this template: over the nearest one below it that is.
    const at = order.findIndex((e) => isTemplatePart(e) && e.templatePart === id)
    for (let i = at - 1; i >= 0; i--) {
      const e = order[i]
      if (isTemplatePart(e) && ids.includes(e.templatePart)) return e.templatePart
    }
    return null
  }
  const over = new Map<string | null, DesignElement[]>()
  let below: string | null = null
  for (const e of order) {
    if (isTemplatePart(e)) below = e.templatePart
    else {
      const key = anchorOf(below)
      over.set(key, [...(over.get(key) ?? []), e])
    }
  }
  const out: DesignElement[] = [...carriers, ...(over.get(null) ?? [])]
  for (const id of ids) {
    const old = parts.get(id) ?? (FRONT.has(id) ? parts.get("front") : parts.get("back"))
    const el = partElement(id, width, height)
    out.push(old ? { ...el, id: parts.get(id)?.id ?? el.id, visible: old.visible, opacity: old.opacity, locked: old.locked } : el)
    out.push(...(over.get(id) ?? []))
  }
  return out
}

/**
 * A brand post with its template's layers (posts saved before get them: 1.52's had none, 1.53's had two). Its
 * texts and photos are marked as the template's. Any other design comes back as it is.
 */
export function withTemplateLayers(design: SlideDesign): SlideDesign {
  if (!isBrandPost(design)) return design
  const ids = templateLayerIds(design)
  const parts = design.elements.filter(isTemplatePart).map((e) => e.templatePart)
  const hasCarriers = design.elements.some((e) => e.carrier)
  if (hasCarriers && parts.length === ids.length && parts.every((p, i) => p === ids[i])) return design
  const marked = !hasCarriers
  const carriers = design.elements.filter((e) => !isTemplatePart(e) && (e.carrier || (marked && CARRIER_NAMES.has(e.name)))).map((e) => ({ ...e, carrier: true }) as DesignElement)
  const carrierIds = new Set(carriers.map((e) => e.id))
  // 1.52's posts had no layers: the person's (none yet) go on top.
  const source = parts.length ? design.elements.filter((e) => !carrierIds.has(e.id)) : [partElement(ids[ids.length - 1] ?? "front", design.width, design.height), ...design.elements.filter((e) => !carrierIds.has(e.id))]
  return { ...design, elements: relayer(source, carriers, ids, design.width, design.height) }
}

/** The layers the person added. */
export const userLayers = (design: SlideDesign) => design.elements.filter(isUserLayer)

/** The post has layers of its own to draw with the template (then it's drawn layer by layer). */
export const hasUserLayers = (design: SlideDesign) => isBrandPost(design) && design.elements.some((e) => isUserLayer(e) && e.visible)

/** A template layer is hidden or see-through (also drawn layer by layer). */
export const partsChanged = (design: SlideDesign) => design.elements.some((e) => isTemplatePart(e) && (!e.visible || e.opacity < 1))

/**
 * The person's layers of `from` put on `to` (another template of the same size): each over the template layer it
 * was over (or the nearest one the new template has), the template layers keeping their shown / hidden state.
 */
export function carryLayers(from: SlideDesign, to: SlideDesign): SlideDesign {
  if (!isBrandPost(from) || !isBrandPost(to) || from.width !== to.width || from.height !== to.height) return to
  const src = withTemplateLayers(from)
  const dst = withTemplateLayers(to)
  return { ...dst, elements: relayer(src.elements, dst.elements.filter(isCarrier), templateLayerIds(dst), dst.width, dst.height) }
}
