// Publishes the newest Windows installer on the website (/graphicdesktopapp).
//
//   npm run desktop:publish                      uploads dist/Homes.ph-SocMedSystem-Setup-<version>.exe
//   npm run desktop:publish -- --notes "…"       with a "What's new" text
//   npm run desktop:publish -- --keep 5          keep the 5 newest versions (default 3)
//
// The file goes to the website's PRIVATE Vercel Blob store: the installer carries the
// team's Cloudinary and Groq keys, so it is never public. Signed-in people download it
// through the website, which hands out a link that works for 15 minutes.
// Needs the store's read-write token, BLOB_READ_WRITE_TOKEN (Vercel → Storage → the Blob store), in
// .env.local or the environment.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { del, list, put } from "@vercel/blob"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function envFromFile(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2")
  }
  return out
}

const env = { ...envFromFile(path.join(root, ".env.local")), ...process.env }
/** BLOB_<name>, or <PREFIX>_<name> when the store was connected with its own prefix. */
function blobEnv(name) {
  const standard = env[`BLOB_${name}`]?.trim()
  if (standard) return standard
  const pattern = new RegExp(`^BLOB\\w*_${name}$`)
  for (const [key, value] of Object.entries(env)) if (pattern.test(key) && value?.trim()) return value.trim()
  return undefined
}
// This PC uploads with the store's read-write token; or, after `vercel env pull`, with
// Vercel's sign-in token (VERCEL_OIDC_TOKEN, valid 12 hours) and the store id.
const token = blobEnv("READ_WRITE_TOKEN")
const storeId = blobEnv("STORE_ID")
const oidcToken = env.VERCEL_OIDC_TOKEN?.trim()
const auth = token ? { token } : storeId && oidcToken ? { storeId, oidcToken } : null
if (!auth) {
  console.error(
    storeId
      ? "Found the Blob store id but no read-write token. Uploading from this PC needs the store's read-write token (vercel_blob_rw_…): copy it from Vercel (the Blob store's page, or the project's Environment Variables) into .env.local as BLOB_READ_WRITE_TOKEN=…"
      : "No Blob store found. Create a private Blob store in Vercel (Storage), connect it to the project, and copy its read-write token into .env.local as BLOB_READ_WRITE_TOKEN=…",
  )
  process.exit(1)
}

const name = `Homes.ph-SocMedSystem-Setup-${version}.exe`
const file = path.join(root, "dist", name)
if (!fs.existsSync(file)) {
  console.error(`${path.relative(root, file)} doesn't exist. Build it first: npm run desktop:dist`)
  process.exit(1)
}

const size = fs.statSync(file).size
const pathname = `desktop/${name}`
console.log(`Uploading ${name} (${(size / 1024 / 1024).toFixed(0)} MB)…`)
let shown = -1
const blob = await put(pathname, fs.createReadStream(file), {
  access: "private",
  addRandomSuffix: false,
  allowOverwrite: true,
  multipart: true,
  contentType: "application/octet-stream",
  ...auth,
  onUploadProgress: ({ percentage }) => {
    const step = Math.floor(percentage / 10) * 10
    if (step !== shown) {
      shown = step
      console.log(`  ${step}%`)
    }
  },
})

const notes = arg("--notes")
if (notes?.trim()) {
  await put(pathname.replace(/\.exe$/, ".txt"), notes.trim(), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain; charset=utf-8", ...auth })
}

// Keep the newest few versions (Blob storage is limited).
const keep = Math.max(1, Number(arg("--keep") ?? 3))
const versionOf = (p) => (/Setup-(\d+)\.(\d+)\.(\d+)\.exe$/.exec(p)?.slice(1, 4) ?? [0, 0, 0]).map(Number)
const { blobs } = await list({ prefix: "desktop/", limit: 1000, ...auth })
const installers = blobs
  .filter((b) => /\.exe$/.test(b.pathname))
  .sort((a, b) => {
    const [x, y] = [versionOf(a.pathname), versionOf(b.pathname)]
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]
    return 0
  })
const old = installers.slice(keep)
if (old.length) {
  const txt = new Set(old.map((b) => b.pathname.replace(/\.exe$/, ".txt")))
  await del([...old.map((b) => b.url), ...blobs.filter((b) => txt.has(b.pathname)).map((b) => b.url)], auth)
  console.log(`Removed ${old.length} older version${old.length === 1 ? "" : "s"}.`)
}

console.log(`Published ${version}: ${blob.pathname}`)
console.log("Download page: https://homes-ph-graphics.vercel.app/graphicdesktopapp")
