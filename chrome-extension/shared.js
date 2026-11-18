/*
 * Homes.ph Publisher: what the floating panel, the page helpers and the background share.
 * Plain script (no build step): it defines globalThis.HP. Loaded by every part of the extension.
 */
;(function () {
  const HP = (globalThis.HP = globalThis.HP || {})

  HP.VERSION = "1.2.0"
  /** The app's name (1.50 on). */
  HP.APP_NAME = "Homes.ph SocMedSystem"
  HP.DASH_ORIGIN = "https://dash.homes.ph"
  HP.AUTOPOST_URL = "https://homes.ph/dashboard/admin/facebook-autopost"

  /** The dash posts board: Sites (PicklePlay, fhiglobal…) and Cities (Caraga, General Santos…), with their columns. */
  HP.GROUPS = {
    site: { label: "Sites", url: "https://dash.homes.ph/super_editor/posts?group=site", times: ["09:00", "11:00", "15:00", "19:00", "22:00"] },
    // The dash's Cities board is its posts page without ?group= (the team's address).
    city: { label: "Cities", url: "https://dash.homes.ph/super_editor/posts", times: ["11:00", "13:30", "18:00", "20:00", "22:00", "23:00"] },
  }

  /** The Cities board's article times (the Homes.ph pages). */
  HP.CITY_TIMES = ["11:00", "13:30", "18:00", "20:00", "22:00"]

  const svgLogo = (bg, text) =>
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${bg}"/><text x="16" y="20.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="800" fill="#fff">${text}</text></svg>`)}`

  /** A Homes.ph page: its row on the Cities board, Homes + Main News Portal, its Facebook Page, its News Article row in the app. */
  const homesPage = (id, short, hub, fbPage, extra) =>
    Object.assign(
      {
        id,
        kind: "homes",
        name: `Homes.ph ${short}`,
        short,
        logo: "logo-homes.png",
        group: "city",
        hub,
        // The dash's "Publish to" for a Homes.ph page: Homes and Main News Portal.
        publishTo: ["Homes", "Main News Portal"],
        // READ MORE = the article's short link (homes.ph/s/…), from "Copy link" on its homes.ph page (old way).
        shortLink: true,
        fbPage,
        newsUrl: "https://homes.ph/news/",
        // Its News Article row in Homes.ph SocMedSystem (CARAGA and Gensan have their own; the others are Homes.ph pages).
        appBrand: id === "caraga" || id === "gensan" ? id : `homes:${id}`,
        times: HP.CITY_TIMES,
      },
      extra || {},
    )

  /**
   * Every page that can be assigned in Homes.ph SocMedSystem (Settings → Assigned pages): its row ("Target Hub") on
   * the dash board, the sites its article is published to (after "Clear all"), its Facebook Page, the article's
   * public address and its row in the app. Only the assigned ones show (the app tells which); editable in Options.
   */
  HP.DEFAULT_BRANDS = [
    {
      id: "fhi",
      kind: "site",
      name: "FHI Global",
      short: "FHI",
      logo: "logo-fhi.png",
      group: "site",
      hub: "fhiglobal",
      // Its own site first (READ MORE comes from its pill); Main News Portal is ticked too after Clear all (HP.publishSites).
      publishTo: ["fhiglobal", "Rentsouq"],
      fbPage: "FHI Global Dubai",
      newsUrl: "https://fhiglobal.ae/news/",
      appBrand: "fhi",
    },
    {
      id: "pickleplay",
      kind: "site",
      name: "PicklePlay",
      short: "PicklePlay",
      logo: "logo-pickleplay.png",
      group: "site",
      hub: "PicklePlay",
      publishTo: ["PicklePlay"],
      fbPage: "PicklePlay",
      newsUrl: "https://www.pickleplay.ph/news/",
      appBrand: "pickleplay",
    },
    { id: "bayanihan", kind: "site", name: "Bayanihan", short: "Bayanihan", logo: svgLogo("#0F766E", "BC"), group: "site", hub: "Bayanihan", publishTo: ["Bayanihan"], fbPage: "Bayanihan.com", newsUrl: "https://bayanihan.com/news/", appBrand: null },
    { id: "filipinohomes", kind: "site", name: "Filipino Homes", short: "Filipino Homes", logo: svgLogo("#0F766E", "FH"), group: "site", hub: "FilipinoHomes", publishTo: ["FilipinoHomes"], fbPage: "Filipino Homes", newsUrl: "https://filipinohomes.com/news/", appBrand: null },
    { id: "bayanihan-dubai", kind: "site", name: "Bayanihan Dubai", short: "Bayanihan Dubai", logo: svgLogo("#0E7490", "BD"), group: "site", hub: "Bayanihan Dubai", publishTo: ["Bayanihan"], fbPage: "Bayanihan Dubai", newsUrl: "https://bayanihan.com/news/", appBrand: null },
    { id: "rentsouq", kind: "site", name: "Rentsouq.ae", short: "Rentsouq", logo: svgLogo("#DB2777", "RA"), group: "site", hub: "Rentsouq", publishTo: ["Rentsouq"], fbPage: "Rentsouq.ae", newsUrl: "https://rentsouq.ae/news/", appBrand: null },
    // The Homes.ph Main Page's articles are on the Sites board (its "Homes" row).
    homesPage("main", "Main Page", "Homes", "Homes.ph", { group: "site" }),
    homesPage("ozamiz", "Ozamiz", "Ozamiz", "Homes.ph Ozamiz"),
    homesPage("dumaguete", "Dumaguete", "Dumaguete", "Homes.ph Dumaguete"),
    homesPage("bgc-taguig", "BGC Taguig", "BGC", "Homes.ph BGC Taguig"),
    homesPage("cebu", "Cebu", "Cebu", "Homes.ph Cebu"),
    homesPage("pampanga", "Pampanga", "Pampanga", "Homes.ph Pampanga"),
    homesPage("cavite", "Cavite", "Cavite", "Homes.ph Cavite"),
    homesPage("iloilo", "Iloilo", "Iloilo", "Homes.ph Iloilo"),
    homesPage("bacolod", "Bacolod", "Bacolod", "Homes.ph Bacolod"),
    homesPage("davao", "Davao", "Davao", "Homes.ph Davao"),
    homesPage("palawan", "Palawan", "Palawan", "Homes.ph Palawan"),
    homesPage("bohol", "Bohol", "Bohol", "Homes.ph Bohol"),
    homesPage("makati", "Makati", "Makati", "Homes.ph Makati"),
    homesPage("cdo", "CDO", "Cagayan De Oro", "Homes.ph CDO"),
    // CARAGA before Gensan, as the panel always showed them.
    homesPage("caraga", "Caraga", "Caraga", "Homes.ph Caraga"),
    homesPage("gensan", "Gensan", "General Santos", "Homes.ph Gensan"),
    homesPage("leyte", "Leyte", "Leyte", "Homes.ph Leyte"),
  ]
  for (const b of HP.DEFAULT_BRANDS) if (!b.times) b.times = HP.GROUPS[b.group].times

  /** Before pages were assigned (or with an app that doesn't say): FHI, PicklePlay, CARAGA, Gensan and the carousel. */
  HP.LEGACY_ASSIGNMENT = { homes: ["gensan", "caraga"], sites: ["fhi", "pickleplay"], carousel: true }

  /** The app's assignment, checked ({ homes, sites, carousel }), or null. */
  HP.cleanAssignment = function (a) {
    if (!a || typeof a !== "object" || !Array.isArray(a.homes) || !Array.isArray(a.sites)) return null
    return { homes: a.homes.filter((k) => typeof k === "string"), sites: a.sites.filter((k) => typeof k === "string"), carousel: a.carousel === true }
  }

  HP.DEFAULT_SETTINGS = {
    /** The floating button on every website (off: only on dash.homes.ph and homes.ph). */
    showEverywhere: true,
    /** Click Publish on the article by itself (after the countdown). Off: the boxes are ticked, you click Publish. */
    autoPublish: true,
    /** Click the Facebook post's Schedule Post by itself. Off (the team's way): everything is filled in, you check it and click. */
    autoSchedule: false,
    /** Seconds to stop it before a click it does by itself. */
    countdown: 5,
    /** A slot this many minutes past its time (or less ahead) is posted on Facebook now instead of scheduled. */
    nowWindow: 2,
    /** Carousel pages whose Facebook Page has another name: "Ozamiz = Homes.ph Ozamiz City", one per line. */
    carouselPages: "",
    /**
     * How a time pill posts (1.2.0): "dash" = all on the dash board (the card's Publish → Clear all, the page's sites →
     * Publish, then Send to Facebook with the app's picture → Post now); "autopost" = the old way (the article page,
     * then homes.ph Facebook Autopost).
     */
    postWay: "dash",
    /** Click Post now by itself (after the countdown) in the dash's Send to Facebook. Off: everything is filled in, you click it. */
    autoPost: true,
    siteUrl: HP.GROUPS.site.url,
    cityUrl: HP.GROUPS.city.url,
    brands: HP.DEFAULT_BRANDS,
  }

  /**
   * Settings with every field (saved ones on top of the defaults; brands by id). `assigned`: the pages assigned in the
   * app ({ homes, sites, carousel }); `brands` is only those (`allBrands` every one), `carousel` whether the carousel is.
   */
  HP.withDefaults = function (saved, assigned, duty) {
    const s = Object.assign({}, HP.DEFAULT_SETTINGS, saved || {})
    // Start Your Day's question (1.2.1): today's answer only ({ day, news }: news false = someone else posts the News Articles).
    s.duty = duty && duty.day === HP.ymd(new Date()) ? { day: duty.day, news: duty.news !== false } : null
    const savedBrands = Array.isArray(saved && saved.allBrands) ? saved.allBrands : Array.isArray(saved && saved.brands) ? saved.brands : []
    s.allBrands = HP.DEFAULT_BRANDS.map((b) =>
      Object.assign({}, b, savedBrands.find((x) => x && x.id === b.id) || {}, { id: b.id, kind: b.kind, short: b.short, logo: b.logo, appBrand: b.appBrand, times: b.times }),
    )
    const a = HP.cleanAssignment(assigned) || HP.LEGACY_ASSIGNMENT
    s.assigned = HP.cleanAssignment(assigned)
    s.carousel = a.carousel
    s.brands = s.allBrands.filter((b) => (b.kind === "homes" ? a.homes : a.sites).includes(b.id))
    s.postWay = s.postWay === "autopost" ? "autopost" : "dash"
    s.autoPost = !(saved && saved.autoPost === false)
    s.countdown = Math.max(0, Math.min(30, Number(s.countdown) || 0))
    s.nowWindow = Math.max(0, Math.min(60, Number(s.nowWindow) || 0))
    // Settings saved by 1.0.0–1.0.3: one "automatic clicks" switch; the Cities address guessed as ?group=city.
    s.autoPublish = saved && typeof saved.autoPublish === "boolean" ? saved.autoPublish : saved && typeof saved.autoSubmit === "boolean" ? saved.autoSubmit : true
    s.autoSchedule = saved && typeof saved.autoSchedule === "boolean" ? saved.autoSchedule : false
    // Reports never go out by themselves (1.0.8 had a switch for it): you click Send report.
    delete s.autoReport
    delete s.autoSubmit
    if (!s.cityUrl || s.cityUrl === "https://dash.homes.ph/super_editor/posts?group=city") s.cityUrl = HP.GROUPS.city.url
    // Settings saved by 1.0.0–1.0.4 with the old Caraga / Gensan sites (Homes.ph Caraga / Gensan): now Homes.
    for (const b of s.allBrands) {
      const old = OLD_PUBLISH_TO[b.id]
      if (old && Array.isArray(b.publishTo) && b.publishTo.length === old.length && b.publishTo.every((x, i) => HP.sameName(x, old[i])))
        b.publishTo = HP.DEFAULT_BRANDS.find((d) => d.id === b.id).publishTo.slice()
    }
    return s
  }
  const OLD_PUBLISH_TO = { caraga: ["Homes.ph Caraga"], gensan: ["Homes.ph Gensan"] }

  /** What Options saves: the settings without what's worked out (the assigned brands, the carousel). */
  HP.savedSettings = function (s) {
    const out = Object.assign({}, s)
    out.brands = s.allBrands || s.brands
    delete out.allBrands
    delete out.assigned
    delete out.carousel
    return out
  }

  /** The sites ticked under "Publish to" after Clear all (dash way): Main News Portal and the page's own. */
  HP.publishSites = (brand) => {
    const list = ["Main News Portal", ...(brand.publishTo || [])]
    return list.filter((x, i) => list.findIndex((y) => HP.sameName(x, y)) === i)
  }

  /**
   * The board's address: one typed in Options, else the one learned from the dash (the address the Cities /
   * Sites board really had when it was open), else the default. The page switches itself when it shows the
   * other board (the CITIES / SITES buttons), so a wrong address still works.
   */
  HP.boardUrl = function (settings, group, learned) {
    const typed = group === "city" ? settings.cityUrl : settings.siteUrl
    if (typed && typed !== HP.GROUPS[group].url) return typed
    return (learned && learned[group]) || HP.GROUPS[group].url
  }

  /** Rows that only one board has: Sites (fhiglobal, PicklePlay, Bayanihan…), Cities (Caraga, Cebu, Davao…). */
  HP.SITE_ROWS = ["fhiglobal", "PicklePlay", "Bayanihan", "Apply Na", "FilipinoHomes", "globalreality", "Homes", "Rentsouq", "PropTech", "Rentals.ph", "rentph", "Main News Portal"]
  HP.CITY_ROWS = ["Caraga", "General Santos", "Cebu", "Makati", "Iloilo", "Cagayan De Oro", "Bacolod", "Pampanga", "Palawan", "Bohol", "Dumaguete", "Cavite", "BGC", "Davao", "Ozamiz", "Leyte"]

  /** Which board the page shows, by its rows ("site", "city", or null when it can't tell). */
  HP.detectGroup = function (board, settings) {
    if (!board || !board.hubs.length) return null
    const names = (group, extra) => [...(settings ? settings.brands.filter((b) => b.group === group).map((b) => b.hub) : []), ...extra]
    const has = (list) => board.hubs.some((h) => list.some((n) => HP.sameName(h.hub, n)))
    // Only Sites has "Homes.ph …" rows (Homes.ph Caraga, Homes,ph CDO, Homes;ph Makati); Cities has "Caraga".
    const site = has(names("site", HP.SITE_ROWS)) || board.hubs.some((h) => /^homes\s*[.,;]\s*ph\b/i.test(h.hub))
    const city = has(names("city", HP.CITY_ROWS))
    return site && !city ? "site" : city && !site ? "city" : null
  }

  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

  /** "NOV 10, 2026" / "November 10, 2026" / "Nov 10 2026" → "2026-11-10" ("" when it isn't a date). */
  HP.dateFromLabel = function (label) {
    const m = /^\s*([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\s*$/i.exec(String(label || ""))
    if (!m) return ""
    const month = MONTHS.indexOf(m[1].toLowerCase())
    const day = Number(m[2])
    if (month < 0 || day < 1 || day > 31) return ""
    return `${m[3]}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  /** The day the board shows (its "NOV 10, 2026" next to the arrows): { day, el }, or null when there's none. */
  HP.pageDate = function (doc) {
    for (const el of doc.querySelectorAll("button, span, p, div, h1, h2, h3, time")) {
      if (el.children.length > 2) continue
      const day = HP.dateFromLabel(el.textContent)
      if (day && HP.visible(el)) return { day, el }
    }
    return null
  }

  // ---------- text ----------

  /** For comparing names: "Homes,ph BGC Taguig" = "Homes.ph BGC Taguig" = "homesph bgc taguig". */
  HP.norm = function (s) {
    return String(s == null ? "" : s)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
  }

  HP.sameName = (a, b) => !!HP.norm(a) && HP.norm(a) === HP.norm(b)

  HP.oneLine = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim()

  /**
   * The article's address, as the websites make it (and Daily Carousel Maker's report): "UAE Capital Markets
   * Focus On Tokenisation And AI Innovation" → "uae-capital-markets-focus-on-tokenisation-and-ai-innovation".
   */
  HP.slug = function (headline) {
    return String(headline || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[\s_./\\|–—-]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }

  HP.articleLink = function (brand, headline) {
    const base = String(brand.newsUrl || "").replace(/\/?$/, "/")
    return base + HP.slug(headline)
  }

  /** "https://www.pickleplay.ph/news/" → "pickleplay.ph". */
  HP.siteHost = function (brand) {
    try {
      return new URL(brand.newsUrl).host.replace(/^www\./, "")
    } catch {
      return ""
    }
  }

  /**
   * The article's real address on the brand's site, from the dash's pill of a published article
   * (<a href="https://www.pickleplay.ph/news/…">PicklePlay</a>): the pill of the brand's first site, else one on
   * the brand's website, else another of its sites. "" when the page has none (not published yet).
   */
  HP.publishedLink = function (root, brand) {
    const links = [...root.querySelectorAll("a[href]")].filter((a) => {
      try {
        const u = new URL(a.href)
        return /^https?:$/.test(u.protocol) && /\/news\/[^/]+/.test(u.pathname) && !/(^|\.)dash\.homes\.ph$/.test(u.host)
      } catch {
        return false
      }
    })
    const host = (a) => new URL(a.href).host.replace(/^www\./, "")
    const first = links.find((a) => HP.sameName(a.textContent, brand.publishTo[0]))
    const own = links.find((a) => host(a) === HP.siteHost(brand))
    const any = links.find((a) => brand.publishTo.some((n) => HP.sameName(a.textContent, n)))
    const a = first || own || any
    return a ? a.href : ""
  }

  /** The Facebook post's first comment. */
  HP.readMore = (url) => `READ MORE: ${url}`

  /** homes.ph's short link to an article ("https://homes.ph/s/hey2K"), what its "Copy link" button copies. */
  HP.isShortLink = (url) => /^https?:\/\/(?:www\.)?homes\.ph\/s\/[A-Za-z0-9_-]+\/?$/.test(String(url || "").trim())

  // ---------- time ----------

  const pad = (n) => String(n).padStart(2, "0")

  /** "10:00 PM" / "10 PM" / "01:30 PM" / "22:00" → "22:00" ("" when it isn't a time). */
  HP.timeFromLabel = function (label) {
    const m = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i.exec(String(label || ""))
    if (m) {
      let h = Number(m[1]) % 12
      if (/p/i.test(m[3])) h += 12
      return `${pad(h)}:${m[2] || "00"}`
    }
    const t = /^(\d{1,2}):(\d{2})$/.exec(String(label || "").trim())
    return t && Number(t[1]) < 24 ? `${pad(Number(t[1]))}:${t[2]}` : ""
  }

  /** "22:00" → "10 PM", "13:30" → "1:30 PM". */
  HP.timeLabel = function (time) {
    const [h, m] = String(time).split(":").map(Number)
    const h12 = h % 12 || 12
    return `${h12}${m ? `:${pad(m)}` : ""} ${h < 12 ? "AM" : "PM"}`
  }

  /** "2026-11-10" (this computer's day). */
  HP.ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  /** The slot's moment (this computer's time; the team works in Philippine time). */
  HP.slotDate = function (day, time) {
    const [y, mo, d] = day.split("-").map(Number)
    const [h, mi] = time.split(":").map(Number)
    return new Date(y, mo - 1, d, h, mi, 0, 0)
  }

  /**
   * When the Facebook post goes out: at the slot's time ("later"), or right away ("now") when the slot's
   * time has come (or is less than `windowMinutes` away), the article being late.
   */
  HP.timing = function (day, time, now, windowMinutes) {
    const at = HP.slotDate(day, time)
    const soon = now.getTime() + (windowMinutes == null ? 2 : windowMinutes) * 60_000
    return at.getTime() <= soon ? { mode: "now", date: HP.ymd(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` } : { mode: "later", date: day, time }
  }

  // ---------- the dash posts board ----------

  const text = (el) => HP.oneLine(el && el.textContent)

  /** One article card on the board. */
  HP.readCard = function (card) {
    const title = text(card.querySelector("p"))
    const pressed = card.querySelector("button[aria-pressed]")
    const footer = card.querySelector("div.border-t, div[class*='border-t']")
    const fbPosted = card.querySelector('[title="Posted on Facebook"]')
    const fbScheduled = card.querySelector('[title="Scheduled on Facebook"]')
    const who = card.querySelector("span[class*='uppercase']")
    const id = card.getAttribute("data-post-id") || card.getAttribute("data-id") || (card.dataset && (card.dataset.postId || card.dataset.id)) || ""
    return {
      title,
      assignee: text(who),
      // The check button: pressed = posted (published).
      posted: !!pressed && pressed.getAttribute("aria-pressed") === "true",
      // The dash draws a yellow line on an article that's due.
      due: !!footer && /amber|warning|yellow/.test(footer.className || ""),
      fb: fbPosted ? "posted" : fbScheduled ? "scheduled" : null,
      postId: id ? String(id) : null,
    }
  }

  /**
   * Reads the posts board (the table with "Target Hub"): its time columns and, per hub, the article cards in
   * each column. Returns null when the table isn't there (yet).
   */
  /** The posts board's table (the "Target Hub" one with the most rows: never a copy of its sticky header). */
  HP.boardTable = function (doc) {
    const tables = [...doc.querySelectorAll("table")].filter((t) => /target\s*hub/i.test(text(t.querySelector("thead") || t.rows[0])))
    return tables.sort((a, b) => b.querySelectorAll("tbody tr").length - a.querySelectorAll("tbody tr").length)[0] || null
  }

  /**
   * A row's name ("Target Hub") or a column's label: its first line. The dash adds a count under it
   * ("fhiglobal" / "3 posts", "11:00 AM" / "No posts"), which isn't part of the name.
   */
  HP.cellLabel = function (cell) {
    if (!cell) return ""
    const name = text(cell.querySelector("p")) || text(cell)
    return name.replace(/\s*(?:\d+\s+posts?|no\s+posts?)\s*$/i, "").trim()
  }

  HP.readBoard = function (doc) {
    const table = HP.boardTable(doc)
    if (!table) return null
    const heads = [...table.querySelectorAll("thead th")]
    const times = heads.slice(1).map((th) => HP.timeFromLabel(HP.cellLabel(th)))
    const hubs = []
    for (const tr of table.querySelectorAll("tbody tr")) {
      const cells = [...tr.children]
      const hub = HP.cellLabel(cells[0])
      if (!hub) continue
      const slots = {}
      cells.slice(1).forEach((td, i) => {
        const time = times[i]
        if (!time) return
        slots[time] = [...td.querySelectorAll("div[draggable]")].map(HP.readCard).filter((c) => c.title)
      })
      hubs.push({ hub, slots })
    }
    return { times: times.filter(Boolean), hubs }
  }

  /**
   * The Sites board has pages (20 rows each; the rows with articles first, then A–Z): a page's rows replace
   * that page's rows saved before; the rows read on the other pages are kept.
   */
  HP.mergeBoard = function (old, board, page) {
    const p = Number(page) || 1
    const hubs = board.hubs.map((h) => Object.assign({}, h, { page: p }))
    const names = new Set(hubs.map((h) => HP.norm(h.hub)))
    const kept = old && Array.isArray(old.hubs) ? old.hubs.filter((h) => (h.page || 1) !== p && !names.has(HP.norm(h.hub))) : []
    return Object.assign({}, board, { hubs: hubs.concat(kept) })
  }

  /** The board's pages ("‹ Previous 1 2 Next ›"): the page shown, and the Next link when there's a next page. */
  HP.pager = function (doc) {
    const nav = doc.querySelector('nav[aria-label="pagination"], [data-slot="pagination"]')
    if (!nav) return { page: 1, next: null, first: null }
    const links = [...nav.querySelectorAll("a, button")]
    const enabled = (a) => !!a && !/\bpointer-events-none\b/.test(String(a.className || "")) && a.getAttribute("aria-disabled") !== "true" && !a.disabled
    const next = nav.querySelector('[aria-label="Go to next page"]') || links.find((a) => /^next$/i.test(text(a)))
    const pages = links.filter((a) => /^\d+$/.test(text(a)))
    const current = pages.find((a) => a.getAttribute("aria-current") === "page" || a.getAttribute("data-active") === "true")
    return { page: current ? Number(text(current)) : 1, next: enabled(next) ? next : null, first: pages.find((a) => text(a) === "1") || null }
  }

  /** The board's group and day from its address (?group=site&date=2026-11-10; today when there's no date). */
  HP.boardWhere = function (href, now) {
    const u = new URL(href)
    const g = (u.searchParams.get("group") || "").toLowerCase()
    const group = g === "site" || g === "sites" ? "site" : g === "city" || g === "cities" ? "city" : null
    const date = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("date") || "") ? u.searchParams.get("date") : HP.ymd(now || new Date())
    return { group, date }
  }

  /**
   * An article is done when it's checked on the board ("Posted"), or its Facebook post is scheduled or posted
   * (the dash's "f" mark, or this extension's record), unless Facebook Autopost's Scheduled Posts no longer has
   * it (deleted).
   */
  HP.cardDone = function (card, rec) {
    if (rec && rec.deleted) return false
    return !!card.posted || !!card.fb || !!(rec && rec.facebook)
  }

  /** The extension's record of a slot's article (Facebook done, or its scheduled post deleted). */
  HP.recOf = (done, brandId, day, time) => (card) => (done ? done[HP.doneKey(brandId, day, time, card.title)] || null : null)

  /**
   * A slot's state: "empty" (no article yet), "published" (every article done: checked, or on Facebook),
   * "due" (one not done while its time has come, or the dash's yellow line) or "ready" (to publish, then post).
   */
  HP.slotState = function (cards, day, time, now, recOf) {
    if (!cards || !cards.length) return "empty"
    const open = cards.filter((c) => !HP.cardDone(c, recOf ? recOf(c) : null))
    if (!open.length) return "published"
    const late = HP.slotDate(day, time).getTime() <= now.getTime()
    if (open.some((c) => c.due) || late) return "due"
    return "ready"
  }

  /** The brand's row of a saved board, by its hub name ("fhiglobal", "General Santos" = "GENERAL SANTOS"). */
  HP.hubOf = function (board, brand) {
    if (!board) return null
    return board.hubs.find((h) => HP.sameName(h.hub, brand.hub)) || null
  }

  // ---------- Facebook Autopost → Scheduled Posts: is a scheduled post still there? ----------

  /** "Nov 14, 2026, 4:00 PM PHT" in a Scheduled Posts row → { day: "2026-11-14", time: "16:00" } (null when there's none). */
  HP.dashWhen = function (text) {
    const m = /\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*([ap])\.?\s*m/i.exec(String(text || ""))
    if (!m) return null
    const day = HP.dateFromLabel(`${m[1]} ${m[2]}, ${m[3]}`)
    const hour = (Number(m[4]) % 12) + (m[6].toLowerCase() === "p" ? 12 : 0)
    return day ? { day, time: `${String(hour).padStart(2, "0")}:${m[5]}` } : null
  }

  /**
   * Compares the posts that should be on Scheduled Posts with the rows it shows (each row's whole text).
   * A post is found by its article title or its caption (the first words), or else by its Facebook Page
   * and its date and time. It is:
   *  - present: its row is there;
   *  - removed: its row says it was deleted or cancelled;
   *  - missing: not there although the whole list is shown (no filter, no other page) and its caption is known;
   *  - unknown: not there, but the list is filtered or has more pages, or its caption isn't known: nothing is
   *    concluded (a post is never called deleted on a guess).
   */
  HP.checkScheduled = function (expected, rows, complete) {
    const list = (rows || []).map((r) => {
      const text = String(r && r.text != null ? r.text : r || "")
      return { text, norm: HP.norm(text), when: HP.dashWhen(text) }
    })
    const out = { present: [], removed: [], missing: [], unknown: [] }
    for (const e of expected || []) {
      const words = [e.title, e.caption].map((t) => HP.norm(t).slice(0, 36)).filter((k) => k.length >= 12)
      const page = HP.norm(e.fbPage)
      let hits = list.filter((r) => words.some((k) => r.norm.includes(k)))
      if (!hits.length) hits = list.filter((r) => page && r.norm.includes(page) && r.when && r.when.day === e.day && r.when.time === e.time)
      if (hits.length) {
        const live = hits.some((r) => /scheduled on facebook/i.test(r.text) || !/\b(deleted|cancell?ed|removed)\b/i.test(r.text))
        out[live ? "present" : "removed"].push(e.key)
      } else out[complete && e.caption ? "missing" : "unknown"].push(e.key)
    }
    return out
  }

  /** The key of an article published here (until the board is read again, it counts as published). */
  HP.doneKey = (brandId, day, time, title) => `${brandId}|${day}|${time}|${HP.norm(title)}`

  /** A day's slots not on Facebook yet (to publish or to post), how many are due, and the deleted scheduled posts. */
  HP.dayCount = function (settings, boards, done, day, now) {
    let open = 0
    let late = 0
    let read = false
    const deleted = []
    for (const brand of settings.brands) {
      const hub = HP.hubOf(boards[`${brand.group}|${day}`], brand)
      if (!hub) continue
      read = true
      for (const [time, cards] of Object.entries(hub.slots)) {
        const rec = HP.recOf(done, brand.id, day, time)
        const state = HP.slotState(cards, day, time, now, rec)
        if (state === "due") late += 1
        if (state === "due" || state === "ready") open += 1
        for (const c of cards) if (rec(c) && rec(c).deleted) deleted.push({ brand, time, title: c.title })
      }
    }
    return { open, late, read, deleted }
  }

  /** Today's slots not on Facebook yet, and how many of them are due. */
  HP.countToday = (settings, boards, done, now) => HP.dayCount(settings, boards, done, HP.ymd(now), now)

  /** The past days (newest first, the last `days`) whose read boards still have articles not on Facebook. */
  HP.missedDays = function (settings, boards, done, now, days = 14) {
    const out = []
    for (let i = 1; i <= days; i++) {
      const d = HP.ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))
      const c = HP.dayCount(settings, boards, done, d, now)
      if (c.read && c.open) out.push({ day: d, open: c.open })
    }
    return out
  }

  // ---------- carousels: Daily Carousel Maker's scheduled carousel, posted to its Facebook pages ----------

  /** A carousel's Facebook post is always at 11:00 PM on its day, to at most 4 Pages at a time. */
  HP.CAROUSEL_TIME = "23:00"
  HP.CAROUSEL_PER_POST = 4
  /** The checklist's "Main Page" is the Facebook Page "Homes.ph" (its ID as Target Facebook Pages lists it). */
  HP.MAIN_PAGE = { name: "Homes.ph", id: "253657525049795" }
  /** Other words a city's Facebook Page may be called by. */
  HP.CAROUSEL_ALIASES = { ozamiz: ["Ozamis"], "bgc-taguig": ["BGC", "Taguig"], cdo: ["Cagayan de Oro", "Cagayan"], gensan: ["General Santos", "GenSan"] }

  /** The checklist's pages in posts of 4, in its order: [{ n: 1, pages: [Main Page, Ozamiz, Dumaguete, BGC Taguig] }, …]. */
  /** Pages per carousel post: every one in one post on the dash (1.2.0), 4 on Facebook Autopost (old way). */
  HP.carouselPer = (settings) => (settings && settings.postWay === "autopost" ? HP.CAROUSEL_PER_POST : 99)

  HP.carouselGroups = function (pages, per) {
    const size = per || HP.CAROUSEL_PER_POST
    const sorted = [...(pages || [])].sort((a, b) => (a.sort || 0) - (b.sort || 0))
    const out = []
    for (let i = 0; i < sorted.length; i += size) out.push({ n: out.length + 1, pages: sorted.slice(i, i + size) })
    return out
  }

  /** Options' "Ozamiz = Homes.ph Ozamiz City" lines → { ozamiz: "Homes.ph Ozamiz City" } (by the page's name, compared loosely). */
  HP.parseCarouselNames = function (text) {
    const out = {}
    for (const line of String(text || "").split(/\r?\n/)) {
      const m = /^\s*([^=]+?)\s*=\s*(.+?)\s*$/.exec(line)
      if (m && HP.norm(m[1]) && m[2]) out[HP.norm(m[1])] = m[2]
    }
    return out
  }

  /**
   * How a checklist page is found among Facebook Autopost's Target Facebook Pages: { names (exact), keywords
   * (a word of the name), id, search (typed in its search box), label }.
   */
  HP.carouselTarget = function (page, settings) {
    const typed = HP.parseCarouselNames(settings && settings.carouselPages)
    const own = typed[HP.norm(page.short)] || typed[HP.norm(page.name)] || typed[HP.norm(page.key)]
    const label = page.short || page.name
    if (own) return { names: [own], keywords: [], id: null, search: own, label }
    if (page.key === "main" || /\bmain\s*page\b/i.test(`${page.short} ${page.name}`)) return { names: [HP.MAIN_PAGE.name, page.name], keywords: [], id: HP.MAIN_PAGE.id, search: HP.MAIN_PAGE.name, label }
    return { names: [page.name, `Homes.ph ${page.short}`], keywords: [page.short, ...(HP.CAROUSEL_ALIASES[page.key] || [])].filter(Boolean), id: null, search: page.short, label }
  }

  const reEscape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  /**
   * Which row of Target Facebook Pages ([{ name, text }]) is this page: its ID, else its exact name, else the
   * one Homes.ph Page (or the one Page) with the city's word in its name. -1 when none (or not one only).
   */
  HP.matchCarouselPage = function (rows, target) {
    if (target.id) {
      const re = new RegExp(`\\bID\\s*:?\\s*${reEscape(target.id)}\\b`)
      const i = rows.findIndex((r) => re.test(r.text || ""))
      if (i >= 0) return i
    }
    for (const name of target.names || []) {
      const i = rows.findIndex((r) => HP.sameName(r.name, name))
      if (i >= 0) return i
    }
    for (const word of target.keywords || []) {
      const re = new RegExp(`(^|[^a-z0-9])${reEscape(word)}($|[^a-z0-9])`, "i")
      const hits = rows.map((r, i) => ({ r, i })).filter((x) => re.test(x.r.name || ""))
      const homes = hits.filter((x) => /homes/i.test(x.r.name))
      const pick = homes.length === 1 ? homes[0] : !homes.length && hits.length === 1 ? hits[0] : null
      if (pick) return pick.i
    }
    return -1
  }

  /**
   * A carousel's page is posted: ticked on Daily Carousel Maker's checklist, or posted through this extension
   * since the checklist was last read (a tick taken off in the app afterwards counts).
   */
  HP.carouselPosted = function (entry, carousel, key, done) {
    if (carousel.checks.some((c) => c.key === key)) return true
    const rec = done && done[carousel.id] && done[carousel.id][key]
    return !!rec && rec.at > ((entry && entry.at) || 0)
  }

  // ---------- Reports: the day's tasks on dtr.homes.ph (My Tasks) and their updates ----------

  HP.DTR_TASKS_URL = "https://dtr.homes.ph/m/tasks"
  /** A job's name in the panel and banners: "FHI Global 10 PM", "Carousel 11 PM", "Start Your Day", "PicklePlay report". */
  HP.jobName = (job) => (job && job.label) || `${job ? job.brandName : ""} ${job ? HP.timeLabel(job.time) : ""}`.trim()
  /** Every task is for today, time in to time out (Monday to Friday 9:00 AM – 6:00 PM), In progress until its report is in. */
  HP.DTR_HOURS = { from: "09:00", to: "18:00" }
  /** Saturday is a half day: 9:00 AM – 12:00 PM. */
  HP.SATURDAY_HOURS = { from: "09:00", to: "12:00" }
  /** A "2026-11-14" day (or a Date) → that day's Date, at noon; today when not given. */
  HP.dateOf = (day) => {
    if (day instanceof Date) return day
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""))
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date()
  }
  HP.isHalfDay = (day) => HP.dateOf(day).getDay() === 6
  /** A day's time in and time out: { from, to }. */
  HP.workHours = (day) => (HP.isHalfDay(day) ? HP.SATURDAY_HOURS : HP.DTR_HOURS)
  /** "9:00 AM – 12:00 PM": a day's hours as My Tasks' form reads. */
  HP.workHoursLabel = (day) => {
    const f = (t) => {
      const [h, m] = t.split(":").map(Number)
      return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
    }
    const h = HP.workHours(day)
    return `${f(h.from)} – ${f(h.to)}`
  }

  /** How each page is named in the reports (as Daily Carousel Maker's report names them). */
  /** How the report names each page ("Pickleplay.ph", "Homes.ph CARAGA"; the others by their name: "Homes.ph Cebu"). */
  HP.REPORT_NAMES = { pickleplay: "Pickleplay.ph", fhi: "FHI Global", caraga: "Homes.ph CARAGA", gensan: "Homes.ph Gensan" }
  HP.reportName = (id) => HP.REPORT_NAMES[id] || (HP.DEFAULT_BRANDS.find((b) => b.id === id) || { name: id }).name

  /** The order of the day's tasks and lists: PicklePlay, FHI, CARAGA, Gensan (as the team knows them), then the others. */
  const REPORT_ORDER = ["pickleplay", "fhi", "caraga", "gensan"]
  HP.reportOrder = (brands) =>
    brands
      .map((b, i) => ({ b, i, r: REPORT_ORDER.indexOf(b.id) }))
      .sort((x, y) => (x.r < 0 ? 99 : x.r) - (y.r < 0 ? 99 : y.r) || x.i - y.i)
      .map((x) => x.b)

  /** The daily quote: one per assigned page, 4:00 PM unless you pick another time. */
  HP.QUOTE_TIME = "16:00"
  HP.quoteBrands = (settings) => HP.reportOrder(settings.brands).map((b) => b.id)
  /** The pages with advertisements in the app (its Advertisement page): PicklePlay so far. */
  HP.AD_PAGES = ["pickleplay"]
  /** An advertisement's brand in the app → the extension's page (Homes.ph's: the first assigned Homes.ph page). */
  HP.AD_BRAND = { pickleplay: "pickleplay", fhi: "fhi", homes: "caraga", gensan: "gensan" }
  HP.adBrandId = (adBrand, settings) => {
    const id = HP.AD_BRAND[adBrand] || "pickleplay"
    if (!settings || settings.brands.some((b) => b.id === id)) return id
    if (adBrand === "homes") {
      const homes = settings.brands.find((b) => b.kind === "homes" && b.id !== "gensan")
      if (homes) return homes.id
    }
    return id
  }
  /** A Daily Trend News group in the app → the extension's page (other Homes.ph pages: by their name). */
  HP.trendBrandId = (group, settings) => {
    const g = HP.norm(group)
    const list = settings ? settings.allBrands || settings.brands : HP.DEFAULT_BRANDS
    const hit = list.find((b) => b.id === group || HP.norm(b.name) === g || HP.norm(b.short) === g || HP.norm(HP.reportName(b.id)) === g)
    return hit ? hit.id : null
  }

  const svg = (body) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`)}`
  HP.ICONS = {
    quote: svg('<circle cx="16" cy="16" r="16" fill="#7C3AED"/><path d="M8.5 22v-5c0-3.9 1.9-6.4 5.4-7.1l.8 1.8c-2 .7-3 2-3.1 3.8h2.4V22H8.5zm9.6 0v-5c0-3.9 1.9-6.4 5.4-7.1l.8 1.8c-2 .7-3 2-3.1 3.8h2.4V22h-5.5z" fill="#fff"/>'),
    trend: svg('<circle cx="16" cy="16" r="16" fill="#DC2626"/><path d="M7.5 21.5l6-6 4 4 7-8" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11.5h5.5V17" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  }
  /** A logo's address: one of the extension's pictures, or a drawn icon. */
  HP.logoUrl = (logo) => (/^data:/.test(logo) ? logo : HP.url(logo))

  /** "9:00 AM, 11:00 AM, …, and 10:00 PM" (as the app writes the details). */
  const clock = (t) => {
    const [h, m] = t.split(":").map(Number)
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
  }
  const listOf = (items) => (items.length <= 1 ? items[0] || "" : items.length === 2 ? `${items[0]} and ${items[1]}` : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`)
  /** "A, B, C and D" (the quotes task's title, as before). */
  const andList = (items) => (items.length <= 1 ? items[0] || "" : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`)

  /** A page's article posting task (its title and details are the app's report texts). */
  HP.articleTask = (b) => ({
    id: b.id,
    kind: "articles",
    name: b.short || b.name,
    logo: b.logo,
    brandId: b.id,
    title: `Daily Social Media Posting – ${HP.reportName(b.id)}`,
    details: `Posted and scheduled daily articles on the ${HP.reportName(b.id)} social media page at ${listOf((b.times || []).map(clock))}.`,
    times: (b.times || []).slice(),
  })
  HP.CAROUSEL_TASK = {
    id: "carousel",
    kind: "carousel",
    name: "Carousel",
    logo: "logo-homes.png",
    brandId: null,
    title: "Daily Carousel Content Creation and Scheduling – Homes.ph Social Media Pages",
    details: "Created and scheduled daily carousel content for all Homes.ph social media pages, with posts set to publish every day at 11:00 PM.",
    times: ["23:00"],
  }
  HP.TRENDING_TASK = { id: "trending", kind: "trending", name: "Trending", logo: HP.ICONS.trend, brandId: null, hr: true, title: "Search a Trending News Daily", details: "", times: [] }

  /**
   * The day's tasks, in the order "Start Your Day" adds them, for the assigned pages: each page's article posting,
   * the carousel (when assigned), the advertisements (pages with ads), the daily quote (every assigned page) and HR's
   * Search a Trending News Daily (looked for, never added). Titles and details as the app's report writes them.
   */
  HP.reportTasks = function (settings) {
    const brands = HP.reportOrder((settings && settings.brands) || [])
    // Not posting the News Articles today (Start Your Day's answer): only the other tasks.
    const tasks = HP.newsOff(settings) ? [] : brands.map(HP.articleTask)
    if (!settings || settings.carousel) tasks.push(HP.CAROUSEL_TASK)
    const adPages = brands.filter((b) => HP.AD_PAGES.includes(b.id))
    if (adPages.length) {
      const names = adPages.map((b) => HP.reportName(b.id))
      tasks.push({
        id: "ads",
        kind: "ads",
        name: "Ads",
        logo: adPages[0].logo,
        brandId: null,
        title: `Daily Advertisement Posting – ${andList(names)}`,
        details:
          adPages.length === 1 && adPages[0].id === "pickleplay"
            ? "Created and scheduled PicklePlay PH advertisement posts (History, Trivia, Fun Facts, Court Owners, Coming Soon and Now Open) on the Pickleplay.ph social media page, each set at least 1 hour away from the daily article postings."
            : `Created and scheduled advertisement posts (History, Trivia, Fun Facts and more) on the ${andList(names)} social media pages, each set at least 1 hour away from the daily article postings.`,
        times: [],
      })
    }
    if (brands.length) {
      const names = andList(brands.map((b) => HP.reportName(b.id)))
      tasks.push({
        id: "quotes",
        kind: "quotes",
        name: "Quotes",
        logo: HP.ICONS.quote,
        brandId: null,
        title: `Daily Quote Posting – ${names}`,
        details: `Posted and scheduled the daily quote on the ${names} social media page${brands.length === 1 ? "" : "s"} at 4:00 PM.`,
        times: [],
      })
    }
    tasks.push(HP.TRENDING_TASK)
    return tasks
  }
  /** Today, someone else posts the News Articles (Start Your Day was answered No). */
  HP.newsOff = (settings) => !!(settings && settings.duty && settings.duty.news === false)
  /** Start Your Day's question was answered today. */
  HP.dutyAsked = (settings) => !!(settings && settings.duty)
  /** The pages with advertisements that are assigned (no PicklePlay: no Ads tab, no Ads task). */
  HP.adPagesOf = (settings) => ((settings && settings.brands) || []).filter((b) => HP.AD_PAGES.includes(b.id))

  /** The tasks Start Your Day adds (not HR's). */
  HP.addTasks = (settings) => HP.reportTasks(settings).filter((t) => !t.hr)

  // Before 1.2.0 (and the pages the app had then): PicklePlay, FHI, CARAGA, Gensan, the carousel, ads, quotes, trending.
  HP.QUOTE_BRANDS = ["pickleplay", "fhi", "caraga", "gensan"]
  HP.REPORT_TASKS = HP.reportTasks(HP.withDefaults(null))
  HP.ADD_TASKS = HP.REPORT_TASKS.filter((t) => !t.hr)

  /** Bold that stays bold where it's pasted (Unicode sans-serif bold A–Z, a–z, 0–9), as Daily Carousel Maker writes it. */
  HP.boldSans = function (s) {
    return Array.from(String(s == null ? "" : s))
      .map((ch) => {
        const c = ch.codePointAt(0)
        if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + c - 65)
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + c - 97)
        if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + c - 48)
        return ch
      })
      .join("")
  }

  /** A posting time's update: "[𝟵 𝗔𝗠] - Headline", a blank line, "𝗔𝗿𝘁𝗶𝗰𝗹𝗲 𝗟𝗶𝗻𝗸: https://…". */
  HP.reportLine = (time, headline, link) => `[${HP.boldSans(HP.timeLabel(time))}] - ${HP.oneLine(headline)}\n\n${HP.boldSans("Article Link")}: ${link}`

  /** "Homes.ph Main Page", then the short names ("Ozamiz", "BGC Taguig"…), as the report writes them. */
  HP.pageShortName = (p) => (/\bmain\s*page\b/i.test(p.name || "") ? HP.oneLine(p.name) : HP.oneLine(p.short_name || p.short) || HP.oneLine(p.name).replace(/^homes\.?ph\s+/i, ""))

  /** The carousel's update, as Daily Carousel Maker's report writes it (heading, day | time, title, every page ✅). */
  HP.carouselUpdateText = function (input) {
    const at = input.at
    const h = at ? at.getHours() % 12 || 12 : 0
    const when = at ? `${at.getDate()}/${at.getMonth() + 1}/${at.getFullYear()} | ${h}${at.getMinutes() ? `:${pad(at.getMinutes())}` : ""} ${at.getHours() < 12 ? "AM" : "PM"}` : ""
    const pages = input.pages.map((p) => `${HP.pageShortName(p)} ${p.done === false ? "⏳" : "✅"}`).join(" | ")
    return `${HP.boldSans("Carousel Successfully Scheduled")}:\n${when}\n\n${HP.boldSans(HP.oneLine(input.title))}\n\n${pages} |`
  }

  /** The first line of a text, at most `max` characters (… when cut). */
  HP.firstLine = function (s, max) {
    const line = HP.oneLine(String(s == null ? "" : s).split(/\r?\n/).find((l) => l.trim()) || "")
    return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line
  }

  /** An advertisement's update: "[𝟭 𝗣𝗠] - History Advertisement: The kitchen keeps volleys out of play." + its Page. */
  HP.adUpdateText = (ad) =>
    `[${HP.boldSans(HP.timeLabel(ad.time))}] - ${HP.oneLine(ad.kindLabel) || "Advertisement"} Advertisement: ${HP.oneLine(ad.title) || HP.firstLine(ad.caption, 120)}\n\n${HP.boldSans("Facebook Page")}: ${HP.REPORT_NAMES[HP.AD_BRAND[ad.brand]] || HP.REPORT_NAMES.pickleplay}`

  /** A quote's update: "[𝟰 𝗣𝗠] - Daily Quote posted on Homes.ph Gensan" + the caption's first line. */
  HP.quoteUpdateText = (q) => {
    const caption = HP.firstLine(q.caption, 160)
    return `[${HP.boldSans(HP.timeLabel(q.time))}] - Daily Quote posted on ${HP.reportName(q.brandId)}${caption ? `\n\n${HP.boldSans("Caption")}: ${caption}` : ""}`
  }

  /** "2026-11-12" → "11/12/2026" (the report's date). */
  HP.reportDate = (day) => {
    const [y, m, d] = String(day).split("-").map(Number)
    return `${m}/${d}/${y}`
  }

  /**
   * A Daily Trend News poster's update, as the floating report's copy button writes it: the bold title with the day,
   * the headline in bold with the subtext after it, and "𝗗𝗲𝘁𝗮𝗶𝗹𝘀:".
   */
  HP.trendUpdateText = (p, day) => {
    const h = HP.boldSans(HP.oneLine(p.headline))
    const s = HP.oneLine(p.subtext).replace(/^\(+|\)+$/g, "")
    const details = HP.oneLine(p.details)
    return [`${HP.boldSans(`${p.groupName} - Daily Trend News ${p.n}`)} [${HP.reportDate(day)}]`, s ? `${h}  (${s})` : h, ...(details ? [`${HP.boldSans("Details")}: ${details}`] : [])].join("\n\n")
  }

  /** What was posted through the extension (ads, trend news, quotes), kept in "posted" by day: { "ad:<id>": { at, facebook, … } }. */
  HP.postedRec = (posted, day, key) => (posted && posted[day] && posted[day][key]) || null
  HP.adPosted = (ad, posted, day) => !!HP.postedRec(posted, day, `ad:${ad.id}`) || !!ad.postedAt
  HP.trendPosted = (p, posted, day) => !!HP.postedRec(posted, day, `trend:${p.id}`)
  /** "DTN 1" (a poster), "DYK 1" (Did You Know), "ENG 1" (engagement post). */
  HP.postTag = (p) => `${p.kind === "dyk" ? "DYK" : p.kind === "engagement" ? "ENG" : "DTN"} ${p.n}`
  HP.quotePosted = (q, posted, day) => !!HP.postedRec(posted, day, `quote:${q.brandId}`)

  /** "Fri, Nov 13": how My Tasks writes a day that isn't today. */
  HP.dtrDayLabel = (d) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]}, ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getDate()}`

  /** A task's status as My Tasks writes it: "in_progress", "done", "todo", or "" (not written). */
  HP.dtrStatus = function (texts) {
    for (const t of texts || []) {
      const s = HP.norm(t)
      if (s === "inprogress") return "in_progress"
      if (s === "done" || s === "completed") return "done"
      if (s === "todo") return "todo"
    }
    return ""
  }

  /**
   * Is a My Tasks row today's: "today" (To do: "Today", "Thu, Nov 12"), "done" (done today: "Done Nov 12", "Done Today"),
   * or null (another day).
   */
  HP.dtrWhen = function (meta, now) {
    const isToday = (mon, d, y) => MONTHS.indexOf(String(mon).slice(0, 3).toLowerCase()) === now.getMonth() && Number(d) === now.getDate() && (!y || Number(y) === now.getFullYear())
    for (const raw of meta || []) {
      const m = HP.oneLine(raw)
      if (/^done\s+today$/i.test(m)) return "done"
      let x = /^done\s+(?:on\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i.exec(m)
      if (x) {
        if (isToday(x[1], x[2], x[3])) return "done"
        continue
      }
      if (/^today$/i.test(m)) return "today"
      x = /^(?:[a-z]{3,9},?\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i.exec(m)
      if (x && MONTHS.includes(x[1].slice(0, 3).toLowerCase()) && isToday(x[1], x[2], x[3])) return "today"
    }
    return null
  }

  /**
   * Which of the day's tasks are in My Tasks today, traced row by row: To do ("Today") or Done today ("Done Nov 12").
   * rows [{ title, url, meta: ["Today" | "Done Nov 12", "09:00 AM – 06:00 PM", "In progress", …] }] →
   * { pickleplay: { status, url, count }, … }. The same task twice: the one still open (it's the one to report).
   */
  HP.dtrFound = function (rows, now, tasks) {
    const list = tasks || HP.REPORT_TASKS
    const out = {}
    for (const r of rows || []) {
      const meta = (r.meta || []).map(HP.oneLine)
      const when = HP.dtrWhen(meta, now)
      if (!when) continue
      const task = list.find((t) => HP.sameName(t.title, r.title))
      if (!task) continue
      const status = when === "done" ? "done" : HP.dtrStatus(meta) || "added"
      const prev = out[task.id]
      const count = prev ? prev.count + 1 : 1
      if (!prev || (prev.status === "done" && status !== "done")) out[task.id] = { status, url: r.url || "", count }
      else prev.count = count
    }
    return out
  }

  /** A task's colour in Reports: "none" (not added: gray), "progress" (light orange), "done" (light green). */
  HP.dtrState = function (dtrDay, id) {
    const t = dtrDay && dtrDay.tasks && dtrDay.tasks[id]
    if (!t) return "none"
    return t.status === "done" ? "done" : "progress"
  }

  /** `sent`: the updates of what's posted so far (a report sent before everything is posted says only those). */
  const plan = (ready, posted, total, updates, why, sent, known) => ({ ready, posted, total, updates, why: ready ? "" : why, sent: ready ? updates : sent || [], known: ready || !!known })

  /**
   * What a task's report says and whether it can go (its Send report button): everything it reports is posted.
   * Articles: every posting time has its article(s), on Facebook or checked. Carousel: every page posted. Ads and
   * Trending: every one of the day's (from Daily Carousel Maker) posted. Quotes: every quote set up today posted.
   * { ready, posted, total, updates: [{ key, text }], why, sent, known }. `sent` is the updates of what's posted so
   * far: a report can go before everything is posted (time out, Saturday's half day) and then says only those;
   * `known` is false while what the task reports isn't read yet (nothing can be sent). ctx: { settings, boards, done, carousels, carouselDone,
   * ads, trends, quotes, posted }.
   */
  HP.reportPlan = function (task, ctx, day) {
    const kind = task.kind || "articles"
    if (kind === "carousel") {
      const entry = ctx.carousels && ctx.carousels[day]
      const data = entry && entry.data
      if (!data) return plan(false, 0, 0, [], "the carousel isn't read yet (open Daily Carousel Maker)")
      if (!data.carousels.length) return plan(false, 0, 0, [], "no carousel scheduled for today", [], true)
      const updates = []
      const sent = []
      let posted = 0
      let total = 0
      for (const c of data.carousels) {
        const pages = data.pages.map((p) => ({ name: p.name, short: p.short, done: HP.carouselPosted(entry, c, p.key, ctx.carouselDone) }))
        posted += pages.filter((p) => p.done).length
        total += pages.length
        const u = { key: `carousel|${c.id}`, text: HP.carouselUpdateText({ title: c.title, at: c.scheduledAt ? new Date(c.scheduledAt) : null, pages }) }
        updates.push(u)
        // Posted on some pages only: its line says which (✅) and which not yet (⏳).
        if (pages.some((p) => p.done)) sent.push(u)
      }
      return plan(total > 0 && posted === total, posted, total, updates, `${posted}/${total} pages posted`, sent, true)
    }
    if (kind === "ads" || kind === "trending") {
      const ads = kind === "ads"
      const entry = (ads ? ctx.ads : ctx.trends) && (ads ? ctx.ads : ctx.trends)[day]
      const data = entry && entry.data
      if (!data) return plan(false, 0, 0, [], entry && entry.error ? entry.error : `${ads ? "the ads" : "the trend news"} aren't read yet (open Daily Carousel Maker)`)
      const items = ads ? data.ads || [] : data.posters || []
      if (!items.length) return plan(false, 0, 0, [], ads ? "no advertisement scheduled for today" : "no Daily Trend News poster for today", [], true)
      const isPosted = (x) => (ads ? HP.adPosted(x, ctx.posted, day) : HP.trendPosted(x, ctx.posted, day))
      const posted = items.filter(isPosted).length
      const updates = items.map((x) => ({ key: `${ads ? "ad" : "trend"}|${x.id}`, id: x.id, text: ads ? HP.adUpdateText(x) : HP.trendUpdateText(x, day) }))
      const sent = updates.filter((u, i) => isPosted(items[i]))
      return plan(posted === items.length, posted, items.length, updates, `${posted}/${items.length} posted`, sent, true)
    }
    if (kind === "quotes") {
      const set = (ctx.quotes && ctx.quotes[day]) || {}
      const items = (ctx.settings ? HP.quoteBrands(ctx.settings) : HP.QUOTE_BRANDS).map((b) => set[b]).filter((q) => q && q.imageId)
      if (!items.length) return plan(false, 0, 0, [], "no quote set up today (Quotes tab)", [], true)
      const posted = items.filter((q) => HP.quotePosted(q, ctx.posted, day)).length
      const updates = items.map((q) => ({ key: `quote|${q.brandId}`, text: HP.quoteUpdateText(q) }))
      const sent = updates.filter((u, i) => HP.quotePosted(items[i], ctx.posted, day))
      return plan(posted === items.length, posted, items.length, updates, `${posted}/${items.length} posted`, sent, true)
    }
    const brand = ctx.settings.brands.find((b) => b.id === task.brandId)
    const hub = brand ? HP.hubOf(ctx.boards[`${brand.group}|${day}`], brand) : null
    if (!hub) return plan(false, 0, task.times.length, [], "today's board isn't read yet")
    const times = [...new Set([...task.times, ...Object.keys(hub.slots).filter((t) => (hub.slots[t] || []).length)])].sort()
    const updates = []
    const sent = []
    let posted = 0
    let ready = true
    for (const time of times) {
      const cards = hub.slots[time] || []
      const required = task.times.includes(time)
      const rec = HP.recOf(ctx.done, brand.id, day, time)
      const allDone = cards.length > 0 && cards.every((c) => HP.cardDone(c, rec(c)))
      if (required && allDone) posted++
      if (!allDone && (required || cards.length)) ready = false
      for (const c of cards) {
        const r = rec(c)
        const real = r && r.articleUrl && !HP.isShortLink(r.articleUrl) ? r.articleUrl : ""
        const u = { key: `${time}|${HP.norm(c.title)}`, text: HP.reportLine(time, c.title, real || HP.articleLink(brand, c.title)) }
        updates.push(u)
        if (HP.cardDone(c, r)) sent.push(u)
      }
    }
    return plan(ready, posted, task.times.length, updates, `${posted}/${task.times.length} posted`, sent, true)
  }

  // ---------- the daily report: Today's report (My Tasks) → the report chat in Messenger ----------

  HP.DTR_REPORT_URL = "https://dtr.homes.ph/m/tasks/report"
  HP.MESSENGER_REPORT_URL = "https://www.messenger.com/t/974484561951117"
  /** The greeting, in parts: text, @mentions (each picked from Messenger's list, so it's a real mention) and line breaks. */
  HP.DAILY_GREETING = [
    { text: "Good Evening Sir " },
    { mention: "Anthony Orais Leuterio" },
    { text: ", Sir " },
    { mention: "Hernan Malubay" },
    { text: " and Sir " },
    { mention: "Johnry Fibra" },
    { text: " ," },
    { text: "\n\nHere's my report today:" },
  ]
  HP.DAILY_MENTIONS = HP.DAILY_GREETING.filter((p) => p.mention).map((p) => p.mention)
  /** "Good Afternoon" on Saturday (time out is 12:00 PM), "Good Evening" Monday to Friday (time out is 6:00 PM). */
  HP.greetingWord = (day) => (HP.isHalfDay(day) ? "Good Afternoon" : "Good Evening")
  /** The greeting's parts for a day ("2026-11-14" or a Date; today when not given). */
  HP.dailyGreeting = (day) => HP.DAILY_GREETING.map((p, i) => (i === 0 ? { text: `${HP.greetingWord(day)} Sir ` } : p))
  /** The greeting as it reads once sent. */
  HP.greetingText = (day) => HP.dailyGreeting(day).map((p) => (p.mention ? `@${p.mention}` : p.text)).join("")
  /** Every one of the day's tasks is Done (HR's trending task too, when it's there): the daily report can go. */
  HP.allReportsDone = (dtrDay, settings) =>
    !!dtrDay &&
    !!dtrDay.tasks &&
    (settings ? HP.addTasks(settings) : HP.ADD_TASKS).every((t) => HP.dtrState(dtrDay, t.id) === "done") &&
    (!dtrDay.tasks.trending || dtrDay.tasks.trending.status === "done")

  // ---------- page helpers (content scripts) ----------

  // ---------- an old copy of the page scripts (the extension was reloaded or updated): it stops quietly ----------

  // Content scripts of one extension share their page's world: the second shared.js keeps the first one's helpers.
  if (!HP.store) {
    const life = { dead: false, fns: [] }
    /** False in a page's old copy of these scripts once the extension was reloaded (Chrome cut it off). */
    HP.alive = () => {
      try {
        return !!(globalThis.chrome && chrome.runtime && chrome.runtime.id)
      } catch {
        return false
      }
    }
    /** What to undo when this copy is cut off (its button, its timers). */
    HP.onDead = (fn) => (life.dead ? fn() : life.fns.push(fn))
    HP.die = () => {
      if (life.dead) return
      life.dead = true
      for (const fn of life.fns.splice(0)) {
        try {
          fn()
        } catch {
          // already gone
        }
      }
    }
    HP.cutOff = (e) => /extension context invalidated/i.test(String((e && (e.message || e)) || ""))
    /** Never settles: what an old copy waits for (it just stops, with no error). */
    HP.never = () => new Promise(() => {})
    const call = (fn) => {
      if (!HP.alive()) {
        HP.die()
        return HP.never()
      }
      try {
        return Promise.resolve(fn()).catch((e) => {
          if (HP.cutOff(e) || !HP.alive()) {
            HP.die()
            return HP.never()
          }
          throw e
        })
      } catch (e) {
        if (HP.cutOff(e) || !HP.alive()) {
          HP.die()
          return HP.never()
        }
        return Promise.reject(e)
      }
    }
    /** chrome.storage.local for the page scripts (an old copy stops instead of throwing). */
    HP.store = {
      get: (keys) => call(() => chrome.storage.local.get(keys)),
      set: (items) => call(() => chrome.storage.local.set(items)),
      remove: (keys) => call(() => chrome.storage.local.remove(keys)),
    }
    /** The address of one of the extension's files ("" in an old copy). */
    HP.url = (path) => {
      try {
        return HP.alive() ? chrome.runtime.getURL(path) : ""
      } catch {
        return ""
      }
    }
    const warn = (e) => {
      if (!HP.cutOff(e)) console.warn("[Homes.ph Publisher]", e)
    }
    /** Storage changes, for as long as this copy is alive. Returns the way to stop listening. */
    HP.onStorage = (fn) => {
      const listener = (changes, area) => {
        if (!HP.alive()) return HP.die()
        try {
          const r = fn(changes, area)
          if (r && typeof r.catch === "function") r.catch(warn)
        } catch (e) {
          warn(e)
        }
      }
      try {
        chrome.storage.onChanged.addListener(listener)
      } catch {
        // cut off already
      }
      return () => {
        try {
          chrome.storage.onChanged.removeListener(listener)
        } catch {
          // cut off
        }
      }
    }
    /** setInterval that stops when this copy is cut off. */
    HP.every = (ms, fn) => {
      const timer = setInterval(() => {
        if (!HP.alive()) {
          clearInterval(timer)
          return HP.die()
        }
        try {
          const r = fn()
          if (r && typeof r.catch === "function") r.catch(warn)
        } catch (e) {
          warn(e)
        }
      }, ms)
      HP.onDead(() => clearInterval(timer))
      return timer
    }
    if (typeof window !== "undefined" && typeof document !== "undefined" && typeof window.addEventListener === "function") {
      // Whatever an old copy still throws isn't an error to show: the page's new copy does the work.
      window.addEventListener("unhandledrejection", (e) => {
        if (HP.cutOff(e.reason)) {
          e.preventDefault()
          HP.die()
        }
      })
      window.addEventListener("error", (e) => {
        if (HP.cutOff(e.error || e.message)) {
          e.preventDefault()
          HP.die()
        }
      })
    }
  }

  /** A message to the background (its answer, or { error }). An old copy of the page scripts gets no answer. */
  HP.send = (msg) => {
    if (!HP.alive()) {
      HP.die()
      return HP.never()
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          let err = null
          try {
            err = chrome.runtime.lastError
          } catch (e) {
            err = e
          }
          if (err && HP.cutOff(err)) return HP.die()
          resolve(err ? { error: err.message } : res || {})
        })
      } catch (e) {
        if (HP.cutOff(e) || !HP.alive()) return HP.die()
        resolve({ error: e.message })
      }
    })
  }

  HP.sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  /** Waits until `find()` returns something (checking every `every` ms, at most `timeout` ms); null when it never does. */
  HP.waitFor = async function (find, timeout = 15000, every = 200) {
    const end = Date.now() + timeout
    for (;;) {
      let found = null
      try {
        found = await find()
      } catch {
        found = null
      }
      if (found) return found
      if (Date.now() > end) return null
      await HP.sleep(every)
    }
  }

  /** Types into an input or textarea the way a person does (React and other frameworks see the change). */
  HP.setValue = function (el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : typeof HTMLSelectElement !== "undefined" && el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set
    el.focus()
    setter.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.blur()
  }

  /** Puts files in a file box (as if they were chosen). */
  HP.setFiles = function (input, files) {
    const dt = new DataTransfer()
    for (const f of files) dt.items.add(f)
    input.files = dt.files
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }

  HP.visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)

  /** A button (or link-button) by its words. */
  HP.buttonByText = function (root, re, filter) {
    return [...root.querySelectorAll("button, [role='button']")].find((b) => re.test(text(b)) && HP.visible(b) && (!filter || filter(b))) || null
  }

  HP.base64ToBlob = function (base64, type) {
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type })
  }

  HP.blobToBase64 = async function (blob) {
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ""
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
    return btoa(s)
  }
})()
