/**
 * The brand post templates (1.52) as the Poster Maker offers them: Poster (11 news posters, 1080 × 1350),
 * Did You Know (2 posts, 1126 × 1408) and Engagement Posts (7 posts, 1126 × 1408), for FHI Global, Homes.ph (every
 * Homes.ph page, Gensan too), PicklePlay and Bayanihan. Each brand has its own version of every template
 * (public/brand/templates/<brand>/…).
 *
 * A post made from one is saved like any poster: a news post at its posting time, its template id
 * "<brand>-<news|dyk|eng><NN>-poster-news" (e.g. "homes-news07-poster-news", "fhi-dyk08-poster-news").
 */
import { TEMPLATE_MANIFEST } from "./manifest"
import type { BrandPostKind, TemplateFolder, TemplateInfo } from "./types"

/** The brands with templates; Homes.ph Gensan (its own poster brand) uses the Homes.ph ones. */
export type PostBrand = "homes" | "gensan" | "fhi" | "pickleplay" | "bayanihan"

export const POST_BRANDS: readonly PostBrand[] = ["homes", "gensan", "fhi", "pickleplay", "bayanihan"]

export const isPostBrand = (v: string | null | undefined): v is PostBrand => POST_BRANDS.includes(v as PostBrand)

export const folderOf = (brand: PostBrand): TemplateFolder => (brand === "gensan" ? "homes" : brand)

/** The Poster Maker's navigation. */
export const POST_KINDS: readonly { id: BrandPostKind; name: string; size: string; width: number; height: number }[] = [
  { id: "news", name: "Poster", size: "1080 × 1350", width: 1080, height: 1350 },
  { id: "dyk", name: "Did You Know", size: "1126 × 1408", width: 1126, height: 1408 },
  { id: "engagement", name: "Engagement Posts", size: "1126 × 1408", width: 1126, height: 1408 },
]

export const isPostKind = (v: string | null | undefined): v is BrandPostKind => v === "news" || v === "dyk" || v === "engagement"

export interface TemplateDef {
  kind: BrandPostKind
  /** "01" */
  num: string
  slug: string
  name: string
  /** What it's for (from the team's instructions). */
  hint: string
}

/** Every template, in the order the gallery shows them. */
export const TEMPLATE_DEFS: readonly TemplateDef[] = [
  { kind: "news", num: "01", slug: "classic-left", name: "Classic Left", hint: "Headline (2 lines), gold rule, subtext; left" },
  { kind: "news", num: "02", slug: "classic-center", name: "Classic Center", hint: "Headline (2 lines), gold rule, subtext; centered" },
  { kind: "news", num: "03", slug: "framed", name: "Framed", hint: "The photo in a frame; headline and subtext under it" },
  { kind: "news", num: "04", slug: "spotlight", name: "Spotlight", hint: "Headline up to 3 lines, centered" },
  { kind: "news", num: "05", slug: "split", name: "Split", hint: "Photo on top, text on the color below" },
  { kind: "news", num: "06", slug: "card", name: "Card", hint: "The text on a card over the photo" },
  { kind: "news", num: "07", slug: "tag", name: "Tag", hint: "A tag pill over the headline (TRENDING NOW)" },
  { kind: "news", num: "08", slug: "accent-bar", name: "Accent Bar", hint: "A gold bar beside the text" },
  { kind: "news", num: "09", slug: "artist-left", name: "Artist · Left", hint: "A NAME on one big line; date and venue under it" },
  { kind: "news", num: "10", slug: "artist-center", name: "Artist · Center", hint: "A NAME on one big line; the news under it" },
  { kind: "news", num: "11", slug: "headline-credit", name: "Headline + Source", hint: "One headline (up to 3 lines) and its source; no subtext" },
  { kind: "dyk", num: "02", slug: "did-you-know", name: "Did You Know", hint: "One surprising fact and a photo" },
  { kind: "dyk", num: "08", slug: "did-you-know-facts", name: "3 Facts", hint: "A title and up to 3 numbered facts; no photo" },
  { kind: "engagement", num: "01", slug: "memory-question", name: "Memory Question", hint: "“Remember when…?” and a photo" },
  { kind: "engagement", num: "03", slug: "throwback", name: "Throwback", hint: "Old places, throwback photos" },
  { kind: "engagement", num: "04", slug: "this-or-that", name: "This or That", hint: "Two photos side by side, A or B" },
  { kind: "engagement", num: "05", slug: "then-and-now", name: "Then & Now", hint: "An old photo over a new one" },
  { kind: "engagement", num: "06", slug: "trivia-quiz", name: "Trivia Quiz", hint: "A question and answers A, B, C" },
  { kind: "engagement", num: "07", slug: "guess-the-place", name: "Guess the Place", hint: "A clue, a hint and a photo to guess" },
  { kind: "engagement", num: "09", slug: "question-card", name: "Question Card", hint: "A question in a speech bubble" },
]

const PREFIX: Record<BrandPostKind, string> = { news: "news", dyk: "dyk", engagement: "eng" }
const KIND_OF_PREFIX: Record<string, BrandPostKind> = { news: "news", dyk: "dyk", eng: "engagement" }

export const templatesOf = (kind: BrandPostKind) => TEMPLATE_DEFS.filter((t) => t.kind === kind)

/** "homes-news07-poster-news" */
export const brandPostId = (brand: PostBrand, kind: BrandPostKind, num: string) => `${brand}-${PREFIX[kind]}${num}-poster-news`

/** A kind's first template (a new post starts on it). */
export const firstTemplate = (kind: BrandPostKind) => templatesOf(kind)[0]

const ID = /^(homes|gensan|fhi|pickleplay|bayanihan)-(news|dyk|eng)(\d\d)-poster-news$/

export interface BrandPostTemplate {
  id: string
  brand: PostBrand
  kind: BrandPostKind
  def: TemplateDef
  /** "homes/news-07-tag" (public/brand/templates/<file>.svg) */
  file: string
  info: TemplateInfo
}

/** The template behind an id, or null for any other template. */
export function brandPostTemplate(id: string | null | undefined): BrandPostTemplate | null {
  const m = ID.exec(id ?? "")
  if (!m) return null
  const brand = m[1] as PostBrand
  const kind = KIND_OF_PREFIX[m[2]]
  const def = TEMPLATE_DEFS.find((t) => t.kind === kind && t.num === m[3])
  if (!def) return null
  const file = `${folderOf(brand)}/${PREFIX[kind]}-${def.num}-${def.slug}`
  const info = TEMPLATE_MANIFEST[file]
  return info ? { id: id!, brand, kind, def, file, info } : null
}

export const isBrandPostTemplate = (id: string | null | undefined) => brandPostTemplate(id) !== null

/** Poster, Did You Know or Engagement Posts (null for any other template). */
export const brandPostKindOf = (id: string | null | undefined): BrandPostKind | null => brandPostTemplate(id)?.kind ?? null

export const templateSrc = (file: string) => `/brand/templates/${file}.svg`
/** Its small picture in the gallery (drawn by the app from the template with sample texts). */
export const templateThumb = (file: string) => `/brand/template-thumbs/${file}.jpg`

/** Every brand post template id (for the news template list). */
export function allBrandPostIds(): string[] {
  return POST_BRANDS.flatMap((brand) => TEMPLATE_DEFS.map((t) => brandPostId(brand, t.kind, t.num))).filter((id) => brandPostTemplate(id))
}
