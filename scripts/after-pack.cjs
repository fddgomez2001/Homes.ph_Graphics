// electron-builder afterPack hook: copies the complete standalone Next.js server
// (including its node_modules, which extraResources always skips) into resources/server.
const fs = require("node:fs")
const path = require("node:path")

exports.default = async function afterPack(context) {
  const source = path.join(context.packager.projectDir, ".next", "standalone")
  const target = path.join(context.appOutDir, "resources", "server")
  if (!fs.existsSync(path.join(source, "server.js"))) {
    throw new Error("Missing .next/standalone — run `node scripts/build-desktop.mjs` first.")
  }
  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true })
  if (!fs.existsSync(path.join(target, "node_modules", "next"))) throw new Error("Server dependencies were not copied.")
  console.log(`  • copied server  to=${path.relative(context.packager.projectDir, target)}`)
}
