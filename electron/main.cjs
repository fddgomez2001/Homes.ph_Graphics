// Daily Carousel Maker — Windows desktop app.
// Runs the bundled Next.js server privately on 127.0.0.1 and shows the app in its own window.
const { app, BrowserWindow, Menu, Notification, dialog, ipcMain, nativeTheme, screen, session, shell, utilityProcess } = require("electron")
const crypto = require("node:crypto")
const fs = require("node:fs")
const nodeNet = require("node:net")
const path = require("node:path")

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
]

const root = path.join(__dirname, "..")
const serverDir = app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(root, ".next", "standalone")
const bundledEnv = app.isPackaged ? path.join(process.resourcesPath, "app.env") : path.join(root, "desktop-build", "app.env")
const iconPath = path.join(__dirname, "icon.png")

let userDir
let configFile
let logFile
let config = {}
let serverProcess = null
let port = null
let origin = ""
let mainWindow = null
let splash = null
let floatWindow = null
let checklistWindow = null
let floatEnabled = false
let floatState = null
let quitting = false
let restarting = false

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
    "# Daily Carousel Maker — local settings (Cloudinary, Groq AI). Keep this file private.",
    ...CONFIG_KEYS.map((k) => `${k}=${values[k] ?? ""}`),
    "",
  ]
  fs.writeFileSync(configFile, lines.join("\n"), { encoding: "utf8", mode: 0o600 })
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
    serviceName: "Daily Carousel Maker server",
    env: {
      ...process.env,
      ...config,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  })
  serverProcess.stdout?.on("data", (d) => log.write(d))
  serverProcess.stderr?.on("data", (d) => log.write(d))
  serverProcess.on("exit", (code) => {
    log.end(`--- server exited (${code}) ---\n`)
    serverProcess = null
    if (!quitting && !restarting) {
      dialog.showErrorBox("Daily Carousel Maker", `The app's local server stopped unexpectedly (code ${code}).\n\nDetails: ${logFile}`)
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
  for (const win of [mainWindow, floatWindow, checklistWindow]) if (win && !win.isDestroyed()) win.setBackgroundColor(WINDOW_BACKGROUND[theme])
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
    title: "Daily Carousel Maker",
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
  })
  // The floating editor appears when you leave the app and hides when you come back.
  mainWindow.on("blur", () => setTimeout(syncFloat, 120))
  mainWindow.on("minimize", () => setTimeout(syncFloat, 0))
  mainWindow.on("focus", () => hideFloat())
  mainWindow.on("restore", () => hideFloat())

  const wc = mainWindow.webContents
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
    title: "Posting checklist · Daily Carousel Maker",
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
    title: "Quick edit · Daily Carousel Maker",
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

function downloadDir() {
  const group = exportFolder
  if (!group || group.remaining <= 0 || Date.now() > group.until) {
    exportFolder = null
    return app.getPath("downloads")
  }
  group.remaining -= 1
  try {
    fs.mkdirSync(group.dir, { recursive: true })
    return group.dir
  } catch {
    return app.getPath("downloads")
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
        dialog.showErrorBox("Export failed", `Could not save ${path.basename(target)} to your Downloads folder.`)
      }
    })
  })
}

function notifySaved() {
  const files = savedBatch
  savedBatch = []
  if (!files.length || !Notification.isSupported()) return
  const notification = new Notification({
    title: files.length === 1 ? "Saved to Downloads" : `${files.length} files saved to ${path.basename(path.dirname(files[0]))}`,
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

function fromFloatWindow(event) {
  return fromApp(event) && Boolean(floatWindow) && event.sender === floatWindow.webContents
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
  ipcMain.handle("desktop:open-data-folder", (event) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    return shell.openPath(userDir)
  })
  ipcMain.handle("desktop:open-checklist", (event, projectId) => {
    if (!fromApp(event)) throw new Error("Not allowed")
    if (typeof projectId !== "string" || !UUID.test(projectId)) throw new Error("Invalid carousel")
    openChecklist(projectId)
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
    exportFolder = { dir: uniqueDir(app.getPath("downloads"), folderName(name)), remaining: n, until: Date.now() + 120_000 }
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
          label: "About Daily Carousel Maker",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About",
              message: `Daily Carousel Maker ${app.getVersion()}`,
              detail: `Homes.ph carousel designer.\nLocal server: ${origin}\nSettings: ${configFile}`,
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
  logFile = path.join(userDir, "logs", "server.log")
  loadTheme()
  createSplash()
  try {
    config = loadConfig()
    port = await pickPort()
    origin = `http://127.0.0.1:${port}`
    setupIpc()
    setupDownloads()
    setupMenu()
    startServer()
    // The window (and its renderer process) starts while the server boots.
    createMainWindow()
    await waitForServer()
    mainWindow?.loadURL(`${origin}/home`)
  } catch (error) {
    splash?.destroy()
    dialog.showErrorBox("Daily Carousel Maker could not start", String(error?.message ?? error))
    quitting = true
    serverProcess?.kill()
    app.quit()
  }
}

app.on("before-quit", () => {
  quitting = true
  session.defaultSession?.cookies.flushStore().catch(() => {})
  serverProcess?.kill()
})

app.on("window-all-closed", () => app.quit())
