// Builds the self-contained server used by the Windows desktop app.
//   1. next build (standalone output)
//   2. copy static assets + public/ next to the standalone server
//   3. write desktop-build/app.env (non-secret defaults only: no API keys are shipped)
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const standalone = path.join(root, ".next", "standalone")

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function parseEnv(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) out[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2")
  }
  return out
}

console.log("› Building the app (standalone server)…")
// The photo enhancer's runtime goes into public/ort/ (copied with public/ below).
run("node", ["scripts/copy-ort.mjs"])
fs.rmSync(standalone, { recursive: true, force: true })
run("npx", ["next", "build"], { DESKTOP_BUILD: "1" })
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Standalone build output is missing (.next/standalone/server.js).")
  process.exit(1)
}

console.log("› Copying static files…")
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true })
// "Pickleplay Templates" holds the Figma SVGs (about 80 MB) that scripts/build-ad-templates.cjs
// turns into public/ads; the app only uses public/ads, so the sources stay out of the installer.
const AD_SOURCES = path.join(root, "public", "Pickleplay Templates")
fs.rmSync(path.join(standalone, "public", "Pickleplay Templates"), { recursive: true, force: true })
// Same for the cover collage templates (about 75 MB of Figma SVGs → scripts/build-cover-collages.cjs → public/brand/carousel/collage).
const COLLAGE_SOURCES = path.join(root, "public", "brand", "carousel", "Carousel Cover Templates")
fs.rmSync(path.join(standalone, "public", "brand", "carousel", "Carousel Cover Templates"), { recursive: true, force: true })
// And the brand post templates (1.52): the team's folders (about 17 MB, Figma copies and instructions too) →
// scripts/build-brand-templates.cjs → public/brand/templates.
const BRAND_TEMPLATE_SOURCES = path.join(root, "public", "ALL-BRAND-TEMPLATES")
fs.rmSync(path.join(standalone, "public", "ALL-BRAND-TEMPLATES"), { recursive: true, force: true })
fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
  filter: (src) => !src.startsWith(AD_SOURCES) && !src.startsWith(COLLAGE_SOURCES) && !src.startsWith(BRAND_TEMPLATE_SOURCES),
})

// Configuration is passed to the server by the desktop app at runtime; never ship .env files.
for (const name of fs.readdirSync(standalone)) {
  if (name.startsWith(".env")) fs.rmSync(path.join(standalone, name), { force: true })
}

console.log("› Preparing desktop settings…")
const env = { ...parseEnv(path.join(root, ".env")), ...parseEnv(path.join(root, ".env.local")) }
// No keys are bundled any more (1.35): each install sets up its own AI (Groq, Gemini…) and chooses
// where its work is saved in the welcome setup. Installs that already had settings keep them.
const keys = ["CLOUDINARY_UPLOAD_PRESET", "CLOUDINARY_FOLDER", "GROQ_MODEL"]
fs.mkdirSync(path.join(root, "desktop-build"), { recursive: true })
fs.writeFileSync(
  path.join(root, "desktop-build", "app.env"),
  keys.map((k) => `${k}=${env[k] ?? ""}`).join("\n") + "\n",
)

fs.copyFileSync(path.join(root, "build", "icon.png"), path.join(root, "electron", "icon.png"))
console.log("✓ Desktop server ready in .next/standalone")
