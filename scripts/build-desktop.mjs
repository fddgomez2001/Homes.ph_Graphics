// Builds the self-contained server used by the Windows desktop app.
//   1. next build (standalone output)
//   2. copy static assets + public/ next to the standalone server
//   3. write desktop-build/app.env (server-only Cloudinary + Groq settings) to seed the app's local config
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
fs.rmSync(standalone, { recursive: true, force: true })
run("npx", ["next", "build"], { DESKTOP_BUILD: "1" })
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Standalone build output is missing (.next/standalone/server.js).")
  process.exit(1)
}

console.log("› Copying static files…")
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true })
fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true })

// Configuration is passed to the server by the desktop app at runtime; never ship .env files.
for (const name of fs.readdirSync(standalone)) {
  if (name.startsWith(".env")) fs.rmSync(path.join(standalone, name), { force: true })
}

console.log("› Preparing desktop settings…")
const env = { ...parseEnv(path.join(root, ".env")), ...parseEnv(path.join(root, ".env.local")) }
const keys = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_UPLOAD_PRESET", "CLOUDINARY_FOLDER", "GROQ_API_KEY", "GROQ_MODEL"]
fs.mkdirSync(path.join(root, "desktop-build"), { recursive: true })
fs.writeFileSync(
  path.join(root, "desktop-build", "app.env"),
  keys.map((k) => `${k}=${env[k] ?? ""}`).join("\n") + "\n",
)
if (!env.CLOUDINARY_CLOUD_NAME) {
  console.warn("  ! CLOUDINARY_CLOUD_NAME is empty — enter it later in the app under Settings → Desktop app connection.")
}

fs.copyFileSync(path.join(root, "build", "icon.png"), path.join(root, "electron", "icon.png"))
console.log("✓ Desktop server ready in .next/standalone")
