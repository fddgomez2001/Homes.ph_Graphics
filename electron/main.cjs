// Homes.ph SocMedSystem (Daily Carousel Maker until 1.50) — Windows desktop app.
// Runs the bundled Next.js server privately on 127.0.0.1 and shows the app in its own window.
const { app, BrowserWindow, Menu, Notification, dialog, ipcMain, nativeTheme, safeStorage, screen, session, shell, utilityProcess } = require("electron")
const crypto = require("node:crypto")
const fs = require("node:fs")
const nodeNet = require("node:net")
const path = require("node:path")
const extensionBridge = require("./extension-bridge.cjs")

const APP_ID = "ph.homes.dailycarouselmaker"
const PORTS = [3939, 3940, 3941, 3942, 3943, 3944]
const CONFIG_KEYS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_UPLOAD_PRESET",
  "CLOUDINARY_FOLDER",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "TAVILY_API_KEY",
]

const root = path.join(__dirname, "..")
const serverDir = app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(root, ".next", "standalone")
const bundledEnv = app.isPackaged ? path.join(process.resourcesPath, "app.env") : path.join(root, "desktop-build", "app.env")
const iconPath = path.join(__dirname, "icon.png")

let userDir
let configFile
let setupFile
let setup = null
let logFile
let config = {}
let serverProcess = null
let port = null
let origin = ""
let mainWindow = null
let splash = null
let floatWindow = null
let checklistWindow = null
let reportWindow = null
let floatEnabled = false
let floatState = null
let quitting = false
let restarting = false
/** The Chrome extension's bridge (127.0.0.1:39390–39394) and its requests waiting for the window's answer. */
let bridge = null
let bridgeWindowReady = false
const bridgeWaiting = new Map()

// 1.50 renamed the app (Daily Carousel Maker → Homes.ph SocMedSystem). Its settings, setup and saved work stay in
// the folder they always had, so nothing is lost on the update.
// (A --user-data-dir given on the command line, e.g. a test copy, is kept.)
if (!app.commandLine.hasSwitch("user-data-dir")) app.setPath("userData", path.join(app.getPath("appData"), "Daily Carousel Maker"))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.setAppUserModelId(APP_ID)
  app.whenReady().then(start)
}

// ---------- configuration (Cloudinary settings live only on this computer) ----------

function parseEnv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    out[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2")
  }
  return out
}

/**
 * Settings come from the installer (bundled from .env.local at build time) and
 * from Settings → Desktop app connection. A newer installer fills in anything
 * empty and applies values that changed since the last build; a change made in
 * the app is kept until a build brings a different value for that setting.
 */
function loadConfig() {
  fs.mkdirSync(path.dirname(configFile), { recursive: true })
  const bundled = fs.existsSync(bundledEnv) ? parseEnv(fs.readFileSync(bundledEnv, "utf8")) : {}
  const exists = fs.existsSync(configFile)
  const values = exists ? parseEnv(fs.readFileSync(configFile, "utf8")) : {}
  const metaFile = path.join(path.dirname(configFile), "config-bundle.json")
  let seen = {}
  try {
    seen = JSON.parse(fs.readFileSync(metaFile, "utf8")).bundled ?? {}
  } catch {
    // first start with this file
  }
  const fingerprint = (v) => crypto.createHash("sha256").update(v).digest("hex")
  let changed = !exists
  const bundledNow = {}
  for (const key of CONFIG_KEYS) {
    const value = bundled[key]?.trim()
    if (!value) continue
    bundledNow[key] = fingerprint(value)
    if ((!values[key] || seen[key] !== bundledNow[key]) && values[key] !== value) {
      values[key] = value
      changed = true
    }
  }
  if (changed) writeConfig(values)
  fs.writeFileSync(metaFile, JSON.stringify({ bundled: bundledNow }), { encoding: "utf8", mode: 0o600 })
  return Object.fromEntries(CONFIG_KEYS.filter((k) => values[k]).map((k) => [k, values[k]]))
}

function writeConfig(values) {
  const lines = [
    "# Homes.ph SocMedSystem — local settings (Cloudinary, Groq AI). Keep this file private.",
    ...CONFIG_KEYS.map((k) => `${k}=${values[k] ?? ""}`),
    "",
  ]
  fs.writeFileSync(configFile, lines.join("\n"), { encoding: "utf8", mode: 0o600 })
}

// ---------- first-run setup (welcome, AI, where the work is saved) ----------
// setup.json: { done, mode: "local" | "account", storage: { kind: "local" | "cloudinary", folder } }.
// A first install starts with the welcome setup and no account (the work is saved on this computer);
// an install that had settings before (a team account) keeps working as it did.

function defaultWorkFolder() {
  return path.join(app.getPath("documents"), "Daily Carousel Maker")
}

function loadSetup(hadConfigBefore) {
  try {
    const raw = JSON.parse(fs.readFileSync(setupFile, "utf8"))
    return {
      done: raw.done === true,
      mode: raw.mode === "account" ? "account" : "local",
      storage: { kind: raw.storage?.kind === "cloudinary" ? "cloudinary" : "local", folder: typeof raw.storage?.folder === "string" && path.isAbsolute(raw.storage.folder) ? raw.storage.folder : defaultWorkFolder() },
      ai: typeof raw.ai === "string" ? raw.ai : "",
      pages: cleanPages(raw.pages),
    }
  } catch {
    const fresh = hadConfigBefore
      ? { done: true, mode: "account", storage: { kind: "cloudinary", folder: defaultWorkFolder() }, ai: "" }
      : { done: false, mode: "local", storage: { kind: "local", folder: defaultWorkFolder() }, ai: "" }
    writeSetup(fresh)
    return fresh
  }
}

// The pages this person is assigned (the welcome setup's Pages step, Settings → Assigned pages):
// { homes: ["caraga", …], sites: ["fhi", …], carousel }. null = not chosen yet (the setup asks once).
const HOMES_PAGE_KEYS = ["main", "ozamiz", "dumaguete", "bgc-taguig", "cebu", "pampanga", "cavite", "iloilo", "bacolod", "davao", "palawan", "bohol", "makati", "cdo", "gensan", "caraga", "leyte"]
const SITE_PAGE_KEYS = ["fhi", "pickleplay", "bayanihan", "filipinohomes", "bayanihan-dubai", "rentsouq"]

function cleanPages(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.homes) || !Array.isArray(raw.sites)) return null
  return {
    homes: HOMES_PAGE_KEYS.filter((k) => raw.homes.includes(k)),
    sites: SITE_PAGE_KEYS.filter((k) => raw.sites.includes(k)),
    carousel: raw.carousel === true,
  }
}

function writeSetup(next) {
  setup = next
  fs.mkdirSync(path.dirname(setupFile), { recursive: true })
  fs.writeFileSync(setupFile, JSON.stringify(next, null, 1), { encoding: "utf8", mode: 0o600 })
}

/** Folder status for the welcome setup and Settings (never the AI key). */
function setupStatus() {
  return {
    done: setup.done,
    mode: setup.mode,
    storage: { ...setup.storage },
    pages: setup.pages ?? null,
    defaultFolder: defaultWorkFolder(),
    cloudinary: { cloudName: config.CLOUDINARY_CLOUD_NAME ?? "", hasApiKey: Boolean(config.CLOUDINARY_API_KEY), hasApiSecret: Boolean(config.CLOUDINARY_API_SECRET) },
  }
}

/** Checks the person's own Cloudinary (cloud name, API key and secret) before saving it. */
async function checkCloudinary(cloudName, apiKey, apiSecret) {
  if (!/^[a-z0-9_-]{1,100}$/i.test(cloudName)) throw new Error("The cloud name has only letters, numbers, - and _ (Cloudinary → Settings → API Keys, at the top).")
  let res
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/usage`, {
      headers: { authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` },
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new Error("Couldn't reach Cloudinary. Check the internet connection, or save on this computer for now.")
  }
  if (res.ok || res.status === 403) return // 403: the key works but can't read the usage report (uploads still work)
  if (res.status === 401) throw new Error("Cloudinary didn't accept that API key and secret. Copy both again from Cloudinary → Settings → API Keys.")
  if (res.status === 404 || res.status === 400) throw new Error(`No Cloudinary cloud is named "${cloudName}". Copy the Cloud name shown at the top of Cloudinary → Settings → API Keys.`)
  throw new Error(`Cloudinary answered ${res.status}. Try again in a minute.`)
}

/** A folder for the work: created when missing; the work is copied over when it moves to an empty folder. */
function useWorkFolder(folder) {
  if (typeof folder !== "string" || !path.isAbsolute(folder)) throw new Error("Choose a folder on this computer.")
  const target = path.resolve(folder)
  fs.mkdirSync(target, { recursive: true })
  const previous = setup?.storage?.folder
  const hasWork = (dir) => fs.existsSync(path.join(dir, "projects")) || fs.existsSync(path.join(dir, "library.json"))
  if (previous && path.resolve(previous) !== target && hasWork(previous) && !hasWork(target)) {
    fs.cpSync(previous, target, { recursive: true, errorOnExist: false, force: false })
  }
  return target
}

// ---------- local server ----------

function isPortFree(p) {
  return new Promise((resolve) => {
    const tester = nodeNet.createServer()
    tester.once("error", () => resolve(false))
    tester.once("listening", () => tester.close(() => resolve(true)))
    tester.listen(p, "127.0.0.1")
  })
}

async function pickPort() {
  for (const p of PORTS) if (await isPortFree(p)) return p
  throw new Error(`Ports ${PORTS[0]}–${PORTS[PORTS.length - 1]} are all in use. Close other copies of the app and try again.`)
}

function startServer() {
  const serverFile = path.join(serverDir, "server.js")
  if (!fs.existsSync(serverFile)) throw new Error(`The app's server files are missing (${serverFile}). Reinstall the app.`)
  fs.mkdirSync(path.dirname(logFile), { recursive: true })
  const log = fs.createWriteStream(logFile, { flags: "a" })
  log.write(`\n--- ${new Date().toISOString()} starting on port ${port} ---\n`)
  serverProcess = utilityProcess.fork(path.join(__dirname, "server-boot.cjs"), [serverFile, path.join(userDir, "compile-cache")], {
    cwd: serverDir,
    stdio: "pipe",
    serviceName: "Homes.ph SocMedSystem server",
    env: {
      ...process.env,
      ...config,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      // The server reads setup.json here (no account → the work is saved in setup.storage.folder).
      DCM_USER_DIR: userDir,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  })
  serverProcess.stdout?.on("data", (d) => log.write(d))
  serverProcess.stderr?.on("data", (d) => log.write(d))
  serverProcess.on("exit", (code) => {
    log.end(`--- server exited (${code}) ---\n`)
    serverProcess = null
    if (!quitting && !restarting) {
      dialog.showErrorBox("Homes.ph SocMedSystem", `The app's local server stopped unexpectedly (code ${code}).\n\nDetails: ${logFile}`)
      app.quit()
    }
  })
}

async function waitForServer(timeoutMs = 60000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${origin}/api/health`, { cache: "no-store" })
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`The app's local server did not start in time.\n\nDetails: ${logFile}`)
}

async function restartServer() {
  restarting = true
  config = loadConfig()
  await new Promise((resolve) => {
    if (!serverProcess) return resolve()
    serverProcess.once("exit", resolve)
    serverProcess.kill()
  })
  startServer()
  await waitForServer()
  restarting = false
}

// ---------- windows ----------

// ---------- theme ----------
// Dark by default. The page reports the person's choice; it's remembered so the
// splash, the window background and the Windows title bar match on the next start.
const WINDOW_BACKGROUND = { dark: "#0A0F1C", light: "#F8FAFC" }
let theme = "dark"

function themeFile() {
  return path.join(userDir, "theme")
}

function loadTheme() {
  try {
    theme = fs.readFileSync(themeFile(), "utf8").trim() === "light" ? "light" : "dark"
  } catch {
    theme = "dark"
  }
  nativeTheme.themeSource = theme
}

function applyTheme(next) {
  if (next === theme) return
  theme = next
  nativeTheme.themeSource = theme
  for (const win of [mainWindow, floatWindow, checklistWindow, reportWindow]) if (win && !win.isDestroyed()) win.setBackgroundColor(WINDOW_BACKGROUND[theme])
  try {
    fs.writeFileSync(themeFile(), theme)
  } catch {
    // not critical: the page remembers the choice too
  }
}

function createSplash() {
  splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    show: true,
    center: true,
    backgroundColor: WINDOW_BACKGROUND[theme],
    icon: iconPath,
    webPreferences: { sandbox: true, contextIsolation: true },
  })
  splash.loadFile(path.join(__dirname, "loading.html"))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: "Homes.ph SocMedSystem",
    backgroundColor: WINDOW_BACKGROUND[theme],
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false,
      additionalArguments: [`--dcm-version=${app.getVersion()}`],
    },
  })
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize()
    mainWindow.show()
    splash?.destroy()
    splash = null
  })
  mainWindow.on("closed", () => {
    mainWindow = null
    if (floatWindow && !floatWindow.isDestroyed()) floatWindow.destroy()
    if (checklistWindow && !checklistWindow.isDestroyed()) checklistWindow.destroy()
    if (reportWindow && !reportWindow.isDestroyed()) reportWindow.destroy()
  })
  // The floating editor appears when you leave the app and hides when you come back.
  mainWindow.on("blur", () => setTimeout(syncFloat, 120))
  mainWindow.on("minimize", () => setTimeout(syncFloat, 0))
  mainWindow.on("focus", () => hideFloat())
  mainWindow.on("restore", () => hideFloat())

  const wc = mainWindow.webContents
  // A page load (not the app's own in-page navigation) drops the window's answer to the extension until it says ready again.
  wc.on("did-start-navigation", (details, _url, isInPlace, isMainFrame) => {
    const sameDocument = details?.isSameDocument ?? isInPlace
    const mainFrame = details?.isMainFrame ?? isMainFrame
    if (mainFrame && !sameDocument) bridgeWindowReady = false
  })
  // Links to other sites (e.g. "Open original" on Cloudinary) open in the normal browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url) && !url.startsWith(origin)) shell.openExternal(url)
    return { action: "deny" }
  })
  // Never navigate away from the app (also stops a dropped file from replacing the page).
  wc.on("will-navigate", (event, url) => {
    if (url.startsWith(origin)) return
    event.preventDefault()
    if (/^https?:/i.test(url)) shell.openExternal(url)
  })
  // The editor asks before closing while a save is still pending.
  wc.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      buttons: ["Stay", "Close anyway"],
      defaultId: 0,
      cancelId: 0,
      title: "Unsaved changes",
      message: "Some changes haven't finished saving yet.",
      detail: "Stay a moment so they can be saved, or close anyway and lose them.",
    })
    if (choice === 1) event.preventDefault()
  })
}

// ---------- floating posting checklist ----------
// Its own small window that stays on top of the browser while posting on Facebook.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function checklistBoundsFile() {
  return path.join(userDir, "checklist-window.json")
}

function initialChecklistBounds() {
  try {
    const saved = JSON.parse(fs.readFileSync(checklistBoundsFile(), "utf8"))
    const area = screen.getDisplayMatching(saved).workArea
    const visible = saved.x < area.x + area.width - 60 && saved.x + saved.width > area.x + 60 && saved.y >= area.y - 10 && saved.y < area.y + area.height - 60
    if (visible && saved.width >= 320 && saved.height >= 420) return saved
  } catch {
    // first use: default position below
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const width = 400
  const height = Math.min(860, area.height - 40)
  return { x: area.x + area.width - width - 24, y: area.y + Math.round((area.height - height) / 2), width, height }
}

function openChecklist(projectId) {
  const url = `${origin}/checklist?id=${encodeURIComponent(projectId)}`
  if (checklistWindow && !checklistWindow.isDestroyed()) {
    checklistWindow.loadURL(url)
    if (checklistWindow.isMinimized()) checklistWindow.restore()
    checklistWindow.show()
    checklistWindow.focus()
    return
  }
  checklistWindow = new BrowserWindow({
    ...initialChecklistBounds(),
    minWidth: 320,
    minHeight: 420,
    show: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: "Posting checklist · Homes.ph SocMedSystem",
    backgroundColor: WINDOW_BACKGROUND[theme],
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      additionalArguments: [`--dcm-version=${app.getVersion()}`],
    },
  })
  const win = checklistWindow
  win.setAlwaysOnTop(true, "floating")
  win.once("ready-to-show", () => win.show())
  win.loadURL(url)
  let saveTimer = null
  const saveBounds = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      fs.promises.writeFile(checklistBoundsFile(), JSON.stringify(win.getBounds())).catch(() => {})
    }, 400)
  }
  win.on("moved", saveBounds)
  win.on("resized", saveBounds)
  win.on("closed", () => {
    if (checklistWindow === win) checklistWindow = null
  })
  const wc = win.webContents
  wc.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target) && !target.startsWith(origin)) shell.openExternal(target)
    return { action: "deny" }
  })
  wc.on("will-navigate", (event, target) => {
    if (target.startsWith(`${origin}/checklist`) || target.startsWith(`${origin}/login`)) return
    event.preventDefault()
  })
}

// ---------- floating report ----------
// The day's report lines (News Article Posting, Daily Trend News, Carousel), each a click away
// on the clipboard, in a small window that stays on top while writing the report.

const DAY = /^\d{4}-\d{2}-\d{2}$/

function reportBoundsFile() {
  return path.join(userDir, "report-window.json")
}

function initialReportBounds() {
  try {
    const saved = JSON.parse(fs.readFileSync(reportBoundsFile(), "utf8"))
    const area = screen.getDisplayMatching(saved).workArea
    const visible = saved.x < area.x + area.width - 60 && saved.x + saved.width > area.x + 60 && saved.y >= area.y - 10 && saved.y < area.y + area.height - 60
    if (visible && saved.width >= 340 && saved.height >= 420) return saved
  } catch {
    // first use: default position below
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const width = 420
  const height = Math.min(860, area.height - 40)
  return { x: area.x + area.width - width - 24, y: area.y + Math.round((area.height - height) / 2), width, height }
}

function openReportFloat(day) {
  const url = `${origin}/report-float${day ? `?day=${day}` : ""}`
  if (reportWindow && !reportWindow.isDestroyed()) {
    reportWindow.loadURL(url)
    if (reportWindow.isMinimized()) reportWindow.restore()
    reportWindow.show()
    reportWindow.focus()
    return
  }
  reportWindow = new BrowserWindow({
    ...initialReportBounds(),
    minWidth: 340,
    minHeight: 420,
    show: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: "Floating report · Homes.ph SocMedSystem",
    backgroundColor: WINDOW_BACKGROUND[theme],
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false,
      additionalArguments: [`--dcm-version=${app.getVersion()}`],
    },
  })
  const win = reportWindow
  win.setAlwaysOnTop(true, "floating")
  win.once("ready-to-show", () => win.show())
  win.loadURL(url)
  let saveTimer = null
  const saveBounds = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      fs.promises.writeFile(reportBoundsFile(), JSON.stringify(win.getBounds())).catch(() => {})
    }, 400)
  }
  win.on("moved", saveBounds)
  win.on("resized", saveBounds)
  win.on("closed", () => {
    if (reportWindow === win) reportWindow = null
  })
  const wc = win.webContents
  wc.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target) && !target.startsWith(origin)) shell.openExternal(target)
    return { action: "deny" }
  })
  wc.on("will-navigate", (event, target) => {
    if (target.startsWith(`${origin}/report-float`) || target.startsWith(`${origin}/login`)) return
    event.preventDefault()
  })
}

// ---------- floating quick-edit window ----------

function floatBoundsFile() {
  return path.join(userDir, "float-window.json")
}

function initialFloatBounds() {
  try {
    const saved = JSON.parse(fs.readFileSync(floatBoundsFile(), "utf8"))
    const area = screen.getDisplayMatching(saved).workArea
    const visible = saved.x < area.x + area.width - 60 && saved.x + saved.width > area.x + 60 && saved.y >= area.y - 10 && saved.y < area.y + area.height - 60
    if (visible && saved.width >= 300 && saved.height >= 420) return saved
  } catch {
    // first use: default position below
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const width = 400
  const height = Math.min(780, area.height - 40)
  return { x: area.x + area.width - width - 24, y: area.y + Math.round((area.height - height) / 2), width, height }
}

function createFloatWindow() {
  floatWindow = new BrowserWindow({
    ...initialFloatBounds(),
    minWidth: 300,
    minHeight: 420,
    show: false,
    frame: false,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: "Quick edit · Homes.ph SocMedSystem",
    backgroundColor: WINDOW_BACKGROUND[theme],
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false,
      additionalArguments: [`--dcm-version=${app.getVersion()}`],
    },
  })
  floatWindow.setAlwaysOnTop(true, "floating")
  floatWindow.loadURL(`${origin}/float`)
  let saveTimer = null
  const saveBounds = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!floatWindow || floatWindow.isDestroyed()) return
      fs.promises.writeFile(floatBoundsFile(), JSON.stringify(floatWindow.getBounds())).catch(() => {})
    }, 400)
  }
  floatWindow.on("moved", saveBounds)
  floatWindow.on("resized", saveBounds)
  // Closing it (e.g. Alt+F4) turns float mode off instead of breaking it.
  floatWindow.on("close", (event) => {
    if (quitting || !mainWindow) return
    event.preventDefault()
    turnFloatOff()
  })
  floatWindow.on("closed", () => (floatWindow = null))
  const wc = floatWindow.webContents
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url) && !url.startsWith(origin)) shell.openExternal(url)
    return { action: "deny" }
  })
  wc.on("will-navigate", (event, url) => {
    if (url === `${origin}/float` || url.startsWith(`${origin}/login`)) return
    event.preventDefault()
  })
}

/** Fades the window in without taking focus away from the app you switched to. */
function showFloat() {
  if (!floatWindow || floatWindow.isDestroyed() || floatWindow.isVisible()) return
  floatWindow.setOpacity(0)
  floatWindow.showInactive()
  let opacity = 0
  const timer = setInterval(() => {
    opacity = Math.min(1, opacity + 0.2)
    if (!floatWindow || floatWindow.isDestroyed()) return clearInterval(timer)
    floatWindow.setOpacity(opacity)
    if (opacity >= 1) clearInterval(timer)
  }, 16)
}

function hideFloat() {
  if (floatWindow && !floatWindow.isDestroyed() && floatWindow.isVisible()) floatWindow.hide()
}

function syncFloat() {
  if (!floatEnabled || !floatState || !mainWindow || mainWindow.isDestroyed()) return hideFloat()
  if (mainWindow.isMinimized()) return showFloat()
  // A file picker or message box of our own keeps the main window disabled: don't pop up over it.
  if (!mainWindow.isEnabled()) return
  if (mainWindow.isFocused() || floatWindow?.isFocused()) return
  showFloat()
}

function turnFloatOff() {
  floatEnabled = false
  floatState = null
  hideFloat()
  mainWindow?.webContents.send("float:command", { type: "closed" })
}

function showMain() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  hideFloat()
}

// ---------- downloads (exports) ----------

function uniquePath(dir, filename) {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let candidate = path.join(dir, filename)
  for (let i = 2; fs.existsSync(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`)
  return candidate
}

let savedBatch = []
let batchTimer = null

// "Separate files" exports: the next few downloads go into one folder per
// carousel (Downloads\<carousel>\1.png, 2.png…). Set by the main window only.
let exportFolder = null

function folderName(name) {
  const clean = String(name ?? "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 120)
  return clean || "Carousel"
}

function uniqueDir(parent, name) {
  let candidate = path.join(parent, name)
  for (let i = 2; fs.existsSync(candidate); i++) candidate = path.join(parent, `${name} (${i})`)
  return candidate
}

// ---------- folders (Settings → Downloads; Poster Maker → Save to folder) ----------

const FOLDER_KINDS = new Set(["downloads", "posters", "report"])
let folderPrefs = null

function foldersFile() {
  return path.join(userDir, "folders.json")
}

function loadFolderPrefs() {
  if (folderPrefs) return folderPrefs
  try {
    const raw = JSON.parse(fs.readFileSync(foldersFile(), "utf8"))
    const str = (v) => (typeof v === "string" ? v : "")
    folderPrefs = { downloads: str(raw.downloads), posters: str(raw.posters), report: str(raw.report) }
  } catch {
    folderPrefs = { downloads: "", posters: "", report: "" }
  }
  return folderPrefs
}

function saveFolderPrefs(next) {
  folderPrefs = next
  fs.writeFileSync(foldersFile(), JSON.stringify(next, null, 2))
}

function usableDir(dir) {
  try {
    return Boolean(dir) && fs.statSync(dir).isDirectory()
  } catch {
    return false
  }
}

/** Where downloads go: the folder chosen in Settings, or Windows' Downloads folder (also when the chosen one is gone). */
function baseDownloadDir() {
  const chosen = loadFolderPrefs().downloads
  return usableDir(chosen) ? chosen : app.getPath("downloads")
}

/** Where the Poster Maker saves posters: its own folder, or the downloads folder. */
function posterDir() {
  const chosen = loadFolderPrefs().posters
  return usableDir(chosen) ? chosen : baseDownloadDir()
}

/**
 * Where the floating report saves the images it copies: the folder chosen in Settings, else
 * D:\DAILY REPORT (the team's folder), or DAILY REPORT in Downloads on a computer without a D: drive.
 */
function defaultReportDir() {
  return usableDir("D:\\") ? "D:\\DAILY REPORT" : path.join(app.getPath("downloads"), "DAILY REPORT")
}

function reportDir() {
  const chosen = loadFolderPrefs().report
  return usableDir(chosen) ? chosen : defaultReportDir()
}

/** The floating report's folders inside the report folder (as the team names them). */
const REPORT_SECTIONS = { news: "New Article Posting", trends: "Daily Trend News", carousel: "Carousel" }
const REPORT_BRANDS = { pickleplay: "Pickleplay", fhi: "FHI Global", caraga: "Homes.ph CARAGA", gensan: "Homes.ph Gensan" }

/** A report folder's name: a brand's, or a Homes.ph page's ("homes:Cebu" → "Homes.ph Cebu"); null when it's neither. */
function reportBrandFolder(brand) {
  if (Object.hasOwn(REPORT_BRANDS, brand)) return REPORT_BRANDS[brand]
  const page = /^homes:([\p{L}\p{N} .'&()-]{1,40})$/u.exec(String(brand ?? ""))?.[1]?.trim()
  return page ? folderName(`Homes.ph ${page}`) : null
}

function isJpeg(bytes) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function folderStatus() {
  const prefs = loadFolderPrefs()
  return {
    downloads: baseDownloadDir(),
    downloadsChosen: usableDir(prefs.downloads),
    // A chosen folder that can't be found now (a drive that isn't plugged in, a deleted folder).
    downloadsMissing: prefs.downloads && !usableDir(prefs.downloads) ? prefs.downloads : "",
    posters: posterDir(),
    postersChosen: usableDir(prefs.posters),
    postersMissing: prefs.posters && !usableDir(prefs.posters) ? prefs.posters : "",
    report: reportDir(),
    reportChosen: usableDir(prefs.report),
    reportMissing: prefs.report && !usableDir(prefs.report) ? prefs.report : "",
    reportDefault: defaultReportDir(),
    windowsDownloads: app.getPath("downloads"),
  }
}

/** Files the Poster Maker saved this session (the only ones "Show in folder" may reveal). */
const savedFiles = new Set()

// IPC hands over a Uint8Array (checked without instanceof, which depends on the realm).
function isByteArray(value) {
  return ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === "[object Uint8Array]"
}

function isPng(bytes) {
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
}

function downloadDir() {
  const group = exportFolder
  if (!group || group.remaining <= 0 || Date.now() > group.until) {
    exportFolder = null
    return baseDownloadDir()
  }
  group.remaining -= 1
  try {
    fs.mkdirSync(group.dir, { recursive: true })
    return group.dir
  } catch {
    return baseDownloadDir()
  }
}

function setupDownloads() {
  session.defaultSession.on("will-download", (_event, item) => {
    const target = uniquePath(downloadDir(), item.getFilename())
    item.setSavePath(target)
    item.once("done", (_e, state) => {
      if (state === "completed") {
        savedBatch.push(target)
        clearTimeout(batchTimer)
        batchTimer = setTimeout(notifySaved, 1200)
      } else if (state !== "cancelled") {
        dialog.showErrorBox("Export failed", `Could not save ${path.basename(target)} to ${path.dirname(target)}.`)
      }
    })
  })
}

function notifySaved() {
  const files = savedBatch
  savedBatch = []
  if (!files.length || !Notification.isSupported()) return
  const notification = new Notification({
    title: files.length === 1 ? `Saved to ${path.basename(path.dirname(files[0])) || "Downloads"}` : `${files.length} files saved to ${path.basename(path.dirname(files[0]))}`,
    body: files.length === 1 ? path.basename(files[0]) : "Click to open the folder.",
    icon: iconPath,
  })
  notification.on("click", () => shell.showItemInFolder(files[files.length - 1]))
  notification.show()
}

// ---------- bridge for the Settings page ----------

function fromApp(event) {
  return Boolean(origin) && event.senderFrame?.url?.startsWith(origin)
}

function fromMainWindow(event) {
  return fromApp(event) && Boolean(mainWindow) && event.sender === mainWindow.webContents
}

function fromReportWindow(event) {
  return fromApp(event) && Boolean(reportWindow) && !reportWindow.isDestroyed() && event.sender === reportWindow.webContents
}

function fromFloatWindow(event) {
  return fromApp(event) && Boolean(floatWindow) && event.sender === floatWindow.webContents
}

// ---------- the Homes.ph Publisher Chrome extension ----------

/** Where the extension's files are copied for Chrome's "Load unpacked" (a folder that survives app updates). */
function extensionFolder() {
  return path.join(app.getPath("documents"), "Daily Carousel Maker", "Chrome Extension")
}

const extensionSource = () => (app.isPackaged ? path.join(process.resourcesPath, "chrome-extension") : path.join(root, "chrome-extension"))

/** Copies the extension's files there (again when this app has a newer version of them). */
function copyExtension(force) {
  const from = extensionSource()
  const to = extensionFolder()
  if (!fs.existsSync(path.join(from, "manifest.json"))) return null
  const read = (dir) => {
    try {
      return fs.readFileSync(path.join(dir, "manifest.json"), "utf8")
    } catch {
      return ""
    }
  }
  if (!force && !fs.existsSync(to)) return to
  if (read(from) !== read(to) || force) {
    // Files of an older version that this one doesn't have go (1.39.0 had an "img" folder inside).
    if (fs.existsSync(to)) {
      const keep = new Set(fs.readdirSync(from))
      for (const name of fs.readdirSync(to)) if (!keep.has(name)) fs.rmSync(path.join(to, name), { recursive: true, force: true })
    }
    fs.cpSync(from, to, { recursive: true, force: true })
  }
  return to
}

function bridgeLog(line) {
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // no log
  }
}

/** A request from the extension, run in the app's window (it has the data and draws the template). */
async function forwardToWindow(type, payload) {
  // The window may be loading a page: wait a little for it.
  for (let i = 0; i < 40 && !bridgeWindowReady && mainWindow && !mainWindow.isDestroyed(); i++) await new Promise((r) => setTimeout(r, 250))
  return new Promise((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed() || !bridgeWindowReady) return reject(new Error("Homes.ph SocMedSystem is still starting. Try again in a moment."))
    const id = crypto.randomUUID()
    const timer = setTimeout(() => {
      bridgeWaiting.delete(id)
      reject(new Error("Homes.ph SocMedSystem took too long to answer."))
    }, 110_000)
    bridgeWaiting.set(id, { resolve, reject, timer })
    mainWindow.webContents.send("desktop:extension-request", { id, type, payload })
  })
}

async function askToConnectExtension({ name, browser }) {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Allow", "Don't allow"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: "Connect the Chrome extension?",
    message: `${name} (${browser}) wants to use Homes.ph SocMedSystem.`,
    detail:
      "It adds the articles you publish with it to News Article (headline, photo and posting time), makes their template picture and saves it in your download folder. For your scheduled carousels it gets the slides (saved as 1.png, 2.png… in your download folder) and ticks the Facebook pages it posts to on the posting checklist. It also gets your scheduled advertisements and the day's trend posters (pictures, captions and report texts) and marks the ads it posts on the Advertisement calendar.\n\nAllow it only if you installed Homes.ph Publisher yourself. You can disconnect it in Settings.",
  })
  return response === 0
}

function startExtensionBridge() {
  bridge = extensionBridge.startBridge({
    file: path.join(userDir, "extension-bridge.json"),
    version: app.getVersion(),
    forward: forwardToWindow,
    // The extension's Posting and Reports tabs follow the pages assigned here.
    assignment: () => setup?.pages ?? null,
    askToPair: askToConnectExtension,
    log: bridgeLog,
  })
  bridge.ready.then((p) => bridgeLog(p ? `[extension] bridge on 127.0.0.1:${p}` : "[extension] no free port (39390–39394)"))
  try {
    copyExtension(false)
  } catch {
    // copied when Settings opens the folder
  }
}

const FLOAT_COMMANDS = new Set(["set-text", "set-caption", "select-slide", "add-card", "paste-image", "paste-image-url"])

function setupIpc() {
  ipcMain.handle("desktop:get-config", (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    return {
      cloudName: config.CLOUDINARY_CLOUD_NAME ?? "",
      hasApiKey: Boolean(config.CLOUDINARY_API_KEY),
      hasApiSecret: Boolean(config.CLOUDINARY_API_SECRET),
      hasGroqKey: Boolean(config.GROQ_API_KEY),
      configPath: configFile,
    }
  })
  ipcMain.handle("desktop:save-config", async (event, values) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    const clean = (v) => (typeof v === "string" ? v.trim().slice(0, 200) : undefined)
    const next = { ...loadConfig() }
    const cloudName = clean(values?.cloudName)
    if (cloudName !== undefined) next.CLOUDINARY_CLOUD_NAME = cloudName
    if (clean(values?.apiKey)) next.CLOUDINARY_API_KEY = clean(values.apiKey)
    if (clean(values?.apiSecret)) next.CLOUDINARY_API_SECRET = clean(values.apiSecret)
    if (clean(values?.groqKey)) next.GROQ_API_KEY = clean(values.groqKey)
    writeConfig(next)
    await restartServer()
    mainWindow?.reload()
  })
  // ---------- welcome setup ----------
  ipcMain.handle("desktop:setup-get", (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    return setupStatus()
  })
  ipcMain.handle("desktop:setup-choose-folder", async (event) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Where should Homes.ph SocMedSystem save your work?",
      defaultPath: setup.storage.folder || defaultWorkFolder(),
      properties: ["openDirectory", "createDirectory"],
    })
    if (result.canceled || !result.filePaths[0]) return null
    // A folder named for the app inside the one chosen (unless it already is one).
    const chosen = result.filePaths[0]
    return /daily carousel maker/i.test(path.basename(chosen)) ? chosen : path.join(chosen, "Daily Carousel Maker")
  })
  ipcMain.handle("desktop:setup-save", async (event, values) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    const next = { ...setup, storage: { ...setup.storage } }
    if (values?.mode === "local" || values?.mode === "account") next.mode = values.mode
    if (values?.storageKind === "local" || values?.storageKind === "cloudinary") next.storage.kind = values.storageKind
    if (values?.folder !== undefined) next.storage.folder = useWorkFolder(values.folder)
    else if (next.mode === "local") fs.mkdirSync(next.storage.folder, { recursive: true })
    if (values?.done === true) next.done = true
    if (values?.done === false) next.done = false
    // Their own Cloudinary (photos online): saved with the other settings, then the server restarts.
    const clean = (v) => (typeof v === "string" ? v.trim().slice(0, 200) : "")
    const c = values?.cloudinary
    if (c && (clean(c.cloudName) || clean(c.apiKey) || clean(c.apiSecret))) {
      const conf = { ...loadConfig() }
      if (clean(c.cloudName)) conf.CLOUDINARY_CLOUD_NAME = clean(c.cloudName)
      if (clean(c.apiKey)) conf.CLOUDINARY_API_KEY = clean(c.apiKey)
      if (clean(c.apiSecret)) conf.CLOUDINARY_API_SECRET = clean(c.apiSecret)
      if (!conf.CLOUDINARY_CLOUD_NAME || !conf.CLOUDINARY_API_KEY || !conf.CLOUDINARY_API_SECRET) throw new Error("Fill in the cloud name, API key and API secret.")
      await checkCloudinary(conf.CLOUDINARY_CLOUD_NAME, conf.CLOUDINARY_API_KEY, conf.CLOUDINARY_API_SECRET)
      writeConfig(conf)
      writeSetup(next)
      await restartServer()
    } else {
      writeSetup(next)
    }
    return setupStatus()
  })
  // The assigned pages: saved for the app (every window reloads its menus) and the Chrome extension (it reads them
  // through the bridge).
  ipcMain.handle("desktop:pages-set", (event, value) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    const pages = cleanPages(value)
    if (!pages) throw new Error("Those aren't pages.")
    writeSetup({ ...setup, pages })
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed() && w.webContents !== event.sender) w.webContents.send("desktop:pages-changed", pages)
    return pages
  })
  ipcMain.handle("desktop:setup-open-folder", async (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    fs.mkdirSync(setup.storage.folder, { recursive: true })
    const error = await shell.openPath(setup.storage.folder)
    if (error) throw new Error(error)
  })
  // A copy of the person's AI and Tavily keys, encrypted by Windows. The page keeps them in its own
  // storage, which belongs to the server's port: when the app has to use another port, they come back from here.
  ipcMain.handle("desktop:ai-config-get", (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    if (!setup.ai) return null
    try {
      const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(setup.ai, "base64")) : Buffer.from(setup.ai, "base64").toString("utf8")
      const value = JSON.parse(text)
      return { ai: value.ai ?? null, tavily: value.tavily ?? null, keys: value.keys ?? {}, engine: value.engine ?? "auto", search: value.search ?? {} }
    } catch {
      return null
    }
  })
  ipcMain.handle("desktop:ai-config-set", (event, value) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    const ai = value?.ai
    const okAi = ai && typeof ai.provider === "string" && typeof ai.key === "string" && ai.key.trim() && ai.key.length <= 400
    const tavily = typeof value?.tavily === "string" && value.tavily.trim().length <= 300 ? value.tavily.trim() : ""
    // One saved key per service (at most 16 services).
    const keys = {}
    for (const [id, v] of Object.entries(value?.keys && typeof value.keys === "object" ? value.keys : {}).slice(0, 16)) {
      if (/^[a-z]{2,20}$/.test(id) && typeof v?.key === "string" && v.key.trim() && v.key.length <= 400) {
        keys[id] = { key: v.key.trim(), ...(typeof v.model === "string" && v.model ? { model: v.model.slice(0, 120) } : {}) }
      }
    }
    const engine = ["auto", "tavily", "serpapi", "perplexity", "groq", "gemini"].includes(value?.engine) ? value.engine : "auto"
    // The keys that search but don't write (1.36): SerpApi and a Meta access token.
    const search = {}
    if (typeof value?.search?.serpapi === "string" && /^[A-Za-z0-9]{32,128}$/.test(value.search.serpapi)) search.serpapi = value.search.serpapi
    if (typeof value?.search?.meta === "string" && /^EA[A-Za-z0-9]{20,1000}$/.test(value.search.meta)) search.meta = value.search.meta
    if (!okAi && !tavily && !Object.keys(keys).length && !Object.keys(search).length) return writeSetup({ ...setup, ai: "" })
    const text = JSON.stringify({
      ai: okAi ? { provider: ai.provider.slice(0, 30), key: ai.key.trim(), ...(typeof ai.model === "string" && ai.model ? { model: ai.model.slice(0, 120) } : {}) } : null,
      tavily: tavily || null,
      keys,
      engine,
      search,
    })
    const stored = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text).toString("base64") : Buffer.from(text, "utf8").toString("base64")
    writeSetup({ ...setup, ai: stored })
  })

  ipcMain.handle("desktop:open-data-folder", (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    return shell.openPath(userDir)
  })
  ipcMain.handle("desktop:open-checklist", (event, projectId) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    if (typeof projectId !== "string" || !UUID.test(projectId)) throw new Error("Invalid carousel")
    openChecklist(projectId)
  })
  // The Chrome extension: the window answers its requests; Settings shows it and its folder.
  ipcMain.on("desktop:extension-ready", (event) => {
    if (fromMainWindow(event)) bridgeWindowReady = true
  })
  ipcMain.handle("desktop:extension-reply", (event, id, ok, result) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    const waiting = bridgeWaiting.get(id)
    if (!waiting) return
    bridgeWaiting.delete(id)
    clearTimeout(waiting.timer)
    if (ok) waiting.resolve(result && typeof result === "object" ? result : {})
    else waiting.reject(new Error((result && result.error) || "Homes.ph SocMedSystem couldn't do it."))
  })
  ipcMain.handle("desktop:extension-status", (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    return { port: bridge ? bridge.port : null, clients: bridge ? bridge.clients() : [], folder: extensionFolder(), copied: fs.existsSync(path.join(extensionFolder(), "manifest.json")) }
  })
  ipcMain.handle("desktop:extension-open-folder", async (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    const folder = copyExtension(true)
    if (!folder) throw new Error("The extension's files aren't in this copy of the app.")
    await shell.openPath(folder)
    return folder
  })
  ipcMain.handle("desktop:extension-forget", (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    bridge?.forgetAll()
  })
  ipcMain.handle("desktop:open-report-float", (event, day) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    if (day != null && day !== "" && (typeof day !== "string" || !DAY.test(day))) throw new Error("Invalid day")
    openReportFloat(day || "")
  })
  ipcMain.handle("desktop:set-theme", (event, next) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    if (next !== "dark" && next !== "light") throw new Error("Invalid theme")
    applyTheme(next)
  })
  ipcMain.handle("desktop:export-folder", (event, name, count) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    const n = Number(count)
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error("Invalid file count")
    exportFolder = { dir: uniqueDir(baseDownloadDir(), folderName(name)), remaining: n, until: Date.now() + 120_000 }
  })
  ipcMain.handle("desktop:folders", (event) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    return folderStatus()
  })
  ipcMain.handle("desktop:choose-folder", async (event, kind) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    if (!FOLDER_KINDS.has(kind)) throw new Error("Invalid folder")
    const result = await dialog.showOpenDialog(mainWindow, {
      title:
        kind === "posters"
          ? "Where should the Poster Maker save posters?"
          : kind === "report"
            ? "Where should the floating report save its images?"
            : "Where should downloads be saved?",
      defaultPath: kind === "posters" ? posterDir() : kind === "report" ? (usableDir(reportDir()) ? reportDir() : baseDownloadDir()) : baseDownloadDir(),
      properties: ["openDirectory", "createDirectory"],
    })
    if (result.canceled || !result.filePaths[0]) return null
    saveFolderPrefs({ ...loadFolderPrefs(), [kind]: result.filePaths[0] })
    return folderStatus()
  })
  ipcMain.handle("desktop:reset-folder", (event, kind) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    if (!FOLDER_KINDS.has(kind)) throw new Error("Invalid folder")
    saveFolderPrefs({ ...loadFolderPrefs(), [kind]: "" })
    return folderStatus()
  })
  ipcMain.handle("desktop:open-folder", async (event, kind) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    if (!FOLDER_KINDS.has(kind)) throw new Error("Invalid folder")
    const dir = kind === "posters" ? posterDir() : kind === "report" ? reportDir() : baseDownloadDir()
    fs.mkdirSync(dir, { recursive: true })
    const error = await shell.openPath(dir)
    if (error) throw new Error(error)
  })
  // Poster Maker → Save to folder: the PNG goes straight into the poster folder (never overwrites).
  ipcMain.handle("desktop:save-poster", (event, fileName, bytes) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    if (!isByteArray(bytes) || bytes.byteLength > 80 * 1024 * 1024 || !isPng(bytes)) throw new Error("Invalid image")
    const name = `${folderName(String(fileName ?? "").replace(/\.png$/i, "")).slice(0, 150) || "Poster"}.png`
    const dir = posterDir()
    fs.mkdirSync(dir, { recursive: true })
    const target = uniquePath(dir, name)
    fs.writeFileSync(target, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    savedFiles.add(target)
    return target
  })
  // Floating report: each article, poster or carousel image it copies is also saved, into
  // <report folder>\<section>\<brand>\ (the same file name again replaces the older copy).
  ipcMain.handle("desktop:save-report-file", (event, section, brand, fileName, bytes) => {
    if (!fromMainWindow(event) && !fromReportWindow(event)) throw new Error("Not allowed")
    if (!Object.hasOwn(REPORT_SECTIONS, section)) throw new Error("Invalid section")
    const brandFolder = brand ? reportBrandFolder(brand) : null
    if (brand && !brandFolder) throw new Error("Invalid brand")
    if (!isByteArray(bytes) || bytes.byteLength > 6 * 1024 * 1024 || !(isPng(bytes) || isJpeg(bytes))) throw new Error("Invalid image")
    const ext = isPng(bytes) ? ".png" : ".jpg"
    const name = `${folderName(String(fileName ?? "").replace(/\.(png|jpe?g)$/i, "")).slice(0, 150) || "Report"}${ext}`
    const dir = path.join(reportDir(), REPORT_SECTIONS[section], ...(brandFolder ? [brandFolder] : []))
    fs.mkdirSync(dir, { recursive: true })
    const target = path.join(dir, name)
    // The other format of the same picture (an earlier PNG, now a JPEG) goes, so one file stays.
    const other = path.join(dir, `${path.basename(name, ext)}${ext === ".png" ? ".jpg" : ".png"}`)
    if (fs.existsSync(other)) fs.rmSync(other, { force: true })
    fs.writeFileSync(target, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    savedFiles.add(target)
    return target
  })
  ipcMain.handle("desktop:show-file", (event, file) => {
    if (!fromMainWindow(event) && !fromReportWindow(event)) throw new Error("Not allowed")
    if (typeof file !== "string" || !savedFiles.has(file)) throw new Error("Unknown file")
    shell.showItemInFolder(file)
  })

  // Floating editor: the full editor turns it on/off and publishes its slides;
  // the float window only sends edit commands back. Each side is checked.
  ipcMain.handle("float:enable", (event) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    floatEnabled = true
    if (!floatWindow || floatWindow.isDestroyed()) createFloatWindow()
    syncFloat()
  })
  ipcMain.handle("float:disable", (event) => {
    if (!fromMainWindow(event)) throw new Error("Not allowed")
    floatEnabled = false
    floatState = null
    hideFloat()
    floatWindow?.webContents.send("float:state", null)
  })
  ipcMain.on("float:state", (event, state) => {
    if (!fromMainWindow(event) || !floatEnabled) return
    floatState = state
    floatWindow?.webContents.send("float:state", state)
  })
  ipcMain.on("float:request-state", (event) => {
    if (fromFloatWindow(event)) event.sender.send("float:state", floatState)
  })
  ipcMain.on("float:command", (event, command) => {
    if (!fromFloatWindow(event) || !floatEnabled || !FLOAT_COMMANDS.has(command?.type)) return
    mainWindow?.webContents.send("float:command", command)
  })
  ipcMain.on("float:open-main", (event) => {
    if (fromFloatWindow(event)) showMain()
  })
  ipcMain.on("float:close", (event) => {
    if (fromFloatWindow(event)) turnFloatOff()
  })
}

function setupMenu() {
  // Deliberately no Edit-menu accelerators: the editor handles Ctrl+Z/C/V/D/S itself.
  const template = [
    {
      label: "File",
      submenu: [
        { label: "Reload", accelerator: "F5", click: () => mainWindow?.reload() },
        { label: "Open app data folder", click: () => shell.openPath(userDir) },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Homes.ph SocMedSystem",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About",
              message: `Homes.ph SocMedSystem ${app.getVersion()}`,
              detail: `For internal use only. Built by Frank Gomez to make the team's daily work easier.\n\n${setup?.mode === "local" ? `Your work is saved in: ${setup.storage.folder}` : "Signed in to the team cloud."}\nLocal server: ${origin}\nSettings: ${configFile}`,
            }),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function start() {
  userDir = app.getPath("userData")
  configFile = path.join(userDir, "config.env")
  setupFile = path.join(userDir, "setup.json")
  // Settings from an earlier version = an install with a team account (no welcome setup for it).
  const hadConfigBefore = fs.existsSync(configFile)
  logFile = path.join(userDir, "logs", "server.log")
  loadTheme()
  createSplash()
  try {
    config = loadConfig()
    setup = loadSetup(hadConfigBefore)
    port = await pickPort()
    origin = `http://127.0.0.1:${port}`
    setupIpc()
    setupDownloads()
    setupMenu()
    startServer()
    // The window (and its renderer process) starts while the server boots.
    createMainWindow()
    startExtensionBridge()
    await waitForServer()
    // A first start opens the welcome setup (pages, AI, where the work is saved); an install from before 1.50 is
    // asked its pages once.
    mainWindow?.loadURL(`${origin}${setup.done ? (setup.pages ? "/home" : "/welcome?step=pages") : "/welcome"}`)
  } catch (error) {
    splash?.destroy()
    dialog.showErrorBox("Homes.ph SocMedSystem could not start", String(error?.message ?? error))
    quitting = true
    serverProcess?.kill()
    app.quit()
  }
}

app.on("before-quit", () => {
  quitting = true
  bridge?.close()
  session.defaultSession?.cookies.flushStore().catch(() => {})
  serverProcess?.kill()
})

app.on("window-all-closed", () => app.quit())
