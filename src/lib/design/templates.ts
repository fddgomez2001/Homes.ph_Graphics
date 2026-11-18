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
  PICKLEPLAY_PORTRAIT_BACKGROUND_SRC,
  PICKLEPLAY_LOGO_SRC,
  FHI_POSTER_LOGO_SRC,
  FHI_LOGO_SRC,
  FHI_EMBLEM_SRC,
  POSTER_PICKLEBALL_SRC,
  RENTSOUQ_LOGO_SRC,
  SWOOSH_LEFT_SRC,
  SWOOSH_SRC,
} from "./constants"
import { collagePhoto, transferCollage } from "./cover-collage"
import type {
  DesignElement,
  ElementRole,
  Fill,
  ImageElement,
  LogoVariant,
  ShapeElement,
  SlideDesign,
  SlideType,
  SubtextStyle,
  TextBoxFit,
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

export type BuiltInTemplateId =
  | "homes-cover"
  | "classic-cover"
  | "homes-card"
  | "text-card"
  | "full-image"
  | "quote-stat"
  | "fhi-cover"
  | "fhi-card"
  | "pickleplay-cover"
  | "pickleplay-card"
  | "gensan-cover"
  | "gensan-card"

export interface BuiltInTemplate {
  id: BuiltInTemplateId
  name: string
  description: string
  slideType: SlideType
  build: (ctx: TemplateContext, content?: TemplateContent) => SlideDesign
  /** The carousel brand it belongs to (Homes.ph when not set). */
  brand?: CarouselBrand
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
  return buildBrandCover("homes", ctx, content)
}

/**
 * Carousel Card (Figma): photo, blue gradient from y 440, logo, and bottom-aligned
 * Card Title (90/80), Card Subtitle (40/80, #FFF1B9) and Card Description (40/50).
 * With an empty subtitle the title moves down to y 1016, as in the no-subtitle layout.
 */
function buildHomesCard(): SlideDesign {
  return buildBrandCard("homes")
}

// ---------- carousel brands: Homes.ph, FHI Global Property, PicklePlay ----------

/**
 * Whose carousel it is: the Homes.ph template (Homes.ph, or Homes.ph Gensan for the Gensan page: same
 * design, the AI writes about General Santos City and SOCCSKSARGEN), or the same layout in FHI Global
 * Property's or PicklePlay's colors.
 */
export type CarouselBrand = "homes" | "gensan" | "fhi" | "pickleplay"

export const CAROUSEL_BRANDS: { id: CarouselBrand; name: string; logo: string; accent: string; dark: string }[] = [
  { id: "homes", name: "Homes.ph", logo: "/brand/homes-ph-logo-blue.png", accent: "#FDBA2F", dark: "#0B1F8E" },
  { id: "gensan", name: "Homes.ph Gensan", logo: "/brand/homes-ph-logo-blue.png", accent: "#FDBA2F", dark: "#0B1F8E" },
  { id: "fhi", name: "FHI Global Property", logo: FHI_EMBLEM_SRC, accent: "#F8C563", dark: "#001F3F" },
  { id: "pickleplay", name: "PicklePlay", logo: PICKLEPLAY_LOGO_SRC, accent: "#AFD137", dark: "#0A2CAA" },
]

export const isCarouselBrand = (v: unknown): v is CarouselBrand => v === "homes" || v === "gensan" || v === "fhi" || v === "pickleplay"

/** Homes.ph and Homes.ph Gensan carousels use the Homes.ph design (white logo tile, navy and gold). */
export const isHomesLook = (brand: CarouselBrand) => brand === "homes" || brand === "gensan"

interface CarouselTheme {
  cover: string
  card: string
  /** Canvas color behind the photo. */
  background: string
  glow: Fill
  topBand: Fill
  bottomBand: Fill
  cardGradient: Fill
  cardGradientName: string
  /** Headline line 2: its color and the gradient across it. */
  accent: string
  accentGradient: Extract<Fill, { type: "linear" }>
  shadow: TextShadow
  /** Card subtitle color. */
  cardSubtitle: string
  swoosh: { right: string; left: string }
  logo: () => DesignElement
  footer: (ctx: TemplateContext) => DesignElement[]
}

/** The cover's and card's dark band at the top behind the logo. */
function bandShape(fill: Fill): ShapeElement {
  return shapeElement({ name: "Top Band", role: "overlay", x: 0, y: 0, width: CANVAS_SIZE, height: 226, fill, locked: true })
}

/** A brand's website and Facebook page, centered at the bottom like the Homes.ph footer. */
function brandFooter(web: string, fb: string): DesignElement[] {
  const footerText = { fontSize: 35, fontWeight: 300, lineHeight: 25 }
  // Light 35 px text is about 0.46 em per character: the group is centered on that.
  const webW = Math.ceil(web.length * 35 * 0.46)
  const fbW = Math.ceil(fb.length * 35 * 0.46)
  const total = 34 + 10 + webW + 30 + 34 + 10 + fbW
  const x = Math.round(CANVAS_SIZE / 2 - total / 2)
  const fbIcon = x + 44 + webW + 30
  return [
    imageElement({ name: "Website icon", role: "icon", x, y: 1169, width: 34, height: 34, src: ICON_WEB_SRC, naturalWidth: 34, naturalHeight: 34, fit: "contain" }),
    textElement({ name: "Website", role: "footer", text: web, x: x + 44, y: 1170, width: webW + 40, ...footerText }),
    imageElement({ name: "Facebook icon", role: "icon", x: fbIcon, y: 1169, width: 34, height: 34, src: ICON_FACEBOOK_SRC, naturalWidth: 34, naturalHeight: 34, fit: "contain" }),
    textElement({ name: "Facebook", role: "footer", text: fb, x: fbIcon + 44, y: 1173, width: fbW + 60, ...footerText }),
  ]
}

const glowOf = (r: number, g: number, b: number): Fill => ({
  type: "radial",
  cx: 0.5,
  cy: 0.5,
  rx: 0.5449,
  ry: 0.5449,
  stops: [
    { offset: 0.2788, color: `rgba(${r}, ${g}, ${b}, 0.88)` },
    { offset: 0.7404, color: `rgba(${r}, ${g}, ${b}, 0.6)` },
    { offset: 1, color: `rgba(${r}, ${g}, ${b}, 0)` },
  ],
})
const fadeDown = (r: number, g: number, b: number, alpha: number): Fill => ({
  type: "linear",
  angle: 180,
  stops: [
    { offset: 0, color: `rgba(${r}, ${g}, ${b}, ${alpha})` },
    { offset: 0.927, color: `rgba(${r}, ${g}, ${b}, 0)` },
  ],
})
const fadeUp = (solid: string, r: number, g: number, b: number, end: number): Fill => ({
  type: "linear",
  angle: 0,
  stops: [
    { offset: 0, color: solid },
    { offset: end, color: `rgba(${r}, ${g}, ${b}, 0)` },
  ],
})

const HOMES_THEME: CarouselTheme = {
  cover: "homes-cover",
  card: "homes-card",
  background: "#0B1F8E",
  glow: TITLE_GLOW,
  topBand: TOP_BAND_FILL,
  bottomBand: BOTTOM_BAND_FILL,
  cardGradient: CARD_GRADIENT,
  cardGradientName: "Blue Gradient",
  accent: "#FDBA2F",
  accentGradient: GOLD_TEXT,
  shadow: TITLE_SHADOW,
  cardSubtitle: "#FFF1B9",
  swoosh: { right: SWOOSH_SRC, left: SWOOSH_LEFT_SRC },
  logo: () => logoElement(),
  footer: (ctx) => footerElements(ctx),
}

const CAROUSEL_THEMES: Record<CarouselBrand, CarouselTheme> = {
  homes: HOMES_THEME,
  // Homes.ph Gensan: the Homes.ph design; its own template ids mark the carousel as Gensan's.
  gensan: { ...HOMES_THEME, cover: "gensan-cover", card: "gensan-card" },
  // FHI Global Property: navy #001F3F and champagne gold, the gold FHI emblem, fhiglobal.ae.
  fhi: {
    cover: "fhi-cover",
    card: "fhi-card",
    background: "#001F3F",
    glow: glowOf(0, 31, 63),
    topBand: fadeDown(0, 31, 63, 0.72),
    bottomBand: fadeUp("#001F3F", 0, 31, 63, 0.7407),
    cardGradient: fadeUp("#001F3F", 0, 31, 63, 1),
    cardGradientName: "Navy Gradient",
    accent: "#F8C563",
    accentGradient: { type: "linear", angle: 90, stops: [{ offset: 0.0817, color: "#D6B357" }, { offset: 0.9135, color: "#F8E3A6" }] },
    shadow: { enabled: true, color: "rgba(0, 10, 25, 0.5)", blur: 18, offsetX: 0, offsetY: 6 },
    cardSubtitle: "#F3E3B5",
    swoosh: { right: "/brand/carousel/fhi-top-right-swoosh.png", left: "/brand/carousel/fhi-top-left-swoosh.png" },
    logo: () =>
      imageElement({
        name: "FHI Emblem",
        role: "icon",
        src: FHI_EMBLEM_SRC,
        naturalWidth: 110,
        naturalHeight: 133,
        x: 581,
        y: 28,
        width: 92,
        height: 111,
        fit: "contain",
        shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
        locked: true,
      }),
    footer: () => brandFooter("www.fhiglobal.ae", "facebook.com/fhiglobal"),
  },
  // PicklePlay: royal blue #0A2CAA and lime #AFD137, the round PicklePlay logo, pickleplay.ph.
  pickleplay: {
    cover: "pickleplay-cover",
    card: "pickleplay-card",
    background: "#0A2CAA",
    glow: glowOf(8, 36, 150),
    topBand: fadeDown(10, 44, 170, 0.7),
    bottomBand: fadeUp("#0A2CAA", 10, 44, 170, 0.7407),
    cardGradient: fadeUp("#0A2CAA", 10, 44, 170, 1),
    cardGradientName: "Blue Gradient",
    accent: "#AFD137",
    accentGradient: { type: "linear", angle: 90, stops: [{ offset: 0.0817, color: "#AFD137" }, { offset: 0.9135, color: "#DDEF80" }] },
    shadow: { enabled: true, color: "rgba(4, 18, 80, 0.5)", blur: 18, offsetX: 0, offsetY: 6 },
    cardSubtitle: "#E3F3A6",
    swoosh: { right: "/brand/carousel/pickleplay-top-right-swoosh.png", left: "/brand/carousel/pickleplay-top-left-swoosh.png" },
    logo: () =>
      imageElement({
        name: "PicklePlay Logo",
        role: "icon",
        src: PICKLEPLAY_LOGO_SRC,
        naturalWidth: 764,
        naturalHeight: 764,
        x: 569,
        y: 24,
        width: 116,
        height: 116,
        fit: "contain",
        shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
        locked: true,
      }),
    footer: () => brandFooter("www.pickleplay.ph", "facebook.com/pickleplayofficial"),
  },
}

/** The brand of a carousel slide's template (Homes.ph for older and custom slides). */
export function carouselBrandOf(templateId: string | null | undefined): CarouselBrand {
  for (const [brand, theme] of Object.entries(CAROUSEL_THEMES) as [CarouselBrand, CarouselTheme][]) {
    if (templateId === theme.cover || templateId === theme.card) return brand
  }
  return "homes"
}

/** A content card of any brand (title, subtitle, a 2–3 line description). */
export function isContentCard(templateId: string | null | undefined): boolean {
  return Object.values(CAROUSEL_THEMES).some((t) => t.card === templateId)
}

/** A carousel cover of any brand. */
export function isCarouselCover(templateId: string | null | undefined): boolean {
  return Object.values(CAROUSEL_THEMES).some((t) => t.cover === templateId)
}

/**
 * Carousel Cover (Figma "1"): photo on the brand's dark color, two blurred Title Glow gradients
 * (the second at 41%), the Top Band, the corner swoosh at the top right and mirrored at the top
 * left, the bottom gradient, the brand's logo and the auto-fitted Title Block (1062 px, centered at
 * y 598): Headline Line 1 (White, 900, 172), 5 px, Headline Line 2 (the brand's accent gradient,
 * 900, 148), 20 px, Subtitle (600, 50 / 63). Each line stays on one line and shrinks to fit, like
 * the Title Auto-Fit plugin. Homes.ph: navy and gold; FHI: navy #001F3F and champagne gold;
 * PicklePlay: royal blue and lime.
 */
export function buildBrandCover(brand: CarouselBrand, ctx: TemplateContext, content?: TemplateContent): SlideDesign {
  const theme = CAROUSEL_THEMES[brand]
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
    shadow: theme.shadow,
    autoFit: { maxWidth: TITLE_BLOCK.width, maxSize: 172, letterSpacingEm: 0 },
  })
  const line2 = textElement({
    name: brand === "pickleplay" ? "Headline Line 2 (Lime)" : "Headline Line 2 (Gold)",
    role: "highlight",
    text: content?.yellow ?? "Goes Here",
    ...TITLE_BLOCK,
    y: 571,
    fontSize: 148,
    fontWeight: 900,
    lineHeight: 148,
    align: "center",
    fill: theme.accent,
    fillGradient: theme.accentGradient,
    shadow: theme.shadow,
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
    shadow: theme.shadow,
    autoFit: { maxWidth: TITLE_BLOCK.width, maxSize: 50, letterSpacingEm: 0, lineHeightRatio: 63 / 50 },
  })
  return design(
    [
      backgroundImage(),
      shapeElement({ name: "Title Glow Gradient", role: "overlay", x: -200, y: 251, width: 1627, height: 655, fill: theme.glow, blur: 156.5, locked: true }),
      shapeElement({ name: "Title Glow Gradient 2", role: "overlay", x: -200, y: 251, width: 1627, height: 655, fill: theme.glow, blur: 156.5, opacity: 0.41, locked: true }),
      isHomesLook(brand) ? topBand() : bandShape(theme.topBand),
      imageElement({ name: "Top Right Swoosh", role: "decoration", src: theme.swoosh.right, naturalWidth: 1254, naturalHeight: 1254, fit: "contain", locked: true }),
      imageElement({ name: "Top Left Swoosh", role: "decoration", src: theme.swoosh.left, naturalWidth: 1254, naturalHeight: 1254, fit: "contain", locked: true }),
      shapeElement({ name: "Bottom Band", role: "overlay", y: 876, height: 378, fill: theme.bottomBand, locked: true }),
      theme.logo(),
      line1,
      line2,
      subtitle,
      ...theme.footer(ctx),
    ],
    {
      templateId: theme.cover,
      background: theme.background,
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
 * Carousel Card (Figma): photo, the brand's gradient from y 440, the brand's logo, and
 * bottom-aligned Card Title (90/80), Card Subtitle (40/80, the brand's light accent) and Card
 * Description (40/50). With an empty subtitle the title moves down, as in the no-subtitle layout.
 */
export function buildBrandCard(brand: CarouselBrand): SlideDesign {
  const theme = CAROUSEL_THEMES[brand]
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
    fill: theme.cardSubtitle,
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
      shapeElement({ name: theme.cardGradientName, role: "overlay", y: 440, height: 814, fill: theme.cardGradient, locked: true }),
      isHomesLook(brand) ? topBand() : bandShape(theme.topBand),
      theme.logo(),
      title,
      subtitle,
      description,
    ],
    {
      templateId: theme.card,
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

/** The Homes.ph daily-page news templates (CARAGA and Gensan share the Homes.ph designs). */
// "homes-…-news": the other Homes.ph pages' News Article posts (1.50), the page's name kept on the post (design.page).
export type HomesNewsTemplateId = "caraga-news" | "caraga-portrait-news" | "gensan-news" | "gensan-portrait-news" | "homes-news" | "homes-portrait-news"

/**
 * Homes.ph CARAGA news, Old Template (Figma "Homes.ph CARAGA Article Posting"): 1408 × 1408
 * Homes.ph blue, the white H on top, the photo in a rounded card, a centered
 * 3-line headline (Outfit 600, 76 / 90) and the homes.ph / Facebook footer.
 */
export function buildCaragaNews(content?: { headline?: string }, templateId: HomesNewsTemplateId = "caraga-news"): SlideDesign {
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
    templateId,
    // Three 90 px lines from y 1032 (centered at 1167); shorter headlines stay centered there.
    stack: { enabled: true, anchor: "center", center: 1167, bottom: 1302, minTop: 1012, maxBottom: 1330, items: [{ id: headline.id, gap: 0 }] },
  }
}

/** The New Template of PicklePlay PH and Homes.ph (Figma, 1126 × 1408). */
export const PORTRAIT_NEWS = { width: 1126, height: 1408 }
/** Its photo frame: 1026 × 785 at 50, 188, radius 30. */
const PORTRAIT_PHOTO = { x: 50, y: 188, width: 1026, height: 785 }
/** Figma's text-shadow / drop-shadow: 0 4px 6.5px rgba(0, 0, 0, 0.25). */
const PORTRAIT_SHADOW = { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 6.5, offsetX: 0, offsetY: 4 }
/** Footer text (Outfit 300, 35 px, line height 25), white. */
const PORTRAIT_FOOTER = { fontFamily: "Outfit", fontSize: 35, fontWeight: 300, lineHeight: 25, fill: "#FFFFFF" }

/**
 * The New Template's headline (PicklePlay PH and Homes.ph alike, Figma): Outfit 600, 65 / 90,
 * white, centered in 1026 px at 50, 1018 (3 lines), text-shadow 0 4px 6.5px rgba(0, 0, 0, 0.25).
 */
export const PORTRAIT_HEADLINE = {
  x: 50,
  y: 1018,
  width: 1026,
  fontFamily: "Outfit",
  fontSize: 65,
  fontWeight: 600,
  lineHeight: 90,
  letterSpacing: 0,
  align: "center" as const,
  fill: "#FFFFFF",
  shadow: PORTRAIT_SHADOW,
  // Its three lines (270 px): 65 px in the design, up to 82 px for a short headline (same number of
  // lines, so it fills the width), smaller for one that would need a fourth line.
  boxFit: { maxHeight: 270, maxSize: 65, minSize: 34, lineHeightRatio: 90 / 65, letterSpacingEm: 0, growTo: 82 },
}

/** Three 90 px lines from y 1018 (centered at 1153); shorter headlines stay centered there. */
export const PORTRAIT_HEADLINE_STACK = { enabled: true, anchor: "center" as const, center: 1153, bottom: 1288, minTop: 985, maxBottom: 1336 }

function portraitFooter(web: { icon: number; text: number; label: string }, facebook: { icon: number; text: number; label: string }): DesignElement[] {
  const icon = { y: 1346, width: 34, height: 34, fit: "contain" as const, naturalWidth: 34, naturalHeight: 34 }
  return [
    imageElement({ name: "Website icon", role: "icon", src: ICON_WEB_SRC, x: web.icon, ...icon }),
    // Widths have room to spare (left-aligned) so font metrics never force a wrap.
    textElement({ name: "Website", role: "footer", text: web.label, x: web.text, y: 1347, width: 300, ...PORTRAIT_FOOTER }),
    imageElement({ name: "Facebook icon", role: "icon", src: ICON_FACEBOOK_SRC, x: facebook.icon, ...icon }),
    textElement({ name: "Facebook", role: "footer", text: facebook.label, x: facebook.text, y: 1350, width: 540, ...PORTRAIT_FOOTER }),
  ]
}

function portraitPhoto(): DesignElement[] {
  return [
    shapeElement({ name: "Photo Frame", role: "overlay", ...PORTRAIT_PHOTO, cornerRadius: 30, fill: { type: "solid", color: "#D9D9D9" }, locked: true }),
    imageElement({ name: "Photo", role: "background", ...PORTRAIT_PHOTO, cornerRadius: 30, fit: "cover", locked: true }),
  ]
}

/**
 * Homes.ph news, New Template (Figma "post", 1126 × 1408): Homes.ph blue, the white H
 * (116 × 114 at 505, 37), the photo (1026 × 785 at 50, 188, radius 30), the headline
 * (Outfit 600, 65 / 90, centered in 1026 px at y 1018, 3 lines) and the footer group
 * (868 × 34 at 129, 1346): web icon, www.homes.ph, Facebook icon, facebook.com/homesphofficial.
 */
export function buildCaragaPortraitNews(content?: { headline?: string }, templateId: HomesNewsTemplateId = "caraga-portrait-news"): SlideDesign {
  const headline = textElement({ name: "Headline", role: "title", text: content?.headline ?? NEWS_HEADLINE_PLACEHOLDER, ...PORTRAIT_HEADLINE })
  return {
    version: DESIGN_VERSION,
    ...PORTRAIT_NEWS,
    background: CARAGA_BLUE,
    elements: [
      ...portraitPhoto(),
      imageElement({ name: "Homes.ph Logo", role: "icon", src: LOGO_WHITE_SRC, naturalWidth: LOGO_NATURAL.white.width, naturalHeight: LOGO_NATURAL.white.height, x: 505, y: 37, width: 116, height: 114, fit: "contain", locked: true }),
      headline,
      ...portraitFooter({ icon: 129, text: 173, label: "www.homes.ph" }, { icon: 471, text: 515, label: "facebook.com/homesphofficial" }),
    ],
    templateId,
    stack: { ...PORTRAIT_HEADLINE_STACK, items: [{ id: headline.id, gap: 0 }] },
  }
}

/**
 * PicklePlay news, New Template (Figma "New_Pickleplay_Article_Template_Styled 1",
 * 1126 × 1408): the PicklePlay background (gradient, glow, swooshes, faded ball), the
 * logo (115 × 115 at 505, 35, drop shadow), the photo (1026 × 785 at 50, 188), the
 * white headline (as on the Homes.ph New Template: Outfit 600, 65 / 90, soft shadow,
 * 3 lines from y 1018) and the website / Facebook footer.
 */
export function buildPickleplayPortraitNews(content?: { headline?: string }): SlideDesign {
  const headline = textElement({ name: "Headline", role: "title", text: content?.headline ?? NEWS_HEADLINE_PLACEHOLDER, ...PORTRAIT_HEADLINE })
  return {
    version: DESIGN_VERSION,
    ...PORTRAIT_NEWS,
    background: "#0B36BE",
    elements: [
      imageElement({ name: "News Background", role: "decoration", src: PICKLEPLAY_PORTRAIT_BACKGROUND_SRC, naturalWidth: 1126, naturalHeight: 1408, x: 0, y: 0, ...PORTRAIT_NEWS, fit: "cover", locked: true }),
      ...portraitPhoto(),
      imageElement({
        name: "PicklePlay Logo",
        role: "icon",
        src: PICKLEPLAY_LOGO_SRC,
        naturalWidth: 764,
        naturalHeight: 764,
        x: 505,
        y: 35,
        width: 115,
        height: 115,
        fit: "contain",
        shadow: { enabled: true, color: "rgba(0, 0, 0, 0.38)", blur: 4, offsetX: 0, offsetY: 4 },
        locked: true,
      }),
      headline,
      // The Homes.ph footer group's layout (icon, 10 px, text, 60 px, icon, 10 px, text), centered.
      ...portraitFooter({ icon: 101, text: 145, label: "www.pickleplay.ph" }, { icon: 492, text: 536, label: "facebook.com/pickleplayofficial" }),
    ],
    templateId: "pickleplay-portrait-news",
    stack: { ...PORTRAIT_HEADLINE_STACK, items: [{ id: headline.id, gap: 0 }] },
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

// ---------- Posters (1254 × 1254, Figma "FHI Poster" / "Pickleplay Poster") ----------

/** The poster logos' filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.25)). */
export const POSTER_LOGO_SHADOW = { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 }

/** "Photo Card" / "Poster Image": 1003 × 661 at 125, 229, with box-shadow 0 20px 50px rgba(5, 15, 64, 0.35). */
const POSTER_CARD = { x: 125, y: 229, width: 1003, height: 661 }
const POSTER_CARD_SHADOW = { enabled: true, color: "rgba(5, 15, 64, 0.35)", blur: 50, offsetX: 0, offsetY: 20 }
/** The headline block: 1006 × 231 at 122, 936, text centered on it both ways. */
const POSTER_HEADLINE = { x: 122, y: 936, width: 1006, height: 231 }

/** Where a poster's parts go: the Old Template (1254 × 1254) or the New Template (1126 × 1408). */
export interface PosterGeometry {
  width: number
  height: number
  card: { x: number; y: number; width: number; height: number }
  /** The photo card's corner radius (its 6 px border inside it is 3 px less). */
  cardRadius: number
  /** The headline block (a headline-only poster is centered on it). */
  headline: { x: number; y: number; width: number; height: number }
  /** The subtext's box and its line (a 30 px line centered in a 62 px box). */
  subtext: { x: number; width: number; boxTop: number; boxBottom: number; lineTop: number; lineBottom: number }
  /** Free space under the subtext's line (above the footer) that small text may grow into. */
  textSpare: number
  /** The photo credit's top (right-aligned to the card's right edge). */
  creditY: number
  /** Event posters: the area for the headline and the two detail lines, and those lines' box. */
  event: { top: number; bottom: number; x: number; width: number }
}

/** The Old Template, 1254 × 1254 (Figma "FHI Poster" / "Pickleplay Poster"). */
const SQUARE_POSTER: PosterGeometry = {
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  card: POSTER_CARD,
  cardRadius: 0,
  headline: POSTER_HEADLINE,
  subtext: { x: 124, width: 1003, boxTop: 1111, boxBottom: 1173, lineTop: 1127, lineBottom: 1157 },
  // Down to the subtext box's bottom (the footer starts at 1196).
  textSpare: 16,
  creditY: 890,
  // Below the photo credit and above the footer; the detail lines stay clear of the pickleball.
  event: { top: 932, bottom: 1178, x: 227, width: 800 },
}

/**
 * The New Template, 1126 × 1408 (Figma "Pickleplay_Poster", "FHI_Poster", "Homes_Poster" and their
 * "_With_Subtext" versions, measured from the SVG exports): the photo 1026 × 785 at 50, 188 with the
 * 6 px border inside it, the photo credit right-aligned under it, the headline (League Spartan 700,
 * 68 / 68: three lines from 1069.2, or two lines ending 7.5 px above the subtext line 1221.7–1251.7),
 * the footer at 1355 and the logo centered at the top.
 */
const PORTRAIT_POSTER: PosterGeometry = {
  width: 1126,
  height: 1408,
  card: { x: 50, y: 188, width: 1026, height: 785 },
  // Figma: the photo's corners are 30 px curves (its border's 27 px).
  cardRadius: 30,
  headline: { x: 50, y: 1055.7, width: 1026, height: 231 },
  subtext: { x: 50, width: 1026, boxTop: 1205.7, boxBottom: 1267.7, lineTop: 1221.7, lineBottom: 1251.7 },
  // The footer is at 1350: text may run down to 1295.7 and still leave 54 px above it.
  textSpare: 44,
  creditY: 978.75,
  event: { top: 1020.75, bottom: 1332, x: 113, width: 900 },
}

/** The New Template posters (1126 × 1408). */
export const PORTRAIT_POSTER_IDS: readonly string[] = [
  "pickleplay-portrait-poster-news",
  "pickleplay-portrait-event-poster-news",
  "fhi-portrait-poster-news",
  "homes-portrait-poster-news",
  "gensan-portrait-poster-news",
  "rentsouq-portrait-poster-news",
]

/** A poster template's geometry (the Old Template's for anything else). */
export function posterGeometry(templateId: string | null | undefined): PosterGeometry {
  return templateId && PORTRAIT_POSTER_IDS.includes(templateId) ? PORTRAIT_POSTER : SQUARE_POSTER
}

/** A New Template logo: its box and drop shadow, and what changes on the poster with a subtext (Figma has two frames). */
interface PortraitLogo {
  name: string
  x: number
  y: number
  width: number
  height: number
  shadow: boolean
  /** Its own drop shadow (Rentsouq.ae: 0 3.12px 3.12px), else POSTER_LOGO_SHADOW. */
  shadowLook?: { blur: number; offsetY: number }
  withSubtext?: { y?: number; shadow?: boolean }
}

/**
 * The New Template logos, from the Figma CSS and SVGs (2026-11-10), centered at the top:
 *   PicklePlay (the re-exported "Pickleplay_Poster" frames): 139 × 139 at 494, 29; with a subtext at 494, 27;
 *   FHI: 104 tall, left / right 37.48% (422, 282 wide), top 42;
 *   Homes.ph: left / right 44.76% (504, 118 wide), top 2.63% (37), 115 tall; its drop shadow only on the subtext frame.
 *   Rentsouq.ae (SVGs of 2026-11-13): 433.68 × 136.5 at 346, 21; with a subtext at 346, 23; drop-shadow 0 3.12px 3.12px.
 */
const PORTRAIT_LOGOS: Record<string, PortraitLogo> = {
  "pickleplay-portrait-poster-news": { name: "PicklePlay Logo", x: 494, y: 29, width: 139, height: 139, shadow: true, withSubtext: { y: 27 } },
  "pickleplay-portrait-event-poster-news": { name: "PicklePlay Logo", x: 494, y: 29, width: 139, height: 139, shadow: true },
  "fhi-portrait-poster-news": { name: "FHI Global Logo", x: 422, y: 42, width: 282, height: 104, shadow: true },
  "homes-portrait-poster-news": { name: "Homes.ph Logo", x: 504, y: 37, width: 118, height: 115, shadow: false, withSubtext: { shadow: true } },
  "gensan-portrait-poster-news": { name: "Homes.ph Logo", x: 504, y: 37, width: 118, height: 115, shadow: false, withSubtext: { shadow: true } },
  "rentsouq-portrait-poster-news": {
    name: "Rentsouq Logo",
    x: 346,
    y: 21,
    width: 433.68,
    height: 136.5,
    shadow: true,
    shadowLook: { blur: 3.12, offsetY: 3.12 },
    withSubtext: { y: 23 },
  },
}

/** The logo's box and shadow for a poster with or without its subtext. */
function portraitLogoLook(logo: PortraitLogo, withSubtext: boolean) {
  const y = (withSubtext ? logo.withSubtext?.y : undefined) ?? logo.y
  const shadow = (withSubtext ? logo.withSubtext?.shadow : undefined) ?? logo.shadow
  return { x: logo.x, y, width: logo.width, height: logo.height, shadow: { ...POSTER_LOGO_SHADOW, ...logo.shadowLook, enabled: shadow } }
}

/** Puts a New Template poster's logo where Figma has it (with or without the subtext). Other posters are left as they are. */
function placePortraitLogo(design: SlideDesign, withSubtext: boolean): SlideDesign {
  const logo = PORTRAIT_LOGOS[design.templateId ?? ""]
  if (!logo) return design
  const look = portraitLogoLook(logo, withSubtext)
  return { ...design, elements: design.elements.map((el) => (el.type === "image" && el.name === logo.name ? { ...el, ...look } : el)) }
}

/** A New Template poster's brand gradient angle (the Figma CSS). */
const PORTRAIT_GRADIENT_ANGLES: Record<string, number> = {
  "pickleplay-portrait-poster-news": 181.36,
  "pickleplay-portrait-event-poster-news": 181.36,
  "fhi-portrait-poster-news": 0.33,
  "homes-portrait-poster-news": 180.33,
  "gensan-portrait-poster-news": 180.33,
  "rentsouq-portrait-poster-news": 0.41,
}

/**
 * The Rentsouq.ae gradient (at 70%): navy #001F3F at 2.57% of Figma's line to blue #205ED7 at 24.04%
 * (23.56% on the subtext frame), blue above that. New Template: the line (563, 1408) to (576, -408),
 * as CSS 0.41deg with #001F3F 3.58% and #205ED7 31.11% (30.50%). Old Template: (627, 1254) to
 * (641.33, -363.37), as CSS 0.51deg with #001F3F 3.73% and #205ED7 31.17% (30.56%).
 */
function rentsouqGradient(angle: number, navyEnd: number, blueFrom: number): Extract<Fill, { type: "linear" }> {
  return {
    type: "linear",
    angle,
    stops: [
      { offset: 0, color: "#001F3F" },
      { offset: navyEnd, color: "#001F3F" },
      { offset: blueFrom, color: "#205ED7" },
      { offset: 1, color: "#205ED7" },
    ],
  }
}

/** Posters whose brand gradient is a little different on the subtext frame (Figma has two frames). */
const SUBTEXT_FRAME_GRADIENTS: Record<string, { without: Fill; with: Fill }> = {
  "rentsouq-portrait-poster-news": { without: rentsouqGradient(0.41, 0.0358, 0.3111), with: rentsouqGradient(0.41, 0.0358, 0.305) },
  "rentsouq-poster-news": { without: rentsouqGradient(0.51, 0.0373, 0.3117), with: rentsouqGradient(0.51, 0.0373, 0.3056) },
}

/** The brand gradient of the frame with or without the subtext (only posters listed above change). */
function placeSubtextGradient(design: SlideDesign, withSubtext: boolean): SlideDesign {
  const frames = SUBTEXT_FRAME_GRADIENTS[design.templateId ?? ""]
  if (!frames) return design
  const fill = withSubtext ? frames.with : frames.without
  return { ...design, elements: design.elements.map((el) => (el.type === "shape" && el.name === "Brand Gradient" ? { ...el, fill } : el)) }
}

/**
 * PicklePlay New Template posters made with 1.37 had a fixed background picture: they get the real
 * design (1.38): navy, their own photo faded over the whole poster, the PicklePlay gradient and the
 * pickleball in the corner. Text, photo and everything else stay.
 */
function rebackPickleplayPortrait(design: SlideDesign): SlideDesign {
  const art = design.elements.find((el) => el.type === "image" && el.name === "Poster Background Art")
  if (!art) return design
  const photo = design.elements.find(
    (el): el is ImageElement => el.type === "image" && el.role === "background" && (el.width < design.width || el.height < design.height),
  )
  const backdrop = posterBackdrop(PICKLEPLAY_PORTRAIT_GRADIENT, PORTRAIT_POSTER).map((el): DesignElement =>
    el.type === "image" && photo?.src
      ? { ...el, src: photo.src, naturalWidth: photo.naturalWidth, naturalHeight: photo.naturalHeight, assetId: photo.assetId ?? null, publicId: photo.publicId ?? null, visible: true }
      : el,
  )
  const elements = design.elements.flatMap((el) => (el.id === art.id ? backdrop : [el]))
  if (!elements.some((el) => el.name === "Pickleball")) elements.push(pickleballElement(PORTRAIT_PICKLEBALL_BOX))
  return { ...design, background: "#2D59A8", elements }
}

/**
 * New Template posters saved before 1.37.1 get the Figma update when they open: the photo card's
 * 30 px corners (border 27 px), the logos' new places and the gradients' angles; PicklePlay posters
 * made with 1.37 get the real PicklePlay design (1.38). Text and photo stay.
 */
export function refitPortraitPoster(design: SlideDesign): SlideDesign {
  if (!PORTRAIT_POSTER_IDS.includes(design.templateId ?? "")) return design
  design = rebackPickleplayPortrait(design)
  const r = PORTRAIT_POSTER.cardRadius
  const angle = PORTRAIT_GRADIENT_ANGLES[design.templateId ?? ""]
  const elements = design.elements.map((el): DesignElement => {
    if (el.type === "shape" && (el.name === "Photo Card" || el.name === "Photo Frame")) return { ...el, cornerRadius: r }
    if (el.type === "shape" && el.name === "Photo Border") return { ...el, cornerRadius: r - 3 }
    if (el.type === "image" && el.role === "background" && (el.width < design.width || el.height < design.height)) return { ...el, cornerRadius: r }
    if (el.type === "shape" && el.name === "Brand Gradient" && angle !== undefined && el.fill.type === "linear") return { ...el, fill: { ...el.fill, angle } }
    return el
  })
  const subtext = elements.find(isPosterSubtext)
  return placePortraitLogo({ ...design, elements }, !!subtext && subtext.visible && !!subtext.text.trim())
}
/** Words the poster headline highlights while it still shows the sample text. */
export const POSTER_SAMPLE_HIGHLIGHT = "Goes Here"
/** "PHOTO OF: " + the photographer's name (shown in capitals). */
export const POSTER_CREDIT_PREFIX = "PHOTO OF: "

export interface PosterContent {
  headline?: string
}

/** The headline never gets smaller than this while shrinking to fit its box. */
export const POSTER_HEADLINE_MIN_SIZE = 24
/** A short headline grows up to this size to fill its space (68 px is the design's size). */
export const POSTER_HEADLINE_GROW_TO = 100

/** Shrink-to-fit rule of the poster headline (also given once to posters made before it). */
export function posterHeadlineFit(g: PosterGeometry = SQUARE_POSTER) {
  return { maxHeight: g.headline.height, maxSize: 68, minSize: POSTER_HEADLINE_MIN_SIZE, lineHeightRatio: 1, letterSpacingEm: 0, growTo: POSTER_HEADLINE_GROW_TO }
}

/**
 * Headline: League Spartan 700, 68 / 68 (100%), white, centered, text-shadow
 * 0 4px 4px rgba(0, 0, 0, 0.25), in capitals. The highlighted words use the brand accent.
 * It fits the 1006 × 231 box: 68 px (the design's size), smaller for long headlines, and bigger
 * (up to 100 px, same number of lines) for short ones so they fill the space.
 */
function posterHeadline(content: PosterContent | undefined, highlightFill: string, g: PosterGeometry = SQUARE_POSTER): TextElement {
  return textElement({
    name: "Headline",
    role: "title",
    text: content?.headline ?? NEWS_HEADLINE_PLACEHOLDER,
    x: g.headline.x,
    // Three lines (204 px) centered on the 231 px block; the text stack keeps it centered.
    y: g.headline.y + (g.headline.height - 3 * 68) / 2,
    width: g.headline.width,
    fontFamily: "League Spartan",
    fontSize: 68,
    fontWeight: 700,
    lineHeight: 68,
    align: "center",
    fill: "#FFFFFF",
    textCase: "upper",
    shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
    highlight: { phrases: content?.headline ? [] : [POSTER_SAMPLE_HIGHLIGHT], fill: highlightFill },
    boxFit: posterHeadlineFit(g),
  })
}

/** "PHOTO OF: FRANK GOMEZ": Poppins 400, 24 / 30, right-aligned to the card's right edge (1128) at y 890. Off by default. */
function posterCredit(g: PosterGeometry = SQUARE_POSTER): TextElement {
  const width = 700
  return textElement({
    name: "Photo Credit",
    role: "label",
    text: POSTER_CREDIT_PREFIX,
    x: g.card.x + g.card.width - width,
    y: g.creditY,
    width,
    fontFamily: "Poppins",
    fontSize: 24,
    fontWeight: 400,
    lineHeight: 30,
    letterSpacing: -0.75,
    align: "right",
    fill: "#F6FAFF",
    textCase: "upper",
    visible: false,
  })
}

/** "SUBTEXT SAMPLE | …" (Old Template): a 1003 × 62 box at 124, 1111; its 30 px line is centered in it (1127–1157). */
/** Space between the headline and the subtext (Figma: a 2-line headline ends at 1119.5). */
const POSTER_SUBTEXT_GAP = 7.5
/** The design's subtext size; a short one grows up to POSTER_SUBTEXT_GROW_TO, a long one wraps onto a second line and shrinks. */
export const POSTER_SUBTEXT_SIZE = 30
export const POSTER_SUBTEXT_GROW_TO = 44
const POSTER_SUBTEXT_MIN_SIZE = 18
/** Two lines at most (a little over 2 × 30 px). */
const POSTER_SUBTEXT_MAX_HEIGHT = 64
/** The subtext is never more than half the headline's size, so the headline always leads. */
export const POSTER_SUBTEXT_RATIO = 0.5

/** How the subtext sizes itself (also given once to posters made before it, see normalize). */
export function posterSubtextFit(headlineId?: string): TextBoxFit {
  return {
    maxHeight: POSTER_SUBTEXT_MAX_HEIGHT,
    maxSize: POSTER_SUBTEXT_SIZE,
    minSize: POSTER_SUBTEXT_MIN_SIZE,
    lineHeightRatio: 1,
    letterSpacingEm: 0,
    growTo: POSTER_SUBTEXT_GROW_TO,
    ...(headlineId ? { maxRatioOf: { id: headlineId, ratio: POSTER_SUBTEXT_RATIO } } : {}),
  }
}

/** Subtext color per poster: the brand accent (FHI gold, PicklePlay lime, Homes.ph gold). */
export const POSTER_SUBTEXT_COLORS: Record<string, string> = {
  "fhi-poster-news": "#F8C563",
  "pickleplay-poster-news": "#AED038",
  "homes-poster-news": "#F4AA1D",
  "gensan-poster-news": "#F4AA1D",
  "fhi-portrait-poster-news": "#F8C563",
  "pickleplay-portrait-poster-news": "#AED038",
  "homes-portrait-poster-news": "#F4AA1D",
  "gensan-portrait-poster-news": "#F4AA1D",
  // Rentsouq.ae: the orange of its highlighted words.
  "rentsouq-poster-news": "#EFA01C",
  "rentsouq-portrait-poster-news": "#EFA01C",
}

/** Dark text on the banner subtext's band: each brand's navy. */
export const POSTER_SUBTEXT_DARK: Record<string, string> = {
  "fhi-poster-news": "#001F3F",
  "pickleplay-poster-news": "#0A2CAA",
  "homes-poster-news": "#0D1969",
  "gensan-poster-news": "#0D1969",
  "fhi-portrait-poster-news": "#001F3F",
  "pickleplay-portrait-poster-news": "#0A2CAA",
  "homes-portrait-poster-news": "#0D1969",
  "gensan-portrait-poster-news": "#0D1969",
  "rentsouq-poster-news": "#001F3F",
  "rentsouq-portrait-poster-news": "#001F3F",
}

/**
 * The subtext line of a poster: the "Subtext" subtitle (or, renamed, a subtitle without
 * highlighted words; the event poster's LOCATION line has them).
 */
export function isPosterSubtext(el: DesignElement): el is TextElement {
  return el.type === "text" && el.role === "subtitle" && (el.name === "Subtext" || !el.highlight)
}

/** The banner's band: this much around the words, rounded corners. */
const BANNER_PADDING = 12

interface SubtextLook {
  fit: TextBoxFit
  fontWeight: number
  /** Gap above it (to the headline), and how far below the subtext line its box ends. */
  gap: number
  drop: number
}

/**
 * The four subtext looks. All size themselves to the 1003 px width and stay smaller than
 * the headline (`maxRatioOf`); the headline gets the space that's left.
 */
const SUBTEXT_LOOKS: Record<SubtextStyle, SubtextLook> = {
  // Figma: 30 px in the brand color, growing to 44 when short.
  classic: { fit: posterSubtextFit(), fontWeight: 600, gap: POSTER_SUBTEXT_GAP, drop: 0 },
  // Bigger and bolder: the subtext is half the message.
  big: {
    fit: { maxHeight: 84, maxSize: 40, minSize: 22, lineHeightRatio: 1, letterSpacingEm: 0, growTo: 64 },
    fontWeight: 700,
    gap: 10,
    drop: 2,
  },
  // White, with its most interesting words in the brand color.
  highlight: {
    fit: { maxHeight: 68, maxSize: 32, minSize: 18, lineHeightRatio: 1, letterSpacingEm: 0, growTo: 50 },
    fontWeight: 700,
    gap: 9,
    drop: 0,
  },
  // Dark words on a brand-colored band (the band is part of its height).
  banner: {
    fit: { maxHeight: 64 + 2 * BANNER_PADDING, maxSize: 30, minSize: 18, lineHeightRatio: 1, letterSpacingEm: 0, growTo: 40 },
    fontWeight: 700,
    gap: 12,
    drop: BANNER_PADDING,
  },
}

/** How much bigger than the headline each look may get (as a share of the headline's size). */
const SUBTEXT_RATIOS: Record<SubtextStyle, number> = { classic: POSTER_SUBTEXT_RATIO, big: 0.75, highlight: 0.6, banner: 0.5 }

export const subtextStyleOf = (design: Pick<SlideDesign, "subtextStyle">): SubtextStyle => design.subtextStyle ?? "classic"

/**
 * The most interesting words of a subtext, for the highlight look: an amount, a percentage
 * or a number with its noun ("₱50,000", "8%", "300 Players"), else the first part of
 * "Date | Place", else its first two words.
 */
export function autoSubtextHook(text: string): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (!t) return ""
  const money = /(?:₱|PHP|P(?=\d)|AED|USD|US\$|\$|SGD|S\$|€|£)\s?\d[\d,]*(?:\.\d+)?\s?(?:[MKB]\b|million\b|billion\b)?/i.exec(t)
  if (money) return money[0].trim().replace(/[,.]+$/, "")
  const percent = /\d+(?:\.\d+)?\s?%/.exec(t)
  if (percent) return percent[0]
  const count = /\b\d[\d,]*\+?\s+[A-Za-z]+/.exec(t)
  if (count && !/^\d{4}\b/.test(count[0])) return count[0]
  if (t.includes("|")) return t.split("|")[0].trim()
  return t.replace(/^[“"']+/, "").split(" ").slice(0, 2).join(" ").replace(/[,.;:”"']+$/, "")
}

/**
 * Gives the poster's subtext a look (keeps its text): sizes, weight, colors, the band for the
 * banner, the colored words for the highlight look (`hook`, or picked from the text), then
 * lays the headline and subtext out again.
 */
export function styleSubtext(design: SlideDesign, style: SubtextStyle, hook = ""): SlideDesign {
  const subtext = design.elements.find(isPosterSubtext)
  if (!subtext) return design
  const accent = POSTER_SUBTEXT_COLORS[design.templateId ?? ""] ?? subtext.fill
  const dark = POSTER_SUBTEXT_DARK[design.templateId ?? ""] ?? "#0D1969"
  const look = SUBTEXT_LOOKS[style]
  const box = posterGeometry(design.templateId).subtext
  const words = style === "highlight" ? hook.replace(/\s+/g, " ").trim() || autoSubtextHook(subtext.text) : ""
  const styled: TextElement = {
    ...subtext,
    fontWeight: look.fontWeight,
    fill: style === "highlight" ? "#FFFFFF" : style === "banner" ? dark : accent,
    shadow: { enabled: style !== "banner", color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
    background: { enabled: style === "banner", color: accent, padding: style === "banner" ? BANNER_PADDING : 0, radius: style === "banner" ? BANNER_PADDING : 0 },
    highlight: words ? { phrases: [words], fill: accent } : null,
    hug: style === "banner" ? { centerX: box.x + box.width / 2, maxWidth: box.width } : null,
    x: box.x,
    width: box.width,
    autoFit: null,
    boxFit: { ...look.fit },
  }
  const next = { ...design, subtextStyle: style === "classic" ? null : style, elements: design.elements.map((el) => (el.id === subtext.id ? styled : el)) }
  return posterTextLayout(next, styled.visible && !!styled.text.trim())
}

/** The words shown in the brand color in a highlight subtext ("" = none or not that look). */
export function subtextHookOf(design: SlideDesign): string {
  const el = design.elements.find(isPosterSubtext)
  return subtextStyleOf(design) === "highlight" ? (el?.highlight?.phrases[0] ?? "") : ""
}

/**
 * Subtext (e.g. "November 22, 2026 | Cebu City | ₱50,000 Prize Pool", or a key point of the
 * article): League Spartan 600, 30 / 30, centered, the brand accent, text-shadow 0 4px 4px
 * rgba(0, 0, 0, 0.25), in capitals. It sizes itself to the 1003 px width: a short one grows
 * (up to 44 px, never more than half the headline), a long one wraps onto a second line and
 * gets smaller. Empty and hidden until it's written.
 */
export function posterSubtext(color: string, id?: string, g: PosterGeometry = SQUARE_POSTER): TextElement {
  const el = textElement({
    name: "Subtext",
    role: "subtitle",
    text: "",
    x: g.subtext.x,
    y: g.subtext.lineTop,
    width: g.subtext.width,
    fontFamily: "League Spartan",
    fontSize: 30,
    fontWeight: 600,
    lineHeight: 30,
    align: "center",
    fill: color,
    textCase: "upper",
    shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
    boxFit: posterSubtextFit(),
    visible: false,
  })
  return id ? { ...el, id } : el
}

/**
 * Headline only: the headline is centered in its 1006 × 231 box (shrinking to fit it).
 * With a subtext: the subtext ends on its Figma line (1157) and the headline sits right
 * above it; both share the space from the top of the headline box (936) down to 1157. The
 * subtext sizes itself first and the headline gets the rest (a 30 px subtext and a 2-line
 * headline land where Figma has them).
 */
export function posterTextLayout(design: SlideDesign, withSubtext: boolean): SlideDesign {
  // The poster designs (1.51) have every line in its own place: nothing moves.
  if (/^(homes|gensan)-d\d+-poster-news$/.test(design.templateId ?? "")) return design
  const headline = design.elements.find((e): e is TextElement => e.type === "text" && e.role === "title")
  const subtext = design.elements.find(isPosterSubtext)
  if (!headline || !subtext) return design
  // The New Template's logo (and the Rentsouq.ae gradient) sit a little differently on the subtext frame (Figma).
  design = placeSubtextGradient(placePortraitLogo(design, withSubtext), withSubtext)
  const style = subtextStyleOf(design)
  const look = SUBTEXT_LOOKS[style]
  const g = posterGeometry(design.templateId)
  const bottom = g.subtext.lineBottom + look.drop
  const maxHeight = withSubtext ? bottom - g.headline.y : g.headline.height
  // Small text may run down into the free space above the footer (only when it would be small).
  const maxBottom = Math.max(bottom, g.subtext.lineBottom + g.textSpare)
  const shareWith = withSubtext ? { id: subtext.id, gap: look.gap, ...(maxBottom > bottom ? { spare: maxBottom - bottom } : {}) } : null
  const items = [
    { id: headline.id, gap: 0 },
    { id: subtext.id, gap: look.gap },
  ]
  return {
    ...design,
    elements: design.elements.map((el) => {
      if (el.type !== "text") return el
      if (el.id === headline.id && el.boxFit) return { ...el, boxFit: { ...el.boxFit, maxHeight, shareWith } }
      if (el.id === subtext.id) {
        return { ...el, autoFit: null, boxFit: { ...(el.boxFit ?? look.fit), maxRatioOf: { id: headline.id, ratio: SUBTEXT_RATIOS[style] } } }
      }
      return el
    }),
    stack: withSubtext
      ? { enabled: true, anchor: "bottom", bottom, minTop: g.headline.y, maxBottom, spill: true, items }
      : {
          enabled: true,
          anchor: "center",
          center: g.headline.y + g.headline.height / 2,
          bottom: g.headline.y + g.headline.height,
          minTop: g.headline.y,
          maxBottom: g.headline.y + g.headline.height,
          items,
        },
  }
}

/** Website (Inter 400, 24 / 34) and Facebook (Poppins 400, 24 / 30) with their 24 px icons. */
function posterFooter(f: {
  webIcon: [number, number]
  webX: number
  webY?: number
  /** The website's letter spacing (the New Template: -1 px; measured from Figma's glyphs). */
  webLetterSpacing?: number
  web: string
  fbIcon: [number, number]
  fbX: number
  fbY?: number
  fbWidth: number
  fb: string
}): DesignElement[] {
  const icon = { width: 24, height: 24, fit: "contain" as const, naturalWidth: 34, naturalHeight: 34, locked: true }
  const text = { fontSize: 24, fontWeight: 400, letterSpacing: -0.75, fill: "#F6FAFF" }
  return [
    imageElement({ name: "Website icon", role: "icon", src: ICON_WEB_SRC, x: f.webIcon[0], y: f.webIcon[1], ...icon }),
    // Wider than Figma's text boxes (left-aligned), so font metrics never force a wrap.
    textElement({ name: "Website", role: "footer", text: f.web, x: f.webX, y: f.webY ?? 1196, width: 300, fontFamily: "Inter", lineHeight: 34, ...text, ...(f.webLetterSpacing !== undefined ? { letterSpacing: f.webLetterSpacing } : {}) }),
    imageElement({ name: "Facebook icon", role: "icon", src: ICON_FACEBOOK_SRC, x: f.fbIcon[0], y: f.fbIcon[1], ...icon }),
    textElement({ name: "Facebook", role: "footer", text: f.fb, x: f.fbX, y: f.fbY ?? 1198, width: f.fbWidth + 60, fontFamily: "Poppins", lineHeight: 30, ...text }),
  ]
}

/** Shared layers: navy base, the photo faded (50%) over the whole poster, the brand gradient (70%). */
function posterBackdrop(gradient: Fill, g: PosterGeometry = SQUARE_POSTER): DesignElement[] {
  const full = { x: 0, y: 0, width: g.width, height: g.height }
  return [
    shapeElement({ name: "Base", role: "overlay", ...full, fill: { type: "solid", color: "#2D59A8" }, locked: true }),
    imageElement({ name: "Poster Background", role: "background", ...full, opacity: 0.5, fit: "cover", locked: true }),
    shapeElement({ name: "Brand Gradient", role: "overlay", ...full, fill: gradient, opacity: 0.7, locked: true }),
  ]
}

function posterDesign(templateId: string, elements: DesignElement[], headline: TextElement, subtext?: TextElement, g: PosterGeometry = SQUARE_POSTER): SlideDesign {
  const design: SlideDesign = {
    version: DESIGN_VERSION,
    width: g.width,
    height: g.height,
    background: "#2D59A8",
    elements,
    templateId,
    stack: {
      enabled: true,
      anchor: "center",
      center: g.headline.y + g.headline.height / 2,
      bottom: g.headline.y + g.headline.height,
      // The headline box (the headline shrinks to fit, so it stays inside).
      minTop: g.headline.y,
      maxBottom: g.headline.y + g.headline.height,
      items: [{ id: headline.id, gap: 0 }],
    },
  }
  return subtext ? posterTextLayout(design, false) : design
}

/**
 * FHI Poster: navy base, photo at 50%, linear-gradient(0.51deg, #001F3F 3.73%,
 * #D6B357 128.29%) at 70%, the FHI emblem (110 × 131 at the top, drop shadow), the
 * photo in a #1B4FD8 frame with a 6 px #F8C563 border, the headline (gold highlight),
 * the optional photo credit and the fhiglobal.ae / Facebook footer.
 */
export function buildFhiPoster(content?: PosterContent): SlideDesign {
  const headline = posterHeadline(content, "#F8C563")
  const subtext = posterSubtext(POSTER_SUBTEXT_COLORS["fhi-poster-news"])
  const gradient: Fill = {
    type: "linear",
    angle: 0.51,
    // Stops past 100% don't exist on a canvas: the color at 100% is 77.3% of the way to #D6B357.
    stops: [
      { offset: 0, color: "#001F3F" },
      { offset: 0.0373, color: "#001F3F" },
      { offset: 1, color: "#A59152" },
    ],
  }
  return posterDesign(
    "fhi-poster-news",
    [
      ...posterBackdrop(gradient),
      imageElement({
        name: "FHI Emblem",
        role: "icon",
        src: FHI_EMBLEM_SRC,
        naturalWidth: 110,
        naturalHeight: 133,
        x: 572,
        y: 40,
        width: 110,
        height: 131,
        fit: "contain",
        shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
        locked: true,
      }),
      shapeElement({ name: "Photo Frame", role: "overlay", ...POSTER_CARD, fill: { type: "solid", color: "#1B4FD8" }, shadow: POSTER_CARD_SHADOW, locked: true }),
      imageElement({ name: "Photo", role: "background", ...POSTER_CARD, fit: "cover", blurFill: true, locked: true }),
      // border: 6px solid #F8C563 inside the frame.
      posterPhotoBorder({ color: "#F8C563" }),
      posterCredit(),
      headline,
      subtext,
      ...posterFooter({ webIcon: [352, 1200.96], webX: 383.05, web: "www.fhiglobal.ae", fbIcon: [594.02, 1201.2], fbX: 625.05, fbWidth: 277, fb: "facebook.com/fhiglobal" }),
    ],
    headline,
    subtext,
  )
}

/** PicklePlay's brand gradient: linear-gradient(181.68deg, #AFD137 20.06%, #0A2CAA 91.64%). */
const PICKLEPLAY_GRADIENT: Extract<Fill, { type: "linear" }> = {
  type: "linear",
  angle: 181.68,
  stops: [
    { offset: 0, color: "#AFD137" },
    { offset: 0.2006, color: "#AFD137" },
    { offset: 0.9164, color: "#0A2CAA" },
    { offset: 1, color: "#0A2CAA" },
  ],
}

/** A 6 px border inside the photo card (a 6 px stroke centered 3 px in from the edge), drawn over the photo. */
function posterPhotoBorder(stroke: { color: string; gradient?: Extract<Fill, { type: "linear" }> }, g: PosterGeometry = SQUARE_POSTER): ShapeElement {
  return shapeElement({
    name: "Photo Border",
    role: "decoration",
    x: g.card.x + 3,
    y: g.card.y + 3,
    width: g.card.width - 6,
    height: g.card.height - 6,
    cornerRadius: Math.max(0, g.cardRadius - 3),
    fill: { type: "solid", color: "rgba(255, 255, 255, 0)" },
    stroke: { color: stroke.color, width: 6, ...(stroke.gradient ? { gradient: stroke.gradient } : {}) },
    locked: true,
  })
}

/** The PicklePlay photo card's border: the brand gradient (lime to blue) across the card. */
export function pickleplayPhotoBorder(): ShapeElement {
  return posterPhotoBorder({ color: "#AFD137", gradient: PICKLEPLAY_GRADIENT })
}

/** "Neon Lime Pickleball": 234 × 187 from 81.34% (x 1020) to the right edge, at y 1067. */
export const PICKLEBALL_BOX = { x: 1020, y: 1067, width: 234, height: 187 }

/** The New Template's pickleball: the same 234 × 187 corner (892 to the right edge, 1221 to the bottom). */
export const PORTRAIT_PICKLEBALL_BOX = { x: 892, y: 1221, width: 234, height: 187 }

/** The Figma export already has the layer's 50% opacity and 1 px border, so it's drawn at 100%. */
export function pickleballElement(box: { x: number; y: number; width: number; height: number } = PICKLEBALL_BOX): ImageElement {
  return imageElement({
    name: "Pickleball",
    role: "decoration",
    src: POSTER_PICKLEBALL_SRC,
    naturalWidth: 234,
    naturalHeight: 187,
    ...box,
    fit: "contain",
    locked: true,
  })
}

/**
 * PicklePlay Poster: navy base, photo at 50%, linear-gradient(181.68deg, #AFD137
 * 20.06%, #0A2CAA 91.64%) at 70%, the PicklePlay logo (139 × 139), the photo in a
 * white card with a 6 px border in the same lime-to-blue gradient, the headline
 * (lime highlight), the optional photo credit, the pickleplay.ph / Facebook footer
 * and the neon lime pickleball in the corner.
 */
export function buildPickleplayPoster(content?: PosterContent): SlideDesign {
  const headline = posterHeadline(content, "#AFD137")
  const subtext = posterSubtext(POSTER_SUBTEXT_COLORS["pickleplay-poster-news"])
  return posterDesign(
    "pickleplay-poster-news",
    [
      ...posterBackdrop(PICKLEPLAY_GRADIENT),
      shapeElement({ name: "Photo Card", role: "overlay", ...POSTER_CARD, fill: { type: "solid", color: "#FFFFFF" }, shadow: POSTER_CARD_SHADOW, locked: true }),
      imageElement({ name: "Photo", role: "background", ...POSTER_CARD, fit: "cover", blurFill: true, locked: true }),
      pickleplayPhotoBorder(),
      posterCredit(),
      headline,
      subtext,
      ...posterFooter({ webIcon: [301.96, 1201.96], webX: 330, web: "www.pickleplay.ph", fbIcon: [553.01, 1201.2], fbX: 584, fbWidth: 368, fb: "facebook.com/pickleplayofficial" }),
      // filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.25))
      imageElement({
        name: "PicklePlay Logo",
        role: "icon",
        src: PICKLEPLAY_LOGO_SRC,
        naturalWidth: 764,
        naturalHeight: 764,
        x: 558,
        y: 40,
        width: 139,
        height: 139,
        fit: "contain",
        shadow: POSTER_LOGO_SHADOW,
        locked: true,
      }),
      pickleballElement(),
    ],
    headline,
    subtext,
  )
}

// ---------- PicklePlay Event Poster: the PicklePlay poster + LOCATION / DATE & TIME under the headline ----------

/** "LOCATION: " + the venue (shown in capitals; the label in lime). */
export const EVENT_LOCATION_LABEL = "LOCATION: "
/** "DATE & TIME: " + when. */
export const EVENT_TIME_LABEL = "DATE & TIME: "
/** Shown until a location / date and time is typed (so the template reads as a template). */
export const EVENT_SAMPLE = { location: "Venue Name, City", when: "Month Day, Year · Time" }

/**
 * Below the photo credit and above the footer (Old Template: 932 to 1178): the headline (2 lines
 * at 68 px, smaller when longer) and the two detail lines, centered as one block. The detail lines
 * stay one line each in their box (800 px on the Old Template, clear of the pickleball), shrinking from 28 px.
 */
const EVENT_LINE = { size: 28, lineHeight: 38 }

/** Poppins 600, 28 / 38, white with the label in the brand accent, in capitals; one line each. */
function eventLine(name: string, role: "subtitle" | "description", label: string, value: string, accent: string, g: PosterGeometry = SQUARE_POSTER): TextElement {
  return textElement({
    name,
    role,
    text: `${label}${value}`,
    x: g.event.x,
    y: g.event.bottom - EVENT_LINE.lineHeight,
    width: g.event.width,
    fontFamily: "Poppins",
    fontSize: EVENT_LINE.size,
    fontWeight: 600,
    lineHeight: EVENT_LINE.lineHeight,
    letterSpacing: 0,
    align: "center",
    fill: "#FFFFFF",
    textCase: "upper",
    shadow: { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 4, offsetX: 0, offsetY: 4 },
    highlight: { phrases: [label.trim()], fill: accent },
    autoFit: { maxWidth: g.event.width, maxSize: EVENT_LINE.size, lineHeightRatio: EVENT_LINE.lineHeight / EVENT_LINE.size, letterSpacingEm: 0 },
  })
}

export interface EventPosterContent extends PosterContent {
  location?: string
  when?: string
}

/**
 * PicklePlay Event Poster (tournaments, games, new courts): the PicklePlay poster as is,
 * with "LOCATION: …" and "DATE & TIME: …" under the headline. The headline gets two lines
 * at 68 px (it shrinks for longer ones) so the details always fit above the footer.
 */
export function buildPickleplayEventPoster(content?: EventPosterContent): SlideDesign {
  return eventPoster(buildPickleplayPoster(content), "pickleplay-event-poster-news", "#AFD137", SQUARE_POSTER, content)
}

/** PicklePlay Event Poster on the New Template (1126 × 1408): the same headline and detail lines in its space. */
export function buildPickleplayPortraitEventPoster(content?: EventPosterContent): SlideDesign {
  return eventPoster(buildPickleplayPortraitPoster(content), "pickleplay-portrait-event-poster-news", "#AED038", PORTRAIT_POSTER, content)
}

function eventPoster(base: SlideDesign, templateId: string, accent: string, g: PosterGeometry, content?: EventPosterContent): SlideDesign {
  const headline = base.elements.find((e): e is TextElement => e.type === "text" && e.role === "title")!
  const eventHeadline: TextElement = { ...headline, boxFit: { ...headline.boxFit!, maxHeight: 150 } }
  const location = eventLine("Event Location", "subtitle", EVENT_LOCATION_LABEL, content?.location ?? EVENT_SAMPLE.location, accent, g)
  const when = eventLine("Event Date & Time", "description", EVENT_TIME_LABEL, content?.when ?? EVENT_SAMPLE.when, accent, g)
  const elements = base.elements.flatMap<DesignElement>((e) => (isPosterSubtext(e) ? [] : e.id === headline.id ? [eventHeadline, location, when] : [e]))
  return {
    ...base,
    elements,
    templateId,
    stack: {
      enabled: true,
      anchor: "center",
      center: (g.event.top + g.event.bottom) / 2,
      bottom: g.event.bottom,
      minTop: g.event.top,
      maxBottom: g.event.bottom,
      items: [
        { id: eventHeadline.id, gap: 0 },
        { id: location.id, gap: 20 },
        { id: when.id, gap: 6, gapWithoutPrevious: 20 },
      ],
    },
  }
}

/**
 * Homes.ph Poster: navy base, photo at 50%, linear-gradient(180.51deg, #1428AE 19.32%,
 * #0D1969 92.49%) at 70%, the white Homes.ph "H" (115 tall, centered, at y 35), the photo
 * in a white card with a 6 px #F4AA1D border, the headline (gold highlight), the optional
 * photo credit and the homes.ph / Facebook footer.
 */
export function buildHomesPoster(content?: PosterContent, templateId: "homes-poster-news" | "gensan-poster-news" = "homes-poster-news"): SlideDesign {
  const headline = posterHeadline(content, "#F4AA1D")
  const subtext = posterSubtext(POSTER_SUBTEXT_COLORS["homes-poster-news"])
  const gradient: Fill = {
    type: "linear",
    angle: 180.51,
    stops: [
      { offset: 0, color: "#1428AE" },
      { offset: 0.1932, color: "#1428AE" },
      { offset: 0.9249, color: "#0D1969" },
      { offset: 1, color: "#0D1969" },
    ],
  }
  return posterDesign(
    templateId,
    [
      ...posterBackdrop(gradient),
      // left 45.3%, right 45.3% (568.06, 117.88 wide), height 115, top 35. Like the cover's
      // "white H", the white PNG carries the logo's transparent padding.
      imageElement({
        name: "Homes.ph Logo",
        role: "icon",
        src: LOGO_WHITE_SRC,
        naturalWidth: LOGO_NATURAL.white.width,
        naturalHeight: LOGO_NATURAL.white.height,
        x: 568.06,
        y: 35,
        width: 117.88,
        height: 115,
        fit: "contain",
        shadow: POSTER_LOGO_SHADOW,
        locked: true,
      }),
      shapeElement({ name: "Photo Card", role: "overlay", ...POSTER_CARD, fill: { type: "solid", color: "#FFFFFF" }, shadow: POSTER_CARD_SHADOW, locked: true }),
      imageElement({ name: "Photo", role: "background", ...POSTER_CARD, fit: "cover", blurFill: true, locked: true }),
      // border: 6px solid #F4AA1D inside the card.
      posterPhotoBorder({ color: "#F4AA1D" }),
      posterCredit(),
      headline,
      subtext,
      ...posterFooter({
        webIcon: [309.99, 1200.96],
        webX: 338,
        webY: 1195,
        web: "www.homes.ph",
        fbIcon: [545.99, 1199.2],
        fbX: 577,
        fbY: 1196,
        fbWidth: 368,
        fb: "facebook.com/homesphofficial",
      }),
    ],
    headline,
    subtext,
  )
}

// ---------- Posters, New Template (1126 × 1408, Figma "Pickleplay_Poster", "FHI_Poster", "Homes_Poster") ----------

/**
 * PicklePlay New Template gradient (at 70%): Figma's line from (593, -505) to (550, 1307), #AFD137 at
 * 42.79% and #0A2CAA at 100%, as a CSS angle across 1126 × 1408: 181.36deg, #AFD137 19.75% to #0A2CAA 92.05%.
 */
const PICKLEPLAY_PORTRAIT_GRADIENT: Extract<Fill, { type: "linear" }> = {
  type: "linear",
  angle: 181.36,
  stops: [
    { offset: 0, color: "#AFD137" },
    { offset: 0.1975, color: "#AFD137" },
    { offset: 0.9205, color: "#0A2CAA" },
    { offset: 1, color: "#0A2CAA" },
  ],
}

/** The PicklePlay New Template's photo border: blue at the top to lime at the bottom (Figma: #0A2EAC → #AFD137 down the card). */
const PICKLEPLAY_PORTRAIT_BORDER: Extract<Fill, { type: "linear" }> = {
  type: "linear",
  angle: 180,
  stops: [
    { offset: 0, color: "#0A2EAC" },
    { offset: 1, color: "#AFD137" },
  ],
}

/**
 * Homes.ph New Template gradient: Figma's line from (563, -509) to (550, 1307) with #1428AE at 42.79%
 * and #0D1969 at 100%, as a CSS angle across 1126 × 1408 (the Old Template's gradient, re-fitted).
 */
const HOMES_PORTRAIT_GRADIENT: Fill = {
  type: "linear",
  // Figma CSS: linear-gradient(180.33deg, #1428AE 19.22%, #0D1969 92.59%).
  angle: 180.33,
  stops: [
    { offset: 0, color: "#1428AE" },
    { offset: 0.1922, color: "#1428AE" },
    { offset: 0.9259, color: "#0D1969" },
    { offset: 1, color: "#0D1969" },
  ],
}

/**
 * FHI New Template gradient: Figma's line from (563, 1408) to (576, -408), #001F3F at 2.57% to #D6B357
 * at 100%. As CSS: 0.41deg, #001F3F 3.58% to #D6B357 at 128.5%, so the top edge (100%) is #A59152.
 */
const FHI_PORTRAIT_GRADIENT: Fill = {
  type: "linear",
  // Figma CSS: linear-gradient(0.33deg, #001F3F 3.58%, #D6B357 128.53%).
  angle: 0.33,
  stops: [
    { offset: 0, color: "#001F3F" },
    { offset: 0.0358, color: "#001F3F" },
    { offset: 1, color: "#A59152" },
  ],
}

/**
 * PicklePlay Poster, New Template (1126 × 1408, Figma "Pickleplay_Poster" re-exported 2026-11-10): navy
 * #2D59A8, the photo faded (50%) over the whole poster, the PicklePlay gradient at 70% (lime at the top
 * to blue), the logo centered at the top (139 × 139 at 494, 29; 27 with a subtext; drop shadow), the
 * photo (1026 × 785 at 50, 188, 30 px corners) with a 6 px blue-to-lime border, the photo credit, the
 * headline (lime highlight #AED038), the optional subtext (lime), the pickleplay.ph / Facebook footer and
 * the faded pickleball in the bottom right corner. The Old Template's look, on the New Template.
 */
export function buildPickleplayPortraitPoster(content?: PosterContent): SlideDesign {
  const g = PORTRAIT_POSTER
  const headline = posterHeadline(content, "#AED038", g)
  const subtext = posterSubtext(POSTER_SUBTEXT_COLORS["pickleplay-portrait-poster-news"], undefined, g)
  return posterDesign(
    "pickleplay-portrait-poster-news",
    [
      ...posterBackdrop(PICKLEPLAY_PORTRAIT_GRADIENT, g),
      shapeElement({ name: "Photo Card", role: "overlay", ...g.card, cornerRadius: g.cardRadius, fill: { type: "solid", color: "#FFFFFF" }, locked: true }),
      imageElement({ name: "Photo", role: "background", ...g.card, cornerRadius: g.cardRadius, fit: "cover", blurFill: true, locked: true }),
      posterPhotoBorder({ color: "#AFD137", gradient: PICKLEPLAY_PORTRAIT_BORDER }, g),
      posterCredit(g),
      headline,
      subtext,
      ...posterFooter({ webIcon: [241.5, 1356], webX: 269.54, webY: 1350.04, webLetterSpacing: -1, web: "www.pickleplay.ph", fbIcon: [492.5, 1355.26], fbX: 523.49, fbY: 1352.06, fbWidth: 368, fb: "facebook.com/pickleplayofficial" }),
      imageElement({
        name: "PicklePlay Logo",
        role: "icon",
        src: PICKLEPLAY_LOGO_SRC,
        naturalWidth: 764,
        naturalHeight: 764,
        ...portraitLogoLook(PORTRAIT_LOGOS["pickleplay-portrait-poster-news"], false),
        fit: "contain",
        locked: true,
      }),
      pickleballElement(PORTRAIT_PICKLEBALL_BOX),
    ],
    headline,
    subtext,
    g,
  )
}

/**
 * FHI Poster, New Template (1126 × 1408): navy base, photo at 50%, the FHI gradient at 70%, the FHI
 * Global Property logo centered at the top (282 × 104 at 422, 42, drop shadow), the photo with 30 px corners, the photo with a 6 px
 * #F8C563 border, the photo credit, the headline (gold highlight), the optional subtext and the
 * fhiglobal.ae / Facebook footer.
 */
export function buildFhiPortraitPoster(content?: PosterContent): SlideDesign {
  const g = PORTRAIT_POSTER
  const headline = posterHeadline(content, "#F8C563", g)
  const subtext = posterSubtext(POSTER_SUBTEXT_COLORS["fhi-portrait-poster-news"], undefined, g)
  return posterDesign(
    "fhi-portrait-poster-news",
    [
      ...posterBackdrop(FHI_PORTRAIT_GRADIENT, g),
      shapeElement({ name: "Photo Frame", role: "overlay", ...g.card, cornerRadius: g.cardRadius, fill: { type: "solid", color: "#1B4FD8" }, locked: true }),
      imageElement({ name: "Photo", role: "background", ...g.card, cornerRadius: g.cardRadius, fit: "cover", blurFill: true, locked: true }),
      posterPhotoBorder({ color: "#F8C563" }, g),
      posterCredit(g),
      headline,
      subtext,
      ...posterFooter({ webIcon: [291, 1354.91], webX: 322.05, webY: 1349.95, webLetterSpacing: -1, web: "www.fhiglobal.ae", fbIcon: [533, 1355.26], fbX: 564.03, fbY: 1352.06, fbWidth: 277, fb: "facebook.com/fhiglobal" }),
      imageElement({
        name: "FHI Global Logo",
        role: "icon",
        src: FHI_POSTER_LOGO_SRC,
        naturalWidth: 1044,
        naturalHeight: 384,
        ...portraitLogoLook(PORTRAIT_LOGOS["fhi-portrait-poster-news"], false),
        fit: "contain",
        locked: true,
      }),
    ],
    headline,
    subtext,
    g,
  )
}

/**
 * Homes.ph Poster, New Template (1126 × 1408): navy base, photo at 50%, the Homes.ph gradient at 70%,
 * the white Homes.ph "H" centered at the top (118 × 115 at 504, 37; drop shadow on the subtext frame), the photo with 30 px corners, the photo with
 * a 6 px #F4AA1D border, the photo credit, the headline (gold highlight), the optional subtext and the
 * homes.ph / Facebook footer. Also the Homes.ph Gensan poster.
 */
export function buildHomesPortraitPoster(content?: PosterContent, templateId: "homes-portrait-poster-news" | "gensan-portrait-poster-news" = "homes-portrait-poster-news"): SlideDesign {
  const g = PORTRAIT_POSTER
  const headline = posterHeadline(content, "#F4AA1D", g)
  const subtext = posterSubtext(POSTER_SUBTEXT_COLORS[templateId], undefined, g)
  return posterDesign(
    templateId,
    [
      ...posterBackdrop(HOMES_PORTRAIT_GRADIENT, g),
      shapeElement({ name: "Photo Card", role: "overlay", ...g.card, cornerRadius: g.cardRadius, fill: { type: "solid", color: "#FFFFFF" }, locked: true }),
      imageElement({ name: "Photo", role: "background", ...g.card, cornerRadius: g.cardRadius, fit: "cover", blurFill: true, locked: true }),
      posterPhotoBorder({ color: "#F4AA1D" }, g),
      posterCredit(g),
      headline,
      subtext,
      ...posterFooter({ webIcon: [251.5, 1357], webX: 279.51, webY: 1351.04, webLetterSpacing: -1, web: "www.homes.ph", fbIcon: [487.5, 1355.26], fbX: 518.51, fbY: 1352.06, fbWidth: 368, fb: "facebook.com/homesphofficial" }),
      imageElement({
        name: "Homes.ph Logo",
        role: "icon",
        src: LOGO_WHITE_SRC,
        naturalWidth: LOGO_NATURAL.white.width,
        naturalHeight: LOGO_NATURAL.white.height,
        ...portraitLogoLook(PORTRAIT_LOGOS[templateId], false),
        fit: "contain",
        locked: true,
      }),
    ],
    headline,
    subtext,
    g,
  )
}

// ---------- Rentsouq.ae posters (Figma "Resnsouq_Poster" / "Old_Template_Resnsouq Poster" and their subtext frames) ----------

/** Rentsouq.ae's orange: the highlighted words and the subtext. */
const RENTSOUQ_ORANGE = "#EFA01C"
/** Its photo border (6 px, inside the card). */
const RENTSOUQ_BORDER = "#F4AA1D"

function rentsouqLogo(box: { x: number; y: number; width: number; height: number; shadow: TextShadow }): ImageElement {
  return imageElement({ name: "Rentsouq Logo", role: "icon", src: RENTSOUQ_LOGO_SRC, naturalWidth: 1112, naturalHeight: 350, ...box, fit: "contain", locked: true })
}

/**
 * Rentsouq.ae Poster, Old Template (1254 × 1254): the FHI poster's layout (navy base, photo at 50%, the
 * #1B4FD8 photo frame 1003 × 661 at 125, 229 with its shadow, headline, subtext, photo credit) with the
 * Rentsouq.ae gradient at 70%, its logo (556 × 175 at 349, 22, drop-shadow 0 4px 4px), a 6 px #F4AA1D photo
 * border, orange (#EFA01C) highlighted words and subtext, and the rentsouq.ae / Facebook footer.
 * Never saved: the Poster Maker's Rentsouq.ae tab draws FHI Global Property's posters with it.
 */
export function buildRentsouqPoster(content?: PosterContent): SlideDesign {
  const headline = posterHeadline(content, RENTSOUQ_ORANGE)
  const subtext = posterSubtext(POSTER_SUBTEXT_COLORS["rentsouq-poster-news"])
  return posterDesign(
    "rentsouq-poster-news",
    [
      ...posterBackdrop(SUBTEXT_FRAME_GRADIENTS["rentsouq-poster-news"].without),
      shapeElement({ name: "Photo Frame", role: "overlay", ...POSTER_CARD, fill: { type: "solid", color: "#1B4FD8" }, shadow: POSTER_CARD_SHADOW, locked: true }),
      imageElement({ name: "Photo", role: "background", ...POSTER_CARD, fit: "cover", blurFill: true, locked: true }),
      posterPhotoBorder({ color: RENTSOUQ_BORDER }),
      posterCredit(),
      headline,
      subtext,
      ...posterFooter({ webIcon: [352, 1200.91], webX: 383.05, web: "www.rentsouq.ae", fbIcon: [594, 1201.26], fbX: 625.05, fbWidth: 277, fb: "facebook.com/rentsouq" }),
      rentsouqLogo({ x: 349, y: 22, width: 556, height: 175, shadow: { ...POSTER_LOGO_SHADOW } }),
    ],
    headline,
    subtext,
  )
}

/**
 * Rentsouq.ae Poster, New Template (1126 × 1408): the FHI New Template's layout (photo 1026 × 785 at 50, 188
 * with 30 px corners on #1B4FD8, headline, subtext, photo credit) with the Rentsouq.ae gradient at 70%, its
 * logo centered at the top (433.68 × 136.5 at 346, 21; 23 with a subtext; drop-shadow 0 3.12px 3.12px), a
 * 6 px #F4AA1D photo border, orange (#EFA01C) highlighted words and subtext, and the rentsouq.ae / Facebook
 * footer (2 px left of FHI's). Never saved, like the Old Template.
 */
export function buildRentsouqPortraitPoster(content?: PosterContent): SlideDesign {
  const g = PORTRAIT_POSTER
  const headline = posterHeadline(content, RENTSOUQ_ORANGE, g)
  const subtext = posterSubtext(POSTER_SUBTEXT_COLORS["rentsouq-portrait-poster-news"], undefined, g)
  return posterDesign(
    "rentsouq-portrait-poster-news",
    [
      ...posterBackdrop(SUBTEXT_FRAME_GRADIENTS["rentsouq-portrait-poster-news"].without, g),
      shapeElement({ name: "Photo Frame", role: "overlay", ...g.card, cornerRadius: g.cardRadius, fill: { type: "solid", color: "#1B4FD8" }, locked: true }),
      imageElement({ name: "Photo", role: "background", ...g.card, cornerRadius: g.cardRadius, fit: "cover", blurFill: true, locked: true }),
      posterPhotoBorder({ color: RENTSOUQ_BORDER }, g),
      posterCredit(g),
      headline,
      subtext,
      ...posterFooter({ webIcon: [289, 1354.91], webX: 320.05, webY: 1349.95, webLetterSpacing: -1, web: "www.rentsouq.ae", fbIcon: [531, 1355.26], fbX: 562.03, fbY: 1352.06, fbWidth: 277, fb: "facebook.com/rentsouq" }),
      rentsouqLogo(portraitLogoLook(PORTRAIT_LOGOS["rentsouq-portrait-poster-news"], false)),
    ],
    headline,
    subtext,
    g,
  )
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
  {
    id: "gensan-cover",
    name: "Homes.ph Gensan Carousel Cover",
    brand: "gensan",
    description: "The Homes.ph carousel cover for the Homes.ph Gensan page (General Santos City and SOCCSKSARGEN).",
    slideType: "cover",
    build: (ctx, content) => buildBrandCover("gensan", ctx, content),
  },
  {
    id: "gensan-card",
    name: "Homes.ph Gensan Content Card",
    brand: "gensan",
    description: "The Homes.ph content card for the Homes.ph Gensan page.",
    slideType: "card",
    build: () => buildBrandCard("gensan"),
  },
  {
    id: "fhi-cover",
    name: "FHI Global Property Carousel Cover",
    brand: "fhi",
    description: "The carousel cover in FHI's navy and champagne gold, with the FHI emblem, gold swoosh and fhiglobal.ae footer.",
    slideType: "cover",
    build: (ctx, content) => buildBrandCover("fhi", ctx, content),
  },
  {
    id: "fhi-card",
    name: "FHI Global Property Content Card",
    brand: "fhi",
    description: "Photo with a navy gradient, title, optional gold subtitle and description.",
    slideType: "card",
    build: () => buildBrandCard("fhi"),
  },
  {
    id: "pickleplay-cover",
    name: "PicklePlay Carousel Cover",
    brand: "pickleplay",
    description: "The carousel cover in PicklePlay's royal blue and lime, with the PicklePlay logo, lime swoosh and pickleplay.ph footer.",
    slideType: "cover",
    build: (ctx, content) => buildBrandCover("pickleplay", ctx, content),
  },
  {
    id: "pickleplay-card",
    name: "PicklePlay Content Card",
    brand: "pickleplay",
    description: "Photo with a blue gradient, title, optional lime subtitle and description.",
    slideType: "card",
    build: () => buildBrandCard("pickleplay"),
  },
]

export function getBuiltInTemplate(id: string): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id)
}

const NEWS_BUILDERS: Record<string, () => SlideDesign> = {
  "pickleplay-news": () => buildPickleplayNews(),
  "pickleplay-portrait-news": () => buildPickleplayPortraitNews(),
  "caraga-news": () => buildCaragaNews(),
  "caraga-portrait-news": () => buildCaragaPortraitNews(),
  "gensan-news": () => buildCaragaNews(undefined, "gensan-news"),
  "gensan-portrait-news": () => buildCaragaPortraitNews(undefined, "gensan-portrait-news"),
  "homes-news": () => buildCaragaNews(undefined, "homes-news"),
  "homes-portrait-news": () => buildCaragaPortraitNews(undefined, "homes-portrait-news"),
  "fhi-portrait-news": () => buildFhiPortraitNews(),
  "fhi-wide-news": () => buildFhiWideNews(),
  "fhi-poster-news": () => buildFhiPoster(),
  "pickleplay-poster-news": () => buildPickleplayPoster(),
  "homes-poster-news": () => buildHomesPoster(),
  "gensan-poster-news": () => buildHomesPoster(undefined, "gensan-poster-news"),
  "pickleplay-event-poster-news": () => buildPickleplayEventPoster(),
  "pickleplay-portrait-poster-news": () => buildPickleplayPortraitPoster(),
  "pickleplay-portrait-event-poster-news": () => buildPickleplayPortraitEventPoster(),
  "fhi-portrait-poster-news": () => buildFhiPortraitPoster(),
  "homes-portrait-poster-news": () => buildHomesPortraitPoster(),
  "gensan-portrait-poster-news": () => buildHomesPortraitPoster(undefined, "gensan-portrait-poster-news"),
}
const sampleTexts = new Map<string, Map<string, string>>()

/**
 * The sample text a template puts in a field ("Card Title", "Subtitle goes here", …),
 * looked up by the field's role. Undefined for custom templates and roles without one.
 */
export function templateSampleText(templateId: string | null | undefined, role: string | null | undefined): string | undefined {
  if (!templateId || !role) return undefined
  let byRole = sampleTexts.get(templateId)
  if (!byRole) {
    byRole = new Map()
    const design = getBuiltInTemplate(templateId)?.build(DEFAULT_TEMPLATE_CONTEXT) ?? NEWS_BUILDERS[templateId]?.()
    for (const el of design?.elements ?? []) {
      if (el.type === "text" && el.role && el.text.trim() && !byRole.has(el.role)) byRole.set(el.role, el.text)
    }
    sampleTexts.set(templateId, byRole)
  }
  return byRole.get(role)
}

/** A new carousel's cover (Homes.ph unless another brand is asked for). */
export function buildCoverDesign(ctx: TemplateContext, content?: TemplateContent, brand: CarouselBrand = "homes"): SlideDesign {
  return buildBrandCover(brand, ctx, content)
}

/** A new content card (Homes.ph unless another brand is asked for). */
export function buildCardDesign(brand: CarouselBrand = "homes"): SlideDesign {
  return buildBrandCard(brand)
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

/**
 * The same slide in another brand's carousel template (Edit carousel → Carousel brand): a cover or
 * content card gets the brand's layout, colors, swoosh, logo and footer with its words and photo
 * kept, and anything the user added on top (elements without a template role) stays. Other slides
 * (text, full-image, quote cards…) and slides already in that brand are returned as they are.
 */
export function rebrandDesign(current: SlideDesign, brand: CarouselBrand, ctx: TemplateContext): SlideDesign {
  const cover = isCarouselCover(current.templateId)
  if (!cover && !isContentCard(current.templateId)) return current
  if (carouselBrandOf(current.templateId) === brand) return current
  // A cover photo collage stays: its slots move into the new brand's cover.
  const next = transferCollage(current, applyTemplateKeepingContent(current, cover ? buildBrandCover(brand, ctx) : buildBrandCard(brand)))
  const added = current.elements.filter((el) => !el.role && !(el.type === "image" && el.slot))
  return added.length ? { ...next, elements: [...next.elements, ...added.map((el) => structuredClone(el))] } : next
}

/** The carousel's brand: its cover's (or else its first content card's) template, Homes.ph by default. */
export function carouselBrandOfSlides(designs: Pick<SlideDesign, "templateId">[]): CarouselBrand {
  const first = designs.find((d) => isCarouselCover(d.templateId)) ?? designs.find((d) => isContentCard(d.templateId))
  return carouselBrandOf(first?.templateId)
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
  // A collage cover is listed with its first photo.
  const background =
    collagePhoto(design) ??
    design.elements.find((el): el is ImageElement => el.type === "image" && el.role === "background" && !!el.src)
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
  const text = [s.title, design.templateId === "homes-cover" || design.templateId === "gensan-cover" || design.templateId === "classic-cover" ? s.subtitle : null].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  return text || fallback
}
