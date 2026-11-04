// Starts the bundled Next.js server with Node's on-disk compile cache, so the
// second and later launches skip re-compiling the server's JavaScript.
const nodeModule = require("node:module")

const [serverFile, cacheDir] = process.argv.slice(2)
try {
  if (cacheDir && typeof nodeModule.enableCompileCache === "function") nodeModule.enableCompileCache(cacheDir)
} catch {
  // cache is an optimisation only
}
require(serverFile)
