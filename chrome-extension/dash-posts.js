/*
 * Homes.ph Publisher on dash.homes.ph/super_editor/posts: reads the board (every hub's cards per time, posted
 * or not, the yellow "due" line, Facebook posted / scheduled) for the panel, and, for a publishing job, shows the
 * right board (CITIES / SITES) and day, opens the slot's card and goes to its linked article.
 */
;(function () {
  const HP = globalThis.HP
  let last = ""
  let switching = false
  const onPosts = () => location.pathname.startsWith("/super_editor/posts")
  const text = (el) => HP.oneLine(el && el.textContent)

  /** The board on the page: which one (by its rows) and its day (the date it shows, else ?date=, else today). */
  async function current() {
    const board = HP.readBoard(document)
    if (!board || !board.hubs.length) return null
    const settings = await HP.settings()
    const where = HP.boardWhere(location.href)
    const shown = HP.pageDate(document)
    // Known by its rows; the address only when the rows can't tell (a "Loading…" row can't).
    const detected = HP.detectGroup(board, settings)
    return { board, detected, group: detected || where.group, day: (shown && shown.day) || where.date, settings }
  }

  /**
   * Saves the board whenever it changes (the panel and the badge use it), and the address it really has.
   * `mode`: none (it changed), "page" (a refresh reading page after page), "final" (the refresh's last read).
   * True when the board was sent.
   */
  async function scrape(mode) {
    if (!onPosts() || (switching && !mode)) return false
    const now = await current()
    if (!now || !now.detected) return false
    const page = HP.pager(document).page
    const key = JSON.stringify([now.group, now.day, page, now.board])
    if (key === last && !mode) return false
    last = key
    // The real address of this board (?group=… as the dash names it), for opening it next time. First: a refresh
    // tab closes once its last board is in.
    const u = new URL(location.href)
    const real = new URL(u.origin + u.pathname)
    if (u.searchParams.get("group")) real.searchParams.set("group", u.searchParams.get("group"))
    await HP.send({ type: "board-url", group: now.group, url: real.toString() })
    await HP.send({ type: "board", group: now.group, date: now.day, board: now.board, page, final: mode === "final" })
    return true
  }

  let timer = null
  new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(scrape, 700)
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-pressed", "class", "title"] })

  /** The arrows next to the date ("‹ NOV 10, 2026 ›"): the button before it and the one after it. */
  function dayArrows(dateEl) {
    for (let box = dateEl.parentElement; box && box !== document.body; box = box.parentElement) {
      const buttons = [...box.querySelectorAll("button")].filter((b) => HP.visible(b) && !b.contains(dateEl) && !HP.dateFromLabel(b.textContent) && text(b).length <= 3)
      const before = buttons.filter((b) => b.compareDocumentPosition(dateEl) & Node.DOCUMENT_POSITION_FOLLOWING)
      const after = buttons.filter((b) => b.compareDocumentPosition(dateEl) & Node.DOCUMENT_POSITION_PRECEDING)
      if (before.length && after.length) return { prev: before[before.length - 1], next: after[0] }
      if (box.querySelectorAll("button").length > 12) break
    }
    return null
  }

  /**
   * Makes the page show `group`'s board on `day`: waits for the board, clicks CITIES / SITES when it shows the
   * other one, and the day arrows when it shows another day. Returns null, or what went wrong.
   */
  async function showBoard(group, day) {
    switching = true
    try {
      // Until its rows say which board it is (it may show "Loading…" first); then the address decides.
      let now = await HP.waitFor(async () => {
        const c = await current()
        return c && c.detected ? c : null
      }, 20000, 300)
      if (!now) now = await HP.waitFor(current, 5000, 300)
      if (!now) return "The posts board didn't load. Are you signed in to dash.homes.ph?"
      // The page may still be applying its own ?group= / ?date=.
      for (let i = 0; i < 6 && now.group !== group; i++) {
        await HP.sleep(500)
        now = (await current()) || now
      }
      const label = group === "city" ? "Cities" : "Sites"
      if (now.group !== group) {
        const button = HP.buttonByText(document, group === "city" ? /^cities?$/i : /^sites?$/i)
        if (!button) return `The board shows ${now.group === "city" ? "Cities" : "Sites"} and has no ${label} button.`
        button.click()
        now = await HP.waitFor(async () => {
          const c = await current()
          return c && c.detected === group ? c : null
        }, 15000, 300)
        if (!now) return `Couldn't switch the board to ${label}.`
      }
      // The day: the arrows, one day at a time, until the page shows it.
      for (let i = 0; i < 62; i++) {
        const shown = HP.pageDate(document)
        if (!shown || shown.day === day) break
        const arrows = dayArrows(shown.el)
        if (!arrows) return `The board shows ${shown.day}, not ${day}, and its day arrows weren't found.`
        ;(shown.day < day ? arrows.next : arrows.prev).click()
        const moved = await HP.waitFor(() => {
          const s = HP.pageDate(document)
          return s && s.day !== shown.day ? s : null
        }, 8000, 200)
        if (!moved) return `The board didn't move from ${shown.day} to ${day}.`
      }
      const shown = HP.pageDate(document)
      if (shown && shown.day !== day) return `The board shows ${shown.day}, not ${day}.`
      await HP.waitFor(async () => !!(await current()), 8000, 300)
      return null
    } finally {
      switching = false
    }
  }

  /** Rows of `group`'s brands not among `seen` (normalized row names). */
  const missingBrands = (settings, group, seen) => settings.brands.filter((b) => b.group === group && !seen.has(HP.norm(b.hub)))

  /**
   * The board's next page; true once it shows (a board told apart by its rows, other rows than before: not the
   * "Loading…" row the dash shows meanwhile).
   */
  async function nextPage(pager) {
    const rows = (b) => b.hubs.map((h) => h.hub).join("|")
    const before = rows(HP.readBoard(document) || { hubs: [] })
    pager.next.click()
    return !!(await HP.waitFor(async () => {
      const c = await current()
      return c && c.detected && rows(c.board) !== before ? c : null
    }, 10000, 250))
  }

  /**
   * A board tab the background opened to read it (the panel's refresh): the right board and day, then read,
   * page after page while a brand's row isn't found yet (the Sites board has pages; a row with no article
   * is on a later page). The last read says "final": then the tab closes.
   */
  async function refreshTab() {
    const me = await HP.send({ type: "whoami" })
    if (!me.want || !onPosts()) return scrape()
    switching = true
    try {
      const problem = await showBoard(me.want.group, me.want.day)
      last = ""
      if (problem) return void HP.send({ type: "board-failed", error: problem })
      switching = true
      const seen = new Set()
      let sent = false
      for (let i = 0; i < 6; i++) {
        const now = await HP.waitFor(async () => {
          const c = await current()
          return c && c.detected ? c : null
        }, 8000, 250)
        if (now) for (const h of now.board.hubs) seen.add(HP.norm(h.hub))
        const pager = HP.pager(document)
        const more = !!now && !!pager.next && missingBrands(now.settings, me.want.group, seen).length > 0
        if (!more) break
        sent = (await scrape("page")) || sent
        if (!(await nextPage(pager))) break
      }
      if (!(await scrape("final")))
        void HP.send(sent ? { type: "board-read" } : { type: "board-failed", error: "The posts board didn't show its rows. Open dash.homes.ph, then click ⟳." })
    } finally {
      switching = false
    }
  }

  // ---------- the job: open the card, then its article ----------

  /**
   * The job's article on the board. The rows move (the dash puts the hubs with articles waiting on top, so
   * PicklePlay and fhiglobal change places) and may load a moment later, so the card is found by its title
   * anywhere on the board; its hub's row and its time's column only decide between two cards with the same
   * title. A title edited on the dash: the hub's only article waiting at that time.
   */
  function findCard(job) {
    const table = HP.boardTable(document)
    if (!table) return null
    const times = [...table.querySelectorAll("thead th")].map((th) => HP.timeFromLabel(HP.cellLabel(th)))
    const col = times.indexOf(job.time)
    const rows = [...table.querySelectorAll("tbody tr")]
    const inHub = (tr) => !!tr && HP.sameName(HP.cellLabel(tr.children[0]), job.hub)
    const cards = [...table.querySelectorAll("div[draggable]")].filter((c) => text(c.querySelector("p")))
    const same = cards.filter((c) => HP.sameName(text(c.querySelector("p")), job.title))
    if (same.length) {
      const score = (c) => {
        const tr = c.closest("tr")
        const td = c.closest("td")
        return (inHub(tr) ? 2 : 0) + (tr && td && [...tr.children].indexOf(td) === col ? 1 : 0)
      }
      return { card: same.sort((a, b) => score(b) - score(a))[0] }
    }
    const row = rows.find(inHub)
    if (row && col >= 1 && row.children[col]) {
      const waiting = [...row.children[col].querySelectorAll("div[draggable]")].filter((c) => !HP.readCard(c).posted)
      if (waiting.length === 1) return { card: waiting[0], retitled: true }
    }
    return { card: null, row: !!row, col: col >= 1, rows: rows.length }
  }

  /** Scrolls the board a screen further (back to the top after the end), for rows that show only when scrolled to. */
  function scrollBoard(table) {
    let box = table.parentElement
    while (box && box !== document.body && !(box.scrollHeight > box.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement
    const target = box && box !== document.body ? box : document.scrollingElement || document.documentElement
    const atEnd = target.scrollTop + target.clientHeight >= target.scrollHeight - 4
    target.scrollTop = atEnd ? 0 : target.scrollTop + Math.max(200, target.clientHeight * 0.8)
  }

  /** Looks for the job's card for up to 40 s while the board loads, re-sorts its rows, needs scrolling or paging. */
  async function waitForCard(job) {
    const end = Date.now() + 40000
    let last = null
    let tries = 0
    let paged = false
    while (Date.now() < end) {
      last = findCard(job)
      if (last && last.card) return last
      if (!(await HP.stillRunning(job))) return null
      // The rows were there and the card wasn't: the board's next page (its row may be there), else further down.
      if (last && last.rows && ++tries > 4) {
        const pager = HP.pager(document)
        if (last.row === false && pager.next) {
          paged = true
          tries = 0
          await nextPage(pager)
          continue
        }
        if (last.row === false && paged && pager.first && pager.page !== 1) {
          // The last page and still not there: back to the first page.
          pager.first.click()
          paged = false
          tries = 0
          await HP.sleep(800)
          continue
        }
        scrollBoard(HP.boardTable(document))
      }
      await HP.sleep(500)
    }
    return last || { card: null }
  }

  /** The modal's linked article (a link to /super_editor/articles/…). */
  const articleLink = () =>
    [...document.querySelectorAll('a[href*="/super_editor/articles/"]')].find((a) => HP.visible(a)) || null

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
    if (!onPosts()) return
    const [{ job: now }, me] = await Promise.all([HP.store.get("job"), HP.send({ type: "whoami" })])
    if (now && now.tabId === me.tabId && now.step === "mark-posted") return markPosted(now)
    if (now && now.tabId === me.tabId && now.step === "dash-carousel") return carouselOnDash(now)
    const job = await HP.myJob("open-post")
    if (!job) return
    const title = `${job.brandName} ${HP.timeLabel(job.time)}${job.day !== HP.ymd(new Date()) ? ` (${job.day})` : ""}`
    const settings = await HP.settings()
    const brand = settings.brands.find((b) => b.id === job.brandId)
    let sitePublished = false
    HP.banner({ title, text: "Opening the article on the board…", buttons: [{ label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }] })

    // 1.2.0: everything in the board's own windows (Publish, Send to Facebook, Post now).
    if (settings.postWay === "dash") return articleOnDash(job, brand, settings)

    // Opened with ?post=…: the modal may already be showing its article.
    let link = job.postId ? await HP.waitFor(articleLink, 6000) : null
    if (!link) {
      const problem = await showBoard(job.group, job.day)
      if (problem) return HP.jobFail(job, problem)
      const found = await waitForCard(job)
      if (!(await HP.stillRunning(job))) return HP.hideBanner()
      if (!found || !found.card) {
        const board = job.group === "city" ? "Cities" : "Sites"
        return HP.jobFail(
          job,
          found && found.row === false && found.rows
            ? `"${job.hub}" isn't on the ${board} board for ${job.day}. Check the brand's Target Hub in the extension's Options.`
            : `The article "${job.title}" isn't on the ${board} board for ${job.day} any more (moved or removed). Click ⟳ in the panel and try again.`,
        )
      }
      if (found.retitled) await HP.jobUpdate(job, {}, "The article's title was changed on the dash: using the one waiting in this slot.")
      // Its check: published on the site already (manually), so only its Facebook post is left.
      sitePublished = HP.readCard(found.card).posted
      found.card.scrollIntoView({ block: "center" })
      found.card.click()
      link = await HP.waitFor(articleLink, 15000)
    }
    if (!link) return HP.jobFail(job, "The card's window has no linked article. Link the article to this post on the board first.")
    const postId = new URL(location.href).searchParams.get("post") || job.postId
    const href = new URL(link.getAttribute("href"), location.origin).toString()
    // A published article's window has its site pills (PicklePlay → its address on pickleplay.ph): the READ MORE link.
    await HP.sleep(400)
    const box = link.closest("[role=dialog], [aria-modal=true]") || document
    const publishedUrl = HP.publishedLink(box, brand)
    await HP.jobUpdate(
      job,
      { step: "publish-article", postId, articleHref: href, sitePublished: sitePublished || !!publishedUrl, ...(publishedUrl ? { publishedUrl } : {}) },
      publishedUrl ? `Already published on the site: ${publishedUrl}` : sitePublished ? "Already published on the site (checked on the board)" : "Opening the linked article",
    )
    // Same tab (the link opens a new one), so the job keeps going here.
    location.href = href
  }

  /**
   * The article on the board (1.2.0): its card's Scheduled Post window → Publish (Clear all, the page's sites) →
   * Send to Facebook (the app's picture) → Post now. Then the card gets its check (markPosted).
   */
  async function articleOnDash(job, brand, settings) {
    const title = `${job.brandName} ${HP.timeLabel(job.time)}${job.day !== HP.ymd(new Date()) ? ` (${job.day})` : ""}`
    let sitePublished = false
    // Opened with ?post=…: its window may be open already.
    let open = job.postId ? await HP.waitFor(HP.dash.scheduledWindow, 6000) : null
    if (!open) {
      const problem = await showBoard(job.group, job.day)
      if (problem) return HP.jobFail(job, problem)
      const found = await waitForCard(job)
      if (!(await HP.stillRunning(job))) return HP.hideBanner()
      if (!found || !found.card) {
        const board = job.group === "city" ? "Cities" : "Sites"
        return HP.jobFail(
          job,
          found && found.row === false && found.rows
            ? `"${job.hub}" isn't on the ${board} board for ${job.day}. Check the page's Target Hub in the extension's Options.`
            : `The article "${job.title}" isn't on the ${board} board for ${job.day} any more (moved or removed). Click ⟳ in the panel and try again.`,
        )
      }
      if (found.retitled) await HP.jobUpdate(job, {}, "The article's title was changed on the dash: using the one waiting in this slot.")
      sitePublished = HP.readCard(found.card).posted
      found.card.scrollIntoView({ block: "center" })
      found.card.click()
    }
    HP.banner({ title, text: "Opening the card…", buttons: [{ label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }] })
    const result = await HP.dash.postArticle({ ...job, sitePublished: sitePublished || !!job.sitePublished }, brand, settings)
    if (result.stopped) return HP.hideBanner()
    if (result.error) return HP.jobFail(job, result.error)
    // The card's window closes (Escape), so the board shows again for its check.
    const esc = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }))
    if (HP.dash.scheduledWindow()) {
      esc()
      await HP.sleep(400)
    }
    // The background records it (and tells the app); the job moves to "mark-posted": the card gets its check here.
    await HP.send({ type: "job-done", jobId: job.id, facebook: result.facebook, note: `Facebook ${result.facebook} (Send to Facebook on the board)` })
  }

  /** The carousel on the Sites board (1.2.0): Create Post → slides → every city at 11 PM → every Homes.ph Page → Post now. */
  async function carouselOnDash(job) {
    if (carouselRunning === job.id) return
    carouselRunning = job.id
    try {
      const settings = await HP.settings()
      const problem = await showBoard("site", job.day)
      if (problem) return HP.jobFail(job, problem)
      const result = await HP.dash.postCarousel(job, settings)
      if (result.stopped) return HP.hideBanner()
      if (result.error) return HP.jobFail(job, result.error)
      const res = await HP.send({ type: "carousel-done", jobId: job.id, keys: job.pages.map((p) => p.key), facebook: result.facebook, note: `Facebook ${result.facebook} (Create Post on the Sites board)` })
      HP.banner({
        title: `Carousel: done`,
        text: `Sent to Facebook (${result.facebook}) on every Homes.ph Page${res && res.checkedInApp ? ", and ticked in Homes.ph SocMedSystem's checklist." : "."}`,
        tone: "ok",
        buttons: [{ label: "Close", onClick: HP.hideBanner }],
      })
    } finally {
      carouselRunning = null
    }
  }
  let carouselRunning = null

  /**
   * Back on the board after the Facebook post: the card gets its check ("Mark as posted"), unless the dash
   * already checked it. Then the job is over.
   */
  async function markPosted(job) {
    const title = `${job.brandName} ${HP.timeLabel(job.time)}${job.day !== HP.ymd(new Date()) ? ` (${job.day})` : ""}`
    HP.banner({ title, text: "Facebook post done. Checking the article on the board…" })
    const problem = await showBoard(job.group, job.day)
    const found = problem ? null : await waitForCard(job)
    if (!found || !found.card) {
      await HP.send({ type: "job-marked", jobId: job.id, marked: false, note: problem || "The card wasn't found to check it." })
      return HP.banner({ title: `${title}: done`, text: `The Facebook post is ${job.facebook === "posted" ? "posted" : "scheduled"}. Check the card on the board yourself (${problem || "it wasn't found"}).`, tone: "ok", buttons: [{ label: "Close", onClick: HP.hideBanner }] })
    }
    found.card.scrollIntoView({ block: "center" })
    const button = () => found.card.querySelector("button[aria-pressed]")
    let marked = button() && button().getAttribute("aria-pressed") === "true"
    if (!marked && button()) {
      button().click()
      marked = !!(await HP.waitFor(() => button() && button().getAttribute("aria-pressed") === "true", 8000))
    }
    await HP.send({ type: "job-marked", jobId: job.id, marked, note: marked ? "Checked on the board (Posted)" : "Couldn't check the card on the board" })
    HP.banner({
      title: `${title}: done`,
      text: `Published, the Facebook post is ${job.facebook === "posted" ? "posted" : "scheduled"}${marked ? ", and the card is checked." : ". Check the card yourself: it didn't take the click."}`,
      tone: "ok",
      buttons: [{ label: "Close", onClick: HP.hideBanner }],
    })
  }

  setTimeout(() => void refreshTab(), 1200)
  void run()
  // dash.homes.ph is a single-page app: the board can open without a page load.
  let href = location.href
  HP.every(500, () => {
    if (location.href === href) return
    href = location.href
    last = ""
    setTimeout(scrape, 1200)
    void run()
  })
  // A job can start while the board is open.
  HP.onStorage((changes, area) => {
    if (area === "local" && changes.job && changes.job.newValue && ["open-post", "mark-posted", "dash-carousel"].includes(changes.job.newValue.step) && (!changes.job.oldValue || changes.job.oldValue.step !== changes.job.newValue.step)) void run()
  })
})()
