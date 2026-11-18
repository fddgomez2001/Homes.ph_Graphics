/*
 * Homes.ph Publisher: the background. Keeps the boards read from dash.homes.ph, runs one publishing job at a
 * time (board card → article → Publish → homes.ph Facebook Autopost → Schedule Post) across the pages, and
 * talks to Homes.ph SocMedSystem on this computer (the News Article post and its template picture, the day's
 * carousel, advertisements and Daily Trend News). Posts a single picture (an ad, a trend news poster, a quote) to
 * one Facebook Page, and the day's tasks and reports in My Tasks (dtr.homes.ph): reports only when you click.
 */
importScripts("shared.js")

const APP_PORTS = [39390, 39391, 39392, 39393, 39394]
/** A step that makes no progress for this long stops the job (a page that didn't load, a sign-in page). */
const STALL_MS = 4 * 60_000

// ---------- storage ----------

const get = async (key, fallback) => (await chrome.storage.local.get(key))[key] ?? fallback
const set = (key, value) => chrome.storage.local.set({ [key]: value })

/** Read-change-write of a stored value, one at a time (two boards or a job update arriving together never undo each other). */
let writing = Promise.resolve()
function serial(fn) {
  const next = writing.then(fn, fn)
  writing = next.catch(() => {})
  return next
}

/** The settings, for the pages assigned in the app (Settings → Assigned pages; read from it on each refresh). */
async function settings() {
  return HP.withDefaults(await get("settings", null), await get("assignment", null), await get("duty", null))
}

/** Saved boards: { "site|2026-11-10": { at, times, hubs } }, the last 4 days kept. */
async function saveBoard(group, date, board, page) {
  await serial(async () => {
    const boards = await get("boards", {})
    const key = `${group}|${date}`
    // A board with pages (Sites): this page's rows, with the rows read on its other pages.
    boards[key] = { at: Date.now(), ...HP.mergeBoard(boards[key], board, page) }
    const keys = Object.keys(boards).sort((a, b) => (boards[b].at || 0) - (boards[a].at || 0))
    // About two weeks of days, both boards (past days show what's still not on Facebook).
    for (const k of keys.slice(40)) delete boards[k]
    await set("boards", boards)
  })
  await updateBadge()
}

// ---------- the toolbar badge: today's slots to publish ----------

async function updateBadge() {
  const { open, late } = HP.countToday(await settings(), await get("boards", {}), await get("done", {}), new Date())
  await chrome.action.setBadgeText({ text: open ? String(open) : "" })
  await chrome.action.setBadgeBackgroundColor({ color: late ? "#D97706" : "#1428AE" })
  await chrome.action.setTitle({ title: open ? `Homes.ph Publisher: ${open} article${open === 1 ? "" : "s"} to post on Facebook today${late ? ` (${late} due)` : ""}` : "Homes.ph Publisher" })
}

// ---------- Facebook Autopost → Scheduled Posts: a scheduled post that was deleted ----------

const SCHEDULED_URL = "https://homes.ph/dashboard/admin/facebook-autopost/scheduled"

/** The Facebook posts that should be on Scheduled Posts: scheduled (the dash's mark or this extension) for a time still to come. */
async function expectedScheduled() {
  const s = await settings()
  const boards = await get("boards", {})
  const done = await get("done", {})
  const now = Date.now()
  const out = new Map()
  for (const brand of s.brands)
    for (const [key, board] of Object.entries(boards)) {
      const [group, day] = key.split("|")
      if (group !== brand.group) continue
      const hub = HP.hubOf(board, brand)
      if (!hub) continue
      for (const [time, cards] of Object.entries(hub.slots))
        for (const c of cards) {
          if (HP.slotDate(day, time).getTime() <= now) continue
          const k = HP.doneKey(brand.id, day, time, c.title)
          const rec = done[k]
          if (c.fb === "scheduled" || (rec && rec.facebook === "scheduled")) out.set(k, { key: k, brandId: brand.id, brandName: brand.name, day, time, title: c.title, caption: (rec && rec.caption) || "", fbPage: brand.fbPage })
        }
    }
  for (const [k, rec] of Object.entries(done))
    if (rec.facebook === "scheduled" && rec.day && rec.time && rec.title && HP.slotDate(rec.day, rec.time).getTime() > now && !out.has(k))
      out.set(k, { key: k, brandId: rec.brandId, brandName: rec.brandName, day: rec.day, time: rec.time, title: rec.title, caption: rec.caption || "", fbPage: rec.fbPage })
  return [...out.values()]
}

const waitingScheduled = new Map()

/** Opens Scheduled Posts in a background tab (it reads it and closes). Resolves with what it found. */
async function checkScheduled() {
  const expected = await expectedScheduled()
  if (!expected.length) return { ok: true, checked: 0 }
  const tab = await chrome.tabs.create({ url: SCHEDULED_URL, active: false })
  try {
    return await new Promise((resolve) => {
      const timer = setTimeout(() => {
        waitingScheduled.delete(tab.id)
        resolve({ ok: false, error: "Scheduled Posts didn't load (sign in to homes.ph)." })
      }, 40_000)
      waitingScheduled.set(tab.id, (result) => {
        clearTimeout(timer)
        waitingScheduled.delete(tab.id)
        resolve(result)
      })
    })
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {})
  }
}

/** A post not in the full list counts as deleted the second time it's missed (checks at least this far apart). */
const MISS_GAP_MS = 60_000

/**
 * What Scheduled Posts showed. present: still there (a "deleted" mark is taken back). removed: its row says
 * deleted / cancelled → marked now. missing: not in the whole list → marked only when missed twice in a row.
 * Returns how many were newly marked (with an alert).
 */
async function scheduledResult(present, removed, missing, expected) {
  const gone = []
  await serial(async () => {
    const done = await get("done", {})
    const now = Date.now()
    for (const k of present) if (done[k] && (done[k].deleted || done[k].misses)) done[k] = { ...done[k], deleted: false, deletedAt: null, misses: 0, missedAt: null }
    const mark = (k) => {
      const e = expected.find((x) => x.key === k)
      if (!e) return
      if (!(done[k] && done[k].deleted)) gone.push(e)
      done[k] = { ...(done[k] || {}), ...e, caption: (done[k] && done[k].caption) || e.caption || "", at: now, deleted: true, deletedAt: now }
    }
    for (const k of removed) mark(k)
    for (const k of missing) {
      const rec = done[k]
      if (!rec || rec.deleted) continue
      if (now - (rec.missedAt || 0) < MISS_GAP_MS) continue
      const misses = (rec.misses || 0) + 1
      if (misses >= 2) mark(k)
      else done[k] = { ...rec, misses, missedAt: now }
    }
    await set("done", done)
  })
  await updateBadge()
  if (gone.length)
    notify(
      "deleted",
      `Facebook post${gone.length === 1 ? "" : "s"} deleted`,
      gone.map((g) => `${g.brandName} ${HP.timeLabel(g.time)} (${g.day}): ${g.title}`).join("\n") + "\nIt's no longer in Scheduled Posts: post it again.",
    )
  return gone.length
}

/**
 * "Deleted" marks made by an earlier version are taken back when the extension is installed or updated: they
 * came from looking for the article's title in a list that may have been filtered to one Page, so posts that
 * were still scheduled showed red. The next check decides again, with the rules above.
 */
async function clearDeletedMarks() {
  await serial(async () => {
    const done = await get("done", {})
    let changed = false
    for (const [k, rec] of Object.entries(done))
      if (rec && (rec.deleted || rec.misses)) {
        done[k] = { ...rec, deleted: false, deletedAt: null, misses: 0, missedAt: null }
        changed = true
      }
    if (changed) await set("done", done)
  })
}

// ---------- alerts ----------

function notify(id, title, message) {
  try {
    chrome.notifications.create(`hp-${id}-${Date.now()}`, { type: "basic", iconUrl: "icon-128.png", title, message, priority: 2, requireInteraction: id === "deleted" })
  } catch {
    // notifications are off
  }
}

/** The panel in its own small window (a notification or the startup alert opens it). */
async function openPanelWindow() {
  await chrome.windows.create({ url: chrome.runtime.getURL("popup.html"), type: "popup", width: 410, height: 720, focused: true })
}

/**
 * Chrome opened: today's boards are read (background tabs that close themselves; only today, so a quiet past
 * day never keeps it loading), Scheduled Posts is checked, and an alert says what's not on Facebook yet (today,
 * and the past days already read).
 */
async function startupCheck() {
  await refreshAssignment(true)
  await refreshBoards(null, HP.ymd(new Date()), true).catch(() => {})
  await checkScheduled().catch(() => {})
  const s = await settings()
  const boards = await get("boards", {})
  const done = await get("done", {})
  const today = HP.countToday(s, boards, done, new Date())
  const past = HP.missedDays(s, boards, done, new Date())
  const lines = []
  if (today.read) lines.push(today.open ? `Today: ${today.open} not on Facebook yet${today.late ? ` (${today.late} due)` : ""}.` : "Today: all on Facebook.")
  for (const p of past.slice(0, 3)) lines.push(`${p.day}: ${p.open} not posted yet.`)
  if (!today.read) lines.push("Sign in to dash.homes.ph, then open the panel and click ⟳.")
  const dtrToday = (await get("dtr", {}))[HP.ymd(new Date())]
  if (!dtrToday || !Object.keys(dtrToday.tasks || {}).length) lines.push("Reports: click Start Your Day (adds today's tasks in My Tasks).")
  const car = await carouselDay(HP.ymd(new Date())).catch(() => null)
  const carToDo = []
  if (car && car.data && !car.error) {
    const done = await get("carouselDone", {})
    for (const c of car.data.carousels) {
      const open = car.data.pages.filter((p) => !HP.carouselPosted(car, c, p.key, done)).length
      lines.push(open ? `Carousel: ${car.data.pages.length - open}/${car.data.pages.length} pages posted (${c.title}).` : `Carousel: all ${car.data.pages.length} pages posted.`)
      if (open) carToDo.push(c)
    }
  }
  const extra = []
  const ads = await adsDay(HP.ymd(new Date())).catch(() => null)
  const posted = await get("posted", {})
  if (ads && ads.data && !ads.error) {
    const open = ads.data.ads.filter((a) => !HP.adPosted(a, posted, HP.ymd(new Date()))).length
    if (ads.data.ads.length) lines.push(open ? `Ads: ${open} of ${ads.data.ads.length} not posted yet.` : `Ads: all ${ads.data.ads.length} posted.`)
    if (open) extra.push("ads")
  }
  notify("startup", today.open || past.length || carToDo.length || extra.length ? "To post today" : "Homes.ph Publisher", lines.join("\n"))
  return { today, past }
}
globalThis.HPStartup = startupCheck

// ---------- reading the boards (a background tab that closes itself) ----------

/** Board tabs opened to read a board: tab id → { group, day, done(result) }. */
const waitingBoards = new Map()

/** The board's address (Options, else the one learned on the dash, else the default) for that day. */
async function boardAddress(group, day, postId) {
  const url = new URL(HP.boardUrl(await settings(), group, await get("boardUrls", {})))
  url.searchParams.set("date", day)
  if (postId) url.searchParams.set("post", postId)
  return url.toString()
}

/** Reads the boards of a day (today by default): a background tab each, which shows the right board and closes. */
async function refreshBoards(groups, day, noScheduledCheck) {
  const s = await settings()
  const wanted = groups && groups.length ? groups : [...new Set(s.brands.map((b) => b.group))]
  const date = /^\d{4}-\d{2}-\d{2}$/.test(day || "") ? day : HP.ymd(new Date())
  const results = await Promise.all(
    wanted.map(async (group) => {
      const tab = await chrome.tabs.create({ url: await boardAddress(group, date), active: false })
      try {
        return await new Promise((resolve) => {
          const timer = setTimeout(() => {
            waitingBoards.delete(tab.id)
            resolve({ group, ok: false, error: "The board didn't load. Open dash.homes.ph and sign in, then refresh." })
          }, 60_000)
          waitingBoards.set(tab.id, {
            group,
            day: date,
            done: (result) => {
              clearTimeout(timer)
              waitingBoards.delete(tab.id)
              resolve({ group, ...result })
            },
          })
        })
      } finally {
        chrome.tabs.remove(tab.id).catch(() => {})
      }
    }),
  )
  await set("refreshedAt", Date.now())
  // Scheduled posts deleted on homes.ph lose their green.
  if (!noScheduledCheck && (!day || day === HP.ymd(new Date()))) checkScheduled().catch(() => {})
  return results
}

// ---------- the publishing job ----------

async function getJob() {
  return get("job", null)
}

function patchJob(patch, note) {
  return serial(async () => {
    const job = await getJob()
    if (!job) return null
    const next = { ...job, ...patch, updatedAt: Date.now() }
    if (note) next.log = [...(job.log || []), { at: Date.now(), text: note }].slice(-40)
    await set("job", next)
    return next
  })
}

async function startJob(input) {
  const s = await settings()
  const brand = s.brands.find((b) => b.id === input.brandId)
  if (!brand) throw new Error("Unknown brand")
  const current = await getJob()
  if (current && !["done", "failed", "stopped"].includes(current.step) && Date.now() - (current.updatedAt || 0) < STALL_MS)
    throw new Error(`Still working on ${HP.jobName(current)}. Stop it first.`)
  const tab = await chrome.tabs.create({ url: await boardAddress(brand.group, input.day, input.postId), active: true })
  const job = {
    way: s.postWay,
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    brandId: brand.id,
    brandName: brand.name,
    group: brand.group,
    hub: brand.hub,
    day: input.day,
    time: input.time,
    title: input.title,
    postId: input.postId || null,
    tabId: tab.id,
    step: "open-post",
    startedAt: Date.now(),
    updatedAt: Date.now(),
    log: [{ at: Date.now(), text: `Opening ${brand.name} ${HP.timeLabel(input.time)} on the board` }],
  }
  await set("job", job)
  await chrome.storage.local.remove("jobImage")
  return job
}

/** The job's picture for Facebook: the template from Homes.ph SocMedSystem, or the article's own photo. */
async function prepareImage(job) {
  const s = await settings()
  const brand = s.brands.find((b) => b.id === job.brandId)
  let original = null
  try {
    const res = await fetch(job.imageUrl, { credentials: "omit" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg"
    const ext = type.split("/")[1].replace("jpeg", "jpg")
    original = { base64: await HP.blobToBase64(blob), type, name: `${HP.slug(job.headline).slice(0, 60) || "article"}.${ext}` }
  } catch (e) {
    await patchJob({}, `Couldn't download the article's picture (${e.message}).`)
  }
  let app = null
  try {
    app = await appCall("/v1/news-post", {
      brand: brand.appBrand,
      day: job.day,
      time: job.time,
      headline: job.headline,
      articleUrl: job.publicUrl,
      ...(original ? { image: original } : {}),
    })
  } catch (e) {
    await patchJob({ appWarning: e.message }, `Homes.ph SocMedSystem: ${e.message}`)
  }
  const picture = app && app.png ? { base64: app.png, type: "image/png", name: app.fileName || "news.png", fromApp: true } : original ? { ...original, fromApp: false } : null
  await chrome.storage.local.set({ jobImage: { jobId: job.id, picture } })
  await patchJob(
    { appProjectId: app ? app.projectId : null, pictureFrom: picture ? (picture.fromApp ? "template" : "article") : "none" },
    picture ? (picture.fromApp ? `The News Article template is ready (${picture.name}), also saved in your download folder.` : "Using the article's own photo.") : "No picture to attach.",
  )
  return picture
}

const imageReady = new Map()

// ---------- the day's carousel (Homes.ph SocMedSystem): posted to its Facebook pages, 4 at a time ----------

const CAROUSEL_NOT_OPEN = "Homes.ph SocMedSystem isn't open: the carousel comes from it."

/**
 * The carousels Homes.ph SocMedSystem has scheduled on a day, with the checklist's pages and their ticks, kept in
 * "carousels" by day: { at, data, error }. Pages posted while the app was closed are ticked in it now.
 */
async function carouselDay(day, synced) {
  let entry
  try {
    entry = { at: Date.now(), data: await appCall("/v1/carousel-day", { day }, CAROUSEL_NOT_OPEN), error: null }
  } catch (e) {
    const old = (await get("carousels", {}))[day]
    // An app older than 1.40 doesn't know carousels.
    const error = /^not found$/i.test(e.message) ? "Install Homes.ph SocMedSystem 1.40 or newer: this one can't give carousels to the extension." : e.message
    entry = { at: old ? old.at : 0, data: old ? old.data : null, error }
  }
  await serial(async () => {
    const all = await get("carousels", {})
    all[day] = entry
    for (const k of Object.keys(all).sort().slice(0, -10)) delete all[k]
    await set("carousels", all)
  })
  if (entry.data && !entry.error && !synced && (await tickUnsynced(entry.data))) return carouselDay(day, true)
  return entry
}

/** Pages posted through the extension that Homes.ph SocMedSystem didn't tick (it was closed): ticked now. */
async function tickUnsynced(data) {
  const done = await get("carouselDone", {})
  let any = false
  for (const c of data.carousels || []) {
    const keys = Object.entries(done[c.id] || {})
      .filter(([k, r]) => !r.synced && !c.checks.some((x) => x.key === k))
      .map(([k]) => k)
    if (!keys.length) continue
    try {
      await appCall("/v1/carousel-posted", { projectId: c.id, pageKeys: keys, facebook: done[c.id][keys[0]].facebook || null }, CAROUSEL_NOT_OPEN)
      await markSynced(c.id, keys)
      any = true
    } catch {
      // next time
    }
  }
  return any
}

async function markSynced(projectId, keys) {
  await serial(async () => {
    const done = await get("carouselDone", {})
    for (const k of keys) if (done[projectId] && done[projectId][k]) done[projectId][k] = { ...done[projectId][k], synced: true }
    await set("carouselDone", done)
  })
}

/** A carousel's next post: the first group of 4 with a page not posted yet (pages just not found are skipped). */
async function nextCarouselGroup(day, projectId, skip) {
  const entry = (await get("carousels", {}))[day]
  const c = entry && entry.data && entry.data.carousels.find((x) => x.id === projectId)
  if (!c) return null
  const done = await get("carouselDone", {})
  for (const g of HP.carouselGroups(entry.data.pages, HP.carouselPer(await settings()))) {
    const pages = g.pages.filter((p) => !HP.carouselPosted(entry, c, p.key, done) && !(skip || []).includes(p.key))
    if (pages.length) return { n: g.n, pages }
  }
  return null
}

/** Starts a carousel's Facebook post to one group's pages (those not posted yet), in a new tab or the job's tab. */
async function startCarouselJob(input) {
  const entry = (await get("carousels", {}))[input.day]
  const c = entry && entry.data && entry.data.carousels.find((x) => x.id === input.projectId)
  if (!c) throw new Error("This carousel isn't loaded: open Homes.ph SocMedSystem and click ⟳.")
  const s0 = await settings()
  const group = HP.carouselGroups(entry.data.pages, HP.carouselPer(s0)).find((g) => g.n === Number(input.group))
  if (!group) throw new Error("Unknown group of pages.")
  const done = await get("carouselDone", {})
  const pages = group.pages.filter((p) => !HP.carouselPosted(entry, c, p.key, done))
  if (!pages.length) throw new Error(`Post ${group.n}'s pages are posted already.`)
  const current = await getJob()
  if (current && current.id !== input.afterJob && !["done", "failed", "stopped"].includes(current.step) && Date.now() - (current.updatedAt || 0) < STALL_MS)
    throw new Error(`Still working on ${HP.jobName(current)}. Stop it first.`)
  const s = await settings()
  const onDash = s.postWay === "dash"
  let tabId = input.tabId || null
  if (tabId) await chrome.tabs.update(tabId, { active: true }).catch(() => (tabId = null))
  if (!tabId) tabId = (await chrome.tabs.create({ url: onDash ? await boardAddress("site", input.day) : HP.AUTOPOST_URL, active: true })).id
  const job = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind: "carousel",
    brandId: "carousel",
    brandName: "Carousel",
    day: input.day,
    time: HP.CAROUSEL_TIME,
    title: c.title,
    projectId: c.id,
    revision: c.revision,
    caption: c.caption,
    slides: c.slides,
    postNo: group.n,
    pages: pages.map((p) => ({ key: p.key, name: p.name, short: p.short, target: HP.carouselTarget(p, s) })),
    tabId,
    step: onDash ? "dash-carousel" : "carousel-post",
    startedAt: Date.now(),
    updatedAt: Date.now(),
    log: [{ at: Date.now(), text: `Carousel post ${group.n}: ${pages.map((p) => p.short).join(", ")}` }],
  }
  await set("job", job)
  return job
}

/** The carousel's slides from Homes.ph SocMedSystem (1.png = the cover…), kept here while it's posted. */
const carouselImages = new Map()
function carouselImagesOf(job) {
  const key = `${job.projectId}|${job.revision}`
  if (!carouselImages.has(key)) {
    for (const k of [...carouselImages.keys()]) if (k !== key) carouselImages.delete(k)
    const p = appCall("/v1/carousel-images", { projectId: job.projectId, save: true }, CAROUSEL_NOT_OPEN)
    p.catch(() => carouselImages.delete(key))
    carouselImages.set(key, p)
  }
  return carouselImages.get(key)
}

// ---------- Reports: today's tasks in My Tasks (dtr.homes.ph) and their updates ----------

/** A job (any kind) still running. */
const running = (job) => !!job && !["done", "failed", "stopped"].includes(job.step) && Date.now() - (job.updatedAt || 0) < STALL_MS

/**
 * What My Tasks has today, kept in "dtr" by day: { at, tasks: { pickleplay: { status, url, count } }, listed, error }.
 * Tasks traced in the list (To do today, Done today) replace what was known; a report sent through the extension
 * stays done when its task isn't listed. A read with no rows at all (the list didn't load) keeps what was known.
 */
async function saveDtrFound(day, found, info) {
  await serial(async () => {
    const all = await get("dtr", {})
    const cur = all[day] || { tasks: {}, tried: {} }
    if (!info.rows) {
      all[day] = { ...cur, at: Date.now(), listed: 0, error: info.loaded ? null : "My Tasks showed no tasks. Open it once (signed in), then click ⟳." }
    } else {
      const tasks = {}
      for (const [id, t] of Object.entries(cur.tasks || {})) if (t.status === "done" && t.reportedAt) tasks[id] = t
      for (const [id, t] of Object.entries(found)) tasks[id] = { ...(cur.tasks || {})[id], ...t }
      all[day] = { ...cur, at: Date.now(), error: null, tasks, listed: info.rows }
    }
    for (const k of Object.keys(all).sort().slice(0, -14)) delete all[k]
    await set("dtr", all)
  })
}

async function patchDtr(day, fn) {
  await serial(async () => {
    const all = await get("dtr", {})
    const cur = all[day] || { tasks: {}, tried: {} }
    all[day] = fn({ ...cur, tasks: { ...(cur.tasks || {}) }, tried: { ...(cur.tried || {}) } })
    await set("dtr", all)
  })
}

const waitingDtr = new Map()

/** Reads My Tasks in a background tab (it reads the list and closes). */
async function refreshDtr() {
  const tab = await chrome.tabs.create({ url: HP.DTR_TASKS_URL, active: false })
  try {
    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        waitingDtr.delete(tab.id)
        resolve({ ok: false, error: "My Tasks didn't load. Sign in to dtr.homes.ph, then click ⟳." })
      }, 40_000)
      waitingDtr.set(tab.id, (r) => {
        clearTimeout(timer)
        waitingDtr.delete(tab.id)
        resolve(r)
      })
    })
    if (!result.ok) await patchDtr(HP.ymd(new Date()), (d) => ({ ...d, error: result.error }))
    return result
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {})
  }
}

/** The data a report is made from. */
async function reportCtx() {
  const got = await chrome.storage.local.get(["boards", "done", "carousels", "carouselDone", "ads", "trends", "quotes", "posted"])
  return {
    settings: await settings(),
    boards: got.boards || {},
    done: got.done || {},
    carousels: got.carousels || {},
    carouselDone: got.carouselDone || {},
    ads: got.ads || {},
    trends: got.trends || {},
    quotes: got.quotes || {},
    posted: got.posted || {},
  }
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Start Your Day: My Tasks opens, and each of the day's tasks not there yet is added (In progress, 9 AM – 6 PM; Saturday 9 AM – 12 PM). Nothing is reported. */
async function startDay() {
  const current = await getJob()
  if (running(current)) throw new Error(`Still working on ${HP.jobName(current)}. Stop it first.`)
  const tab = await chrome.tabs.create({ url: HP.DTR_TASKS_URL, active: true })
  const job = {
    id: newId(),
    kind: "dtr",
    brandId: "dtr",
    brandName: "Reports",
    label: "Start Your Day",
    day: HP.ymd(new Date()),
    time: HP.DTR_HOURS.from,
    tabId: tab.id,
    step: "dtr-add",
    submitted: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    log: [{ at: Date.now(), text: "Start Your Day: opening My Tasks" }],
  }
  await set("job", job)
  await patchDtr(job.day, (d) => ({ ...d, started: Date.now() }))
  return job
}

/**
 * A task's report (its Send report button, once everything it reports is posted): its My Tasks task opens and gets
 * one update per post (articles: the headline and link; Carousel: the carousel's line; Ads, Quotes, Trending News:
 * one per post), then Done, then back to My Tasks.
 */
async function startReport(taskId, partial) {
  const task = HP.reportTasks(await settings()).find((t) => t.id === taskId)
  if (!task) throw new Error("Unknown task")
  const current = await getJob()
  if (running(current)) throw new Error(`Still working on ${HP.jobName(current)}. Stop it first.`)
  const day = HP.ymd(new Date())
  // The newest from Homes.ph SocMedSystem (a changed title or a new one).
  if (task.kind === "ads") await adsDay(day).catch(() => {})
  if (task.kind === "trending") await trendsDay(day).catch(() => {})
  const plan = HP.reportPlan(task, await reportCtx(), day)
  // Sent before everything is posted (time out, Saturday's half day): only what's posted is reported, then Done.
  const early = !plan.ready
  if (early && !partial) throw new Error(`${task.name}: not everything is posted yet (${plan.why}).`)
  if (early && !plan.known) throw new Error(`${task.name}: ${plan.why}. Nothing can be reported yet.`)
  const list = early ? plan.sent : plan.updates
  let updates = list.map((u) => ({ key: u.key, text: u.text }))
  let note = early ? ` (only what's posted: ${plan.why})` : ""
  // Daily Trend News: the floating report's texts (details written by the AI when a poster has none yet).
  if (task.kind === "trending") {
    try {
      const r = await appCall("/v1/trend-texts", { ids: list.map((u) => u.id) }, TRENDS_NOT_OPEN)
      const byId = new Map((r.texts || []).map((t) => [t.id, t]))
      updates = list.map((u) => ({ key: u.key, text: (byId.get(u.id) && byId.get(u.id).text) || u.text }))
      const noAi = (r.texts || []).filter((t) => t.aiError).length
      if (noAi) note += ` (${noAi} without details: the AI didn't answer)`
    } catch (e) {
      note += ` (Homes.ph SocMedSystem: ${e.message}; the details written so far are used)`
    }
  }
  const known = ((await get("dtr", {}))[day] || {}).tasks || {}
  const url = known[taskId] && /^https:\/\/dtr\.homes\.ph\/m\/tasks\/\d+\/?$/.test(known[taskId].url || "") ? known[taskId].url : HP.DTR_TASKS_URL
  const tab = await chrome.tabs.create({ url, active: true })
  const job = {
    id: newId(),
    kind: "dtr",
    brandId: `dtr-${task.id}`,
    brandName: task.name,
    label: `${task.name} report`,
    taskId: task.id,
    taskTitle: task.title,
    day,
    time: task.times[0] || HP.DTR_HOURS.from,
    tabId: tab.id,
    step: "dtr-update",
    partial: early ? plan.why : "",
    updates,
    posted: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    log: [{ at: Date.now(), text: `${task.name} report: ${updates.length} update${updates.length === 1 ? "" : "s"}${note}` }],
  }
  await set("job", job)
  await patchDtr(day, (d) => ({ ...d, tried: { ...d.tried, [task.id]: Date.now() } }))
  return job
}

// ---------- the daily report: Today's report (My Tasks) → the report chat in Messenger ----------

/** Send daily report (every task Done): My Tasks' Today's report is read and downloaded, then sent in Messenger. */
async function startDaily() {
  const current = await getJob()
  if (running(current)) throw new Error(`Still working on ${HP.jobName(current)}. Stop it first.`)
  await chrome.storage.local.remove("dailyFile")
  const tab = await chrome.tabs.create({ url: HP.DTR_TASKS_URL, active: true })
  const job = {
    id: newId(),
    kind: "daily",
    brandId: "daily",
    brandName: "Daily report",
    label: "Daily report",
    day: HP.ymd(new Date()),
    time: HP.workHours(new Date()).to,
    tabId: tab.id,
    step: "daily-download",
    startedAt: Date.now(),
    updatedAt: Date.now(),
    log: [{ at: Date.now(), text: "Daily report: opening My Tasks for Today's report" }],
  }
  await set("job", job)
  return job
}

/** Where Chrome saved Today's report (its download from My Tasks): download id → job id. */
const dailyDownloads = new Map()
if (chrome.downloads) {
  chrome.downloads.onCreated.addListener(async (item) => {
    const job = await getJob()
    if (job && job.kind === "daily" && job.step === "daily-download" && /^https:\/\/dtr\.homes\.ph\/m\/tasks\/report/.test(item.finalUrl || item.url || "")) dailyDownloads.set(item.id, job.id)
  })
  chrome.downloads.onChanged.addListener(async (delta) => {
    if (!dailyDownloads.has(delta.id) || !delta.state || delta.state.current !== "complete") return
    const jobId = dailyDownloads.get(delta.id)
    dailyDownloads.delete(delta.id)
    const [item] = await chrome.downloads.search({ id: delta.id }).catch(() => [])
    const job = await getJob()
    if (item && item.filename && job && job.id === jobId) await patchJob({ savedTo: item.filename }, `Today's report saved in ${item.filename}`)
  })
}

// ---------- ads and Daily Trend News (Homes.ph SocMedSystem), quotes (made here): one picture to one Facebook Page ----------

const ADS_NOT_OPEN = "Homes.ph SocMedSystem isn't open: the advertisements come from it."
const TRENDS_NOT_OPEN = "Homes.ph SocMedSystem isn't open: the Daily Trend News posters come from it."

/** A day's list from Homes.ph SocMedSystem, kept in `store` by day: { at, data, error } (the last one read stays on an error). */
async function appDay(store, route, day, notOpen) {
  let entry
  try {
    entry = { at: Date.now(), data: await appCall(route, { day }, notOpen), error: null }
  } catch (e) {
    const old = (await get(store, {}))[day]
    const error = /^not found$/i.test(e.message) ? "Install Homes.ph SocMedSystem 1.41 or newer: this one can't give them to the extension." : e.message
    entry = { at: old ? old.at : 0, data: old ? old.data : null, error }
  }
  await serial(async () => {
    const all = await get(store, {})
    all[day] = entry
    for (const k of Object.keys(all).sort().slice(0, -10)) delete all[k]
    await set(store, all)
  })
  return entry
}

/** The advertisements scheduled for a day; ones posted here while the app was closed are marked in it now. */
async function adsDay(day) {
  const entry = await appDay("ads", "/v1/ads-day", day, ADS_NOT_OPEN)
  if (entry.data && !entry.error) {
    const posted = (await get("posted", {}))[day] || {}
    let synced = 0
    for (const ad of entry.data.ads || []) {
      const rec = posted[`ad:${ad.id}`]
      if (!rec || rec.synced || rec.manual || ad.postedAt) continue
      try {
        await appCall("/v1/ad-posted", { id: ad.id, facebook: rec.facebook === "posted" ? "posted" : "scheduled" }, ADS_NOT_OPEN)
        await markPosted(day, `ad:${ad.id}`, { ...rec, synced: true })
        synced++
      } catch {
        // next time
      }
    }
    if (synced) return appDay("ads", "/v1/ads-day", day, ADS_NOT_OPEN)
  }
  return entry
}

const trendsDay = (day) => appDay("trends", "/v1/trends-day", day, TRENDS_NOT_OPEN)

/** Something posted (or marked posted) here: kept in "posted" by day, three weeks. */
async function markPosted(day, key, rec) {
  await serial(async () => {
    const all = await get("posted", {})
    const mine = { ...(all[day] || {}) }
    if (rec) mine[key] = rec
    else delete mine[key]
    all[day] = mine
    for (const k of Object.keys(all).sort().slice(0, -21)) delete all[k]
    await set("posted", all)
  })
}

const POST_NAMES = { ad: "ad", trend: "trend news", quote: "quote" }

/** One picture to one Facebook Page: an ad, a Daily Trend News poster, or a quote (its caption and time). */
async function startPostJob(input) {
  const what = input.what
  if (!POST_NAMES[what]) throw new Error("Unknown post")
  const day = /^\d{4}-\d{2}-\d{2}$/.test(input.day || "") ? input.day : HP.ymd(new Date())
  const current = await getJob()
  if (running(current)) throw new Error(`Still working on ${HP.jobName(current)}. Stop it first.`)
  const s = await settings()
  const brandOf = (id) => s.brands.find((b) => b.id === id) || null
  let item
  if (what === "ad") {
    const entry = (await get("ads", {}))[day]
    const ad = entry && entry.data && (entry.data.ads || []).find((a) => a.id === input.id)
    if (!ad) throw new Error("This advertisement isn't loaded: open Homes.ph SocMedSystem, then click ⟳ in the Ads tab.")
    const brand = brandOf(HP.adBrandId(ad.brand, s))
    item = { itemId: ad.id, key: `ad:${ad.id}`, pageName: brand ? brand.fbPage : "PicklePlay", pageLabel: brand ? brand.name : "PicklePlay", caption: ad.caption || "", time: ad.time, title: `${ad.kindLabel}: ${ad.title}`, revision: ad.revision, label: `${brand ? brand.name : "PicklePlay"} ${ad.kindLabel} ad ${HP.timeLabel(ad.time)}` }
  } else if (what === "trend") {
    const entry = (await get("trends", {}))[day]
    const data = (entry && entry.data) || {}
    // A poster (Daily Trend News), or a Did You Know / engagement post (1.2.1).
    const p = (data.posters || []).find((x) => x.id === input.id) || (data.posts || []).find((x) => x.id === input.id)
    if (!p) throw new Error("This post isn't loaded: open Homes.ph SocMedSystem, then click ⟳ in the Trending tab.")
    const brand = brandOf(HP.trendBrandId(p.group, s))
    item = { itemId: p.id, key: `trend:${p.id}`, pageName: brand ? brand.fbPage : p.page || p.groupName, pageLabel: p.groupName, caption: p.caption || "", time: p.time, title: p.headline, revision: p.revision, label: `${p.groupName} ${HP.postTag(p)} ${HP.timeLabel(p.time)}` }
  } else {
    const q = ((await get("quotes", {}))[day] || {})[input.id]
    if (!q || !q.imageId) throw new Error("Set the quote up first (its picture, caption and time).")
    const brand = brandOf(q.brandId)
    item = { itemId: q.brandId, key: `quote:${q.brandId}`, imageId: q.imageId, pageName: brand ? brand.fbPage : q.brandId, pageLabel: brand ? brand.name : q.brandId, caption: q.caption || "", time: q.time, title: "Daily Quote", revision: q.revision, label: `${brand ? brand.name : q.brandId} quote ${HP.timeLabel(q.time)}` }
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time || "")) throw new Error("This post has no posting time.")
  const tab = await chrome.tabs.create({ url: HP.AUTOPOST_URL, active: true })
  const job = {
    id: newId(),
    kind: "post",
    what,
    brandId: `post-${what}`,
    brandName: item.label,
    ...item,
    day,
    tabId: tab.id,
    step: "image-post",
    startedAt: Date.now(),
    updatedAt: Date.now(),
    log: [{ at: Date.now(), text: `${item.label}: Facebook post to ${item.pageName}` }],
  }
  await set("job", job)
  return job
}

/** The post's picture: the ad or poster drawn by Homes.ph SocMedSystem (its newest design, saved in Downloads), or the quote's. */
const postImages = new Map()
function postImageOf(job) {
  if (!postImages.has(job.id)) {
    postImages.clear()
    const p = (async () => {
      if (job.what === "quote") {
        const key = `qimg:${job.imageId}`
        const img = (await chrome.storage.local.get(key))[key]
        const m = img && /^data:([^;,]+);base64,(.*)$/.exec(img.dataUrl || "")
        if (!m) throw new Error("The quote's picture is missing: set the quote up again.")
        return { name: img.name || "quote.png", type: m[1], base64: m[2] }
      }
      const r = await appCall(job.what === "ad" ? "/v1/ad-image" : "/v1/trend-image", { id: job.itemId, save: true }, job.what === "ad" ? ADS_NOT_OPEN : TRENDS_NOT_OPEN)
      if (!r || !r.base64) throw new Error("Homes.ph SocMedSystem sent no picture.")
      return { name: r.name || "post.png", type: r.type || "image/png", base64: r.base64, savedTo: r.savedTo || null }
    })()
    p.catch(() => postImages.delete(job.id))
    postImages.set(job.id, p)
  }
  return postImages.get(job.id)
}

/** A quote set up in the Quotes tab: { day, brandId, caption, time, image?: { name, dataUrl }, thumb }. */
async function saveQuote(msg) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(msg.day || "") ? msg.day : HP.ymd(new Date())
  if (!HP.quoteBrands(await settings()).includes(msg.brandId)) throw new Error("Unknown page")
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(msg.time || "") ? msg.time : HP.QUOTE_TIME
  const caption = String(msg.caption || "").slice(0, 8000)
  let image = null
  if (msg.image) {
    const dataUrl = String(msg.image.dataUrl || "")
    if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(dataUrl.slice(0, 200) + (dataUrl.length > 200 ? "A" : ""))) throw new Error("The picture isn't a PNG, JPG, WebP or GIF.")
    if (dataUrl.length > 20 * 1024 * 1024) throw new Error("The picture is too big (over 15 MB).")
    image = { name: String(msg.image.name || "quote.png").replace(/[\\/:*?"<>|]/g, " ").slice(0, 120), dataUrl }
  }
  let saved = null
  await serial(async () => {
    const all = await get("quotes", {})
    const mine = { ...(all[day] || {}) }
    const old = mine[msg.brandId] || null
    let imageId = old ? old.imageId : null
    if (image) {
      imageId = newId()
      await chrome.storage.local.set({ [`qimg:${imageId}`]: image })
      if (old && old.imageId) await chrome.storage.local.remove(`qimg:${old.imageId}`)
    }
    if (!imageId) throw new Error("Pick the quote's picture first.")
    saved = { brandId: msg.brandId, day, caption, time, imageId, imageName: image ? image.name : old.imageName, thumb: typeof msg.thumb === "string" && msg.thumb.startsWith("data:image/") ? msg.thumb.slice(0, 200_000) : old ? old.thumb : "", revision: (old ? old.revision || 0 : 0) + 1, setupAt: Date.now() }
    mine[msg.brandId] = saved
    all[day] = mine
    // Two weeks of quotes (and their pictures).
    for (const k of Object.keys(all).sort().slice(0, -14)) {
      for (const q of Object.values(all[k] || {})) if (q && q.imageId) await chrome.storage.local.remove(`qimg:${q.imageId}`)
      delete all[k]
    }
    await set("quotes", all)
  })
  return { ok: true, quote: saved }
}

async function deleteQuote(msg) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(msg.day || "") ? msg.day : HP.ymd(new Date())
  await serial(async () => {
    const all = await get("quotes", {})
    const q = all[day] && all[day][msg.brandId]
    if (!q) return
    if (q.imageId) await chrome.storage.local.remove(`qimg:${q.imageId}`)
    delete all[day][msg.brandId]
    await set("quotes", all)
  })
  await markPosted(day, `quote:${msg.brandId}`, null)
  return { ok: true }
}

// ---------- Homes.ph SocMedSystem on this computer ----------

async function appInfo() {
  return get("app", { port: null, token: null })
}

/**
 * Finds the app's bridge (it listens on 127.0.0.1:39390–39394 while Homes.ph SocMedSystem is open). With more
 * than one copy open, the one this extension is connected to.
 */
async function findApp() {
  const info = await appInfo()
  const ping = async (port) => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/ping`, { headers: info.token ? { Authorization: `Bearer ${info.token}` } : {}, signal: AbortSignal.timeout(1500) })
      const body = res.ok ? await res.json() : null
      return body && body.app === "Daily Carousel Maker" ? { port, ...body } : null
    } catch {
      return null
    }
  }
  // The last one used first (it answers at once when it's still there).
  if (info.port) {
    const last = await ping(info.port)
    if (last && (last.paired || !info.token)) return last
  }
  const found = (await Promise.all(APP_PORTS.map(ping))).filter(Boolean)
  const best = found.find((f) => f.paired) || found[0] || null
  if (best && best.port !== info.port) await set("app", { ...info, port: best.port })
  return best
}

async function appCall(path, body, notOpen) {
  const found = await findApp()
  if (!found) throw new Error(notOpen || "Homes.ph SocMedSystem isn't open, so the News Article template wasn't made (the article's photo is used).")
  const info = await appInfo()
  if (!info.token || !found.paired) throw new Error("Connect the extension to Homes.ph SocMedSystem first (Options → Connect).")
  const res = await fetch(`http://127.0.0.1:${found.port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${info.token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `The app answered ${res.status}.`)
  return data
}

/**
 * The pages assigned in Homes.ph SocMedSystem (its Settings → Assigned pages), kept for every part of the extension
 * (the panel, the tasks it adds in My Tasks, the reports). Read at most once a minute; the app being closed keeps the last.
 */
let assignmentAt = 0
async function refreshAssignment(force) {
  if (!force && Date.now() - assignmentAt < 60_000) return null
  assignmentAt = Date.now()
  try {
    const r = await appCall("/v1/assignment", {})
    const pages = HP.cleanAssignment(r && r.pages)
    const old = await get("assignment", null)
    if (pages && JSON.stringify(pages) !== JSON.stringify(old)) await set("assignment", pages)
    return pages
  } catch {
    return null
  }
}

async function connectApp() {
  const found = await findApp()
  if (!found) throw new Error("Open Homes.ph SocMedSystem on this computer, then click Connect again.")
  const res = await fetch(`http://127.0.0.1:${found.port}/v1/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Homes.ph Publisher", browser: navigator.userAgent.includes("Edg/") ? "Edge" : "Chrome" }),
    signal: AbortSignal.timeout(120_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.token) throw new Error(data.error || "Homes.ph SocMedSystem didn't allow the connection.")
  await set("app", { port: found.port, token: data.token, connectedAt: Date.now() })
  await refreshAssignment(true)
  return { ok: true }
}

// ---------- messages ----------

const handlers = {
  async whoami(_msg, sender) {
    const tabId = sender.tab ? sender.tab.id : null
    const w = tabId != null ? waitingBoards.get(tabId) : null
    return { tabId, want: w ? { group: w.group, day: w.day } : tabId != null && waitingDtr.has(tabId) ? { dtr: true } : null }
  },
  async board(msg, sender) {
    if (!msg.board || !Array.isArray(msg.board.hubs)) return { ok: false }
    await saveBoard(msg.group, msg.date, msg.board, msg.page)
    // A board tab opened to read it closes after its last read (it may read page after page first).
    const w = sender.tab && waitingBoards.get(sender.tab.id)
    if (w && msg.final && w.group === msg.group && w.day === msg.date) w.done({ ok: true })
    return { ok: true }
  },
  /** A board tab read its pages, but its last page couldn't be told apart: what was read is saved. */
  async "board-read"(_msg, sender) {
    const w = sender.tab && waitingBoards.get(sender.tab.id)
    if (w) w.done({ ok: true })
    return { ok: true }
  },
  async "board-failed"(msg, sender) {
    const w = sender.tab && waitingBoards.get(sender.tab.id)
    if (w) w.done({ ok: false, error: msg.error })
    return { ok: true }
  },
  /** The address the dash really gives a board (learned when it's open), used to open it next time. */
  async "board-url"(msg) {
    if (!["site", "city"].includes(msg.group) || !/^https:\/\/dash\.homes\.ph\//.test(msg.url || "")) return { ok: false }
    await serial(async () => {
      const urls = await get("boardUrls", {})
      if (urls[msg.group] !== msg.url) await set("boardUrls", { ...urls, [msg.group]: msg.url })
    })
    return { ok: true }
  },
  async refresh(msg) {
    await refreshAssignment(true)
    return { results: await refreshBoards(msg.groups, msg.day) }
  },
  /** The assigned pages, read again from the app (the panel asks when it opens). */
  async "assignment-refresh"() {
    return { pages: await refreshAssignment(false) }
  },
  async "start-job"(msg) {
    return { job: await startJob(msg) }
  },
  async "job-update"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId) return { ok: false }
    const next = await patchJob(msg.patch || {}, msg.note)
    // The article is published: its picture is made meanwhile (the Facebook page asks for it).
    if (msg.patch && ["short-link", "fb-post"].includes(msg.patch.step) && !imageReady.has(job.id)) imageReady.set(job.id, prepareImage(next))
    return { ok: true }
  },
  async "job-image"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId) return { picture: null }
    if (!imageReady.has(job.id)) {
      const saved = await get("jobImage", null)
      if (saved && saved.jobId === job.id) return { picture: saved.picture }
      imageReady.set(job.id, prepareImage(job))
    }
    return { picture: await imageReady.get(job.id) }
  },
  async "job-done"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId) return { ok: false }
    // Next: back to the board, where the card gets its check ("Mark as posted").
    await patchJob({ step: "mark-posted", facebook: msg.facebook, finishedAt: Date.now() }, msg.note || "Done")
    const s0 = await settings()
    const b0 = s0.brands.find((b) => b.id === job.brandId)
    await serial(async () => {
      const done = await get("done", {})
      done[HP.doneKey(job.brandId, job.day, job.time, job.title)] = { at: Date.now(), facebook: msg.facebook, brandId: job.brandId, brandName: job.brandName, day: job.day, time: job.time, title: job.title, caption: String(job.headline || "").slice(0, 300), fbPage: b0 ? b0.fbPage : "", articleUrl: job.longUrl || job.publicUrl || "" }
      for (const [k, v] of Object.entries(done)) if (Date.now() - (v.at || 0) > 21 * 86_400_000) delete done[k]
      await set("done", done)
    })
    await updateBadge()
    // Homes.ph SocMedSystem: the News Article post is published (Facebook scheduled or posted). Pages without a
    // News Article row in the app (Bayanihan…) have nothing to mark there.
    try {
      const s = await settings()
      const brand = s.allBrands.find((b) => b.id === job.brandId)
      if (brand && brand.appBrand) await appCall("/v1/news-status", { projectId: job.appProjectId || null, brand: brand.appBrand, day: job.day, time: job.time, headline: job.headline, articleUrl: job.publicUrl, facebook: msg.facebook })
    } catch (e) {
      await patchJob({}, `Homes.ph SocMedSystem: ${e.message}`)
    }
    return { ok: true }
  },
  /** The card is checked on the board: the job is over. */
  async "job-marked"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId) return { ok: false }
    await patchJob({ step: "done", marked: !!msg.marked }, msg.note || "Checked on the board")
    return { ok: true }
  },
  /** The day's carousels from Homes.ph SocMedSystem (read again). */
  async "carousel-refresh"(msg) {
    await refreshAssignment(false)
    return carouselDay(/^\d{4}-\d{2}-\d{2}$/.test(msg.day || "") ? msg.day : HP.ymd(new Date()))
  },
  async "start-carousel"(msg) {
    return { job: await startCarouselJob(msg) }
  },
  /** The carousel's slides are ready: how many, their names (1.png…) and where the app saved them. */
  async "carousel-images"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "carousel") return { error: "No carousel job." }
    try {
      const r = await carouselImagesOf(job)
      await patchJob({ images: r.files.length }, `${r.files.length} slides from Homes.ph SocMedSystem (${r.files.map((f) => f.name).join(", ")})${r.savedTo ? `, saved in ${r.savedTo}` : ""}`)
      return { count: r.files.length, names: r.files.map((f) => f.name), savedTo: r.savedTo }
    } catch (e) {
      await patchJob({}, `Homes.ph SocMedSystem: ${e.message}`)
      return { error: e.message }
    }
  },
  /** One slide (they're sent one at a time). */
  async "carousel-image"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "carousel") return { error: "No carousel job." }
    const r = await carouselImagesOf(job)
    const f = r.files[Number(msg.index)]
    return f ? { name: f.name, type: f.type || "image/png", base64: f.base64 } : { error: "No such slide." }
  },
  /** The carousel's Facebook post is sent: its pages are posted (and ticked in Homes.ph SocMedSystem). */
  async "carousel-done"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "carousel") return { ok: false }
    const keys = (Array.isArray(msg.keys) ? msg.keys : []).filter((k) => job.pages.some((p) => p.key === k))
    const facebook = msg.facebook === "posted" ? "posted" : "scheduled"
    await serial(async () => {
      const done = await get("carouselDone", {})
      const mine = { ...(done[job.projectId] || {}) }
      for (const k of keys) mine[k] = { at: Date.now(), facebook, day: job.day, synced: false }
      done[job.projectId] = mine
      // Three weeks of carousels.
      for (const [id, pages] of Object.entries(done)) if (Object.values(pages).every((r) => Date.now() - (r.at || 0) > 21 * 86_400_000)) delete done[id]
      await set("carouselDone", done)
    })
    let app = null
    let appError = null
    try {
      app = await appCall("/v1/carousel-posted", { projectId: job.projectId, pageKeys: keys, facebook }, CAROUSEL_NOT_OPEN)
      await markSynced(job.projectId, keys)
    } catch (e) {
      appError = e.message
    }
    await carouselDay(job.day, true).catch(() => {})
    const names = job.pages.filter((p) => keys.includes(p.key)).map((p) => p.short)
    await patchJob(
      { step: "done", facebook, finishedAt: Date.now(), ticked: keys, checkedInApp: !!app },
      `${msg.note || `Facebook ${facebook}`}: ${names.join(", ")}${app ? ` · ticked in Homes.ph SocMedSystem (${app.done}/${app.total})` : ` · not ticked in Homes.ph SocMedSystem (${appError})`}`,
    )
    const next = await nextCarouselGroup(job.day, job.projectId, job.missing)
    return { ok: true, checkedInApp: !!app, appError, done: app ? app.done : null, total: app ? app.total : null, next: next ? { n: next.n, pages: next.pages.map((p) => p.short) } : null }
  },
  /** "Post the next 4": the carousel's next group, in the same tab. */
  async "carousel-next"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "carousel") return { error: "No carousel job." }
    const next = await nextCarouselGroup(job.day, job.projectId, job.missing)
    if (!next) return { error: "All the carousel's pages are posted." }
    return { job: await startCarouselJob({ day: job.day, projectId: job.projectId, group: next.n, tabId: job.tabId, afterJob: job.id }) }
  },
  /** My Tasks' list was read (by a background tab, the job's tab, or you visiting it). */
  async "dtr-list"(msg, sender) {
    const day = HP.ymd(new Date())
    const w = sender.tab && waitingDtr.get(sender.tab.id)
    if (msg.signedOut) {
      await patchDtr(day, (d) => ({ ...d, error: "Sign in to dtr.homes.ph (My Tasks), then click ⟳." }))
      if (w) w({ ok: false, error: "Sign in to dtr.homes.ph (My Tasks)." })
      return { ok: false }
    }
    const rows = Array.isArray(msg.rows) ? msg.rows.slice(0, 500) : []
    const found = HP.dtrFound(rows, new Date(), HP.reportTasks(await settings()))
    await saveDtrFound(day, found, { rows: rows.length, loaded: !!msg.loaded })
    if (w) w({ ok: true })
    return { ok: true, found }
  },
  async "dtr-refresh"() {
    return refreshDtr()
  },
  async "start-day"() {
    return { job: await startDay() }
  },
  /** Start Your Day's answer for today: news false = someone else posts the News Articles (only the other tasks). */
  async "set-duty"(msg) {
    await set("duty", { day: HP.ymd(new Date()), news: msg.news !== false, at: Date.now() })
    return { ok: true }
  },
  async "start-report"(msg) {
    return { job: await startReport(msg.taskId, !!msg.partial) }
  },
  async "start-daily"() {
    return { job: await startDaily() }
  },
  /** Today's report, read from My Tasks: kept until it's sent in Messenger. */
  async "daily-file"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "daily") return { ok: false, error: "No daily report job." }
    if (typeof msg.base64 !== "string" || !msg.base64 || msg.base64.length > 36 * 1024 * 1024) return { ok: false, error: "The picture is missing or too big." }
    const name = String(msg.name || "Daily report.png").replace(/[\\/:*?"<>|]/g, " ").slice(0, 120)
    await chrome.storage.local.set({ dailyFile: { jobId: job.id, name, type: /^[\w.+-]+\/[\w.+-]+$/.test(msg.mime || "") ? msg.mime : "image/png", base64: msg.base64 } })
    await patchJob({ fileName: name }, `Today's report read from My Tasks (${name}, ${Math.round((msg.base64.length * 3) / 4 / 1024)} KB)`)
    return { ok: true }
  },
  /** My Tasks' Today's report was clicked: where Chrome saved it (a few seconds at most), then Messenger. */
  async "daily-downloaded"(msg) {
    let job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "daily") return { ok: false }
    for (let i = 0; i < 40 && !job.savedTo; i++) {
      await new Promise((r) => setTimeout(r, 250))
      job = (await getJob()) || job
    }
    await patchJob({ step: "daily-messenger" }, job.savedTo ? `Saved in ${job.savedTo}: opening the report chat in Messenger` : "Downloaded (your Downloads folder): opening the report chat in Messenger")
    return { ok: true, savedTo: job.savedTo || null }
  },
  async "daily-get-file"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "daily") return { error: "No daily report job." }
    const { dailyFile } = await chrome.storage.local.get("dailyFile")
    return dailyFile && dailyFile.jobId === job.id ? { name: dailyFile.name, type: dailyFile.type, base64: dailyFile.base64 } : { error: "Today's report wasn't kept" }
  },
  /** Sent in Messenger: the greeting and Today's report. */
  async "daily-done"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "daily") return { ok: false }
    await chrome.storage.local.remove("dailyFile")
    await patchDtr(job.day, (d) => ({ ...d, dailySent: Date.now(), dailySavedTo: job.savedTo || null, dailyFile: job.fileName || null }))
    await patchJob({ step: "done", finishedAt: Date.now() }, msg.note || "Daily report sent")
    return { ok: true }
  },
  /** The day's advertisements / Daily Trend News posters from Homes.ph SocMedSystem (read again). */
  async "ads-refresh"(msg) {
    return adsDay(/^\d{4}-\d{2}-\d{2}$/.test(msg.day || "") ? msg.day : HP.ymd(new Date()))
  },
  async "trends-refresh"(msg) {
    return trendsDay(/^\d{4}-\d{2}-\d{2}$/.test(msg.day || "") ? msg.day : HP.ymd(new Date()))
  },
  async "quote-save"(msg) {
    return saveQuote(msg)
  },
  async "quote-delete"(msg) {
    return deleteQuote(msg)
  },
  async "start-post"(msg) {
    return { job: await startPostJob(msg) }
  },
  /** The post's picture (the Facebook page asks for it). */
  async "post-image"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "post") return { error: "No post job." }
    try {
      const img = await postImageOf(job)
      await patchJob({}, `Picture: ${img.name}${img.savedTo ? `, saved in ${img.savedTo}` : ""}`)
      return img
    } catch (e) {
      await patchJob({}, `No picture: ${e.message}`)
      return { error: e.message }
    }
  },
  /** The Facebook post is sent: the ad / poster / quote is posted (an ad also in Homes.ph SocMedSystem). */
  async "post-done"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "post") return { ok: false }
    const facebook = msg.facebook === "posted" ? "posted" : "scheduled"
    await markPosted(job.day, job.key, { at: Date.now(), facebook, revision: job.revision == null ? null : job.revision, title: job.title, time: job.time, synced: job.what !== "ad" })
    let appNote = ""
    if (job.what === "ad") {
      try {
        await appCall("/v1/ad-posted", { id: job.itemId, facebook }, ADS_NOT_OPEN)
        await markPosted(job.day, job.key, { at: Date.now(), facebook, revision: job.revision == null ? null : job.revision, title: job.title, time: job.time, synced: true })
        appNote = " · marked posted in Homes.ph SocMedSystem"
        adsDay(job.day).catch(() => {})
      } catch (e) {
        appNote = ` · Homes.ph SocMedSystem: ${e.message} (it's marked there next time)`
      }
    }
    await patchJob({ step: "done", facebook, finishedAt: Date.now() }, `${msg.note || `Facebook ${facebook}`}${appNote}`)
    return { ok: true, appNote }
  },
  /** "Already posted" (or not): an ad, poster or quote marked by hand in the panel. */
  async "post-mark"(msg) {
    if (!POST_NAMES[msg.what] || typeof msg.id !== "string") return { ok: false }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(msg.day || "") ? msg.day : HP.ymd(new Date())
    await markPosted(day, `${msg.what}:${msg.id}`, msg.on ? { at: Date.now(), facebook: "manual", manual: true, synced: true } : null)
    return { ok: true }
  },
  /** Start Your Day is over: every task is in My Tasks. */
  async "dtr-day-done"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId) return { ok: false }
    await patchJob({ step: "done", finishedAt: Date.now() }, msg.note || "All the day's tasks are in My Tasks")
    return { ok: true }
  },
  /** A report is in (its updates posted, the task Done). */
  async "dtr-reported"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId || job.kind !== "dtr") return { ok: false }
    await patchDtr(job.day, (d) => ({ ...d, tasks: { ...d.tasks, [job.taskId]: { ...(d.tasks[job.taskId] || {}), status: "done", reportedAt: Date.now(), ...(msg.url ? { url: msg.url } : {}) } } }))
    await patchJob({ step: "done", finishedAt: Date.now() }, msg.note || "Report sent: Done")
    return { ok: true }
  },
  async "board-address"(msg) {
    return { url: await boardAddress(msg.group, msg.day) }
  },
  async "fb-expected"() {
    return { expected: await expectedScheduled() }
  },
  async "fb-scheduled"(msg, sender) {
    const expected = await expectedScheduled()
    const keys = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === "string") : [])
    const flagged = await scheduledResult(keys(msg.present), keys(msg.removed), keys(msg.missing), expected)
    const w = sender.tab && waitingScheduled.get(sender.tab.id)
    if (w) w({ ok: true, checked: expected.length, missing: flagged })
    return { ok: true, flagged }
  },
  async "check-scheduled"() {
    return checkScheduled()
  },
  async "open-panel"() {
    await openPanelWindow()
    return { ok: true }
  },
  async "job-fail"(msg) {
    const job = await getJob()
    if (!job || job.id !== msg.jobId) return { ok: false }
    await patchJob({ step: "failed", error: msg.error }, msg.error)
    return { ok: true }
  },
  async "stop-job"() {
    await patchJob({ step: "stopped" }, "Stopped")
    return { ok: true }
  },
  async "clear-job"() {
    await chrome.storage.local.remove(["job", "jobImage", "dailyFile"])
    return { ok: true }
  },
  async open(msg) {
    await chrome.tabs.create({ url: msg.url, active: true })
    return { ok: true }
  },
  async "focus-job"() {
    const job = await getJob()
    if (!job || !job.tabId) return { ok: false }
    const tab = await chrome.tabs.update(job.tabId, { active: true }).catch(() => null)
    if (tab) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {})
    return { ok: !!tab }
  },
  async options() {
    await chrome.runtime.openOptionsPage()
    return { ok: true }
  },
  async "app-status"() {
    const found = await findApp()
    const info = await appInfo()
    return { open: !!found, paired: !!(found && found.paired && info.token), version: found ? found.version : null }
  },
  async "app-connect"() {
    return connectApp()
  },
  async "app-disconnect"() {
    await set("app", { port: null, token: null })
    return { ok: true }
  },
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const handler = msg && handlers[msg.type]
  if (!handler) return false
  handler(msg, sender).then(reply, (e) => reply({ error: e && e.message ? e.message : String(e) }))
  return true
})

// ---------- start, alarms ----------

chrome.runtime.onInstalled.addListener(async () => {
  if (!(await get("settings", null))) await set("settings", HP.DEFAULT_SETTINGS)
  await clearDeletedMarks()
  chrome.alarms.create("tick", { periodInMinutes: 1 })
  await updateBadge()
})

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create("tick", { periodInMinutes: 1 })
  await updateBadge()
  // Chrome opened: the boards are read and the alert says what's not on Facebook yet.
  startupCheck().catch(() => {})
})

chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith("hp-")) openPanelWindow().catch(() => {})
  chrome.notifications.clear(id)
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tick") return
  await updateBadge()
  const job = await getJob()
  if (job && !["done", "failed", "stopped"].includes(job.step) && Date.now() - (job.updatedAt || 0) > (job.waitingForYou ? 45 * 60_000 : STALL_MS))
    await patchJob({ step: "failed", error: "It stopped: a page didn't load or isn't signed in. Open it, sign in, and click the time again." })
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const job = await getJob()
  if (job && job.tabId === tabId && !["done", "failed", "stopped"].includes(job.step)) await patchJob({ step: "stopped" }, "The tab was closed")
})
