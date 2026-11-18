/**
 * Builds the Advertisement → PicklePlay posters' layers from the Figma SVGs in
 * public/Pickleplay Templates.
 *
 * The app draws some things itself, so each template becomes an ordered list of steps
 * (public/ads/pickleplay/manifest.json):
 *   - "layer": the design's own shapes, logo, footer… between the app's parts (PNG/JPEG);
 *   - "photo": the court photo (or the user's own photo) in its shape, at its opacity;
 *   - "picture": the paddle or the ball, whole, at its size and tilt (the SVG export stretches
 *     these pictures into their tilted shapes' boxes and cuts them off, so the app draws them);
 *   - "logo": the court's logo (Coming Soon / Now Open): the user's logo, or the sample one, fitted
 *     inside the sample's box at its tilt;
 *   - "text": where the app draws the generated text (the sample text is left out).
 *
 *   node scripts/build-ad-templates.cjs
 */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const sharp = require("sharp")

const ROOT = path.join(__dirname, "..")
const SRC = path.join(ROOT, "public", "Pickleplay Templates")
const OUT = path.join(ROOT, "public", "ads", "pickleplay")
const SIZE = 1408

/** The sample text and the text-sized shapes (pills, highlight boxes, underlines, answer cards): drawn by the app. */
const TEMPLATES = [
  { id: "funfact-1", file: "Fun Facts/PicklePlay_Funfacts_1.svg", remove: [22, 23, 24, 25, 26, 27, 30, 31, 32] },
  { id: "funfact-2", file: "Fun Facts/PicklePlay_Funfacts_2.svg", remove: [14, 15, 19, 20, 21, 23, 24, 25, 27, 28, 29, 32] },
  { id: "funfact-3", file: "Fun Facts/PicklePlay_Funfacts_3.svg", remove: [7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20] },
  { id: "funfact-4", file: "Fun Facts/PicklePlay_Funfacts_4.svg", remove: [19, 20, 21, 22, 23, 25, 26, 27] },
  { id: "history-1", file: "History/PicklePlay_History_1.svg", remove: [20, 21, 22, 23, 25, 26, 27, 29, 30, 31, 32] },
  { id: "history-2", file: "History/PicklePlay_History_2.svg", remove: [13, 17, 21, 22, 23, 24, 25, 26, 30, 31, 32, 33, 34] },
  { id: "history-3", file: "History/PicklePlay_History_3.svg", remove: [13, 14, 15, 16, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 35] },
  { id: "history-4", file: "History/PicklePlay_History_4.svg", remove: [6, 9, 10, 11, 13, 14, 15, 18, 19, 20] },
  { id: "trivia-1", file: "Trivia/PicklePlay_Trivia_1.svg", remove: [21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35] },
  { id: "trivia-2", file: "Trivia/PicklePlay_Trivia_2.svg", remove: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39] },
  { id: "trivia-3", file: "Trivia/PicklePlay_Trivia_3.svg", remove: [18, 19, 20, 21, 22, 23, 24, 28, 30, 31, 32] },
  { id: "trivia-4", file: "Trivia/PicklePlay_Trivia_4.svg", remove: [14, 15, 16, 17, 18, 21, 22, 23, 24] },
  // Court Owners (Day 1–7): headline, highlight block + word, benefits / features. Day 2's check marks
  // move with its centered benefits, so the app draws them too.
  { id: "courtowner-1", file: "Court Owners/Ads_Court_Owner_1.svg", remove: [20, 21, 22, 25, 28, 31] },
  { id: "courtowner-2", file: "Court Owners/Ads_Court_Owner_2.svg", remove: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24] },
  { id: "courtowner-3", file: "Court Owners/Ads_Court_Owner_3.svg", remove: [15, 16, 17, 20, 23, 26] },
  { id: "courtowner-4", file: "Court Owners/Ads_Court_Owner_4.svg", remove: [9, 10, 11, 14, 17, 20] },
  { id: "courtowner-5", file: "Court Owners/Ads_Court_Owner_5.svg", remove: [13, 14, 15, 16, 22, 25, 28] },
  { id: "courtowner-6", file: "Court Owners/Ads_Court_Owner_6.svg", remove: [10, 11, 12, 13] },
  { id: "courtowner-7", file: "Court Owners/Ads_Court_Owner_7.svg", remove: [8, 9, 10, 13, 16, 19] },
  // Court Coming Soon 1–3: tag / kicker / chip, headline, highlight, court name · location, detail,
  // CTA (pills that follow their text too). `logo`: the court logo's element (the app draws it).
  { id: "comingsoon-1", file: "Court Coming Soon/Court_Coming_Soon_1.svg", remove: [21, 22, 23, 24, 25, 26, 27, 28], logo: 29 },
  { id: "comingsoon-2", file: "Court Coming Soon/Court_Coming_Soon_2.svg", remove: [16, 21, 22, 23, 24, 25, 26, 27, 30], logo: 20 },
  { id: "comingsoon-3", file: "Court Coming Soon/Court_Coming_Soon_3.svg", remove: [17, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32], logo: 20 },
  // Court Now Open 1–4. Template 2's rows are centered, so their check marks move with the text
  // (drawn by the app). Templates 3 and 4: the background photo is square (`photo` says it's a photo).
  { id: "nowopen-1", file: "Court Now Open/Court_Now_Open_1.svg", remove: [36, 39, 40, 41, 45, 46, 47, 48], logo: 30 },
  { id: "nowopen-2", file: "Court Now Open/Court_Now_Open_2.svg", remove: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], logo: 14 },
  { id: "nowopen-3", file: "Court Now Open/Court_Now_Open_3.svg", remove: [21, 22, 23, 24, 25, 28, 31, 34, 37], logo: 20, photo: [1], logoShadow: { color: "#FFFFFF", blur: 4, dy: 4 } },
  { id: "nowopen-4", file: "Court Now Open/Court_Now_Open_4.svg", remove: [24, 25, 26, 27, 28, 29, 32, 35, 38, 41], logo: 22, photo: [1] },
]

/** Which embedded picture is which (by shape; the Fun Facts files have smaller copies of the same pictures). */
const roleOf = (w, h) =>
  w === h ? "static" /* the logo */ : w / h > 1.6 ? "photo" : Math.abs(w / h - 1024 / 1536) < 0.01 ? "paddle" : Math.abs(w / h - 1262 / 1246) < 0.005 ? "ball" : "static"

const ELEMENT = /<(path|rect|circle|ellipse|line)\b[^>]*?\/>/g

function elements(svg) {
  const body = svg.slice(0, svg.indexOf("<defs>"))
  const drawn = body.replace(/<mask[\s\S]*?<\/mask>/g, (m) => " ".repeat(m.length))
  const found = []
  let m
  ELEMENT.lastIndex = 0
  while ((m = ELEMENT.exec(drawn))) found.push({ start: m.index, end: m.index + m[0].length, el: m[0] })
  return found
}

/** The SVG with only the elements in `keep` (masks, clip paths and <defs> stay). */
function only(svg, list, keep) {
  let out = ""
  let at = 0
  for (const [i, e] of list.entries()) {
    if (keep.has(i)) continue
    out += svg.slice(at, e.start)
    at = e.end
  }
  return out + svg.slice(at)
}

/** "translate(a b) scale(c d)" / "matrix(…)" → [a, b, c, d, e, f]. */
function parseTransform(t) {
  let m = [1, 0, 0, 1, 0, 0]
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]
  for (const [, fn, args] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = args.split(/[\s,]+/).filter(Boolean).map(Number)
    if (fn === "matrix") m = mul(m, n)
    else if (fn === "translate") m = mul(m, [1, 0, 0, 1, n[0], n[1] ?? 0])
    else if (fn === "scale") m = mul(m, [n[0], 0, 0, n[1] ?? n[0], 0, 0])
  }
  return m.map((v) => +v.toFixed(9))
}

/** The embedded picture an element is filled with. */
function pictureOf(svg, el) {
  const pid = /url\(#(pattern[^)]+)\)/.exec(el)?.[1]
  if (!pid) return null
  const use = new RegExp(`<pattern id="${pid}"[^>]*>\\s*<use([^>]*)/>`).exec(svg)[1]
  const imageId = /xlink:href="#([^"]+)"/.exec(use)[1]
  const image = new RegExp(`<image id="${imageId}" width="(\\d+)" height="(\\d+)"[^>]*xlink:href="data:image/(\\w+);base64,([^"]+)"`).exec(svg)
  return { width: +image[1], height: +image[2], base64: image[4], matrix: parseTransform(/transform="([^"]+)"/.exec(use)?.[1] ?? "") }
}

/** Center, unrotated size and tilt (degrees) of the paddle or ball, from its tilted rectangle (like Figma's layer). */
function placement(el) {
  const d = / d="([^"]+)"/.exec(el)[1]
  const n = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g).map(Number)
  const p = [0, 1, 2, 3].map((i) => [n[i * 2], n[i * 2 + 1]])
  const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1]]
  const e2 = [p[2][0] - p[1][0], p[2][1] - p[1][1]]
  let [wide, tall] = Math.abs(e1[0]) >= Math.abs(e1[1]) ? [e1, e2] : [e2, e1]
  if (wide[0] < 0) wide = [-wide[0], -wide[1]]
  const r = (v) => +v.toFixed(2)
  return {
    cx: r((p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4),
    cy: r((p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4),
    w: r(Math.hypot(...wide)),
    h: r(Math.hypot(...tall)),
    angle: r((Math.atan2(wide[1], wide[0]) * 180) / Math.PI),
  }
}

/** The shape a photo fills (as a path) and its box: the photo covers the box, clipped to the shape. */
async function photoShape(el) {
  const d = / d="([^"]+)"/.exec(el)?.[1]
  if (!d) {
    const num = (k) => Number(new RegExp(` ${k}="([\\d.-]+)"`).exec(el)?.[1] ?? 0)
    const [x, y, w, h] = [num("x"), num("y"), num("width"), num("height")]
    return { d: `M${x} ${y}H${x + w}V${y + h}H${x}Z`, box: [x, y, w, h] }
  }
  const test = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg"><rect width="${SIZE}" height="${SIZE}" fill="white"/><path d="${d}" fill="black"/></svg>`
  const { info } = await sharp(Buffer.from(test)).trim({ background: "#ffffff", threshold: 10 }).toBuffer({ resolveWithObject: true })
  const box = [-info.trimOffsetLeft, -info.trimOffsetTop, info.width, info.height]
  return { d, box, ...turnOf(d, box) }
}

/**
 * A tilted (rounded) rectangle frame: its first straight edge gives the tilt; size from its box.
 * The photo then turns with the frame (the SVG export would leave it straight).
 */
function turnOf(d, [x, y, bw, bh]) {
  const m = /^M\s*(-?[\d.]+)[ ,](-?[\d.]+)\s*L\s*(-?[\d.]+)[ ,](-?[\d.]+)/.exec(d)
  if (!m) return {}
  let [dx, dy] = [m[3] - m[1], m[4] - m[2]]
  if (Math.abs(dx) < Math.abs(dy)) return {}
  if (dx < 0) [dx, dy] = [-dx, -dy]
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (Math.abs(angle) < 0.5 || Math.abs(angle) > 45) return {}
  const t = (angle * Math.PI) / 180
  const [c, s] = [Math.cos(Math.abs(t)), Math.sin(Math.abs(t))]
  const r = (v) => +v.toFixed(2)
  const w = (bw * c - bh * s) / (c * c - s * s)
  const h = (bh * c - bw * s) / (c * c - s * s)
  return { turn: { cx: r(x + bw / 2), cy: r(y + bh / 2), w: r(w), h: r(h), angle: r(angle) } }
}

const opacityOf = (el) => Number(/ opacity="([\d.]+)"/.exec(el)?.[1] ?? /fill-opacity="([\d.]+)"/.exec(el)?.[1] ?? 1)

async function build(t, photos) {
  const svg = fs.readFileSync(path.join(SRC, t.file), "utf8")
  const list = elements(svg)
  const removed = new Set(t.remove)
  const firstText = Math.min(...t.remove)
  const kinds = list.map((e, i) => {
    if (removed.has(i)) return { type: "text" }
    if (i === t.logo) return { type: "logo" }
    const pic = pictureOf(svg, e.el)
    const role = pic ? (t.photo?.includes(i) ? "photo" : roleOf(pic.width, pic.height)) : "static"
    return { type: role, pic }
  })
  const drawn = (k) => k.type === "photo" || k.type === "paddle" || k.type === "ball" || k.type === "logo"

  // The text goes just under the first photo/picture that comes after the sample text (or at the end).
  let textAt = list.findIndex((_, i) => i > firstText && drawn(kinds[i]))
  if (textAt < 0) textAt = list.length

  const steps = []
  let run = []
  let layerNo = 0
  const flush = async () => {
    if (!run.length) return
    const keep = new Set(run)
    run = []
    const first = layerNo === 0
    const name = `${t.id}-${layerNo++}.${first ? "jpg" : "png"}`
    const img = sharp(Buffer.from(only(svg, list, keep)), { limitInputPixels: false })
    if (first) await img.flatten({ background: "#ffffff" }).jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true }).toFile(path.join(OUT, name))
    else await img.png({ compressionLevel: 9 }).toFile(path.join(OUT, name))
    steps.push({ type: "layer", src: name })
  }

  for (let i = 0; i <= list.length; i++) {
    if (i === textAt) {
      await flush()
      steps.push({ type: "text" })
    }
    if (i === list.length) break
    const k = kinds[i]
    if (k.type === "static") run.push(i)
    else if (k.type === "photo") {
      await flush()
      const hash = crypto.createHash("md5").update(k.pic.base64).digest("hex").slice(0, 8)
      const src = `photo-${hash}.jpg`
      if (!photos.has(src)) {
        photos.add(src)
        await sharp(Buffer.from(k.pic.base64, "base64")).flatten({ background: "#000000" }).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(OUT, src))
      }
      steps.push({ type: "photo", src, width: k.pic.width, height: k.pic.height, matrix: k.pic.matrix, opacity: opacityOf(list[i].el), ...(await photoShape(list[i].el)) })
    } else if (k.type === "paddle" || k.type === "ball") {
      await flush()
      steps.push({ type: "picture", name: k.type, ...placement(list[i].el) })
    } else if (k.type === "logo") {
      await flush()
      // The logo's box (straight, or tilted like Now Open 4's card): the logo fits inside it.
      const { box, turn } = await photoShape(list[i].el)
      const place = turn ?? { cx: +(box[0] + box[2] / 2).toFixed(2), cy: +(box[1] + box[3] / 2).toFixed(2), w: box[2], h: box[3], angle: 0 }
      steps.push({ type: "logo", ...place, ...(t.logoShadow ? { shadow: t.logoShadow } : {}) })
    }
  }
  await flush()
  return steps
}

/** The paddle, ball and sample court logo pictures (the biggest copies) for the app. */
async function savePictures() {
  const best = {}
  for (const t of TEMPLATES) {
    const svg = fs.readFileSync(path.join(SRC, t.file), "utf8")
    for (const [i, e] of elements(svg).entries()) {
      const pic = pictureOf(svg, e.el)
      if (!pic) continue
      const role = i === t.logo ? "court-logo" : roleOf(pic.width, pic.height)
      // The court logo: the first template's copy (Now Open 3's bigger copy has extra transparent margins).
      if (role === "court-logo") best[role] ??= pic
      else if ((role === "paddle" || role === "ball") && (!best[role] || pic.width > best[role].width)) best[role] = pic
    }
  }
  for (const [role, pic] of Object.entries(best)) await sharp(Buffer.from(pic.base64, "base64")).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${role}.png`))
}

;(async () => {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  await savePictures()
  const photos = new Set()
  const manifest = { size: SIZE, pictures: { paddle: "paddle.png", ball: "ball.png", courtLogo: "court-logo.png" }, templates: {} }
  for (const t of TEMPLATES) {
    manifest.templates[t.id] = await build(t, photos)
    console.log(`${t.id}: ${manifest.templates[t.id].map((s) => (s.type === "picture" ? s.name : s.type)).join(" → ")}`)
    // Only the sample texts' paths are left out: every other element is in a layer or drawn by the app.
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1))
})()
