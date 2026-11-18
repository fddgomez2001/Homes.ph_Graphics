/*
 * Homes.ph Publisher: the floating button in the lower right of web pages. Its number is today's articles to
 * publish (yellow when one is due); click it for the panel (Posting, Trending News, Ads, Quotes, Reports).
 * When the extension is reloaded or updated, Chrome cuts this copy off: it takes its button away quietly
 * (the page's next load gets the new one).
 */
;(function () {
  if (window.top !== window || document.getElementById("homes-ph-publisher")) return
  const HP = globalThis.HP
  if (!HP || !HP.alive || !HP.alive()) return

  const host = document.createElement("div")
  host.id = "homes-ph-publisher"
  host.style.cssText = "all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;"
  const shadow = host.attachShadow({ mode: "open" })
  shadow.innerHTML = `<style>${HP.PANEL_CSS}
    .hp-fab { all: unset; cursor: pointer; position: relative; width: 56px; height: 56px; border-radius: 50%; background: #fff; display: grid; place-items: center; box-shadow: 0 8px 24px rgba(15,23,42,.28), 0 0 0 1px rgba(15,23,42,.08); transition: transform .15s; }
    .hp-fab:hover { transform: scale(1.06); }
    .hp-fab:focus-visible { outline: 3px solid #1428AE; outline-offset: 3px; }
    .hp-fab img { width: 34px; height: 34px; object-fit: contain; }
    .hp-badge { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #1428AE; color: #fff; font: 800 11px/20px "Segoe UI", system-ui, sans-serif; text-align: center; border: 2px solid #fff; }
    .hp-badge.late { background: #F59E0B; color: #422006; }
    .hp-ring { position: absolute; inset: -5px; border-radius: 50%; border: 3px solid #1428AE; border-right-color: transparent; animation: hp-spin 1s linear infinite; }
    .hp-bubble { position: absolute; right: 64px; bottom: 6px; white-space: nowrap; background: #0f172a; color: #fff; font: 600 12px/1.3 "Segoe UI", system-ui, sans-serif; padding: 8px 11px; border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,.25); cursor: pointer; }
    .hp-bubble::after { content: ""; position: absolute; right: -6px; bottom: 14px; border: 6px solid transparent; border-left-color: #0f172a; border-right: 0; }
    .hp-wrap { position: absolute; right: 0; bottom: 68px; }
  </style>
  <div class="hp-wrap" hidden></div>
  <span class="hp-bubble" hidden></span>
  <button class="hp-fab" aria-label="Homes.ph Publisher: articles to publish"><img alt="" src="${HP.url("icon-128.png")}"><span class="hp-badge" hidden></span></button>`

  const fab = shadow.querySelector(".hp-fab")
  const badge = shadow.querySelector(".hp-badge")
  const bubble = shadow.querySelector(".hp-bubble")
  const wrap = shadow.querySelector(".hp-wrap")
  let panel = null
  let bubbleShown = false

  const close = () => {
    panel?.destroy()
    panel = null
    wrap.hidden = true
  }
  const open = () => {
    if (!HP.alive()) return HP.die()
    bubble.hidden = true
    wrap.hidden = false
    panel = HP.mountPanel(wrap, { onClose: close, onStarted: close })
  }
  fab.addEventListener("click", () => (panel ? close() : open()))
  bubble.addEventListener("click", open)
  const onKey = (e) => e.key === "Escape" && panel && close()
  document.addEventListener("keydown", onKey)

  // Cut off (the extension was reloaded): the old button goes away, without errors.
  HP.onDead(() => {
    try {
      panel?.destroy()
    } catch {
      // gone
    }
    panel = null
    document.removeEventListener("keydown", onKey)
    host.remove()
  })

  async function update() {
    const got = await HP.store.get(["settings", "assignment", "boards", "done", "job"])
    const settings = HP.withDefaults(got.settings, got.assignment)
    const onTeamSite = /(^|\.)homes\.ph$/.test(location.hostname)
    if (!settings.showEverywhere && !onTeamSite) {
      host.remove()
      return
    }
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host)
    const { open: count, late } = HP.countToday(settings, got.boards || {}, got.done || {}, new Date())
    badge.hidden = !count
    badge.textContent = count > 99 ? "99+" : String(count)
    badge.classList.toggle("late", late > 0)
    const job = got.job
    const busy = job && !["done", "failed", "stopped"].includes(job.step)
    shadow.querySelector(".hp-ring")?.remove()
    if (busy) fab.insertAdjacentHTML("beforeend", '<span class="hp-ring"></span>')
    fab.setAttribute("aria-label", `Homes.ph Publisher: ${count} article${count === 1 ? "" : "s"} to post on Facebook today${late ? `, ${late} due` : ""}`)
    // The floating message, once per page: what's waiting.
    if (count && !bubbleShown && !panel) {
      bubbleShown = true
      bubble.textContent = late ? `${late} article${late === 1 ? " is" : "s are"} due: not on Facebook yet` : `${count} article${count === 1 ? "" : "s"} to post on Facebook today`
      bubble.hidden = false
      setTimeout(() => (bubble.hidden = true), 8000)
    }
  }

  HP.onStorage((changes, area) => {
    if (area === "local" && ["settings", "assignment", "boards", "done", "job"].some((k) => k in changes)) return update()
  })
  HP.every(60_000, update)
  void update().catch(() => {})
})()
