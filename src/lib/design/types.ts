import type { PostFields } from "@/lib/brand-templates/types"

/** Every cover and card is designed on an exact 1254 × 1254 logical-pixel canvas. */
export const CANVAS_SIZE = 1254

export type SlideType = "cover" | "card"

export type ElementRole =
  | "background"
  | "overlay"
  | "logo"
  | "headline"
  | "highlight"
  | "title"
  | "subtitle"
  | "description"
  | "footer"
  | "label"
  | "stat"
  | "icon"
  | "decoration"

export interface GradientStop {
  /** 0–1 */
  offset: number
  /** Any CSS color: #RRGGBB or rgba(...) */
  color: string
}

export type Fill =
  | { type: "solid"; color: string }
  /** `angle` follows CSS linear-gradient(): 0 = to top, 90 = to right, 180 = to bottom. */
  | { type: "linear"; angle: number; stops: GradientStop[] }
  /**
   * CSS radial-gradient(rx ry at cx cy, …): an ellipse whose center and radii are
   * fractions of the element box (e.g. 54.49% 54.49% at 50% 50% → rx 0.5449, ry 0.5449).
   */
  | { type: "radial"; cx: number; cy: number; rx: number; ry: number; stops: GradientStop[] }

interface BaseElement {
  id: string
  name: string
  role?: ElementRole
  x: number
  y: number
  width: number
  rotation: number
  /** 0–1 */
  opacity: number
  visible: boolean
  /** Locked elements can't be clicked on the canvas; select them in the Layers panel. */
  locked: boolean
  /**
   * Brand posts (1.53): what the post's SVG template draws itself (its headline, subtext, credit, photos): kept
   * here so the Poster Maker, report and extension read them, never drawn as a layer and not in the editor's list.
   */
  carrier?: boolean
}

export interface ImageElement extends BaseElement {
  type: "image"
  /**
   * Brand posts (1.53): one of the template's two layers, drawn from its SVG: "back" (background, photo, fades)
   * and "front" (logo, text, footer). Layers added in the editor go between them or over them.
   */
  templatePart?: "back" | "front" | null
  height: number
  /** Full-resolution original URL (Cloudinary secure_url or a local blob: URL). null = empty frame. */
  src: string | null
  assetId?: string | null
  publicId?: string | null
  naturalWidth: number
  naturalHeight: number
  /** cover = fill the frame and crop (CSS object-fit: cover); contain = fit inside without cropping. */
  fit: "cover" | "contain"
  /** Cover mode: 1 = just covers the frame, >1 zooms in. */
  zoom: number
  /** Cover mode crop focus, 0–1 on each axis (0.5 = centered). */
  focusX: number
  focusY: number
  /** Set while the original is still uploading to Cloudinary. */
  uploadId?: string | null
  /**
   * Homes.ph logo only: "auto" picks the white or blue logo for the best contrast
   * with whatever is behind it; "white"/"blue" force one. Undefined = custom image.
   */
  logoVariant?: LogoVariant | null
  /** The logo version currently shown (kept in sync with `src`). */
  logoResolved?: "white" | "blue" | null
  /** CSS drop-shadow() around the image's opaque pixels. */
  shadow?: TextShadow | null
  /** Rounded corners for a cover-fit photo (px), e.g. a photo card. */
  cornerRadius?: number
  /**
   * Cover-fit photo that can also zoom out below 1 (down to MIN_FRAME_ZOOM) to show more
   * of the photo; the frame's empty space then shows a blurred copy of the same photo.
   */
  blurFill?: boolean
  /** Drawn as a soft, darker blurred copy of its photo (a backdrop that follows the poster's photo, 1.51). */
  blurred?: boolean
  /** A photo slot of the cover collage: the frame is cut to the slot's shape and can show a card's photo. */
  slot?: PhotoSlot | null
}

/** One photo slot of a cover collage ("Photo 1" … "Photo 6"); its shape, box and color come from the layout. */
export interface PhotoSlot {
  /** Collage layout id ("collage-1" …), see cover-collage.ts. */
  layout: string
  /** 1-based slot number in the layout. */
  index: number
  /** The card whose photo the slot shows (1 = Card 1, kept in sync); null = the user's own photo. */
  card: number | null
}

export type LogoVariant = "auto" | "white" | "blue"

export interface TextShadow {
  enabled: boolean
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

export interface TextBackground {
  enabled: boolean
  color: string
  padding: number
  radius: number
}

export interface TextElement extends BaseElement {
  type: "text"
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  fill: string
  align: "left" | "center" | "right" | "justify"
  /** Line height in px (as in Figma), not a multiplier. */
  lineHeight: number
  /** Letter spacing in px. */
  letterSpacing: number
  shadow: TextShadow
  background: TextBackground
  /** Gradient text fill (CSS background-clip: text). Overrides `fill` when set. */
  fillGradient?: Extract<Fill, { type: "linear" }> | null
  /**
   * Keep the text on ONE line inside `maxWidth` by shrinking the font size from
   * `maxSize` (the Homes.ph Title Auto-Fit rule). Line height is 100% and letter
   * spacing scales with the size.
   */
  autoFit?: TextAutoFit | null
  /**
   * Shrink to fit a fixed box (e.g. the poster headline): the text wraps at `width` and
   * the font shrinks from `maxSize` (never growing past it) until it is at most
   * `maxHeight` tall. Line height and letter spacing keep their ratio to the size.
   */
  boxFit?: TextBoxFit | null
  /** "upper": shown in CAPITAL LETTERS. The text itself stays as typed (e.g. the FHI portrait headline). */
  textCase?: "upper" | null
  /** Words drawn in another color, e.g. the hook of a poster headline ("GRAVELTON CLARK 2026"). */
  highlight?: TextHighlight | null
  /**
   * The text box shrinks to its widest line, centered on `centerX` (never wider than
   * `maxWidth`), so its background hugs the words (the banner subtext).
   */
  hug?: { centerX: number; maxWidth: number } | null
}

export interface TextHighlight {
  /** Phrases found in the text ignoring case and spacing; the first match of each is colored. */
  phrases: string[]
  fill: string
}

export interface TextAutoFit {
  maxWidth: number
  maxSize: number
  /** Line height as a multiple of the font size (default 1 = 100%; the cover subtitle uses 63 / 50). */
  lineHeightRatio?: number
  /** Letter spacing in em (e.g. -0.01). */
  letterSpacingEm: number
  /**
   * Keeps the line on its design baseline while it shrinks (1.51 poster designs): the text's top becomes
   * `baseline - ratio × size` (`ratio`: where the font's baseline falls in its 100% line, 0.85 for Poppins).
   */
  anchor?: { baseline: number; ratio: number } | null
}

export interface TextBoxFit {
  maxHeight: number
  maxSize: number
  /** Never smaller than this (default 8). */
  minSize?: number
  /** Line height as a multiple of the font size (default 1 = 100%). */
  lineHeightRatio?: number
  /** Letter spacing in em (default 0). */
  letterSpacingEm?: number
  /**
   * Short text grows from `maxSize` up to this size to fill the box, as long as it keeps
   * its number of lines (so a short headline gets bigger instead of leaving space).
   */
  growTo?: number
  /**
   * Shares `maxHeight` with the text under it (the poster headline and its subtext): this
   * one gets the height that one leaves, minus `gap`. While that text is hidden or empty,
   * this one has all of it.
   */
  /**
   * `spare`: extra room under the shared space (down to the stack's maxBottom), used only when
   * one of the two came out smaller than its design size, so small text gets bigger.
   */
  shareWith?: { id: string; gap: number; spare?: number } | null
  /** Never bigger than this share of another text's fitted size (a poster subtext stays smaller than its headline). */
  maxRatioOf?: { id: string; ratio: number } | null
}

export interface ShapeElement extends BaseElement {
  type: "shape"
  height: number
  fill: Fill
  cornerRadius: number
  /** CSS filter: blur(px) — used for soft glows. */
  blur?: number
  /** Border drawn centered on the edge (like Konva/SVG strokes). */
  stroke?: ShapeStroke | null
  /** CSS box-shadow. */
  shadow?: TextShadow | null
}

export interface ShapeStroke {
  color: string
  width: number
  /** Gradient border (e.g. the PicklePlay photo card): overrides `color`, spans the shape's box. */
  gradient?: Extract<Fill, { type: "linear" }> | null
}

export type DesignElement = ImageElement | TextElement | ShapeElement
export type ElementType = DesignElement["type"]

export interface TextStackItem {
  id: string
  /** Space above this item (ignored for the first shown item). May be negative. */
  gap: number
  /** Used instead of `gap` when the item listed just before this one is empty or hidden. */
  gapWithoutPrevious?: number
  /** The item takes at least this much height (like a fixed-height text box in Figma). */
  minHeight?: number
}

/**
 * Text stack (like auto layout): the listed text elements are placed top-to-bottom.
 * "bottom" keeps the last item's bottom edge at `bottom`; "center" keeps the whole
 * block centered on `center`. Empty or hidden items are skipped.
 */
export interface TextStack {
  enabled: boolean
  anchor?: "bottom" | "center"
  bottom: number
  center?: number
  /** Text should stay below this line (e.g. under the logo). */
  minTop: number
  /** Text should stay above this line (e.g. above the footer). */
  maxBottom?: number
  /**
   * Bottom-anchored: a block taller than `bottom - minTop` starts at minTop and runs down past
   * `bottom` (as far as maxBottom) instead of rising above minTop.
   */
  spill?: boolean
  /** Top-to-bottom order. */
  items: TextStackItem[]
}

/**
 * Design format version. 2 = covers from before the left corner swoosh have had it
 * added once (see normalize); deleting it afterwards is respected. 3 = FHI portrait
 * headlines in capitals. 4 = poster headlines shrink to fit their box, and PicklePlay
 * posters get the gradient photo border and the Figma pickleball. 5 = poster subtext line
 * and logo drop shadows. 6 = short poster headlines grow to fill their space. 7 = the poster
 * subtext sizes itself (bigger when short, up to two lines) and the poster photo can zoom out
 * over a blurred copy of itself. 8 = a poster's headline and subtext use the spare room under them
 * when they would be small, and New Template news headlines size themselves to their three lines.
 */
export const DESIGN_VERSION = 8

/** How far a blur-fill photo can zoom out (0.2 = a fifth of the size that just covers the frame). */
export const MIN_FRAME_ZOOM = 0.2

export interface SlideDesign {
  version: number
  width: number
  height: number
  /** Base fill under everything; "transparent" allowed (PNG export keeps alpha). */
  background: string
  /** Bottom → top (array order = layer order). */
  elements: DesignElement[]
  stack?: TextStack | null
  /** Title Block rules (cover): headline line gap that tightens as the lines shrink. */
  titleFit?: TitleFit | null
  /** Built-in template this slide started from, if any. */
  templateId?: string | null
  /** The Facebook page a news post / poster is for (Homes.ph posters: "BGC Taguig"). */
  page?: string | null
  /** How a poster's subtext looks (posters only; missing = classic). */
  subtextStyle?: SubtextStyle | null
  /**
   * FHI Global Property posters: the template the Poster Maker's Rentsouq.ae tab draws this poster on
   * ("square" = Old Template; missing = New Template, the default). Only a choice: nothing else is saved for Rentsouq.ae.
   */
  rentsouqLayout?: "portrait" | "square" | null
  /** Poster designs (1.51): the subtext's words in gold, as typed ("" = picked automatically). */
  subtextHook?: string | null
  /**
   * FHI Global Property posters: their Rentsouq.ae version as edited in the editor (its own sizes, positions
   * and layout). The headline, subtext, photo and credit always come from the FHI poster. Missing: the
   * Rentsouq.ae template with the FHI poster's text and photo sizes.
   */
  rentsouqDesign?: SlideDesign | null
  /**
   * Cover photo collage in use ("collage-1" …): the cover shows the cards' photos in the layout's
   * slots instead of one background photo (which is kept, hidden). Missing = single photo.
   */
  collage?: string | null
  /**
   * Brand post templates (1.52): the team's SVG template that draws this post ("homes/news-07-tag",
   * public/brand/templates) and the texts it gets (Did You Know / engagement posts; a news poster's tag).
   * The rest (headline, subtext, credit, photos) is in the design's named parts. See lib/brand-templates.
   */
  brandPost?: BrandPostData | null
}

/** A brand post's template and texts (1.52). */
export interface BrandPostData {
  template: string
  fields?: PostFields
}

/**
 * Poster subtext looks: classic (the brand color, 30 px growing to 44), big (bolder and up
 * to 64 px), highlight (white with its most interesting words in the brand color) and banner
 * (dark words on a brand-colored band that hugs them).
 */
export type SubtextStyle = "classic" | "big" | "highlight" | "banner"
export const SUBTEXT_STYLES: readonly SubtextStyle[] = ["classic", "big", "highlight", "banner"]

/**
 * Same rules as the Homes.ph Title Auto-Fit Figma plugin: the gap between the two
 * headline lines is round(baseGap × (size / baseSize)²) + extraGap, using the smaller
 * line, and the headline → subtitle gap stays fixed.
 */
export interface TitleFit {
  /** [white line, gold line] */
  headlineIds: string[]
  baseSize: number
  baseGap: number
  extraGap: number
  /** Give both headline lines the smaller of the two fitted sizes. */
  matchHeadlines: boolean
}

export interface EditorSlide {
  id: string
  type: SlideType
  design: SlideDesign
}
