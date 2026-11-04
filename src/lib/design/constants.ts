export const BRAND = {
  deepBlue: "#0F4C81",
  overlayBlue: "#0D1969",
  yellow: "#F8C563",
  orange: "#F97316",
  white: "#FFFFFF",
  lightGray: "#F8FAFC",
  black: "#000000",
} as const

export const BRAND_SWATCHES = [
  BRAND.white,
  "#FFF1B9",
  BRAND.black,
  BRAND.yellow,
  BRAND.orange,
  BRAND.deepBlue,
  BRAND.overlayBlue,
  "#0730A3",
  "#0B1767",
  BRAND.lightGray,
  "#64748B",
]

export interface FontOption {
  family: string
  weights: number[]
}

export const FONTS: FontOption[] = [
  { family: "Outfit", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Inter", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Plus Jakarta Sans", weights: [300, 400, 500, 600, 700, 800] },
]

export const WEIGHT_LABELS: Record<number, string> = {
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
}

/** Official Homes.ph logos. The white PNG includes transparent padding around the mark. */
export const LOGO_WHITE_SRC = "/brand/homes-ph-logo-white.png"
/** The blue PNG has no padding (260 × 252); Figma draws it at 65 × 63 inside a 72 × 70 slot (same proportions at any size). */
export const LOGO_BLUE_SRC = "/brand/homes-ph-logo-blue.png"
export const LOGO_NATURAL = { white: { width: 288, height: 280 }, blue: { width: 260, height: 252 } } as const

/** Logo slot ("white H") from the Figma spec: centered, x 583, y 39, 88 × 86. */
export const LOGO_BOX = { x: 583, y: 39, width: 88, height: 86 }
/** Share of the slot the padding-free blue artwork fills (65 × 63 of 72 × 70). */
export const BLUE_LOGO_SCALE = { x: 65 / 72, y: 63 / 70 }

/**
 * Average luminance (0–1) behind the logo above which the blue logo is used.
 * 0.27 is where blue (rgb 20, 40, 174) starts to contrast better than white.
 */
export const LOGO_LIGHT_THRESHOLD = 0.27

/** Gold + blue corner swoosh from the cover template (full 1254 × 1254 transparent PNG). */
export const SWOOSH_SRC = "/brand/top-right-swoosh.png"
/** The same corner swoosh mirrored to the top left (Corner Blue / Corner Gold Swoosh, flipped). */
export const SWOOSH_LEFT_SRC = "/brand/top-left-swoosh.png"

/** PicklePlay news article (1408 × 1408): background art (gradient, glow, swooshes, pickleball) and logo. */
export const NEWS_SIZE = 1408
export const PICKLEPLAY_BACKGROUND_SRC = "/brand/news/pickleplay-background.png"
export const PICKLEPLAY_LOGO_SRC = "/brand/news/pickleplay-logo.png"
/** FHI Global Property (Dubai) logo, 348 × 133 on transparent. */
export const FHI_LOGO_SRC = "/brand/news/fhi-global-logo.png"

export const ICON_WEB_SRC = "/brand/icon-web.png"
export const ICON_FACEBOOK_SRC = "/brand/icon-facebook.png"
export const DEFAULT_WEBSITE_TEXT = "www.homes.ph"
export const DEFAULT_FACEBOOK_TEXT = "facebook.com/homesphofficial"

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export const ACCEPTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"]
