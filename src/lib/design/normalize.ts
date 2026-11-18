import { shortId } from "@/lib/utils"
import type { PostFields } from "@/lib/brand-templates/types"
import type { BrandPostData, DesignElement, Fill, ImageElement, PhotoSlot, ShapeElement, SlideDesign, TextElement } from "./types"
import { CANVAS_SIZE, DESIGN_VERSION, MIN_FRAME_ZOOM, SUBTEXT_STYLES } from "./types"
import { getCollageLayout, slotDef } from "./cover-collage"
import { withTemplateLayers } from "@/lib/brand-templates/layers"
import { normalizeFilter } from "./filters"
import { POSTER_PICKLEBALL_SRC, SWOOSH_LEFT_SRC, SWOOSH_SRC } from "./constants"
import {
  isPosterSubtext,
  PICKLEBALL_BOX,
  pickleplayPhotoBorder,
  PORTRAIT_HEADLINE,
  PORTRAIT_HEADLINE_STACK,
  POSTER_HEADLINE_GROW_TO,
  POSTER_LOGO_SHADOW,
  POSTER_SUBTEXT_COLORS,
  posterHeadlineFit,
  posterSubtext,
  posterSubtextFit,
  posterTextLayout,
  refitPortraitPoster,
} from "./templates"

/** Canvas size in px: any sensible square format, 1254 when missing. */
function validSize(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) && v >= 256 && v <= 4096 ? Math.round(v) : CANVAS_SIZE
}

/**
 * Makes design JSON from the database safe to render: fills in missing fields
 * with defaults and drops unknown element types. Never throws.
 */
export function normalizeDesign(raw: unknown): SlideDesign {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<SlideDesign>
  const parsed = Array.isArray(d.elements) ? d.elements.map(normalizeElement).filter((e): e is DesignElement => !!e) : []
  const version = typeof d.version === "number" ? d.version : 1
  const withSwoosh = version < 2 ? addLeftSwoosh(parsed) : parsed
  // FHI portrait posts made before version 3 get their headline in capitals once (it can be turned off).
  const capitals =
    version < 3 && d.templateId === "fhi-portrait-news"
      ? withSwoosh.map((el) => (el.type === "text" && el.role === "title" ? { ...el, textCase: "upper" as const } : el))
      : withSwoosh
  const elements = version < 4 ? upgradePoster(capitals, d.templateId) : capitals
  const ids = new Set(elements.map((e) => e.id))
  const stack: SlideDesign["stack"] =
    d.stack && Array.isArray(d.stack.items)
      ? {
          enabled: d.stack.enabled !== false,
          anchor: d.stack.anchor === "center" ? "center" : "bottom",
          bottom: num(d.stack.bottom, 1214),
          ...(typeof d.stack.center === "number" ? { center: d.stack.center } : {}),
          minTop: num(d.stack.minTop, 130),
          ...(typeof d.stack.maxBottom === "number" ? { maxBottom: d.stack.maxBottom } : {}),
          ...(d.stack.spill === true ? { spill: true } : {}),
          items: d.stack.items
            .filter((i) => i && ids.has(i.id))
            .map((i) => ({
              id: i.id,
              gap: num(i.gap, 0),
              ...(typeof i.gapWithoutPrevious === "number" ? { gapWithoutPrevious: i.gapWithoutPrevious } : {}),
              ...(typeof i.minHeight === "number" ? { minHeight: i.minHeight } : {}),
            })),
        }
      : null
  const design: SlideDesign = {
    version: DESIGN_VERSION,
    // 1254 × 1254 carousels; other square formats (e.g. 1408 news articles) keep their size.
    width: validSize(d.width),
    height: validSize(d.height ?? d.width),
    background: typeof d.background === "string" ? d.background : "#FFFFFF",
    elements,
    stack,
    templateId: typeof d.templateId === "string" ? d.templateId : null,
    ...(typeof d.page === "string" && d.page.trim() ? { page: d.page.replace(/\s+/g, " ").trim().slice(0, 80) } : {}),
    ...(d.subtextStyle && d.subtextStyle !== "classic" && SUBTEXT_STYLES.includes(d.subtextStyle) ? { subtextStyle: d.subtextStyle } : {}),
    ...(d.rentsouqLayout === "square" ? { rentsouqLayout: "square" as const } : {}),
    ...(typeof d.subtextHook === "string" && d.subtextHook.trim() ? { subtextHook: d.subtextHook.trim().slice(0, 160) } : {}),
    // A cover photo collage: only while its layout is known and its slots are still there.
    ...(getCollageLayout(d.collage) && elements.some((e) => e.type === "image" && e.slot?.layout === d.collage) ? { collage: d.collage } : {}),
    // A brand post (1.52): its template and texts.
    ...(normalizeBrandPost(d.brandPost) ? { brandPost: normalizeBrandPost(d.brandPost) } : {}),
    titleFit:
      d.titleFit && Array.isArray(d.titleFit.headlineIds)
        ? {
            headlineIds: d.titleFit.headlineIds.filter((id) => ids.has(id)),
            baseSize: num(d.titleFit.baseSize, 172),
            baseGap: num(d.titleFit.baseGap, -26),
            extraGap: num(d.titleFit.extraGap, 0),
            matchHeadlines: d.titleFit.matchHeadlines === true,
          }
        : null,
  }
  const withSubtext = version < 5 ? addPosterSubtext(design) : design
  const grown = version < 6 ? growPosterHeadline(withSubtext) : withSubtext
  const flexed = withTemplateLayers(refitPortraitPoster(unboxPickleplayPortrait(version < 7 ? flexPoster(grown) : grown)))
  const result = version < 8 ? roomierText(flexed) : flexed
  // An FHI poster's own Rentsouq.ae version (edited in the editor): kept, one level deep.
  const own = d.rentsouqDesign && typeof d.rentsouqDesign === "object" && Array.isArray(d.rentsouqDesign.elements) ? normalizeDesign({ ...d.rentsouqDesign, rentsouqDesign: null }) : null
  return own ? { ...result, rentsouqDesign: own } : result
}

/**
 * Posters and New Template news posts made before version 8 (1.47): a poster's headline and subtext
 * may use the spare room under them when they would be small, and a news headline still at the
 * design's 65 px sizes itself to its three lines (bigger when short, smaller when long). Text stays.
 */
function roomierText(design: SlideDesign): SlideDesign {
  const title = design.elements.find((e): e is TextElement => e.type === "text" && e.role === "title")
  if (!title) return design
  const subtext = design.elements.find(isPosterSubtext)
  if (subtext && title.boxFit) return posterTextLayout(design, subtext.visible && !!subtext.text.trim())
  const news = design.stack?.anchor === "center" && design.stack.center === PORTRAIT_HEADLINE_STACK.center
  if (news && !title.boxFit && title.fontFamily === PORTRAIT_HEADLINE.fontFamily && title.fontSize === PORTRAIT_HEADLINE.fontSize && title.lineHeight === PORTRAIT_HEADLINE.lineHeight) {
    return { ...design, elements: design.elements.map((el) => (el.id === title.id ? { ...title, boxFit: { ...PORTRAIT_HEADLINE.boxFit } } : el)) }
  }
  return design
}

/**
 * PicklePlay New Template posts made with 1.33.0 had the headline in a white box (a misread of the
 * Figma, whose "box" was the outlined white headline): the box goes and the headline gets the
 * design's white Outfit 600 65 / 90 with the soft shadow. The text, photo and everything else stay.
 */
function unboxPickleplayPortrait(design: SlideDesign): SlideDesign {
  if (design.templateId !== "pickleplay-portrait-news" || !design.elements.some((el) => el.type === "shape" && el.name === "Headline Box")) return design
  const elements = design.elements
    .filter((el) => !(el.type === "shape" && el.name === "Headline Box"))
    .map((el) => {
      if (el.type !== "text" || el.role !== "title") return el
      const { boxFit: _boxFit, ...rest } = el
      void _boxFit
      return { ...rest, ...PORTRAIT_HEADLINE } as TextElement
    })
  return { ...design, elements, stack: design.stack ? { ...design.stack, ...PORTRAIT_HEADLINE_STACK, items: design.stack.items } : design.stack }
}

/**
 * Posters made before version 7 (1.22): the subtext sizes itself like on new posters (bigger
 * when short, up to two lines) and the photo can zoom out over a blurred copy of itself.
 */
function flexPoster(design: SlideDesign): SlideDesign {
  if (!POSTER_IDS.includes(design.templateId ?? "")) return design
  const cardPhoto = design.elements.find(
    (e): e is ImageElement => e.type === "image" && e.role === "background" && (e.width < design.width || e.height < design.height),
  )
  const elements = design.elements.map((el): DesignElement => {
    if (el.id === cardPhoto?.id && el.type === "image") return { ...el, blurFill: true }
    if (!isPosterSubtext(el)) return el
    return { ...el, autoFit: null, boxFit: posterSubtextFit() }
  })
  const subtext = elements.find(isPosterSubtext)
  return posterTextLayout({ ...design, elements }, !!subtext && subtext.visible && !!subtext.text.trim())
}

/** Posters made before version 6 (1.20): a short headline grows to fill its space, like new posters. */
function growPosterHeadline(design: SlideDesign): SlideDesign {
  if (!POSTER_IDS.includes(design.templateId ?? "")) return design
  return {
    ...design,
    elements: design.elements.map((el) =>
      el.type === "text" && el.role === "title" && el.boxFit && el.boxFit.growTo === undefined ? { ...el, boxFit: { ...el.boxFit, growTo: POSTER_HEADLINE_GROW_TO } } : el,
    ),
  }
}

const POSTER_IDS = ["fhi-poster-news", "pickleplay-poster-news", "homes-poster-news", "gensan-poster-news", "pickleplay-event-poster-news"]

const LOGOS_WITH_SHADOW = new Set(["PicklePlay Logo", "Homes.ph Logo"])

/**
 * Posters made before version 5 (1.19): the PicklePlay and Homes.ph logos get their drop
 * shadow, and the news posters get the (empty, hidden) subtext line under the headline.
 * The subtext id comes from the headline, so every load gives the same design.
 */
function addPosterSubtext(design: SlideDesign): SlideDesign {
  const id = design.templateId ?? ""
  if (!POSTER_IDS.includes(id)) return design
  let elements = design.elements.map((el) =>
    el.type === "image" && LOGOS_WITH_SHADOW.has(el.name) && !el.shadow ? { ...el, shadow: { ...POSTER_LOGO_SHADOW } } : el,
  )
  const color = POSTER_SUBTEXT_COLORS[id]
  const headline = elements.findIndex((el) => el.type === "text" && el.role === "title")
  if (!color || headline < 0 || elements.some(isPosterSubtext)) return { ...design, elements }
  const subtext = posterSubtext(color, `${elements[headline].id}-subtext`)
  elements = [...elements.slice(0, headline + 1), subtext, ...elements.slice(headline + 1)]
  return posterTextLayout({ ...design, elements }, false)
}

/**
 * Covers made before the corner swoosh was mirrored to the top left get the left
 * copy once, right above the top-right one (same position and visibility). Its id
 * comes from the right swoosh so every load produces the same design.
 */
function addLeftSwoosh(elements: DesignElement[]): DesignElement[] {
  if (elements.some((e) => e.type === "image" && e.src === SWOOSH_LEFT_SRC)) return elements
  const index = elements.findIndex((e) => e.type === "image" && e.src === SWOOSH_SRC)
  if (index < 0) return elements
  const right = elements[index] as ImageElement
  const left: ImageElement = { ...right, id: `${right.id}-left`, name: "Top Left Swoosh", src: SWOOSH_LEFT_SRC }
  return [...elements.slice(0, index + 1), left, ...elements.slice(index + 1)]
}

/**
 * Posters made before version 4 (1.16): the headline gets the shrink-to-fit rule, and
 * PicklePlay posters get the gradient photo border and the Figma pickleball (234 × 187,
 * its 50% is in the PNG). Ids come from existing elements, so every load gives the same design.
 */
function upgradePoster(elements: DesignElement[], templateId: unknown): DesignElement[] {
  if (templateId !== "fhi-poster-news" && templateId !== "pickleplay-poster-news") return elements
  let next = elements.map((el) => (el.type === "text" && el.role === "title" && !el.boxFit ? { ...el, boxFit: posterHeadlineFit() } : el))
  if (templateId !== "pickleplay-poster-news") return next
  next = next.map((el) =>
    el.type === "image" && el.src === POSTER_PICKLEBALL_SRC ? { ...el, ...PICKLEBALL_BOX, naturalWidth: 234, naturalHeight: 187, opacity: 1 } : el,
  )
  const photo = next.findIndex((el) => el.type === "image" && el.role === "background" && el.name === "Photo")
  if (photo < 0 || next.some((el) => el.type === "shape" && el.name === "Photo Border")) return next
  const border: ShapeElement = { ...pickleplayPhotoBorder(), id: `${next[photo].id}-border` }
  return [...next.slice(0, photo + 1), border, ...next.slice(photo + 1)]
}

function normalizeElement(raw: unknown): DesignElement | null {
  if (!raw || typeof raw !== "object") return null
  const e = raw as Partial<DesignElement> & Record<string, unknown>
  const base = {
    id: typeof e.id === "string" && e.id ? e.id : shortId(),
    name: typeof e.name === "string" ? e.name : "Element",
    role: e.role,
    x: num(e.x, 0),
    y: num(e.y, 0),
    width: Math.max(1, num(e.width, 100)),
    rotation: num(e.rotation, 0),
    opacity: Math.min(1, Math.max(0, num(e.opacity, 1))),
    visible: e.visible !== false,
    locked: e.locked === true,
    ...(e.carrier === true ? { carrier: true } : {}),
  }
  if (e.type === "text") {
    const t = e as Partial<TextElement>
    return {
      ...base,
      type: "text",
      text: typeof t.text === "string" ? t.text : "",
      fontFamily: typeof t.fontFamily === "string" ? t.fontFamily : "Outfit",
      fontSize: Math.max(1, num(t.fontSize, 40)),
      fontWeight: num(t.fontWeight, 400),
      fill: typeof t.fill === "string" ? t.fill : "#FFFFFF",
      align: t.align === "center" || t.align === "right" || t.align === "justify" ? t.align : "left",
      lineHeight: Math.max(1, num(t.lineHeight, num(t.fontSize, 40) * 1.25)),
      letterSpacing: num(t.letterSpacing, 0),
      shadow: {
        enabled: t.shadow?.enabled === true,
        color: t.shadow?.color ?? "#000000",
        blur: num(t.shadow?.blur, 5),
        offsetX: num(t.shadow?.offsetX, 4),
        offsetY: num(t.shadow?.offsetY, 4),
      },
      background: {
        enabled: t.background?.enabled === true,
        color: t.background?.color ?? "#F8C563",
        padding: num(t.background?.padding, 16),
        radius: num(t.background?.radius, 8),
      },
      fillGradient: t.fillGradient?.type === "linear" ? (normalizeFill(t.fillGradient) as Extract<Fill, { type: "linear" }>) : null,
      autoFit: t.autoFit
        ? {
            maxWidth: Math.max(1, num(t.autoFit.maxWidth, 1067)),
            maxSize: Math.max(1, num(t.autoFit.maxSize, num(t.fontSize, 40))),
            letterSpacingEm: num(t.autoFit.letterSpacingEm, 0),
            ...(t.autoFit.lineHeightRatio ? { lineHeightRatio: Math.max(0.5, num(t.autoFit.lineHeightRatio, 1)) } : {}),
            ...(t.autoFit.anchor && Number.isFinite(Number(t.autoFit.anchor.baseline)) && Number.isFinite(Number(t.autoFit.anchor.ratio))
              ? { anchor: { baseline: Number(t.autoFit.anchor.baseline), ratio: Number(t.autoFit.anchor.ratio) } }
              : {}),
          }
        : null,
      ...(t.boxFit && typeof t.boxFit === "object"
        ? {
            boxFit: {
              maxHeight: Math.max(1, num(t.boxFit.maxHeight, 231)),
              maxSize: Math.max(1, num(t.boxFit.maxSize, num(t.fontSize, 40))),
              ...(typeof t.boxFit.minSize === "number" ? { minSize: Math.max(1, num(t.boxFit.minSize, 8)) } : {}),
              ...(typeof t.boxFit.lineHeightRatio === "number" ? { lineHeightRatio: Math.max(0.5, num(t.boxFit.lineHeightRatio, 1)) } : {}),
              ...(typeof t.boxFit.letterSpacingEm === "number" ? { letterSpacingEm: num(t.boxFit.letterSpacingEm, 0) } : {}),
              ...(typeof t.boxFit.growTo === "number" ? { growTo: Math.max(1, num(t.boxFit.growTo, 0)) } : {}),
              ...(t.boxFit.shareWith && typeof t.boxFit.shareWith.id === "string"
                ? { shareWith: { id: t.boxFit.shareWith.id, gap: num(t.boxFit.shareWith.gap, 0), ...(typeof t.boxFit.shareWith.spare === "number" && t.boxFit.shareWith.spare > 0 ? { spare: t.boxFit.shareWith.spare } : {}) } }
                : {}),
              ...(t.boxFit.maxRatioOf && typeof t.boxFit.maxRatioOf.id === "string"
                ? { maxRatioOf: { id: t.boxFit.maxRatioOf.id, ratio: Math.min(4, Math.max(0.05, num(t.boxFit.maxRatioOf.ratio, 0.5))) } }
                : {}),
            },
          }
        : {}),
      ...(t.textCase === "upper" ? { textCase: "upper" as const } : {}),
      ...(t.hug && typeof t.hug === "object" && Number.isFinite(t.hug.centerX)
        ? { hug: { centerX: num(t.hug.centerX, 625.5), maxWidth: Math.max(1, num(t.hug.maxWidth, 1003)) } }
        : {}),
      ...(t.highlight && typeof t.highlight === "object" && Array.isArray(t.highlight.phrases)
        ? {
            highlight: {
              phrases: t.highlight.phrases.filter((p): p is string => typeof p === "string" && !!p.trim()).slice(0, 10),
              fill: typeof t.highlight.fill === "string" ? t.highlight.fill : "#F8C563",
            },
          }
        : {}),
    }
  }
  if (e.type === "image") {
    const i = e as Partial<ImageElement>
    return {
      ...base,
      type: "image",
      height: Math.max(1, num(i.height, 100)),
      src: typeof i.src === "string" && i.src ? i.src : null,
      assetId: i.assetId ?? null,
      publicId: i.publicId ?? null,
      naturalWidth: num(i.naturalWidth, 0),
      naturalHeight: num(i.naturalHeight, 0),
      fit: i.fit === "contain" ? "contain" : "cover",
      ...(num(i.cornerRadius, 0) > 0 ? { cornerRadius: num(i.cornerRadius, 0) } : {}),
      ...(i.blurFill === true && i.fit !== "contain" ? { blurFill: true } : {}),
      ...(i.blurred === true ? { blurred: true } : {}),
      ...(typeof i.templatePart === "string" && /^[a-z0-9-]{1,40}$/.test(i.templatePart) ? { templatePart: i.templatePart } : {}),
      ...(normalizeFilter(i.filter) ? { filter: normalizeFilter(i.filter) } : {}),
      ...normalizeSlot(i.slot),
      // Only a blur-fill photo zooms out below 1 (its empty space shows the blurred photo).
      zoom: Math.max(i.blurFill === true && i.fit !== "contain" ? MIN_FRAME_ZOOM : 1, num(i.zoom, 1)),
      focusX: num(i.focusX, 0.5),
      focusY: num(i.focusY, 0.5),
      uploadId: i.uploadId ?? null,
      logoVariant: i.logoVariant === "auto" || i.logoVariant === "white" || i.logoVariant === "blue" ? i.logoVariant : null,
      logoResolved: i.logoResolved === "blue" ? "blue" : i.logoResolved === "white" ? "white" : null,
      shadow: i.shadow
        ? {
            enabled: i.shadow.enabled === true,
            color: i.shadow.color ?? "rgba(0, 0, 0, 0.18)",
            blur: num(i.shadow.blur, 4),
            offsetX: num(i.shadow.offsetX, 0),
            offsetY: num(i.shadow.offsetY, 4),
          }
        : null,
    }
  }
  if (e.type === "shape") {
    const s = e as Partial<ShapeElement>
    return {
      ...base,
      type: "shape",
      height: Math.max(1, num(s.height, 100)),
      fill: normalizeFill(s.fill),
      cornerRadius: num(s.cornerRadius, 0),
      blur: Math.max(0, num(s.blur, 0)),
      stroke:
        s.stroke && typeof s.stroke.color === "string"
          ? {
              color: s.stroke.color,
              width: Math.max(0, num(s.stroke.width, 1)),
              ...(s.stroke.gradient?.type === "linear" ? { gradient: normalizeFill(s.stroke.gradient) as Extract<Fill, { type: "linear" }> } : {}),
            }
          : null,
      shadow: s.shadow
        ? {
            enabled: s.shadow.enabled === true,
            color: s.shadow.color ?? "rgba(0, 0, 0, 0.25)",
            blur: num(s.shadow.blur, 10),
            offsetX: num(s.shadow.offsetX, 0),
            offsetY: num(s.shadow.offsetY, 4),
          }
        : null,
    }
  }
  return null
}

/** A cover collage photo slot: kept only when its layout and slot number exist. */
function normalizeSlot(raw: unknown): { slot?: PhotoSlot } {
  const s = raw as Partial<PhotoSlot> | null | undefined
  if (!s || typeof s !== "object" || typeof s.layout !== "string" || typeof s.index !== "number") return {}
  const slot: PhotoSlot = { layout: s.layout, index: s.index, card: typeof s.card === "number" && Number.isInteger(s.card) && s.card >= 1 ? s.card : null }
  return slotDef(slot) ? { slot } : {}
}

function normalizeFill(fill: unknown): Fill {
  const f = fill as Partial<Fill> | undefined
  if (f?.type === "radial" && Array.isArray(f.stops) && f.stops.length >= 2) {
    return {
      type: "radial",
      cx: num(f.cx, 0.5),
      cy: num(f.cy, 0.5),
      rx: Math.max(0.001, num(f.rx, 0.5)),
      ry: Math.max(0.001, num(f.ry, 0.5)),
      stops: f.stops.map((s) => ({ offset: Math.min(1, Math.max(0, num(s.offset, 0))), color: String(s.color ?? "#000000") })),
    }
  }
  if (f?.type === "linear" && Array.isArray(f.stops) && f.stops.length >= 2) {
    return {
      type: "linear",
      angle: num(f.angle, 180),
      stops: f.stops.map((s) => ({ offset: Math.min(1, Math.max(0, num(s.offset, 0))), color: String(s.color ?? "#000000") })),
    }
  }
  return { type: "solid", color: f?.type === "solid" && typeof f.color === "string" ? f.color : "#0F4C81" }
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/** A brand post's template and texts (1.52), checked: strings only, lists of up to 3. Null when it isn't one. */
function normalizeBrandPost(raw: unknown): BrandPostData | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.template !== "string" || !/^[a-z]+\/[a-z0-9-]+$/.test(r.template)) return null
  const f = (r.fields && typeof r.fields === "object" ? r.fields : {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 400) : undefined)
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 3).map((x) => (typeof x === "string" ? x.slice(0, 200) : "")) : undefined)
  const fields: PostFields = {}
  for (const k of ["kicker", "title", "subtitle", "question", "cta", "tag"] as const) {
    const v = text(f[k])
    if (v !== undefined) fields[k] = v
  }
  for (const k of ["labels", "options", "facts"] as const) {
    const v = list(f[k])
    if (v) fields[k] = v
  }
  if (Array.isArray(f.focus)) fields.focus = f.focus.slice(0, 2).map((x) => (x === "top" || x === "bottom" ? x : "center"))
  return { template: r.template, fields }
}
