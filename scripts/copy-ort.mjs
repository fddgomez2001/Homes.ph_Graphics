// Copies ONNX Runtime Web (the library that runs the photo enhancer's AI model) into
// public/ort/, where the enhancer's worker loads it. Runs before `next dev` and `next build`
// (predev / prebuild), so the files always match the installed version. public/ort/ is
// not committed.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const from = path.join(root, "node_modules", "onnxruntime-web", "dist")
const to = path.join(root, "public", "ort")
// The WebGPU build: it runs on the graphics card when the PC has WebGPU, else on the processor (WASM).
const FILES = ["ort.webgpu.min.js", "ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"]

if (!fs.existsSync(from)) {
  console.warn("onnxruntime-web isn't installed (npm install): the photo enhancer won't work.")
  process.exit(0)
}
fs.mkdirSync(to, { recursive: true })
let copied = 0
for (const name of FILES) {
  const src = path.join(from, name)
  const dest = path.join(to, name)
  const a = fs.statSync(src)
  const b = fs.existsSync(dest) ? fs.statSync(dest) : null
  if (b && b.size === a.size && b.mtimeMs >= a.mtimeMs) continue
  fs.copyFileSync(src, dest)
  copied++
}
const { version } = JSON.parse(fs.readFileSync(path.join(root, "node_modules", "onnxruntime-web", "package.json"), "utf8"))
fs.writeFileSync(path.join(to, "VERSION"), `${version}\n`)
if (copied) console.log(`› Photo enhancer: copied ONNX Runtime Web ${version} to public/ort/`)
