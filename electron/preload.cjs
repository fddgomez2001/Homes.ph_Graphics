// Exposes a tiny, explicit API to the app (window.desktop). No Node access for the page.
const { contextBridge, ipcRenderer } = require("electron")

const versionArg = process.argv.find((arg) => arg.startsWith("--dcm-version="))

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  version: versionArg ? versionArg.split("=")[1] : "",
  getConfig: () => ipcRenderer.invoke("desktop:get-config"),
  saveConfig: (values) => ipcRenderer.invoke("desktop:save-config", values),
  openDataFolder: () => ipcRenderer.invoke("desktop:open-data-folder"),
  // The welcome setup: no account (work saved in a folder on this computer) or the team cloud.
  setup: {
    get: () => ipcRenderer.invoke("desktop:setup-get"),
    save: (values) => ipcRenderer.invoke("desktop:setup-save", values),
    setPages: (pages) => ipcRenderer.invoke("desktop:pages-set", pages),
    onPagesChanged: (fn) => {
      const listener = (_e, pages) => fn(pages)
      ipcRenderer.on("desktop:pages-changed", listener)
      return () => ipcRenderer.removeListener("desktop:pages-changed", listener)
    },
    chooseFolder: () => ipcRenderer.invoke("desktop:setup-choose-folder"),
    openFolder: () => ipcRenderer.invoke("desktop:setup-open-folder"),
  },
  // A copy of the AI and Tavily keys (encrypted by Windows), restored when the page's storage is empty.
  aiConfig: {
    get: () => ipcRenderer.invoke("desktop:ai-config-get"),
    set: (value) => ipcRenderer.invoke("desktop:ai-config-set", value),
  },
  // "Separate files" exports: the next `count` downloads go into Downloads\<name>.
  exportFolder: (name, count) => ipcRenderer.invoke("desktop:export-folder", name, count),
  // Where downloads and Poster Maker saves go (Settings → Downloads, Poster Maker → Save to folder).
  folders: {
    get: () => ipcRenderer.invoke("desktop:folders"),
    choose: (kind) => ipcRenderer.invoke("desktop:choose-folder", kind),
    reset: (kind) => ipcRenderer.invoke("desktop:reset-folder", kind),
    open: (kind) => ipcRenderer.invoke("desktop:open-folder", kind),
  },
  savePoster: (fileName, bytes) => ipcRenderer.invoke("desktop:save-poster", fileName, bytes),
  showFile: (file) => ipcRenderer.invoke("desktop:show-file", file),
  // Floating report: saves a copied article, poster or carousel image into the report folder.
  saveReportFile: (section, brand, fileName, bytes) => ipcRenderer.invoke("desktop:save-report-file", section, brand, fileName, bytes),
  // The Homes.ph Publisher Chrome extension: its requests (News Article post, template picture) are answered here.
  extension: {
    onRequest: (callback) => listen("desktop:extension-request", callback),
    reply: (id, ok, result) => ipcRenderer.invoke("desktop:extension-reply", id, ok, result),
    ready: () => ipcRenderer.send("desktop:extension-ready"),
    status: () => ipcRenderer.invoke("desktop:extension-status"),
    openFolder: () => ipcRenderer.invoke("desktop:extension-open-folder"),
    forget: () => ipcRenderer.invoke("desktop:extension-forget"),
  },
  // Dark / light: the title bar, window background and splash follow the app.
  setTheme: (theme) => ipcRenderer.invoke("desktop:set-theme", theme),
  // The always-on-top posting checklist for one carousel.
  openChecklist: (projectId) => ipcRenderer.invoke("desktop:open-checklist", projectId),
  // The always-on-top floating report ("yyyy-MM-dd", or "" for today).
  openReportFloat: (day) => ipcRenderer.invoke("desktop:open-report-float", day),
  // Floating quick-edit window. The main process checks which window each message comes from.
  float: {
    enable: () => ipcRenderer.invoke("float:enable"),
    disable: () => ipcRenderer.invoke("float:disable"),
    publish: (state) => ipcRenderer.send("float:state", state),
    onCommand: (callback) => listen("float:command", callback),
    onState: (callback) => listen("float:state", callback),
    requestState: () => ipcRenderer.send("float:request-state"),
    send: (command) => ipcRenderer.send("float:command", command),
    openMain: () => ipcRenderer.send("float:open-main"),
    close: () => ipcRenderer.send("float:close"),
  },
})

function listen(channel, callback) {
  const handler = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}
