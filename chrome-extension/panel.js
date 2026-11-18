/*
 * Homes.ph Publisher: the panel (in the floating button's window on any page, and in the toolbar popup). Tabs:
 *  - Posting: today's article slots per brand as time pills (published, to publish, due, no article yet); a pill to
 *    publish starts the job; a logo opens the brand's board. Below: the day's carousel from Homes.ph SocMedSystem, its
 *    Facebook pages in posts of 4 (green = posted, ticked on the app's checklist).
 *  - Trending: Daily Trend News posters from Homes.ph SocMedSystem's Poster Maker, per page (PicklePlay, FHI, Caraga,
 *    Gensan…): a pill posts the poster (its picture, its AI caption, its time) to its page.
 *  - Ads: the advertisements scheduled in Homes.ph SocMedSystem (its Advertisement page), same pills.
 *  - Quotes: a daily quote per page (PicklePlay, FHI, Caraga, Gensan): Schedule a quote (picture, caption, time:
 *    4:00 PM unless changed) → Done setup → Post.
 *  - Reports: Start Your Day (today's tasks added in My Tasks on dtr.homes.ph) and a pill per task: gray not added,
 *    light orange In progress, light green Done. Send report shows once everything a task reports is posted.
 * Green = posted (through the extension, or marked ✓ by hand).
 */
;(function () {
  const HP = globalThis.HP

  HP.PANEL_CSS = `
  :host, .hp-root { all: initial; }
  .hp-panel { font: 13px/1.35 "Segoe UI", system-ui, -apple-system, sans-serif; color: #0f172a; background: #fff; border-radius: 16px; box-shadow: 0 18px 50px rgba(15, 23, 42, .28), 0 2px 8px rgba(15, 23, 42, .12); width: 380px; max-width: calc(100vw - 24px); overflow: hidden; border: 1px solid #e2e8f0; }
  .hp-head { display: flex; align-items: center; gap: 8px; padding: 12px 12px 10px 14px; background: linear-gradient(135deg, #1428AE, #0D1969); color: #fff; }
  .hp-head img { width: 26px; height: 26px; border-radius: 7px; background: #fff; padding: 2px; box-sizing: border-box; }
  .hp-title { flex: 1; min-width: 0; }
  .hp-title b { display: block; font-size: 14px; }
  .hp-title span { font-size: 11px; opacity: .8; }
  .hp-icon { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #fff; font-size: 15px; }
  .hp-icon:hover { background: rgba(255,255,255,.16); }
  .hp-icon:focus-visible { outline: 2px solid #fff; }
  .hp-days { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; font-weight: 700; color: #1e293b; }
  .hp-days b { flex: 1; text-align: center; }
  .hp-day { all: unset; cursor: pointer; min-width: 26px; height: 24px; padding: 0 6px; box-sizing: border-box; border-radius: 7px; display: grid; place-items: center; color: #1428AE; font-weight: 800; border: 1px solid #c7d2fe; background: #fff; }
  .hp-day:hover { background: #EEF2FF; }
  .hp-day:focus-visible { outline: 2px solid #1428AE; outline-offset: 1px; }
  .hp-body { padding: 8px 10px 4px; max-height: min(70vh, 520px); overflow: auto; }
  .hp-brand { display: flex; gap: 10px; align-items: flex-start; padding: 8px 4px; border-bottom: 1px solid #f1f5f9; }
  .hp-brand:last-child { border-bottom: 0; }
  .hp-homes { display: flex; align-items: center; gap: 8px; padding: 8px 4px 2px; }
  .hp-homes img { width: 22px; height: 22px; border-radius: 6px; }
  .hp-homes b { font-size: 13px; color: #0f172a; }
  .hp-homes select { flex: 1; min-width: 0; font: inherit; font-size: 12.5px; font-weight: 600; color: #1e293b; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
  .hp-homes small { color: #64748b; font-size: 11px; white-space: nowrap; }
  .hp-logo { all: unset; cursor: pointer; flex: none; width: 40px; height: 40px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; display: grid; place-items: center; box-shadow: 0 1px 2px rgba(0,0,0,.05); box-sizing: border-box; }
  .hp-logo:hover { border-color: #1428AE; }
  .hp-logo:focus-visible { outline: 2px solid #1428AE; outline-offset: 2px; }
  .hp-logo img { width: 32px; height: 32px; object-fit: contain; }
  span.hp-logo { cursor: default; }
  span.hp-logo:hover { border-color: #e2e8f0; }
  .hp-info { flex: 1; min-width: 0; }
  .hp-name { font-weight: 700; font-size: 13px; display: flex; gap: 6px; align-items: baseline; }
  .hp-name small { font-weight: 500; color: #64748b; font-size: 11px; }
  .hp-pills { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
  .hp-pill { all: unset; cursor: pointer; position: relative; display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; border: 1.5px solid transparent; line-height: 1.2; white-space: nowrap; }
  .hp-pill:focus-visible { outline: 2px solid #1428AE; outline-offset: 2px; }
  .hp-published { background: #16A34A; color: #fff; }
  .hp-ready { background: #fff; color: #1428AE; border-color: #1428AE; }
  .hp-ready:hover { background: #EEF2FF; }
  .hp-due { background: #FBBF24; color: #422006; border-color: #F59E0B; box-shadow: 0 0 0 3px rgba(251, 191, 36, .25); }
  .hp-due:hover { background: #F59E0B; }
  .hp-empty { color: #94a3b8; border: 1.5px dashed #cbd5e1; background: #f8fafc; }
  .hp-live { background: #E0E7FF; color: #1428AE; border-color: #A5B4FC; }
  .hp-live:hover { background: #C7D2FE; }
  .hp-gone { box-shadow: 0 0 0 2px #DC2626; }
  .hp-nofb { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid currentColor; font: 800 7px/11px "Segoe UI", sans-serif; text-align: center; box-sizing: border-box; }
  .hp-alert { margin: 6px 4px 2px; border-radius: 9px; padding: 7px 9px; font-size: 11.5px; background: #FEF2F2; color: #7f1d1d; border: 1px solid #FECACA; }
  .hp-past { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin: 4px 4px 2px; font-size: 11px; color: #475569; }
  .hp-past button { all: unset; cursor: pointer; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
  .hp-busy { background: #1428AE; color: #fff; }
  .hp-fb { width: 12px; height: 12px; border-radius: 50%; color: #fff; font: 800 8px/12px "Segoe UI", sans-serif; text-align: center; }
  .hp-fb.posted { background: #1877F2; }
  .hp-fb.scheduled { background: #16A34A; outline: 1px solid #fff; }
  .hp-count { font-size: 9px; background: rgba(0,0,0,.12); border-radius: 999px; padding: 0 4px; }
  .hp-note { font-size: 11px; color: #64748b; padding: 6px 4px; }
  .hp-job { margin: 8px 10px 0; border-radius: 10px; padding: 8px 10px; font-size: 12px; background: #EEF2FF; color: #1e1b4b; display: flex; gap: 8px; align-items: center; }
  .hp-job.failed, .hp-job.stopped { background: #FEF2F2; color: #7f1d1d; }
  .hp-job.done { background: #ECFDF5; color: #064e3b; }
  .hp-job span { flex: 1; min-width: 0; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .hp-btn { all: unset; cursor: pointer; font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 8px; background: #1428AE; color: #fff; white-space: nowrap; display: inline-flex; gap: 5px; align-items: center; box-sizing: border-box; }
  .hp-btn:focus-visible { outline: 2px solid #1428AE; outline-offset: 2px; }
  .hp-btn.ghost { background: transparent; color: inherit; border: 1px solid currentColor; }
  .hp-btn.green { background: #16A34A; }
  .hp-btn.soft { background: #EEF2FF; color: #1428AE; }
  .hp-btn.early { background: #FFF7ED; color: #9A3412; box-shadow: inset 0 0 0 1px #FDBA74; }
  .hp-btn[disabled] { opacity: .55; cursor: default; }
  .hp-foot { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; padding: 8px 14px 10px; border-top: 1px solid #f1f5f9; font-size: 10.5px; color: #64748b; background: #f8fafc; }
  .hp-key { display: inline-flex; align-items: center; gap: 4px; }
  .hp-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .hp-car { padding: 8px 4px; border-top: 1px solid #e2e8f0; margin-top: 2px; }
  .hp-car-head { display: flex; gap: 10px; align-items: flex-start; }
  .hp-car-logo { flex: none; width: 40px; height: 40px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; display: grid; place-items: center; }
  .hp-car-logo img { width: 32px; height: 32px; object-fit: contain; }
  .hp-car-title { font-size: 11.5px; color: #334155; margin-top: 1px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .hp-groups { display: flex; flex-direction: column; gap: 5px; margin: 8px 0 0; }
  .hp-group { display: grid; grid-template-columns: 50px 1fr; gap: 6px; align-items: start; }
  .hp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .hp-gbtn { all: unset; cursor: pointer; min-width: 50px; text-align: center; font-size: 10.5px; font-weight: 800; padding: 3px 7px; border-radius: 8px; background: #1428AE; color: #fff; box-sizing: border-box; display: inline-flex; gap: 4px; align-items: center; justify-content: center; }
  .hp-gbtn:hover { background: #0D1969; }
  .hp-gbtn:focus-visible { outline: 2px solid #1428AE; outline-offset: 2px; }
  .hp-gbtn.done { background: #16A34A; cursor: default; }
  .hp-gbtn.busy { background: #64748b; cursor: default; }
  .hp-page { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px; border: 1.5px solid #1428AE; color: #1428AE; background: #fff; white-space: nowrap; }
  .hp-page.posted { background: #16A34A; border-color: #16A34A; color: #fff; }
  .hp-page.busy { background: #EEF2FF; }
  .hp-tabs { display: flex; gap: 2px; padding: 6px 8px 0; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .hp-tab { all: unset; cursor: pointer; position: relative; flex: 1 1 auto; text-align: center; padding: 6px 6px 7px; font-size: 11.5px; font-weight: 700; color: #64748b; border-radius: 8px 8px 0 0; border: 1px solid transparent; border-bottom: 0; white-space: nowrap; }
  .hp-tab:hover { color: #1428AE; }
  .hp-tab.off { opacity: .45; text-decoration: line-through; }
  .hp-tab.off[aria-selected="true"] { opacity: .8; }
  .hp-subnav { display: flex; gap: 4px; margin: 0 0 8px; padding: 3px; background: #EEF2FF; border-radius: 10px; }
  .hp-subnav button { all: unset; cursor: pointer; flex: 1; text-align: center; padding: 5px 4px; font-size: 11px; font-weight: 700; color: #475569; border-radius: 7px; white-space: nowrap; }
  .hp-subnav button[aria-selected="true"] { background: #1428AE; color: #fff; }
  .hp-subnav button[aria-selected="true"] .hp-tcount { background: #fff; color: #1428AE; }
  .hp-ask { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: 11px; background: #FFF7ED; border: 1px solid #FDBA74; font-size: 12.5px; color: #7C2D12; }
  .hp-ask span { font-size: 11px; color: #9A3412; }
  .hp-ask small { font-size: 10.5px; color: #9A3412; }
  .hp-ask-btns { display: flex; gap: 6px; flex-wrap: wrap; }
  .hp-off { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; margin-bottom: 10px; border-radius: 11px; background: #F1F5F9; border: 1px dashed #94A3B8; font-size: 12px; color: #334155; }
  .hp-tab[aria-selected="true"] { background: #fff; color: #1428AE; border-color: #e2e8f0; margin-bottom: -1px; }
  .hp-tab:focus-visible { outline: 2px solid #1428AE; outline-offset: -2px; }
  .hp-tdot { position: absolute; top: 4px; right: 2px; width: 7px; height: 7px; border-radius: 50%; background: #F59E0B; }
  .hp-tcount { display: inline-block; margin-left: 3px; min-width: 15px; height: 15px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: #1428AE; color: #fff; font-size: 9.5px; line-height: 15px; font-weight: 800; vertical-align: 1px; }
  .hp-tcount.late { background: #F59E0B; color: #422006; }
  .hp-rep { padding: 4px 4px 2px; }
  .hp-rep-head { font-size: 11.5px; color: #475569; margin: 2px 0 8px; }
  .hp-start { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; text-align: center; padding: 10px 12px; border-radius: 11px; background: linear-gradient(135deg, #F59E0B, #EA580C); color: #fff; font-size: 13.5px; font-weight: 800; box-shadow: 0 4px 12px rgba(234, 88, 12, .25); display: flex; gap: 8px; align-items: center; justify-content: center; }
  .hp-start:hover { filter: brightness(1.05); }
  .hp-start:focus-visible { outline: 2px solid #1428AE; outline-offset: 2px; }
  .hp-start.ghost { background: #ECFDF5; color: #047857; box-shadow: none; border: 1px solid #A7F3D0; font-size: 12px; padding: 8px 12px; }
  .hp-start.busy { background: #64748b; box-shadow: none; cursor: default; }
  .hp-rows { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; }
  .hp-daily { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e2e8f0; }
  .hp-start.daily { background: linear-gradient(135deg, #1428AE, #0866FF); box-shadow: 0 4px 12px rgba(20, 40, 174, .25); }
  .hp-start.daily.busy { background: #64748b; box-shadow: none; }
  .hp-saved { font-size: 11px; color: #475569; margin-top: 6px; text-align: center; word-break: break-all; }
  .hp-rrow { display: grid; grid-template-columns: 112px 1fr auto; gap: 8px; align-items: center; }
  .hp-rpill { all: unset; cursor: pointer; box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 3px; border-radius: 999px; font-size: 12px; font-weight: 800; border: 1.5px solid; white-space: nowrap; }
  .hp-rpill img { width: 22px; height: 22px; border-radius: 50%; background: #fff; object-fit: contain; padding: 1px; box-sizing: border-box; }
  .hp-rpill:focus-visible { outline: 2px solid #1428AE; outline-offset: 2px; }
  .hp-rpill.none { background: #F1F5F9; color: #64748b; border-color: #CBD5E1; }
  .hp-rpill.none img { filter: grayscale(1); opacity: .7; }
  .hp-rpill.progress { background: #FFEDD5; color: #9A3412; border-color: #FDBA74; }
  .hp-rpill.done { background: #DCFCE7; color: #166534; border-color: #86EFAC; }
  .hp-rinfo { font-size: 11px; color: #475569; line-height: 1.3; }
  .hp-src { display: flex; gap: 6px; align-items: center; font-size: 11.5px; color: #475569; margin: 2px 4px 2px; }
  .hp-err { font-size: 11px; color: #b91c1c; margin: 4px; }
  .hp-items { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }
  .hp-item { display: grid; grid-template-columns: auto 1fr auto; gap: 7px; align-items: center; }
  .hp-itext { font-size: 11.5px; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .hp-kind { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .02em; color: #3f6212; background: #ECFCCB; border-radius: 5px; padding: 1px 5px; margin-right: 5px; }
  .hp-warn { color: #B45309; font-weight: 800; }
  .hp-mark { all: unset; cursor: pointer; width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid #CBD5E1; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: transparent; box-sizing: border-box; }
  .hp-mark:hover { border-color: #16A34A; color: #86EFAC; }
  .hp-mark[aria-pressed="true"] { background: #16A34A; border-color: #16A34A; color: #fff; }
  .hp-mark:focus-visible { outline: 2px solid #1428AE; outline-offset: 2px; }
  .hp-none { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  .hp-quote { display: grid; grid-template-columns: 52px 1fr; gap: 9px; align-items: start; margin-top: 6px; }
  .hp-quote img, .hp-quote .hp-noimg { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; box-sizing: border-box; }
  .hp-qtext { font-size: 11.5px; color: #334155; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 3px; }
  .hp-qbtns { display: flex; gap: 5px; align-items: center; margin-top: 6px; flex-wrap: wrap; }
  .hp-qform { margin-top: 6px; display: flex; flex-direction: column; gap: 7px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
  .hp-qpick { position: relative; cursor: pointer; display: flex; gap: 8px; align-items: center; padding: 6px 8px; border: 1.5px dashed #94a3b8; border-radius: 9px; background: #fff; font-size: 11.5px; color: #475569; }
  .hp-qpick:hover, .hp-qpick:focus-within { border-color: #1428AE; color: #1428AE; }
  .hp-qpick img { width: 46px; height: 46px; object-fit: cover; border-radius: 7px; flex: none; }
  .hp-qpick input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
  .hp-qform textarea { font: 12px/1.35 "Segoe UI", system-ui, sans-serif; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; resize: vertical; min-height: 60px; background: #fff; box-sizing: border-box; width: 100%; }
  .hp-qform textarea:focus, .hp-qform input[type=time]:focus { outline: 2px solid #1428AE; outline-offset: 0; border-color: transparent; }
  .hp-qform input[type=time] { font: 12px "Segoe UI", system-ui, sans-serif; border: 1px solid #cbd5e1; border-radius: 7px; padding: 3px 6px; background: #fff; color: #0f172a; }
  .hp-qrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 11.5px; color: #475569; }
  .hp-spin { width: 11px; height: 11px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: hp-spin .8s linear infinite; display: inline-block; box-sizing: border-box; }
  @keyframes hp-spin { to { transform: rotate(360deg); } }
  `

  const ago = (t) => {
    if (!t) return "never"
    const m = Math.round((Date.now() - t) / 60000)
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
  const STEP_TEXT = {
    "open-post": "Opening the article on the board…",
    "publish-article": "Publishing the article…",
    "short-link": "Getting the short link on homes.ph…",
    "fb-post": "Facebook post: check it and click Schedule Post…",
    "mark-posted": "Checking the card on the board…",
    "carousel-post": "Facebook post: check it and click Schedule Post…",
    "dash-carousel": "Carousel: Create Post on the Sites board…",
    "image-post": "Facebook post: check it and click Schedule Post…",
    "dtr-add": "Adding today's tasks in My Tasks…",
    "dtr-update": "Posting the report's updates in My Tasks…",
    "daily-download": "Getting Today's report from My Tasks…",
    "daily-messenger": "Sending the greeting and Today's report in Messenger…",
    done: "Done",
    failed: "Stopped",
    stopped: "Stopped",
  }
  const TABS = [
    { id: "posting", label: "Posting", title: "Articles to post" },
    { id: "trending", label: "Trending", title: "Trending News" },
    { id: "ads", label: "Ads", title: "Advertisements" },
    { id: "quotes", label: "Quotes", title: "Daily Quotes" },
    { id: "reports", label: "Reports", title: "Reports" },
  ]
  const TAB_IDS = TABS.map((t) => t.id)
  const MAX_QUOTE_BYTES = 15 * 1024 * 1024

  /** A small JPEG of a picture (the quote's thumbnail in the panel). */
  function thumbOf(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        try {
          const size = 160
          const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight))
          const c = document.createElement("canvas")
          c.width = Math.max(1, Math.round(img.naturalWidth * scale))
          c.height = Math.max(1, Math.round(img.naturalHeight * scale))
          const g = c.getContext("2d")
          g.fillStyle = "#fff"
          g.fillRect(0, 0, c.width, c.height)
          g.drawImage(img, 0, 0, c.width, c.height)
          resolve(c.toDataURL("image/jpeg", 0.8))
        } catch {
          resolve("")
        }
      }
      img.onerror = () => resolve("")
      img.src = dataUrl
    })
  }

  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ""))
      r.onerror = () => reject(new Error("The picture couldn't be read."))
      r.readAsDataURL(file)
    })

  /** Mounts the panel in `root` (an element). Returns { destroy }. */
  HP.mountPanel = function (root, opts) {
    const options = opts || {}
    let state = { settings: HP.withDefaults(null, null), boards: {}, done: {}, job: null, refreshedAt: 0, boardUrls: {}, carousels: {}, carouselDone: {}, dtr: {}, ads: {}, trends: {}, quotes: {}, posted: {}, tab: "posting" }
    let app = null
    let refreshing = false
    let message = ""
    /** The day shown (today, or a later day to publish in advance). */
    let day = HP.ymd(new Date())
    /** The quote being set up: { brandId, caption, time, image: { name, dataUrl } | null, thumb, error, saving }. */
    let draft = null
    /** A report being started (its texts may be written by the AI first). */
    let sending = null

    // Closed (it closes when a job starts): an answer that comes later never draws it again.
    let destroyed = false
    /** Start Your Day was clicked: its question shows first. */
    let askingDuty = false
    const load = async () => {
      if (destroyed) return
      const got = await HP.store.get(["settings", "assignment", "duty", "boards", "done", "job", "refreshedAt", "boardUrls", "carousels", "carouselDone", "dtr", "ads", "trends", "quotes", "posted", "panelTab", "homesPick", "trendKind"])
      if (destroyed) return
      state = {
        // Only the pages assigned in the app (its Settings → Assigned pages).
        settings: HP.withDefaults(got.settings, got.assignment, got.duty),
        trendKind: ["news", "dyk", "engagement"].includes(got.trendKind) ? got.trendKind : "news",
        homesPick: got.homesPick || null,
        boards: got.boards || {},
        done: got.done || {},
        job: got.job || null,
        refreshedAt: got.refreshedAt || 0,
        boardUrls: got.boardUrls || {},
        carousels: got.carousels || {},
        carouselDone: got.carouselDone || {},
        dtr: got.dtr || {},
        ads: got.ads || {},
        trends: got.trends || {},
        quotes: got.quotes || {},
        posted: got.posted || {},
        tab: TAB_IDS.includes(got.panelTab) ? got.panelTab : "posting",
      }
      // Not posting the News Articles today: Trending is the first tab (Posting stays, grayed, for emergencies).
      if (HP.newsOff(state.settings) && !got.panelTab) state.tab = "trending"
      if (state.tab === "ads" && !HP.adPagesOf(state.settings).length) state.tab = HP.newsOff(state.settings) ? "trending" : "posting"
      render()
    }

    /** The day's boards are read again when they're missing or older than 15 minutes. */
    const stale = () => {
      const groups = [...new Set(state.settings.brands.map((b) => b.group))]
      return Math.min(...groups.map((g) => (state.boards[`${g}|${day}`] ? state.boards[`${g}|${day}`].at : 0))) < Date.now() - 15 * 60_000
    }

    /** The day's carousel from Homes.ph SocMedSystem: read when the panel opens, the day changes or ⟳. */
    let carouselLoading = false
    const loadCarousel = async (forDay) => {
      if (carouselLoading) return
      carouselLoading = true
      render()
      await HP.send({ type: "carousel-refresh", day: forDay || day })
      carouselLoading = false
      await load()
    }

    /** The day's ads / Daily Trend News from Homes.ph SocMedSystem: read when their tab opens, the day changes or ⟳. */
    const appLoading = { ads: false, trends: false }
    const loadApp = async (kind, forDay) => {
      if (appLoading[kind]) return
      appLoading[kind] = true
      render()
      await HP.send({ type: `${kind}-refresh`, day: forDay || day })
      appLoading[kind] = false
      await load()
    }
    const tabData = (tab) => {
      if (tab === "trending") void loadApp("trends")
      if (tab === "ads") void loadApp("ads")
      if (tab === "reports") showReports()
    }

    const setDay = (next) => {
      day = next
      message = ""
      draft = null
      render()
      if (state.tab === "posting") {
        void loadCarousel()
        if (stale()) void refresh()
      } else tabData(state.tab)
    }

    const refresh = async () => {
      if (refreshing) return
      refreshing = true
      message = ""
      render()
      void loadCarousel()
      const res = await HP.send({ type: "refresh", day })
      refreshing = false
      const failed = (res.results || []).filter((r) => !r.ok)
      message = res.error || (failed.length ? failed[0].error : "")
      await load()
    }

    /** Starts a job; the answer can get lost when its tab opens, so the job in storage says whether it started. */
    const begin = async (msg, isMine) => {
      message = ""
      const res = await HP.send(msg)
      const { job } = await HP.store.get("job")
      const started = job && isMine(job) && Date.now() - (job.startedAt || 0) < 60_000
      if (res.error && !started) {
        message = res.error
        render()
      } else if (options.onStarted) options.onStarted()
    }
    const startJob = (brand, time, card) => begin({ type: "start-job", brandId: brand.id, day, time, title: card.title, postId: card.postId }, (j) => j.brandId === brand.id && j.day === day && j.time === time)
    const startCarousel = (projectId, group) => begin({ type: "start-carousel", day, projectId, group }, (j) => j.kind === "carousel" && j.projectId === projectId && j.postNo === group)
    const startPost = (what, id) => begin({ type: "start-post", what, id, day }, (j) => j.kind === "post" && j.what === what && j.itemId === id)

    /** Reports: My Tasks is read again when it's older than 15 minutes (or never read today). */
    let dtrLoading = false
    const loadDtr = async (force) => {
      const d = state.dtr[HP.ymd(new Date())]
      if (dtrLoading || (!force && d && d.at > Date.now() - 15 * 60_000)) return
      dtrLoading = true
      render()
      const res = await HP.send({ type: "dtr-refresh" })
      dtrLoading = false
      if (res && res.error) message = res.error
      await load()
    }
    const showReports = () => {
      void loadDtr(false)
      // What the reports are made of is today's.
      const today = HP.ymd(new Date())
      const old = (entry) => !entry || !entry.at || entry.at < Date.now() - 5 * 60_000
      if (old(state.carousels[today])) void HP.send({ type: "carousel-refresh", day: today })
      if (old(state.ads[today])) void HP.send({ type: "ads-refresh", day: today })
      if (old(state.trends[today])) void HP.send({ type: "trends-refresh", day: today })
    }
    const setTab = async (tab) => {
      message = ""
      draft = null
      state.tab = tab
      render()
      await HP.store.set({ panelTab: tab })
      tabData(tab)
    }
    const startDay = () => begin({ type: "start-day" }, (j) => j.kind === "dtr" && j.step === "dtr-add")
    const sendReport = async (taskId, partial) => {
      sending = taskId
      render()
      await begin({ type: "start-report", taskId, partial: !!partial }, (j) => j.kind === "dtr" && j.taskId === taskId)
      sending = null
      render()
    }

    // ---------- Reports ----------

    const reportCtx = () => ({ settings: state.settings, boards: state.boards, done: state.done, carousels: state.carousels, carouselDone: state.carouselDone, ads: state.ads, trends: state.trends, quotes: state.quotes, posted: state.posted })

    /** The Reports tab: Start Your Day, then a pill per task (gray not added, light orange In progress, light green Done). */
    function reportsHtml(now, jobActive, job) {
      const today = HP.ymd(now)
      const d = state.dtr[today]
      const ctx = reportCtx()
      const ADD = HP.addTasks(state.settings)
      const added = ADD.filter((t) => HP.dtrState(d, t.id) !== "none").length
      const adding = jobActive && job.kind === "dtr" && job.step === "dtr-add"
      const asking = askingDuty && !HP.dutyAsked(state.settings)
      const newsBrands = HP.reportOrder(state.settings.brands).map((b) => HP.reportName(b.id))
      const start = asking
        ? `<div class="hp-ask" role="group" aria-label="Start Your Day">
            <b>Will you be the one posting the News Articles today?</b>
            <span>${esc(newsBrands.join(", "))}</span>
            <div class="hp-ask-btns"><button class="hp-btn" data-act="duty-yes">Yes, I'm posting them</button><button class="hp-btn ghost" data-act="duty-no">No, only my other tasks</button></div>
            <small>No: only your other tasks go in My Tasks, Trending becomes the first tab and Posting is grayed out (still there in an emergency: Start Posting News Article).</small>
          </div>`
        : adding
        ? '<button class="hp-start busy" disabled><span class="hp-spin"></span> Adding today\'s tasks in My Tasks…</button>'
        : added === ADD.length
          ? `<button class="hp-start ghost" data-act="start-day" title="Read My Tasks again and add any task that isn't there today (none is added twice)">✓ Day started: all ${ADD.length} tasks are in My Tasks</button>`
          : `<button class="hp-start" data-act="start-day" title="Opens My Tasks (dtr.homes.ph) and adds today's tasks that aren't there yet: In progress, ${esc(HP.workHoursLabel(now))}. Nothing is reported.">☀ Start Your Day</button>`
      const rows = HP.reportTasks(state.settings).map((t) => {
        const st = HP.dtrState(d, t.id)
        const info0 = d && d.tasks && d.tasks[t.id]
        const plan = HP.reportPlan(t, ctx, today)
        const busy = jobActive && job.kind === "dtr" && job.taskId === t.id
        const unit = t.kind === "carousel" ? "pages posted" : "posted"
        const info =
          st === "none"
            ? t.hr
              ? "HR's task isn't in My Tasks yet"
              : "Not added yet"
            : st === "done"
              ? info0 && info0.reportedAt
                ? "Done · report sent"
                : "Done"
              : busy
                ? '<span class="hp-spin"></span> Posting the updates…'
                : sending === t.id
                  ? '<span class="hp-spin"></span> Getting the report ready…'
                  : plan.ready
                    ? "In progress · all posted: send the report"
                    : `In progress · ${plan.total ? `${plan.posted}/${plan.total} ${unit}` : esc(plan.why)}`
        const tip = `${t.title}\n${
          st === "none"
            ? t.hr
              ? "HR adds this task every day: it shows here once it's in My Tasks."
              : "Not in My Tasks today: click Start Your Day."
            : st === "done"
              ? "Done."
              : `In progress. ${plan.ready ? "Everything is posted: Send report posts one update per post, then Done." : plan.known ? (plan.sent.length ? `Not everything is posted yet (${plan.why}). Send ${plan.sent.length} posted reports only what's posted so far, then Done.` : `Nothing is posted yet (${plan.why}). Mark Done sets the task Done with no update.`) : `Send report shows once it's read (${plan.why}).`}`
        }`
        const n = plan.sent.length
        // Before everything is posted (time out, Saturday's half day): only what's posted is reported, then Done.
        const action =
          st !== "progress" || busy
            ? ""
            : plan.ready
              ? `<button class="hp-btn" data-report="${t.id}" ${sending ? "disabled" : ""} title="Post its ${plan.updates.length} update${plan.updates.length === 1 ? "" : "s"} in My Tasks, then Done">Send report</button>`
              : plan.known
                ? `<button class="hp-btn early" data-report="${t.id}" data-partial="1" ${sending ? "disabled" : ""} title="${esc(n ? `Not everything is posted yet (${plan.why}). Reports only the ${n} posted so far (${n} update${n === 1 ? "" : "s"} in My Tasks), then sets the task Done.` : `Nothing is posted yet (${plan.why}). Sets the task Done in My Tasks with no update.`)}">${n ? `Send ${n} posted` : "Mark Done"}</button>`
                : ""
        return `<div class="hp-rrow"><button class="hp-rpill ${st}" data-rtask="${t.id}" title="${esc(tip)}" aria-label="${esc(`${t.name}: ${st === "none" ? "not added" : st === "done" ? "done" : "in progress"}`)}"><img alt="" src="${HP.logoUrl(t.logo)}">${esc(t.name)}</button><span class="hp-rinfo">${info}</span>${action}</div>`
      }).join("")
      const read = d && d.at ? `read ${ago(d.at)}${d.listed ? ` · ${d.listed} tasks listed` : ""}` : dtrLoading ? "reading…" : "not read yet"
      // Every task Done: the daily report (Today's report, then the report chat in Messenger).
      const dailyBusy = jobActive && job.kind === "daily"
      const timeOf = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      const daily = dailyBusy
        ? '<button class="hp-start daily busy" disabled><span class="hp-spin"></span> Sending the daily report…</button>'
        : HP.allReportsDone(d, state.settings)
          ? d.dailySent
            ? `<button class="hp-start ghost" data-act="send-daily" title="Send it again: Today's report from My Tasks, the greeting with the mentions, then the picture">✓ Daily report sent at ${esc(timeOf(d.dailySent))} · send again</button>${d.dailySavedTo || d.dailyFile ? `<div class="hp-saved">Today's report is saved in <b>${esc(d.dailySavedTo || `your Downloads folder (${d.dailyFile})`)}</b></div>` : ""}`
            : `<button class="hp-start daily" data-act="send-daily" title="Downloads Today's report from My Tasks, then in the report chat on Messenger sends the greeting (&quot;${HP.greetingWord(now)}&quot;, mentioning ${esc(HP.DAILY_MENTIONS.join(", "))}) and the picture">📨 Send daily report</button>`
          : ""
      return `<div class="hp-rep">
        <div class="hp-rep-head">My Tasks on <b>dtr.homes.ph</b> · ${esc(read)}${dtrLoading ? ' <span class="hp-spin"></span>' : ""}</div>
        ${d && d.error ? `<div class="hp-err">${esc(d.error)}</div>` : ""}
        ${start}
        ${HP.newsOff(state.settings) ? `<div class="hp-note">News Articles: someone else is posting them today. In an emergency: Posting tab → Start Posting News Article.</div>` : ""}
        <div class="hp-rows">${rows}</div>
        ${daily ? `<div class="hp-daily">${daily}</div>` : ""}
      </div>`
    }

    // ---------- Posting: the carousel ----------

    /** The day's carousel(s): each Facebook page (green = posted), in posts of 4 with a Post button each. */
    function carouselHtml(jobActive, job) {
      const entry = state.carousels[day]
      const data = entry && entry.data
      const logo = `<div class="hp-car-logo"><img alt="" src="${HP.url("logo-homes.png")}"></div>`
      const head = (sub) => `<div class="hp-car-head">${logo}<div class="hp-info"><div class="hp-name">Carousel <small>${esc(HP.timeLabel(HP.CAROUSEL_TIME))} · ${sub}</small></div>`
      if (!data) {
        const why = carouselLoading ? '<span class="hp-spin"></span> Reading Homes.ph SocMedSystem…' : esc((entry && entry.error) || "Open Homes.ph SocMedSystem to see this day's carousel.")
        return `<div class="hp-car">${head("from Homes.ph SocMedSystem")}<div class="hp-car-title">${why}</div></div></div></div>`
      }
      if (!data.carousels.length) return `<div class="hp-car">${head("none")}<div class="hp-car-title">No carousel scheduled in Homes.ph SocMedSystem for this day.</div></div></div></div>`
      if (!data.checklist || !data.pages.length) return `<div class="hp-car">${head("checklist off")}<div class="hp-car-title">Homes.ph SocMedSystem's 17-page posting checklist is off, so its pages aren't known.</div></div></div></div>`
      const groups = HP.carouselGroups(data.pages, HP.carouselPer(state.settings))
      return data.carousels
        .map((c) => {
          const posted = (key) => HP.carouselPosted(entry, c, key, state.carouselDone)
          const busyJob = jobActive && job.kind === "carousel" && job.projectId === c.id ? job : null
          const count = data.pages.filter((p) => posted(p.key)).length
          const rows = groups
            .map((g) => {
              const open = g.pages.filter((p) => !posted(p.key))
              const busy = busyJob && busyJob.postNo === g.n
              const btn = !open.length
                ? `<span class="hp-gbtn done" title="Post ${g.n}: posted on all its pages">✓ ${g.n}</span>`
                : busy
                  ? `<span class="hp-gbtn busy"><span class="hp-spin"></span>${g.n}</span>`
                  : `<button class="hp-gbtn" data-cgroup="${g.n}" data-cid="${esc(c.id)}" title="${esc(`Post ${g.n}: Facebook post at ${HP.timeLabel(HP.CAROUSEL_TIME)} to ${open.map((p) => p.short).join(", ")}`)}">Post ${g.n}</button>`
              const chips = g.pages
                .map((p) => {
                  const on = posted(p.key)
                  const check = c.checks.find((x) => x.key === p.key)
                  const tip = on ? `✓ Posted${check && check.by ? ` · ${check.by}` : ""}` : busy && busyJob.pages.some((x) => x.key === p.key) ? "Posting now" : "Not posted yet"
                  return `<span class="hp-page${on ? " posted" : busy && busyJob.pages.some((x) => x.key === p.key) ? " busy" : ""}" title="${esc(`${p.name}: ${tip}`)}" aria-label="${esc(`${p.short}: ${tip}`)}">${esc(p.short)}</span>`
                })
                .join("")
              return `<div class="hp-group">${btn}<div class="hp-chips">${chips}</div></div>`
            })
            .join("")
          const sub = count >= data.pages.length ? `✓ all ${data.pages.length} pages posted` : `${count}/${data.pages.length} pages posted`
          return `<div class="hp-car">${head(esc(sub))}<div class="hp-car-title" title="${esc(c.title)}">${esc(c.title)}</div></div></div><div class="hp-groups">${rows}</div></div>`
        })
        .join("")
    }

    // ---------- Trending, Ads: a pill per post ----------

    const brandLogo = (brandId) => {
      const b = state.settings.brands.find((x) => x.id === brandId)
      return HP.url(b ? b.logo : "logo-homes.png")
    }
    /** A post's pill: green posted, blue to post, yellow due (its time has come), working on it. */
    const itemState = (posted, busy, time, now) => (busy ? "busy" : posted ? "published" : HP.slotDate(day, time) <= now ? "due" : "ready")
    const itemPill = (what, id, st, time, extra, tip) =>
      `<button class="hp-pill hp-${st}" data-post="${what}" data-id="${esc(id)}" title="${esc(tip)}" aria-label="${esc(`${HP.timeLabel(time)}: ${st === "published" ? "posted" : st === "busy" ? "working on it" : st === "due" ? "due, not posted yet" : "to post"}`)}">${st === "busy" ? '<span class="hp-spin"></span>' : st === "published" ? "✓ " : st === "due" ? "! " : ""}${esc(HP.timeLabel(time))}${extra ? ` · ${esc(extra)}` : ""}</button>`
    const markBtn = (what, id, on, manual) =>
      `<button class="hp-mark" data-mark="${what}" data-id="${esc(id)}" aria-pressed="${on}" title="${on ? (manual ? "Marked posted by hand: click to undo" : "Posted through the extension: click to mark it not posted") : "Already posted another way? Mark it posted"}" aria-label="${on ? "Posted (click to undo)" : "Mark posted"}">✓</button>`
    const sourceLine = (entry, loading, what) =>
      `<div class="hp-src">${esc(what)} from <b>Homes.ph SocMedSystem</b> · ${loading ? "reading…" : entry && entry.at ? `read ${esc(ago(entry.at))}` : "not read yet"}${loading ? ' <span class="hp-spin"></span>' : ""}</div>${entry && entry.error ? `<div class="hp-err">${esc(entry.error)}</div>` : ""}`

    /** The Trending tab's three lists, as the Poster Maker's navigation (1.2.1): posters, Did You Know, engagement posts. */
    const TREND_KINDS = [
      { id: "news", label: "Poster", none: "No poster on this day." },
      { id: "dyk", label: "Did You Know", none: "No Did You Know post on this day." },
      { id: "engagement", label: "Engagement", none: "No engagement post on this day." },
    ]
    const trendItems = (entry, kind) => {
      const data = (entry && entry.data) || {}
      return kind === "news" ? data.posters || [] : (data.posts || []).filter((p) => p.kind === kind)
    }

    function trendingHtml(now, jobActive, job) {
      const entry = state.trends[day]
      const kind = state.trendKind || "news"
      const posters = trendItems(entry, kind)
      const kindInfo = TREND_KINDS.find((k) => k.id === kind)
      const subnav = `<div class="hp-subnav" role="tablist" aria-label="Poster Maker">${TREND_KINDS.map((k) => {
        const list = trendItems(entry, k.id)
        const open = list.filter((p) => !HP.trendPosted(p, state.posted, day)).length
        return `<button role="tab" data-tkind="${k.id}" aria-selected="${kind === k.id}">${esc(k.label)}${open ? ` <span class="hp-tcount">${open}</span>` : list.length ? " ✓" : ""}</button>`
      }).join("")}</div>`
      const mine = HP.quoteBrands(state.settings)
      const main = mine.map((id) => ({ id, name: HP.reportName(id), brandId: id }))
      // Posters of pages that aren't assigned aren't shown.
      const others = [...new Set(posters.map((p) => p.group).filter((g) => !mine.includes(g) && mine.includes(HP.trendBrandId(g, state.settings))))]
        .map((g) => ({ id: g, name: (posters.find((p) => p.group === g) || {}).groupName || g, brandId: null }))
        .sort((a, b) => a.name.localeCompare(b.name))
      const groups = [...main, ...others]
        .map((g) => {
          const mine = posters.filter((p) => p.group === g.id)
          const items = mine
            .map((p) => {
              const rec = HP.postedRec(state.posted, day, `trend:${p.id}`)
              const busy = jobActive && job.kind === "post" && job.what === "trend" && job.itemId === p.id && job.day === day
              const st = itemState(!!rec, busy, p.time, now)
              const changed = rec && rec.revision != null && p.revision != null && rec.revision !== p.revision
              const tip = `${p.groupName} ${HP.postTag(p)} · ${HP.timeLabel(p.time)}\n${p.headline}${p.caption ? `\n\nCaption: ${HP.firstLine(p.caption, 140)}` : "\n\nNo caption yet: write it in the Poster Maker"}${changed ? "\n\n⚠ It changed after it was posted." : ""}\n\n${st === "published" ? "Posted." : "Click: Facebook post (picture, caption, time) to this page."}`
              return `<div class="hp-item">${itemPill("trend", p.id, st, p.time, HP.postTag(p), tip)}<span class="hp-itext" title="${esc(p.headline)}">${changed ? '<span class="hp-warn" title="Changed after posting">⚠ </span>' : ""}${esc(p.headline)}</span>${markBtn("trend", p.id, !!rec, rec && rec.manual)}</div>`
            })
            .join("")
          const open = mine.filter((p) => !HP.trendPosted(p, state.posted, day)).length
          const sub = !mine.length ? (kind === "news" ? "no poster" : "no post") : open ? `${open} to post` : "all posted"
          return `<div class="hp-brand"><span class="hp-logo"><img alt="" src="${g.brandId ? brandLogo(g.brandId) : HP.url("logo-homes.png")}"></span><div class="hp-info"><div class="hp-name">${esc(g.name)} <small>${esc(sub)}</small></div>${items ? `<div class="hp-items">${items}</div>` : `<div class="hp-none">${esc(kindInfo.none)}</div>`}</div></div>`
        })
        .join("")
      return `${subnav}${sourceLine(entry, appLoading.trends, kind === "news" ? "Poster Maker's Daily Trend News" : `Poster Maker's ${kindInfo.label} posts`)}${groups}`
    }

    function adsHtml(now, jobActive, job) {
      const entry = state.ads[day]
      const ads = (entry && entry.data && entry.data.ads) || []
      const brands = [...new Set(ads.map((a) => HP.adBrandId(a.brand, state.settings)))].filter((id) => state.settings.brands.some((b) => b.id === id))
      const groups = brands
        .map((brandId) => {
          const b = state.settings.brands.find((x) => x.id === brandId)
          const mine = ads.filter((a) => HP.adBrandId(a.brand, state.settings) === brandId)
          if (!mine.length && brandId !== "pickleplay") return ""
          const items = mine
            .map((a) => {
              const rec = HP.postedRec(state.posted, day, `ad:${a.id}`)
              const on = !!rec || !!a.postedAt
              const busy = jobActive && job.kind === "post" && job.what === "ad" && job.itemId === a.id && job.day === day
              const st = itemState(on, busy, a.time, now)
              const changed = on && a.postedRevision != null && a.revision !== a.postedRevision
              const tip = `${a.kindLabel} · ${HP.timeLabel(a.time)}\n${a.title}${a.caption ? `\n\nCaption: ${HP.firstLine(a.caption, 140)}` : "\n\nNo caption: write it in Homes.ph SocMedSystem"}${changed ? "\n\n⚠ Changed in Homes.ph SocMedSystem after it was posted." : ""}\n\n${st === "published" ? "Posted." : "Click: Facebook post (the newest design and caption, at its time)."}`
              return `<div class="hp-item">${itemPill("ad", a.id, st, a.time, "", tip)}<span class="hp-itext" title="${esc(a.title)}">${changed ? '<span class="hp-warn" title="Changed after posting">⚠ </span>' : ""}<span class="hp-kind">${esc(a.kindLabel)}</span>${esc(a.title)}</span>${markBtn("ad", a.id, on, rec && rec.manual)}</div>`
            })
            .join("")
          const open = mine.filter((a) => !HP.adPosted(a, state.posted, day)).length
          const sub = !mine.length ? "none scheduled" : open ? `${open} to post` : "all posted"
          return `<div class="hp-brand"><span class="hp-logo"><img alt="" src="${brandLogo(brandId)}"></span><div class="hp-info"><div class="hp-name">${esc(b ? b.name : brandId)} <small>${esc(sub)}</small></div>${items ? `<div class="hp-items">${items}</div>` : `<div class="hp-none">No advertisement scheduled for this day. Schedule one in Homes.ph SocMedSystem → Advertisement.</div>`}</div></div>`
        })
        .join("")
      return `${sourceLine(entry, appLoading.ads, "Advertisements")}${groups}`
    }

    // ---------- Quotes ----------

    function quotesHtml(now, jobActive, job) {
      const set = state.quotes[day] || {}
      return HP.quoteBrands(state.settings).map((brandId) => {
        const b = state.settings.brands.find((x) => x.id === brandId)
        const name = b ? b.name : brandId
        const q = set[brandId] && set[brandId].imageId ? set[brandId] : null
        const rec = HP.postedRec(state.posted, day, `quote:${brandId}`)
        const busy = jobActive && job.kind === "post" && job.what === "quote" && job.itemId === brandId && job.day === day
        let body
        if (draft && draft.brandId === brandId) {
          const img = draft.thumb || (draft.image && draft.image.dataUrl) || (q && q.thumb) || ""
          body = `<div class="hp-qform" data-qform>
            <label class="hp-qpick">${img ? `<img alt="" src="${esc(img)}">` : ""}<span>${draft.image ? `<b>${esc(draft.image.name)}</b><br>Click to change the picture` : q ? "Click to change the picture (or paste one: Ctrl+V)" : "<b>Choose the quote's picture</b><br>or paste it here (Ctrl+V)"}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-qfile aria-label="The quote's picture"></label>
            <textarea data-qcap data-focus="qcap" placeholder="The Facebook caption" aria-label="Caption">${esc(draft.caption)}</textarea>
            <div class="hp-qrow"><label>Posting time <input type="time" data-qtime data-focus="qtime" value="${esc(draft.time)}"></label><span>${draft.time === HP.QUOTE_TIME ? "(4:00 PM, the default)" : ""}</span></div>
            ${draft.error ? `<div class="hp-err">${esc(draft.error)}</div>` : ""}
            <div class="hp-qrow"><button class="hp-btn" data-qsave ${draft.saving ? "disabled" : ""}>${draft.saving ? '<span class="hp-spin"></span> Saving…' : "Done setup"}</button><button class="hp-btn ghost" data-qcancel>Cancel</button></div>
          </div>`
        } else if (q) {
          const st = itemState(!!rec, busy, q.time, now)
          const tip = `${name} · ${HP.timeLabel(q.time)}${q.caption ? `\n${HP.firstLine(q.caption, 140)}` : ""}\n\n${st === "published" ? "Posted." : "Post: Facebook post (picture, caption, time) to this page."}`
          const post =
            st === "published"
              ? `<span class="hp-pill hp-published" title="${esc(tip)}">✓ Posted · ${esc(HP.timeLabel(q.time))}</span>`
              : st === "busy"
                ? `<span class="hp-pill hp-busy"><span class="hp-spin"></span> Posting…</span>`
                : `<button class="hp-btn${st === "due" ? " green" : ""}" data-post="quote" data-id="${brandId}" title="${esc(tip)}">Post · ${esc(HP.timeLabel(q.time))}</button>`
          body = `<div class="hp-quote">${q.thumb ? `<img alt="" src="${esc(q.thumb)}">` : '<span class="hp-noimg"></span>'}<div><div class="hp-qtext">${q.caption ? esc(HP.firstLine(q.caption, 200)) : '<i style="color:#94a3b8">No caption</i>'}</div>
            <div class="hp-qbtns">${post}${st === "published" ? "" : `<button class="hp-btn soft" data-qedit="${brandId}" title="Change the picture, caption or time">Edit</button>`}${markBtn("quote", brandId, !!rec, rec && rec.manual)}<button class="hp-btn ghost" data-qdel="${brandId}" title="Remove this quote" aria-label="Remove this quote">✕</button></div></div></div>`
        } else body = `<div class="hp-qbtns"><button class="hp-btn soft" data-qnew="${brandId}">＋ Schedule a quote</button></div>`
        const sub = q ? (rec ? "posted" : `set for ${HP.timeLabel(q.time)}`) : "no quote yet"
        return `<div class="hp-brand"><span class="hp-logo"><img alt="" src="${brandLogo(brandId)}"></span><div class="hp-info"><div class="hp-name">${esc(name)} <small>${esc(sub)}</small></div>${body}</div></div>`
      }).join("")
    }

    const openDraft = (brandId) => {
      const q = (state.quotes[day] || {})[brandId]
      draft = { brandId, caption: q ? q.caption || "" : "", time: q ? q.time : HP.QUOTE_TIME, image: null, thumb: "", error: "", saving: false }
      render()
      const box = root.querySelector("[data-qcap]")
      if (box) box.focus()
    }
    const takePicture = async (file) => {
      if (!draft || !file) return
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
        draft.error = "Pick a PNG, JPG, WebP or GIF picture."
        return render()
      }
      if (file.size > MAX_QUOTE_BYTES) {
        draft.error = "That picture is over 15 MB: pick a smaller one."
        return render()
      }
      try {
        const dataUrl = await readFile(file)
        const thumb = await thumbOf(dataUrl)
        if (!draft) return
        draft.image = { name: file.name || "quote.png", dataUrl }
        draft.thumb = thumb
        draft.error = ""
      } catch (e) {
        if (draft) draft.error = e.message
      }
      render()
    }
    const saveDraft = async () => {
      if (!draft || draft.saving) return
      const q = (state.quotes[day] || {})[draft.brandId]
      if (!draft.image && !(q && q.imageId)) {
        draft.error = "Choose the quote's picture first."
        return render()
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time || "")) {
        draft.error = "Pick the posting time."
        return render()
      }
      draft.saving = true
      draft.error = ""
      render()
      const res = await HP.send({ type: "quote-save", day, brandId: draft.brandId, caption: draft.caption, time: draft.time, image: draft.image, thumb: draft.thumb })
      if (res.error) {
        if (draft) {
          draft.saving = false
          draft.error = res.error
        }
        return render()
      }
      draft = null
      await load()
    }

    const boardUrl = (brand, postId) => {
      const u = new URL(HP.boardUrl(state.settings, brand.group, state.boardUrls))
      u.searchParams.set("date", day)
      if (postId) u.searchParams.set("post", postId)
      return u.toString()
    }

    // ---------- drawing ----------

    function render() {
      if (destroyed || !HP.alive()) return
      // What's being typed keeps its place when the panel is drawn again.
      const rootNode = root.getRootNode ? root.getRootNode() : document
      const active = rootNode.activeElement && root.contains(rootNode.activeElement) ? rootNode.activeElement : null
      const focus = active && active.dataset && active.dataset.focus ? { key: active.dataset.focus, start: active.selectionStart, end: active.selectionEnd } : null

      const now = new Date()
      const today = HP.ymd(now)
      const shownDate = HP.slotDate(day, "12:00")
      const tomorrow = HP.ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
      const dayName = day === today ? "Today" : day === tomorrow ? "Tomorrow" : shownDate.toLocaleDateString(undefined, { weekday: "long" })
      const dayLabel = `${dayName}, ${shownDate.toLocaleDateString(undefined, { ...(day === today || day === tomorrow ? { weekday: "short" } : {}), month: "short", day: "numeric" })}`
      const addDays = (n) => HP.ymd(new Date(shownDate.getFullYear(), shownDate.getMonth(), shownDate.getDate() + n))
      const job = state.job
      const jobActive = job && !["done", "failed", "stopped"].includes(job.step)
      const showJob = job && (jobActive || Date.now() - (job.updatedAt || 0) < 30 * 60_000)
      const groupsAt = {}
      for (const g of Object.keys(HP.GROUPS)) groupsAt[g] = state.boards[`${g}|${day}`]
      const anyBoard = Object.values(groupsAt).some(Boolean)
      const lastRead = Math.max(0, ...Object.values(groupsAt).map((b) => (b ? b.at : 0)))
      const tab = state.tab

      /** One page's row: its logo (opens its board) and its time pills. */
      const brandRow = (brand) => {
            const board = groupsAt[brand.group]
            const hub = HP.hubOf(board, brand)
            const times = board && board.times.length ? board.times : HP.GROUPS[brand.group].times
            const pills = times
              .map((time) => {
                const cards = (hub && hub.slots[time]) || []
                const rec = HP.recOf(state.done, brand.id, day, time)
                const busy = jobActive && job.brandId === brand.id && job.time === time && job.day === day
                const known = !!hub
                const st = busy ? "busy" : known ? HP.slotState(cards, day, time, now, rec) : "empty"
                // Facebook: the dash's mark, or this extension's record (not a deleted one).
                const fbOf = (c) => (rec(c) && rec(c).deleted ? null : c.fb || (rec(c) && rec(c).facebook) || null)
                const fb = cards.find((c) => fbOf(c) === "posted") ? "posted" : cards.find((c) => fbOf(c) === "scheduled") ? "scheduled" : null
                const gone = cards.some((c) => rec(c) && rec(c).deleted)
                const open = cards.filter((c) => !HP.cardDone(c, rec(c))).length
                const say = (c) =>
                  rec(c) && rec(c).deleted
                    ? "✕ Facebook post deleted (not in Scheduled Posts)"
                    : fbOf(c)
                      ? `✓ Facebook ${fbOf(c)}`
                      : c.posted
                        ? "✓ Checked on the board (posted)"
                        : c.due
                          ? "! Due"
                          : "• To publish"
                const tip = !known
                  ? "Not read yet: click Refresh"
                  : cards.length
                    ? cards.map((c) => `${say(c)}: ${c.title}${c.assignee ? ` (${c.assignee})` : ""}`).join("\n") +
                      (st === "ready" || st === "due" ? "\n\nClick: publish it (unless it's published already), then its Facebook post." : "")
                    : "No article in this slot yet"
                const label = HP.timeLabel(time)
                const mark = st === "published" ? "✓ " : st === "due" ? "! " : ""
                const name = st === "busy" ? "working on it" : st === "ready" ? "to publish" : st === "published" ? "done" : st
                return `<button class="hp-pill hp-${st}${gone ? " hp-gone" : ""}" data-brand="${brand.id}" data-time="${time}" title="${esc(tip)}" aria-label="${esc(`${brand.name} ${label}: ${name}`)}">${busy ? '<span class="hp-spin"></span>' : ""}${mark}${label}${open > 1 ? `<span class="hp-count">${open}</span>` : ""}${fb && st === "published" ? `<span class="hp-fb ${fb}" title="Facebook ${fb}">f</span>` : ""}</button>`
              })
              .join("")
            const toDo = hub ? times.filter((t) => ["ready", "due"].includes(HP.slotState(hub.slots[t] || [], day, t, now, HP.recOf(state.done, brand.id, day, t)))).length : 0
            return `<div class="hp-brand">
            <button class="hp-logo" data-board="${brand.id}" title="Open the ${esc(brand.name)} board (${esc(HP.GROUPS[brand.group].label)})"><img alt="" src="${HP.url(brand.logo)}"></button>
            <div class="hp-info"><div class="hp-name">${esc(brand.name)} <small>${hub ? (toDo ? `${toDo} to post` : "all done") : esc(brand.hub)}</small></div><div class="hp-pills">${pills}</div></div>
          </div>`
      }
      /** A page's articles still to post on the day shown (for the Homes.ph dropdown). */
      const toDoOf = (brand) => {
        const hub = HP.hubOf(groupsAt[brand.group], brand)
        if (!hub) return null
        const board = groupsAt[brand.group]
        const times = board && board.times.length ? board.times : HP.GROUPS[brand.group].times
        return times.filter((t) => ["ready", "due"].includes(HP.slotState(hub.slots[t] || [], day, t, now, HP.recOf(state.done, brand.id, day, t)))).length
      }
      /**
       * The assigned pages: each site, then the Homes.ph pages. Several Homes.ph pages: a dropdown picks the one shown
       * (one page: its own row, no dropdown).
       */
      const brandsHtml = () => {
        const sites = state.settings.brands.filter((b) => b.kind !== "homes")
        const homes = state.settings.brands.filter((b) => b.kind === "homes")
        if (!sites.length && !homes.length)
          return '<div class="hp-note">No pages are assigned to you in Homes.ph SocMedSystem (Settings → Assigned pages).</div>'
        let homesHtml = ""
        if (homes.length === 1) homesHtml = brandRow(homes[0])
        else if (homes.length > 1) {
          const busyHomes = jobActive && homes.find((b) => b.id === job.brandId)
          const pick = homes.find((b) => b.id === state.homesPick) || busyHomes || homes.find((b) => toDoOf(b)) || homes[0]
          const left = homes.reduce((n, b) => n + (toDoOf(b) || 0), 0)
          const options = homes
            .map((b) => {
              const n = toDoOf(b)
              return `<option value="${esc(b.id)}"${b.id === pick.id ? " selected" : ""}>${esc(b.name)}${n ? ` · ${n} to post` : n === 0 ? " · done" : ""}</option>`
            })
            .join("")
          homesHtml = `<div class="hp-homes"><img alt="" src="${HP.url("logo-homes.png")}"><b>Homes.ph</b><select data-homes aria-label="Homes.ph page">${options}</select><small>${left ? `${left} to post` : ""}</small></div>${brandRow(pick)}`
        }
        return sites.map(brandRow).join("") + homesHtml
      }

      const postingHtml = () => {
        // Scheduled posts deleted on homes.ph (this day), and past days still not on Facebook.
        const dayInfo = HP.dayCount(state.settings, state.boards, state.done, day, now)
        const alertsHtml = dayInfo.deleted.length
          ? `<div class="hp-alert" role="alert"><b>Facebook post${dayInfo.deleted.length === 1 ? "" : "s"} deleted</b> from Scheduled Posts: ${dayInfo.deleted.map((d) => `${esc(d.brand.name)} ${esc(HP.timeLabel(d.time))} (${esc(d.title)})`).join("; ")}. Click the time to post it again.</div>`
          : ""
        const past = HP.missedDays(state.settings, state.boards, state.done, now)
        const pastHtml = past.length
          ? `<div class="hp-past"><span>Not posted yet on past days:</span>${past.map((p) => `<button data-day="${p.day}" title="Show ${p.day}">${esc(HP.slotDate(p.day, "12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }))} · ${p.open}</button>`).join("")}</div>`
          : ""
        // Someone else posts the News Articles today: in an emergency, take them over (their tasks go in My Tasks).
        const offHtml = HP.newsOff(state.settings)
          ? `<div class="hp-off"><b>You're not posting the News Articles today</b> (your Start Your Day answer). If no one is posting them, take them over: their tasks are added in My Tasks on dtr.homes.ph, In progress.<button class="hp-start" data-act="start-news">▶ Start Posting News Article</button></div>`
          : ""
        return `${offHtml}${!anyBoard && !refreshing ? `<div class="hp-note">${day === today ? "Today's boards aren't" : "This day's boards aren't"} read yet. Sign in to dash.homes.ph, then click ⟳ (or open the posts board once).</div>` : ""}
          ${alertsHtml}
          ${brandsHtml()}
          ${state.settings.carousel ? carouselHtml(jobActive, job) : ""}
          ${pastHtml}`
      }

      const jobHtml = showJob
        ? `<div class="hp-job ${job.step}"><span title="${esc(job.step === "failed" ? job.error || "" : "")}"><b>${esc(HP.jobName(job))}${job.kind === "carousel" ? ` · post ${esc(job.postNo)}` : ""}${job.day !== today ? ` · ${esc(job.day)}` : ""}</b> · ${esc(job.step === "failed" ? job.error || "Stopped" : STEP_TEXT[job.step] || job.step)}${job.step === "done" && job.facebook ? ` · Facebook ${esc(job.facebook)}` : ""}${job.kind === "daily" && (job.savedTo || job.fileName) ? ` · Today's report: ${esc(job.savedTo || `Downloads\\${job.fileName}`)}` : ""}${job.kind === "carousel" && job.step === "done" && Array.isArray(job.ticked) ? ` · ${job.ticked.length} page${job.ticked.length === 1 ? "" : "s"}${job.checkedInApp ? ", ticked in the app" : ""}` : ""}</span>${
            jobActive ? '<button class="hp-btn ghost" data-act="stop">Stop</button><button class="hp-btn" data-act="show">Show</button>' : '<button class="hp-btn ghost" data-act="clear">OK</button>'
          }</div>`
        : ""

      // The tabs' numbers: what's still to post on the day shown (Reports: a dot until the day is started).
      const dToday = state.dtr[today]
      const notStarted = !dToday || !HP.addTasks(state.settings).some((t) => dToday.tasks && dToday.tasks[t.id])
      const newsOff = HP.newsOff(state.settings)
      // Not posting the News Articles today: Trending first, Posting grayed (still there for emergencies) before Reports.
      const shownTabs = (newsOff ? [...TABS.filter((t) => t.id !== "posting" && t.id !== "reports"), TABS.find((t) => t.id === "posting"), TABS.find((t) => t.id === "reports")] : TABS).filter(
        (t) => t.id !== "ads" || HP.adPagesOf(state.settings).length,
      )
      const trendData = (state.trends[day] && state.trends[day].data) || {}
      const trendList = [...(trendData.posters || []), ...(trendData.posts || [])]
      const adList = (state.ads[day] && state.ads[day].data && state.ads[day].data.ads) || []
      const quoteList = HP.quoteBrands(state.settings).map((b) => (state.quotes[day] || {})[b]).filter((q) => q && q.imageId)
      const openOf = (list, isPosted) => {
        const open = list.filter((x) => !isPosted(x))
        return { open: open.length, late: open.some((x) => HP.slotDate(day, x.time) <= now) }
      }
      const counts = {
        trending: openOf(trendList, (p) => HP.trendPosted(p, state.posted, day)),
        ads: openOf(adList, (a) => HP.adPosted(a, state.posted, day)),
        quotes: openOf(quoteList, (q) => HP.quotePosted(q, state.posted, day)),
      }
      const tabsHtml = shownTabs.map((t) => {
        const c = counts[t.id]
        const badge = t.id === "reports" ? (notStarted ? '<i class="hp-tdot"></i>' : "") : c && c.open ? `<span class="hp-tcount${c.late ? " late" : ""}">${c.open}</span>` : ""
        const tip = t.id === "reports" ? (notStarted ? "Start Your Day: today's tasks aren't in My Tasks yet" : "Today's tasks in My Tasks") : t.title
        const off = newsOff && t.id === "posting"
        return `<button class="hp-tab${off ? " off" : ""}" role="tab" data-tab="${t.id}" aria-selected="${tab === t.id}" title="${esc(off ? "You're not posting the News Articles today (Start Your Day). Open it in an emergency." : tip)}">${t.label}${badge}</button>`
      }).join("")

      const reports = tab === "reports"
      const tabInfo = TABS.find((t) => t.id === tab)
      const subtitle = reports
        ? `Today, ${now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
        : tab === "posting"
          ? `${dayLabel} · read ${ago(lastRead)}`
          : dayLabel
      const loading = reports ? dtrLoading : tab === "posting" ? refreshing : tab === "trending" ? appLoading.trends : tab === "ads" ? appLoading.ads : false
      const refreshTip = { posting: "Read the day's boards again", trending: "Read the Daily Trend News again from Homes.ph SocMedSystem", ads: "Read the advertisements again from Homes.ph SocMedSystem", reports: "Read My Tasks again" }[tab]
      const bodyHtml = reports ? reportsHtml(now, jobActive, job) : tab === "trending" ? trendingHtml(now, jobActive, job) : tab === "ads" ? adsHtml(now, jobActive, job) : tab === "quotes" ? quotesHtml(now, jobActive, job) : postingHtml()
      const footHtml = reports
        ? `<span class="hp-key"><i class="hp-dot" style="background:#CBD5E1"></i>Not added</span>
          <span class="hp-key"><i class="hp-dot" style="background:#FDBA74"></i>In progress</span>
          <span class="hp-key"><i class="hp-dot" style="background:#86EFAC"></i>Done</span>
          <a href="#" data-act="open-dtr" style="color:#1428AE">My Tasks ↗</a>`
        : tab === "posting"
          ? `<span class="hp-key"><i class="hp-dot" style="background:#16A34A"></i>Done: checked, or on Facebook <i class="hp-fb posted">f</i>/<i class="hp-fb scheduled">f</i></span>
          <span class="hp-key"><i class="hp-dot" style="border:1.5px solid #1428AE"></i>To publish</span>
          <span class="hp-key"><i class="hp-dot" style="background:#FBBF24"></i>Due</span>
          <span class="hp-key"><i class="hp-dot" style="border:1.5px dashed #94a3b8"></i>No article</span>`
          : tab === "quotes"
            ? `<span>Post fills in Facebook Autopost (Page, caption, picture, time); you click Schedule Post.</span>`
            : `<span class="hp-key"><i class="hp-dot" style="background:#16A34A"></i>Posted</span>
          <span class="hp-key"><i class="hp-dot" style="border:1.5px solid #1428AE"></i>To post</span>
          <span class="hp-key"><i class="hp-dot" style="background:#FBBF24"></i>Due</span>
          <span class="hp-key">✓ = posted another way</span>`

      root.innerHTML = `<div class="hp-panel" role="dialog" aria-label="Homes.ph Publisher">
        <div class="hp-head">
          <img alt="" src="${HP.url("icon-48.png")}">
          <div class="hp-title"><b>${esc(tabInfo.title)}</b><span>${esc(subtitle)}</span></div>
          ${refreshTip ? `<button class="hp-icon" data-act="refresh" title="${esc(refreshTip)}" aria-label="Refresh">${loading ? '<span class="hp-spin"></span>' : "⟳"}</button>` : ""}
          <button class="hp-icon" data-act="options" title="Options" aria-label="Options">⚙</button>
          ${options.onClose ? '<button class="hp-icon" data-act="close" title="Hide" aria-label="Hide">✕</button>' : ""}
        </div>
        <div class="hp-tabs" role="tablist">${tabsHtml}</div>
        ${reports ? "" : `<div class="hp-days">
          <button class="hp-day" data-day="${addDays(-1)}" title="The day before" aria-label="The day before">‹</button>
          <b>${esc(dayLabel)}</b>
          ${day !== today ? `<button class="hp-day" data-day="${today}" title="Back to today">Today</button>` : ""}
          <button class="hp-day" data-day="${addDays(1)}" title="The next day (post in advance)" aria-label="The next day">›</button>
        </div>`}
        ${jobHtml}
        <div class="hp-body">
          ${message ? `<div class="hp-err">${esc(message)}</div>` : ""}
          ${bodyHtml}
        </div>
        <div class="hp-foot">
          ${footHtml}
          <span style="flex:1"></span>
          <span>App: ${app == null ? "…" : app.paired ? "connected" : app.open ? '<a href="#" data-act="options" style="color:#1428AE">connect</a>' : "not open"}</span>
        </div>
      </div>`

      if (focus) {
        const el = root.querySelector(`[data-focus="${focus.key}"]`)
        if (el) {
          el.focus()
          try {
            if (focus.start != null) el.setSelectionRange(focus.start, focus.end)
          } catch {
            // a time box has no selection
          }
        }
      }

      const busyMessage = () => {
        message = `Still working on ${HP.jobName(job)}. Stop it first.`
        render()
      }
      root.querySelectorAll("[data-time]").forEach((b) =>
        b.addEventListener("click", () => {
          const brand = state.settings.brands.find((x) => x.id === b.dataset.brand)
          const time = b.dataset.time
          const board = groupsAt[brand.group]
          const hub = HP.hubOf(board, brand)
          const cards = (hub && hub.slots[time]) || []
          const rec = HP.recOf(state.done, brand.id, day, time)
          // The first article not on Facebook yet (published or not).
          const todo = cards.find((c) => !HP.cardDone(c, rec(c)))
          if (jobActive && job.brandId === brand.id && job.time === time) return
          if (todo) return void startJob(brand, time, todo)
          const any = cards[0]
          void HP.send({ type: "open", url: boardUrl(brand, any && any.postId) })
        }),
      )
      root.querySelectorAll("[data-cgroup]").forEach((b) =>
        b.addEventListener("click", () => {
          if (jobActive) return busyMessage()
          void startCarousel(b.dataset.cid, Number(b.dataset.cgroup))
        }),
      )
      root.querySelectorAll("[data-post]").forEach((b) =>
        b.addEventListener("click", () => {
          const what = b.dataset.post
          const id = b.dataset.id
          if (jobActive && job.kind === "post" && job.what === what && job.itemId === id) return void HP.send({ type: "focus-job" })
          if (b.classList.contains("hp-published")) {
            message = "Already posted. To post it again, untick its ✓ first."
            return render()
          }
          if (jobActive) return busyMessage()
          void startPost(what, id)
        }),
      )
      root.querySelectorAll("[data-mark]").forEach((b) =>
        b.addEventListener("click", async () => {
          const on = b.getAttribute("aria-pressed") !== "true"
          const what = b.dataset.mark
          // An ad marked posted in Homes.ph SocMedSystem stays posted there: only this extension's mark changes.
          await HP.send({ type: "post-mark", what, id: b.dataset.id, day, on })
          if (!on && what === "ad") {
            const ad = adList.find((a) => a.id === b.dataset.id)
            if (ad && ad.postedAt) {
              message = "Homes.ph SocMedSystem still has this ad as posted (its calendar). Change it there if it wasn't."
              render()
            }
          }
        }),
      )
      root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => void setTab(b.dataset.tab)))
      root.querySelectorAll("[data-report]").forEach((b) =>
        b.addEventListener("click", () => {
          if (jobActive) return busyMessage()
          if (!sending) void sendReport(b.dataset.report, b.dataset.partial === "1")
        }),
      )
      // A task's pill opens it in My Tasks (or My Tasks).
      root.querySelectorAll("[data-rtask]").forEach((b) =>
        b.addEventListener("click", () => {
          const t = (state.dtr[today] && state.dtr[today].tasks && state.dtr[today].tasks[b.dataset.rtask]) || null
          void HP.send({ type: "open", url: t && t.url ? t.url : HP.DTR_TASKS_URL })
        }),
      )
      // Quotes.
      root.querySelectorAll("[data-qnew], [data-qedit]").forEach((b) => b.addEventListener("click", () => openDraft(b.dataset.qnew || b.dataset.qedit)))
      root.querySelectorAll("[data-qdel]").forEach((b) =>
        b.addEventListener("click", async () => {
          const brand = state.settings.brands.find((x) => x.id === b.dataset.qdel)
          if (!confirm(`Remove ${brand ? brand.name : "this page"}'s quote for ${dayLabel}?`)) return
          await HP.send({ type: "quote-delete", day, brandId: b.dataset.qdel })
        }),
      )
      const form = root.querySelector("[data-qform]")
      if (form && draft) {
        const cap = form.querySelector("[data-qcap]")
        const time = form.querySelector("[data-qtime]")
        cap.addEventListener("input", () => draft && (draft.caption = cap.value))
        time.addEventListener("input", () => draft && (draft.time = time.value))
        time.addEventListener("change", () => {
          if (draft) draft.time = time.value
          render()
        })
        form.querySelector("[data-qfile]").addEventListener("change", (e) => void takePicture(e.target.files && e.target.files[0]))
        form.addEventListener("paste", (e) => {
          const file = [...((e.clipboardData && e.clipboardData.files) || [])].find((f) => f.type.startsWith("image/"))
          if (!file) return
          e.preventDefault()
          void takePicture(file)
        })
        form.addEventListener("dragover", (e) => e.preventDefault())
        form.addEventListener("drop", (e) => {
          const file = [...((e.dataTransfer && e.dataTransfer.files) || [])].find((f) => f.type.startsWith("image/"))
          if (!file) return
          e.preventDefault()
          void takePicture(file)
        })
        form.querySelector("[data-qsave]").addEventListener("click", () => void saveDraft())
        form.querySelector("[data-qcancel]").addEventListener("click", () => {
          draft = null
          render()
        })
      }
      root.querySelectorAll("[data-day]").forEach((b) => b.addEventListener("click", () => setDay(b.dataset.day)))
      // The Homes.ph page shown (several assigned): remembered.
      root.querySelectorAll("select[data-homes]").forEach((sel) => sel.addEventListener("change", () => void HP.store.set({ homesPick: sel.value })))
      root.querySelectorAll("[data-board]").forEach((b) =>
        b.addEventListener("click", () => {
          const brand = state.settings.brands.find((x) => x.id === b.dataset.board)
          void HP.send({ type: "open", url: boardUrl(brand) })
        }),
      )
      root.querySelectorAll("[data-tkind]").forEach((b) =>
        b.addEventListener("click", () => {
          state.trendKind = b.dataset.tkind
          render()
          void HP.store.set({ trendKind: b.dataset.tkind })
        }),
      )
      root.querySelectorAll("[data-act]").forEach((b) =>
        b.addEventListener("click", (e) => {
          e.preventDefault()
          const act = b.dataset.act
          if (act === "refresh") {
            if (tab === "reports") void loadDtr(true)
            else if (tab === "trending") void loadApp("trends")
            else if (tab === "ads") void loadApp("ads")
            else void refresh()
          } else if (act === "start-day") {
            if (jobActive) return busyMessage()
            // First, who posts the News Articles today (asked once a day).
            if (!HP.dutyAsked(state.settings)) {
              askingDuty = true
              return render()
            }
            void startDay()
          } else if (act === "duty-yes" || act === "duty-no") {
            if (jobActive) return busyMessage()
            askingDuty = false
            // No: Trending is the first tab now (Posting is grayed).
            if (act === "duty-no") void HP.store.set({ panelTab: "reports" })
            void HP.send({ type: "set-duty", news: act === "duty-yes" }).then(() => startDay())
          } else if (act === "start-news") {
            if (jobActive) return busyMessage()
            // Emergency: the News Articles are yours today after all; their tasks go in My Tasks.
            void HP.send({ type: "set-duty", news: true }).then(() => startDay())
          } else if (act === "send-daily") {
            if (jobActive) return busyMessage()
            void begin({ type: "start-daily" }, (j) => j.kind === "daily")
          } else if (act === "open-dtr") void HP.send({ type: "open", url: HP.DTR_TASKS_URL })
          else if (act === "options") void HP.send({ type: "options" })
          else if (act === "close" && options.onClose) options.onClose()
          else if (act === "stop") void HP.send({ type: "stop-job" })
          else if (act === "clear") void HP.send({ type: "clear-job" })
          else if (act === "show" && state.job) void HP.send({ type: "focus-job" })
        }),
      )
    }

    const offStorage = HP.onStorage((changes, area) => {
      if (area === "local" && ["settings", "assignment", "duty", "homesPick", "boards", "done", "job", "refreshedAt", "carousels", "carouselDone", "dtr", "ads", "trends", "quotes", "posted", "trendKind"].some((k) => k in changes)) return load()
    })
    const clock = HP.every(60_000, () => {
      // Not while a quote is being typed (it's drawn when something changes).
      if (!draft) render()
    })
    const destroy = () => {
      destroyed = true
      clearInterval(clock)
      offStorage()
      root.innerHTML = ""
    }
    HP.onDead(destroy)
    void load().then(async () => {
      // The pages assigned in the app may have changed since (its Settings → Assigned pages).
      void HP.send({ type: "assignment-refresh" })
      app = await HP.send({ type: "app-status" })
      render()
      if (state.tab === "posting") void loadCarousel()
      else tabData(state.tab)
      // Old boards (or none) are read again when the panel opens.
      if (options.autoRefresh !== false && stale()) void refresh()
    })
    return { destroy }
  }
})()
