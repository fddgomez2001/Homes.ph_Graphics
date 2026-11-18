/*
 * Homes.ph Publisher on homes.ph/dashboard/admin/facebook-autopost:
 *  - the job: Schedule Post → only the brand's Facebook Page ticked (FHI: FHI Global Dubai), the caption = the
 *    article's headline, the first comment = "READ MORE: <the article's address on its site>", the picture = the
 *    News Article template from Homes.ph SocMedSystem (or the article's photo), the time = the slot's time
 *    (Publish Now when it has passed). Then YOU check it and click Schedule Post (Options can make it click);
 *    once it's posted, back to the board, where the card gets its check.
 *  - a carousel job: Homes.ph SocMedSystem's carousel of the day → up to 4 of its Pages ticked (Main Page = "Homes.ph"),
 *    the caption = the carousel's caption, the slides attached in order (1.png = the cover, 2.png…), 11:00 PM on
 *    its day. You click Schedule Post; then the Pages are ticked on the app's posting checklist, and the next 4.
 *  - a post job (an advertisement, a Daily Trend News poster or a quote): only its Facebook Page ticked, its caption,
 *    its picture (the ad / poster drawn by Homes.ph SocMedSystem, or the quote's), its time. You click Schedule Post;
 *    then it's marked posted (the panel's pill turns green).
 *  - …/scheduled: checks the posts scheduled through the board are still there (a deleted one loses its green).
 */
;(function () {
  const HP = globalThis.HP
  const text = (el) => HP.oneLine(el && el.textContent)
  const onAutopost = () => /^\/dashboard\/admin\/facebook-autopost\/?$/.test(location.pathname)
  const onScheduled = () => /^\/dashboard\/admin\/facebook-autopost\/scheduled\/?$/.test(location.pathname)

  /** The "Create Facebook Post" window. */
  function dialog() {
    const caption = document.getElementById("post-caption") || document.querySelector('textarea[placeholder*="caption" i]')
    if (!caption) return null
    return caption.closest("[role=dialog], [aria-modal=true]") || climb(caption, (el) => /target facebook pages/i.test(el.textContent || "") && /publishing timing/i.test(el.textContent || ""))
  }

  function climb(el, ok) {
    for (let n = el; n && n !== document.body; n = n.parentElement) if (ok(n)) return n
    return null
  }

  const isOn = (box) => (box instanceof HTMLInputElement ? box.checked : box.getAttribute("aria-checked") === "true" || box.getAttribute("data-state") === "checked")

  /** Each page's checkbox in the window, with the row it's in. */
  function pageRows(root) {
    return [...root.querySelectorAll("input[type=checkbox], [role=checkbox]")]
      .filter((b) => HP.visible(b) || (b instanceof HTMLInputElement && HP.visible(b.parentElement)))
      .map((box) => ({ box, row: climb(box, (el) => /\bID\b\s*:/.test(el.textContent || "") || el.tagName === "LABEL" || el.tagName === "LI") || box.parentElement }))
      .filter((r) => r.row)
  }

  /** A row whose name is the page's name (exactly, else containing it). */
  function findPage(rows, name) {
    const exact = rows.filter((r) => [...r.row.querySelectorAll("*")].some((el) => el.children.length === 0 && HP.sameName(el.textContent, name)))
    if (exact.length) return { row: exact[0], count: exact.length }
    const near = rows.filter((r) => HP.norm(r.row.textContent).includes(HP.norm(name)))
    return { row: near[0] || null, count: near.length }
  }

  /** A box to type in (textarea, text input or editable text), visible. */
  const typeable = (root, except) =>
    [...root.querySelectorAll("textarea, input[type=text], input[type=url], input:not([type]), [contenteditable=''], [contenteditable=true]")].filter(
      (f) => f !== except && HP.visible(f) && !/search/i.test(f.getAttribute("placeholder") || ""),
    )

  /**
   * The first comment's box: by its own name (placeholder, label: comment, "see more", link), else the first box
   * under the "First Comment" heading (a textarea, a one-line box or editable text).
   */
  function commentField(root, caption) {
    const named = typeable(root, caption).find((f) => /comment|see more|read more|link|https?:/i.test([f.getAttribute("placeholder"), f.getAttribute("aria-label"), f.id, f.name].join(" ")))
    if (named) return named
    const heading = [...root.querySelectorAll("label, span, p, h3, h4, div")].find((el) => /first comment/i.test(el.textContent || "") && el.children.length < 4)
    for (let box = heading; box && box !== root.parentElement; box = box.parentElement) {
      const f = typeable(box, caption).filter((x) => !(caption && x.contains(caption)))
      if (f.length) return f[0]
    }
    return null
  }

  /** Types into a box (also an editable-text one). */
  function fill(el, value) {
    if (el.isContentEditable) {
      el.focus()
      el.textContent = value
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }))
      el.blur()
    } else HP.setValue(el, value)
  }
  const valueOf = (el) => (el.isContentEditable ? el.textContent : el.value)

  /** The window's last button (the one that schedules / posts), not the timing switch or the helpers. */
  function submitButton(root) {
    const timing = climb(root.querySelector("#sched-date") || root, (el) => /publishing timing/i.test(el.textContent || "") && el !== root) || null
    const buttons = [...root.querySelectorAll("button")].filter(
      (b) =>
        HP.visible(b) &&
        !(timing && timing.contains(b)) &&
        /^(schedule|publish|post|create post|send)/i.test(text(b)) &&
        !/schedule for later|select|insert|feed|story/i.test(text(b)),
    )
    return buttons.find((b) => b.type === "submit") || buttons[buttons.length - 1] || null
  }

  /** Opens the Create Facebook Post window (Schedule Post). Null, with the job stopped, when it doesn't open. */
  async function openDialog(job) {
    let root = dialog()
    if (!root) {
      const open = await HP.waitFor(() => HP.buttonByText(document, /^\+?\s*schedule post$/i), 25000)
      if (!open) {
        await HP.jobFail(job, "Facebook Autopost didn't show its Schedule Post button. Are you signed in to homes.ph as an admin?")
        return null
      }
      open.click()
      root = await HP.waitFor(dialog, 15000)
    }
    if (!root) await HP.jobFail(job, "The Create Facebook Post window didn't open.")
    return root
  }

  /** The post's time: scheduled (its date and time) or Publish Now. Returns what went wrong, or "". */
  async function setTiming(root, when) {
    const later = HP.buttonByText(root, /^schedule for later$/i)
    const nowBtn = HP.buttonByText(root, /^publish now$/i)
    if (when.mode === "later") {
      later?.click()
      await HP.sleep(250)
      const d = root.querySelector("#sched-date, input[type=date]")
      const t = root.querySelector("#sched-time, input[type=time]")
      if (!d || !t) return "The post's date and time boxes weren't found."
      HP.setValue(d, when.date)
      HP.setValue(t, when.time)
    } else {
      if (!nowBtn) return "The Publish Now switch wasn't found."
      nowBtn.click()
    }
    await HP.sleep(400)
    return ""
  }

  /**
   * Sending it: you check everything and click (or, with "click Schedule Post by itself" on, a countdown). Resolves
   * "toast" / "closed" (sent), "cancelled" (closed without clicking), "error", "stopped", or null (not confirmed).
   * info: { countdownTitle, countdownText, waitTitle, waitText, stop }.
   */
  async function awaitPost(root, submit, job, settings, info) {
    let clicked = false
    // The button that posts says "Schedule Post" or "Publish Now (1 Pages)"; the timing switch says just
    // "Schedule for Later" / "Publish Now" (that one doesn't post).
    const timingBox = climb(root.querySelector("#sched-date") || root, (el) => /publishing timing/i.test(el.textContent || "") && el !== root) || null
    const isSwitch = (b) => (!!timingBox && timingBox.contains(b)) || /^(schedule for later|publish now)$/i.test(text(b))
    const posts = (b) => b === submit || (/^(schedule|publish|post|create post|send)/i.test(text(b)) && !/select|insert|feed|story/i.test(text(b)) && !isSwitch(b))
    root.addEventListener(
      "click",
      (e) => {
        const b = e.target && e.target.closest ? e.target.closest("button") : null
        if (b && posts(b)) clicked = true
      },
      true,
    )
    if (settings.autoSchedule) {
      const go = await HP.countdown(job, settings.countdown, info.countdownTitle, info.countdownText)
      if (!go) return "stopped"
      submit.click()
      clicked = true
    } else {
      submit.style.outline = "3px solid #F59E0B"
      submit.style.outlineOffset = "2px"
      await HP.jobUpdate(job, { waitingForYou: true }, "Filled in: waiting for you to check it and click Schedule Post")
      HP.banner({ title: info.waitTitle, text: info.waitText, tone: "wait", buttons: [info.stop] })
    }
    let beat = Date.now()
    // Messages already on the page (the previous post's "scheduled") don't count for this one.
    const TOASTS = "[role=status], [role=alert], [data-sonner-toast], [class*=toast]"
    const stale = new Set(document.querySelectorAll(TOASTS))
    const sent = await HP.waitFor(async () => {
      if (!(await HP.stillRunning(job))) return "stopped"
      // Still here: the job isn't stalled while you check the post.
      if (Date.now() - beat > 60_000) {
        beat = Date.now()
        await HP.jobUpdate(job, { waitingForYou: true })
      }
      // Its button busy ("Publishing to Facebook…", "Scheduling…"): it was clicked, it may take a while.
      if (!clicked && submit.isConnected && /^(publishing|scheduling|posting|sending|uploading)\b/i.test(text(submit))) clicked = true
      const toasts = [...document.querySelectorAll(TOASTS)]
        .filter((t) => !stale.has(t))
        .map((t) => t.textContent)
        .join(" ")
      if (clicked && /error|failed|could not/i.test(toasts)) return "error"
      if (!root.isConnected || !HP.visible(root)) return clicked ? "closed" : "cancelled"
      if (clicked && /scheduled|published|posted|success/i.test(toasts)) return "toast"
      return null
    }, settings.autoSchedule ? 60_000 : 45 * 60_000, 400)
    await HP.jobUpdate(job, { waitingForYou: false })
    return sent
  }

  let running = false
  async function run() {
    if (running) return
    running = true
    try {
      if (onScheduled()) await readScheduled()
      else {
        await step()
        await carouselStep()
        await postStep()
      }
    } finally {
      running = false
    }
  }

  async function step() {
    if (!onAutopost()) return
    const job = await HP.myJob("fb-post")
    if (!job) return
    const settings = await HP.settings()
    const brand = settings.brands.find((b) => b.id === job.brandId)
    const title = `${job.brandName} ${HP.timeLabel(job.time)}${job.day !== HP.ymd(new Date()) ? ` (${job.day})` : ""}`
    const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
    HP.banner({ title, text: "Making the Facebook post…", buttons: [stop] })
    // The picture is being made meanwhile (Homes.ph SocMedSystem's News Article template).
    const picture = HP.send({ type: "job-image", jobId: job.id })

    const root = await openDialog(job)
    if (!root) return
    if (!(await HP.stillRunning(job))) return HP.hideBanner()

    // 1. Only the brand's Page.
    const search = root.querySelector('input[placeholder*="search connected pages" i], input[placeholder*="search" i]')
    if (search) {
      HP.setValue(search, brand.fbPage)
      await HP.sleep(500)
    }
    const page = await HP.waitFor(() => {
      const f = findPage(pageRows(root), brand.fbPage)
      return f.row ? f : null
    }, 10000)
    if (!page) return HP.jobFail(job, `No connected Facebook Page called "${brand.fbPage}". Change the brand's Page in the extension's Options.`)
    for (const r of pageRows(root)) if (r !== page.row && isOn(r.box)) r.box.click()
    if (!isOn(page.row.box)) page.row.box.click()
    await HP.sleep(300)
    if (!isOn(page.row.box)) page.row.row.click()
    await HP.sleep(200)
    if (!isOn(page.row.box)) return HP.jobFail(job, `Couldn't tick the "${brand.fbPage}" Page.`)
    if (search) HP.setValue(search, "")
    await HP.sleep(300)
    const ticked = pageRows(root).filter((r) => isOn(r.box)).length
    if (ticked > 1) return HP.jobFail(job, `${ticked} Pages are ticked: only "${brand.fbPage}" should be. Untick the others and click the time again.`)

    // 2. Caption: the headline.
    const caption = document.getElementById("post-caption") || root.querySelector("textarea")
    fill(caption, job.headline)

    // 3. First comment: READ MORE + the article's address on its site.
    const readMore = HP.readMore(job.publicUrl)
    let comment = commentField(root, caption)
    if (!comment) {
      // Some forms show the box after "Insert Link Template".
      const insert = HP.buttonByText(root, /insert link template/i)
      if (insert) {
        insert.click()
        comment = await HP.waitFor(() => commentField(root, caption), 3000)
      }
    }
    if (comment) {
      fill(comment, readMore)
      await HP.sleep(200)
      if (valueOf(comment) !== readMore) fill(comment, readMore)
      await HP.jobUpdate(job, {}, `First comment: ${readMore}`)
    } else await HP.jobUpdate(job, {}, "No first-comment box found: paste the READ MORE link yourself.")

    // 4. The picture.
    HP.banner({ title, text: "Attaching the picture…", buttons: [stop] })
    const got = await picture
    const input = root.querySelector('input[type=file][accept*="image"]') || root.querySelector("input[type=file]")
    if (got && got.picture && input) {
      const file = new File([HP.base64ToBlob(got.picture.base64, got.picture.type)], got.picture.name, { type: got.picture.type })
      HP.setFiles(input, [file])
      await HP.sleep(1200)
    } else if (!input) await HP.jobUpdate(job, {}, "No photo upload box found.")
    else await HP.jobUpdate(job, {}, "No picture to attach.")

    // 5. When: the slot's time, or now when the article is late.
    const when = HP.timing(job.day, job.time, new Date(), settings.nowWindow)
    const timingError = await setTiming(root, when)
    if (timingError) return HP.jobFail(job, timingError)
    const whenText = when.mode === "later" ? `scheduled for ${HP.timeLabel(when.time)}${when.date !== HP.ymd(new Date()) ? ` on ${when.date}` : ""}` : `posted now (the ${HP.timeLabel(job.time)} slot has passed)`
    await HP.jobUpdate(job, { facebookWhen: when }, `Facebook: ${brand.fbPage}, ${whenText}`)

    // 6. Sending it: you check everything and click (or, with "click Schedule Post by itself" on, a countdown).
    const submit = submitButton(root)
    if (!submit) return HP.jobFail(job, "Everything is filled in, but the button that posts wasn't found: click it yourself.")
    const sent = await awaitPost(root, submit, job, settings, {
      countdownTitle: `${title}: Facebook`,
      countdownText: `${text(submit)} to ${brand.fbPage} (${whenText})`,
      waitTitle: `${title}: check it, then click "${text(submit)}"`,
      waitText: `${brand.fbPage} · ${whenText} · caption = the headline · first comment = READ MORE ${HP.isShortLink(job.publicUrl) ? "short link" : brand.shortLink ? "full link (the short link didn't come)" : "link"}${got && got.picture ? ` · ${got.picture.fromApp ? "template" : "plain photo (Homes.ph SocMedSystem didn't answer)"} attached` : ""}. After it's posted you go back to the board.`,
      stop,
    })
    if (sent === "stopped") return HP.hideBanner()
    if (sent === "cancelled") return HP.jobFail(job, "The Create Facebook Post window was closed before Schedule Post was clicked. Click the time again to redo it.")
    if (sent === "error") return HP.jobFail(job, "Facebook Autopost showed an error. Check the window and try again.")
    if (!sent) return HP.jobFail(job, "The post wasn't confirmed. Check Scheduled Posts on Facebook Autopost.")
    const facebook = when.mode === "now" ? "posted" : "scheduled"
    await HP.send({ type: "job-done", jobId: job.id, facebook, note: `Facebook post ${whenText}` })
    // Back to the board (Sites or Cities, the slot's day): its card gets checked there.
    HP.banner({ title: `${title}: posted`, text: `The Facebook post is ${whenText} on ${brand.fbPage}. Going back to the board…`, tone: "ok" })
    const { url } = await HP.send({ type: "board-address", group: job.group, day: job.day })
    await HP.sleep(900)
    if (url) location.href = url
  }

  /** A Target Facebook Pages row as the carousel matcher reads it: { name, text }. */
  function rowInfo(r) {
    const leaves = [...r.row.querySelectorAll("*")]
      .filter((el) => el.children.length === 0)
      .map((el) => HP.oneLine(el.textContent))
      .filter(Boolean)
    const name = leaves.find((t) => !/^ID\s*:/i.test(t) && !/^(active|inactive|expired|connected|disconnected|token expired)$/i.test(t)) || HP.oneLine(r.row.textContent)
    return { name, text: HP.oneLine(r.row.textContent) }
  }

  /**
   * Puts the slides in the photo box in order (1.png, 2.png…): all at once when it takes several files, else one
   * after the other. Returns { ok, shown } (shown: previews counted, 0 when the window doesn't show them that way).
   */
  async function attachInOrder(root, files) {
    const input = () => root.querySelector('input[type=file][accept*="image"]') || root.querySelector("input[type=file]")
    const previews = () => [...root.querySelectorAll("img, video")].filter((m) => /^(blob:|data:)/.test(m.currentSrc || m.src || "")).length
    const before = previews()
    const first = input()
    if (!first) return { ok: false, shown: 0 }
    if (first.multiple || files.length === 1) {
      HP.setFiles(first, files)
      await HP.waitFor(() => (previews() - before >= files.length ? true : null), 8000, 300)
    } else {
      let seen = true
      for (let i = 0; i < files.length; i++) {
        const el = input()
        if (!el) break
        HP.setFiles(el, [files[i]])
        if (seen) seen = !!(await HP.waitFor(() => (previews() - before >= i + 1 ? true : null), 5000, 250))
        await HP.sleep(seen ? 300 : 1200)
      }
    }
    return { ok: true, shown: previews() - before }
  }

  async function carouselStep() {
    if (!onAutopost()) return
    const job = await HP.myJob("carousel-post")
    if (!job) return
    const settings = await HP.settings()
    const title = `Carousel ${HP.timeLabel(job.time)}${job.day !== HP.ymd(new Date()) ? ` (${job.day})` : ""} · post ${job.postNo}`
    const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
    const wanted = job.pages.map((p) => p.short).join(", ")
    HP.banner({ title, text: `Making the Facebook post for ${wanted}…`, buttons: [stop] })
    // The slides are drawn by Homes.ph SocMedSystem meanwhile.
    const images = HP.send({ type: "carousel-images", jobId: job.id })

    const root = await openDialog(job)
    if (!root) return
    if (!(await HP.stillRunning(job))) return HP.hideBanner()

    // 1. Its Pages (at most 4): every other Page unticked.
    const search = root.querySelector('input[placeholder*="search connected pages" i], input[placeholder*="search" i]')
    if (search && search.value) {
      HP.setValue(search, "")
      await HP.sleep(300)
    }
    const isPageRow = (r) => /\bID\b\s*:/.test(r.row.textContent || "")
    const pageList = () => {
      const rows = pageRows(root)
      return rows.some(isPageRow) ? rows.filter(isPageRow) : rows
    }
    if (!(await HP.waitFor(() => (pageList().length ? true : null), 10000))) return HP.jobFail(job, "Facebook Autopost listed no Facebook Pages (Target Facebook Pages is empty).")
    for (const r of pageList())
      if (isOn(r.box)) {
        r.box.click()
        await HP.sleep(120)
        if (isOn(r.box)) r.row.click()
        await HP.sleep(80)
      }
    const ticked = []
    const missing = []
    for (const p of job.pages) {
      const find = () => {
        const rows = pageList()
        const i = HP.matchCarouselPage(rows.map(rowInfo), p.target)
        return i >= 0 ? rows[i] : null
      }
      let row = find()
      if (!row && search) {
        HP.setValue(search, p.target.search)
        await HP.sleep(500)
        row = await HP.waitFor(find, 4000)
      }
      if (row) {
        if (!isOn(row.box)) row.box.click()
        await HP.sleep(250)
        if (!isOn(row.box)) row.row.click()
        await HP.sleep(200)
      }
      ;(row && isOn(row.box) ? ticked : missing).push(p)
      if (search && search.value) {
        HP.setValue(search, "")
        await HP.sleep(400)
      }
    }
    if (!ticked.length) return HP.jobFail(job, `None of these Pages is in Target Facebook Pages: ${wanted}. Type their Facebook names in the extension's Options → Carousel pages.`)
    const onNow = pageList().filter((r) => isOn(r.box)).length
    if (onNow !== ticked.length) return HP.jobFail(job, `${onNow} Pages are ticked instead of ${ticked.length} (${ticked.map((p) => p.short).join(", ")}). Fix the ticks and click Post again in the panel.`)
    const tickedNames = ticked.map((p) => p.short).join(", ")
    await HP.jobUpdate(job, { ticked: ticked.map((p) => p.key), missing: missing.map((p) => p.key) }, `Pages: ${tickedNames}${missing.length ? ` · not found: ${missing.map((p) => p.short).join(", ")}` : ""}`)

    // 2. The caption: the carousel's caption in Homes.ph SocMedSystem.
    const caption = document.getElementById("post-caption") || root.querySelector("textarea")
    if (job.caption) fill(caption, job.caption)
    else await HP.jobUpdate(job, {}, "The carousel has no caption in Homes.ph SocMedSystem: type it.")

    // 3. The slides, in order: 1.png (the cover), 2.png…
    HP.banner({ title, text: `Attaching the ${job.slides || ""} slides in order (1 = the cover)…`, buttons: [stop] })
    const got = await images
    let attached = null
    if (got && got.count) {
      const files = []
      for (let i = 0; i < got.count; i++) {
        const f = await HP.send({ type: "carousel-image", jobId: job.id, index: i })
        if (!f || f.error || !f.base64) break
        files.push(new File([HP.base64ToBlob(f.base64, f.type)], f.name, { type: f.type }))
      }
      attached = files.length === got.count ? await attachInOrder(root, files) : null
      if (attached && !attached.ok) await HP.jobUpdate(job, {}, "No photo upload box found.")
    } else if (got && got.error) await HP.jobUpdate(job, {}, `No slides: ${got.error}`)

    // 4. When: 11:00 PM on its day (Publish Now once that's passed).
    const when = HP.timing(job.day, job.time, new Date(), settings.nowWindow)
    const timingError = await setTiming(root, when)
    if (timingError) return HP.jobFail(job, timingError)
    const whenText = when.mode === "later" ? `scheduled for ${HP.timeLabel(when.time)}${when.date !== HP.ymd(new Date()) ? ` on ${when.date}` : ""}` : `posted now (${HP.timeLabel(job.time)} has passed)`
    await HP.jobUpdate(job, { facebookWhen: when }, `Facebook: ${tickedNames}, ${whenText}`)

    // 5. You check it and click Schedule Post.
    const submit = submitButton(root)
    if (!submit) return HP.jobFail(job, "Everything is filled in, but the button that posts wasn't found: click it yourself.")
    const n = got && got.count ? got.count : 0
    const slidesText = !n
      ? `NO SLIDES (${(got && got.error) || "Homes.ph SocMedSystem didn't answer"}): add them yourself`
      : !attached || !attached.ok
        ? `slides NOT attached: add 1.png–${n}.png yourself${got.savedTo ? ` from ${got.savedTo}` : ""}`
        : attached.shown && attached.shown < n
          ? `only ${attached.shown} of ${n} slides show: add the rest (1.png–${n}.png${got.savedTo ? `, in ${got.savedTo}` : ""})`
          : `${n} slides attached in order (1.png = cover … ${n}.png)${got.savedTo ? `, also saved in ${got.savedTo}` : ""}`
    const sent = await awaitPost(root, submit, job, settings, {
      countdownTitle: `${title}: Facebook`,
      countdownText: `${text(submit)} to ${tickedNames} (${whenText})`,
      waitTitle: `${title}: check it, then click "${text(submit)}"`,
      waitText: `${tickedNames} · ${whenText} · caption from Homes.ph SocMedSystem${job.caption ? "" : " (EMPTY: type it)"} · ${slidesText}${missing.length ? ` · NOT FOUND in Target Facebook Pages: ${missing.map((p) => p.short).join(", ")}` : ""}. After it's posted, these Pages are ticked on the app's checklist.`,
      stop,
    })
    if (sent === "stopped") return HP.hideBanner()
    if (sent === "cancelled") return HP.jobFail(job, "The Create Facebook Post window was closed before Schedule Post was clicked. Click Post again in the panel to redo it.")
    if (sent === "error") return HP.jobFail(job, "Facebook Autopost showed an error. Check the window and try again.")
    if (!sent) return HP.jobFail(job, "The post wasn't confirmed. Check Scheduled Posts on Facebook Autopost.")
    const facebook = when.mode === "now" ? "posted" : "scheduled"
    const res = await HP.send({ type: "carousel-done", jobId: job.id, facebook, keys: ticked.map((p) => p.key), note: `Facebook post ${whenText}` })
    const next = res && res.next
    const appText = res && res.checkedInApp ? `✓ Ticked on Homes.ph SocMedSystem's checklist (${res.done}/${res.total}).` : `Not ticked in Homes.ph SocMedSystem yet (${(res && res.appError) || "it didn't answer"}): it's ticked when the app is open.`
    HP.banner({
      title: `Carousel posted: ${tickedNames}`,
      text: `The Facebook post is ${whenText}. ${appText}${next ? ` Next: post ${next.n} (${next.pages.join(", ")}).` : " Every page of the carousel is posted."}`,
      tone: "ok",
      buttons: next
        ? [
            { label: `Post ${next.n}: ${next.pages.length} page${next.pages.length === 1 ? "" : "s"}`, primary: true, onClick: () => void HP.send({ type: "carousel-next", jobId: job.id }) },
            { label: "Close", onClick: HP.hideBanner },
          ]
        : [{ label: "Close", onClick: HP.hideBanner }],
    })
  }

  /**
   * Only this Page ticked in Target Facebook Pages (every other one unticked): by its exact name, else the one
   * Page whose name has it. Returns what went wrong, or "".
   */
  async function tickOnly(root, name) {
    const search = root.querySelector('input[placeholder*="search connected pages" i], input[placeholder*="search" i]')
    if (search && search.value) {
      HP.setValue(search, "")
      await HP.sleep(300)
    }
    const isPageRow = (r) => /\bID\b\s*:/.test(r.row.textContent || "")
    const pageList = () => {
      const rows = pageRows(root)
      return rows.some(isPageRow) ? rows.filter(isPageRow) : rows
    }
    if (!(await HP.waitFor(() => (pageList().length ? true : null), 10000))) return "Facebook Autopost listed no Facebook Pages (Target Facebook Pages is empty)."
    for (const r of pageList())
      if (isOn(r.box)) {
        r.box.click()
        await HP.sleep(120)
        if (isOn(r.box)) r.row.click()
        await HP.sleep(80)
      }
    const target = { names: [name], keywords: [], id: null, search: name }
    const find = () => {
      const rows = pageList()
      const i = HP.matchCarouselPage(rows.map(rowInfo), target)
      if (i >= 0) return rows[i]
      const f = findPage(rows, name)
      return f.row && f.count === 1 ? f.row : null
    }
    let row = find()
    if (!row && search) {
      HP.setValue(search, name)
      await HP.sleep(500)
      row = await HP.waitFor(find, 4000)
    }
    if (!row) {
      if (search && search.value) HP.setValue(search, "")
      return `No connected Facebook Page called "${name}". Change the Page's name in the extension's Options (Brands), then click the post again.`
    }
    if (!isOn(row.box)) row.box.click()
    await HP.sleep(250)
    if (!isOn(row.box)) row.row.click()
    await HP.sleep(200)
    if (!isOn(row.box)) return `Couldn't tick the "${name}" Page.`
    if (search && search.value) {
      HP.setValue(search, "")
      await HP.sleep(400)
    }
    const onNow = pageList().filter((r) => isOn(r.box)).length
    if (onNow !== 1) return `${onNow} Pages are ticked: only "${name}" should be. Fix the ticks and click the post again in the panel.`
    return ""
  }

  /** An advertisement, a Daily Trend News poster or a quote: one picture to its one Page, its caption, its time. */
  async function postStep() {
    if (!onAutopost()) return
    const job = await HP.myJob("image-post")
    if (!job) return
    const settings = await HP.settings()
    const title = `${job.label}${job.day !== HP.ymd(new Date()) ? ` (${job.day})` : ""}`
    const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
    const kind = { ad: "advertisement", trend: "Daily Trend News poster", quote: "quote" }[job.what] || "post"
    HP.banner({ title, text: `Making the Facebook post (${kind}) for ${job.pageName}…`, buttons: [stop] })
    // The picture is drawn meanwhile (Homes.ph SocMedSystem's newest design, or the quote's).
    const picture = HP.send({ type: "post-image", jobId: job.id })

    const root = await openDialog(job)
    if (!root) return
    if (!(await HP.stillRunning(job))) return HP.hideBanner()

    // 1. Only its Page.
    const pageError = await tickOnly(root, job.pageName)
    if (pageError) return HP.jobFail(job, pageError)
    await HP.jobUpdate(job, {}, `Page: ${job.pageName}`)

    // 2. The caption.
    const caption = document.getElementById("post-caption") || root.querySelector("textarea")
    if (caption && job.caption) {
      fill(caption, job.caption)
      await HP.sleep(200)
      if (valueOf(caption) !== job.caption) fill(caption, job.caption)
    }

    // 3. The picture.
    HP.banner({ title, text: "Attaching the picture…", buttons: [stop] })
    const got = await picture
    let attached = null
    if (got && got.base64) {
      const file = new File([HP.base64ToBlob(got.base64, got.type || "image/png")], got.name || "post.png", { type: got.type || "image/png" })
      attached = await attachInOrder(root, [file])
    }

    // 4. When: its time on its day (Publish Now once that's passed).
    const when = HP.timing(job.day, job.time, new Date(), settings.nowWindow)
    const timingError = await setTiming(root, when)
    if (timingError) return HP.jobFail(job, timingError)
    const whenText = when.mode === "later" ? `scheduled for ${HP.timeLabel(when.time)}${when.date !== HP.ymd(new Date()) ? ` on ${when.date}` : ""}` : `posted now (${HP.timeLabel(job.time)} has passed)`
    await HP.jobUpdate(job, { facebookWhen: when }, `Facebook: ${job.pageName}, ${whenText}`)

    // 5. You check it and click Schedule Post.
    const submit = submitButton(root)
    if (!submit) return HP.jobFail(job, "Everything is filled in, but the button that posts wasn't found: click it yourself.")
    const pictureText = !got || got.error || !got.base64 ? `NO PICTURE (${(got && got.error) || "it didn't come"}): add it yourself` : !attached || !attached.ok ? "picture NOT attached (no photo box): add it yourself" : `picture attached${got.savedTo ? ` (also saved in ${got.savedTo})` : ""}`
    const sent = await awaitPost(root, submit, job, settings, {
      countdownTitle: `${title}: Facebook`,
      countdownText: `${text(submit)} to ${job.pageName} (${whenText})`,
      waitTitle: `${title}: check it, then click "${text(submit)}"`,
      waitText: `${job.pageName} · ${whenText} · caption${job.caption ? "" : " EMPTY: type it"} · ${pictureText}. After it's posted, its pill in the panel turns green.`,
      stop,
    })
    if (sent === "stopped") return HP.hideBanner()
    if (sent === "cancelled") return HP.jobFail(job, "The Create Facebook Post window was closed before Schedule Post was clicked. Click it again in the panel to redo it.")
    if (sent === "error") return HP.jobFail(job, "Facebook Autopost showed an error. Check the window and try again.")
    if (!sent) return HP.jobFail(job, "The post wasn't confirmed. Check Scheduled Posts on Facebook Autopost; if it's there, mark it posted in the panel (✓).")
    const facebook = when.mode === "now" ? "posted" : "scheduled"
    const res = await HP.send({ type: "post-done", jobId: job.id, facebook, note: `Facebook post ${whenText}` })
    HP.banner({ title: `${title}: posted`, text: `The Facebook post is ${whenText} on ${job.pageName}.${res && res.appNote ? res.appNote : ""} Its pill in the panel is green.`, tone: "ok", buttons: [{ label: "Close", onClick: HP.hideBanner }] })
  }

  /**
   * Scheduled Posts: each post scheduled through the board for a time still to come should be listed here. One
   * whose row says deleted / cancelled, or that isn't in the whole (unfiltered, single-page) list twice in a row,
   * was deleted: the panel shows it's not on Facebook any more. Anything less certain changes nothing.
   */
  async function readScheduled() {
    const { expected } = await HP.send({ type: "fb-expected" })
    if (!expected || !expected.length) return
    // Until the list has loaded (its text stops changing).
    let size = -1
    let still = 0
    for (let i = 0; i < 40 && still < 4; i++) {
      await HP.sleep(500)
      const n = (document.body.innerText || "").length
      still = n === size ? still + 1 : 0
      size = n
    }
    const all = document.body.innerText || ""
    // A sign-in page isn't Scheduled Posts.
    if (!/schedul/i.test(all) || /sign in|log in/i.test(all.slice(0, 400)) && !/scheduled post/i.test(all)) return
    // A long list loads more as it is scrolled: go to its end (and back) before reading it.
    const top = window.scrollY
    for (let i = 0, last = -1; i < 8; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight)
      await HP.sleep(400)
      const n = (document.body.innerText || "").length
      if (n === last) break
      last = n
    }
    window.scrollTo(0, top)
    const rows = scheduledRows()
    const found = HP.checkScheduled(expected, rows, listIsComplete(rows.length))
    const reply = await HP.send({ type: "fb-scheduled", present: found.present, removed: found.removed, missing: found.missing })
    const flagged = (reply && reply.flagged) || 0
    if (flagged)
      HP.banner({
        title: "Homes.ph Publisher",
        text: `${flagged} post${flagged === 1 ? "" : "s"} scheduled through the board ${flagged === 1 ? "isn't" : "aren't"} here any more (deleted): the panel shows ${flagged === 1 ? "it" : "them"} as not on Facebook.`,
        tone: "error",
        buttons: [{ label: "OK", onClick: HP.hideBanner }],
      })
  }

  const WHEN = /\b[a-z]{3}[a-z]*\.?\s+\d{1,2},?\s+\d{4},?\s+(?:at\s+)?\d{1,2}:\d{2}\s*[ap]\.?\s*m/gi

  /** Each post listed on Scheduled Posts: the biggest block around a date and time that holds only that one. */
  function scheduledRows() {
    const count = (el) => ((el.textContent || "").match(WHEN) || []).length
    const seen = new Set()
    const rows = []
    for (const leaf of document.querySelectorAll("body *")) {
      // The smallest element holding the date and time (they may be in separate spans inside it).
      if (count(leaf) !== 1 || [...leaf.children].some((c) => count(c) === 1)) continue
      let row = leaf
      while (row.parentElement && row.parentElement !== document.body && count(row.parentElement) === 1) row = row.parentElement
      if (seen.has(row)) continue
      seen.add(row)
      const text = HP.oneLine(row.innerText || row.textContent)
      // The "Next Scheduled Broadcast" box at the top has a date and time too, but isn't a post.
      if (!/next scheduled broadcast/i.test(text)) rows.push({ text })
    }
    return rows
  }

  /**
   * Is every scheduled post listed? Not when the list is filtered (a status or a Page chosen, words in its
   * search box), has more pages, or shows nothing at all without saying it's empty.
   */
  function listIsComplete(rowCount) {
    for (const s of document.querySelectorAll("select")) {
      const chosen = s.selectedOptions && s.selectedOptions[0] ? HP.oneLine(s.selectedOptions[0].textContent) : ""
      if (chosen && !/^all\b/i.test(chosen)) return false
    }
    for (const i of document.querySelectorAll('input[type=search], input[placeholder*="search" i]')) if ((i.value || "").trim()) return false
    const all = document.body.innerText || ""
    const more = [...document.querySelectorAll("button, a, [role=button]")].some((b) => {
      if (b.disabled || b.getAttribute("aria-disabled") === "true") return false
      const label = HP.oneLine(`${b.textContent || ""} ${b.getAttribute("aria-label") || ""}`)
      return /^(next|next page|load more|show more|view more|see more|›|»)(\s|$)/i.test(label) || /\bnext page\b/i.test(label)
    })
    if (more) return false
    const pages = /\bpage\s+\d+\s+of\s+(\d+)/i.exec(all)
    if (pages && Number(pages[1]) > 1) return false
    const shown = /\b(\d+)\s*(?:-|–|to)\s*(\d+)\s+of\s+(\d+)/i.exec(all)
    if (shown && Number(shown[3]) > Number(shown[2])) return false
    return rowCount > 0 || /no scheduled posts|nothing scheduled|no posts (found|scheduled)/i.test(all)
  }

  void run()
  let href = location.href
  HP.every(500, () => {
    if (location.href === href) return
    href = location.href
    void run()
  })
  HP.onStorage((changes, area) => {
    if (area === "local" && changes.job && changes.job.newValue && ["fb-post", "carousel-post", "image-post"].includes(changes.job.newValue.step)) void run()
  })
})()
