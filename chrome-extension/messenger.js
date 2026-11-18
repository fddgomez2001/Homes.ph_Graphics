/*
 * Homes.ph Publisher on messenger.com: the daily report. In the report chat, the greeting is typed with real
 * @mentions (each name typed after @ and picked from Messenger's list, then checked), sent, then Today's report
 * picture (from My Tasks) is attached and sent. Nothing is sent unless every mention is a real one and the
 * greeting reads right.
 */
;(function () {
  if (window.top !== window) return
  const HP = globalThis.HP
  if (!HP || !HP.alive || !HP.alive()) return
  const stop = { label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }
  const onThread = () => location.pathname.replace(/\/+$/, "") === new URL(HP.MESSENGER_REPORT_URL).pathname
  const squash = (s) => String(s || "").replace(/[\s ​]+/g, "")

  /** The message box (Messenger's editor), the last one on the page (the open chat's). */
  const composer = () => [...document.querySelectorAll('[role="textbox"][contenteditable="true"]')].filter(HP.visible).pop() || null
  const signedOut = () => !!document.querySelector('input[name="email"], input[name="pass"], #loginbutton, button[name="login"]')
  const boxText = (box) => (box.innerText || "").replace(/ /g, " ").replace(/​/g, "")

  /** The box's real mentions: the names Messenger turned into a mention ("@Anthony Orais Leuterio", no spell check). */
  const mentionsIn = (box) =>
    [...box.querySelectorAll('[spellcheck="false"], [data-mention]')]
      .filter((el) => el !== box)
      .map((el) => HP.oneLine(el.textContent))
      .filter((t) => t.startsWith("@"))
  const hasMention = (box, name) => mentionsIn(box).some((t) => HP.norm(t) === HP.norm(name))

  function caretToEnd(box) {
    box.focus()
    const sel = getSelection()
    const r = document.createRange()
    r.selectNodeContents(box)
    r.collapse(false)
    sel.removeAllRanges()
    sel.addRange(r)
  }

  /** The caret where the box has it (after a mention Messenger puts it right after the name); at the end when it's elsewhere. */
  function ensureCaret(box) {
    if (document.activeElement !== box) box.focus()
    const sel = getSelection()
    if (!sel.rangeCount || !box.contains(sel.getRangeAt(0).startContainer)) caretToEnd(box)
  }

  const paste = (box, s) => {
    const dt = new DataTransfer()
    dt.setData("text/plain", s)
    box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }))
  }

  /**
   * Puts text in the box at its caret. Words (and line breaks) are pasted as plain text, as Messenger's editor takes a
   * paste (Enter would send the message); "@Name" is typed (`typed`) so Messenger opens its list of names. True once it's in.
   */
  async function insert(box, s, typed) {
    const before = squash(boxText(box)).length
    const grew = () => squash(boxText(box)).length >= before + squash(s).length
    ensureCaret(box)
    if (typed) {
      document.execCommand("insertText", false, s)
      await HP.sleep(200)
      if (grew()) return true
      ensureCaret(box)
      paste(box, s)
    } else {
      paste(box, s)
      await HP.sleep(200)
      if (grew()) return true
      // A paste that isn't taken: typed instead, line by line.
      const lines = s.split("\n")
      for (let i = 0; i < lines.length; i++) {
        ensureCaret(box)
        if (i) document.execCommand("insertLineBreak")
        if (lines[i]) document.execCommand("insertText", false, lines[i])
        await HP.sleep(80)
      }
    }
    await HP.sleep(200)
    return grew()
  }

  /** Messenger's list of names while "@Name" is typed: the option for exactly this person. */
  function mentionOption(name) {
    const want = HP.norm(name)
    const all = [...document.querySelectorAll('[role="option"], [role="listbox"] [role="row"], [role="listbox"] li, [role="menuitem"]')].filter(HP.visible)
    const hits = all.filter((o) => HP.norm(o.textContent).includes(want)).sort((a, b) => a.textContent.length - b.textContent.length)
    return hits[0] || null
  }

  const click = (el) => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const Ev = type.startsWith("pointer") && typeof PointerEvent === "function" ? PointerEvent : MouseEvent
      el.dispatchEvent(new Ev(type, { bubbles: true, cancelable: true, view: window, button: 0 }))
    }
  }

  /** "@Name" typed, then the person picked from Messenger's list: a real mention. Returns what went wrong, or "". */
  async function mention(box, name) {
    if (!(await insert(box, `@${name}`, true))) return `"@${name}" couldn't be typed in the message box.`
    const opt = await HP.waitFor(() => mentionOption(name), 8000, 200)
    if (!opt) return `Messenger didn't list ${name} after "@" (is ${name.split(" ")[0]} in this chat?).`
    click(opt)
    if (await HP.waitFor(() => (hasMention(box, name) ? true : null), 3000, 150)) return ""
    // Some lists take Enter for the highlighted name.
    const key = (type) => box.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }))
    if (mentionOption(name)) {
      key("keydown")
      key("keyup")
      if (await HP.waitFor(() => (hasMention(box, name) ? true : null), 2000, 150)) return ""
    }
    return `${name} wasn't turned into a mention (picked from Messenger's list).`
  }

  /** Sends what's in the box (Enter, else the Send button); true once it went (`gone()` says so). */
  async function send(box, gone) {
    const key = (type) => box.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }))
    box.focus()
    key("keydown")
    key("keypress")
    key("keyup")
    if (await HP.waitFor(() => (gone() ? true : null), 4000, 200)) return true
    const btn = [...document.querySelectorAll('[aria-label="Press enter to send" i], [aria-label="Send" i], [aria-label^="Send" i][role="button"]')].find(HP.visible)
    if (!btn) return false
    click(btn)
    return !!(await HP.waitFor(() => (gone() ? true : null), 8000, 200))
  }

  /** Clears the box (only our own greeting from an attempt that stopped). */
  async function clear(box) {
    caretToEnd(box)
    await HP.sleep(50)
    document.execCommand("selectAll")
    document.execCommand("delete")
    await HP.sleep(200)
    return !squash(boxText(box))
  }

  const attachments = (box) => {
    const area = box.closest('[role="main"]') || document
    return [...area.querySelectorAll('img[src^="blob:"], [aria-label*="remove attachment" i], [aria-label*="remove" i][role="button"]')].filter(HP.visible).length
  }

  async function sendDaily(job) {
    const settings = await HP.settings()
    HP.banner({ title: "Daily report", text: "Opening the report chat…", buttons: [stop] })
    const box = await HP.waitFor(() => composer() || (signedOut() ? "out" : null), 40000, 300)
    if (box === "out" || !box) return HP.jobFail(job, box === "out" ? "Sign in to Messenger (messenger.com) in Chrome, then click Send daily report again." : "The report chat's message box didn't show. Open the chat once, then click Send daily report again.")
    if (!(await HP.stillRunning(job))) return HP.hideBanner()
    const where = job.savedTo ? `Saved in ${job.savedTo}` : `In your Downloads folder (${job.fileName || "Today's report"})`

    if (!job.greetingSent) {
      // The box must be empty (our own greeting from an attempt that stopped is cleared).
      if (squash(boxText(box))) {
        const ours = ["Good Evening Sir", "Good Afternoon Sir"].some((g) => squash(boxText(box)).startsWith(squash(g)))
        if (!ours || !(await clear(box))) return HP.jobFail(job, "The message box isn't empty: send or clear what's typed there, then click Send daily report again.")
      }
      HP.banner({ title: "Daily report", text: "Typing the greeting and mentioning each person…", buttons: [stop] })
      for (const part of HP.dailyGreeting(job.day)) {
        if (!(await HP.stillRunning(job))) return HP.hideBanner()
        const problem = part.mention ? await mention(box, part.mention) : (await insert(box, part.text)) ? "" : "The greeting couldn't be typed in the message box."
        if (problem) return HP.jobFail(job, `${problem} Nothing was sent: fix the greeting in the box (type @ and pick the name), press Enter, then attach Today's report (${where}).`)
      }
      // Checked before anything is sent: every mention a real one, the words right.
      const found = mentionsIn(box)
      const missing = HP.DAILY_MENTIONS.filter((n) => !hasMention(box, n))
      if (missing.length || found.length !== HP.DAILY_MENTIONS.length) return HP.jobFail(job, `Not mentioned: ${missing.join(", ") || "(an extra mention)"}. Nothing was sent: fix the greeting, press Enter, then attach Today's report (${where}).`)
      const typed = boxText(box)
      const glued = HP.DAILY_MENTIONS.filter((n) => {
        const i = typed.indexOf(`@${n}`)
        return i > 0 && !/\s/.test(typed[i - 1])
      })
      if (squash(typed) !== squash(HP.greetingText(job.day)) || glued.length) return HP.jobFail(job, `The greeting doesn't read as it should ("${HP.oneLine(typed).slice(0, 140)}"${glued.length ? `: no space before @${glued[0]}` : ""}). Nothing was sent: fix it in the box and press Enter, then attach Today's report (${where}).`)
      await HP.jobUpdate(job, {}, `Greeting typed: ${HP.DAILY_MENTIONS.length} mentions checked (${HP.DAILY_MENTIONS.join(", ")})`)
      const go = await HP.countdown(job, Math.min(settings.countdown, 5), "Daily report: the greeting", `Sending "${HP.greetingWord(job.day)}" with ${HP.DAILY_MENTIONS.map((n) => `@${n}`).join(", ")}`)
      if (!go) return HP.hideBanner()
      if (!(await send(box, () => !squash(boxText(box))))) return HP.jobFail(job, "The greeting is typed (mentions checked) but wasn't sent: press Enter in the chat, then attach Today's report.")
      await HP.jobUpdate(job, { greetingSent: true }, "Greeting sent")
    }

    // Today's report, attached and sent.
    HP.banner({ title: "Daily report", text: "Attaching Today's report…", buttons: [stop] })
    const file = await HP.send({ type: "daily-get-file", jobId: job.id })
    if (!file || file.error || !file.base64) return HP.jobFail(job, `The greeting is sent, but Today's report isn't here (${(file && file.error) || "missing"}): attach it yourself. ${where}.`)
    const input = await HP.waitFor(() => [...document.querySelectorAll('input[type="file"]')].find((i) => !i.disabled) || null, 8000, 250)
    if (!input) return HP.jobFail(job, `The greeting is sent, but the chat's attach box wasn't found: attach Today's report yourself. ${where}.`)
    const before = attachments(box)
    HP.setFiles(input, [new File([HP.base64ToBlob(file.base64, file.type)], file.name, { type: file.type })])
    if (!(await HP.waitFor(() => (attachments(box) > before ? true : null), 10000, 250))) return HP.jobFail(job, `The greeting is sent, but Today's report didn't attach: attach it yourself. ${where}.`)
    await HP.sleep(600)
    if (!(await HP.stillRunning(job))) return HP.hideBanner()
    if (!(await send(box, () => attachments(box) <= before))) return HP.jobFail(job, `Today's report is attached but wasn't sent: press Enter in the chat. ${where}.`)
    await HP.send({ type: "daily-done", jobId: job.id, note: `Daily report sent in Messenger: the greeting (${HP.DAILY_MENTIONS.length} mentions) and Today's report (${file.name})` })
    HP.banner({ title: "Daily report sent", text: `The greeting with ${HP.DAILY_MENTIONS.length} mentions and Today's report are in the chat. ${where}.`, tone: "ok", buttons: [{ label: "Close", onClick: HP.hideBanner }] })
  }

  let started = false
  async function run() {
    if (started || !onThread()) return
    started = true
    let job = null
    try {
      job = await HP.myJob("daily-messenger")
      if (job) await sendDaily(job)
    } catch (e) {
      if (!HP.cutOff(e) && job) await HP.jobFail(job, `Something in Messenger didn't go as expected (${(e && e.message) || e}). Check the chat before trying again.`)
    } finally {
      started = false
    }
  }

  void run()
  // Messenger is a single-page app: the chat can open without a page load.
  let href = location.href
  HP.every(700, () => {
    if (location.href === href) return
    href = location.href
    void run()
  })
  HP.onStorage((changes, area) => {
    if (area === "local" && changes.job && changes.job.newValue && changes.job.newValue.step === "daily-messenger" && (!changes.job.oldValue || changes.job.oldValue.step !== "daily-messenger")) void run()
  })
})()
