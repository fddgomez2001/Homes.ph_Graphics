/**
 * The Poster Maker's template gallery pictures (1.52): every brand post template drawn by the app's own engine with
 * sample texts (PNGs named thumb-<brand>-<kind>-<NN>.png in the folder given), saved as small JPEGs in
 * public/brand/template-thumbs/<brand>/<template>.jpg.
 *
 * Run: node scripts/save-brand-template-thumbs.cjs <folder with the PNGs>
 */
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const ROOT = path.join(__dirname, "..")
const OUT = path.join(ROOT, "public", "brand", "template-thumbs")
const PREFIX = { news: "news", dyk: "dyk", engagement: "eng" }

async function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error("Give the folder with the PNGs")
  const files = Object.fromEntries(
    fs
      .readdirSync(path.join(ROOT, "public", "brand", "templates"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "fonts")
      .flatMap((e) => fs.readdirSync(path.join(ROOT, "public", "brand", "templates", e.name)).map((f) => [`${e.name}/${f.split("-").slice(0, 2).join("-")}`, `${e.name}/${f.replace(/\.svg$/, "")}`])),
  )
  let n = 0
  for (const png of fs.readdirSync(dir).filter((f) => /^thumb-.+\.png$/.test(f))) {
    const [, brand, kind, num] = /^thumb-([a-z]+)-([a-z]+)-(\d\d)\.png$/.exec(png)
    const file = files[`${brand}/${PREFIX[kind]}-${num}`]
    if (!file) throw new Error(`No template for ${png}`)
    fs.mkdirSync(path.join(OUT, brand), { recursive: true })
    await sharp(path.join(dir, png)).resize({ width: 216 }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, `${file}.jpg`))
    n++
  }
  console.log(`${n} thumbnails in public/brand/template-thumbs`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
