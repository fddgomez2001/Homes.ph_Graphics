/*
 * Homes.ph Publisher on the phone: what `chrome` is to the extension's page scripts, inside one of the app's
 * pages (dash.homes.ph, homes.ph, dtr.homes.ph, messenger.com). Messages and storage go to the app's own page
 * (the extension's background runs there) through HPNative; answers and storage changes come back through
 * window.__hpIn. The app puts the extension's pictures (file name → data URL) where `assets` is set below.
 * Runs once per page, before shared.js.
 */
;(function () {
  if (window.__hpShim) return
  const native = window.HPNative
  if (!native || typeof native.postMessage !== "function") return
  Object.defineProperty(window, "__hpShim", { value: true })

  const assets = __HP_ASSETS__
  let seq = 0
  const waiting = new Map()
  const listeners = new Set()

  const ask = (kind, body) =>
    new Promise((resolve) => {
      const id = ++seq
      waiting.set(id, resolve)
      native.postMessage(JSON.stringify({ id, kind, body }))
    })

  Object.defineProperty(window, "__hpIn", {
    value: (text) => {
      let m = null
      try {
        m = JSON.parse(text)
      } catch {
        return
      }
      if (!m) return
      if (m.kind === "reply") {
        const done = waiting.get(m.id)
        waiting.delete(m.id)
        if (done) done(m.res)
      } else if (m.kind === "storage") {
        for (const fn of [...listeners]) {
          try {
            fn(m.changes || {}, "local")
          } catch (e) {
            console.warn("[Homes.ph Publisher]", e)
          }
        }
      }
    },
  })

  const chrome = window.chrome && typeof window.chrome === "object" ? window.chrome : {}
  chrome.runtime = {
    id: "homes-ph-publisher-phone",
    lastError: undefined,
    getURL: (path) => assets[String(path).replace(/^\//, "")] || "",
    sendMessage: (msg, reply) => {
      const answer = ask("message", msg)
      if (typeof reply === "function") answer.then(reply)
      else return answer
    },
  }
  chrome.storage = {
    local: {
      get: (keys) => ask("get", keys == null ? null : keys).then((r) => r || {}),
      set: (items) => ask("set", items).then(() => undefined),
      remove: (keys) => ask("remove", keys).then(() => undefined),
    },
    onChanged: {
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
    },
  }
  try {
    window.chrome = chrome
  } catch {
    // already there (the same object)
  }
})()
