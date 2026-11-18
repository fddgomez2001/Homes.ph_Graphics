// The Homes.ph Publisher Chrome extension's way into the app: a small HTTP server on 127.0.0.1 that only a
// browser extension may use (Origin chrome-extension://…, Host 127.0.0.1:<port>, so no website and no DNS
// rebinding), with a token the person allows once in the app ("Connect the Chrome extension?").
const crypto = require("node:crypto")
const fs = require("node:fs")
const http = require("node:http")

const BRIDGE_PORTS = [39390, 39391, 39392, 39393, 39394]
const MAX_BODY = 20 * 1024 * 1024
// The News Article rows the extension can ask for: the daily brands, and the other Homes.ph pages (1.50).
const HOMES_LANES = ["main", "ozamiz", "dumaguete", "bgc-taguig", "cebu", "pampanga", "cavite", "iloilo", "bacolod", "davao", "palawan", "bohol", "makati", "cdo", "leyte"]
const BRANDS = new Set(["fhi", "pickleplay", "caraga", "gensan", ...HOMES_LANES.map((k) => `homes:${k}`)])
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function loadClients(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"))
    return Array.isArray(data.clients) ? data.clients.filter((c) => c && typeof c.token === "string" && typeof c.origin === "string") : []
  } catch {
    return []
  }
}

function saveClients(file, clients) {
  fs.writeFileSync(file, JSON.stringify({ clients }, null, 2), { mode: 0o600 })
}

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/

/**
 * Only a browser extension, at this exact address. Returns the problem, or null. A GET without an Origin
 * is allowed (Chrome leaves it out of an extension's GET); a website's request always names its own origin.
 */
function checkRequest(headers, port, method = "POST") {
  const host = String(headers.host || "").toLowerCase()
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return "Wrong address"
  const origin = headers.origin === undefined ? "" : String(headers.origin)
  if (!origin && method === "GET") return null
  if (!EXTENSION_ORIGIN.test(origin)) return "Only the Homes.ph Publisher extension may connect"
  return null
}

function tokenOf(headers) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(String(headers.authorization || ""))
  return m ? m[1] : null
}

function sameToken(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/** The allowed extension making this request (its token, from its own origin when the request names one), or null. */
function clientOf(clients, headers) {
  const token = tokenOf(headers)
  const origin = headers.origin === undefined ? "" : String(headers.origin)
  return token ? clients.find((c) => (!origin || c.origin === origin) && sameToken(c.token, token)) || null : null
}

const str = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "")

/** A News Article request from the extension, checked: { brand, day, time, headline, articleUrl, image? } or an error. */
function newsPostInput(body) {
  if (!body || typeof body !== "object") return { error: "Nothing was sent." }
  const brand = String(body.brand || "")
  if (!BRANDS.has(brand)) return { error: "Unknown brand." }
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(body.day || "")) ? body.day : ""
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.time || "")) ? body.time : ""
  if (!day || !time) return { error: "The posting day and time are missing." }
  const headline = str(body.headline, 300)
  if (!headline) return { error: "The headline is missing." }
  const articleUrl = /^https:\/\/[^\s]+$/.test(String(body.articleUrl || "")) ? String(body.articleUrl).slice(0, 500) : ""
  let image = null
  if (body.image) {
    const type = String(body.image.type || "")
    const base64 = typeof body.image.base64 === "string" ? body.image.base64 : ""
    if (!IMAGE_TYPES.has(type) || !/^[A-Za-z0-9+/=]+$/.test(base64.slice(0, 2000)) || base64.length > 18 * 1024 * 1024) return { error: "The picture isn't a JPG, PNG or WebP." }
    image = { type, base64, name: str(body.image.name, 120).replace(/[\\/:*?"<>|]/g, " ") || "article.jpg" }
  }
  return { value: { brand, day, time, headline, articleUrl, ...(image ? { image } : {}) } }
}

/** A "published" note from the extension: the News Article post and how its Facebook post went. */
function newsStatusInput(body) {
  const base = newsPostInput({ ...body, image: undefined })
  if (base.error) return base
  const facebook = body.facebook === "posted" || body.facebook === "scheduled" ? body.facebook : null
  const projectId = typeof body.projectId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.projectId) ? body.projectId : null
  return { value: { ...base.value, facebook, projectId } }
}

const PROJECT_ID = /^[A-Za-z0-9-]{8,64}$/
const PAGE_KEY = /^[A-Za-z0-9_.-]{1,64}$/

/** The carousels of a day: { day }. */
function carouselDayInput(body) {
  const day = body && /^\d{4}-\d{2}-\d{2}$/.test(String(body.day || "")) ? body.day : ""
  return day ? { value: { day } } : { error: "The day is missing." }
}

/** A carousel's slides as PNGs: { projectId, save }. */
function carouselImagesInput(body) {
  const projectId = body && PROJECT_ID.test(String(body.projectId || "")) ? body.projectId : ""
  return projectId ? { value: { projectId, save: body.save !== false } } : { error: "Which carousel?" }
}

/** The pages a carousel's Facebook post went to: { projectId, pageKeys, facebook }. */
function carouselPostedInput(body) {
  const projectId = body && PROJECT_ID.test(String(body.projectId || "")) ? body.projectId : ""
  if (!projectId) return { error: "Which carousel?" }
  const pageKeys = Array.isArray(body.pageKeys) ? [...new Set(body.pageKeys.map(String).filter((k) => PAGE_KEY.test(k)))].slice(0, 40) : []
  if (!pageKeys.length) return { error: "Which pages?" }
  const facebook = body.facebook === "posted" || body.facebook === "scheduled" ? body.facebook : null
  return { value: { projectId, pageKeys, facebook } }
}

const CAROUSEL_ROUTES = {
  "/v1/carousel-day": ["carousel-day", carouselDayInput],
  "/v1/carousel-images": ["carousel-images", carouselImagesInput],
  "/v1/carousel-posted": ["carousel-posted", carouselPostedInput],
}

/** An advertisement's or a poster's id (the app's own ids: letters, digits and "-"). */
const ITEM_ID = /^[A-Za-z0-9-]{8,64}$/
const itemId = (body, key) => (body && typeof body[key] === "string" && ITEM_ID.test(body[key]) ? body[key] : "")
const MAX_TREND_TEXTS = 30

/** A real calendar day "yyyy-MM-dd": { day }. */
function realDayInput(body) {
  const day = body && typeof body.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : ""
  if (!day) return { error: "The day is missing." }
  const [y, m, d] = day.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (y < 2000 || y > 2100 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return { error: "That day doesn't exist." }
  return { value: { day } }
}

/** The advertisements of a day: { day }. */
function adsDayInput(body) {
  return realDayInput(body)
}

/** An advertisement as a PNG: { id, save }. */
function adImageInput(body) {
  const id = itemId(body, "id")
  return id ? { value: { id, save: body.save !== false } } : { error: "Which advertisement?" }
}

/** An advertisement's Facebook post was scheduled or posted: { id, facebook }. */
function adPostedInput(body) {
  const id = itemId(body, "id")
  if (!id) return { error: "Which advertisement?" }
  const facebook = body.facebook === "posted" || body.facebook === "scheduled" ? body.facebook : null
  return facebook ? { value: { id, facebook } } : { error: "Was it scheduled or posted?" }
}

/** The Daily Trend News posters of a day: { day }. */
function trendsDayInput(body) {
  return realDayInput(body)
}

/** A trend poster as a PNG: { id, save }. */
function trendImageInput(body) {
  const id = itemId(body, "id")
  return id ? { value: { id, save: body.save !== false } } : { error: "Which poster?" }
}

/** The Daily Trend News texts of some posters: { ids } (30 at most). */
function trendTextsInput(body) {
  if (!body || !Array.isArray(body.ids)) return { error: "Which posters?" }
  if (body.ids.length > MAX_TREND_TEXTS) return { error: `${MAX_TREND_TEXTS} posters at most.` }
  const ids = [...new Set(body.ids.filter((id) => typeof id === "string" && ITEM_ID.test(id)))]
  return ids.length ? { value: { ids } } : { error: "Which posters?" }
}

const AD_ROUTES = {
  "/v1/ads-day": ["ads-day", adsDayInput],
  "/v1/ad-image": ["ad-image", adImageInput],
  "/v1/ad-posted": ["ad-posted", adPostedInput],
}

const TREND_ROUTES = {
  "/v1/trends-day": ["trends-day", trendsDayInput],
  "/v1/trend-image": ["trend-image", trendImageInput],
  "/v1/trend-texts": ["trend-texts", trendTextsInput],
}

/** Every POST route answered by the app's window: path → [request type, input check]. */
const ROUTES = { ...CAROUSEL_ROUTES, ...AD_ROUTES, ...TREND_ROUTES }

/**
 * Starts the server on the first free port. `forward(type, payload)` runs a request in the app's window;
 * `askToPair({ name, browser })` asks the person and resolves true to allow.
 */
function startBridge({ file, version, forward, askToPair, assignment = () => null, log = () => {} }) {
  let clients = loadClients(file)
  let pairing = null
  let port = null

  const send = (res, status, body, origin) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    })
    res.end(JSON.stringify(body))
  }

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let size = 0
      const chunks = []
      req.on("data", (c) => {
        size += c.length
        if (size > MAX_BODY) {
          reject(new Error("Too big"))
          req.destroy()
        } else chunks.push(c)
      })
      req.on("end", () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {})
        } catch {
          reject(new Error("Not JSON"))
        }
      })
      req.on("error", reject)
    })

  const server = http.createServer(async (req, res) => {
    const problem = checkRequest(req.headers, port, req.method)
    if (problem) return send(res, 403, { error: problem })
    const origin = req.headers.origin ? String(req.headers.origin) : ""
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST", Vary: "Origin" })
      return res.end()
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    const client = clientOf(clients, req.headers)
    // Only the check-in may come without an Origin.
    if (!origin && !(req.method === "GET" && url.pathname === "/v1/ping")) return send(res, 403, { error: "Only the Homes.ph Publisher extension may connect" })
    try {
      // "app" stays the name extensions up to 1.1.2 look for; "name" is the one to show.
      if (req.method === "GET" && url.pathname === "/v1/ping") return send(res, 200, { app: "Daily Carousel Maker", name: "Homes.ph SocMedSystem", version, paired: !!client }, origin)

      if (req.method === "POST" && url.pathname === "/v1/pair") {
        if (pairing) return send(res, 409, { error: "Homes.ph SocMedSystem is already asking. Answer it first." }, origin)
        const body = await readBody(req)
        const name = str(body.name, 60) || "Chrome extension"
        const browser = str(body.browser, 20) || "Chrome"
        pairing = Promise.resolve(askToPair({ name, browser }))
        let allowed = false
        try {
          allowed = await pairing
        } finally {
          pairing = null
        }
        if (!allowed) return send(res, 403, { error: "Not allowed in Homes.ph SocMedSystem." }, origin)
        const token = crypto.randomBytes(32).toString("base64url")
        clients = [...clients.filter((c) => c.origin !== origin), { origin, token, name, browser, at: new Date().toISOString() }]
        saveClients(file, clients)
        log(`[extension] connected ${name} (${browser}) ${origin}`)
        return send(res, 200, { token }, origin)
      }

      if (!client) return send(res, 401, { error: "Connect the extension to Homes.ph SocMedSystem first (Options → Connect)." }, origin)

      // The pages this person is assigned (null: not chosen yet).
      if (url.pathname === "/v1/assignment") return send(res, 200, { pages: assignment() }, origin)

      if (req.method === "POST" && (url.pathname === "/v1/news-post" || url.pathname === "/v1/news-status")) {
        const body = await readBody(req)
        const checked = url.pathname === "/v1/news-post" ? newsPostInput(body) : newsStatusInput(body)
        if (checked.error) return send(res, 400, { error: checked.error }, origin)
        const result = await forward(url.pathname === "/v1/news-post" ? "news-post" : "news-status", checked.value)
        client.lastUsed = new Date().toISOString()
        return send(res, 200, result || {}, origin)
      }
      if (req.method === "POST" && Object.hasOwn(ROUTES, url.pathname)) {
        const [type, check] = ROUTES[url.pathname]
        const checked = check(await readBody(req))
        if (checked.error) return send(res, 400, { error: checked.error }, origin)
        const result = await forward(type, checked.value)
        client.lastUsed = new Date().toISOString()
        return send(res, 200, result || {}, origin)
      }
      return send(res, 404, { error: "Not found" }, origin)
    } catch (e) {
      log(`[extension] ${url.pathname}: ${e && e.message}`)
      return send(res, 500, { error: e && e.message ? e.message : "Something went wrong." }, origin)
    }
  })

  const tryPort = (i) =>
    new Promise((resolve) => {
      if (i >= BRIDGE_PORTS.length) return resolve(null)
      const onError = () => {
        server.removeListener("listening", onListening)
        resolve(tryPort(i + 1))
      }
      const onListening = () => {
        server.removeListener("error", onError)
        port = BRIDGE_PORTS[i]
        resolve(port)
      }
      server.once("error", onError)
      server.once("listening", onListening)
      server.listen(BRIDGE_PORTS[i], "127.0.0.1")
    })

  const ready = tryPort(0)
  return {
    ready,
    get port() {
      return port
    },
    clients: () => clients.map(({ token: _t, ...c }) => c),
    forgetAll() {
      clients = []
      saveClients(file, clients)
    },
    close: () => server.close(),
  }
}

module.exports = {
  BRIDGE_PORTS,
  ROUTES,
  startBridge,
  checkRequest,
  clientOf,
  newsPostInput,
  newsStatusInput,
  carouselDayInput,
  carouselImagesInput,
  carouselPostedInput,
  adsDayInput,
  adImageInput,
  adPostedInput,
  trendsDayInput,
  trendImageInput,
  trendTextsInput,
  loadClients,
}
