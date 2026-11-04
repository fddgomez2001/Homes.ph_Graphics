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
}

export interface ImageElement extends BaseElement {
  type: "image"
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
  /** "upper": shown in CAPITAL LETTERS. The text itself stays as typed (e.g. the FHI portrait headline). */
  textCase?: "upper" | null
}

export interface TextAutoFit {
  maxWidth: number
  maxSize: number
  /** Line height as a multiple of the font size (default 1 = 100%; the cover subtitle uses 63 / 50). */
  lineHeightRatio?: number
  /** Letter spacing in em (e.g. -0.01). */
  letterSpacingEm: number
}

export interface ShapeElement extends BaseElement {
  type: "shape"
  height: number
  fill: Fill
  cornerRadius: number
  /** CSS filter: blur(px) — used for soft glows. */
  blur?: number
  /** Border drawn centered on the edge (like Konva/SVG strokes). */
  stroke?: { color: string; width: number } | null
  /** CSS box-shadow. */
  shadow?: TextShadow | null
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
  /** Top-to-bottom order. */
  items: TextStackItem[]
}

/**
 * Design format version. 2 = covers from before the left corner swoosh have had it
 * added once (see normalize); deleting it afterwards is respected.
 */
export const DESIGN_VERSION = 3

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
}

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
