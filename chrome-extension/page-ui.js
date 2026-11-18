/*
 * Homes.ph Publisher: the banner at the top of a page while it works there (which step, a countdown before
 * Publish / the Facebook post with Stop, errors), and the job helpers the page steps share.
 */
;(function () {
  const HP = globalThis.HP
  let host = null
  let shadow = null

  function ensure() {
    if (host && host.isConnected) return
    host = document.createElement("div")
    host.id = "homes-ph-publisher-banner"
    host.style.cssText = "all: initial; position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 2147483647;"
    shadow = host.attachShadow({ mode: "open" })
    ;(document.body || document.documentElement).appendChild(host)
  }

  /**
   * Shows the banner: { title, text, tone: "info" | "ok" | "error", buttons: [{ label, onClick, primary }] }.
   */
  HP.banner = function (b) {
    ensure()
    const colors = { info: ["#1428AE", "#fff"], ok: ["#047857", "#fff"], error: ["#B91C1C", "#fff"], wait: ["#B45309", "#fff"] }[b.tone || "info"]
    shadow.innerHTML = `<style>
      .b { font: 13px/1.4 "Segoe UI", system-ui, sans-serif; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 14px; background: ${colors[0]}; color: ${colors[1]}; box-shadow: 0 12px 30px rgba(0,0,0,.3); max-width: min(760px, calc(100vw - 32px)); }
      .b img { width: 26px; height: 26px; border-radius: 7px; background: #fff; padding: 2px; box-sizing: border-box; }
      .t { flex: 1; min-width: 0; } .t b { display: block; font-size: 13px; } .t span { opacity: .92; font-size: 12px; }
      button { all: unset; cursor: pointer; font: 700 12px "Segoe UI", sans-serif; padding: 6px 11px; border-radius: 9px; border: 1px solid rgba(255,255,255,.7); color: #fff; white-space: nowrap; }
      button.p { background: #fff; color: ${colors[0]}; border-color: #fff; }
      button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    </style>
    <div class="b" role="status" aria-live="polite"><img alt="" src="${HP.url("icon-48.png")}"><div class="t"><b></b><span></span></div></div>`
    shadow.querySelector(".t b").textContent = b.title || "Homes.ph Publisher"
    shadow.querySelector(".t span").textContent = b.text || ""
    const row = shadow.querySelector(".b")
    for (const btn of b.buttons || []) {
      const el = document.createElement("button")
      el.textContent = btn.label
      if (btn.primary) el.className = "p"
      el.addEventListener("click", btn.onClick)
      row.appendChild(el)
    }
  }

  HP.hideBanner = () => host && host.remove()

  /** The running job, when this tab is the one doing it. */
  HP.myJob = async function (step) {
    const [{ job }, me] = await Promise.all([HP.store.get("job"), HP.send({ type: "whoami" })])
    if (!job || job.tabId !== me.tabId) return null
    if (step && job.step !== step) return null
    return job
  }

  HP.jobUpdate = (job, patch, note) => HP.send({ type: "job-update", jobId: job.id, patch, note })

  /** The job stops here with a message the person can act on. */
  HP.jobFail = async function (job, error) {
    await HP.send({ type: "job-fail", jobId: job.id, error })
    HP.banner({ title: `${HP.jobName(job)}: stopped`, text: error, tone: "error", buttons: [{ label: "Close", onClick: HP.hideBanner }] })
  }

  /** True while the job hasn't been stopped (from the panel or the banner). */
  HP.stillRunning = async function (job) {
    const { job: now } = await HP.store.get("job")
    return !!now && now.id === job.id && !["stopped", "failed", "done"].includes(now.step)
  }

  /**
   * Waits `seconds` with a countdown in the banner (Stop / Do it now). Resolves true to go on, false when stopped.
   */
  HP.countdown = function (job, seconds, title, text) {
    return new Promise((resolve) => {
      let left = seconds
      let finished = false
      const finish = (go) => {
        if (finished) return
        finished = true
        clearInterval(timer)
        if (!go) void HP.send({ type: "stop-job" })
        resolve(go)
      }
      const show = () =>
        HP.banner({
          title,
          text: `${text} in ${left} s.`,
          tone: "wait",
          buttons: [
            { label: "Stop", onClick: () => finish(false) },
            { label: "Do it now", primary: true, onClick: () => finish(true) },
          ],
        })
      if (left <= 0) return finish(true)
      show()
      const timer = setInterval(async () => {
        if (!HP.alive()) return clearInterval(timer)
        left -= 1
        if (!(await HP.stillRunning(job))) return finish(false)
        if (left <= 0) finish(true)
        else show()
      }, 1000)
    })
  }

  HP.settings = async () => {
    const got = await HP.store.get(["settings", "assignment", "duty"])
    return HP.withDefaults(got.settings, got.assignment, got.duty)
  }
})()
