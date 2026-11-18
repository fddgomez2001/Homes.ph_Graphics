/**
 * The brand post templates (1.52): the team's SVG templates for FHI Global, Homes.ph, PicklePlay and Bayanihan
 * (public/ALL-BRAND-TEMPLATES, copied to public/brand/templates by scripts/build-brand-templates.cjs), filled the way
 * their instructions say (_Scripts & Instructions: homesph-poster-fill.js, homesph-engagement-fill.js).
 */

/** The Poster Maker's three navigations: Poster (news posters), Did You Know, Engagement Posts. */
export type BrandPostKind = "news" | "dyk" | "engagement"

/** The folders in public/brand/templates. */
export type TemplateFolder = "homes" | "fhi" | "pickleplay" | "bayanihan"

/** What a template's file says about itself (manifest.ts, made by the build script). */
export interface TemplateInfo {
  width: number
  height: number
  /** Its layers (1.54): the SVG's top-level parts, bottom to top ("layer-background", "layer-photo", "text-block"…). */
  layers: string[]
  /** News posters: the photo's box ("contain": the whole photo over a blurred copy, the framed template). */
  photo?: { x: number; y: number; width: number; height: number; fit: "cover" | "contain"; radius: number }
  /** News posters: the headline's lines (artist templates: one line). */
  headline?: { maxLines: number | null; singleLine: boolean }
  /** News posters: has a subtext. */
  subtext?: boolean
  /** News posters: the tag pill's sample ("TRENDING NOW", template 07), null when there's none. */
  tag?: string | null
  /** News posters: the credit's sample ("PHOTO: SOURCE"). */
  credit?: string | null
  /** Did You Know / engagement posts: how the photo area is laid out. */
  layout?: "single" | "two-col" | "two-row" | "quiz" | "facts"
  /** How many photos (0, 1 or 2). */
  photos?: number
  /** The first photo is also the post's (blurred, tinted) background. */
  background?: boolean
  /** Has the Did You Know badge. */
  badge?: boolean
  /** The template's sample texts (*…* = highlighted). */
  sample?: PostFields
}

/** Crop focus of a photo (the instructions' "focus"): top keeps faces in, bottom keeps the ground. */
export type PhotoFocus = "top" | "center" | "bottom"

/** The texts of a Did You Know / engagement post (the instructions' fields). *…* = highlighted. */
export interface PostFields {
  kicker?: string
  title?: string
  subtitle?: string
  question?: string
  /** Pills on the photos ("A · Tops Lookout", "Then · 1990s"). */
  labels?: string[]
  /** Trivia answers (up to 3). */
  options?: string[]
  /** Did You Know facts (up to 3). */
  facts?: string[]
  /** The call-to-action pill on the photo ("COMMENT YOUR GUESS!"). */
  cta?: string
  /** Crop focus per photo. */
  focus?: PhotoFocus[]
  /** News posters: the tag pill (template 07; "" hides it). */
  tag?: string
}

/** A photo as the template gets it. */
export interface FillPhoto {
  href: string
  naturalWidth: number
  naturalHeight: number
  zoom: number
  focusX: number
  focusY: number
}
