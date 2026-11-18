/**
 * Turns the Figma cover templates in public/brand/carousel/Carousel Cover Templates into what the
 * app uses for the cover photo collage:
 *   - src/lib/design/cover-collage-data.ts   the photo slots of each template (shape, box, color)
 *   - public/brand/carousel/collage/lines-N.svg      the glowing lines drawn over the photos (if any)
 *   - public/brand/carousel/collage/template-N.jpg   a small preview for the template picker
 *
 * Run after changing a template:  node scripts/build-cover-collages.cjs
 * The big source SVGs stay out of the installer (see build-desktop.mjs).
 */
const fs = require("node:fs")
const path = require("node:path")
const sharp = require("sharp")

const root = path.join(__dirname, "..")
const SOURCES = path.join(root, "public", "brand", "carousel", "Carousel Cover Templates")
const OUT = path.join(root, "public", "brand", "carousel", "collage")
const DATA = path.join(root, "src", "lib", "design", "cover-collage-data.ts")
const SIZE = 1254

/** What each template is called in the app. */
const NAMES = {
  1: { name: "Template 1", description: "Soft shapes around a big center photo." },
  2: { name: "Template 2", description: "Swirl of six photos with a warm glow." },
  3: { name: "Template 3", description: "Pinwheel of six photos with a blue glow." },
  4: { name: "Template 4", description: "Pinwheel of six photos with an orange glow." },
  5: { name: "Template 5", description: "Six overlapping soft shapes." },
}

/**
 * Templates whose first photo is the layer under all the shapes (no shape of its own): the part of
 * the canvas it shows in. Its photo is fitted to this box.
 */
const BASE_SLOT = {
  1: { x: 0, y: 0, width: 568, height: 633 },
  5: { x: 0, y: 390, width: 1254, height: 864 },
}

/** Colors for slots the template leaves without one (shown while a slot has no photo). */
const PALETTE = ["#7A9E7E", "#C17C74", "#D9A441", "#6C5B7B", "#4FA3A5", "#3E7CB1"]

const round = (v) => Math.round(v * 100) / 100
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]

function parse(n) {
  const svg = fs.readFileSync(path.join(SOURCES, `Template ${n}.svg`), "utf8")
  const background = /<path d="[^"]*" fill="(#[0-9A-Fa-f]{6})"\/>/.exec(svg)?.[1] ?? "#120D08"
  const slots = []
  if (BASE_SLOT[n]) {
    const b = BASE_SLOT[n]
    slots.push({ path: `M0 0H${SIZE}V${SIZE}H0Z`, box: b, color: background, base: true })
  }
  const maskRe = /<mask id="([^"]+)"[^>]*>\s*<path d="([^"]+)" fill="white"\/>\s*<\/mask>\s*<g mask="url\(#[^)]+\)">\s*(<path d="[^"]*" fill="(#[0-9A-Fa-f]{6})"\/>)?/g
  let m
  while ((m = maskRe.exec(svg))) {
    const tag = m[0].slice(0, m[0].indexOf(">") + 1)
    const x = Number(attr(tag, "x"))
    const y = Number(attr(tag, "y"))
    const w = Number(attr(tag, "width"))
    const h = Number(attr(tag, "height"))
    // The part of the shape that is on the canvas: the photo is fitted to it.
    const x0 = Math.max(0, x)
    const y0 = Math.max(0, y)
    const x1 = Math.min(SIZE, x + w)
    const y1 = Math.min(SIZE, y + h)
    slots.push({ path: m[2], box: { x: round(x0), y: round(y0), width: round(x1 - x0), height: round(y1 - y0) }, color: m[4] ?? null })
  }
  slots.forEach((s, i) => {
    if (!s.color) s.color = PALETTE.find((c) => !slots.some((o) => o.color === c)) ?? PALETTE[i % PALETTE.length]
  })
  // The glowing lines over the photos: the group masked by the radial vignette, with its filters.
  let lines = null
  const vignette = /<mask id="([^"]+)"[^>]*>\s*<path d="[^"]+" fill="url\(#[^)]+\)"\/>\s*<\/mask>/.exec(svg)
  if (vignette) {
    const start = svg.indexOf(`<g mask="url(#${vignette[1]})">`)
    const end = closingGroup(svg, start)
    const defs = [...svg.matchAll(/<(filter|radialGradient|linearGradient) [\s\S]*?<\/\1>/g)].map((d) => d[0]).join("\n")
    lines = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${vignette[0]}\n${svg.slice(start, end)}\n<defs>\n${defs}\n</defs>\n</svg>`
  }
  return { n, svg, background, slots, lines }
}

/** Index just past the </g> that closes the <g> starting at `start`. */
function closingGroup(svg, start) {
  let depth = 0
  const re = /<g[\s>]|<\/g>/g
  re.lastIndex = start
  let m
  while ((m = re.exec(svg))) {
    depth += m[0] === "</g>" ? -1 : 1
    if (depth === 0) return m.index + 4
  }
  throw new Error("unclosed <g>")
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const layouts = []
  for (const n of [1, 2, 3, 4, 5]) {
    const t = parse(n)
    if (t.slots.length !== 6) throw new Error(`Template ${n}: expected 6 photo slots, found ${t.slots.length}`)
    // Kept as SVG: the app draws it with the browser, so the glow looks as it does in Figma at any size.
    if (t.lines) fs.writeFileSync(path.join(OUT, `lines-${n}.svg`), t.lines)
    await sharp(Buffer.from(t.svg), { unlimited: true, density: 72 }).resize(360, 360).flatten({ background: t.background }).jpeg({ quality: 82 }).toFile(path.join(OUT, `template-${n}.jpg`))
    layouts.push({
      id: `collage-${n}`,
      ...NAMES[n],
      preview: `/brand/carousel/collage/template-${n}.jpg`,
      lines: t.lines ? `/brand/carousel/collage/lines-${n}.svg` : null,
      slots: t.slots.map(({ path: p, box, color, base }) => ({ path: p, box, color, ...(base ? { base: true } : {}) })),
    })
    console.log(`Template ${n}: ${t.slots.length} slots${t.lines ? ", glow lines" : ""}`)
  }
  const body = `// Generated by scripts/build-cover-collages.cjs from public/brand/carousel/Carousel Cover Templates. Do not edit by hand.
import type { CollageLayout } from "./cover-collage"

export const COLLAGE_LAYOUTS: CollageLayout[] = ${JSON.stringify(layouts, null, 2)}
`
  fs.writeFileSync(DATA, body)
  console.log("wrote", path.relative(root, DATA))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
