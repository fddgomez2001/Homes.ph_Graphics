/*
 * Homes.ph Publisher on a homes.ph article (homes.ph/news/…), for Caraga and Gensan: clicks its "Copy link"
 * button, takes the short link it copies (https://homes.ph/s/hey2K) as the Facebook post's READ MORE link,
 * then goes on to Facebook Autopost.
 */
;(function () {
  const HP = globalThis.HP
  if (!/^\/news\/[^/]+/.test(location.pathname)) return

  /** What the page copied (homes-copy-main.js passes it on from the page). */
  let copied = ""
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__homesPhPublisherCopy !== true) return
    const t = String(e.data.text || "").trim()
    if (/^https?:\/\//i.test(t)) copied = t
  })

  const copyButton = () =>
    [...document.querySelectorAll('button[data-track="share.copy"], button[title="Copy link" i], button[aria-label="Copy link" i]')].find((b) => HP.visible(b)) ||
    [...document.querySelectorAll("button")].find((b) => HP.visible(b) && b.querySelector('img[alt="Copy link" i]')) ||
    null

  /** A short link the page shows (a "Link copied" message or a box), in case the copy itself isn't seen. */
  function shownShortLink() {
    const m = /https?:\/\/(?:www\.)?homes\.ph\/s\/[A-Za-z0-9_-]+/.exec(document.body ? document.body.innerText || "" : "")
    if (m) return m[0]
    const box = [...document.querySelectorAll("input, textarea")].find((i) => HP.isShortLink(i.value))
    return box ? box.value.trim() : ""
  }

  let running = false
  async function run() {
    if (running) return
    running = true
    try {
      await step()
    } finally {
      running = false
    }
  }

  async function step() {
    const job = await HP.myJob("short-link")
    if (!job) return
    const title = `${job.brandName} ${HP.timeLabel(job.time)}${job.day !== HP.ymd(new Date()) ? ` (${job.day})` : ""}`
    const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
    HP.banner({ title, text: "Getting the article's short link (Copy link)…", buttons: [stop] })

    const button = await HP.waitFor(copyButton, 20000)
    if (!(await HP.stillRunning(job))) return HP.hideBanner()
    if (!button) {
      // Just published: the page may not be ready yet. Twice more, then the full link.
      const tries = (job.shortTries || 0) + 1
      if (tries <= 2) {
        await HP.jobUpdate(job, { shortTries: tries }, "The article's homes.ph page isn't ready yet: opening it again")
        await HP.sleep(4000)
        location.reload()
        return
      }
      return goOn(job, job.longUrl || job.publicUrl, "No Copy link button on the article's homes.ph page: READ MORE uses the full link.")
    }

    let short = ""
    for (let i = 0; i < 3 && !short; i++) {
      copied = ""
      button.scrollIntoView({ block: "center" })
      button.click()
      short = (await HP.waitFor(() => (HP.isShortLink(copied) ? copied : shownShortLink() || null), 10000, 150)) || ""
    }
    if (short) return goOn(job, short.replace(/\/$/, ""), `Short link: ${short}`)
    if (copied && /^https?:\/\/(?:www\.)?homes\.ph\//i.test(copied)) return goOn(job, copied, `Copy link gave ${copied} (not a short link): READ MORE uses it.`)
    return goOn(job, job.longUrl || job.publicUrl, "The short link didn't come from Copy link: READ MORE uses the full link.")
  }

  async function goOn(job, url, note) {
    if (!(await HP.stillRunning(job))) return HP.hideBanner()
    await HP.jobUpdate(job, { publicUrl: url, shortUrl: HP.isShortLink(url) ? url : null, step: "fb-post" }, note)
    HP.banner({ title: `${job.brandName} ${HP.timeLabel(job.time)}`, text: `READ MORE: ${url}. Opening homes.ph Facebook Autopost…`, tone: "ok" })
    await HP.sleep(700)
    location.href = HP.AUTOPOST_URL
  }

  void run()
  HP.onStorage((changes, area) => {
    if (area === "local" && changes.job && changes.job.newValue && changes.job.newValue.step === "short-link") void run()
  })
})()
