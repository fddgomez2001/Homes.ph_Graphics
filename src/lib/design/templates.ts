import { shortId } from "@/lib/utils"
import {
  BRAND,
  DEFAULT_FACEBOOK_TEXT,
  DEFAULT_WEBSITE_TEXT,
  ICON_FACEBOOK_SRC,
  ICON_WEB_SRC,
  LOGO_BOX,
  LOGO_NATURAL,
  LOGO_WHITE_SRC,
  NEWS_SIZE,
  PICKLEPLAY_BACKGROUND_SRC,
  PICKLEPLAY_LOGO_SRC,
  FHI_LOGO_SRC,
  SWOOSH_LEFT_SRC,
  SWOOSH_SRC,
} from "./constants"
import type {
  DesignElement,
  ElementRole,
  Fill,
  ImageElement,
  LogoVariant,
  ShapeElement,
  SlideDesign,
  SlideType,
  TextElement,
  TextShadow,
} from "./types"
import { CANVAS_SIZE, DESIGN_VERSION } from "./types"

export interface TemplateContext {
  websiteText: string
  facebookText: string
  /** Title Auto-Fit defaults for new covers (like the plugin's saved settings). */
  titleExtraGap: number
  titleMatchHeadlines: boolean
}

export const DEFAULT_TEMPLATE_CONTEXT: TemplateContext = {
  websiteText: DEFAULT_WEBSITE_TEXT,
  facebookText: DEFAULT_FACEBOOK_TEXT,
  titleExtraGap: 0,
  titleMatchHeadlines: false,
}

/** Cover text. Undefined fields get placeholder text; an empty string leaves the line out. */
export interface TemplateContent {
  white?: string
  yellow?: string
  description?: string
}

export type BuiltInTemplateId = "homes-cover" | "classic-cover" | "homes-card" | "text-card" | "full-image" | "quote-stat"

export interface BuiltInTemplate {
  id: BuiltInTemplateId
  name: string
  description: string
  slideType: SlideType
  build: (ctx: TemplateContext, content?: TemplateContent) => SlideDesign
}

const NO_SHADOW = { enabled: false, color: "#000000", blur: 5, offsetX: 4, offsetY: 4 }
const NO_BACKGROUND = { enabled: false, color: BRAND.yellow, padding: 16, radius: 8 }

export function textElement(props: Partial<TextElement> & Pick<TextElement, "name" | "text">): TextElement {
  return {
    id: shortId(),
    type: "text",
    x: 40,
    y: 40,
    width: 1174,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fontFamily: "Outfit",
    fontSize: 40,
    fontWeight: 400,
    fill: BRAND.white,
    align: "left",
    lineHeight: 50,
    letterSpacing: 0,
    shadow: NO_SHADOW,
    background: NO_BACKGROUND,
    ...props,
  }
}

export function imageElement(props: Partial<ImageElement> & Pick<ImageElement, "name">): ImageElement {
  return {
    id: shortId(),
    type: "image",
    x: 0,
    y: 0,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    src: null,
    assetId: null,
    publicId: null,
    naturalWidth: 0,
    naturalHeight: 0,
    fit: "cover",
    zoom: 1,
    focusX: 0.5,
    focusY: 0.5,
    ...props,
  }
}

export function shapeElement(props: Partial<ShapeElement> & Pick<ShapeElement, "name" | "fill">): ShapeElement {
  return {
    id: shortId(),
    type: "shape",
    x: 0,
    y: 0,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    cornerRadius: 0,
    ...props,
  }
}

export function backgroundImage(): ImageElement {
  return imageElement({ name: "Background image", role: "background", locked: true })
}

/** Homes.ph logo slot (default x 583, y 39, 88 × 86). "auto" switches white/blue to suit the photo behind it. */
export function logoElement(variant: LogoVariant = "auto", box: { x: number; y: number; width: number; height: number } = LOGO_BOX): ImageElement {
  return imageElement({
    name: "Homes.ph Logo",
    role: "logo",
    ...box,
    src: LOGO_WHITE_SRC,
    naturalWidth: LOGO_NATURAL.white.width,
    naturalHeight: LOGO_NATURAL.white.height,
    fit: "contain",
    logoVariant: variant,
    logoResolved: "white",
  })
}

/** Footer from the cover spec: web icon + www.homes.ph, Facebook icon + page name (group 868 × 34, centered). */
export function footerElements(ctx: TemplateContext): DesignElement[] {
  const footerText = { fontSize: 35, fontWeight: 300, lineHeight: 25 }
  return [
    imageElement({ name: "Website icon", role: "icon", x: 193, y: 1169, width: 34, height: 34, src: ICON_WEB_SRC, naturalWidth: 34, naturalHeight: 34, fit: "contain" }),
    // Widths have room to spare (text is left-aligned) so font metrics never force a wrap.
    textElement({ name: "Website", role: "footer", text: ctx.websiteText, x: 237, y: 1170, width: 290, ...footerText }),
    imageElement({ name: "Facebook icon", role: "icon", x: 535, y: 1169, width: 34, height: 34, src: ICON_FACEBOOK_SRC, naturalWidth: 34, naturalHeight: 34, fit: "contain" }),
    textElement({ name: "Facebook", role: "footer", text: ctx.facebookText, x: 579, y: 1173, width: 560, ...footerText }),
  ]
}

/** "Rectangle 13120": navy band fading down from the top behind the logo (on the cover and every card). */
const TOP_BAND_FILL: Fill = {
  type: "linear",
  angle: 180,
  // linear-gradient(0deg, #0D1969 -49.56%, transparent 92.7%) flipped vertically: 65% navy at the very top.
  stops: [
    { offset: 0, color: "rgba(13, 25, 105, 0.65)" },
    { offset: 0.927, color: "rgba(13, 25, 105, 0)" },
  ],
}

export function topBand(): ShapeElement {
  return shapeElement({ name: "Top Band", role: "overlay", x: 0, y: 0, width: CANVAS_SIZE, height: 226, fill: TOP_BAND_FILL, locked: true })
}

function design(elements: DesignElement[], extra: Partial<SlideDesign> = {}): SlideDesign {
  return { version: DESIGN_VERSION, width: CANVAS_SIZE, height: CANVAS_SIZE, background: BRAND.white, elements, ...extra }
}

const BLUE_FADE: Fill = {
  type: "linear",
  angle: 180,
  stops: [
    { offset: 0, color: "rgba(7, 48, 163, 0.7)" },
    { offset: 1, color: "rgba(11, 23, 103, 0.8)" },
  ],
}

const CARD_GRADIENT: Fill = {
  type: "linear",
  angle: 0,
  stops: [
    { offset: 0, color: BRAND.overlayBlue },
    { offset: 1, color: "rgba(13, 25, 105, 0)" },
  ],
}

/**
 * Classic cover (Figma, first version): photo, Blue Fade, logo, a centered text group
 * (White First Line 120/118, Yellow First Line 105/118, Cover Description 60/76)
 * whose center sits at y ≈ 511, and the website / Facebook footer.
 */
function buildClassicCover(ctx: TemplateContext, content?: TemplateContent): SlideDesign {
  const white = textElement({
    name: "White First Line",
    role: "headline",
    text: content?.white ?? "Your Headline",
    x: 68,
    y: 276,
    width: 1119,
    fontSize: 120,
    fontWeight: 900,
    lineHeight: 118,
    align: "center",
  })
  const yellow = textElement({
    name: "Yellow First Line",
    role: "highlight",
    text: content?.yellow ?? "Second Line Here",
    x: 68,
    y: 397,
    width: 1119,
    fontSize: 105,
    fontWeight: 900,
    lineHeight: 118,
    align: "center",
    fill: BRAND.yellow,
  })
  const description = textElement({
    name: "Cover Description",
    role: "description",
    text: content?.description ?? "Add a short description of what this carousel is about",
    x: 112,
    y: 519,
    width: 1030,
    fontSize: 60,
    fontWeight: 600,
    lineHeight: 76,
    align: "center",
  })
  return design(
    [
      backgroundImage(),
      shapeElement({ name: "Blue Fade", role: "overlay", fill: BLUE_FADE, locked: true }),
      logoElement(),
      white,
      yellow,
      description,
      ...footerElements(ctx),
    ],
    {
      templateId: "classic-cover",
      stack: {
        enabled: true,
        anchor: "center",
        center: 511.25,
        bottom: 747,
        minTop: 130,
        maxBottom: 1150,
        items: [
          { id: white.id, gap: 0, minHeight: 118 },
          { id: yellow.id, gap: 3.5, minHeight: 118 },
          { id: description.id, gap: 4, minHeight: 228 },
        ],
      },
    },
  )
}


const TITLE_SHADOW: TextShadow = { enabled: true, color: "rgba(5, 13, 64, 0.45)", blur: 18, offsetX: 0, offsetY: 6 }

/** radial-gradient(54.49% 54.49% at 50% 50%, …) — the navy glow behind the title. */
const TITLE_GLOW: Fill = {
  type: "radial",
  cx: 0.5,
  cy: 0.5,
  rx: 0.5449,
  ry: 0.5449,
  stops: [
    { offset: 0.2788, color: "rgba(10, 26, 126, 0.88)" },
    { offset: 0.7404, color: "rgba(11, 31, 142, 0.6)" },
    { offset: 1, color: "rgba(11, 31, 142, 0)" },
  ],
}

/** linear-gradient(90deg, #FDBA2F 8.17%, #FEDF69 91.35%) across the line's 1062 px box. */
const GOLD_TEXT: Extract<Fill, { type: "linear" }> = {
  type: "linear",
  angle: 90,
  stops: [
    { offset: 0.0817, color: "#FDBA2F" },
    { offset: 0.9135, color: "#FEDF69" },
  ],
}

/** "blue gradient": linear-gradient(0deg, #0D1969 0%, transparent 74.07%) along the bottom 378 px. */
const BOTTOM_BAND_FILL: Fill = {
  type: "linear",
  angle: 0,
  stops: [
    { offset: 0, color: BRAND.overlayBlue },
    { offset: 0.7407, color: "rgba(13, 25, 105, 0)" },
  ],
}

/** The Title Block is 1062 px wide, centered (x 96). */
const TITLE_BLOCK = { x: 96, width: 1062 }
/** Title Block center (394 + 408 / 2 in the Figma template). */
export const TITLE_BLOCK_CENTER_Y = 598

/**
 * Carousel Cover (Figma "1"): photo on navy #0B1F8E, two blurred navy Title Glow
 * gradients (the second at 41%), the navy Top Band, the corner swoosh at the top
 * right and mirrored at the top left, the bottom blue gradient, the white H logo
 * (88 × 86 at 583, 39) and the auto-fitted
 * Title Block (1062 px, centered at y 598): Headline Line 1 (White, 900, 172),
 * 5 px, Headline Line 2 (gold gradient, 900, 148), 20 px, Subtitle (600,
 * 50 / 63). Each line stays on one line and shrinks to fit, like the Title
 * Auto-Fit plugin.
 */
function buildHomesCover(ctx: TemplateContext, content?: TemplateContent): SlideDesign {
  const line1 = textElement({
    name: "Headline Line 1 (White)",
    role: "headline",
    text: content?.white ?? "Your Headline",
    ...TITLE_BLOCK,
    y: 394,
    fontSize: 172,
    fontWeight: 900,
    lineHeight: 172,
    align: "center",
    shadow: TITLE_SHADOW,
    autoFit: { maxWidth: TITLE_BLOCK.width, maxSize: 172, letterSpacingEm: 0 },
  })
  const line2 = textElement({
    name: "Headline Line 2 (Gold)",
    role: "highlight",
    text: content?.yellow ?? "Goes Here",
    ...TITLE_BLOCK,
    y: 571,
    fontSize: 148,
    fontWeight: 900,
    lineHeight: 148,
    align: "center",
    fill: "#FDBA2F",
    fillGradient: GOLD_TEXT,
    shadow: TITLE_SHADOW,
    autoFit: { maxWidth: TITLE_BLOCK.width, maxSize: 148, letterSpacingEm: 0 },
  })
  const subtitle = textElement({
    name: "Subtitle",
    role: "description",
    text: content?.description ?? "Add a short subtitle",
    ...TITLE_BLOCK,
    y: 739,
    fontSize: 50,
    fontWeight: 600,
    lineHeight: 63,
    align: "center",
    shadow: TITLE_SHADOW,
    autoFit: { maxWidth: TITLE_BLOCK.width, maxSize: 50, letterSpacingEm: 0, lineHeightRatio: 63 / 50 },
  })
  return design(
    [
      backgroundImage(),
      shapeElement({ name: "Title Glow Gradient", role: "overlay", x: -200, y: 251, width: 1627, height: 655, fill: TITLE_GLOW, blur: 156.5, locked: true }),
      shapeElement({ name: "Title Glow Gradient 2", role: "overlay", x: -200, y: 251, width: 1627, height: 655, fill: TITLE_GLOW, blur: 156.5, opacity: 0.41, locked: true }),
      topBand(),
      imageElement({ name: "Top Right Swoosh", role: "decoration", src: SWOOSH_SRC, naturalWidth: 1254, naturalHeight: 1254, fit: "contain", locked: true }),
      imageElement({ name: "Top Left Swoosh", role: "decoration", src: SWOOSH_LEFT_SRC, naturalWidth: 1254, naturalHeight: 1254, fit: "contain", locked: true }),
      shapeElement({ name: "Bottom Band", role: "overlay", y: 876, height: 378, fill: BOTTOM_BAND_FILL, locked: true }),
      logoElement(),
      line1,
      line2,
      subtitle,
      ...footerElements(ctx),
    ],
    {
      templateId: "homes-cover",
      background: "#0B1F8E",
      stack: {
        enabled: true,
        anchor: "center",
        center: TITLE_BLOCK_CENTER_Y,
        bottom: 802,
        minTop: 140,
        maxBottom: 1150,
        items: [
          { id: line1.id, gap: 0 },
          { id: line2.id, gap: 5 },
          { id: subtitle.id, gap: 20 },
        ],
      },
      titleFit: {
        headlineIds: [line1.id, line2.id],
        baseSize: 172,
        baseGap: 5,
        extraGap: ctx.titleExtraGap,
        matchHeadlines: ctx.titleMatchHeadlines,
      },
    },
  )
}

/**
 * Carousel Card (Figma): photo, blue gradient from y 440, logo, and bottom-aligned
 * Card Title (90/80), Card Subtitle (40/80, #FFF1B9) and Card Description (40/50).
 * With an empty subtitle the title moves down to y 1016, as in the no-subtitle layout.
 */
function buildHomesCard(): SlideDesign {
  const title = textElement({ name: "Card Title", role: "title", text: "Card Title", x: 40, y: 955, width: 1174, fontSize: 90, fontWeight: 700, lineHeight: 80 })
  const subtitle = textElement({
    name: "Card Subtitle",
    role: "subtitle",
    text: "Subtitle goes here",
    x: 40,
    y: 1028,
    width: 1174,
    fontSize: 40,
    fontWeight: 700,
    lineHeight: 80,
    fill: "#FFF1B9",
  })
  const description = textElement({
    name: "Card Description",
    role: "description",
    text: "Add supporting details for this card. Keep it short, clear, and easy to read on a phone.",
    x: 40,
    y: 1114,
    width: 1174,
    fontSize: 40,
    fontWeight: 400,
    lineHeight: 50,
  })
  return design(
    [
      backgroundImage(),
      shapeElement({ name: "Blue Gradient", role: "overlay", y: 440, height: 814, fill: CARD_GRADIENT, locked: true }),
      topBand(),
      logoElement(),
      title,
      subtitle,
      description,
    ],
    {
      templateId: "homes-card",
      stack: {
        enabled: true,
        bottom: 1214,
        minTop: 130,
        items: [
          { id: title.id, gap: 0 },
          { id: subtitle.id, gap: -7 },
          { id: description.id, gap: 6, gapWithoutPrevious: 18, minHeight: 100 },
        ],
      },
    },
  )
}

function buildTextCard(ctx: TemplateContext): SlideDesign {
  return design(
    [
      shapeElement({
        name: "Background",
        role: "overlay",
        locked: true,
        fill: {
          type: "linear",
          angle: 160,
          stops: [
            { offset: 0, color: BRAND.deepBlue },
            { offset: 1, color: BRAND.overlayBlue },
          ],
        },
      }),
      topBand(),
      logoElement(),
      textElement({ name: "Label", role: "label", text: "TIP #1", x: 100, y: 330, width: 1054, fontSize: 34, fontWeight: 700, lineHeight: 44, letterSpacing: 4, fill: BRAND.yellow }),
      textElement({ name: "Title", role: "title", text: "Write one clear, bold statement here", x: 100, y: 392, width: 1054, fontSize: 84, fontWeight: 800, lineHeight: 96 }),
      textElement({
        name: "Description",
        role: "description",
        text: "Use this card for advice, explanations, or step-by-step tips. Keep each paragraph short so it reads well on a phone.",
        x: 100,
        y: 620,
        width: 1054,
        fontSize: 44,
        fontWeight: 400,
        lineHeight: 62,
        opacity: 0.92,
      }),
      ...footerElements(ctx),
    ],
    { templateId: "text-card" },
  )
}

function buildFullImage(): SlideDesign {
  const caption = textElement({ name: "Caption", role: "description", text: "Short caption for the photo", x: 40, y: 1162, width: 1174, fontSize: 40, fontWeight: 600, lineHeight: 52 })
  return design(
    [
      backgroundImage(),
      shapeElement({
        name: "Caption gradient",
        role: "overlay",
        y: 900,
        height: 354,
        locked: true,
        fill: {
          type: "linear",
          angle: 0,
          stops: [
            { offset: 0, color: "rgba(13, 25, 105, 0.85)" },
            { offset: 1, color: "rgba(13, 25, 105, 0)" },
          ],
        },
      }),
      topBand(),
      logoElement(),
      caption,
    ],
    { templateId: "full-image", stack: { enabled: true, bottom: 1214, minTop: 130, items: [{ id: caption.id, gap: 0 }] } },
  )
}

function buildQuoteStat(ctx: TemplateContext): SlideDesign {
  return design(
    [
      shapeElement({ name: "Background", role: "overlay", locked: true, fill: { type: "linear", angle: 180, stops: [{ offset: 0, color: "#0730A3" }, { offset: 1, color: "#0B1767" }] } }),
      topBand(),
      logoElement(),
      textElement({ name: "Statistic", role: "stat", text: "85%", x: 40, y: 340, width: 1174, fontSize: 260, fontWeight: 900, lineHeight: 270, align: "center", fill: BRAND.yellow }),
      textElement({ name: "Statement", role: "title", text: "of home buyers start their search online", x: 112, y: 650, width: 1030, fontSize: 64, fontWeight: 700, lineHeight: 78, align: "center" }),
      textElement({ name: "Source", role: "description", text: "Source: add your source here", x: 112, y: 860, width: 1030, fontSize: 32, fontWeight: 400, lineHeight: 42, align: "center", opacity: 0.8 }),
      ...footerElements(ctx),
    ],
    { templateId: "quote-stat" },
  )
}

/** Card (Figma "Photo Card"): 1260 × 652 at 74, 266, radius 36. */
const NEWS_CARD = { x: 74, y: 266, width: 1260, height: 652 }

/** Headline on a new news article until one is typed. */
export const NEWS_HEADLINE_PLACEHOLDER = "Your News Headline Goes Here"

/**
 * PicklePlay news article (1408 × 1408, Figma "News Article Background Template"):
 * background art, the PicklePlay logo (191 × 191 at 595, 38), the photo card (#1B4FD8,
 * 3 px white 45% border, soft shadow, radius 36) with the photo inside, the headline
 * (Outfit 600, 76 / 77, up to 3 lines, centered on the 231 px block at y 988) and the
 * website / Facebook footer (Inter 500, 26.7 px, centered at y 1289).
 */
export function buildPickleplayNews(content?: { headline?: string }): SlideDesign {
  const headline = textElement({
    name: "Headline",
    role: "title",
    text: content?.headline ?? NEWS_HEADLINE_PLACEHOLDER,
    x: NEWS_CARD.x,
    y: 988,
    width: NEWS_CARD.width,
    fontSize: 76,
    fontWeight: 600,
    lineHeight: 77,
    letterSpacing: -0.76,
    align: "center",
    shadow: { enabled: true, color: "rgba(0, 13, 51, 0.3)", blur: 12, offsetX: 0, offsetY: 4 },
  })
  const footer = { fontFamily: "Inter", fontSize: 26.7, fontWeight: 500, lineHeight: 34, letterSpacing: -0.83, fill: "#F6FAFF", y: 1291 }
  const icon = { width: 38.5, height: 38.5, y: 1289, fit: "contain" as const, naturalWidth: 34, naturalHeight: 34 }
  return {
    version: DESIGN_VERSION,
    width: NEWS_SIZE,
    height: NEWS_SIZE,
    background: "#0B36BE",
    elements: [
      imageElement({ name: "News Background", role: "decoration", src: PICKLEPLAY_BACKGROUND_SRC, naturalWidth: NEWS_SIZE, naturalHeight: NEWS_SIZE, width: NEWS_SIZE, height: NEWS_SIZE, fit: "cover", locked: true }),
      shapeElement({
        name: "Photo Card",
        role: "overlay",
        ...NEWS_CARD,
        cornerRadius: 36,
        fill: { type: "solid", color: "#1B4FD8" },
        shadow: { enabled: true, color: "rgba(5, 15, 64, 0.35)", blur: 50, offsetX: 0, offsetY: 20 },
        locked: true,
      }),
      imageElement({ name: "Photo", role: "background", ...NEWS_CARD, cornerRadius: 36, fit: "cover", locked: true }),
      // CSS border (inside the card): a 3 px stroke centered 1.5 px inside the edge.
      shapeElement({
        name: "Photo Card Border",
        role: "decoration",
        x: NEWS_CARD.x + 1.5,
        y: NEWS_CARD.y + 1.5,
        width: NEWS_CARD.width - 3,
        height: NEWS_CARD.height - 3,
        cornerRadius: 34.5,
        fill: { type: "solid", color: "rgba(255, 255, 255, 0)" },
        stroke: { color: "rgba(255, 255, 255, 0.45)", width: 3 },
        locked: true,
      }),
      imageElement({ name: "PicklePlay Logo", role: "icon", src: PICKLEPLAY_LOGO_SRC, naturalWidth: 764, naturalHeight: 764, x: 595, y: 38, width: 191, height: 191, fit: "contain", locked: true }),
      headline,
      imageElement({ name: "Website icon", role: "icon", src: ICON_WEB_SRC, x: 304, ...icon }),
      textElement({ name: "Website", role: "footer", text: "www.pickleplay.ph", x: 354.5, width: 300, ...footer }),
      imageElement({ name: "Facebook icon", role: "icon", src: ICON_FACEBOOK_SRC, x: 706, ...icon }),
      textElement({ name: "Facebook", role: "footer", text: "facebook.com/pickleplayofficial", x: 756.5, width: 460, ...footer }),
    ],
    templateId: "pickleplay-news",
    // The headline block (231 px = 3 lines) is centered at y 988 + 231 / 2.
    stack: { enabled: true, anchor: "center", center: 1103.5, bottom: 1219, minTop: 940, maxBottom: 1270, items: [{ id: headline.id, gap: 0 }] },
  }
}

const CARAGA_BLUE = "#1428AE"
const CARAGA_CARD = { x: 87, y: 188, width: 1234, height: 808 }

/**
 * Homes.ph CARAGA news (Figma "Homes.ph CARAGA Article Posting"): 1408 × 1408
 * Homes.ph blue, the white H on top, the photo in a rounded card, a centered
 * 3-line headline (Outfit 600, 76 / 90) and the homes.ph / Facebook footer.
 */
export function buildCaragaNews(content?: { headline?: string }): SlideDesign {
  const headline = textElement({
    name: "Headline",
    role: "title",
    text: content?.headline ?? NEWS_HEADLINE_PLACEHOLDER,
    x: 74,
    y: 1032,
    width: 1260,
    fontSize: 76,
    fontWeight: 600,
    lineHeight: 90,
    letterSpacing: -0.76,
    align: "center",
    shadow: { enabled: true, color: "rgba(0, 13, 51, 0.3)", blur: 12, offsetX: 0, offsetY: 4 },
  })
  const footer = { fontFamily: "Outfit", fontSize: 34, fontWeight: 300, lineHeight: 34, fill: "#FFFFFF", y: 1342 }
  return {
    version: DESIGN_VERSION,
    width: NEWS_SIZE,
    height: NEWS_SIZE,
    background: CARAGA_BLUE,
    elements: [
      shapeElement({ name: "Photo Card", role: "overlay", ...CARAGA_CARD, cornerRadius: 30, fill: { type: "solid", color: "#2B47CC" }, locked: true }),
      imageElement({ name: "Photo", role: "background", ...CARAGA_CARD, cornerRadius: 30, fit: "cover", locked: true }),
      // The white H (its PNG has transparent padding: the mark itself is 103 × 101 at 653, 43).
      imageElement({ name: "Homes.ph Logo", role: "icon", src: LOGO_WHITE_SRC, naturalWidth: LOGO_NATURAL.white.width, naturalHeight: LOGO_NATURAL.white.height, x: 647, y: 38, width: 114, height: 111, fit: "contain", locked: true }),
      headline,
      imageElement({ name: "Website icon", role: "icon", src: ICON_WEB_SRC, x: 271, y: 1347, width: 32, height: 32, fit: "contain", naturalWidth: 34, naturalHeight: 34 }),
      textElement({ name: "Website", role: "footer", text: "www.homes.ph", x: 314, width: 260, ...footer }),
      imageElement({ name: "Facebook icon", role: "icon", src: ICON_FACEBOOK_SRC, x: 612, y: 1346, width: 34, height: 34, fit: "contain", naturalWidth: 34, naturalHeight: 34 }),
      textElement({ name: "Facebook", role: "footer", text: "facebook.com/homesphofficial", x: 656, width: 500, ...footer }),
    ],
    templateId: "caraga-news",
    // Three 90 px lines from y 1032 (centered at 1167); shorter headlines stay centered there.
    stack: { enabled: true, anchor: "center", center: 1167, bottom: 1302, minTop: 1012, maxBottom: 1330, items: [{ id: headline.id, gap: 0 }] },
  }
}

const FHI_NAVY = "#002D5C"
const FHI_LOGO = { src: FHI_LOGO_SRC, naturalWidth: 348, naturalHeight: 133, fit: "contain" as const, locked: true }

/**
 * FHI Global Property news, Template 1 ("post 6pm", Figma): 1152 × 1408 navy,
 * logo and headline at the top, www.fhiglobal.ae, and the photo filling the
 * bottom 933 px (the frame is the mask: move and zoom the photo inside it).
 */
export function buildFhiPortraitNews(content?: { headline?: string }): SlideDesign {
  const frame = { x: 0, y: 475, width: 1152, height: 933 }
  return {
    version: DESIGN_VERSION,
    width: 1152,
    height: 1408,
    background: FHI_NAVY,
    elements: [
      shapeElement({ name: "Photo Frame", role: "overlay", ...frame, fill: { type: "solid", color: "#D9D9D9" }, locked: true }),
      imageElement({ name: "Photo", role: "background", ...frame, fit: "cover", locked: true }),
      imageElement({ name: "FHI Global Logo", role: "icon", x: 74, y: 44, width: 231, height: 85, ...FHI_LOGO }),
      textElement({
        name: "Headline",
        role: "title",
        text: content?.headline ?? NEWS_HEADLINE_PLACEHOLDER,
        x: 71,
        y: 180,
        width: 1008,
        fontSize: 55,
        fontWeight: 700,
        lineHeight: 65,
        // Figma: "AI FREEJ GARDENER: …" — capitals, whatever is typed (Template 2 keeps it as typed).
        textCase: "upper",
      }),
      // Figma box 272 × 32 (line height 25 is tighter than the text): matched by its box height.
      textElement({ name: "Website", role: "footer", text: "www.fhiglobal.ae", x: 74, y: 399, width: 420, fontSize: 35, fontWeight: 300, lineHeight: 32 }),
    ],
    templateId: "fhi-portrait-news",
  }
}

/**
 * FHI Global Property news, Template 2 ("post", Figma): 1742 × 1436, the photo
 * fills the frame under a navy fade, the logo (with drop shadow) top left, and
 * a centered headline above www.fhiglobal.ae. Longer headlines grow upwards.
 */
export function buildFhiWideNews(content?: { headline?: string }): SlideDesign {
  const frame = { x: 0, y: 0, width: 1742, height: 1422 }
  const headline = textElement({
    name: "Headline",
    role: "title",
    text: content?.headline ?? NEWS_HEADLINE_PLACEHOLDER,
    x: 122.5,
    y: 1142,
    width: 1497,
    fontSize: 70,
    fontWeight: 800,
    lineHeight: 80,
    align: "center",
  })
  return {
    version: DESIGN_VERSION,
    width: 1742,
    height: 1436,
    background: BRAND.white,
    elements: [
      shapeElement({ name: "Photo Frame", role: "overlay", ...frame, fill: { type: "solid", color: "#D9D9D9" }, locked: true }),
      imageElement({ name: "Photo", role: "background", ...frame, fit: "cover", locked: true }),
      // linear-gradient(0deg, #002D5C 0%, transparent 100%) over the bottom half.
      shapeElement({
        name: "Bottom Fade",
        role: "overlay",
        x: 0,
        y: 728,
        width: 1742,
        height: 712,
        fill: { type: "linear", angle: 0, stops: [{ offset: 0, color: FHI_NAVY }, { offset: 1, color: "rgba(0, 45, 92, 0)" }] },
        locked: true,
      }),
      imageElement({
        name: "FHI Global Logo",
        role: "icon",
        x: 106,
        y: 48,
        width: 340,
        height: 125,
        shadow: { enabled: true, color: "#000000", blur: 4, offsetX: 0, offsetY: 4 },
        ...FHI_LOGO,
      }),
      headline,
      textElement({ name: "Website", role: "footer", text: "www.fhiglobal.ae", x: 677, y: 1341, width: 388, fontSize: 50, fontWeight: 300, lineHeight: 47, align: "center" }),
    ],
    templateId: "fhi-wide-news",
    // Two lines sit exactly where Figma has them (y 1142); more lines grow upwards.
    stack: { enabled: true, anchor: "bottom", bottom: 1302, minTop: 760, maxBottom: 1330, items: [{ id: headline.id, gap: 0 }] },
  }
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: "homes-cover",
    name: "Homes.ph Carousel Cover",
    description: "Photo with a navy title glow, gold swoosh, white + gold headline and subtitle that auto-fit to one line, and the footer.",
    slideType: "cover",
    build: buildHomesCover,
  },
  {
    id: "classic-cover",
    name: "Classic Cover (Blue Fade)",
    description: "The first cover style: photo with Blue Fade, white + yellow headline, description and footer.",
    slideType: "cover",
    build: buildClassicCover,
  },
  {
    id: "homes-card",
    name: "Homes.ph Content Card",
    description: "Photo with a bottom gradient, title, optional yellow subtitle and description. Leave the subtitle empty for the no-subtitle layout.",
    slideType: "card",
    build: buildHomesCard,
  },
  { id: "text-card", name: "Text-Focused Card", description: "Brand-blue background with a label, bold statement and supporting text.", slideType: "card", build: buildTextCard },
  { id: "full-image", name: "Full-Image Card", description: "Edge-to-edge photo with a short caption.", slideType: "card", build: buildFullImage },
  { id: "quote-stat", name: "Quote or Statistic Card", description: "Big yellow number or quote with a short statement and source.", slideType: "card", build: buildQuoteStat },
]

export function getBuiltInTemplate(id: string): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id)
}

export function buildCoverDesign(ctx: TemplateContext, content?: TemplateContent): SlideDesign {
  return buildHomesCover(ctx, content)
}

export function buildCardDesign(): SlideDesign {
  return buildHomesCard()
}

/** Deep-copies a design with fresh element ids (stack references are remapped). */
export function cloneDesignWithNewIds(source: SlideDesign): SlideDesign {
  const idMap = new Map<string, string>()
  const elements = source.elements.map((el) => {
    const id = shortId()
    idMap.set(el.id, id)
    return { ...structuredClone(el), id }
  })
  const stack = source.stack
    ? {
        ...source.stack,
        items: source.stack.items.filter((i) => idMap.has(i.id)).map((i) => ({ ...i, id: idMap.get(i.id)! })),
      }
    : source.stack
  return { ...structuredClone(source), elements, stack }
}

const CONTENT_ROLES: ElementRole[] = ["headline", "highlight", "title", "subtitle", "description", "label", "stat"]

/**
 * Applies a template's look to an existing slide while keeping its content:
 * text is carried over by role, and the background photo (and a custom logo) are kept.
 */
export function applyTemplateKeepingContent(current: SlideDesign, template: SlideDesign): SlideDesign {
  const next = cloneDesignWithNewIds(template)
  const currentText = new Map<ElementRole, TextElement>()
  for (const el of current.elements) {
    if (el.type === "text" && el.role && CONTENT_ROLES.includes(el.role) && !currentText.has(el.role)) {
      currentText.set(el.role, el)
    }
  }
  const currentBackground = current.elements.find(
    (el): el is ImageElement => el.type === "image" && el.role === "background" && !!el.src,
  )
  const customLogo = current.elements.find(
    (el): el is ImageElement => el.type === "image" && el.role === "logo" && !el.logoVariant && !!el.src,
  )

  // Headline-style roles are interchangeable between cover and card layouts.
  const fallbacks: Partial<Record<ElementRole, ElementRole[]>> = {
    title: ["headline"],
    headline: ["title"],
    subtitle: ["highlight"],
    highlight: ["subtitle"],
  }
  const used = new Set<ElementRole>()
  next.elements = next.elements.map((el) => {
    if (el.type === "text" && el.role) {
      const candidates = [el.role, ...(fallbacks[el.role] ?? [])]
      const match = candidates.find((r) => currentText.has(r) && !used.has(r))
      if (match) {
        used.add(match)
        return { ...el, text: currentText.get(match)!.text }
      }
    }
    if (el.type === "image" && el.role === "background" && currentBackground) {
      return {
        ...el,
        src: currentBackground.src,
        assetId: currentBackground.assetId,
        publicId: currentBackground.publicId,
        naturalWidth: currentBackground.naturalWidth,
        naturalHeight: currentBackground.naturalHeight,
        zoom: currentBackground.zoom,
        focusX: currentBackground.focusX,
        focusY: currentBackground.focusY,
        uploadId: currentBackground.uploadId,
      }
    }
    if (el.type === "image" && el.role === "logo" && customLogo) {
      return {
        ...el,
        src: customLogo.src,
        assetId: customLogo.assetId,
        publicId: customLogo.publicId,
        naturalWidth: customLogo.naturalWidth,
        naturalHeight: customLogo.naturalHeight,
        logoVariant: null,
        logoResolved: null,
      }
    }
    return el
  })
  // Keep the photo when moving to a template that has no background image slot.
  if (currentBackground && !next.elements.some((el) => el.type === "image" && el.role === "background")) {
    next.elements = [{ ...structuredClone(currentBackground), id: shortId() }, ...next.elements]
  }
  return next
}

/** Searchable/denormalized fields stored next to design_json. */
export function summarizeDesign(design: SlideDesign) {
  const textOf = (...roles: ElementRole[]) => {
    for (const role of roles) {
      const el = design.elements.find((e): e is TextElement => e.type === "text" && e.role === role)
      if (el) return el.text
    }
    return null
  }
  const background = design.elements.find(
    (el): el is ImageElement => el.type === "image" && el.role === "background" && !!el.src,
  )
  const persistable = background?.src && !background.src.startsWith("blob:") ? background : undefined
  return {
    title: textOf("headline", "title", "stat"),
    subtitle: textOf("highlight", "subtitle"),
    description: textOf("description"),
    background_image_url: persistable?.src ?? null,
    background_public_id: persistable?.publicId ?? null,
  }
}

/** Short label for a slide (frame names on the board, file lists). */
export function slideLabel(design: SlideDesign, fallback: string): string {
  const s = summarizeDesign(design)
  const text = [s.title, design.templateId === "homes-cover" || design.templateId === "classic-cover" ? s.subtitle : null].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  return text || fallback
}
