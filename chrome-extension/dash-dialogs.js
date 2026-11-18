/*
 * Homes.ph Publisher 1.2.0 on dash.homes.ph/super_editor/posts: posting through the board's own windows.
 *
 * An article (a time pill): its card opens the "Scheduled Post" window → the green Publish → "Publish article":
 * Clear all, then only the page's sites (Main News Portal + Homes for a Homes.ph page; + fhiglobal and Rentsouq for
 * FHI; + PicklePlay…) → Publish → Send to Facebook → its window (date, time, Pages, caption and first comment are
 * filled in by the dash): the News Article picture from Homes.ph SocMedSystem is uploaded ("Upload your own
 * images"), then Post now. Then the card gets its check (dash-posts.js).
 *
 * The carousel: the Sites board's Create Post → Add images (the slides from the app, 1.png first) → Planner
 * "Others": every city picked, 11:00 PM on its day → Pages: every Homes.ph Page ticked (Main Page = "Homes.ph"),
 * nothing else → the caption from the app → Post now.
 *
 * Loaded before dash-posts.js, which calls HP.dash.postArticle / HP.dash.postCarousel.
 */
;(function () {
  const HP = globalThis.HP
  const text = (el) => HP.oneLine(el && el.textContent)
  const dash = (HP.dash = {})

  // ---------- finding things in the dash's windows ----------

  const buttons = (root) => [...(root || document).querySelectorAll("button")].filter((b) => HP.visible(b))
  /** A visible button whose words match (the first one, or the last one with `last`). */
  const button = (root, re, last) => {
    const list = buttons(root).filter((b) => re.test(text(b)))
    return (last ? list[list.length - 1] : list[0]) || null
  }
  /** The visible element whose own words are exactly `re` (a window's title). */
  const heading = (re) =>
    [...document.querySelectorAll("h1, h2, h3, h4, [role=heading], p, span, div")].filter((e) => HP.visible(e) && e.children.length <= 2 && re.test(text(e))).sort((a, b) => text(a).length - text(b).length)[0] || null
  /** The smallest box around `el` that `ok` accepts (its window). */
  const boxOf = (el, ok) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) if (ok(n)) return n
    return null
  }
  dash.boxOf = boxOf
  dash.button = button

  /** The "Scheduled Post" window: its title, with the Send to Facebook button in it. */
  dash.scheduledWindow = () => {
    const title = heading(/^scheduled post$/i)
    if (title) {
      const box = boxOf(title, (n) => !!button(n, /^send to facebook$/i) || !!button(n, /^publish$/i))
      if (box) return box
    }
    const send = button(document, /^send to facebook$/i)
    return send ? boxOf(send, (n) => /scheduled post/i.test(text(n).slice(0, 400))) : null
  }

  /** "Publish article": its site checkboxes (label = box + name), Clear all and Publish. */
  dash.publishWindow = () => {
    const title = heading(/^publish article$/i)
    if (!title) return null
    const box = boxOf(title, (n) => n.querySelectorAll("input[type=checkbox]").length > 1 && !!button(n, /^publish$/i, true))
    if (!box) return null
    const labels = [...box.querySelectorAll("label")].filter((l) => l.querySelector("input[type=checkbox]"))
    const clear = [...box.querySelectorAll("button, a, span, [role=button]")].find((e) => HP.visible(e) && /^clear all$/i.test(text(e))) || null
    return { box, labels, clear, publish: button(box, /^publish$/i, true) }
  }

  /** "Send to Facebook": its picture upload, Pages, caption and Post now. */
  dash.facebookWindow = () => {
    const title = heading(/^send to facebook$/i)
    const post = (n) => button(n, /^post now$/i) || button(n, /^schedule( post)?$/i)
    const box = title ? boxOf(title, (n) => !!post(n)) : null
    if (!box) return null
    return { box, post: post(box) }
  }

  const siteName = (label) => text(label.querySelector("span")) || text(label)
  const ticked = (label) => {
    const input = label.querySelector("input[type=checkbox]")
    return !!input && input.checked
  }
  /** Ticks or unticks a checkbox label (the label's click, else the box's own). */
  async function setTick(label, on) {
    if (ticked(label) === on) return true
    label.click()
    await HP.sleep(220)
    if (ticked(label) !== on) {
      const input = label.querySelector("input[type=checkbox]")
      if (input) input.click()
      await HP.sleep(220)
    }
    return ticked(label) === on
  }
  dash.setTick = setTick

  // ---------- the article ----------

  /**
   * Publishes the open card's article (if it isn't yet) and sends its Facebook post. Returns { error } or
   * { facebook: "posted" | "scheduled" }. The job is updated along the way (its log shows in the panel).
   */
  dash.postArticle = async function (job, brand, settings) {
    const title = `${job.brandName} ${HP.timeLabel(job.time)}`
    const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
    const win = await HP.waitFor(dash.scheduledWindow, 15000)
    if (!win) return { error: "The card's window (Scheduled Post) didn't open. Click the card on the board, then the time again." }

    // What the Facebook post needs: the headline, the linked article's photo and address.
    const read = () => {
      const w = dash.scheduledWindow() || win
      const link = [...w.querySelectorAll('a[href*="/super_editor/articles/"], a[href*="/news/"]')].find((a) => HP.visible(a)) || null
      const img = [...w.querySelectorAll("img")].find((i) => HP.visible(i) && /amazonaws|cloudinary|\/articles?\/|\/uploads?\//.test(i.currentSrc || i.src)) || w.querySelector("img")
      const titleBox = [...w.querySelectorAll("*")].find((e) => /^title$/i.test(text(e)) && e.children.length === 0)
      const headline = titleBox ? text(titleBox.parentElement && titleBox.parentElement.nextElementSibling) || "" : ""
      return { headline: headline || job.title, imageUrl: img ? img.currentSrc || img.src : "", articleUrl: link ? new URL(link.getAttribute("href"), location.href).toString() : "" }
    }
    let info = read()
    await HP.jobUpdate(job, { headline: info.headline, imageUrl: info.imageUrl, articleUrl: info.articleUrl }, `Opened the card: ${info.headline}`)

    // 1. Publish (the green button), unless it's published already.
    const green = button(dash.scheduledWindow() || win, /^publish$/i)
    if (!green || job.sitePublished) {
      await HP.jobUpdate(job, { alreadyPublished: true }, "Already published: not published again.")
    } else {
      HP.banner({ title, text: "Publishing: opening Publish article…", buttons: [stop] })
      green.click()
      const pub = await HP.waitFor(dash.publishWindow, 15000)
      if (!pub) return { error: "Publish article didn't open." }
      // Clear all, then only the page's sites.
      if (pub.clear) {
        pub.clear.click()
        await HP.sleep(400)
      } else {
        for (const l of pub.labels) await setTick(l, false)
      }
      const want = HP.publishSites(brand)
      const missing = []
      for (const site of want) {
        const label = (dash.publishWindow() || pub).labels.find((l) => HP.sameName(siteName(l), site))
        if (!label) missing.push(site)
        else await setTick(label, true)
      }
      if (missing.length) return { error: `"Publish to" has no ${missing.map((m) => `"${m}"`).join(" or ")}. Change the page's sites in the extension's Options.` }
      const now = dash.publishWindow() || pub
      for (const l of now.labels) if (ticked(l) && !want.some((s) => HP.sameName(siteName(l), s))) await setTick(l, false)
      const on = now.labels.filter(ticked).map(siteName)
      await HP.jobUpdate(job, { publishedTo: on }, `Publish to (after Clear all): ${on.join(", ")}`)
      if (!settings.autoPublish) {
        HP.banner({ title: `${title}: ready to publish`, text: `Ticked: ${on.join(", ")}. Click Publish; the Facebook post comes next.`, tone: "wait", buttons: [stop] })
        const gone = await waitUntil(job, () => !dash.publishWindow(), 10 * 60_000)
        if (!gone) return { stopped: true }
      } else {
        const go = await HP.countdown(job, settings.countdown, `${title}: publishing`, `Publishing to ${on.join(", ")}`)
        if (!go) return { stopped: true }
        const btn = (dash.publishWindow() || now).publish
        if (!btn) return { error: "Publish article has no Publish button." }
        btn.click()
      }
      HP.banner({ title, text: "Publishing…", buttons: [stop] })
      const done = await HP.waitFor(() => {
        if (/could not publish|failed to publish/i.test(document.body.innerText || "")) return "failed"
        return !dash.publishWindow() ? true : null
      }, 30000)
      if (done === "failed") return { error: "The dash couldn't publish the article. Check the board, then click the time again." }
      if (!done) await HP.jobUpdate(job, {}, "Publish article is still open; going on.")
      else await HP.jobUpdate(job, {}, "Published.")
      await HP.sleep(800)
      info = { ...info, ...read() }
    }
    if (!(await HP.stillRunning(job))) return { stopped: true }

    // 2. The picture: the News Article template from the app (pages with one), made while the window opens.
    const picture = brand.appBrand ? HP.send({ type: "job-image", jobId: job.id }) : Promise.resolve({ picture: null })
    // 3. Send to Facebook.
    const w2 = dash.scheduledWindow()
    const send = w2 && button(w2, /^send to facebook$/i)
    if (!send) return { error: "The card's window has no Send to Facebook button." }
    HP.banner({ title, text: "Opening Send to Facebook…", buttons: [stop] })
    send.click()
    const fb = await HP.waitFor(dash.facebookWindow, 20000)
    if (!fb) return { error: "Send to Facebook didn't open." }
    await HP.sleep(800)
    HP.banner({ title, text: brand.appBrand ? "Getting the News Article picture from Homes.ph SocMedSystem…" : "Checking the post…", buttons: [stop] })
    const got = await picture
    if (got && got.picture) {
      const ok = await dash.uploadPicture(job, got.picture)
      if (!ok) await HP.jobUpdate(job, {}, "Couldn't upload the picture: the dash's own picture is used.")
    } else if (brand.appBrand) {
      await HP.jobUpdate(job, {}, "No picture from Homes.ph SocMedSystem: the dash's own picture is used.")
    }
    if (!(await HP.stillRunning(job))) return { stopped: true }

    // 4. Post now (the dash has the date, time, Pages, caption and first comment ready).
    const timing = HP.timing(job.day, job.time, new Date(), settings.nowWindow)
    const facebook = timing.mode === "now" ? "posted" : "scheduled"
    return dash.postNow(job, `${title}: Send to Facebook`, settings, facebook)
  }

  /** Waits (while the job runs) until `done()` says so; false when the job stops or time runs out. */
  async function waitUntil(job, done, ms) {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (done()) return true
      if (!(await HP.stillRunning(job))) return false
      await HP.sleep(500)
    }
    return false
  }

  /** The picture input of Send to Facebook ("Upload your own images", else "Add images"). */
  const pictureInput = (box) =>
    box.querySelector('label[title="Upload your own images" i] input[type=file]') ||
    [...box.querySelectorAll("label")].filter((l) => /add images|upload/i.test(text(l) + " " + (l.getAttribute("title") || ""))).map((l) => l.querySelector("input[type=file]")).find(Boolean) ||
    box.querySelector('input[type=file][accept*="image"]')
  dash.pictureInput = pictureInput

  /** The post's picture: the app's, uploaded in place of the dash's template (any other picture taken off). */
  dash.uploadPicture = async function (job, pic) {
    const fb = dash.facebookWindow()
    if (!fb) return false
    const input = pictureInput(fb.box)
    if (!input) return false
    // The post's pictures (not icons or the Page's avatar): shown at a size.
    const shown = (box) => [...box.querySelectorAll("img")].filter((i) => HP.visible(i) && (i.offsetWidth >= 40 || i.naturalWidth >= 200))
    const before = shown(fb.box).map((i) => i.currentSrc || i.src)
    const file = new File([HP.base64ToBlob(pic.base64, pic.type)], pic.name, { type: pic.type })
    HP.setFiles(input, [file])
    // The new picture shows (a new image in the preview).
    const added = await HP.waitFor(() => {
      const box = (dash.facebookWindow() || fb).box
      return shown(box).some((i) => !before.includes(i.currentSrc || i.src)) ? true : null
    }, 15000)
    // The dash's own template, if it stayed next to ours: taken off (its remove button). Only once ours shows.
    const box = (dash.facebookWindow() || fb).box
    let removed = 0
    for (const img of added ? shown(box) : []) {
      if (!before.includes(img.currentSrc || img.src)) continue
      const tile = boxOf(img, (n) => !!n.querySelector('button[aria-label*="remove" i], button[title*="remove" i]') && n.querySelectorAll("img").length === 1)
      const x = tile && tile.querySelector('button[aria-label*="remove" i], button[title*="remove" i]')
      if (x) {
        x.click()
        removed++
        await HP.sleep(300)
      }
    }
    await HP.jobUpdate(job, { pictureUploaded: !!added }, added ? `Picture uploaded: ${pic.name}${removed ? ` (the dash's ${removed === 1 ? "picture" : `${removed} pictures`} taken off)` : ""}` : `Picture sent to the dash (${pic.name}); its preview didn't change yet.`)
    return true
  }

  /** Post now (after the countdown, or you click it), then waits for the window to close. */
  dash.postNow = async function (job, title, settings, facebook) {
    const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
    let fb = dash.facebookWindow()
    if (!fb) return { error: "Send to Facebook closed before Post now." }
    if (settings.autoPost === false) {
      HP.banner({ title: `${title}: ready`, text: `Check the picture, Pages and caption, then click ${text(fb.post)}.`, tone: "wait", buttons: [stop] })
      const clicked = await new Promise((resolve) => {
        fb.post.addEventListener("click", () => resolve(true), { once: true })
        const watch = setInterval(async () => {
          if (!dash.facebookWindow() || !(await HP.stillRunning(job))) {
            clearInterval(watch)
            resolve(!dash.facebookWindow())
          }
        }, 1000)
      })
      if (!clicked) return { stopped: true }
    } else {
      const go = await HP.countdown(job, settings.countdown, `${title}`, `Posting now: ${facebook === "posted" ? "on Facebook right away" : `scheduled for ${HP.timeLabel(job.time)}`}`)
      if (!go) return { stopped: true }
      fb = dash.facebookWindow()
      if (!fb) return { error: "Send to Facebook closed before Post now." }
      fb.post.click()
    }
    HP.banner({ title, text: "Sending to Facebook…" })
    const sent = await HP.waitFor(() => {
      const toast = [...document.querySelectorAll("[role=status], [role=alert], [data-sonner-toast], [class*=toast]")].map((t) => text(t)).join(" ")
      if (/fail|error|couldn.t|could not/i.test(toast) && dash.facebookWindow()) return "failed"
      return !dash.facebookWindow() ? true : null
    }, 90000)
    if (sent === "failed") return { error: "The dash couldn't send the Facebook post. Check its window, then click the time again." }
    if (!sent) return { error: "Send to Facebook is still open after 90 seconds. Check it on the board." }
    return { facebook }
  }

  // ---------- the carousel ----------

  /** "Others" / "Cities" / "Sites" in the Planner: the one asked for clicked. */
  async function plannerTab(box, re) {
    const tab = [...box.querySelectorAll("button, [role=tab]")].find((b) => HP.visible(b) && re.test(text(b)))
    if (tab && tab.getAttribute("aria-selected") !== "true" && tab.getAttribute("aria-pressed") !== "true") {
      tab.click()
      await HP.sleep(400)
    }
    return !!tab
  }

  /** Picks a select's option the way React sees it: one change (two could pick it and take it back). */
  const pickOption = (sel, value) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, value)
    sel.dispatchEvent(new Event("change", { bubbles: true }))
  }

  /** Sets an input's value the way React sees it. */
  const setInput = (el, value) => {
    HP.setValue(el, value)
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.dispatchEvent(new Event("blur", { bubbles: true }))
  }

  /** The Facebook Pages list's checkboxes: { label, name, input }. */
  const pageBoxes = (box) => {
    const group = box.querySelector('[role=group][aria-label*="Facebook Pages" i]') || box
    return [...group.querySelectorAll("label")]
      .map((label) => {
        const input = label.querySelector("input[type=checkbox]")
        return input ? { label, input, name: input.getAttribute("aria-label") || text(label.querySelector("span[title]")) || text(label) } : null
      })
      .filter(Boolean)
  }
  dash.pageBoxes = pageBoxes

  /** Is this Facebook Page one of the Homes.ph pages (the Main Page "Homes.ph" and the 16 cities)? */
  dash.isHomesPage = (name) => /^homes[.,;]?\s?ph\b/i.test(String(name || "").trim())

  /**
   * The carousel on the Sites board: Create Post → its slides → Others: every city at 11:00 PM on its day → every
   * Homes.ph Page → the caption → Post now. Returns { error } | { stopped } | { facebook }.
   */
  dash.postCarousel = async function (job, settings) {
    const title = `Carousel · ${job.title}`
    const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
    HP.banner({ title, text: "Opening Create Post…", buttons: [stop] })
    const create = await HP.waitFor(() => button(document, /^\+?\s*create post$/i), 20000)
    if (!create) return { error: "The board has no Create Post button. Are you signed in to dash.homes.ph?" }
    create.click()
    const fb = await HP.waitFor(dash.facebookWindow, 15000)
    if (!fb) return { error: "Create Post didn't open its Send to Facebook window." }

    // 1. The slides (1.png = the cover first), from the app.
    HP.banner({ title, text: "Getting the slides from Homes.ph SocMedSystem…", buttons: [stop] })
    const info = await HP.send({ type: "carousel-images", jobId: job.id })
    if (info.error) return { error: info.error }
    const files = []
    for (let i = 0; i < info.count; i++) {
      const f = await HP.send({ type: "carousel-image", jobId: job.id, index: i })
      if (f.error) return { error: f.error }
      files.push(new File([HP.base64ToBlob(f.base64, f.type)], f.name, { type: f.type }))
    }
    const input = pictureInput((dash.facebookWindow() || fb).box)
    if (!input) return { error: "Send to Facebook has no Add images." }
    HP.setFiles(input, files)
    await HP.sleep(1500)
    await HP.jobUpdate(job, {}, `${files.length} slides added (${files.map((f) => f.name).join(", ")})`)

    // 2. Planner: Others, every city picked.
    let box = (dash.facebookWindow() || fb).box
    await plannerTab(box, /^others$/i)
    box = (dash.facebookWindow() || fb).box
    const select = box.querySelector('select[aria-label="City or site" i]') || box.querySelector("select")
    if (!select) return { error: "The Planner has no \"Pick a city or site\"." }
    const cities = [...select.querySelectorAll('optgroup[label="Cities" i] option')].filter((o) => o.value)
    const picked = []
    for (const o of cities) {
      const sel = (dash.facebookWindow() || fb).box.querySelector('select[aria-label="City or site" i]') || select
      pickOption(sel, o.value)
      picked.push(text(o))
      await HP.sleep(350)
    }
    await HP.jobUpdate(job, {}, `Planner (Others): ${picked.length} cities picked`)

    // 3. When: the carousel's day at 11:00 PM.
    box = (dash.facebookWindow() || fb).box
    const date = box.querySelector('input[type="date"]')
    const time = box.querySelector('input[type="time"]')
    const slot = [...box.querySelectorAll("button")].find((b) => HP.visible(b) && HP.timeFromLabel(text(b).replace(/\s*\d+\s*$/, "")) === HP.CAROUSEL_TIME)
    if (slot) slot.click()
    else {
      if (date) setInput(date, job.day)
      if (time) setInput(time, HP.CAROUSEL_TIME)
    }
    await HP.sleep(400)
    if (date && date.value && date.value !== job.day) setInput(date, job.day)
    if (time && time.value && time.value.slice(0, 5) !== HP.CAROUSEL_TIME) setInput(time, HP.CAROUSEL_TIME)
    await HP.jobUpdate(job, {}, `When: ${job.day} ${HP.timeLabel(HP.CAROUSEL_TIME)}`)

    // 4. Pages: every Homes.ph Page, nothing else.
    await HP.sleep(500)
    box = (dash.facebookWindow() || fb).box
    const ticks = []
    for (const p of pageBoxes(box)) {
      const want = dash.isHomesPage(p.name)
      if (p.input.checked !== want) {
        p.label.click()
        await HP.sleep(120)
        if (p.input.checked !== want) p.input.click()
      }
      if (want) ticks.push(p.name)
    }
    if (!ticks.length) return { error: "No Homes.ph Page in Send to Facebook's Pages." }
    await HP.jobUpdate(job, { ticked: ticks }, `Pages: ${ticks.length} Homes.ph Pages ticked`)

    // 5. The caption from the app.
    const caption = box.querySelector("textarea")
    if (caption && job.caption) {
      HP.setValue(caption, job.caption)
      await HP.sleep(200)
    }
    if (!(await HP.stillRunning(job))) return { stopped: true }
    const timing = HP.timing(job.day, HP.CAROUSEL_TIME, new Date(), settings.nowWindow)
    return dash.postNow(job, title, settings, timing.mode === "now" ? "posted" : "scheduled")
  }
})()
