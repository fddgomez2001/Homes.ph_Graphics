"use client"

import { format } from "date-fns"
import type { ReportCarousel, ReportData, ReportDay, ReportPost } from "@/lib/data/report"
import { LOGO_BLUE_SRC, PICKLEPLAY_LOGO_SRC } from "@/lib/design/constants"
import { loadImage } from "@/lib/design/image-cache"
import { newsTimeLabel, newsTimesFor, type NewsBrand } from "@/lib/design/news-templates"
import type { SlideDesign } from "@/lib/design/types"

/**
 * The "Daily Tasks" report (Figma "October 28, 2026", 10164 px wide): DONE —
 * the day's PicklePlay, FHI and Homes.ph CARAGA article posts by time, and each
 * carousel with the Homes.ph pages it was posted on, its slides and caption —
 * then PENDING. Laid out in the Figma's units and drawn at any scale.
 */

export const REPORT_WIDTH = 10164
const BLUE = "#1428AE"
const NAVY = "#2F3A80"
const FONT = "Outfit, Inter, sans-serif"
export const FHI_EMBLEM_SRC = "/brand/news/fhi-emblem.png"

/**
 * Each brand's block, in Figma units from its title's top: the logo box, the
 * post width of its main template (frames are 1408 high), where the five
 * frames start and how far apart, the time labels' center, and the space after
 * it when another brand's block follows.
 */
const BRANDS: Record<
  NewsBrand,
  { name: string; logo: string; logoBox: { x: number; y: number; width: number; height: number }; frame: number; x0: number; step: number; labelGap: number; gapAfter: number }
> = {
  pickleplay: { name: "Pickleplay.ph", logo: PICKLEPLAY_LOGO_SRC, logoBox: { x: 512, y: 87, width: 594, height: 594 }, frame: 1408, x0: 512, step: 1932, labelGap: 1208, gapAfter: 520 },
  fhi: { name: "FHI Global Property", logo: FHI_EMBLEM_SRC, logoBox: { x: 512, y: 87, width: 594, height: 594 }, frame: 1152, x0: 529, step: 1997, labelGap: 1058, gapAfter: 478 },
  caraga: { name: "Homes.ph CARAGA", logo: LOGO_BLUE_SRC, logoBox: { x: 518, y: 95, width: 587, height: 577 }, frame: 1408, x0: 504, step: 1930, labelGap: 1299, gapAfter: 478 },
}
const BRAND_ORDER: NewsBrand[] = ["pickleplay", "fhi", "caraga"]
const FRAME_HEIGHT = 1408
/** After the last article block, before the carousel. */
const GAP_BEFORE_CAROUSEL = 240

// ---------------------------------------------------------------------------
// What's pending
// ---------------------------------------------------------------------------

export type PendingItem =
  | { kind: "articles"; brands: NewsBrand[]; day: Date; times: string[] }
  | { kind: "carousel"; day: Date; time: string; state: "not-made" | "not-posted" | "partial"; pagesLeft: string[]; title?: string }

function missingTimes(day: ReportDay, brand: NewsBrand) {
  return newsTimesFor(brand)
    .filter((t) => !day.posts.some((p) => p.brand === brand && p.time === t.time))
    .map((t) => t.time)
}

const timeOf = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm") : "23:00")

/** Article slots still empty (today and tomorrow) and carousels not (fully) posted or not made yet. */
export function planPending(data: ReportData): PendingItem[] {
  const items: PendingItem[] = []
  for (const day of [data.today, data.tomorrow]) {
    // Brands missing the same times share a line ("Pickleplay.ph & FHI Global Property").
    const groups: { brands: NewsBrand[]; times: string[] }[] = []
    for (const brand of BRAND_ORDER) {
      const times = missingTimes(day, brand)
      if (!times.length) continue
      const same = groups.find((g) => g.times.join() === times.join())
      if (same) same.brands.push(brand)
      else groups.push({ brands: [brand], times })
    }
    for (const g of groups) items.push({ kind: "articles", brands: g.brands, day: day.day, times: g.times })
    if (day.carousels.length === 0) items.push({ kind: "carousel", day: day.day, time: "23:00", state: "not-made", pagesLeft: [] })
    else if (day === data.today) {
      for (const c of day.carousels) {
        if (c.project.status === "published" && c.pagesLeft.length === 0) continue
        items.push({
          kind: "carousel",
          day: day.day,
          time: timeOf(c.project.scheduled_at),
          state: c.postedPages.length ? "partial" : "not-posted",
          pagesLeft: c.pagesLeft.map((p) => p.short_name),
          title: c.project.title,
        })
      }
    }
  }
  return items
}

/** Carousels that went out on at least one page that day. */
export function doneCarousels(day: ReportDay): ReportCarousel[] {
  return day.carousels.filter((c) => c.postedPages.length > 0 || c.project.status === "published")
}

// ---------------------------------------------------------------------------
// Text helpers (Figma units; letter spacing in em)
// ---------------------------------------------------------------------------

interface Run {
  text: string
  weight: number
  size: number
  spacing?: number
  color?: string
}

function setFont(ctx: CanvasRenderingContext2D, run: Run) {
  ctx.font = `${run.weight} ${run.size}px ${FONT}`
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(run.spacing ?? 0) * run.size}px`
}

function runWidth(ctx: CanvasRenderingContext2D, run: Run) {
  setFont(ctx, run)
  return ctx.measureText(run.text).width
}

function drawRuns(ctx: CanvasRenderingContext2D, runs: Run[], x: number, centerY: number) {
  ctx.textBaseline = "middle"
  ctx.textAlign = "left"
  let cursor = x
  for (const run of runs) {
    setFont(ctx, run)
    ctx.fillStyle = run.color ?? NAVY
    ctx.fillText(run.text, cursor, centerY)
    cursor += ctx.measureText(run.text).width
  }
  return cursor
}

/** "9 AM", "1:30 PM": the number bold, AM / PM regular. */
function timeRuns(time: string, size: number): Run[] {
  const [num, ampm] = newsTimeLabel(time).split(" ")
  return [
    { text: num, weight: 700, size },
    { text: ampm, weight: 400, size },
  ]
}

function wrapWords(ctx: CanvasRenderingContext2D, text: string, run: Omit<Run, "text">, width: number) {
  setFont(ctx, { ...run, text })
  const lines: string[] = []
  for (const paragraph of text.split(/\n+/)) {
    let line = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && ctx.measureText(next).width > width) {
        lines.push(line)
        line = word
      } else line = next
    }
    if (line) lines.push(line)
  }
  return lines
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

export interface ReportImages {
  /** The rendered post or slide, drawn into a width × height box. */
  design: (design: SlideDesign, width: number) => Promise<CanvasImageSource | null>
}

type Op = (ctx: CanvasRenderingContext2D) => void

async function staticImage(src: string) {
  try {
    return await loadImage(src)
  } catch {
    return null
  }
}

/**
 * Lays out and draws the report for `data.today`. `scale` 1 is the Figma size
 * (10164 px wide); the height follows the content.
 */
export async function renderDailyReport(
  data: ReportData,
  options: { scale: number; images: ReportImages; onProgress?: (done: number, total: number) => void },
): Promise<HTMLCanvasElement> {
  await Promise.all([300, 400, 500, 600, 700, 900].map((w) => document.fonts.load(`${w} 100px Outfit`).catch(() => [])))
  const measure = document.createElement("canvas").getContext("2d")!
  const [ppLogo, fhiLogo, homesLogo] = await Promise.all([staticImage(BRANDS.pickleplay.logo), staticImage(BRANDS.fhi.logo), staticImage(LOGO_BLUE_SRC)])
  const logos: Record<NewsBrand, CanvasImageSource | null> = { pickleplay: ppLogo, fhi: fhiLogo, caraga: homesLogo }

  const { today } = data
  const s = options.scale
  const posts = BRAND_ORDER.map((brand) => ({ brand, posts: today.posts.filter((p) => p.brand === brand) })).filter((b) => b.posts.length)
  const carousels = doneCarousels(today)
  const pending = planPending(data)

  // Every post and slide is rendered once, at the size it's drawn.
  const jobs: { design: SlideDesign; width: number }[] = []
  const want = (design: SlideDesign, width: number) => jobs.push({ design, width }) - 1
  const ops: Op[] = []
  const bitmaps: (CanvasImageSource | null)[] = []
  const drawBitmap = (job: number, x: number, y: number, w: number, h: number) =>
    ops.push((ctx) => {
      const img = bitmaps[job]
      if (img) ctx.drawImage(img, x, y, w, h)
      else {
        ctx.fillStyle = "#E8EBF3"
        ctx.fillRect(x, y, w, h)
      }
    })
  const text = (runs: Run[], x: number, cy: number) => ops.push((ctx) => drawRuns(ctx, runs, x, cy))
  const centered = (runs: Run[], cx: number, cy: number) => {
    const width = runs.reduce((sum, r) => sum + runWidth(measure, r), 0) - (runs.at(-1)?.spacing ?? 0) * (runs.at(-1)?.size ?? 0)
    text(runs, cx - width / 2, cy)
  }
  const image = (img: CanvasImageSource | null, x: number, y: number, w: number, h: number) => img && ops.push((ctx) => ctx.drawImage(img, x, y, w, h))

  // Header
  centered([{ text: "DAILY TASKS", weight: 900, size: 800, color: BLUE }], REPORT_WIDTH / 2, 838)
  centered([{ text: format(today.day, "MMMM d, yyyy").toUpperCase(), weight: 500, size: 200, spacing: 0.38, color: BLUE }], REPORT_WIDTH / 2, 1369)
  text([{ text: "DONE", weight: 700, size: 400, color: BLUE }], 486, 1975)
  let y = 2333

  if (!posts.length && !carousels.length) {
    text([{ text: "Nothing marked done for this day yet.", weight: 400, size: 230 }], 516, y + 300)
    y += 900
  }

  // Article posting, one block per brand
  posts.forEach(({ brand, posts: brandPosts }, blockIndex) => {
    const b = BRANDS[brand]
    const logo = logos[brand]
    if (logo) {
      // Fitted into the Figma's logo box (the FHI emblem is narrower than it is tall).
      const ratio = (logo as HTMLImageElement).naturalWidth / (logo as HTMLImageElement).naturalHeight || 1
      const lw = Math.min(b.logoBox.width, b.logoBox.height * ratio)
      const lh = lw / ratio
      image(logo, b.logoBox.x + (b.logoBox.width - lw) / 2, y + b.logoBox.y + (b.logoBox.height - lh) / 2, lw, lh)
    }
    text(
      [
        { text: b.name, weight: 700, size: 300 },
        { text: " Article Posting", weight: 400, size: 300 },
      ],
      1241,
      y + 252,
    )
    text([{ text: format(today.day, "MMMM d, yyyy"), weight: 400, size: 200, spacing: 0.21 }], 1241, y + 516)
    const labelY = y + b.labelGap
    const framesTop = labelY + 238
    // Posts at their own size (an FHI wide post is 1742 × 1436), the row justified
    // between the Figma's first and last frame edges like its mixed rows.
    const slots = newsTimesFor(brand).map((slot) => {
      const post: ReportPost | undefined = brandPosts.find((p) => p.time === slot.time)
      return { slot, post, width: post ? post.design.width : b.frame, height: post ? post.design.height : FRAME_HEIGHT }
    })
    const left = b.x0
    const right = b.x0 + (slots.length - 1) * b.step + b.frame
    const total = slots.reduce((sum, s) => sum + s.width, 0)
    const fit = Math.min(1, (right - left - (slots.length - 1) * 90) / total)
    const gap = (right - left - total * fit) / Math.max(1, slots.length - 1)
    let x = left
    let tallest = FRAME_HEIGHT * fit
    for (const { slot, post, width, height } of slots) {
      const w = width * fit
      const h = height * fit
      // The time label spans its post's width (like the Figma's spaced-out labels).
      const labelWidth = Math.min(w, b.frame)
      const base = runWidth(measure, { text: slot.label, weight: 700, size: 400 })
      const spacingPx = Math.max(0, (labelWidth - 10 - base) / Math.max(1, slot.label.length - 1))
      text([{ text: slot.label, weight: 700, size: 400, spacing: spacingPx / 400 }], x, labelY)
      if (post) {
        tallest = Math.max(tallest, h)
        drawBitmap(want(post.design, w), x, framesTop, w, h)
      } else {
        // An empty slot: a light dashed frame, so the posts that are there stand out.
        const px = x
        ops.push((ctx) => {
          ctx.fillStyle = "#F7F8FC"
          ctx.fillRect(px, framesTop, w, h)
          ctx.setLineDash([40, 28])
          ctx.lineWidth = 8
          ctx.strokeStyle = "#CDD3E6"
          ctx.strokeRect(px + 4, framesTop + 4, w - 8, h - 8)
          ctx.setLineDash([])
        })
        centered([{ text: "Not posted", weight: 500, size: 110, color: "#A3ABC9" }], x + w / 2, framesTop + h / 2)
      }
      x += w + gap
    }
    y = framesTop + tallest + (blockIndex < posts.length - 1 ? b.gapAfter : GAP_BEFORE_CAROUSEL)
  })

  // Scheduled carousel posting
  for (const carousel of carousels) {
    const time = timeOf(carousel.project.scheduled_at)
    text(
      [
        { text: "Scheduled Carousel Posting ", weight: 700, size: 250 },
        { text: "(Homes.ph Pages)", weight: 400, size: 250 },
      ],
      512,
      y + 388,
    )
    text(
      [
        { text: "For: ", weight: 700, size: 200, spacing: 0.21 },
        { text: `${format(today.day, "MMMM d, yyyy")} | `, weight: 400, size: 200, spacing: 0.21 },
        ...timeRuns(time, 200).map((r) => ({ ...r, spacing: 0.21 })),
      ],
      512,
      y + 736,
    )
    // Pages it went out on: "[H]omes.ph Main | [H] Cebu | …", wrapped.
    const pageNames = carousel.postedPages.map((p) => p.short_name)
    const lineTop0 = y + 993
    let lineTop = lineTop0
    let x = 516
    const maxX = 516 + 9136
    const sep: Run = { text: " | ", weight: 400, size: 230 }
    const sepW = runWidth(measure, sep)
    pageNames.forEach((name, i) => {
      const isMain = i === 0 && carousel.postedPages[0]?.key === "main"
      const runs: Run[] = isMain
        ? [
            { text: "omes.ph", weight: 700, size: 230 },
            { text: " Main", weight: 400, size: 230 },
          ]
        : [{ text: ` ${name}`, weight: 400, size: 230 }]
      const width = 166 + runs.reduce((sum, r) => sum + runWidth(measure, r), 0) + (i < pageNames.length - 1 ? sepW : 0)
      if (x + width > maxX && x > 516) {
        lineTop += 300
        x = 516
      }
      image(homesLogo, x, lineTop + 72, 166, 164)
      const end = x + 166 + runs.reduce((sum, r) => sum + runWidth(measure, r), 0)
      const cy = lineTop + 150
      text(runs, x + 166, cy)
      if (i < pageNames.length - 1) text([sep], end, cy)
      x = end + (i < pageNames.length - 1 ? sepW : 0)
    })
    const pagesBottom = pageNames.length ? lineTop + 300 : lineTop0
    // Slides in a row
    const n = carousel.slides.length
    const size = n ? Math.min(1254, (9258 - (n - 1) * 80) / n) : 0
    const slidesTop = pagesBottom + 234
    carousel.slides.forEach((design, i) => drawBitmap(want(design, size), 476 + i * (size + 80), slidesTop, size, (size * design.height) / design.width))
    // Caption
    let bottom = slidesTop + size
    const caption = carousel.project.caption.trim()
    if (caption) {
      const run = { weight: 500, size: 150, color: "#000000" }
      const lines = wrapWords(measure, caption, run, 9258)
      const top = bottom + 229
      lines.forEach((line, i) => text([{ ...run, text: line }], 516, top + i * 156 + 78))
      bottom = top + lines.length * 156
    }
    y = bottom + 418
  }

  // Pending
  const pendingTop = y
  text([{ text: "PENDING", weight: 700, size: 400, color: BLUE }], 486, pendingTop + 330)
  let itemTop = pendingTop + 661
  if (!pending.length) {
    text([{ text: "Nothing pending — all caught up.", weight: 400, size: 230 }], 491, itemTop + 388)
    itemTop += 900
  }
  for (const item of pending) {
    // "Pickleplay.ph & FHI Global Property Article Posting", "Homes.ph CARAGA Article Posting"
    const title = item.kind === "carousel" ? null : item.brands.map((brand) => BRANDS[brand].name).join(" & ")
    text(
      title
        ? [
            { text: title, weight: 700, size: 250 },
            { text: " Article Posting", weight: 400, size: 250 },
          ]
        : [
            { text: "Scheduled Carousel Posting ", weight: 700, size: 250 },
            { text: "(Homes.ph Pages)", weight: 400, size: 250 },
          ],
      491,
      itemTop + 388,
    )
    const times = item.kind === "articles" ? item.times : [item.time]
    const runs: Run[] = [
      { text: "For: ", weight: 700, size: 200, spacing: 0.21 },
      { text: format(item.day, "MMMM d, yyyy"), weight: 400, size: 200, spacing: 0.21 },
    ]
    times.forEach((t) => runs.push({ text: " | ", weight: 400, size: 230 }, ...timeRuns(t, 230)))
    if (item.kind === "carousel") {
      // Which carousel, so two on one day can't be mixed up.
      const name = item.title ? `  ·  “${item.title.length > 60 ? `${item.title.slice(0, 57)}…` : item.title}”` : ""
      runs.push({
        text: `${name}  ·  ${item.state === "not-made" ? "not made yet" : item.state === "not-posted" ? "not posted yet" : `${item.pagesLeft.length} page${item.pagesLeft.length === 1 ? "" : "s"} left`}`,
        weight: 400,
        size: 200,
      })
    }
    text(runs, 491, itemTop + 777)
    itemTop += 1026
    if (item.kind === "carousel" && item.state === "partial" && item.pagesLeft.length) {
      const run = { weight: 400, size: 200 }
      const lines = wrapWords(measure, item.pagesLeft.join(" | "), run, 9136)
      lines.forEach((line, i) => text([{ ...run, text: line }], 491, itemTop + i * 260 + 130))
      itemTop += lines.length * 260 + 120
    }
  }
  const height = Math.ceil(itemTop + 742)

  // Render every post and slide (in order, so progress is meaningful).
  for (let i = 0; i < jobs.length; i++) {
    options.onProgress?.(i, jobs.length)
    bitmaps[i] = await options.images.design(jobs[i].design, Math.max(1, Math.round(jobs[i].width * s))).catch(() => null)
  }
  options.onProgress?.(jobs.length, jobs.length)

  const canvas = document.createElement("canvas")
  canvas.width = Math.round(REPORT_WIDTH * s)
  canvas.height = Math.round(height * s)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This report is too large to draw here. Try the standard size.")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(s, s)
  for (const op of ops) op(ctx)
  return canvas
}
