import { imageElement, NEWS_HEADLINE_PLACEHOLDER, POSTER_CREDIT_PREFIX, POSTER_SAMPLE_HIGHLIGHT, textElement } from "./templates"
import { DESIGN_VERSION, type DesignElement, type SlideDesign, type TextElement } from "./types"

/**
 * The Homes.ph poster designs (1.51, "Poster Maker Template/Template 1–10.svg", 1126 × 1408): a photo that fills
 * the poster (Template 6: a card over a blurred copy of it), the design's own art over it (blue glow, dark fade,
 * Homes.ph logo, gold rule, footer: pictures made from the SVGs, public/brand/poster/designs), a ONE-line
 * headline and a TWO-line subtext (each line stays on one line, shrinking from the design's size, on the
 * design's baseline). Fonts: Poppins (the headlines are Poppins Black, as in the designs; the subtext's font in
 * the designs is Canva's own, so Poppins SemiBold / Medium at the same sizes). Measured from the SVG glyphs.
 */

export const POSTER_DESIGN_COUNT = 10
export const DESIGN_ART = (n: number) => `/brand/poster/designs/design-${n}.webp`
export const DESIGN_THUMB = (n: number) => `/brand/poster/designs/design-${n}-thumb.jpg`

export type DesignBrand = "homes" | "gensan"

/** "homes-d3-poster-news" */
export const designTemplateId = (brand: DesignBrand, n: number) => `${brand}-d${n}-poster-news`

const DESIGN_ID = /^(homes|gensan)-d(\d+)-poster-news$/

/** The design number of a template (null for any other template). */
export function posterDesignOf(templateId: string | null | undefined): number | null {
  const m = DESIGN_ID.exec(templateId ?? "")
  const n = m ? Number(m[2]) : NaN
  return n >= 1 && n <= POSTER_DESIGN_COUNT ? n : null
}

export const isDesignPoster = (templateId: string | null | undefined) => posterDesignOf(templateId) !== null

const GOLD = "#EEA023"
const WHITE = "#FAFAFA"
const HEAD_WHITE = "#FCFCFD"
/** Where Poppins' baseline falls in its 100% line in the renderer (Konva): 0.85 × the size. */
const BASELINE = 0.85
const W = 1126
const H = 1408
const LEFT = { x: 31, width: W - 62 }
const CENTER = { x: 40, width: W - 80 }

interface Line {
  size: number
  weight: number
  /** The design's baseline (px). */
  base: number
  /** Box left (left-aligned lines; centered ones use CENTER). */
  x?: number
  fill: string
  /** The highlighted words' color. */
  hl: string
  upper?: boolean
  /** Letter spacing in em (default -0.02, the designs' Poppins tracking). */
  ls?: number
}

interface Design {
  align: "left" | "center"
  /** Template 6: the photo's card (it shows over a blurred copy of the photo). */
  card?: { x: number; y: number; width: number; height: number; radius: number }
  headline: Line
  sub1: Line
  sub2?: Line
}

const DESIGNS: Record<number, Design> = {
  1: {
    align: "left",
    headline: { size: 82, weight: 900, base: 1157.1, x: 31.2, fill: GOLD, hl: WHITE, upper: true },
    sub1: { size: 55, weight: 600, base: 1237, x: 30.8, fill: WHITE, hl: GOLD },
    sub2: { size: 48, weight: 600, base: 1295.3, x: 30.6, fill: WHITE, hl: GOLD },
  },
  2: {
    align: "left",
    headline: { size: 81, weight: 900, base: 1157.1, x: 30.4, fill: GOLD, hl: WHITE, upper: true },
    sub1: { size: 55, weight: 600, base: 1244.7, x: 29.4, fill: WHITE, hl: GOLD },
    sub2: { size: 54, weight: 600, base: 1305.7, x: 30.7, fill: WHITE, hl: GOLD },
  },
  3: {
    align: "left",
    headline: { size: 83, weight: 900, base: 1157.1, x: 31.2, fill: GOLD, hl: WHITE, upper: true },
    sub1: { size: 42, weight: 500, base: 1237.5, x: 29.1, fill: WHITE, hl: GOLD, ls: 0 },
    sub2: { size: 42, weight: 500, base: 1286.5, x: 30.3, fill: WHITE, hl: GOLD, ls: 0 },
  },
  4: {
    align: "left",
    headline: { size: 117, weight: 900, base: 1134.3, x: 30.4, fill: HEAD_WHITE, hl: GOLD, upper: true },
    sub1: { size: 60, weight: 600, base: 1240.1, x: 35.8, fill: WHITE, hl: GOLD },
    sub2: { size: 48, weight: 600, base: 1293.6, x: 40.5, fill: GOLD, hl: WHITE },
  },
  5: {
    align: "center",
    headline: { size: 128, weight: 900, base: 1089, fill: HEAD_WHITE, hl: GOLD, upper: true, ls: -0.01 },
    sub1: { size: 63, weight: 600, base: 1184.8, fill: HEAD_WHITE, hl: GOLD },
    sub2: { size: 62, weight: 600, base: 1247.1, fill: HEAD_WHITE, hl: GOLD },
  },
  6: {
    align: "center",
    card: { x: 48.2, y: 190.4, width: 1029, height: 782.9, radius: 35 },
    headline: { size: 76, weight: 900, base: 1098, fill: GOLD, hl: WHITE, upper: true, ls: 0 },
    sub1: { size: 79, weight: 700, base: 1189, fill: "#FEFEFE", hl: GOLD, upper: true, ls: 0 },
    sub2: { size: 54, weight: 500, base: 1261.7, fill: GOLD, hl: WHITE, ls: 0 },
  },
  7: {
    align: "left",
    headline: { size: 82, weight: 900, base: 1157.1, x: 31.2, fill: GOLD, hl: WHITE, upper: true },
    sub1: { size: 48, weight: 600, base: 1246.1, x: 29.3, fill: WHITE, hl: GOLD },
    sub2: { size: 50, weight: 600, base: 1300.1, x: 29.6, fill: WHITE, hl: GOLD },
  },
  8: {
    align: "left",
    headline: { size: 104, weight: 900, base: 1156.3, x: 33.8, fill: GOLD, hl: WHITE, upper: true },
    sub1: { size: 47, weight: 600, base: 1246.1, x: 29.3, fill: WHITE, hl: GOLD },
    sub2: { size: 48, weight: 600, base: 1300.1, x: 30.6, fill: WHITE, hl: GOLD },
  },
  9: {
    align: "left",
    headline: { size: 82, weight: 900, base: 1075.2, x: 31.2, fill: GOLD, hl: WHITE, upper: true },
    sub1: { size: 82, weight: 900, base: 1157.1, x: 30.9, fill: HEAD_WHITE, hl: GOLD, upper: true },
    sub2: { size: 46, weight: 600, base: 1239.9, x: 29.2, fill: WHITE, hl: GOLD },
  },
  10: {
    align: "center",
    headline: { size: 122, weight: 900, base: 1151.6, fill: GOLD, hl: WHITE, upper: true },
    sub1: { size: 82, weight: 900, base: 1274.8, fill: HEAD_WHITE, hl: GOLD, upper: true },
  },
}

/** A design's subtext has a second line (Template 10's is one line). */
export const designHasSecondLine = (n: number) => !!DESIGNS[n]?.sub2

/** The design's line sizes (the Poster Maker's notes: "the design's size is 82 px"). */
export function designSizes(n: number): { headline: number; sub1: number; sub2: number | null } | null {
  const d = DESIGNS[n]
  return d ? { headline: d.headline.size, sub1: d.sub1.size, sub2: d.sub2?.size ?? null } : null
}

function line(name: string, role: TextElement["role"], l: Line, align: Design["align"], text: string, visible: boolean): TextElement {
  const box = align === "center" ? CENTER : { x: l.x ?? LEFT.x, width: W - 2 * (l.x ?? LEFT.x) }
  const ls = l.ls ?? -0.02
  return textElement({
    name,
    role,
    text,
    x: box.x,
    y: Math.round((l.base - BASELINE * l.size) * 100) / 100,
    width: box.width,
    fontFamily: "Poppins",
    fontSize: l.size,
    fontWeight: l.weight,
    lineHeight: l.size,
    letterSpacing: Math.round(ls * l.size * 100) / 100,
    align,
    fill: l.fill,
    textCase: l.upper ? "upper" : null,
    visible,
    highlight: { phrases: [], fill: l.hl },
    // ONE line: shrinks from the design's size to fit the width, on the design's baseline.
    autoFit: { maxWidth: box.width, maxSize: l.size, lineHeightRatio: 1, letterSpacingEm: ls, anchor: { baseline: l.base, ratio: BASELINE } },
  })
}

/** Builds poster design `n` (1–10) as `templateId` (Homes.ph, or the Homes.ph Gensan page's). */
export function buildDesignPoster(n: number, templateId: string, content?: { headline?: string }): SlideDesign {
  const d = DESIGNS[n] ?? DESIGNS[1]
  const full = { x: 0, y: 0, width: W, height: H }
  const art = (name: string, src: string) => imageElement({ name, role: "overlay", src, naturalWidth: W, naturalHeight: H, ...full, fit: "contain", locked: true })
  const headline = line("Headline", "title", d.headline, d.align, content?.headline ?? NEWS_HEADLINE_PLACEHOLDER, true)
  if (!content?.headline) headline.highlight = { ...headline.highlight!, phrases: [POSTER_SAMPLE_HIGHLIGHT] }
  const elements: DesignElement[] = [
    ...(d.card
      ? [
          art("Design Background", `/brand/poster/designs/design-${n}-under.webp`),
          // The blurred copy of the photo around the card (follows the photo).
          imageElement({ name: "Photo Backdrop", role: "background", ...full, fit: "cover", blurred: true, opacity: 0.55, locked: true }),
        ]
      : []),
    imageElement({
      name: "Photo",
      role: "background",
      ...(d.card ? { x: d.card.x, y: d.card.y, width: d.card.width, height: d.card.height, cornerRadius: d.card.radius } : full),
      fit: "cover",
      blurFill: true,
      locked: true,
    }),
    art("Design Art", DESIGN_ART(n)),
    // "PHOTO OF: …" (off until a name is given), top left as in Template 8.
    textElement({
      name: "Photo Credit",
      role: "label",
      text: POSTER_CREDIT_PREFIX,
      x: 16.4,
      y: Math.round((33 - BASELINE * 17) * 100) / 100,
      width: 700,
      fontFamily: "Poppins",
      fontSize: 17,
      fontWeight: 400,
      lineHeight: 17,
      fill: HEAD_WHITE,
      textCase: "upper",
      visible: false,
      shadow: { enabled: true, color: "rgba(0, 0, 0, 0.35)", blur: 4, offsetX: 0, offsetY: 1 },
    }),
    headline,
    line("Subtext", "subtitle", d.sub1, d.align, "", false),
    ...(d.sub2 ? [line("Subtext Line 2", "subtitle", d.sub2, d.align, "", false)] : []),
  ]
  return { version: DESIGN_VERSION, width: W, height: H, background: "#0D1A6B", elements, templateId }
}

// ---------- the two-line subtext ----------

export const SUBTEXT_LINE_2 = "Subtext Line 2"

const words = (s: string) => s.replace(/\s+/g, " ").trim()

/**
 * The subtext split onto the design's two lines: where it was typed (Enter), else at the word that best balances
 * the two lines for their sizes (a bigger first line holds fewer letters).
 */
export function splitSubtext(text: string, sizes: { sub1: number; sub2: number | null }): [string, string] {
  const raw = text.replace(/\r/g, "")
  const nl = raw.indexOf("\n")
  if (!sizes.sub2) return [words(raw), ""]
  if (nl >= 0) return [words(raw.slice(0, nl)), words(raw.slice(nl + 1))]
  const all = words(raw).split(" ").filter(Boolean)
  if (all.length < 2) return [all.join(" "), ""]
  let best = 1
  let bestCost = Infinity
  for (let i = 1; i < all.length; i++) {
    const a = all.slice(0, i).join(" ").length * sizes.sub1
    const b = all.slice(i).join(" ").length * sizes.sub2
    // The widest line decides how much both shrink: keep it as narrow as possible.
    const cost = Math.max(a, b)
    if (cost < bestCost) {
      bestCost = cost
      best = i
    }
  }
  return [all.slice(0, best).join(" "), all.slice(best).join(" ")]
}

/** The subtext's highlighted words ("Grammy Nominations, ASEAN"): one or more phrases, comma separated. */
export const hookPhrases = (hook: string) =>
  hook
    .split(",")
    .map((p) => words(p))
    .filter(Boolean)
