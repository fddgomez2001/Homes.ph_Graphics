/**
 * Builds the background of the new PicklePlay news article (Figma
 * "New_Pickleplay_Article_Template_Styled 1", 1126 × 1408):
 * public/brand/news/pickleplay-background-portrait.png.
 *
 * The art is the PicklePlay background (the same blue gradient, glow, blue and lime
 * swooshes as the 1408 templates) laid out as the Figma CSS has it: everything is
 * 80% as wide (1408 → 1126), the two bottom-left swooshes are moved 151.9 px left
 * and 110 px down, and the faded ball sits at 862, 32 (315 × 311).
 *
 * Run: node scripts/build-news-backgrounds.cjs
 */
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const ROOT = path.join(__dirname, "..")
const OUT = path.join(ROOT, "public", "brand", "news", "pickleplay-background-portrait.png")
const W = 1126
const H = 1408
// The faded ball's opacity (matched to the faded ball on the 1408 news background).
const BALL_OPACITY = 0.45

const ball = fs.readFileSync(path.join(ROOT, "public", "Ball.png")).toString("base64")

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs>
  <linearGradient id="base" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
    <stop stop-color="#0E45D8"/><stop offset="0.55" stop-color="#0B36BE"/><stop offset="1" stop-color="#0929A3"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop stop-color="#3A8DFF" stop-opacity="0.55"/><stop offset="1" stop-color="#3A8DFF" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="limeLeft" x1="0" y1="395" x2="395" y2="100" gradientUnits="userSpaceOnUse">
    <stop stop-color="#B6F23A"/><stop offset="0.55" stop-color="#B6F23A" stop-opacity="0.9"/><stop offset="1" stop-color="#B6F23A" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="limeTop" x1="1050" y1="225" x2="1408" y2="10" gradientUnits="userSpaceOnUse">
    <stop stop-color="#B6F23A" stop-opacity="0"/><stop offset="1" stop-color="#B6F23A"/>
  </linearGradient>
  <linearGradient id="limeBottom" x1="-48" y1="1024" x2="292" y2="1442" gradientUnits="userSpaceOnUse">
    <stop stop-color="#B6F23A" stop-opacity="0.15"/><stop offset="1" stop-color="#B6F23A"/>
  </linearGradient>
  <linearGradient id="blueCorner" x1="1408" y1="930" x2="940" y2="1408" gradientUnits="userSpaceOnUse">
    <stop stop-color="#5AA2FF" stop-opacity="0.7"/><stop offset="1" stop-color="#5AA2FF" stop-opacity="0.05"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<rect width="${W}" height="${H}" fill="url(#base)"/>
<ellipse cx="799.75" cy="200" rx="599.75" ry="550" fill="url(#glow)"/>
<g transform="matrix(0.8 0 0 1 0 0)">
  <path d="M1000 262C1120 152 1260 92 1408 62V122C1270 142 1130 192 1000 262Z" fill="#3B86FF" fill-opacity="0.35"/>
</g>
<g transform="matrix(0.8 0 0 1 -151.9 110)">
  <path d="M-36 934C164 1024 324 1214 384 1442H344C284 1234 134 1064 -36 984V934Z" fill="#3B86FF" fill-opacity="0.25"/>
</g>
<g transform="matrix(0.8 0 0 1 0 0)">
  <path d="M0 395C70 255 210 150 395 100C230 175 100 270 0 345V395Z" fill="url(#limeLeft)"/>
  <path d="M1050 225C1170 130 1290 60 1408 4V18C1295 70 1175 140 1050 225Z" fill="url(#limeTop)"/>
</g>
<g transform="matrix(0.8 0 0 1 -151.9 110)">
  <path d="M-48 1024C92 1104 232 1264 292 1442H257C192 1284 72 1149 -48 1074V1024Z" fill="url(#limeBottom)"/>
</g>
<g transform="matrix(0.8 0 0 1 0 0)">
  <path d="M1408 930C1340 1170 1180 1340 940 1408H1020C1230 1320 1370 1160 1408 1020V930Z" fill="url(#blueCorner)"/>
</g>
<image x="862" y="32" width="315" height="311" opacity="${BALL_OPACITY}" preserveAspectRatio="none" xlink:href="data:image/png;base64,${ball}"/>
</svg>`

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(OUT)
  .then((info) => console.log(`${path.relative(ROOT, OUT)}: ${info.width} × ${info.height}, ${Math.round(info.size / 1024)} KB`))
