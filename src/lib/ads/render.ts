/**
 * Advertisement → PicklePlay posters: draws a Pickleball History, Trivia or Fun Fact on one of
 * the Figma templates (public/ads/pickleplay, built by scripts/build-ad-templates.cjs).
 *
 * Each template is its background (the Figma design without its sample text), the text drawn
 * here in the template's fonts, sizes and colors, and a top layer for the pictures that sit
 * above the text. Every text has the box its sample text had: longer text wraps and shrinks
 * to stay inside it; pills, highlight boxes and underlines follow the text's width.
 *
 * No imports: the same file runs in the app and in the layout check against the Figma files.
 */

export const AD_SIZE = 1408

export type AdKind = "history" | "trivia" | "funfact" | "courtowner" | "comingsoon" | "nowopen"
export type AdTemplateId = `${AdKind}-${number}`

export const AD_KINDS: { id: AdKind; name: string; short: string }[] = [
  { id: "history", name: "Pickleball History", short: "History" },
  { id: "trivia", name: "Pickleball Trivia", short: "Trivia" },
  { id: "funfact", name: "Pickleball Fun Facts", short: "Fun Facts" },
  { id: "courtowner", name: "Court Owners", short: "Court Owners" },
  { id: "comingsoon", name: "Court Coming Soon", short: "Coming Soon" },
  { id: "nowopen", name: "Court Now Open", short: "Now Open" },
]

/** How many templates each kind has: Court Owners is a week of ads (Day 1–7). */
const TEMPLATE_COUNT: Record<AdKind, number> = { history: 4, trivia: 4, funfact: 4, courtowner: 7, comingsoon: 3, nowopen: 4 }
export const adTemplates = (kind: AdKind): AdTemplateId[] => Array.from({ length: TEMPLATE_COUNT[kind] }, (_, i) => `${kind}-${i + 1}` as AdTemplateId)

/** Coming Soon and Now Open: a court's own post (its name, barangay and city, and its logo). */
export const isCourtKind = (kind: AdKind): kind is "comingsoon" | "nowopen" => kind === "comingsoon" || kind === "nowopen"
export const adKindOf = (id: AdTemplateId): AdKind => id.split("-")[0] as AdKind

/** Where the templates' layers are (built by scripts/build-ad-templates.cjs). */
export const AD_BASE = "/ads/pickleplay/"
export const AD_MANIFEST = `${AD_BASE}manifest.json`

/**
 * One template, bottom to top: the design's layers, the court photo (or the user's own photo),
 * the paddle and the ball (whole, at their size and tilt) and the place of the generated text.
 */
export type AdStep =
  | { type: "layer"; src: string }
  | { type: "text" }
  | {
      type: "photo"
      /** The template's own photo… */
      src: string
      width: number
      height: number
      /** …placed in `box` like Figma (the image's transform in box units). */
      matrix: number[]
      opacity: number
      /** The shape the photo fills (a rectangle, the arch, the photo band). */
      d: string
      box: [number, number, number, number]
      /** A tilted photo frame (Court Owners Day 7): the photo turns with it, covering w × h. */
      turn?: { cx: number; cy: number; w: number; h: number; angle: number }
    }
  | { type: "picture"; name: "paddle" | "ball"; cx: number; cy: number; w: number; h: number; angle: number }
  /** The court's logo (Coming Soon / Now Open): fitted inside w × h around cx, cy, turned by `angle`. */
  | { type: "logo"; cx: number; cy: number; w: number; h: number; angle: number; shadow?: { color: string; blur: number; dy: number } }

export interface AdManifest {
  size: number
  pictures: { paddle: string; ball: string; courtLogo?: string }
  templates: Record<string, AdStep[]>
}

/** Every file a template needs (to load before drawing). */
export function adFiles(manifest: AdManifest, id: AdTemplateId): string[] {
  const files = new Set<string>()
  for (const s of manifest.templates[id] ?? []) {
    if (s.type === "layer" || s.type === "photo") files.add(s.src)
    if (s.type === "picture") files.add(manifest.pictures[s.name])
    if (s.type === "logo" && manifest.pictures.courtLogo) files.add(manifest.pictures.courtLogo)
  }
  return [...files]
}

/** The templates with a court logo (the user can put the court's own logo there). */
export const hasLogo = (manifest: AdManifest, id: AdTemplateId) => (manifest.templates[id] ?? []).some((s) => s.type === "logo")

/** The templates that have a court photo (the user can put their own photo there). */
export const hasPhoto = (manifest: AdManifest, id: AdTemplateId) => (manifest.templates[id] ?? []).some((s) => s.type === "photo")

// ---------------------------------------------------------------------------------------------
// Content (what the AI writes; every template of a kind draws from the same fields)
// ---------------------------------------------------------------------------------------------

export interface FunFactContent {
  /** "01" (shown as #01 / No. 01). */
  number: string
  /** The line before the number: "An outdoor pickleball has". */
  lead: string
  /** The number in big: "40". */
  big: string
  /** The word after it: "holes!". */
  word: string
  /** One or two sentences explaining it. */
  body: string
  /** Two sides of the fact (template 2): "Indoor ~26 bigger holes" vs "Outdoor ~40 smaller holes". */
  leftLabel: string
  leftValue: string
  leftText: string
  rightLabel: string
  rightValue: string
  rightText: string
  /** One short sentence under the comparison (template 2). */
  note: string
  /** The picture's caption (template 3): "Outdoor ball · 40 holes". */
  caption: string
}

export interface HistoryContent {
  /**
   * The post's key word, shown huge (templates 2 and 4) and in color inside the headline: a year
   * ("1965"), a name ("Erne"), a thing ("Plywood") or a part of the game ("Kitchen").
   */
  focus: string
  /** One sentence with the focus word in it: "Pickleball was born in a backyard in 1965." */
  headline: string
  /** The headline without the focus word (template 2, under the big word): "Pickleball was born in a backyard." */
  shortHeadline: string
  /** Where/who/how, two sentences. */
  body: string
  /** Second card's title: "Why “pickleball”?". */
  sideTitle: string
  /** Second card's text. */
  sideBody: string
  /** First card's title (template 2): "Where it started". */
  startTitle: string
  /** The story's label (template 3): "1965 · Bainbridge Island, WA". */
  storyTag: string
  /** The badge on the photo (template 3): "Est. 1965". */
  badge: string
}

export interface TriviaContent {
  /** "07" (template 4 shows #07). */
  number: string
  /** "What were the first [paddles] made of?": [words] get the green box. */
  question: string
  /** A longer way to ask it (template 3), with [words] in the green box. */
  longQuestion: string
  /** A very short way (template 4): "First [paddles] made of?". */
  shortQuestion: string
  /** "Wood!" */
  answer: string
  /** One or two sentences: why. */
  explanation: string
  /** Four choices (template 2); `correct` is the right one (0–3). */
  choices: [string, string, string, string]
  correct: number
}

/** Court Owners: an ad inviting court owners to list their courts on PicklePlay (the same text on all 7 days). */
export interface CourtOwnerContent {
  /** "Fill your" (white). */
  headline: string
  /** "courts!" (in the highlight block). */
  highlight: string
  /** Three benefits with check marks (Days 1–4 and 7). */
  detail1: string
  detail2: string
  detail3: string
  /** Three short features: Day 5's strip, Day 6's line. */
  feature1: string
  feature2: string
  feature3: string
}

/** The court's own details: always shown as typed (the AI never changes them). */
export interface CourtPlace {
  courtName: string
  barangay: string
  city: string
}

/** Court Coming Soon: a court that will open on PicklePlay (the same text on all 3 templates). */
export interface ComingSoonContent extends CourtPlace {
  /** The tag (templates 1 and 3) and the stamp (template 2): "Coming soon". */
  tag: string
  /** Over the logo on the ticket (template 2): "You’re invited". */
  kicker: string
  /** On the photo (template 3): "New court". */
  chip: string
  /** "Is coming to" (white or navy) … */
  headline: string
  /** … "Pickleplay.ph" (in the green block). */
  highlight: string
  /** "Book your games online — launching soon!" */
  detail: string
  /** "Be the first to play. Stay tuned!" */
  cta: string
}

/** Court Now Open: a court that is open and bookable on PicklePlay (the same text on all 4 templates). */
export interface NowOpenContent extends CourtPlace {
  /** The ribbon (template 1) and the tag under the logo (template 2): "Grand opening". */
  tag: string
  /** The tag on templates 3 and 4: "New court now open". */
  audience: string
  /** The tab over the logo card (template 4): "New court". */
  logoTab: string
  /** "Now open!": template 1 puts the last word in the green block, template 2 the whole line in white. */
  headline: string
  /** Template 2's green block: "Book today!" */
  highlight: string
  /** Templates 3 and 4: "Now open in" … */
  headlineIn: string
  /** … and the big word in the green block (usually the city): "Mandaue". */
  spotlight: string
  /** "Open daily · 6:00 AM – 10:00 PM" (templates 3 and 4 show the part after "·" in bold). */
  hours: string
  /** "Book your slot in just a few taps" (templates 2–4). */
  perk: string
  /** "Grab your squad and book your first game!" (template 1). */
  cta: string
}

export type AdContent =
  | ({ kind: "funfact" } & FunFactContent)
  | ({ kind: "history" } & HistoryContent)
  | ({ kind: "trivia" } & TriviaContent)
  | ({ kind: "courtowner" } & CourtOwnerContent)
  | ({ kind: "comingsoon" } & ComingSoonContent)
  | ({ kind: "nowopen" } & NowOpenContent)

/** "Barangay, City" (either may be empty). */
export const courtLocation = (c: CourtPlace) => [c.barangay, c.city].map((t) => t.trim()).filter(Boolean).join(", ")

/** The templates' own sample texts (the layout check draws these and compares with Figma). */
export const SAMPLE_CONTENT: { [K in AdKind]: Extract<AdContent, { kind: K }> } = {
  funfact: {
    kind: "funfact",
    number: "01",
    lead: "An outdoor pickleball has",
    big: "40",
    word: "holes!",
    body: "Indoor balls usually have around 26 bigger holes. Outdoor balls use about 40 smaller ones so they cut through the wind.",
    leftLabel: "Indoor",
    leftValue: "~26",
    leftText: "bigger holes",
    rightLabel: "Outdoor",
    rightValue: "~40",
    rightText: "smaller holes",
    note: "Smaller holes help outdoor balls cut through the wind.",
    caption: "Outdoor ball · 40 holes",
  },
  history: {
    kind: "history",
    focus: "1965",
    headline: "Pickleball was born in a backyard in 1965.",
    shortHeadline: "Pickleball was born in a backyard.",
    body: "On Bainbridge Island, Washington, three dads — Joel Pritchard, Bill Bell and Barney McCallum — invented the game to cure their kids’ summer boredom.",
    sideTitle: "Why “pickleball”?",
    sideBody: "Joan Pritchard said the mix of borrowed gear reminded her of the “pickle boat” in rowing — a crew made up of leftover oarsmen.",
    startTitle: "Where it started",
    storyTag: "1965 · Bainbridge Island, WA",
    badge: "Est. 1965",
  },
  trivia: {
    kind: "trivia",
    number: "07",
    question: "What were the first [paddles] made of?",
    longQuestion: "Before graphite and carbon fiber, what were the [very first] [pickleball paddles] made of?",
    shortQuestion: "First [paddles] made of?",
    answer: "Wood!",
    explanation: "Barney McCallum shaped the first real paddles from plywood. Today, most are graphite or carbon fiber.",
    choices: ["Aluminum", "Plastic", "Wood", "Graphite"],
    correct: 2,
  },
  courtowner: {
    kind: "courtowner",
    headline: "Fill your",
    highlight: "courts!",
    detail1: "Reach more players near you",
    detail2: "Take court bookings online",
    detail3: "Promote your open-play schedule",
    feature1: "More players",
    feature2: "Online bookings",
    feature3: "Open-play promos",
  },
  comingsoon: {
    kind: "comingsoon",
    tag: "Coming soon",
    kicker: "You’re invited",
    chip: "New court",
    headline: "Is coming to",
    highlight: "Pickleplay.ph",
    courtName: "Court Name",
    barangay: "Barangay",
    city: "City",
    detail: "Book your games online — launching soon!",
    cta: "Be the first to play. Stay tuned!",
  },
  nowopen: {
    kind: "nowopen",
    tag: "Grand opening",
    audience: "New court now open",
    logoTab: "New court",
    headline: "Now open!",
    highlight: "Book today!",
    headlineIn: "Now open in",
    spotlight: "Mandaue",
    courtName: "Court Name",
    barangay: "Barangay",
    city: "City",
    hours: "Open daily · 6:00 AM – 10:00 PM",
    perk: "Book your slot in just a few taps",
    cta: "Grab your squad and book your first game!",
  },
}

// ---------------------------------------------------------------------------------------------
// Fonts and colors
// ---------------------------------------------------------------------------------------------

type Family = "Poppins" | "Playfair Display" | "Inter" | "Outfit"
interface Font {
  family: Family
  weight: number
  size: number
}

const POP = "Poppins" as const
const PLAY = "Playfair Display" as const
const INTER = "Inter" as const
const OUTFIT = "Outfit" as const
const LIME = "#B6F23A"
const NAVY = "#091B5C"
const BLUE = "#0E45D8"
const INK = "#24345F"
const WHITE = "#FFFFFF"

const css = (f: Font) => `${f.weight} ${f.size}px "${f.family}"`

/** Loads the fonts the templates use (call before drawing). */
export async function ensureAdFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return
  const wanted = [
    ...[400, 500, 600, 700, 800].map((w) => `${w} 40px "Poppins"`),
    `700 40px "Playfair Display"`,
    `400 40px "Inter"`,
    `700 40px "Inter"`,
    `700 40px "Outfit"`,
    `800 40px "Outfit"`,
  ]
  await Promise.all(wanted.map((f) => document.fonts.load(f, "AaÑñ0123“”—·?!").catch(() => [])))
}

// ---------------------------------------------------------------------------------------------
// Text: marks, wrapping, fitting
// ---------------------------------------------------------------------------------------------

/** "[words]" go in the highlight box, "{words}" in the accent color. */
type Mark = "box" | "accent" | null
interface Seg {
  text: string
  mark: Mark
}
interface Word {
  segs: Seg[]
  /** Which [group] a highlighted word belongs to ("[very first] [pickleball paddles]" are two boxes). */
  group: number
}
interface Unit {
  segs: Seg[]
  /** Drawn width (box units include their padding; `lead` included). */
  w: number
  box: boolean
  /** Extra space before the word (an {accent} word that was its own Figma layer). */
  lead?: number
}
interface Line {
  units: Unit[]
  w: number
}

interface BoxStyle {
  fill: string
  /** Box height and padding at the text's full size (scaled when the text shrinks). */
  height: number
  padX: number
  radius: number
  /** Degrees; the text turns with it when `turnText`. */
  rotate?: number
  turnText?: boolean
  textColor: string
  shadow?: { dx: number; dy: number; color: string }
}

interface TextSpec {
  font: Font
  color: string
  /** Accent color for {marked} words. */
  accent?: string
  box?: BoxStyle
  upper?: boolean
  alpha?: number
  letterSpacing?: number
  /** Headlines and questions: never one word alone on the last line. */
  balance?: boolean
  /** Extra px (at full size) before an {accent} word: Figma had it as its own layer, a little apart. */
  accentGap?: number
  /** CSS text-shadow (Now Open 3 and 4's details). */
  shadow?: TextShadow
}

interface TextShadow {
  dx: number
  dy: number
  blur: number
  color: string
}

function setShadow(ctx: CanvasRenderingContext2D, shadow?: TextShadow) {
  ctx.shadowColor = shadow?.color ?? "transparent"
  ctx.shadowOffsetX = shadow?.dx ?? 0
  ctx.shadowOffsetY = shadow?.dy ?? 0
  ctx.shadowBlur = shadow?.blur ?? 0
}

/** Splits marked text into words of segments. */
export function markedWords(text: string): Word[] {
  const chars: { ch: string; mark: Mark; group: number }[] = []
  let mark: Mark = null
  let group = 0
  for (const ch of text) {
    if (ch === "[") {
      mark = "box"
      group++
    } else if (ch === "]") mark = null
    else if (ch === "{") mark = "accent"
    else if (ch === "}") mark = null
    else chars.push({ ch, mark, group: mark === "box" ? group : 0 })
  }
  const words: Word[] = []
  let cur: Seg[] = []
  let curGroup = 0
  const flush = () => {
    if (cur.length) words.push({ segs: cur, group: curGroup })
    cur = []
    curGroup = 0
  }
  for (const c of chars) {
    if (/\s/.test(c.ch)) {
      flush()
      continue
    }
    if (c.group) curGroup = c.group
    const last = cur[cur.length - 1]
    if (last && last.mark === c.mark) last.text += c.ch
    else cur.push({ text: c.ch, mark: c.mark })
  }
  flush()
  return words
}

const isBoxWord = (w: Word) => w.segs.every((s) => s.mark === "box")

function setFont(ctx: CanvasRenderingContext2D, spec: TextSpec, size: number) {
  ctx.font = css({ ...spec.font, size })
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${((spec.letterSpacing ?? 0) * size) / spec.font.size}px`
}

const segsWidth = (ctx: CanvasRenderingContext2D, segs: Seg[]) => segs.reduce((n, s) => n + ctx.measureText(s.text).width, 0)

/** Wraps the words into lines no wider than `maxWidth` (a highlight group stays together when it fits). */
function wrap(ctx: CanvasRenderingContext2D, words: Word[], maxWidth: number, padX: number, hasBox: boolean, balance = false, accentGap = 0): Line[] {
  const space = ctx.measureText(" ").width
  // Units: the words of one [group] are one unit (kept on one line when it fits), other words are units of their own.
  const units: Unit[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (hasBox && isBoxWord(w)) {
      const group: Word[] = [w]
      while (i + 1 < words.length && isBoxWord(words[i + 1]) && words[i + 1].group === w.group) group.push(words[++i])
      const joined: Seg[] = group.flatMap((g, k) => (k ? [{ text: " ", mark: "box" as Mark }, ...g.segs] : g.segs))
      const width = segsWidth(ctx, joined) + padX * 2
      if (width <= maxWidth || group.length === 1) units.push({ segs: joined, w: width, box: true })
      else for (const g of group) units.push({ segs: g.segs, w: segsWidth(ctx, g.segs) + padX * 2, box: true })
    } else {
      const lead = accentGap && w.segs[0]?.mark === "accent" ? accentGap : 0
      units.push({ segs: w.segs, w: segsWidth(ctx, w.segs) + lead, box: false, lead })
    }
  }
  const lines = fill(units, space, maxWidth)
  if (balance) noOrphan(lines, space, maxWidth)
  return lines
}

/** A last line of one word takes the word before it ("in a backyard / in 1965.", not "in a backyard in / 1965."). */
function noOrphan(lines: Line[], space: number, maxWidth: number) {
  const last = lines[lines.length - 1]
  const prev = lines[lines.length - 2]
  if (!prev || last.units.length !== 1 || prev.units.length < 2) return
  const moved = prev.units[prev.units.length - 1]
  const w = moved.w + space + last.w
  if (w > maxWidth + 0.5) return
  prev.units.pop()
  prev.w -= moved.w + space
  last.units.unshift(moved)
  last.w = w
}

/** Fills each line as far as it goes (how Figma wraps text in a box). */
function fill(units: Unit[], space: number, maxWidth: number): Line[] {
  const lines: Line[] = []
  let line: Line = { units: [], w: 0 }
  for (const u of units) {
    if (line.units.length && line.w + space + u.w > maxWidth) {
      lines.push(line)
      line = { units: [], w: 0 }
    }
    line.w += (line.units.length ? space : 0) + u.w
    line.units.push(u)
  }
  if (line.units.length) lines.push(line)
  return lines
}

interface Fitted {
  size: number
  lines: Line[]
  /** The text didn't fit even at the smallest size. */
  overflow: boolean
}

/** The biggest size (from the template's size down to `minSize`) at which the text fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, spec: TextSpec, maxWidth: number, maxLines: number, minSize: number): Fitted {
  const words = markedWords(spec.upper ? text.toUpperCase() : text)
  const base = spec.font.size
  for (let size = base; ; size = Math.max(minSize, Math.floor(size * 0.97 * 10) / 10)) {
    setFont(ctx, spec, size)
    const padX = spec.box ? (spec.box.padX * size) / base : 0
    const lines = wrap(ctx, words, maxWidth, padX, !!spec.box, spec.balance, ((spec.accentGap ?? 0) * size) / base)
    const fits = lines.length <= maxLines && lines.every((l) => l.w <= maxWidth + 0.5)
    if (fits || size <= minSize) return { size, lines, overflow: !fits }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

const capHeight = (ctx: CanvasRenderingContext2D) => ctx.measureText("H").actualBoundingBoxAscent

function drawSegs(ctx: CanvasRenderingContext2D, segs: Seg[], x: number, y: number, color: string, accent?: string) {
  let at = x
  for (const s of segs) {
    ctx.fillStyle = s.mark === "accent" && accent ? accent : color
    ctx.fillText(s.text, at, y)
    at += ctx.measureText(s.text).width
  }
}

type Align = "left" | "center" | "right"

interface Block {
  text: string
  spec: TextSpec
  /** Left edge, center or right edge (by `align`). */
  x: number
  /** The first line's baseline when the text has `lines` lines at full size. */
  y: number
  /** Line height at full size. */
  lineHeight: number
  maxWidth: number
  /** Lines the sample text had; up to `maxLines` are allowed. */
  lines: number
  maxLines?: number
  minSize: number
  align?: Align
  /** Where fewer (or more) lines than the sample's sit: from the top, around the middle or up from the bottom. */
  valign?: "top" | "center" | "bottom"
  /** Extra space (at full size) under a line with a highlight box (Trivia 1). */
  afterBoxLine?: number
}

interface Drawn {
  size: number
  lines: number
  /** Ink box of the block (for decorations). */
  left: number
  right: number
  top: number
  bottom: number
  lastBaseline: number
  overflow: boolean
}

/** Draws a block of (marked) text inside its box; returns where it went. */
function drawBlock(ctx: CanvasRenderingContext2D, b: Block): Drawn {
  const align = b.align ?? "left"
  const maxLines = b.maxLines ?? b.lines
  const f = fit(ctx, b.text, b.spec, b.maxWidth, maxLines, b.minSize)
  const scale = f.size / b.spec.font.size
  const lh = b.lineHeight * scale
  setFont(ctx, b.spec, f.size)
  const cap = capHeight(ctx)
  const fullCap = cap / scale
  // The sample's block: from its first line's cap top to its last baseline; the text keeps its top, middle or bottom.
  // Each line's distance from the first baseline (a line under a highlight box can sit a little lower).
  const extra = (b.afterBoxLine ?? 0) * scale
  const offsets: number[] = []
  f.lines.forEach((_, i) => offsets.push(i === 0 ? 0 : offsets[i - 1] + lh + (f.lines[i - 1].units.some((u) => u.box) ? extra : 0)))
  const span = offsets[offsets.length - 1] ?? 0
  const sampleTop = b.y - fullCap
  const sampleBottom = b.y + (b.lines - 1) * b.lineHeight + (b.lines > 1 ? b.afterBoxLine ?? 0 : 0)
  const height = cap + span
  const valign = b.valign ?? "top"
  const first = valign === "top" ? sampleTop + cap : valign === "bottom" ? sampleBottom - span : (sampleTop + sampleBottom) / 2 - height / 2 + cap
  const space = ctx.measureText(" ").width
  const box = b.spec.box
  let left = Infinity
  let right = -Infinity
  ctx.save()
  ctx.globalAlpha = b.spec.alpha ?? 1
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"
  if (b.spec.shadow) setShadow(ctx, b.spec.shadow)
  f.lines.forEach((line, i) => {
    const baseline = first + offsets[i]
    const startX = align === "left" ? b.x : align === "center" ? b.x - line.w / 2 : b.x - line.w
    left = Math.min(left, startX)
    right = Math.max(right, startX + line.w)
    let at = startX
    for (const u of line.units) {
      if (u.box && box) drawBoxUnit(ctx, u, at, baseline, cap, box, scale, b.spec)
      else drawSegs(ctx, u.segs, at + (u.lead ?? 0), baseline, b.spec.color, b.spec.accent)
      at += u.w + space
    }
  })
  ctx.restore()
  return { size: f.size, lines: f.lines.length, left, right, top: first - cap, bottom: first + span, lastBaseline: first + span, overflow: f.overflow }
}

function drawBoxUnit(ctx: CanvasRenderingContext2D, u: Unit, x: number, baseline: number, cap: number, box: BoxStyle, scale: number, spec: TextSpec) {
  const h = box.height * scale
  const padX = box.padX * scale
  const cx = x + u.w / 2
  const cy = baseline - cap / 2
  const turn = ((box.rotate ?? 0) * Math.PI) / 180
  const shape = (dx = 0, dy = 0) => roundRect(ctx, x - cx + dx, -h / 2 + dy, u.w, h, box.radius * scale)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(turn)
  if (box.shadow) {
    shape(box.shadow.dx * scale, box.shadow.dy * scale)
    ctx.fillStyle = box.shadow.color
    ctx.fill()
  }
  shape()
  ctx.fillStyle = box.fill
  ctx.fill()
  if (!box.turnText) ctx.rotate(-turn)
  drawSegs(ctx, u.segs, x - cx + padX, cap / 2, box.textColor, spec.accent)
  ctx.restore()
}

/** Turns the drawing around (cx, cy) by `deg` for `draw`. */
function turned(ctx: CanvasRenderingContext2D, cx: number, cy: number, deg: number, draw: () => void) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  draw()
  ctx.restore()
}

const P = (weight: number, size: number): Font => ({ family: POP, weight, size })
const F = (size: number): Font => ({ family: PLAY, weight: 700, size })

/** "#01" from "1" / "01" / "#1". */
export const numberLabel = (n: string) => {
  const digits = n.replace(/[^0-9]/g, "")
  return digits ? digits.padStart(2, "0").slice(-3) : "01"
}

/** The focus word in {accent} inside the headline, any case (with the dot after it when `withDot`). */
export function markFocus(text: string, focus: string, withDot: boolean) {
  const f = focus.trim()
  if (!f) return text
  const at = text.toLowerCase().lastIndexOf(f.toLowerCase())
  if (at < 0) return text
  let end = at + f.length
  if (withDot && /^[.!?]/.test(text.slice(end))) end++
  return `${text.slice(0, at)}{${text.slice(at, end)}}${text.slice(end)}`
}

/**
 * A Figma text layer placed from its CSS: `top` is the first line box's top, `lineHeight` the CSS
 * line height, `step` the distance between the tops of Figma's separate line layers. The baseline
 * sits where CSS (and Figma) put it: half the leading, then the font's ascent.
 */
interface CssText extends Omit<Block, "spec" | "y" | "lineHeight"> {
  font: Font
  color: string
  lineHeight: number
  top: number
  step?: number
  accent?: string
  upper?: boolean
  alpha?: number
  balance?: boolean
  accentGap?: number
  box?: BoxStyle
  shadow?: TextShadow
}

function cssBaseline(ctx: CanvasRenderingContext2D, font: Font, lineHeight: number, top: number) {
  ctx.font = css(font)
  const m = ctx.measureText("Hg")
  return top + (lineHeight - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent
}

function drawCss(ctx: CanvasRenderingContext2D, t: CssText): Drawn {
  const { font, color, lineHeight, top, step, accent, upper, alpha, balance, accentGap, box, shadow, ...block } = t
  return drawBlock(ctx, {
    ...block,
    spec: { font, color, accent, upper, alpha, balance, accentGap, box, shadow },
    y: cssBaseline(ctx, font, lineHeight, top),
    lineHeight: step ?? lineHeight,
  })
}

const I = (weight: number, size: number): Font => ({ family: INTER, weight, size })
const O = (size: number): Font => ({ family: OUTFIT, weight: 700, size })

// ---------------------------------------------------------------------------------------------
// The templates
// ---------------------------------------------------------------------------------------------

type Draw<C> = (ctx: CanvasRenderingContext2D, c: C, warn: (field: string) => void) => void

const check = (d: Drawn, field: string, warn: (f: string) => void) => {
  if (d.overflow) warn(field)
  return d
}

interface RowItem {
  text: string
  font: Font
  color: string
  /** The item's CSS line box: its top and line height (each keeps its own baseline). */
  top: number
  lineHeight: number
  upper?: boolean
  shadow?: TextShadow
}

/**
 * Items side by side by their Figma text boxes (advance widths), `gap` apart, centered on `x`
 * (or starting at it); all shrink together, on their baselines, to fit `maxWidth`.
 */
function drawCssRow(ctx: CanvasRenderingContext2D, items: RowItem[], gap: number, x: number, maxWidth: number, align: "center" | "left" = "center") {
  const texts = items.map((it) => (it.upper ? it.text.toUpperCase() : it.text))
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px"
  const widths = (scale: number) =>
    items.map((it, i) => {
      ctx.font = css({ ...it.font, size: it.font.size * scale })
      return ctx.measureText(texts[i]).width
    })
  const total = (w: number[], scale: number) => w.reduce((a, b) => a + b, 0) + gap * scale * (w.length - 1)
  let scale = 1
  let ws = widths(1)
  while (total(ws, scale) > maxWidth && scale > 0.3) {
    scale *= 0.97
    ws = widths(scale)
  }
  let at = align === "center" ? x - total(ws, scale) / 2 : x
  const baselines = items.map((it) => cssBaseline(ctx, it.font, it.lineHeight, it.top))
  ctx.save()
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  const placed = items.map((it, i) => {
    ctx.font = css({ ...it.font, size: it.font.size * scale })
    ctx.fillStyle = it.color
    setShadow(ctx, it.shadow)
    ctx.fillText(texts[i], at, baselines[i])
    const p = { left: at, right: at + ws[i], baseline: baselines[i], scale }
    at += ws[i] + gap * scale
    return p
  })
  ctx.restore()
  return placed
}

/**
 * Fun Facts: from the Figma CSS of PicklePlay_Funfacts_1–4. The lead, the big number (or word) and
 * its word are Outfit Bold, the rest Poppins. The big one can be a word too: it shrinks to fit.
 */
const FUNFACT: Record<1 | 2 | 3 | 4, Draw<FunFactContent>> = {
  1: (ctx, c, warn) => {
    // The number on its pill, turned −3° like it (text box 51 × 39 around 814.6, 309.2).
    turned(ctx, 814.6, 309.2, -3, () => drawCss(ctx, { text: `#${numberLabel(c.number)}`, font: P(700, 26), color: BLUE, lineHeight: 39, top: 289.7, x: 814.6, align: "center", maxWidth: 70, lines: 1, minSize: 18 }))
    check(drawCss(ctx, { text: c.lead, font: O(84), color: WHITE, upper: true, balance: true, lineHeight: 106, top: 375.4, step: 92.1, x: 700, align: "center", maxWidth: 1060, lines: 2, minSize: 54, valign: "center" }), "lead", warn)
    // Big number (or word) and its word, 38 px apart, centered on 700 (Figma's group: 21.37%–78.35%), one baseline.
    const [, word] = drawCssRow(
      ctx,
      [
        { text: c.big, font: O(250), color: LIME, upper: true, lineHeight: 315, top: 507 },
        { text: c.word, font: O(124), color: WHITE, upper: true, lineHeight: 156, top: 633 },
      ],
      38.4,
      700,
      // Wide words shrink before they reach the ball (Figma's row is 803 wide).
      840,
    )
    roundRect(ctx, word.left + 4.1, 773, word.right - word.left + 0.2, 14, 7)
    ctx.fillStyle = LIME
    ctx.fill()
    check(drawCss(ctx, { text: c.body, font: P(400, 28), color: WHITE, lineHeight: 42, top: 885.1, step: 44, x: 362, maxWidth: 712, lines: 3, minSize: 21, valign: "center" }), "body", warn)
  },
  2: (ctx, c, warn) => {
    drawCss(ctx, { text: `#${numberLabel(c.number)}`, font: P(700, 26), color: BLUE, lineHeight: 39, top: 284, x: 814.5, align: "center", maxWidth: 70, lines: 1, minSize: 18 })
    check(drawCss(ctx, { text: c.lead, font: O(62), color: WHITE, upper: true, lineHeight: 78, top: 338.1, x: 698.6, align: "center", maxWidth: 1060, lines: 1, minSize: 38 }), "lead", warn)
    // In the ring: a long word shrinks, its middle stays.
    drawCss(ctx, { text: c.big, font: O(230), color: LIME, upper: true, lineHeight: 290, top: 482, x: 703.4, align: "center", maxWidth: 330, lines: 1, minSize: 60, valign: "center" })
    // The word's white pill: 76 high, 47 px each side of the text, centered at 704.
    const pill = { font: O(52), color: NAVY, upper: true }
    const pf = fit(ctx, c.word, pill, 466, 1, 28)
    const pw = Math.max(200, (pf.lines[0]?.w ?? 0) + (94 * pf.size) / 52)
    roundRect(ctx, 704 - pw / 2, 804, pw, 76, 38)
    ctx.fillStyle = WHITE
    ctx.fill()
    drawCss(ctx, { text: c.word, ...pill, lineHeight: 66, top: 805.9, x: 702.9, align: "center", maxWidth: 466, lines: 1, minSize: 28, valign: "center" })
    // The two sides (their cards are in the design): label, number (Outfit) and words (Poppins Bold).
    const side = (x: number, right: number, label: string, value: string, text: string, labelColor: string, color: string, gap: number) => {
      drawCss(ctx, { text: label, font: P(700, 24), color: labelColor, upper: true, lineHeight: 36, top: 964.1, x, maxWidth: right - x, lines: 1, minSize: 16 })
      drawCssRow(
        ctx,
        [
          { text: value, font: O(84), color, lineHeight: 106, top: 992 },
          { text, font: P(700, 30), color, lineHeight: 45, top: 1038 },
        ],
        gap,
        x,
        right - x,
        "left",
      )
    }
    side(216, 652, c.leftLabel, c.leftValue, c.leftText, LIME, WHITE, 26)
    side(764, 1200, c.rightLabel, c.rightValue, c.rightText, BLUE, NAVY, 25)
    check(drawCss(ctx, { text: c.note, font: P(400, 28), color: WHITE, alpha: 0.9, lineHeight: 42, top: 1138, x: 700, align: "center", maxWidth: 1040, lines: 1, minSize: 20 }), "note", warn)
  },
  3: (ctx, c, warn) => {
    drawCss(ctx, { text: `No. ${numberLabel(c.number)}`, font: F(56), color: NAVY, alpha: 0.35, lineHeight: 75, top: 284, x: 336.9, maxWidth: 330, lines: 1, minSize: 30 })
    check(drawCss(ctx, { text: c.lead, font: O(78), color: NAVY, balance: true, lineHeight: 98, top: 402, step: 86, x: 100, maxWidth: 580, lines: 2, minSize: 44, valign: "bottom" }), "lead", warn)
    // The big number (or word) from 94 (6.68%); a long word shrinks on the same baseline.
    drawCss(ctx, { text: c.big, font: O(260), color: BLUE, upper: true, lineHeight: 328, top: 520, x: 94.1, maxWidth: 580, lines: 1, minSize: 60, valign: "bottom" })
    // The word in the green block turned −2°: from x 100, 28.5 px each side, 114 high, its middle at 865.
    const block = { font: O(92), color: NAVY, upper: true }
    const bf = fit(ctx, c.word, block, 523, 1, 40)
    const scale = bf.size / 92
    const bw = (bf.lines[0]?.w ?? 0) + 57 * scale
    const bh = 114 * scale
    turned(ctx, 99.95 + bw / 2, 865, -2, () => {
      roundRect(ctx, 99.95, 865 - bh / 2, bw, bh, 18)
      ctx.fillStyle = LIME
      ctx.fill()
      ctx.font = css({ ...block.font, size: bf.size })
      ctx.textAlign = "center"
      ctx.fillStyle = NAVY
      ctx.fillText(c.word.toUpperCase(), 99.95 + bw / 2, 865 + capHeight(ctx) / 2)
      ctx.textAlign = "left"
    })
    check(drawCss(ctx, { text: c.body, font: P(400, 30), color: INK, lineHeight: 45, top: 970, step: 45, x: 100, maxWidth: 540, lines: 4, minSize: 23 }), "body", warn)
    drawCss(ctx, { text: c.caption, font: P(700, 28), color: WHITE, lineHeight: 42, top: 982, x: 1121.5, align: "center", maxWidth: 400, lines: 1, minSize: 18 })
  },
  4: (ctx, c, warn) => {
    // The whole note is turned −3°: places are in the note's own straight frame (around 704, 750),
    // worked out from the CSS boxes.
    turned(ctx, 704, 750, -3, () => {
      drawCss(ctx, { text: `#${numberLabel(c.number)}`, font: P(700, 26), color: NAVY, lineHeight: 39, top: 398, x: 814, align: "center", maxWidth: 70, lines: 1, minSize: 18 })
      check(drawCss(ctx, { text: c.lead, font: O(58), color: NAVY, upper: true, lineHeight: 73, top: 482, x: 698, align: "center", maxWidth: 900, lines: 1, minSize: 36 }), "lead", warn)
      const [, word] = drawCssRow(
        ctx,
        [
          { text: c.big, font: O(250), color: BLUE, upper: true, lineHeight: 315, top: 540 },
          { text: c.word, font: O(104), color: NAVY, upper: true, lineHeight: 131, top: 666.1 },
        ],
        38.1,
        701,
        900,
      )
      // The green swoosh under the word: 376 wide for a 371-wide word, from 800 down to 814 and up to 796.
      const L = word.right - word.left + 5
      const sx = word.left - 0.5
      const sy = 800
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.bezierCurveTo(sx + L * 0.333, sy + 14.7, sx + L * 0.667, sy + 13.4, sx + L, sy - 4)
      ctx.strokeStyle = LIME
      ctx.lineWidth = 14
      ctx.lineCap = "round"
      ctx.stroke()
      check(drawCss(ctx, { text: c.body, font: P(400, 32), color: INK, lineHeight: 48, top: 897.9, step: 49.65, x: 700, align: "center", maxWidth: 765, lines: 3, minSize: 23, valign: "center" }), "body", warn)
    })
  },
}

/**
 * History: every place, font and size from the Figma CSS of PicklePlay_History_1–4 (percentages
 * × 1408). Story and card text is Inter; headlines and the big focus word are Playfair Display.
 * Text widths: wide enough for the sample's widest line, narrow enough that it breaks where Figma did.
 */
const HISTORY: Record<1 | 2 | 3 | 4, Draw<HistoryContent>> = {
  1: (ctx, c, warn) => {
    // Headline 28.35% / 34.79% / 41.23%, left 8.52%; its last line stays just above the divider (50.44%).
    check(drawCss(ctx, { text: markFocus(c.headline, c.focus, false), font: F(84), color: WHITE, accent: LIME, balance: true, lineHeight: 112, top: 399.2, step: 90.65, x: 120, maxWidth: 820, lines: 3, minSize: 52, valign: "bottom" }), "headline", warn)
    check(drawCss(ctx, { text: c.body, font: I(400, 30), color: "#EBF2FF", alpha: 0.88, lineHeight: 36, top: 749.6, step: 45, x: 120, maxWidth: 765, lines: 3, minSize: 22 }), "body", warn)
    drawCss(ctx, { text: c.sideTitle, font: I(700, 20), color: LIME, upper: true, lineHeight: 24, top: 940.5, x: 156, maxWidth: 720, lines: 1, minSize: 14 })
    check(drawCss(ctx, { text: c.sideBody, font: I(400, 27), color: WHITE, alpha: 0.95, lineHeight: 33, top: 980, step: 40, x: 156, maxWidth: 715, lines: 3, minSize: 20 }), "sideBody", warn)
  },
  2: (ctx, c, warn) => {
    // Big word 19.18%, centered (27.06% each side); shrinks between the paddle and the ball.
    drawCss(ctx, { text: c.focus, font: F(330), color: LIME, alpha: 0.95, lineHeight: 440, top: 270.1, x: 704, align: "center", maxWidth: 700, lines: 1, minSize: 90, valign: "center" })
    check(drawCss(ctx, { text: c.shortHeadline, font: F(64), color: WHITE, lineHeight: 85, top: 736, x: 704, align: "center", maxWidth: 1160, lines: 1, minSize: 40 }), "shortHeadline", warn)
    drawCss(ctx, { text: c.startTitle, font: I(700, 22), color: LIME, upper: true, lineHeight: 27, top: 911, x: 206, maxWidth: 440, lines: 1, minSize: 14 })
    check(drawCss(ctx, { text: c.body, font: I(400, 28), color: WHITE, alpha: 0.92, lineHeight: 34, top: 978, step: 42, x: 132.1, maxWidth: 510, lines: 5, minSize: 20 }), "body", warn)
    drawCss(ctx, { text: c.sideTitle, font: I(700, 22), color: LIME, upper: true, lineHeight: 27, top: 911, x: 830, maxWidth: 410, lines: 1, minSize: 14 })
    check(drawCss(ctx, { text: c.sideBody, font: I(400, 28), color: WHITE, alpha: 0.92, lineHeight: 34, top: 978, step: 42, x: 756, maxWidth: 516, lines: 4, maxLines: 5, minSize: 20 }), "sideBody", warn)
  },
  3: (ctx, c, warn) => {
    check(drawCss(ctx, { text: markFocus(c.headline, c.focus, true), font: F(78), color: WHITE, accent: LIME, balance: true, accentGap: 3, lineHeight: 104, top: 362, step: 90, x: 96, maxWidth: 660, lines: 3, minSize: 48, valign: "bottom" }), "headline", warn)
    drawCss(ctx, { text: c.storyTag, font: I(700, 24), color: LIME, upper: true, lineHeight: 29, top: 701, x: 164, maxWidth: 600, lines: 1, minSize: 15 })
    check(drawCss(ctx, { text: c.body, font: I(400, 29), color: WHITE, alpha: 0.92, lineHeight: 35, top: 746.9, step: 43.5, x: 164, maxWidth: 590, lines: 4, minSize: 21 }), "body", warn)
    drawCss(ctx, { text: c.sideTitle, font: I(700, 24), color: LIME, upper: true, lineHeight: 29, top: 961, x: 164, maxWidth: 600, lines: 1, minSize: 15 })
    check(drawCss(ctx, { text: c.sideBody, font: I(400, 29), color: WHITE, alpha: 0.92, lineHeight: 35, top: 1007, step: 43.5, x: 164, maxWidth: 590, lines: 4, minSize: 21 }), "sideBody", warn)
  },
  4: (ctx, c, warn) => {
    drawCss(ctx, { text: c.focus, font: F(200), color: WHITE, alpha: 0.95, lineHeight: 267, top: 270.1, x: 704.6, align: "center", maxWidth: 760, lines: 1, minSize: 70, valign: "center" })
    check(drawCss(ctx, { text: markFocus(c.headline, c.focus, true), font: F(80), color: NAVY, accent: BLUE, balance: true, lineHeight: 107, top: 610, step: 92, x: 704, align: "center", maxWidth: 790, lines: 2, minSize: 50, valign: "bottom" }), "headline", warn)
    check(drawCss(ctx, { text: c.body, font: I(400, 30), color: INK, lineHeight: 36, top: 860, step: 45.1, x: 704, align: "center", maxWidth: 975, lines: 3, minSize: 22 }), "body", warn)
    // The card's label and lines are centered a little left of the middle in Figma (702.5 and 698).
    drawCss(ctx, { text: c.sideTitle, font: I(700, 22), color: BLUE, upper: true, lineHeight: 27, top: 1064, x: 702.5, align: "center", maxWidth: 900, lines: 1, minSize: 14 })
    check(drawCss(ctx, { text: c.sideBody, font: I(400, 27), color: NAVY, lineHeight: 33, top: 1107, step: 39.3, x: 698, align: "center", maxWidth: 960, lines: 2, minSize: 20 }), "sideBody", warn)
  },
}

/**
 * Text drawn after every layer: History 3's badge sits on its pill, which lies above the arch
 * photo, its border and the paddle (68.18%–85.94% wide, centered at 1085).
 */
const OVER: Partial<Record<AdTemplateId, Draw<AdContent>>> = {
  // Court Owners Day 5: the three features on their strip (the strip lies above the paddle and the headline).
  "courtowner-5": (ctx, c, warn) => {
    if (c.kind !== "courtowner") return
    ;[c.feature1, c.feature2, c.feature3].forEach((t, i) =>
      check(drawCss(ctx, { text: t, font: P(700, 32), color: WHITE, lineHeight: 48, top: 1164, x: [268.7, 706, 1142.8][i], align: "center", maxWidth: 390, lines: 1, minSize: 20 }), `feature${i + 1}`, warn),
    )
  },
  "history-3": (ctx, c) => {
    if (c.kind !== "history") return
    drawCss(ctx, { text: c.badge, font: F(30), color: WHITE, lineHeight: 40, top: 1098.9, x: 1085, align: "center", maxWidth: 220, lines: 1, minSize: 18, valign: "center" })
  },
  // Coming Soon 2: the stamp's text, turned 12° like the stamp (which lies above the ticket's text).
  "comingsoon-2": (ctx, c, warn) => {
    if (c.kind !== "comingsoon") return
    if (drawTurnedText(ctx, { text: c.tag, font: P(700, 34), color: NAVY, cx: 1108.2, cy: 306.3, angle: 12, baselineDy: 11.92, maxWidth: 236, minSize: 16 })) warn("tag")
  },
  // Now Open 4: the tab over the logo card, turned 3° like the card.
  "nowopen-4": (ctx, c, warn) => {
    if (c.kind !== "nowopen") return
    if (drawTurnedText(ctx, { text: c.logoTab, font: P(700, 22), color: WHITE, cx: 1107.3, cy: 815.3, angle: 3, baselineDy: 11.2, maxWidth: 190, minSize: 12 })) warn("logoTab")
  },
}

/** "What were the…?" with the last "?" in the accent color. */
const accentQuestionMark = (q: string) => q.replace(/\?\s*$/, "{?}")

/**
 * Trivia: from the Figma CSS of PicklePlay_Trivia_1–4. Questions and answers are Outfit Bold, the
 * rest Poppins. Highlight boxes are centered on the capital letters' middle, like Figma's blocks.
 */
const TRIVIA: Record<1 | 2 | 3 | 4, Draw<TriviaContent>> = {
  1: (ctx, c, warn) => {
    // Lines 26.69% / 34.93% / 44.16%: the line after the highlighted one sits 14 px lower.
    check(
      drawCss(ctx, {
        text: accentQuestionMark(c.question),
        font: O(108),
        color: WHITE,
        accent: LIME,
        upper: true,
        balance: true,
        box: { fill: LIME, height: 115.6, padX: 29.7, radius: 16, rotate: -2, textColor: NAVY, shadow: { dx: 0.3, dy: 8, color: "rgba(9,27,92,0.5)" } },
        lineHeight: 136,
        top: 375.8,
        step: 116,
        afterBoxLine: 14,
        // Figma centers line 1 at 698 and the others at 704.
        x: 700,
        align: "center",
        maxWidth: 1000,
        lines: 3,
        minSize: 60,
        valign: "center",
      }),
      "question",
      warn,
    )
    const a = drawCss(ctx, { text: c.answer, font: O(64), color: NAVY, upper: true, lineHeight: 81, top: 903.8, x: 352, maxWidth: 700, lines: 1, minSize: 34 })
    roundRect(ctx, 352, 979.8, Math.max(60, a.right - a.left + 2.6), 10, 5)
    ctx.fillStyle = LIME
    ctx.fill()
    check(drawCss(ctx, { text: c.explanation, font: P(400, 26), color: INK, lineHeight: 39, top: 1013.8, step: 39.9, x: 352, maxWidth: 705, lines: 2, maxLines: 3, minSize: 19 }), "explanation", warn)
  },
  2: (ctx, c, warn) => {
    check(
      drawCss(ctx, {
        text: c.question,
        font: O(82),
        color: WHITE,
        upper: true,
        balance: true,
        box: { fill: LIME, height: 91.8, padX: 28.5, radius: 11, rotate: -1.5, turnText: true, textColor: NAVY },
        lineHeight: 103,
        top: 388,
        step: 103.3,
        x: 704,
        align: "center",
        maxWidth: 1000,
        lines: 3,
        minSize: 52,
        valign: "center",
      }),
      "question",
      warn,
    )
    // The four choices (9.09% / 50.85% from the sides, 53.12% and 61.93% from the top); the right one is green.
    const cards = [
      { x: 128, y: 748 },
      { x: 716, y: 748 },
      { x: 128, y: 872 },
      { x: 716, y: 872 },
    ]
    cards.forEach((card, i) => {
      const right = i === c.correct
      const cy = card.y + 50
      roundRect(ctx, card.x, card.y, 564, 100, 50)
      ctx.fillStyle = right ? LIME : "rgba(6,23,107,0.55)"
      ctx.fill()
      if (!right) {
        ctx.lineWidth = 1.5
        ctx.strokeStyle = "rgba(255,255,255,0.22)"
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(card.x + 50, cy, 34, 0, Math.PI * 2)
      ctx.fillStyle = right ? NAVY : "rgba(255,255,255,0.12)"
      ctx.fill()
      drawCss(ctx, { text: "ABCD"[i], font: P(700, 30), color: right ? LIME : WHITE, lineHeight: 45, top: card.y + 32.1, x: card.x + 50, align: "center", maxWidth: 60, lines: 1, minSize: 30 })
      if (right) {
        ctx.beginPath()
        ctx.arc(card.x + 514, cy, 28, 0, Math.PI * 2)
        ctx.fillStyle = NAVY
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(card.x + 502, cy)
        ctx.lineTo(card.x + 510, cy + 8)
        ctx.lineTo(card.x + 524, cy - 7)
        ctx.strokeStyle = LIME
        ctx.lineWidth = 5
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.stroke()
      }
      const d = drawCss(ctx, { text: c.choices[i] ?? "", font: P(right ? 700 : 400, 36), color: right ? NAVY : WHITE, lineHeight: 54, top: card.y + 27.9, x: card.x + 104, maxWidth: right ? 370 : 430, lines: 1, minSize: 22 })
      if (d.overflow) warn("choices")
    })
    check(drawCss(ctx, { text: c.explanation, font: P(400, 30), color: WHITE, alpha: 0.92, lineHeight: 45, top: 1022.1, step: 44.9, x: 700.5, align: "center", maxWidth: 1000, lines: 2, minSize: 21 }), "explanation", warn)
  },
  3: (ctx, c, warn) => {
    check(
      drawCss(ctx, {
        text: c.longQuestion,
        font: O(72),
        color: NAVY,
        balance: true,
        box: { fill: LIME, height: 80.5, padX: 19.4, radius: 10, rotate: -1.5, turnText: true, textColor: NAVY },
        lineHeight: 91,
        top: 508,
        step: 93.6,
        x: 176,
        maxWidth: 1060,
        lines: 3,
        minSize: 42,
        valign: "center",
      }),
      "longQuestion",
      warn,
    )
    drawCss(ctx, { text: c.answer, font: O(88), color: WHITE, upper: true, lineHeight: 111, top: 1024, x: 160, maxWidth: 345, lines: 1, minSize: 36 })
    check(drawCss(ctx, { text: c.explanation, font: P(400, 30), color: WHITE, alpha: 0.92, lineHeight: 45, top: 998, step: 45, x: 560, maxWidth: 690, lines: 3, minSize: 21, valign: "center" }), "explanation", warn)
  },
  4: (ctx, c, warn) => {
    drawCss(ctx, { text: `#${numberLabel(c.number)}`, font: P(700, 30), color: LIME, lineHeight: 45, top: 308.1, x: 402, maxWidth: 130, lines: 1, minSize: 20 })
    check(
      drawCss(ctx, {
        text: c.shortQuestion,
        font: O(130),
        color: WHITE,
        upper: true,
        balance: true,
        box: { fill: LIME, height: 145.6, padX: 25.9, radius: 20, rotate: -1.5, turnText: true, textColor: NAVY },
        lineHeight: 164,
        top: 370,
        step: 143,
        x: 110,
        maxWidth: 800,
        lines: 3,
        minSize: 64,
        valign: "center",
      }),
      "shortQuestion",
      warn,
    )
    // The answer on the white sticker, turned −6° like it (its text box: 270 × 93 around 286.9, 960).
    turned(ctx, 286.9, 960, -6, () => drawCss(ctx, { text: c.answer, font: O(74), color: NAVY, upper: true, lineHeight: 93, top: 913.4, x: 151.9, maxWidth: 300, lines: 1, minSize: 34 }))
    check(drawCss(ctx, { text: c.explanation, font: P(400, 30), color: WHITE, alpha: 0.92, lineHeight: 45, top: 880, step: 45, x: 560, maxWidth: 530, lines: 3, minSize: 21, valign: "center" }), "explanation", warn)
  },
}

interface WordBlock {
  text: string
  font: Font
  textColor: string
  fill: string
  /** The block's left edge, middle or right edge (before it turns), by `anchor`. */
  x: number
  anchor: "left" | "center" | "right"
  /** The block's middle, top to bottom. */
  cy: number
  /** Space each side of the word, and the block's height, at full size. */
  padX: number
  height: number
  angle: number
  maxWidth: number
  minSize: number
  /** Figma's word sits a little left of the block's middle (px at full size). */
  textDx?: number
  /** Figma's word sits a little above (−) or below (+) the middle of its capitals (px at full size). */
  textDy?: number
  /** CSS box-shadow without blur under the block (px at full size). */
  shadow?: { dy: number; color: string }
}

/** The highlight block (its width follows the word), turned like Figma's, the word on it in capitals. */
function drawWordBlock(ctx: CanvasRenderingContext2D, b: WordBlock): boolean {
  const spec: TextSpec = { font: b.font, color: b.textColor, upper: true }
  const f = fit(ctx, b.text, spec, b.maxWidth - 2 * b.padX, 1, b.minSize)
  const scale = f.size / b.font.size
  const bw = (f.lines[0]?.w ?? 0) + 2 * b.padX * scale
  const bh = b.height * scale
  const left = b.anchor === "left" ? b.x : b.anchor === "center" ? b.x - bw / 2 : b.x - bw
  const cx = left + bw / 2
  turned(ctx, cx, b.cy, b.angle, () => {
    if (b.shadow) {
      roundRect(ctx, left, b.cy - bh / 2 + b.shadow.dy * scale, bw, bh, 18 * scale)
      ctx.fillStyle = b.shadow.color
      ctx.fill()
    }
    roundRect(ctx, left, b.cy - bh / 2, bw, bh, 18 * scale)
    ctx.fillStyle = b.fill
    ctx.fill()
    ctx.font = css({ ...b.font, size: f.size })
    ctx.textAlign = "center"
    ctx.fillStyle = b.textColor
    ctx.fillText(b.text.toUpperCase(), cx + (b.textDx ?? 0) * scale, b.cy + capHeight(ctx) / 2 + (b.textDy ?? 0) * scale)
    ctx.textAlign = "left"
  })
  return f.overflow
}

/** The block's width for a word (to place things beside it). */
function wordBlockWidth(ctx: CanvasRenderingContext2D, b: Pick<WordBlock, "text" | "font" | "padX" | "maxWidth" | "minSize">) {
  const f = fit(ctx, b.text, { font: b.font, color: NAVY, upper: true }, b.maxWidth - 2 * b.padX, 1, b.minSize)
  return (f.lines[0]?.w ?? 0) + (2 * b.padX * f.size) / b.font.size
}

/** Day 2: a benefit centered with its check mark just before it (the mark moves with the text). */
function drawCheckRow(ctx: CanvasRenderingContext2D, text: string, top: number, cx: number, maxWidth: number) {
  const spec: TextSpec = { font: P(400, 36), color: WHITE }
  const f = fit(ctx, text, spec, maxWidth, 1, 24)
  const tw = f.lines[0]?.w ?? 0
  // Check circle 48 wide, then 19 px, then the text (Figma: circle 403.5–451.5, text from 470.6).
  const start = cx - (67.1 + tw) / 2
  const icx = start + 24
  const icy = top + 23.5
  ctx.beginPath()
  ctx.arc(icx, icy, 24, 0, Math.PI * 2)
  ctx.fillStyle = LIME
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(icx - 11, icy)
  ctx.lineTo(icx - 3, icy + 8)
  ctx.lineTo(icx + 11, icy - 7)
  ctx.strokeStyle = NAVY
  ctx.lineWidth = 5
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.stroke()
  return drawCss(ctx, { text, font: spec.font, color: WHITE, lineHeight: 54, top, x: start + 67.1, maxWidth, lines: 1, minSize: 24 })
}

/**
 * Court Owners (Day 1–7): from the Figma CSS of Ads_Court_Owner_1–7. Headline and highlight are
 * Outfit Bold in capitals; the benefits and features Poppins. The tag, check marks (except
 * Day 2's) and "Visit Pickleplay.ph" are part of the design.
 */
const COURTOWNER: Record<number, Draw<CourtOwnerContent>> = {
  1: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.headline, font: O(130), color: WHITE, upper: true, lineHeight: 164, top: 468, x: 146, maxWidth: 700, lines: 1, minSize: 60 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(130), textColor: NAVY, fill: LIME, x: 148.45, anchor: "left", cy: 715.8, textDx: -2.75, padX: 36.8, height: 152.1, angle: -2, maxWidth: 720, minSize: 60 })) warn("highlight")
    ;[c.detail1, c.detail2, c.detail3].forEach((t, i) =>
      check(drawCss(ctx, { text: t, font: P(400, 36), color: WHITE, lineHeight: 54, top: [835.6, 909.7, 983.6][i], x: 213, maxWidth: 640, lines: 1, minSize: 24 }), `detail${i + 1}`, warn),
    )
  },
  2: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.headline, font: O(150), color: WHITE, upper: true, lineHeight: 189, top: 370, x: 699.3, align: "center", maxWidth: 1000, lines: 1, minSize: 70 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(170), textColor: NAVY, fill: LIME, x: 704, anchor: "center", cy: 664.15, textDx: -5.5, padX: 39.45, height: 196.2, angle: -2, maxWidth: 840, minSize: 80 })) warn("highlight")
    ;[c.detail1, c.detail2, c.detail3].forEach((t, i) => check(drawCheckRow(ctx, t, [826.5, 900.6, 974.5][i], 701, 760), `detail${i + 1}`, warn))
  },
  3: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.headline, font: O(118), color: WHITE, upper: true, lineHeight: 149, top: 442, x: 1331, align: "right", maxWidth: 640, lines: 1, minSize: 60 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(150), textColor: NAVY, fill: LIME, x: 1338.15, anchor: "right", cy: 688.05, textDx: -4.5, padX: 38.65, height: 176, angle: 2, maxWidth: 730, minSize: 70 })) warn("highlight")
    ;[c.detail1, c.detail2, c.detail3].forEach((t, i) =>
      check(drawCss(ctx, { text: t, font: P(400, 32), color: WHITE, lineHeight: 48, top: [842.5, 908.4, 974.5][i], x: 1266, align: "right", maxWidth: 620, lines: 1, minSize: 22 }), `detail${i + 1}`, warn),
    )
  },
  4: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.headline, font: O(112), color: NAVY, upper: true, lineHeight: 141, top: 626, x: 120, maxWidth: 570, lines: 1, minSize: 56 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(112), textColor: WHITE, fill: BLUE, x: 120, anchor: "left", cy: 834.05, textDx: -3.7, padX: 37.6, height: 132.1, angle: -2, maxWidth: 580, minSize: 56 })) warn("highlight")
    ;[c.detail1, c.detail2, c.detail3].forEach((t, i) =>
      check(drawCss(ctx, { text: t, font: P(400, 34), color: INK, lineHeight: 51, top: [950.5, 1014.5, 1078.5][i], x: 187, maxWidth: 600, lines: 1, minSize: 22 }), `detail${i + 1}`, warn),
    )
  },
  5: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.headline, font: O(180), color: WHITE, upper: true, balance: true, lineHeight: 227, top: 350, step: 170, x: 110, maxWidth: 740, lines: 2, minSize: 90, valign: "bottom" }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(180), textColor: NAVY, fill: LIME, x: 109.95, anchor: "left", cy: 839.95, textDx: -6.05, padX: 39.95, height: 200.1, angle: -3, maxWidth: 860, minSize: 80 })) warn("highlight")
    // The features sit on the strip at the bottom, which lies above the paddle: drawn last (see OVER).
  },
  6: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.headline, font: O(110), color: WHITE, upper: true, lineHeight: 139, top: 758.1, x: 700.6, align: "center", maxWidth: 940, lines: 1, minSize: 56 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(120), textColor: NAVY, fill: LIME, x: 703.85, anchor: "center", cy: 966, textDx: -3.4, padX: 37.35, height: 140.1, angle: -2, maxWidth: 1000, minSize: 60 })) warn("highlight")
    const line = [c.feature1, c.feature2, c.feature3].map((t) => t.trim()).filter(Boolean).join(" • ")
    check(drawCss(ctx, { text: line, font: P(400, 32), color: WHITE, lineHeight: 48, top: 1080, x: 698.5, align: "center", maxWidth: 1060, lines: 1, minSize: 20 }), "feature1", warn)
  },
  7: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.headline, font: O(120), color: NAVY, upper: true, lineHeight: 151, top: 410, x: 96, maxWidth: 700, lines: 1, minSize: 60 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(140), textColor: LIME, fill: NAVY, x: 96, anchor: "left", cy: 651.1, textDx: -4.65, padX: 38.5, height: 162.2, angle: -2, maxWidth: 720, minSize: 60 })) warn("highlight")
    ;[c.detail1, c.detail2, c.detail3].forEach((t, i) =>
      check(drawCss(ctx, { text: t, font: P(400, 33), color: NAVY, lineHeight: 50, top: [803.5, 869.4, 935.5][i], x: 163, maxWidth: 650, lines: 1, minSize: 22 }), `detail${i + 1}`, warn),
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Court Coming Soon and Court Now Open
// ---------------------------------------------------------------------------------------------

const O8 = (size: number): Font => ({ family: OUTFIT, weight: 800, size })
const SOFT: TextShadow = { dx: 0, dy: 4, blur: 4, color: "rgba(0, 0, 0, 0.25)" }

interface Pill {
  text: string
  font: Font
  textColor: string
  fill: string
  /** The pill's middle (anchor "center") or left edge (anchor "left"), and its vertical middle. */
  x: number
  anchor: "center" | "left"
  cy: number
  height: number
  padX: number
  /** The text's baseline at full size (Figma's). */
  baseline: number
  maxWidth: number
  minSize: number
}

/** A pill whose width follows its text (Figma: the tag's padding stays the same). */
function drawPill(ctx: CanvasRenderingContext2D, p: Pill) {
  const spec: TextSpec = { font: p.font, color: p.textColor, upper: true }
  const f = fit(ctx, p.text, spec, p.maxWidth - 2 * p.padX, 1, p.minSize)
  const scale = f.size / p.font.size
  const w = (f.lines[0]?.w ?? 0) + 2 * p.padX
  const left = p.anchor === "center" ? p.x - w / 2 : p.x
  roundRect(ctx, left, p.cy - p.height / 2, w, p.height, p.height / 2)
  ctx.fillStyle = p.fill
  ctx.fill()
  setFont(ctx, spec, f.size)
  ctx.fillStyle = p.textColor
  ctx.textAlign = "left"
  ctx.fillText(p.text.toUpperCase(), left + p.padX, p.cy + (p.baseline - p.cy) * scale)
  return f.overflow
}

/** Text centered on (cx, cy) and turned by `angle` (a stamp, a tab), shrunk to fit `maxWidth`. */
function drawTurnedText(ctx: CanvasRenderingContext2D, t: { text: string; font: Font; color: string; cx: number; cy: number; angle: number; baselineDy: number; maxWidth: number; minSize: number }) {
  const spec: TextSpec = { font: t.font, color: t.color, upper: true }
  const f = fit(ctx, t.text, spec, t.maxWidth, 1, t.minSize)
  turned(ctx, t.cx, t.cy, t.angle, () => {
    setFont(ctx, spec, f.size)
    ctx.fillStyle = t.color
    ctx.textAlign = "center"
    ctx.fillText(t.text.toUpperCase(), t.cx, t.cy + (t.baselineDy * f.size) / t.font.size)
    ctx.textAlign = "left"
  })
  return f.overflow
}

/** A row with the lime check circle before it (Now Open 2: centered, so the mark moves with the text). */
function drawCheckLine(ctx: CanvasRenderingContext2D, parts: { text: string; font: Font; gap?: number }[], top: number, cx: number, maxWidth: number) {
  const items: RowItem[] = parts.filter((p) => p.text.trim()).map((p) => ({ text: p.text, font: p.font, color: WHITE, top, lineHeight: 54 }))
  // Measure at full size, shrinking like drawCssRow; the circle (48) and its gap (19.1) come first.
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px"
  const gaps = parts.filter((p) => p.text.trim()).map((p, i) => (i ? p.gap ?? 0 : 0))
  const widthAt = (scale: number) =>
    items.reduce((n, it, i) => {
      ctx.font = css({ ...it.font, size: it.font.size * scale })
      return n + ctx.measureText(it.text).width + gaps[i] * scale
    }, 0)
  let scale = 1
  while (67.1 + widthAt(scale) > maxWidth && scale > 0.5) scale *= 0.97
  const start = cx - (67.1 + widthAt(scale)) / 2
  const icx = start + 24
  const icy = top + 23.6
  ctx.beginPath()
  ctx.arc(icx, icy, 24, 0, Math.PI * 2)
  ctx.fillStyle = LIME
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(icx - 11, icy)
  ctx.lineTo(icx - 3, icy + 8)
  ctx.lineTo(icx + 11, icy - 7)
  ctx.strokeStyle = NAVY
  ctx.lineWidth = 5
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.stroke()
  let at = start + 67.1
  ctx.textAlign = "left"
  items.forEach((it, i) => {
    at += gaps[i] * scale
    ctx.font = css({ ...it.font, size: it.font.size * scale })
    ctx.fillStyle = WHITE
    ctx.fillText(it.text, at, cssBaseline(ctx, it.font, 54, top))
    ctx.font = css({ ...it.font, size: it.font.size * scale })
    at += ctx.measureText(it.text).width
  })
  return scale < 0.52
}

/** "Open daily · 6:00 AM – 10:00 PM" → ["Open daily · ", "6:00 AM – 10:00 PM"] (the time in bold on Now Open 3 and 4). */
export function splitHours(hours: string): [string, string] {
  const at = hours.indexOf("·")
  return at < 0 ? [hours, ""] : [hours.slice(0, at + 1) + " ", hours.slice(at + 1).trim()]
}

/** "Court Name · Barangay, City" for one line. */
const courtLine = (c: CourtPlace) => [c.courtName.trim(), courtLocation(c)].filter(Boolean).join(" · ")

/**
 * Court Coming Soon 1–3: from the Figma files (template 1's text is outlined: its sizes and baselines
 * were measured from the glyphs) and the CSS of templates 2 and 3. Headlines are Outfit Bold, the rest
 * Poppins; the court's name, barangay and city are drawn as typed.
 */
const COMINGSOON: Record<number, Draw<ComingSoonContent>> = {
  1: (ctx, c, warn) => {
    if (drawPill(ctx, { text: c.tag, font: P(700, 32), textColor: NAVY, fill: LIME, x: 704, anchor: "center", cy: 298, height: 72, padX: 40.2, baseline: 312.1, maxWidth: 700, minSize: 20 })) warn("tag")
    check(drawBlock(ctx, { text: c.headline, spec: { font: O(92), color: WHITE, upper: true }, x: 700.2, y: 812, lineHeight: 116, maxWidth: 1120, lines: 1, minSize: 50, align: "center" }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(124), textColor: NAVY, fill: LIME, x: 704, anchor: "center", cy: 917, padX: 42.3, height: 150, angle: -2, maxWidth: 1240, minSize: 60 })) warn("highlight")
    check(drawBlock(ctx, { text: courtLine(c), spec: { font: P(700, 36), color: WHITE }, x: 707.8, y: 1067.8, lineHeight: 54, maxWidth: 1040, lines: 1, minSize: 22, align: "center" }), "courtName", warn)
    check(drawBlock(ctx, { text: c.detail, spec: { font: P(400, 36), color: WHITE }, x: 699.2, y: 1121.4, lineHeight: 54, maxWidth: 1080, lines: 1, minSize: 22, align: "center" }), "detail", warn)
    check(drawBlock(ctx, { text: c.cta, spec: { font: O(46), color: LIME }, x: 698.7, y: 1192, lineHeight: 58, maxWidth: 1080, lines: 1, minSize: 26, align: "center" }), "cta", warn)
  },
  2: (ctx, c, warn) => {
    // The kicker between its two lines (455–573 and 835–953): at most 250 wide.
    check(drawCss(ctx, { text: c.kicker, font: P(700, 24), color: BLUE, upper: true, lineHeight: 36, top: 314, x: 702.5, align: "center", maxWidth: 250, lines: 1, minSize: 14 }), "kicker", warn)
    check(drawCss(ctx, { text: c.headline, font: O(66), color: NAVY, upper: true, lineHeight: 83, top: 644, x: 702, align: "center", maxWidth: 840, lines: 1, minSize: 36 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(100), textColor: NAVY, fill: LIME, x: 704, anchor: "center", cy: 799, textDx: -7, padX: 40.05, height: 121.9, angle: -2, maxWidth: 900, minSize: 50 })) warn("highlight")
    const [name] = drawCssRow(
      ctx,
      [
        { text: c.courtName, font: P(700, 36), color: NAVY, top: 976, lineHeight: 54 },
        { text: courtLocation(c) ? `· ${courtLocation(c)}` : "", font: P(400, 36), color: NAVY, top: 976, lineHeight: 54 },
      ],
      13.1,
      701.5,
      880,
    )
    if (name && name.scale < 0.62) warn("courtName")
    check(drawCss(ctx, { text: c.detail, font: P(400, 30), color: "#3A4A75", lineHeight: 45, top: 1036, x: 700, align: "center", maxWidth: 860, lines: 1, minSize: 20 }), "detail", warn)
    check(drawCss(ctx, { text: c.cta, font: O(44), color: BLUE, lineHeight: 55, top: 1106, x: 699.6, align: "center", maxWidth: 860, lines: 1, minSize: 26 }), "cta", warn)
    // The stamp's text is drawn over the stamp (see OVER).
  },
  3: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.chip, font: P(700, 22), color: WHITE, upper: true, lineHeight: 33, top: 319.05, x: 150, maxWidth: 170, lines: 1, minSize: 14 }), "chip", warn)
    if (drawPill(ctx, { text: c.tag, font: P(700, 30), textColor: NAVY, fill: LIME, x: 732, anchor: "left", cy: 335, height: 70, padX: 36.5, baseline: 348.8, maxWidth: 560, minSize: 18 })) warn("tag")
    check(drawCss(ctx, { text: c.headline, font: O(76), color: WHITE, upper: true, lineHeight: 96, top: 424, x: 732, maxWidth: 600, lines: 1, minSize: 40 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(66), textColor: NAVY, fill: LIME, x: 732, anchor: "left", cy: 584, textDx: -4, padX: 28, height: 88, angle: -2, maxWidth: 610, minSize: 34 })) warn("highlight")
    check(drawCss(ctx, { text: c.courtName, font: P(700, 38), color: WHITE, lineHeight: 57, top: 782, x: 732, maxWidth: 600, lines: 1, minSize: 24 }), "courtName", warn)
    check(drawCss(ctx, { text: courtLocation(c), font: P(400, 32), color: WHITE, alpha: 0.85, lineHeight: 48, top: 836.1, x: 732, maxWidth: 600, lines: 1, minSize: 20 }), "city", warn)
    check(drawCss(ctx, { text: c.detail, font: P(400, 30), color: WHITE, alpha: 0.9, lineHeight: 45, top: 910, step: 41.96, x: 732, maxWidth: 410, lines: 2, minSize: 20 }), "detail", warn)
    check(drawCss(ctx, { text: c.cta, font: O(46), color: LIME, lineHeight: 58, top: 1030, step: 54.07, x: 732, maxWidth: 410, lines: 2, minSize: 26 }), "cta", warn)
  },
}

/**
 * Court Now Open 1–4: from the CSS of templates 1–3 (template 4 is template 3's layout with the logo
 * on a card; its rows were measured from the glyphs). "Book your court now on PICKLEPLAY.PH", "Book
 * at / Visit Pickleplay.ph" and the footer are part of the design.
 */
const NOWOPEN: Record<number, Draw<NowOpenContent>> = {
  1: (ctx, c, warn) => {
    check(drawCss(ctx, { text: c.tag, font: P(700, 36), color: WHITE, upper: true, lineHeight: 54, top: 656, x: 702.4, align: "center", maxWidth: 470, lines: 1, minSize: 20 }), "tag", warn)
    // "NOW" in white, then the last word in the green block, the pair centered on 702.8 (Figma: 236–1169.5).
    const words = c.headline.trim().split(/\s+/).filter(Boolean)
    const last = words.pop() ?? ""
    const first = words.join(" ")
    const block = { text: last, font: O(150), padX: 30.45, maxWidth: 940, minSize: 60 }
    const blockW = last ? wordBlockWidth(ctx, block) : 0
    ctx.font = css(O(150))
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px"
    let firstW = first ? ctx.measureText(first.toUpperCase()).width : 0
    const gap = first && last ? 31.6 : 0
    let size = 150
    while (firstW + gap + blockW > 1150 && size > 60) {
      size *= 0.97
      ctx.font = css(O(size))
      firstW = ctx.measureText(first.toUpperCase()).width
    }
    const start = 702.8 - (firstW + gap + blockW) / 2
    if (first) {
      ctx.font = css(O(size))
      ctx.fillStyle = WHITE
      ctx.textAlign = "left"
      ctx.fillText(first.toUpperCase(), start, cssBaseline(ctx, O(150), 189, 730))
    }
    if (last && drawWordBlock(ctx, { ...block, textColor: NAVY, fill: LIME, x: start + firstW + gap, anchor: "left", cy: 843, textDx: -1.5, height: 150, angle: -2 })) warn("headline")
    const [name] = drawCssRow(
      ctx,
      [
        { text: c.courtName, font: P(700, 34), color: WHITE, top: 1032.1, lineHeight: 51 },
        { text: courtLocation(c) ? `· ${courtLocation(c)}` : "", font: P(400, 34), color: WHITE, top: 1032.1, lineHeight: 51 },
      ],
      12.1,
      701.5,
      920,
    )
    if (name && name.scale < 0.62) warn("courtName")
    check(drawCss(ctx, { text: c.hours, font: P(400, 30), color: WHITE, alpha: 0.85, lineHeight: 45, top: 1084, x: 699.5, align: "center", maxWidth: 920, lines: 1, minSize: 20 }), "hours", warn)
    check(drawCss(ctx, { text: c.cta, font: O(40), color: LIME, lineHeight: 50, top: 1170, x: 699, align: "center", maxWidth: 1080, lines: 1, minSize: 24 }), "cta", warn)
  },
  2: (ctx, c, warn) => {
    if (drawPill(ctx, { text: c.tag, font: P(700, 30), textColor: NAVY, fill: LIME, x: 704, anchor: "center", cy: 461, height: 66, padX: 37, baseline: 474.8, maxWidth: 560, minSize: 18 })) warn("tag")
    check(drawCss(ctx, { text: c.headline, font: O(128), color: WHITE, upper: true, lineHeight: 161, top: 508, x: 699.5, align: "center", maxWidth: 1100, lines: 1, minSize: 60 }), "headline", warn)
    if (drawWordBlock(ctx, { text: c.highlight, font: O(118), textColor: NAVY, fill: LIME, x: 704, anchor: "center", cy: 744, textDx: -6, padX: 37.5, height: 144, angle: -2, maxWidth: 1130, minSize: 56 })) warn("highlight")
    if (drawCheckLine(ctx, [{ text: c.courtName, font: P(700, 36) }, { text: courtLocation(c) ? `· ${courtLocation(c)}` : "", font: P(400, 36), gap: 10.9 }], 876.5, 701.5, 900)) warn("courtName")
    if (drawCheckLine(ctx, [{ text: c.hours, font: P(400, 36) }], 948.6, 698.5, 900)) warn("hours")
    if (drawCheckLine(ctx, [{ text: c.perk, font: P(400, 36) }], 1020.5, 701, 900)) warn("perk")
  },
  3: (ctx, c, warn) => nowOpenSide(ctx, c, warn, { hoursTop: 872.7, perkTop: 962.7 }),
  4: (ctx, c, warn) => nowOpenSide(ctx, c, warn, { hoursTop: 887.5, perkTop: 984.2 }),
}

/** Now Open 3 and 4 (Figma "Content-Ad" auto layout from 149, 324): tag, headline, big word, three rows. */
function nowOpenSide(ctx: CanvasRenderingContext2D, c: NowOpenContent, warn: (f: string) => void, rows: { hoursTop: number; perkTop: number }) {
  if (drawPill(ctx, { text: c.audience, font: P(800, 30), textColor: NAVY, fill: LIME, x: 149, anchor: "left", cy: 362.5, height: 77, padX: 34, baseline: 373, maxWidth: 720, minSize: 18 })) warn("audience")
  check(drawCss(ctx, { text: c.headlineIn, font: O8(132), color: WHITE, upper: true, lineHeight: 132, top: 431, x: 149, maxWidth: 1100, lines: 1, minSize: 60 }), "headlineIn", warn)
  if (drawWordBlock(ctx, { text: c.spotlight, font: O8(132), textColor: NAVY, fill: LIME, x: 151.4, anchor: "left", cy: 663.85, padX: 28, height: 152, angle: -2, maxWidth: 1060, minSize: 56, shadow: { dy: 9, color: "rgba(9, 27, 92, 0.5)" } })) warn("spotlight")
  // The rows end before the logo (from x 870).
  check(drawCss(ctx, { text: c.courtName, font: P(700, 36), color: WHITE, shadow: SOFT, lineHeight: 54, top: 782.7, x: 215, maxWidth: 655, lines: 1, minSize: 22 }), "courtName", warn)
  check(drawCss(ctx, { text: courtLocation(c), font: P(500, 25), color: WHITE, lineHeight: 38, top: 828, x: 218, maxWidth: 650, lines: 1, minSize: 16 }), "city", warn)
  const [days, time] = splitHours(c.hours)
  const [row] = drawCssRow(
    ctx,
    [
      { text: days, font: P(500, 36), color: WHITE, top: rows.hoursTop, lineHeight: 54, shadow: SOFT },
      { text: time, font: P(700, 36), color: WHITE, top: rows.hoursTop, lineHeight: 54, shadow: SOFT },
    ],
    0,
    215,
    655,
    "left",
  )
  if (row && row.scale < 0.62) warn("hours")
  check(drawCss(ctx, { text: c.perk, font: P(500, 36), color: WHITE, shadow: SOFT, lineHeight: 54, top: rows.perkTop, x: 215, maxWidth: 655, lines: 1, minSize: 22 }), "perk", warn)
}

/** The court's logo (or the template's sample logo), fitted inside its box, at the user's size and offset. */
function drawLogo(ctx: CanvasRenderingContext2D, step: Extract<AdStep, { type: "logo" }>, img: CanvasImageSource | null, adjust: { scale: number; dx: number; dy: number }) {
  if (!img) return
  const size = imageSize(img)
  const fitScale = Math.min(step.w / size.width, step.h / size.height) * adjust.scale
  const dw = size.width * fitScale
  const dh = size.height * fitScale
  ctx.save()
  ctx.translate(step.cx, step.cy)
  ctx.rotate((step.angle * Math.PI) / 180)
  if (step.shadow) setShadow(ctx, { dx: 0, dy: step.shadow.dy, blur: step.shadow.blur, color: step.shadow.color })
  ctx.drawImage(img, -dw / 2 + adjust.dx * step.w, -dh / 2 + adjust.dy * step.h, dw, dh)
  ctx.restore()
}

/** The court photo, or the user's photo covering the photo's box, in its shape and at its opacity. */
function drawPhoto(ctx: CanvasRenderingContext2D, step: Extract<AdStep, { type: "photo" }>, image: CanvasImageSource | null, own: CanvasImageSource | null) {
  const [x, y, w, h] = step.box
  ctx.save()
  ctx.clip(new Path2D(step.d))
  ctx.globalAlpha = step.opacity
  const img = own ?? image
  if (step.turn && img) {
    // A tilted frame: the photo turns with it and covers it.
    const t = step.turn
    const size = imageSize(img)
    const scale = Math.max(t.w / size.width, t.h / size.height)
    ctx.translate(t.cx, t.cy)
    ctx.rotate((t.angle * Math.PI) / 180)
    ctx.drawImage(img, (-size.width * scale) / 2, (-size.height * scale) / 2, size.width * scale, size.height * scale)
  } else if (own) {
    const size = imageSize(own)
    const scale = Math.max(w / size.width, h / size.height)
    const dw = size.width * scale
    const dh = size.height * scale
    ctx.drawImage(own, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  } else if (image) {
    const [a, b, c, d, e, f] = step.matrix
    ctx.translate(x, y)
    ctx.scale(w, h)
    ctx.transform(a, b, c, d, e, f)
    ctx.drawImage(image, 0, 0, step.width, step.height)
  }
  ctx.restore()
}

function imageSize(img: CanvasImageSource): { width: number; height: number } {
  const i = img as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: number | SVGAnimatedLength; height?: number | SVGAnimatedLength }
  const width = i.naturalWidth || i.videoWidth || (typeof i.width === "number" ? i.width : 0) || 1
  const height = i.naturalHeight || i.videoHeight || (typeof i.height === "number" ? i.height : 0) || 1
  return { width, height }
}

/**
 * Draws the poster, bottom to top as the template's steps say: layers, photo, paddle and ball,
 * the generated text. `image(src)` gives a loaded file; `photo` is the user's own photo (else the
 * template's). Returns the fields whose text didn't fit at the smallest size (shorten them).
 */
export function drawAd(
  ctx: CanvasRenderingContext2D,
  id: AdTemplateId,
  content: AdContent,
  look: {
    manifest: AdManifest
    image: (src: string) => CanvasImageSource | null
    photo?: CanvasImageSource | null
    /** The court's own logo (else the template's sample logo), its size (1 = fits the box) and offset (in box widths / heights). */
    logo?: { image: CanvasImageSource | null; scale?: number; dx?: number; dy?: number } | null
  },
): { overflow: string[] } {
  const overflow: string[] = []
  const warn = (f: string) => {
    if (!overflow.includes(f)) overflow.push(f)
  }
  const n = Number(id.split("-")[1]) as 1 | 2 | 3 | 4
  const day = Number(id.split("-")[1])
  ctx.save()
  ctx.clearRect(0, 0, AD_SIZE, AD_SIZE)
  ctx.textBaseline = "alphabetic"
  for (const step of look.manifest.templates[id] ?? []) {
    if (step.type === "layer") {
      const img = look.image(step.src)
      if (img) ctx.drawImage(img, 0, 0, AD_SIZE, AD_SIZE)
    } else if (step.type === "photo") {
      drawPhoto(ctx, step, look.image(step.src), look.photo ?? null)
    } else if (step.type === "logo") {
      const own = look.logo?.image ?? null
      const img = own ?? (look.manifest.pictures.courtLogo ? look.image(look.manifest.pictures.courtLogo) : null)
      drawLogo(ctx, step, img, { scale: look.logo?.scale ?? 1, dx: look.logo?.dx ?? 0, dy: look.logo?.dy ?? 0 })
    } else if (step.type === "picture") {
      const img = look.image(look.manifest.pictures[step.name])
      if (!img) continue
      // Whole and undistorted: the picture fits inside its Figma box (never cut, never stretched).
      const size = imageSize(img)
      const fitScale = Math.min(step.w / size.width, step.h / size.height)
      const dw = size.width * fitScale
      const dh = size.height * fitScale
      ctx.save()
      ctx.translate(step.cx, step.cy)
      ctx.rotate((step.angle * Math.PI) / 180)
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
      ctx.restore()
    } else {
      ctx.save()
      if (content.kind === "funfact" && adKindOf(id) === "funfact") FUNFACT[n](ctx, content, warn)
      if (content.kind === "history" && adKindOf(id) === "history") HISTORY[n](ctx, content, warn)
      if (content.kind === "trivia" && adKindOf(id) === "trivia") TRIVIA[n](ctx, content, warn)
      if (content.kind === "courtowner" && adKindOf(id) === "courtowner") COURTOWNER[day]?.(ctx, content, warn)
      if (content.kind === "comingsoon" && adKindOf(id) === "comingsoon") COMINGSOON[day]?.(ctx, content, warn)
      if (content.kind === "nowopen" && adKindOf(id) === "nowopen") NOWOPEN[day]?.(ctx, content, warn)
      ctx.restore()
    }
  }
  OVER[id]?.(ctx, content, warn)
  ctx.restore()
  return { overflow }
}
