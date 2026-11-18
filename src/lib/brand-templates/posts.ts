/**
 * A brand post (1.52) as a saved design: the SVG template draws it (render.ts), and the design keeps what goes on
 * it. News posters keep their headline, subtext, photo credit and photo in the same named parts as every other
 * poster ("Headline", "Subtext", "Photo Credit", "Photo"), so the Poster Maker, the boards, the Daily Report and
 * the posting extension read them as they read any poster; their tag (template 07) is in `brandPost.fields`.
 * Did You Know and engagement posts keep their texts in `brandPost.fields` (the instructions' fields) and their
 * photos in "Photo" and "Photo 2"; their title (or question) is also the "Headline" (their name in lists).
 */
import { imageElement, NEWS_HEADLINE_PLACEHOLDER, POSTER_CREDIT_PREFIX, POSTER_SAMPLE_HIGHLIGHT, textElement } from "@/lib/design/templates"
import { DESIGN_VERSION, type DesignElement, type ImageElement, type SlideDesign, type TextElement } from "@/lib/design/types"
import { brandPostTemplate, type BrandPostTemplate } from "./catalog"
import { carryLayers, partElement } from "./layers"
import type { ImageFilter } from "@/lib/design/filters"
import type { EngagementFill, PosterFill } from "./fill"
import type { FillPhoto, PostFields } from "./types"

/** Highlighted words' default color (only the template's own colors are drawn; this marks a poster headline). */
const GOLD = "#EEA023"

export const SECOND_PHOTO = "Photo 2"

/** A design drawn from a brand post template. */
export function isBrandPostDesign(design: Pick<SlideDesign, "templateId" | "brandPost"> | null | undefined): boolean {
  return !!design?.brandPost && !!brandPostTemplate(design.templateId)
}

/** The background color behind the template (the brand's), shown only while it loads. */
const BACKGROUND: Record<string, string> = { homes: "#0D1968", fhi: "#143AA9", pickleplay: "#143AA9", bayanihan: "#142E55" }

/** A new post on template `id` (see catalog.ts). */
export function buildBrandPost(id: string, content?: { headline?: string }): SlideDesign {
  const t = brandPostTemplate(id)
  if (!t) throw new Error(`Unknown brand post template: ${id}`)
  const { info } = t
  const base = { version: DESIGN_VERSION, width: info.width, height: info.height, background: BACKGROUND[t.file.split("/")[0]] ?? "#0D1968", templateId: id }
  const headline = (text: string, phrases: string[]) =>
    textElement({ name: "Headline", role: "title", text, x: 56, y: 1000, width: info.width - 112, fontFamily: "Poppins", fontSize: 64, fontWeight: 800, textCase: "upper", highlight: { phrases, fill: GOLD } })

  if (t.kind === "news") {
    const photo = info.photo!
    const elements: DesignElement[] = [
      imageElement({
        name: "Photo",
        role: "background",
        x: photo.x,
        y: photo.y,
        width: photo.width,
        height: photo.height,
        cornerRadius: photo.radius,
        fit: "cover",
        // The framed template shows the whole photo over a blurred copy: it can zoom out.
        blurFill: photo.fit === "contain",
        locked: true,
      }),
      headline(content?.headline ?? NEWS_HEADLINE_PLACEHOLDER, content?.headline ? [] : [POSTER_SAMPLE_HIGHLIGHT]),
      ...(info.subtext ? [textElement({ name: "Subtext", role: "subtitle", text: "", x: 56, y: 1180, width: info.width - 112, fontSize: 30, visible: false, highlight: { phrases: [], fill: GOLD } })] : []),
      textElement({ name: "Photo Credit", role: "label", text: POSTER_CREDIT_PREFIX, x: 56, y: 30, width: 700, fontSize: 15, visible: false }),
    ]
    return { ...base, elements: withParts(elements, info.layers, info.width, info.height), brandPost: { template: t.file, fields: info.tag ? { tag: info.tag } : {} } }
  }

  // Did You Know / engagement: the sample texts to start from.
  const fields: PostFields = structuredClone(info.sample ?? {})
  const elements: DesignElement[] = []
  for (let i = 1; i <= (info.photos ?? 0); i++) {
    elements.push(imageElement({ name: i === 1 ? "Photo" : `Photo ${i}`, role: i === 1 ? "background" : "decoration", x: 56, y: 600, width: info.width - 112, height: 600, fit: "cover", locked: true }))
  }
  elements.push(headline(postTitleOf(fields), []))
  return { ...base, elements: withParts(elements, info.layers, info.width, info.height), brandPost: { template: t.file, fields } }
}

/** The template's texts and photos (marked as its own), then its layers, as in its SVG (1.54). */
const withParts = (carriers: DesignElement[], layers: readonly string[], width: number, height: number): DesignElement[] => [
  ...carriers.map((e) => ({ ...e, carrier: true }) as DesignElement),
  ...layers.map((id) => partElement(id, width, height)),
]

/** A Did You Know / engagement post's name: its title, else its question, else its text (markup taken out). */
export function postTitleOf(fields: PostFields): string {
  const t = fields.title || fields.question || fields.subtitle || ""
  return t.replace(/\*/g, "").replace(/\s+/g, " ").trim()
}

// ---------- what the template gets ----------

/** The template's own part of that name (a layer added in the editor may have the same name). */
const own = (design: SlideDesign, el: DesignElement) => el.carrier === true || !design.elements.some((e) => e.carrier)
const named = (design: SlideDesign, name: string) => design.elements.find((e) => e.name === name && own(design, e))
const textNamed = (design: SlideDesign, name: string) => {
  const el = named(design, name)
  return el?.type === "text" ? el : undefined
}
export const photoNamed = (design: SlideDesign, name: string) => {
  const el = named(design, name)
  return el?.type === "image" ? el : undefined
}

/** Comma-separated words → phrases ("A, B" → ["A", "B"]). */
export const phrasesOf = (hook: string | null | undefined) =>
  String(hook ?? "")
    .split(",")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)

/**
 * The text with its highlighted words marked (*…*), the template's markup. Text already marked by hand
 * (it has a *) is kept as it is. Each phrase is marked where it first appears (any capitals).
 */
export function markPhrases(text: string, phrases: readonly string[]): string {
  if (text.includes("*")) return text
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const p of [...phrases].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const at = lower.indexOf(p.toLowerCase())
    if (at < 0) continue
    const end = at + p.length
    if (ranges.some(([s, e]) => at < e && end > s)) continue
    ranges.push([at, end])
  }
  ranges.sort((a, b) => a[0] - b[0])
  let out = ""
  let pos = 0
  for (const [s, e] of ranges) {
    out += `${text.slice(pos, s)}*${text.slice(s, e)}*`
    pos = e
  }
  return out + text.slice(pos)
}

/** The credit line: "PHOTO: NAME"; the headline + source template: "SOURCE: NAME" with the name underlined. */
export function creditLine(t: BrandPostTemplate, name: string): string {
  const n = name.replace(/\s+/g, " ").trim()
  if (!n) return ""
  if (/^(photo|source|credit)\b/i.test(n)) return n
  return t.def.num === "11" ? `SOURCE: _${n.replace(/_/g, "")}_` : `PHOTO: ${n}`
}

/** A photo element as the template gets it (its picture as `href`), or null without one. */
export function fillPhotoOf(el: ImageElement | undefined, href: string | null): FillPhoto | null {
  if (!el?.src || !href) return null
  return { href, naturalWidth: el.naturalWidth || 1, naturalHeight: el.naturalHeight || 1, zoom: el.zoom || 1, focusX: el.focusX ?? 0.5, focusY: el.focusY ?? 0.5 }
}

/** What a news poster's template is filled with. `photo`: the picture to show for the photo. */
export function posterFillOf(design: SlideDesign, photo: string | null): PosterFill {
  const t = brandPostTemplate(design.templateId)!
  const head = textNamed(design, "Headline")
  const sub = textNamed(design, "Subtext")
  const credit = textNamed(design, "Photo Credit")
  const name = credit?.visible ? credit.text.replace(/^\s*photo\s+of:?\s*/i, "") : ""
  const subtext = sub?.visible ? sub.text.replace(/\r/g, "").trim() : ""
  return {
    photo: fillPhotoOf(photoNamed(design, "Photo"), photo),
    headline: markPhrases((head?.text ?? "").replace(/\s+/g, " ").trim(), head?.highlight?.phrases ?? []),
    subtext: subtext ? markPhrases(subtext, phrasesOf(design.subtextHook)) : "",
    credit: creditLine(t, name),
    tag: design.brandPost?.fields?.tag ?? "",
  }
}

/** What a Did You Know / engagement post's template is filled with. `photos`: the pictures for Photo and Photo 2. */
export function engagementFillOf(design: SlideDesign, photos: (string | null)[]): EngagementFill {
  const f = design.brandPost?.fields ?? {}
  const clean = (v: string | undefined) => (v ?? "").replace(/\r/g, "")
  return {
    kicker: clean(f.kicker).trim(),
    title: clean(f.title),
    subtitle: clean(f.subtitle),
    question: clean(f.question),
    labels: (f.labels ?? []).map((l) => l.trim()),
    options: (f.options ?? []).map((o) => o.trim()).filter(Boolean),
    facts: (f.facts ?? []).map((o) => o.trim()).filter(Boolean),
    cta: clean(f.cta).trim(),
    focus: f.focus,
    photos: [fillPhotoOf(photoNamed(design, "Photo"), photos[0] ?? null), fillPhotoOf(photoNamed(design, SECOND_PHOTO), photos[1] ?? null)],
  }
}

// ---------- changes ----------

/** A Did You Know / engagement post with new texts (its "Headline" follows its title). */
export function withPostFields(design: SlideDesign, patch: Partial<PostFields>): SlideDesign {
  const fields: PostFields = { ...(design.brandPost?.fields ?? {}), ...patch }
  const title = postTitleOf(fields)
  return {
    ...design,
    brandPost: { template: design.brandPost!.template, fields },
    elements: design.elements.map((el) => (el.type === "text" && el.name === "Headline" && own(design, el) ? ({ ...el, text: title } as TextElement) : el)),
  }
}

/** A post's photo's filter (1.54); null: none. */
export function withPhotoFilter(design: SlideDesign, name: string, filter: ImageFilter | null): SlideDesign {
  return { ...design, elements: design.elements.map((el) => (el.type === "image" && el.name === name && own(design, el) ? { ...el, filter } : el)) }
}

/** A photo put in a post's photo `name` ("Photo", "Photo 2"); null takes it out. */
export function withNamedPhoto(design: SlideDesign, name: string, photo: { src: string; naturalWidth: number; naturalHeight: number; assetId?: string | null; publicId?: string | null } | null): SlideDesign {
  return {
    ...design,
    elements: design.elements.map((el) =>
      el.type === "image" && el.name === name && own(design, el)
        ? photo
          ? { ...el, src: photo.src, naturalWidth: photo.naturalWidth, naturalHeight: photo.naturalHeight, assetId: photo.assetId ?? null, publicId: photo.publicId ?? null, zoom: 1, focusX: 0.5, focusY: 0.5, visible: true }
          : { ...el, src: null, assetId: null, publicId: null, naturalWidth: 0, naturalHeight: 0 }
        : el,
    ),
  }
}

/**
 * Another template of the same kind: what was typed, the photos and their crop focus stay (a typed field the new
 * template doesn't have is kept for when it's switched back); texts still as the old template's sample take the
 * new template's sample.
 */
export function switchPostTemplate(design: SlideDesign, id: string): SlideDesign {
  const next = buildBrandPost(id)
  const fields: Record<string, unknown> = { ...(design.brandPost?.fields ?? {}) }
  // What was typed stays; a text still as the old template's sample (or empty) becomes the new one's sample.
  const oldSample = (brandPostTemplate(design.templateId)?.info.sample ?? {}) as Record<string, unknown>
  const sample = (brandPostTemplate(id)?.info.sample ?? {}) as Record<string, unknown>
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const empty = (v: unknown) => v === undefined || v === "" || (Array.isArray(v) && !v.some(Boolean))
  for (const k of new Set([...Object.keys(oldSample), ...Object.keys(sample)])) {
    if (!empty(fields[k]) && !same(fields[k], oldSample[k])) continue
    if (k in sample) fields[k] = structuredClone(sample[k])
    else delete fields[k]
  }
  let out: SlideDesign = { ...next, page: design.page ?? null, brandPost: { template: next.brandPost!.template, fields: fields as PostFields } }
  for (const name of ["Photo", SECOND_PHOTO]) {
    const old = photoNamed(design, name)
    if (old?.src && photoNamed(out, name)) out = withNamedPhoto(out, name, { ...old, src: old.src })
  }
  // The layers added in the editor stay (under, between or over the template's).
  return carryLayers(design, withPostFields(out, {}))
}
