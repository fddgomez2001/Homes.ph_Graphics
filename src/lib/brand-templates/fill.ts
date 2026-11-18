/**
 * Fills a brand post template (an SVG in the page, so its text can be measured): the team's fill scripts
 * (public/ALL-BRAND-TEMPLATES/_Scripts & Instructions: homesph-poster-fill.js → fillPoster, homesph-engagement-fill.js
 * → fillEngagement) in TypeScript, line for line. Every template keeps its own rules in data attributes (sizes, line
 * heights, gaps, max lines, min sizes), so the same two functions fill every design.
 *
 * Added for the app: the news poster's photo can be moved and zoomed in its box (zoom / focus, like every poster's
 * photo in the Poster Maker), and every fill starts from a fresh copy of the template.
 *
 * Markup in the texts: *text* = highlight color, \n = line break, _text_ = underline (the credit).
 */
import { coverLayout, frameLayout } from "@/lib/design/geometry"
import type { FillPhoto, PostFields } from "./types"

const SVG_NS = "http://www.w3.org/2000/svg"
const XLINK = "http://www.w3.org/1999/xlink"

type Word = { w: string; hl: boolean; glue: boolean; br?: false } | { br: true }
type TextWord = Extract<Word, { w: string }>
type El = SVGElement & { dataset: DOMStringMap }

const num = (v: string | null | undefined) => Number(v ?? 0)

// ---------- shared: words, lines, measuring, wrapping ----------

/** Words; text touching a *highlight* with no space stays glued to it (e.g. "*Al Karama*,", "*Cebu*?"). */
export function parseWords(str: string, upper: boolean): Word[] {
  const out: Word[] = []
  let hl = false
  let buf = ""
  let sawSpace = true
  const flush = () => {
    if (!buf) return
    out.push({ w: upper ? buf.toUpperCase() : buf, hl, glue: !sawSpace })
    buf = ""
    sawSpace = false
  }
  for (const ch of str || "") {
    if (ch === "*") {
      flush()
      hl = !hl
      continue
    }
    if (ch === "\n") {
      flush()
      out.push({ br: true })
      sawSpace = true
      continue
    }
    if (/\s/.test(ch)) {
      flush()
      sawSpace = true
      continue
    }
    buf += ch
  }
  flush()
  return out
}

/** One line of words (highlighted runs as tspans of their own). `hlColor`: engagement posts color it themselves. */
function buildLine(textEl: El, id: string, words: TextWord[], x: string | number, y: number, hlColor?: string) {
  const line = document.createElementNS(SVG_NS, "tspan")
  if (id) line.id = id
  line.setAttribute("x", String(x))
  line.setAttribute("y", String(y))
  let cur: { hl: boolean; node: SVGTSpanElement } | null = null
  words.forEach((wd, i) => {
    const t = (i && !wd.glue ? " " : "") + wd.w
    if (cur && cur.hl === wd.hl) {
      cur.node.textContent += t
      return
    }
    const n = document.createElementNS(SVG_NS, "tspan")
    if (wd.hl) {
      n.setAttribute("class", "hl")
      if (hlColor) n.setAttribute("fill", hlColor)
    }
    n.textContent = t
    line.appendChild(n)
    cur = { hl: wd.hl, node: n }
  })
  textEl.appendChild(line)
  return line
}

function measure(textEl: El, words: TextWord[]) {
  const t = buildLine(textEl, "", words, 0, -9999)
  const w = t.getComputedTextLength()
  t.remove()
  return w
}

function wrap(textEl: El, words: Word[], maxW: number, maxLines: number) {
  // glued words move together as one unit
  const units: (TextWord[] | "br")[] = []
  for (const wd of words) {
    if ("br" in wd && wd.br) {
      units.push("br")
      continue
    }
    const last = units[units.length - 1]
    if ((wd as TextWord).glue && Array.isArray(last)) last.push(wd as TextWord)
    else units.push([wd as TextWord])
  }
  const lines: TextWord[][] = [[]]
  for (const u of units) {
    if (u === "br") {
      lines.push([])
      continue
    }
    const cur = lines[lines.length - 1]
    if (cur.length && measure(textEl, [...cur, ...u]) > maxW) lines.push([...u])
    else cur.push(...u)
  }
  const clean = lines.filter((l) => l.length)
  clean.forEach((l) => {
    if (l[0]) l[0] = { ...l[0], glue: false }
  })
  return { lines: clean, fits: clean.length <= maxLines && clean.every((l) => measure(textEl, l) <= maxW) }
}

// ---------- news posters (fillPoster) ----------

export interface PosterFill {
  photo: FillPhoto | null
  headline: string
  /** "" hides it. */
  subtext: string
  /** "" hides it. _text_ = underlined. */
  credit: string
  /** Template 07's tag pill ("" hides it). */
  tag: string
}

function fitText(textEl: El, str: string) {
  const d = textEl.dataset
  const base = +(d.baseSize || (d.baseSize = textEl.getAttribute("font-size") ?? "0"))
  const baseLH = +(d.baseLineHeight || (d.baseLineHeight = d.lineHeight ?? "0"))
  const words = parseWords(str, d.transform === "uppercase")
  textEl.replaceChildren()

  // Single-line headline (artist templates 09/10): never wraps – shrinks to fit the width,
  // and only if it is still too wide at minFontSize, the letters are squeezed (textLength).
  if (d.singleLine === "true") {
    const one = words.filter((w): w is TextWord => !("br" in w && w.br))
    if (one.length) one[0] = { ...one[0], glue: false }
    textEl.setAttribute("font-size", String(base))
    let size = base
    const w = measure(textEl, one)
    if (w > +d.maxWidth!) size = Math.max(+d.minSize!, Math.floor((base * +d.maxWidth!) / w))
    textEl.setAttribute("font-size", String(size))
    return { lines: [one], size, lineHeight: (baseLH * size) / base, squeeze: measure(textEl, one) > +d.maxWidth! }
  }
  let size = base
  let result: ReturnType<typeof wrap>
  for (;;) {
    textEl.setAttribute("font-size", String(size))
    result = wrap(textEl, words, +d.maxWidth!, +d.maxLines!)
    if (result.fits || size <= +d.minSize!) break
    size -= 2
  }
  return { lines: result.lines.slice(0, +d.maxLines!), size, lineHeight: (baseLH * size) / base, squeeze: false }
}

/** The image's box as the template drew it (kept, so the photo can be placed in it again). */
function boxOf(img: Element) {
  const el = img as El
  if (!el.dataset.box) el.dataset.box = ["x", "y", "width", "height"].map((k) => img.getAttribute(k) ?? "0").join(" ")
  const [x, y, width, height] = el.dataset.box.split(" ").map(Number)
  return { x, y, width, height }
}

/** The picture of an image (one copy: the older xlink:href is taken out). */
function setHref(img: Element, href: string) {
  img.setAttribute("href", href)
  img.removeAttributeNS(XLINK, "href")
}

/**
 * The main photo placed in its box at its zoom and focus (the Poster Maker's move / zoom): covering the box, or,
 * where the template shows the whole photo ("meet", the framed template), over the blurred copy behind it.
 */
function placePhoto(svg: SVGSVGElement, img: Element, photo: FillPhoto) {
  const box = boxOf(img)
  const contain = /meet/.test(img.getAttribute("preserveAspectRatio") ?? "")
  const { naturalWidth: nw, naturalHeight: nh, zoom, focusX, focusY } = photo
  const rect = contain
    ? frameLayout(nw, nh, box.width, box.height, zoom, focusX, focusY).image
    : coverLayout(nw, nh, box.width, box.height, zoom, focusX, focusY).image
  img.setAttribute("x", String(box.x + rect.x))
  img.setAttribute("y", String(box.y + rect.y))
  img.setAttribute("width", String(rect.width))
  img.setAttribute("height", String(rect.height))
  img.setAttribute("preserveAspectRatio", "none")
  // Kept inside its box (the split template's photo ends at its band).
  let defs = svg.querySelector("defs")
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs")
    svg.prepend(defs)
  }
  const id = `${img.id || "photo"}-box-clip`
  svg.querySelector(`[id="${id}"]`)?.remove()
  const clip = document.createElementNS(SVG_NS, "clipPath")
  clip.id = id
  clip.setAttribute("clipPathUnits", "userSpaceOnUse")
  const r = document.createElementNS(SVG_NS, "rect")
  for (const [k, v] of Object.entries(box)) r.setAttribute(k, String(v))
  clip.appendChild(r)
  defs.appendChild(clip)
  img.setAttribute("clip-path", `url(#${id})`)
}

export function fillPoster(svg: SVGSVGElement, data: PosterFill) {
  const $ = (id: string) => svg.querySelector<SVGElement>(`[id="${id}"]`) as El | null
  const L = $("text-block")!.dataset
  const subLast = +L.subtextLastBaseline!
  const gapDiv = +L.dividerGap!
  const gapHead = +L.headlineGap!
  const x = $("headline")!.getAttribute("x")!

  // Photo – fills the main photo and any blurred copies (framed template)
  if (data.photo) {
    svg.querySelectorAll("[data-photo]").forEach((img) => setHref(img, data.photo!.href))
    const main = svg.querySelector('[data-photo="main"]')
    if (main) placePhoto(svg, main, data.photo)
    $("photo-placeholder")?.setAttribute("display", "none")
  }

  // Credit / source line
  // _text_ in the credit = underlined (e.g. "SOURCE: FB PAGE / _MANILA BULLETIN_")
  const credit = $("photo-credit")
  if (credit) {
    credit.replaceChildren()
    const raw = credit.dataset.transform === "uppercase" ? (data.credit || "").toUpperCase() : data.credit || ""
    raw.split(/(_[^_]+_)/).forEach((part) => {
      if (!part) return
      const t = document.createElementNS(SVG_NS, "tspan")
      if (/^_.+_$/.test(part)) {
        t.textContent = part.slice(1, -1)
        t.setAttribute("text-decoration", "underline")
      } else t.textContent = part
      credit.appendChild(t)
    })
    credit.setAttribute("display", data.credit ? "inline" : "none")
  }

  // Subtext (optional) – bottom anchored
  const sub = $("subtext")
  let anchorY = +L.dividerNoSubtext!
  let blockBottom: number | undefined
  if (sub && data.subtext && data.subtext.trim()) {
    const s = fitText(sub, data.subtext)
    const first = subLast - (s.lines.length - 1) * s.lineHeight
    s.lines.forEach((l, i) => buildLine(sub, "subtext-line-" + (i + 1), l, x, first + i * s.lineHeight))
    sub.setAttribute("display", "inline")
    anchorY = first - s.size * 0.72 - gapDiv
    blockBottom = subLast + s.size * 0.25
  } else if (sub) {
    sub.replaceChildren()
    sub.setAttribute("display", "none")
  }

  // Divider (only in templates that have one)
  const divider = $("divider")
  if (divider) divider.setAttribute("y", String(anchorY))
  if (blockBottom === undefined) blockBottom = divider ? anchorY + 5 : anchorY - gapHead + 10

  // Headline (max lines set per template: 2, or 3 for spotlight)
  const hd = $("headline")!
  const h = fitText(hd, data.headline)
  const last = anchorY - gapHead
  h.lines.forEach((l, i) => buildLine(hd, "headline-line-" + (i + 1), l, x, last - (h.lines.length - 1 - i) * h.lineHeight))
  if (h.squeeze) {
    const line = $("headline-line-1")!
    line.setAttribute("textLength", hd.dataset.maxWidth!)
    line.setAttribute("lengthAdjust", "spacingAndGlyphs")
  }
  let blockTop = last - (h.lines.length - 1) * h.lineHeight - h.size * 0.75

  // Tag pill (template 07)
  const tag = $("tag")
  if (tag) {
    const show = data.tag !== ""
    tag.setAttribute("display", show ? "inline" : "none")
    if (show) {
      const tt = $("tag-text") as unknown as SVGTextElement
      const bg = $("tag-bg")!
      if (data.tag) tt.textContent = data.tag.toUpperCase()
      const th = +bg.getAttribute("height")!
      const gap = +(tag.dataset.gap || 22)
      const y = blockTop - gap - th
      bg.setAttribute("y", String(y))
      bg.setAttribute("width", String(tt.getComputedTextLength() + 44))
      tt.setAttribute("y", String(y + th / 2 + 6.5))
      blockTop = y
    }
  }

  // Elements that wrap the text: card (06) and accent bar (08)
  svg.querySelectorAll<El>('[data-wrap="text"]').forEach((el) => {
    const pad = +el.dataset.padding!
    el.setAttribute("y", String(blockTop - pad))
    el.setAttribute("height", String(blockBottom! - blockTop + 2 * pad))
  })
}

// ---------- Did You Know / engagement posts (fillEngagement) ----------

export interface EngagementFill extends PostFields {
  /** Photo 1, photo 2 (two-photo layouts). */
  photos: (FillPhoto | null)[]
  /** Optional blurred / tinted background; defaults to photo 1. */
  background?: FillPhoto | null
}

const engLine = (textEl: El, words: TextWord[], x: string | number, y: number) => buildLine(textEl, "", words, x, y, textEl.dataset.highlightColor || "#FFCF74")

function engMeasure(textEl: El, words: TextWord[]) {
  const t = engLine(textEl, words, 0, -9999)
  const w = t.getComputedTextLength()
  t.remove()
  return w
}

function engWrap(textEl: El, words: Word[], maxW: number, maxLines: number) {
  const units: (TextWord[] | "br")[] = []
  for (const wd of words) {
    if ("br" in wd && wd.br) {
      units.push("br")
      continue
    }
    const last = units[units.length - 1]
    if ((wd as TextWord).glue && Array.isArray(last)) last.push(wd as TextWord)
    else units.push([wd as TextWord])
  }
  const lines: TextWord[][] = [[]]
  for (const u of units) {
    if (u === "br") {
      lines.push([])
      continue
    }
    const cur = lines[lines.length - 1]
    if (cur.length && engMeasure(textEl, [...cur, ...u]) > maxW) lines.push([...u])
    else cur.push(...u)
  }
  const clean = lines.filter((l) => l.length)
  clean.forEach((l) => {
    if (l[0]) l[0] = { ...l[0], glue: false }
  })
  return { lines: clean, fits: clean.length <= maxLines && clean.every((l) => engMeasure(textEl, l) <= maxW) }
}

/** Wraps + shrinks text, places first line's ink top at topY. Returns positions. */
function engText(textEl: El, value: string, topY: number) {
  const d = textEl.dataset
  const base = +(d.baseSize || (d.baseSize = textEl.getAttribute("font-size") ?? "0"))
  const baseLH = +(d.baseLineHeight || (d.baseLineHeight = d.lineHeight ?? "0"))
  const asc = +(d.ascent || 0.73)
  const words = parseWords(value, d.transform === "uppercase")
  textEl.replaceChildren()
  let size = base
  let r: ReturnType<typeof engWrap>
  for (;;) {
    textEl.setAttribute("font-size", String(size))
    r = engWrap(textEl, words, +d.maxWidth!, +d.maxLines!)
    if (r.fits || size <= +d.minSize!) break
    size -= 2
  }
  const lh = (baseLH * size) / base
  const lines = r.lines.slice(0, +d.maxLines!)
  const x = textEl.getAttribute("x")!
  const first = topY + asc * size
  lines.forEach((l, i) => engLine(textEl, l, x, first + i * lh))
  return { first, last: first + (lines.length - 1) * lh, size, lh, asc, count: lines.length }
}

function engGet(data: EngagementFill, field: string): unknown {
  return field.split(".").reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), data)
}

function engSetBox(el: Element | null, x: number, y: number, w: number, h: number) {
  if (!el) return
  el.setAttribute("x", String(x))
  el.setAttribute("y", String(y))
  el.setAttribute("width", String(Math.max(0, w)))
  el.setAttribute("height", String(Math.max(0, h)))
}

/** Gold pill (kicker / label / cta): sizes to its text. anchor = "center" | "left" */
function engPill(group: El, value: string, x: number, y: number, anchor: "center" | "left") {
  const rect = group.querySelector("rect")!
  const text = group.querySelector("text") as SVGTextElement
  const d = group.dataset
  const h = +d.height!
  const padX = +d.padX!
  text.textContent = d.transform === "uppercase" ? value.toUpperCase() : value
  const w = text.getComputedTextLength() + padX * 2
  const left = anchor === "center" ? x - w / 2 : x
  engSetBox(rect, left, y, w, h)
  text.setAttribute("text-anchor", "middle")
  text.setAttribute("x", String(left + w / 2))
  text.setAttribute("y", String(y + h / 2 + +text.getAttribute("font-size")! * 0.36))
  return { w, h }
}

export function fillEngagement(svg: SVGSVGElement, data: EngagementFill) {
  const $ = (id: string) => svg.querySelector<SVGElement>(`[id="${id}"]`) as El | null
  const content = $("content")!
  const C = content.dataset
  const MX = +C.marginX!
  const CW = +C.contentWidth!
  const CX = MX + CW / 2

  // ---------- photos ----------
  const photos = data.photos || []
  svg.querySelectorAll<El>("image[data-photo]").forEach((img) => {
    const k = img.dataset.photo!
    const src = k === "background" ? data.background || photos[0] : photos[+k - 1]
    if (!src) return
    setHref(img, src.href)
    // focus: "top" keeps heads/faces in frame, "bottom" keeps the ground, default center
    const f = k === "background" ? null : (data.focus || [])[+k - 1]
    const align = { top: "xMidYMin", bottom: "xMidYMax", center: "xMidYMid" }[f ?? "center"] || "xMidYMid"
    img.setAttribute("preserveAspectRatio", align + " slice")
    const ph = $(img.id + "-placeholder")
    if (ph) ph.setAttribute("display", "none")
  })

  // ---------- content flow (top → down) ----------
  let cursor = +C.top!
  const items = [...content.querySelectorAll<El>("[data-flow]")].sort((a, b) => num(a.dataset.flow) - num(b.dataset.flow))
  for (const item of items) {
    const type = item.dataset.type
    const gap = +item.dataset.gapAfter!
    const field = item.dataset.field
    const value = field ? engGet(data, field) : null
    if (field && (value == null || String(value).trim() === "")) {
      if (item.dataset.optional === "true") {
        item.setAttribute("display", "none")
        continue
      }
    }
    item.setAttribute("display", "inline")
    if (type === "text") {
      const t = engText(item, String(value || ""), cursor)
      cursor = t.last + gap
    } else if (type === "pill") {
      const p = engPill(item, String(value || ""), CX, cursor, "center")
      cursor += p.h + gap
    } else if (type === "badge") {
      item.setAttribute("y", String(cursor))
      cursor += +item.getAttribute("height")! + gap
    } else if (type === "card") {
      const pad = +item.dataset.padding!
      const tail = +item.dataset.tail! || 0
      const text = item.querySelector("text") as unknown as El
      const t = engText(text, String(engGet(data, text.dataset.field!) || ""), cursor + pad)
      const bottom = t.last + pad * 0.8
      engSetBox(item.querySelector(".card-bg"), MX, cursor, CW, bottom - cursor)
      const tl = item.querySelector(".card-tail")
      if (tl) tl.setAttribute("transform", `translate(0 ${bottom})`)
      cursor = bottom + tail + gap
    }
  }

  // ---------- photo area (stretches to fill) ----------
  const area = $("photo-area")!
  const A = area.dataset
  const y0 = cursor
  const y1 = +C.bottom!
  const G = +A.gap! || 24

  const slot = (i: number, x: number, y: number, w: number, h: number) => {
    engSetBox($(`clip-photo-${i}-rect`), x, y, w, h)
    engSetBox($(`photo-${i}`), x, y, w, h)
    engSetBox($(`photo-${i}-placeholder`), x, y, w, h)
    engSetBox($(`photo-${i}-border`), x, y, w, h)
    // decorative accents that hug a photo corner (e.g. Bayanihan): data-anchor-slot + data-corner = tl | tr | bl | br
    svg.querySelectorAll<El>(`[data-anchor-slot="${i}"]`).forEach((el) => {
      const c = el.dataset.corner || "tl"
      const ax = c.endsWith("r") ? x + w : x
      const ay = c.startsWith("b") ? y + h : y
      el.setAttribute("transform", `translate(${ax} ${ay})`)
    })
    const lab = $(`label-${i}`)
    if (lab) {
      const v = engGet(data, `labels.${i - 1}`)
      if (!v) lab.setAttribute("display", "none")
      else {
        lab.setAttribute("display", "inline")
        engPill(lab, String(v), x + 24, y + h - 24 - +lab.dataset.height!, "left")
      }
    }
    return { x, y, w, h }
  }

  const layout = A.layout
  if (layout === "single") {
    const s = slot(1, MX, y0, CW, y1 - y0)
    const cta = $("cta")
    if (cta) {
      if (!data.cta) cta.setAttribute("display", "none")
      else {
        cta.setAttribute("display", "inline")
        engPill(cta, data.cta, s.x + s.w / 2, s.y + s.h - 32 - +cta.dataset.height!, "center")
      }
    }
    const mark = $("guess-mark")
    if (mark) mark.setAttribute("transform", `translate(${s.x + s.w - 70} ${s.y + 70})`)
  } else if (layout === "two-col") {
    const w = (CW - G) / 2
    slot(1, MX, y0, w, y1 - y0)
    slot(2, MX + w + G, y0, w, y1 - y0)
  } else if (layout === "two-row") {
    const h = (y1 - y0 - G) / 2
    slot(1, MX, y0, CW, h)
    slot(2, MX, y0 + h + G, CW, h)
  } else if (layout === "quiz") {
    const opts = (data.options || []).slice(0, 3)
    const ph = +A.pillHeight!
    const og = +A.pillGap!
    const total = opts.length ? opts.length * ph + (opts.length - 1) * og : 0
    slot(1, MX, y0, CW, y1 - y0 - total - (opts.length ? 32 : 0))
    for (let i = 1; i <= 3; i++) {
      const g = $(`option-${i}`)
      const v = opts[i - 1]
      if (!g) continue
      if (!v) {
        g.setAttribute("display", "none")
        continue
      }
      g.setAttribute("display", "inline")
      const y = y1 - total + (i - 1) * (ph + og)
      engSetBox(g.querySelector(".option-bg"), MX, y, CW, ph)
      const c = g.querySelector(".option-dot")!
      c.setAttribute("cy", String(y + ph / 2))
      const Lt = g.querySelector(".option-letter")!
      Lt.setAttribute("y", String(y + ph / 2 + +Lt.getAttribute("font-size")! * 0.36))
      const T = g.querySelector(".option-text") as unknown as El
      const t = engText(T, v, 0)
      const shift = y + ph / 2 + +T.getAttribute("font-size")! * 0.36 - t.first
      T.querySelectorAll(":scope > tspan").forEach((sp) => sp.setAttribute("y", String(+sp.getAttribute("y")! + shift)))
    }
  } else if (layout === "facts") {
    const facts = (data.facts || []).slice(0, 3)
    const n = facts.length || 1
    const rg = +A.rowGap!
    const rh = (y1 - y0 - (n - 1) * rg) / n
    for (let i = 1; i <= 3; i++) {
      const g = $(`fact-${i}`)
      const v = facts[i - 1]
      if (!g) continue
      if (!v) {
        g.setAttribute("display", "none")
        continue
      }
      g.setAttribute("display", "inline")
      const y = y0 + (i - 1) * (rh + rg)
      const cy = y + rh / 2
      engSetBox(g.querySelector(".fact-bg"), MX, y, CW, rh)
      g.querySelector(".fact-dot")!.setAttribute("cy", String(cy))
      const N = g.querySelector(".fact-number")!
      N.setAttribute("y", String(cy + +N.getAttribute("font-size")! * 0.36))
      const T = g.querySelector(".fact-text") as unknown as El
      const t = engText(T, v, 0)
      const blockH = (t.count - 1) * t.lh + t.asc * t.size
      const shift = cy - blockH / 2 + t.asc * t.size - t.first
      T.querySelectorAll(":scope > tspan").forEach((sp) => sp.setAttribute("y", String(+sp.getAttribute("y")! + shift)))
    }
  }
}
