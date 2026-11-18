/**
 * The brand post templates (1.52): copies the team's generator SVGs (public/ALL-BRAND-TEMPLATES/<brand>/<kind>/
 * "FOR GENERATOR (do not drag into Figma)") to public/brand/templates/<brand>/<kind>-<NN>-<name>.svg, and the fonts
 * they use to public/brand/templates/fonts (the app embeds them in the pictures it makes, so nothing comes from the
 * internet). The SVGs are kept as they are, except:
 *   - their Google Fonts @import is taken out (the app has the fonts),
 *   - Bayanihan's logo is the sharp one (public/Bayanihan.png) instead of the small one inside the files.
 *
 * Run: node scripts/build-brand-templates.cjs
 */
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const ROOT = path.join(__dirname, "..")
const SRC = path.join(ROOT, "public", "ALL-BRAND-TEMPLATES")
const OUT = path.join(ROOT, "public", "brand", "templates")
const GEN = "FOR GENERATOR (do not drag into Figma)"

const BRANDS = [
  { id: "homes", dir: "Homes.ph", prefix: "homesph" },
  { id: "fhi", dir: "FHI Global", prefix: "fhi" },
  { id: "pickleplay", dir: "PicklePlay", prefix: "pickleplay" },
  { id: "bayanihan", dir: "Bayanihan.com", prefix: "bayanihan" },
]

const KINDS = [
  { id: "news", dir: "1 - News Posters (1080x1350)", re: /-template-(\d\d)-(.+)\.svg$/ },
  { id: "dyk", dir: "2 - Did You Know Posts (1126x1408)", re: /-post-template-(\d\d)-(.+)\.svg$/ },
  { id: "eng", dir: "3 - Engagement Posts (1126x1408)", re: /-post-template-(\d\d)-(.+)\.svg$/ },
]

/** family → { package, weights } (latin and latin-ext of each). */
const FONTS = {
  Montserrat: { pkg: "montserrat", weights: [600, 700, 800, 900] },
  Quicksand: { pkg: "quicksand", weights: [500] },
  Outfit: { pkg: "outfit", weights: [600, 700] },
  "League Spartan": { pkg: "league-spartan", weights: [700] },
  Poppins: { pkg: "poppins", weights: [400, 500, 600, 700, 800] },
  "Plus Jakarta Sans": { pkg: "plus-jakarta-sans", weights: [400, 500, 600, 700, 800] },
}
const SUBSETS = ["latin", "latin-ext"]

const decode = (t) =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m ? m[1] : null
}

/** The text of a <text> element, highlighted parts as *…* (its lines joined with spaces). */
function textOf(svg, open) {
  const at = svg.indexOf(open)
  if (at < 0) return null
  const start = svg.indexOf(">", at) + 1
  const end = svg.indexOf("</text>", start)
  let inner = svg.slice(start, end)
  inner = inner.replace(/<tspan[^>]*class="hl"[^>]*>([^<]*)<\/tspan>/g, (_, t) => {
    const lead = /^\s*/.exec(t)[0]
    return `${lead}*${t.trim()}*`
  })
  // Line starts (tspans with a y) become breaks; then every other tag goes.
  inner = inner.replace(/<tspan[^>]*\sy="[^"]*"[^>]*>/g, "\u0001").replace(/<[^>]+>/g, "")
  return inner
    .split("\u0001")
    .map((l) => decode(l).trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\*\s+\*/g, " ")
}

/** The ids of the SVG's top-level parts (not defs / style), bottom to top. */
function rootLayers(svg) {
  const body = svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>"))
  const ids = []
  let depth = 0
  const re = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g
  let m
  while ((m = re.exec(body))) {
    if (m[1]) {
      depth--
      continue
    }
    if (depth === 0 && m[2] !== "defs" && m[2] !== "style") {
      const id = /\sid="([^"]+)"/.exec(m[3])
      if (!id) throw new Error("A top-level part without an id")
      ids.push(id[1])
    }
    if (!m[4]) depth++
  }
  return ids
}

/** Size, photo box (news posters) and sample texts (Did You Know / engagement posts) of a template. */
function describe(svg, kind) {
  const root = /<svg[^>]*>/.exec(svg)[0]
  const [, , width, height] = attr(root, "viewBox").split(/\s+/).map(Number)
  // Its layers (1.54): the top-level groups, bottom to top, as the editor shows them.
  const info = { width, height, layers: rootLayers(svg) }
  if (kind === "news") {
    const tag = /<image id="photo" [^>]*>/.exec(svg)[0].replace(/\s(xlink:)?href="[^"]*"/g, "")
    const border = /<rect id="frame-border"[^>]*>/.exec(svg)
    info.photo = {
      x: Number(attr(tag, "x")),
      y: Number(attr(tag, "y")),
      width: Number(attr(tag, "width")),
      height: Number(attr(tag, "height")),
      fit: /meet/.test(attr(tag, "preserveAspectRatio") || "") ? "contain" : "cover",
      radius: border ? Number(attr(border[0], "rx") || 0) : 0,
    }
    info.headline = {
      maxLines: Number(attr(/<text id="headline"[^>]*>/.exec(svg)[0], "data-max-lines") || 0) || null,
      singleLine: /<text id="headline"[^>]*data-single-line="true"/.test(svg),
    }
    info.subtext = /<text id="subtext"/.test(svg)
    info.tag = /<g id="tag"/.test(svg) ? textOf(svg, '<text id="tag-text"') : null
    info.credit = textOf(svg, '<text id="photo-credit"')
    return info
  }
  const layout = attr(/<g id="photo-area"[^>]*>/.exec(svg)[0], "data-layout")
  const many = (re) => [...svg.matchAll(re)].map((m) => textOf(svg.slice(m.index), m[0]))
  const sample = {}
  for (const field of ["title", "subtitle", "question"]) {
    // By its field (Did You Know's body text is the subtitle).
    const m = new RegExp(`<text[^>]*data-field="${field}"[^>]*>`).exec(svg)
    if (m) sample[field] = textOf(svg.slice(m.index), m[0])
  }
  const kicker = textOf(svg, '<text id="kicker-text"')
  if (kicker !== null) sample.kicker = kicker
  const cta = /<g id="cta"[^>]*>[\s\S]*?<text[^>]*>([^<]*)<\/text>/.exec(svg)
  if (cta) sample.cta = decode(cta[1]).trim()
  const labels = [...svg.matchAll(/<g id="label-\d"[^>]*>[\s\S]*?<text[^>]*>([^<]*)<\/text>/g)].map((m) => decode(m[1]).trim())
  if (labels.length) sample.labels = labels
  const options = many(/<text class="option-text"[^>]*>/g)
  if (options.length) sample.options = options
  const facts = many(/<text class="fact-text"[^>]*>/g)
  if (facts.length) sample.facts = facts
  const photos = new Set([...svg.matchAll(/data-photo="(\d)"/g)].map((m) => Number(m[1]))).size
  return { ...info, layout, photos, background: /data-photo="background"/.test(svg), badge: /<image id="badge"/.test(svg), sample }
}

async function main() {
  // Emptied (not removed: the folder may be open somewhere).
  if (fs.existsSync(OUT)) for (const e of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, e), { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, "fonts"), { recursive: true })

  // Bayanihan's logo: the sharp one, at twice the size it's drawn (355 × 89 on the posters).
  const bayanihanLogo = await sharp(path.join(ROOT, "public", "Bayanihan.png")).resize({ width: 720 }).webp({ quality: 92, alphaQuality: 100 }).toBuffer()
  const logoHref = `data:image/webp;base64,${bayanihanLogo.toString("base64")}`

  const list = []
  /** What the app needs to know of each template before loading it: size, photo box, sample texts. */
  const manifest = {}
  for (const brand of BRANDS) {
    fs.mkdirSync(path.join(OUT, brand.id), { recursive: true })
    for (const kind of KINDS) {
      const dir = path.join(SRC, brand.dir, kind.dir, GEN)
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
        const m = kind.re.exec(file)
        if (!m) throw new Error(`Unexpected file name: ${file}`)
        let svg = fs.readFileSync(path.join(dir, file), "utf8")
        const before = svg.length
        svg = svg.replace(/@import url\([^)]*\);?\s*/g, "")
        if (brand.id === "bayanihan") {
          const logo = /(<image id="brand-logo"[^>]*?)href="data:image\/png;base64,[A-Za-z0-9+/=]+"([^>]*?)xlink:href="data:image\/png;base64,[A-Za-z0-9+/=]+"/
          if (!logo.test(svg)) throw new Error(`No Bayanihan logo in ${file}`)
          svg = svg.replace(logo, (_, a, b) => `${a}href="${logoHref}"${b}xlink:href="${logoHref}"`)
        }
        const name = `${kind.id}-${m[1]}-${m[2]}.svg`
        fs.writeFileSync(path.join(OUT, brand.id, name), svg)
        list.push(`${brand.id}/${name}`)
        manifest[`${brand.id}/${name.replace(/.svg$/, "")}`] = describe(svg, kind.id)
        if (svg.length === before && brand.id !== "bayanihan") console.warn(`  (no @import in ${file})`)
      }
    }
  }

  // Fonts: the latin and latin-ext files of every weight used, with their unicode ranges.
  const fonts = []
  for (const [family, { pkg, weights }] of Object.entries(FONTS)) {
    const base = path.join(ROOT, "node_modules", "@fontsource", pkg)
    for (const weight of weights) {
      const css = fs.readFileSync(path.join(base, `${weight}.css`), "utf8")
      for (const subset of SUBSETS) {
        const file = `${pkg}-${subset}-${weight}-normal.woff2`
        const block = css.split("@font-face").find((b) => b.includes(`/${file}`))
        const range = block && /unicode-range:\s*([^;]+);/.exec(block)
        if (!range) throw new Error(`No ${subset} range for ${family} ${weight}`)
        fs.copyFileSync(path.join(base, "files", file), path.join(OUT, "fonts", file))
        fonts.push({ family, weight, file, unicodeRange: range[1].trim() })
      }
    }
  }
  fs.writeFileSync(path.join(OUT, "fonts", "fonts.json"), JSON.stringify(fonts, null, 1))
  fs.writeFileSync(
    path.join(ROOT, "src", "lib", "brand-templates", "manifest.ts"),
    `// Made by scripts/build-brand-templates.cjs from public/ALL-BRAND-TEMPLATES (do not edit).
import type { TemplateInfo } from "./types"

export const TEMPLATE_MANIFEST: Record<string, TemplateInfo> = ${JSON.stringify(manifest, null, 1)}

export const TEMPLATE_FONTS: { family: string; weight: number; file: string; unicodeRange: string }[] = ${JSON.stringify(fonts)}
`,
  )

  const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0)
  console.log(`${list.length} templates, ${fonts.length} font files, ${(size(OUT) / 1e6).toFixed(1)} MB in public/brand/templates`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
