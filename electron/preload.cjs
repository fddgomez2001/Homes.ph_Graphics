// Exposes a tiny, explicit API to the app (window.desktop). No Node access for the page.
const { contextBridge, ipcRenderer } = require("electron")

const versionArg = process.argv.find((arg) => arg.startsWith("--dcm-version="))

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  version: versionArg ? versionArg.split("=")[1] : "",
  getConfig: () => ipcRenderer.invoke("desktop:get-config"),
  saveConfig: (values) => ipcRenderer.invoke("desktop:save-config", values),
  openDataFolder: () => ipcRenderer.invoke("desktop:open-data-folder"),
  // "Separate files" exports: the next `count` downloads go into Downloads\<name>.
  exportFolder: (name, count) => ipcRenderer.invoke("desktop:export-folder", name, count),
  // Dark / light: the title bar, window background and splash follow the app.
  setTheme: (theme) => ipcRenderer.invoke("desktop:set-theme", theme),
  // The always-on-top posting checklist for one carousel.
  openChecklist: (projectId) => ipcRenderer.invoke("desktop:open-checklist", projectId),
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
