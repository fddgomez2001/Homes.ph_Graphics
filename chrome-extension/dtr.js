/*
 * Homes.ph Publisher on dtr.homes.ph (My Tasks):
 *  - the list (/m/tasks): read every time, once it has loaded (the Reports pills follow it). Today's tasks are traced
 *    row by row: To do ("Today") and Done today ("Done Nov 12"). A background tab reads it and closes.
 *  - Start Your Day: only adds. For each of the day's tasks not in the list today (To do or Done), "Add a task" →
 *    the form filled in (title, details, today, 9:00 AM – 6:00 PM, In progress) → Add task, once. HR's "Search a
 *    Trending News Daily" isn't added: when it's there, it's set In progress. No update is posted.
 *  - a report (Send report, when everything it reports is posted): the task's page → one update per post ("[𝟵 𝗔𝗠]
 *    - Headline" + 𝗔𝗿𝘁𝗶𝗰𝗹𝗲 𝗟𝗶𝗻𝗸…; one already on the page isn't posted again) → Post update, each in turn → Done
 *    → back to My Tasks.
 */
;(function () {
  if (window.top !== window) return
  const HP = globalThis.HP
  if (!HP || !HP.alive || !HP.alive()) return
  const text = (el) => HP.oneLine(el && el.textContent)
  const path = () => location.pathname.replace(/\/+$/, "")
  const onList = () => path() === "/m/tasks"
  const onCreate = () => path() === "/m/tasks/create"
  const onTask = () => /^\/m\/tasks\/\d+$/.test(path())
  const signedOut = () => /\/(login|signin|sign-in)(\/|$)/i.test(location.pathname) || (!!document.querySelector("input[type=password]") && !onList() && !onTask())
  const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`

  /** The list's tasks: [{ title, url, meta: ["Today" | "Done Nov 12", "09:00 AM – 06:00 PM", "In progress", …] }]. */
  function rows() {
    return [...document.querySelectorAll("a.task-row, a.list-item")]
      .filter((a) => {
        try {
          return /\/m\/tasks\/\d+\/?$/.test(new URL(a.getAttribute("href") || "", location.href).pathname)
        } catch {
          return false
        }
      })
      .map((a) => ({
        title: text(a.querySelector("b, strong") || a),
        url: new URL(a.getAttribute("href"), location.href).href,
        meta: [...new Set([...a.querySelectorAll(".task-meta span, .meta span")])].map(text).filter(Boolean),
      }))
  }

  /** What the page says went wrong (a form that came back). */
  const errorText = () =>
    [...document.querySelectorAll(".alert-danger, .invalid-feedback, .text-danger, .error, .errors, [role=alert]")]
      .map(text)
      .filter(Boolean)
      .join(" ")
      .slice(0, 200)

  /** The list, once it has loaded (its rows stop changing; an empty list after a while). */
  async function readList() {
    let count = -1
    let still = 0
    for (let i = 0; i < 40 && still < 3; i++) {
      const n = rows().length
      still = n === count && (n > 0 || i > 12) ? still + 1 : 0
      count = n
      await HP.sleep(n ? 150 : 250)
    }
    const list = rows()
    const loaded = list.length > 0 || !!document.querySelector(".card, .card-header, main, h1, h2")
    await HP.send({ type: "dtr-list", rows: list, loaded })
    return HP.dtrFound(list, new Date(), HP.reportTasks(await HP.settings()))
  }

  // ---------- the task page's status (To do / In progress / Done) ----------

  const statusButton = (value) => document.querySelector(`button[name="status"][value="${value}"]`)
  /** The task's status is this one (its button is the current one: disabled, pressed, or the only highlighted one). */
  function statusIs(value) {
    const b = statusButton(value)
    if (!b) return false
    const current = (x) => x.disabled || x.getAttribute("aria-pressed") === "true" || ["true", "page", "step"].includes(x.getAttribute("aria-current") || "")
    if (current(b)) return true
    const all = [...document.querySelectorAll('button[name="status"]')]
    if (all.some(current)) return false
    const lit = all.filter((x) => x.classList.contains("btn-primary") || x.classList.contains("active"))
    return lit.length === 1 && lit[0] === b
  }

  // ---------- Start Your Day ----------

  /** On My Tasks: the next task not in the list today (and not sent already) is added; then HR's task In progress; then done. */
  async function addNext(job, found) {
    if (job.pending) await HP.jobUpdate(job, { pending: null })
    // The assigned pages' tasks (Homes.ph SocMedSystem → Settings → Assigned pages).
    const settings = await HP.settings()
    const ADD = HP.addTasks(settings)
    const ALL = HP.reportTasks(settings)
    const submitted = job.submitted || []
    if (!job.existing) {
      const there = ADD.filter((t) => found[t.id])
      await HP.jobUpdate(job, { existing: there.map((t) => t.id) }, there.length ? `Already in My Tasks today: ${there.map((t) => `${t.name} (${found[t.id].status === "done" ? "Done" : "In progress"})`).join(", ")}` : "None of today's tasks is in My Tasks yet")
    }
    const missing = ADD.filter((t) => !found[t.id] && !submitted.includes(t.id))
    if (missing.length) {
      const next = missing[0]
      const n = ADD.indexOf(next) + 1
      await HP.jobUpdate(job, { next: next.id }, `Adding "${next.title}"`)
      HP.banner({ title: "Start Your Day", text: `Adding ${next.name}'s task (${n} of ${ADD.length})…`, buttons: [stop] })
      await HP.sleep(400)
      if (!(await HP.stillRunning(job))) return HP.hideBanner()
      const add = [...document.querySelectorAll("a[href]")].find((a) => {
        try {
          return /\/m\/tasks\/create\/?$/.test(new URL(a.getAttribute("href"), location.href).pathname)
        } catch {
          return false
        }
      })
      if (add) add.click()
      else location.href = new URL("/m/tasks/create", location.origin).href
      return
    }
    // HR's Search a Trending News Daily: In progress (once), when it's there and still To do.
    const trend = found.trending
    if (trend && trend.url && !["in_progress", "done"].includes(trend.status) && !job.trendTried) {
      await HP.jobUpdate(job, { trendTried: true, marking: trend.url }, "Search a Trending News Daily (HR's task): In progress")
      HP.banner({ title: "Start Your Day", text: "Setting HR's \"Search a Trending News Daily\" to In progress…", buttons: [stop] })
      location.href = trend.url
      return
    }
    const notSeen = submitted.filter((id) => !found[id])
    const twice = ALL.filter((t) => found[t.id] && found[t.id].count > 1).map((t) => t.name)
    const parts = [
      submitted.length ? `Added ${plural(submitted.length, "task")}` : "Nothing to add",
      `all ${ADD.length} of today's tasks are in My Tasks${notSeen.length ? ` (not listed yet: ${notSeen.join(", ")})` : ""}`,
    ]
    const notes = [
      trend ? `Search a Trending News Daily: ${trend.status === "done" ? "Done" : "In progress"}` : "Search a Trending News Daily isn't in My Tasks yet (HR adds it)",
      ...(twice.length ? [`twice today: ${twice.join(", ")} (the open one gets the report)`] : []),
    ]
    const note = `${parts.join(": ")}. ${notes.join(". ")}.`
    await HP.send({ type: "dtr-day-done", jobId: job.id, note })
    HP.banner({ title: "Start Your Day: done", text: `${note} Each Send report button shows once everything it reports is posted.`, tone: "ok", buttons: [{ label: "Close", onClick: HP.hideBanner }] })
  }

  /** Add a task: the form filled in for the next task, then Add task (once). */
  async function fillTask(job) {
    const task = HP.addTasks(await HP.settings()).find((t) => t.id === job.next)
    if (!task) {
      location.href = HP.DTR_TASKS_URL
      return
    }
    // The form came back instead of the task being added: why.
    if (job.pending === task.id) return HP.jobFail(job, `My Tasks didn't add "${task.title}"${errorText() ? `: ${errorText()}` : ""}. Check the form, then click Start Your Day again (tasks already added aren't added twice).`)
    const title = await HP.waitFor(() => document.getElementById("title"), 10000)
    const details = document.getElementById("description")
    const date = document.getElementById("due_date")
    const from = document.getElementById("start_time")
    const to = document.getElementById("end_time")
    const status = document.querySelector('input[name="status"][value="in_progress"]')
    const submit = [...document.querySelectorAll("button, input[type=submit]")].find((b) => /^add task$/i.test(text(b) || b.value || ""))
    if (!title || !date || !submit) return HP.jobFail(job, "The Add a task form didn't show its title, date or Add task button. Reload My Tasks, then click Start Your Day again.")
    const day = HP.ymd(new Date())
    HP.setValue(title, task.title)
    if (details) HP.setValue(details, task.details)
    HP.setValue(date, day)
    // Time in to time out: 9:00 AM – 6:00 PM, Saturday 9:00 AM – 12:00 PM.
    const hours = HP.workHours(day)
    if (from) HP.setValue(from, hours.from)
    if (to) HP.setValue(to, hours.to)
    if (status) {
      ;(status.closest("label") || status).click()
      if (!status.checked) {
        status.checked = true
        status.dispatchEvent(new Event("change", { bubbles: true }))
      }
    }
    await HP.sleep(300)
    if (title.value !== task.title || date.value !== day) return HP.jobFail(job, "The form didn't take the task's title or date. Click Start Your Day again.")
    if (status && !status.checked) return HP.jobFail(job, "The form's In progress choice couldn't be picked. Click Start Your Day again.")
    const settings = await HP.settings()
    const go = await HP.countdown(job, Math.min(settings.countdown, 3), `Start Your Day: ${task.name}`, `Add task "${task.title}" (today, ${HP.workHoursLabel(day)}, In progress)`)
    if (!go) return HP.hideBanner()
    // Sent once: a reload never adds it twice.
    const fresh = (await HP.myJob("dtr-add")) || job
    await HP.jobUpdate(fresh, { pending: task.id, submitted: [...new Set([...(fresh.submitted || []), task.id])] }, `Added: ${task.title}`)
    HP.banner({ title: "Start Your Day", text: `Adding ${task.name}'s task…`, buttons: [stop] })
    submit.click()
  }

  /** HR's task, opened by Start Your Day: In progress, then back to My Tasks. */
  async function markInProgress(job) {
    await HP.waitFor(() => statusButton("in_progress") || statusButton("done"), 8000)
    const btn = statusButton("in_progress")
    if (btn && !statusIs("in_progress") && !statusIs("done")) {
      await HP.jobUpdate(job, { marking: null })
      btn.click()
      // The page reloads (this script starts again there and goes back to the list).
      if (await HP.waitFor(() => (statusIs("in_progress") ? true : null), 8000, 300)) location.href = HP.DTR_TASKS_URL
      return
    }
    await HP.jobUpdate(job, { marking: null }, btn ? "" : "Search a Trending News Daily: its In progress button wasn't found (left as it is)")
    location.href = HP.DTR_TASKS_URL
  }

  // ---------- a report ----------

  /** On My Tasks: the report's task (today's, by its title) opens; one Done already (just now) is the end. */
  async function openTask(job, found) {
    const t = found[job.taskId]
    if (!t || !t.url) return HP.jobFail(job, `"${job.taskTitle}" isn't in My Tasks today.${job.taskId === "trending" ? " It's HR's task: wait for it to be added, then click Send report again." : " Click Start Your Day first."}`)
    if (job.pendingDone && t.status === "done") return finish(job, t.url)
    location.href = t.url
  }

  async function finish(job, url) {
    await HP.send({ type: "dtr-reported", jobId: job.id, url, note: `Report sent: ${plural(job.updates.length, "update")}${job.partial ? ` (${job.partial})` : ""}, Done` })
    HP.banner({ title: `${job.label}: sent`, text: `${plural(job.updates.length, "update")} posted${job.partial ? ` (${job.partial})` : ""} and the task is Done. Back to My Tasks…`, tone: "ok", buttons: [{ label: "Close", onClick: HP.hideBanner }] })
  }

  /** The task's page: each update not on it yet is posted in turn, then Done, then back to My Tasks. */
  async function writeUpdates(job) {
    const pageText = () => HP.norm(document.body ? document.body.innerText : "")
    await HP.waitFor(() => (pageText().includes(HP.norm(job.taskTitle)) ? true : null), 8000)
    if (!pageText().includes(HP.norm(job.taskTitle))) return HP.jobFail(job, `This page isn't the task "${job.taskTitle}". Click Send report again.`)
    // An update is on the page when its first line is ("[9 AM] - Headline", bold or not).
    const isThere = (u) => pageText().includes(HP.norm(u.text.split("\n")[0]))
    const posted = new Set(job.posted || [])
    for (;;) {
      if (!(await HP.stillRunning(job))) return HP.hideBanner()
      const cur = (await HP.myJob("dtr-update")) || job
      if (cur.pendingUpdate) {
        const u = cur.updates.find((x) => x.key === cur.pendingUpdate)
        if (u && !isThere(u) && errorText()) return HP.jobFail(cur, `The update wasn't posted: ${errorText()}`)
        posted.add(cur.pendingUpdate)
        await HP.jobUpdate(cur, { pendingUpdate: null, posted: [...posted] })
      }
      for (const u of cur.updates) if (!posted.has(u.key) && isThere(u)) posted.add(u.key)
      const next = cur.updates.find((u) => !posted.has(u.key))
      if (!next) break
      const box = await HP.waitFor(() => document.querySelector('textarea[name="body"]'), 10000)
      const btn = HP.buttonByText(document, /^post update$/i)
      if (!box || !btn) return HP.jobFail(cur, "The task's update box (Write an update… / Post update) wasn't found. Open the task once, then click Send report again.")
      const i = cur.updates.indexOf(next) + 1
      HP.banner({ title: `${cur.label}: update ${i} of ${cur.updates.length}`, text: next.text.split("\n")[0], buttons: [stop] })
      HP.setValue(box, next.text)
      await HP.sleep(400)
      if (box.value.replace(/\r\n/g, "\n") !== next.text) return HP.jobFail(cur, "The update box didn't take the text. Click Send report again.")
      await HP.jobUpdate(cur, { pendingUpdate: next.key, posted: [...posted] }, `Update: ${next.text.split("\n")[0]}`)
      btn.click()
      // The page reloads with it (this script starts again there); or it's added here.
      const shown = await HP.waitFor(() => (isThere(next) ? true : null), 10000, 300)
      if (!shown) return
    }
    // Every update is in: Done (once).
    const cur = (await HP.myJob("dtr-update")) || job
    if (!statusIs("done")) {
      const doneBtn = statusButton("done")
      if (!doneBtn) return HP.jobFail(cur, "Every update is posted, but the task's Done button wasn't found: click Done yourself.")
      if (cur.pendingDone && Date.now() - cur.pendingDone < 60_000) return HP.jobFail(cur, `Every update is posted, but the task didn't become Done${errorText() ? `: ${errorText()}` : ""}. Click Done yourself.`)
      await HP.jobUpdate(cur, { pendingDone: Date.now(), posted: [...posted] }, `All ${cur.updates.length} updates are in: Done`)
      HP.banner({ title: `${cur.label}: Done`, text: `All ${plural(cur.updates.length, "update")} are in. Marking the task Done…`, buttons: [stop] })
      doneBtn.click()
      if (!(await HP.waitFor(() => (statusIs("done") ? true : null), 10000, 300))) return
    }
    await finish(cur, location.href)
    await HP.sleep(900)
    const back = document.querySelector("a.back-btn")
    if (back) back.click()
    else location.href = HP.DTR_TASKS_URL
  }

  // ---------- the daily report: Today's report downloaded, then the report chat in Messenger ----------

  async function getReport(job) {
    const link = await HP.waitFor(
      () =>
        [...document.querySelectorAll("a[href]")].find((a) => {
          try {
            return /\/m\/tasks\/report\/?$/.test(new URL(a.getAttribute("href"), location.href).pathname)
          } catch {
            return false
          }
        }) || null,
      8000,
    )
    if (!link) return HP.jobFail(job, "My Tasks didn't show its \"Today's report\" button. Open My Tasks once, then click Send daily report again.")
    HP.banner({ title: "Daily report", text: "Getting Today's report from My Tasks…", buttons: [stop] })
    let file
    try {
      const res = await fetch(link.href, { credentials: "include" })
      if (!res.ok) throw new Error(`My Tasks answered ${res.status}`)
      const blob = await res.blob()
      if (!blob.size) throw new Error("it came empty")
      if (blob.size > 25 * 1024 * 1024) throw new Error("it's over 25 MB")
      if (/text\/html/i.test(blob.type)) throw new Error("a page came instead of the picture (signed out?)")
      const type = blob.type || "image/png"
      const disposition = res.headers.get("content-disposition") || ""
      const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
      let name = m ? decodeURIComponent(m[1]) : link.getAttribute("download") || ""
      if (!name) name = `Daily report ${HP.ymd(new Date())}.${(type.split("/")[1] || "png").replace("jpeg", "jpg")}`
      file = { name: name.replace(/[\\/:*?"<>|]/g, " ").trim().slice(0, 120), type, base64: await HP.blobToBase64(blob) }
    } catch (e) {
      return HP.jobFail(job, `Today's report couldn't be read (${e.message}). Sign in to dtr.homes.ph, then click Send daily report again.`)
    }
    if (!(await HP.stillRunning(job))) return HP.hideBanner()
    const kept = await HP.send({ type: "daily-file", jobId: job.id, name: file.name, mime: file.type, base64: file.base64 })
    if (!kept || !kept.ok) return HP.jobFail(job, `Today's report couldn't be kept for Messenger (${(kept && kept.error) || "no answer"}).`)
    // My Tasks' own download (the picture in your Downloads folder).
    link.click()
    const r = await HP.send({ type: "daily-downloaded", jobId: job.id })
    const where = r && r.savedTo ? `in ${r.savedTo}` : `in your Downloads folder as "${file.name}"`
    HP.banner({ title: "Daily report: Today's report downloaded", text: `Remember: it's saved ${where}. Opening the report chat in Messenger…`, tone: "ok", buttons: [stop] })
    await HP.sleep(3500)
    if (await HP.stillRunning(job)) location.href = HP.MESSENGER_REPORT_URL
  }

  // ---------- start ----------

  /** This page came back from the browser's history (Back): what it shows may be an old copy. */
  const fromHistory = () => {
    try {
      const nav = performance.getEntriesByType("navigation")[0]
      return !!nav && nav.type === "back_forward"
    } catch {
      return false
    }
  }

  let started = false
  /** `jobOnly`: a job just started somewhere: this page only acts when the job is its own (its list may be old). */
  async function run(jobOnly) {
    if (started) return
    started = true
    let mine = null
    try {
      const [me, job] = await Promise.all([HP.send({ type: "whoami" }), HP.myJob()])
      // The daily report: Today's report from the list, then Messenger.
      if (job && job.kind === "daily" && job.step === "daily-download") {
        if (signedOut()) return await HP.jobFail(job, "Sign in to dtr.homes.ph (My Tasks), then click Send daily report again.")
        if (onList()) return await getReport(job)
        location.href = HP.DTR_TASKS_URL
        return
      }
      mine = job && job.kind === "dtr" ? job : null
      if (jobOnly && !mine) return
      if (signedOut()) {
        if (me.want && me.want.dtr) await HP.send({ type: "dtr-list", signedOut: true })
        if (mine) await HP.jobFail(mine, "Sign in to dtr.homes.ph (My Tasks), then try again.")
        return
      }
      // A list shown again by Back may be an old copy: never read it as it is (the job's tab loads it again).
      if (onList() && fromHistory()) {
        if (mine) location.reload()
        return
      }
      // A tab that was already open shows the list as it was then: only a page just loaded (or reloaded) is read.
      if (onList() && jobOnly) {
        location.reload()
        return
      }
      if (onList()) {
        // Always read: the Reports pills follow My Tasks.
        const found = await readList()
        if (mine && mine.step === "dtr-add") return await addNext(mine, found)
        if (mine && mine.step === "dtr-update") return await openTask(mine, found)
      } else if (onCreate() && mine && mine.step === "dtr-add") return await fillTask(mine)
      else if (onTask() && mine) {
        if (mine.step === "dtr-add") {
          if (mine.marking) return await markInProgress(mine)
          // Add task may land on the new task's page: back to the list for the next one.
          await HP.jobUpdate(mine, { pending: null })
          location.href = HP.DTR_TASKS_URL
          return
        }
        if (mine.step === "dtr-update") return await writeUpdates(mine)
      }
    } catch (e) {
      if (HP.cutOff(e)) return
      if (mine) await HP.jobFail(mine, `Something on My Tasks didn't go as expected (${(e && e.message) || e}). Nothing is posted twice: click ${mine.step === "dtr-add" ? "Start Your Day" : "Send report"} again.`)
    } finally {
      started = false
    }
  }

  void run(false)
  HP.onStorage((changes, area) => {
    if (area === "local" && changes.job && changes.job.newValue && ["dtr-add", "dtr-update"].includes(changes.job.newValue.step) && (!changes.job.oldValue || changes.job.oldValue.id !== changes.job.newValue.id)) void run(true)
  })
})()
