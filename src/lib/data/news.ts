"use client"

import { syncPendingImages } from "@/lib/image-sync"
import { checkImageFile } from "@/lib/image-validation"
import { addPending, localSrc, saveLocalImage } from "@/lib/local-images"
import { primeImage, loadImage } from "@/lib/design/image-cache"
import { getNewsTemplate } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import {
  autoSubtextHook,
  EVENT_LOCATION_LABEL,
  EVENT_SAMPLE,
  EVENT_TIME_LABEL,
  isPosterSubtext,
  POSTER_CREDIT_PREFIX,
  posterTextLayout,
  styleSubtext,
  subtextHookOf,
  subtextStyleOf,
  summarizeDesign,
} from "@/lib/design/templates"
import { MIN_FRAME_ZOOM, type ImageElement, type SlideDesign, type SubtextStyle, type TextElement } from "@/lib/design/types"
import { designSizes, hookPhrases, isDesignPoster, posterDesignOf, splitSubtext, SUBTEXT_LINE_2 } from "@/lib/design/poster-designs"
import { brandPostTemplate } from "@/lib/brand-templates/catalog"
import { isBrandPostDesign } from "@/lib/brand-templates/posts"
import { carryLayers } from "@/lib/brand-templates/layers"
import { fitZoom } from "@/lib/design/geometry"
import { createProject, getProject, getProjectSlides, saveProject, updateProject } from "./projects"
import { DataError } from "./errors"

/** A photo for a news article (a copy saved on this computer, uploaded in the background). */
export interface NewsPhoto {
  src: string
  naturalWidth: number
  naturalHeight: number
  assetId?: string | null
  publicId?: string | null
  /** Set while the photo only exists on this computer. */
  sha?: string
  name?: string
}

/** A poster's "PHOTO OF: …" line. */
export interface NewsCredit {
  enabled: boolean
  name: string
}

/** An event poster's details (tournaments, games, new courts). "" = not given. */
export interface NewsEvent {
  location: string
  when: string
}

/** Where the photo sits in a poster's photo card: zoom (1 = just covers the card) and focus (0–1). */
export interface PhotoFrame {
  zoom: number
  focusX: number
  focusY: number
}

/** What can change on a news article or poster without opening the editor. */
export interface NewsChange {
  headline?: string
  photo?: NewsPhoto
  templateId?: string
  /** Highlighted words of the headline (posters); [] = none. */
  highlight?: string[]
  /** The photo credit (posters). */
  credit?: NewsCredit
  /** The Facebook page it's for (Homes.ph posters); "" or null = none. */
  page?: string | null
  /** LOCATION and DATE & TIME under the headline (event posters). */
  event?: NewsEvent
  /** The subtext under the headline (posters); "" = none (headline only). */
  subtext?: string
  /**
   * Show the subtext (posters). Turned off, the text is kept but the poster is headline-only.
   * Left out: shown whenever there is text.
   */
  subtextOn?: boolean
  /** How the subtext looks: classic, big, highlight or banner (posters). */
  subtextStyle?: SubtextStyle
  /** The subtext's words in the brand color (highlight look); "" = picked from the text automatically. */
  subtextHook?: string
  /** Move / zoom the photo inside the photo card (posters). */
  photoFrame?: PhotoFrame
  /** FHI posters: the template of their Rentsouq.ae version (Poster Maker's Rentsouq.ae tab). */
  rentsouqLayout?: "portrait" | "square"
  /** Brand news posters (1.52): the tag pill over the headline (template 07; "" = none). */
  tag?: string
}

const photoOf = (design: SlideDesign) => design.elements.find((e): e is ImageElement => e.type === "image" && e.role === "background")
const headlineOf = (design: SlideDesign) => design.elements.find((e): e is TextElement => e.type === "text" && e.role === "title")
const creditOf = (design: SlideDesign) => design.elements.find((e): e is TextElement => e.type === "text" && e.role === "label")
// Event posters: the location is the "subtitle" line, the date and time the "description" line.
const eventLineOf = (design: SlideDesign, role: "subtitle" | "description") =>
  design.elements.find((e): e is TextElement => e.type === "text" && e.role === role && !!e.highlight)

/** The headline written on a news design. */
export function newsHeadline(design: SlideDesign): string {
  return headlineOf(design)?.text ?? ""
}

/** The headline's highlighted words ([] when none, or when the design has no highlight). */
export function newsHighlight(design: SlideDesign): string[] {
  return headlineOf(design)?.highlight?.phrases ?? []
}

const stripLabel = (text: string, label: string) => {
  const t = text.replace(/\s+/g, " ").trim()
  return t.toUpperCase().startsWith(label.trim().toUpperCase()) ? t.slice(label.trim().length).trim() : t
}

/** The location and date/time of an event poster ("" while the sample shows), or null for other designs. */
export function newsEvent(design: SlideDesign): NewsEvent | null {
  const location = eventLineOf(design, "subtitle")
  const when = eventLineOf(design, "description")
  if (!location || !when) return null
  const value = (el: TextElement, label: string, sample: string) => {
    const v = el.visible ? stripLabel(el.text, label) : ""
    return v === sample ? "" : v
  }
  return { location: value(location, EVENT_LOCATION_LABEL, EVENT_SAMPLE.location), when: value(when, EVENT_TIME_LABEL, EVENT_SAMPLE.when) }
}

/**
 * Event details on the poster: a line shows only when it has a value. With neither, both
 * show the sample ("Venue Name, City") so the poster still reads as a template.
 */
function withEvent(design: SlideDesign, event: NewsEvent): SlideDesign {
  const location = event.location.replace(/\s+/g, " ").trim().slice(0, 120)
  const when = event.when.replace(/\s+/g, " ").trim().slice(0, 120)
  const sample = !location && !when
  const line = (label: string, value: string, fallback: string) => ({ text: `${label}${sample ? fallback : value}`, visible: sample || !!value })
  return {
    ...design,
    elements: design.elements.map((el) => {
      if (el.type !== "text" || !el.highlight) return el
      if (el.role === "subtitle") return { ...el, ...line(EVENT_LOCATION_LABEL, location, EVENT_SAMPLE.location) }
      if (el.role === "description") return { ...el, ...line(EVENT_TIME_LABEL, when, EVENT_SAMPLE.when) }
      return el
    }),
  }
}

/** The poster's subtext as shown ("" when there's none or it's off), or null when the design has no subtext line. */
export function newsSubtext(design: SlideDesign): string | null {
  const el = design.elements.find(isPosterSubtext)
  if (el && isDesignPoster(design.templateId)) {
    const two = secondLineOf(design)
    return [el, two].filter((x): x is TextElement => !!x && x.visible).map((x) => x.text.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ")
  }
  return el ? (el.visible ? el.text.replace(/\s+/g, " ").trim() : "") : null
}

/** A poster design's second subtext line (1.51). */
const secondLineOf = (design: SlideDesign) => design.elements.find((e): e is TextElement => e.type === "text" && e.name === SUBTEXT_LINE_2)

/**
 * A poster design's subtext (1.51): on its two lines (as typed with Enter, else split for their sizes), each shown
 * when there's text; its gold words: the ones typed (`hook`, comma separated).
 */
function withDesignSubtext(design: SlideDesign, subtext: string, on: boolean, hook: string): SlideDesign {
  const n = posterDesignOf(design.templateId)
  const sizes = n ? designSizes(n) : null
  const first = design.elements.find(isPosterSubtext)
  if (!sizes || !first) return design
  const clean = subtext.replace(/\r/g, "").slice(0, 160)
  const [a, b] = splitSubtext(clean, sizes)
  const typed = hook.replace(/\s+/g, " ").trim()
  // Only the words typed are gold (a design without gold words stays as it is).
  const phrases = typed ? hookPhrases(typed) : []
  const two = secondLineOf(design)
  return {
    ...design,
    subtextHook: typed || null,
    elements: design.elements.map((el) => {
      if (el.type !== "text") return el
      if (el.id === first.id) return { ...el, text: a, visible: on && !!a, highlight: { phrases, fill: el.highlight?.fill ?? "#EEA023" } }
      if (el.id === two?.id) return { ...el, text: b, visible: on && !!b, highlight: { phrases, fill: el.highlight?.fill ?? "#EEA023" } }
      return el
    }),
  }
}

/** A brand poster's subtext as typed: each line's spaces tidied, at most two lines (Enter starts the second). */
const brandSubtextText = (text: string) =>
  text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join("\n")
    .slice(0, 200)

/**
 * A brand poster's subtext (1.52): its template wraps it on up to two lines (where Enter was pressed, else where
 * it's full) and shrinks it when it needs more; its gold words are the ones typed (`hook`, comma separated).
 */
function withBrandSubtext(design: SlideDesign, subtext: string, on: boolean, hook: string): SlideDesign {
  const text = brandSubtextText(subtext)
  const typed = hook.replace(/\s+/g, " ").trim()
  return {
    ...design,
    subtextHook: typed || null,
    elements: design.elements.map((el) => (isPosterSubtext(el) ? { ...el, text, visible: on && !!text, highlight: { phrases: hookPhrases(typed), fill: el.highlight?.fill ?? "#EEA023" } } : el)),
  }
}

/** A brand poster's tag pill (template 07): its words ("" = none). */
function withTag(design: SlideDesign, tag: string): SlideDesign {
  if (!design.brandPost) return design
  return { ...design, brandPost: { ...design.brandPost, fields: { ...design.brandPost.fields, tag: tag.replace(/\s+/g, " ").trim().slice(0, 30) } } }
}

/** A brand poster's tag (template 07), or null when its template has none. */
export function newsTag(design: SlideDesign): string | null {
  if (!isBrandPostDesign(design) || !brandPostTemplate(design.templateId)?.info.tag) return null
  return design.brandPost?.fields?.tag ?? ""
}

/** The poster's subtext text (kept while it's turned off) and whether it's on, or null when the design has no subtext line. */
export function newsSubtextState(design: SlideDesign): { text: string; on: boolean } | null {
  const el = design.elements.find(isPosterSubtext)
  if (!el) return null
  // A brand poster (1.52): its lines as typed (Enter starts the second).
  if (isBrandPostDesign(design)) {
    const text = brandSubtextText(el.text)
    return { text, on: el.visible && !!text }
  }
  if (isDesignPoster(design.templateId)) {
    // Its two lines, the second after a line break (as typed in the Poster Maker).
    const two = secondLineOf(design)
    const lines = [el.text, two?.text ?? ""].map((t) => t.replace(/\s+/g, " ").trim())
    const text = lines[1] ? lines.join("\n") : lines[0]
    return { text, on: (el.visible || !!two?.visible) && !!text }
  }
  const text = el.text.replace(/\s+/g, " ").trim()
  return { text, on: el.visible && !!text }
}

/**
 * How the poster's subtext looks, and its words in the brand color when they were chosen
 * by hand ("" = picked automatically, or not the highlight look). Null without a subtext line.
 */
export function newsSubtextLook(design: SlideDesign): { style: SubtextStyle; hook: string } | null {
  const el = design.elements.find(isPosterSubtext)
  if (!el) return null
  // A poster design has its own look; its gold words are the ones typed.
  if (isDesignPoster(design.templateId) || isBrandPostDesign(design)) return { style: "classic", hook: design.subtextHook ?? "" }
  const style = subtextStyleOf(design)
  const hook = subtextHookOf(design)
  return { style, hook: hook && hook !== autoSubtextHook(el.text) ? hook : "" }
}

/** The subtext line, shown when it's on and written; the headline moves above it (or back to the middle of its box). */
function withSubtext(design: SlideDesign, subtext: string, on = true): SlideDesign {
  if (newsSubtext(design) === null) return design
  if (isDesignPoster(design.templateId)) return withDesignSubtext(design, subtext, on, design.subtextHook ?? "")
  if (isBrandPostDesign(design)) return withBrandSubtext(design, subtext, on, design.subtextHook ?? "")
  const text = subtext.replace(/\s+/g, " ").trim().slice(0, 160)
  const visible = on && !!text
  const next = { ...design, elements: design.elements.map((el) => (isPosterSubtext(el) ? { ...el, text, visible } : el)) }
  return posterTextLayout(next, visible)
}

/** The photo in a poster's photo card: the background image that doesn't cover the whole poster. */
function cardPhotoOf(design: SlideDesign): ImageElement | undefined {
  const photos = design.elements.filter((e): e is ImageElement => e.type === "image" && e.role === "background")
  // A poster design's photo fills the poster (Template 6: its card); it moves and zooms like a card's.
  if (isDesignPoster(design.templateId) || isBrandPostDesign(design)) return photos.find((e) => e.name === "Photo")
  return photos.find((e) => e.width < design.width || e.height < design.height)
}

/** Zoom and position of the photo in the photo card, or null when the design has no card. */
export function newsPhotoFrame(design: SlideDesign):
  | (PhotoFrame & {
      src: string | null
      box: { x: number; y: number; width: number; height: number }
      naturalWidth: number
      naturalHeight: number
      /** It can zoom out over a blurred copy of itself. */
      blurFill: boolean
      /** The card's corner radius (the New Template's photo has 30 px curves). */
      radius: number
    })
  | null {
  const el = cardPhotoOf(design)
  return el
    ? {
        zoom: el.zoom,
        focusX: el.focusX,
        focusY: el.focusY,
        src: el.src,
        box: { x: el.x, y: el.y, width: el.width, height: el.height },
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight,
        blurFill: !!el.blurFill,
        radius: el.cornerRadius ?? 0,
      }
    : null
}

function withPhotoFrame(design: SlideDesign, frame: PhotoFrame): SlideDesign {
  const card = cardPhotoOf(design)
  if (!card) return design
  const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5))
  // A blur-fill photo can zoom out (its empty space shows the blurred photo).
  const zoom = Math.min(5, Math.max(card.blurFill ? MIN_FRAME_ZOOM : 1, Number.isFinite(frame.zoom) ? frame.zoom : 1))
  return {
    ...design,
    elements: design.elements.map((el) => (el.id === card.id ? { ...card, zoom, focusX: clamp01(frame.focusX), focusY: clamp01(frame.focusY) } : el)),
  }
}

/** The Facebook page a post is for (Homes.ph posters), or "". */
export function newsPage(design: SlideDesign): string {
  return design.page?.trim() ?? ""
}

/** The photo credit, or null when the design has none (only posters do). */
export function newsCredit(design: SlideDesign): NewsCredit | null {
  const el = creditOf(design)
  if (!el) return null
  const name = el.text.replace(/^\s*photo\s+of:?\s*/i, "").trim()
  return { enabled: el.visible && !!name, name }
}

/** The photo is cover-fitted in the template's frame (move and zoom it in the editor). */
function withPhoto(design: SlideDesign, photo: NewsPhoto): SlideDesign {
  // A brand poster's framed template shows the whole photo (over its blurred copy).
  const whole = (el: ImageElement) =>
    isBrandPostDesign(design) && el.blurFill ? Math.max(MIN_FRAME_ZOOM, fitZoom(photo.naturalWidth, photo.naturalHeight, el.width, el.height)) : 1
  return {
    ...design,
    elements: design.elements.map((el) =>
      el.type === "image" && el.role === "background"
        ? {
            ...el,
            src: photo.src,
            naturalWidth: photo.naturalWidth,
            naturalHeight: photo.naturalHeight,
            assetId: photo.assetId ?? null,
            publicId: photo.publicId ?? null,
            zoom: whole(el),
            focusX: 0.5,
            focusY: 0.5,
            visible: true,
          }
        : el,
    ),
  }
}

function withHeadline(design: SlideDesign, headline: string): SlideDesign {
  return { ...design, elements: design.elements.map((el) => (el.type === "text" && el.role === "title" ? { ...el, text: headline } : el)) }
}

/** Only designs whose headline supports highlighting (posters) take highlighted words. */
function withHighlight(design: SlideDesign, phrases: string[]): SlideDesign {
  const clean = phrases.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 10)
  return {
    ...design,
    elements: design.elements.map((el) => (el.type === "text" && el.role === "title" && el.highlight ? { ...el, highlight: { ...el.highlight, phrases: clean } } : el)),
  }
}

/** Shown only when it's on and has a name ("PHOTO OF: FRANK GOMEZ"). */
function withCredit(design: SlideDesign, credit: NewsCredit): SlideDesign {
  const name = credit.name.replace(/\s+/g, " ").trim().slice(0, 80)
  return {
    ...design,
    elements: design.elements.map((el) =>
      el.type === "text" && el.role === "label" ? { ...el, text: `${POSTER_CREDIT_PREFIX}${name}`, visible: credit.enabled && !!name } : el,
    ),
  }
}

/**
 * Applies a change to a news design (without the text layout, see prepareDesign).
 * A new template keeps the headline, photo, highlighted words and photo credit.
 */
export function applyNewsChange(design: SlideDesign, change: NewsChange): SlideDesign {
  let next = design
  if (change.templateId && change.templateId !== design.templateId) {
    const template = getNewsTemplate(change.templateId)
    if (!template) throw new DataError("Unknown news template.")
    const photo = photoOf(design)
    const credit = newsCredit(design)
    next = template.build({ headline: newsHeadline(design) })
    if (photo?.src) next = withPhoto(next, { src: photo.src, naturalWidth: photo.naturalWidth, naturalHeight: photo.naturalHeight, assetId: photo.assetId, publicId: photo.publicId })
    next = withHighlight(next, newsHighlight(design))
    if (credit) next = withCredit(next, credit)
    // The page stays only on brands that have pages (Homes.ph).
    if (design.page && template.brand === "homes") next = { ...next, page: design.page }
    const event = newsEvent(design)
    if (event && newsEvent(next)) next = withEvent(next, event)
    const subtext = newsSubtextState(design)
    const look = newsSubtextLook(design)
    // A poster design takes the gold words along (from another design, or the Highlight look's).
    if ((isDesignPoster(next.templateId) || isBrandPostDesign(next)) && look?.hook) next = { ...next, subtextHook: look.hook }
    // A brand poster's tag stays (kept on a template without one, for when it's switched back).
    const tag = design.brandPost?.fields?.tag
    if (isBrandPostDesign(next) && tag !== undefined) next = withTag(next, tag)
    if (subtext?.text) next = withSubtext(next, subtext.text, subtext.on)
    // The subtext keeps its look (in the new brand's colors).
    if (look && look.style !== "classic" && newsSubtext(next) !== null && !isDesignPoster(next.templateId) && !isBrandPostDesign(next)) next = styleSubtext(next, look.style, look.hook)
    // Keep where the photo was moved / zoomed to in the card.
    const frame = newsPhotoFrame(design)
    if (frame && photo?.src) next = withPhotoFrame(next, frame)
    // Another brand template: the layers added in the editor stay (1.53).
    if (isBrandPostDesign(design) && isBrandPostDesign(next)) next = carryLayers(design, next)
    // The Rentsouq.ae version keeps its own template (New ↔ Old on FHI doesn't change it), and its own edits.
    if (design.rentsouqLayout === "square") next = { ...next, rentsouqLayout: "square" }
    if (design.rentsouqDesign) next = { ...next, rentsouqDesign: design.rentsouqDesign }
  }
  if (change.headline !== undefined) next = withHeadline(next, change.headline)
  if (change.highlight !== undefined) next = withHighlight(next, change.highlight)
  if (change.credit) next = withCredit(next, change.credit)
  if (change.photo) next = withPhoto(next, change.photo)
  if (change.event && newsEvent(next)) next = withEvent(next, change.event)
  if (isDesignPoster(next.templateId)) {
    // A poster design: its two lines and gold words (its look is its own: subtextStyle doesn't apply).
    if (change.subtext !== undefined || change.subtextOn !== undefined || change.subtextHook !== undefined) {
      const current = newsSubtextState(next)
      const text = change.subtext ?? current?.text ?? ""
      const on = change.subtextOn ?? (change.subtext !== undefined ? true : (current?.on ?? false))
      next = withDesignSubtext(next, text, on, change.subtextHook ?? next.subtextHook ?? "")
    }
  } else if (isBrandPostDesign(next)) {
    // A brand poster (1.52): its lines as typed, its gold words the ones typed.
    if (change.subtext !== undefined || change.subtextOn !== undefined || change.subtextHook !== undefined) {
      const current = newsSubtextState(next)
      const text = change.subtext ?? current?.text ?? ""
      const on = change.subtextOn ?? (change.subtext !== undefined ? true : (current?.on ?? false))
      next = withBrandSubtext(next, text, on, change.subtextHook ?? next.subtextHook ?? "")
    }
  } else if (change.subtext !== undefined || change.subtextOn !== undefined) {
    const current = newsSubtextState(next)
    const text = change.subtext ?? current?.text ?? ""
    next = withSubtext(next, text, change.subtextOn ?? (change.subtext !== undefined ? true : (current?.on ?? false)))
  }
  // After the text: the highlight look picks its colored words from it.
  if ((change.subtextStyle !== undefined || change.subtextHook !== undefined) && newsSubtext(next) !== null && !isDesignPoster(next.templateId) && !isBrandPostDesign(next)) {
    const look = newsSubtextLook(next)
    next = styleSubtext(next, change.subtextStyle ?? look?.style ?? "classic", change.subtextHook ?? look?.hook ?? "")
  }
  if (change.photoFrame) next = withPhotoFrame(next, change.photoFrame)
  if (change.page !== undefined) {
    const page = change.page?.replace(/\s+/g, " ").trim().slice(0, 80)
    next = { ...next, page: page || null }
  }
  if (change.rentsouqLayout !== undefined) next = { ...next, rentsouqLayout: change.rentsouqLayout === "square" ? "square" : null }
  if (change.tag !== undefined && isBrandPostDesign(next)) next = withTag(next, change.tag)
  return next
}

/**
 * A poster's content (headline, highlighted words, subtext and its look, photo credit, event lines, the photo
 * and where it sits in its card) put on another design of the same poster (its Rentsouq.ae version, or back),
 * which keeps its own sizes, positions and colors.
 */
export function syncPosterContent(target: SlideDesign, source: SlideDesign): SlideDesign {
  const photo = photoOf(source)
  const frame = newsPhotoFrame(source)
  const subtext = newsSubtextState(source)
  const look = newsSubtextLook(source)
  const credit = newsCredit(source)
  const event = newsEvent(source)
  const change: NewsChange = {
    headline: newsHeadline(source),
    highlight: newsHighlight(source),
    ...(credit ? { credit } : {}),
    ...(event && newsEvent(target) ? { event } : {}),
    ...(subtext ? { subtext: subtext.text, subtextOn: subtext.on } : {}),
    ...(look ? { subtextStyle: look.style, subtextHook: look.hook } : {}),
    // A new photo only when it's another one (the same photo keeps the target's card as it is).
    ...(photo?.src && photo.src !== photoOf(target)?.src
      ? { photo: { src: photo.src, naturalWidth: photo.naturalWidth, naturalHeight: photo.naturalHeight, assetId: photo.assetId, publicId: photo.publicId } }
      : {}),
    ...(frame?.src ? { photoFrame: { zoom: frame.zoom, focusX: frame.focusX, focusY: frame.focusY } } : {}),
  }
  return applyNewsChange(target, change)
}

const titleOf = (headline: string) => headline.replace(/\s+/g, " ").trim().slice(0, 300) || "Untitled news article"

/**
 * Saves a pasted or dropped photo on this computer first (it shows at once and
 * survives restarts); it uploads to Cloudinary in the background.
 */
export async function storeNewsPhoto(file: File): Promise<NewsPhoto> {
  const problem = checkImageFile(file)
  if (problem) throw new DataError(problem)
  const name = file.name || "Pasted image"
  const url = URL.createObjectURL(file)
  let img: HTMLImageElement
  try {
    img = await loadImage(url)
  } catch {
    URL.revokeObjectURL(url)
    throw new DataError(`"${name}" could not be opened as an image.`)
  }
  const sha = await saveLocalImage(file, name)
  const src = localSrc(sha)
  primeImage(src, img)
  return { src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, sha, name }
}

/** Queues the local copy for upload; the saved article switches to the Cloudinary original. */
async function uploadLater(photo: NewsPhoto | undefined, projectId: string) {
  if (!photo?.sha) return
  await addPending(photo.sha, photo.name ?? "Pasted image", projectId).catch(() => {})
  void syncPendingImages().catch(() => {})
}

/** Creates a news article from a template (headline, optional photo, posting time). Returns its id. */
export async function createNewsArticle(input: {
  templateId: string
  headline: string
  scheduledAt: string | null
  caption?: string
  /** Posters: the daily report "Details" (Daily Trend News), kept in the project's topic. */
  topic?: string
  photo?: NewsPhoto
  highlight?: string[]
  credit?: NewsCredit
  page?: string | null
  event?: NewsEvent
  subtext?: string
  subtextOn?: boolean
  subtextStyle?: SubtextStyle
  subtextHook?: string
  /** FHI posters: the template of their Rentsouq.ae version (New Template when left out). */
  rentsouqLayout?: "portrait" | "square"
  /** Brand posters (1.52): template 07's tag (left out: the template's own). */
  tag?: string
}): Promise<string> {
  const template = getNewsTemplate(input.templateId)
  if (!template) throw new DataError("Unknown news template.")
  const { prepareDesign } = await import("@/lib/design/prepare")
  const design = applyNewsChange(template.build({ headline: input.headline.trim() || undefined }), {
    photo: input.photo,
    highlight: input.highlight,
    credit: input.credit,
    ...(input.page ? { page: input.page } : {}),
    ...(input.event ? { event: input.event } : {}),
    ...(input.subtext ? { subtext: input.subtext, subtextOn: input.subtextOn ?? true } : {}),
    ...(input.subtextStyle ? { subtextStyle: input.subtextStyle, subtextHook: input.subtextHook ?? "" } : {}),
    ...(input.rentsouqLayout === "square" ? { rentsouqLayout: "square" as const } : {}),
    ...(input.tag !== undefined ? { tag: input.tag } : {}),
  })
  const id = await createProject(
    {
      title: titleOf(input.headline),
      caption: input.caption?.trim() ?? "",
      topic: input.topic?.trim().slice(0, 500) || null,
      scheduledAt: input.scheduledAt,
      status: input.scheduledAt ? "scheduled" : "draft",
    },
    await prepareDesign(design),
  )
  await updateProject(id, { kind: "news" })
  await uploadLater(input.photo, id)
  return id
}

/**
 * Changes a news article without opening the editor: its headline, photo,
 * template, highlighted words or photo credit. Saved like an editor save.
 */
export async function updateNewsArticle(projectId: string, change: NewsChange, extra: { caption?: string; topic?: string } = {}): Promise<void> {
  const [project, rows] = await Promise.all([getProject(projectId), getProjectSlides(projectId)])
  const row = rows[0]
  if (!row) throw new DataError("This news article has no design.")
  const design = applyNewsChange(normalizeDesign(row.design_json), change)
  const { prepareDesign } = await import("@/lib/design/prepare")
  const prepared = await prepareDesign(design)
  await saveProject({
    projectId,
    expectedRevision: project.revision,
    project: {
      title: titleOf(newsHeadline(prepared)),
      ...(extra.caption !== undefined ? { caption: extra.caption } : {}),
      ...(extra.topic !== undefined ? { topic: extra.topic.trim().slice(0, 500) } : {}),
    },
    slides: [
      {
        id: row.id,
        slide_type: "cover",
        ...summarizeDesign(prepared),
        canvas_width: prepared.width,
        canvas_height: prepared.height,
        design_json: prepared,
      },
    ],
  })
  await uploadLater(change.photo, projectId)
}
