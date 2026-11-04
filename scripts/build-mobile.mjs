// Builds the Android app (APK).
//   1. next build with MOBILE_BUILD=1: a static export of the *.mobile.tsx page into out/
//   2. checks that no server secret ended up in it (only NEXT_PUBLIC_* values belong there)
//   3. npx cap sync android: copies out/ and the plugins into the Android project
//   4. with --apk: gradlew assembleRelease, signed with android/release-key (never committed),
//      copied to dist/Homes.ph-Carousels-<version>.apk
//
// Needs JDK 21 and the Android SDK: JAVA_HOME and ANDROID_HOME, or E:\AndroidBuild\{jdk,sdk}.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const out = path.join(root, "out")
const android = path.join(root, "android")
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const wantApk = process.argv.includes("--apk")

const TOOLS = "E:\\AndroidBuild"
const toolEnv = {
  JAVA_HOME: process.env.JAVA_HOME || path.join(TOOLS, "jdk"),
  ANDROID_HOME: process.env.ANDROID_HOME || path.join(TOOLS, "sdk"),
  ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.join(TOOLS, "sdk"),
  // Gradle and Android caches are large: keep them next to the tools when those are on E:.
  ...(process.env.JAVA_HOME ? {} : { GRADLE_USER_HOME: path.join(TOOLS, "gradle-home"), ANDROID_USER_HOME: path.join(TOOLS, "android-home") }),
}

function run(command, args, { cwd = root, env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function parseEnv(file) {
  if (!fs.existsSync(file)) return {}
  const values = {}
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2")
  }
  return values
}

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* files(full)
    else yield full
  }
}

console.log("› Building the app pages (static export)…")
fs.rmSync(out, { recursive: true, force: true })
run("npx", ["next", "build"], { env: { MOBILE_BUILD: "1" } })
if (!fs.existsSync(path.join(out, "index.html"))) {
  console.error("The static export is missing (out/index.html).")
  process.exit(1)
}
// That build wrote route types for its one page into .next/types: put back the full app's.
run("npx", ["next", "typegen"])

console.log("› Checking for secrets…")
const env = { ...parseEnv(path.join(root, ".env")), ...parseEnv(path.join(root, ".env.local")) }
const secrets = Object.entries(env).filter(([key, value]) => !key.startsWith("NEXT_PUBLIC_") && value.length >= 12)
for (const file of files(out)) {
  if (!/\.(html|js|txt|json|css|map)$/.test(file)) continue
  const text = fs.readFileSync(file, "utf8")
  const leaked = secrets.filter(([, value]) => text.includes(value)).map(([key]) => key)
  if (leaked.length) {
    console.error(`  ! ${path.relative(root, file)} contains ${leaked.join(", ")} — stopping.`)
    process.exit(1)
  }
}

console.log("› Copying into the Android project…")
if (!fs.existsSync(android)) run("npx", ["cap", "add", "android"])
run("npx", ["cap", "sync", "android"])
// Capacitor can report success after a failed copy (e.g. a locked folder): make sure the app has this build.
const copied = path.join(android, "app", "src", "main", "assets", "public", "index.html")
if (!fs.existsSync(copied) || fs.readFileSync(copied, "utf8") !== fs.readFileSync(path.join(out, "index.html"), "utf8")) {
  console.error("  ! The Android project doesn't have this build's pages (copy failed). Close anything using android/app/src/main/assets and try again.")
  process.exit(1)
}

if (wantApk) {
  if (!fs.existsSync(path.join(android, "release-key", "keystore.properties"))) {
    console.error("  ! android/release-key/keystore.properties is missing (see README → Android app).")
    process.exit(1)
  }
  console.log("› Building the APK…")
  const gradlew = path.join(android, process.platform === "win32" ? "gradlew.bat" : "gradlew")
  run(`"${gradlew}"`, ["assembleRelease", "--no-daemon"], { cwd: android, env: toolEnv })
  const apk = path.join(android, "app", "build", "outputs", "apk", "release", "app-release.apk")
  const target = path.join(root, "dist", `Homes.ph-Carousels-${version}.apk`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(apk, target)
  console.log(`✓ ${path.relative(root, target)} (${(fs.statSync(target).size / 1048576).toFixed(1)} MB)`)
}
