/**
 * The article in a web page (Poster Maker → Write from article → link): its title, site,
 * publication date and text. No HTML parser needed: the article's structured data
 * (JSON-LD articleBody, which most news sites publish) is used first, otherwise the
 * paragraphs of the page's <article> (or <main>, or the whole page).
 */

export interface ExtractedArticle {
  title: string
  /** "Philippine Daily Inquirer" or the host name. */
  site: string
  /** As the page gives it (e.g. 2026-11-06T08:00:00+08:00), or "". */
  published: string
  description: string
  text: string
}

/** The longest text kept (the AI reads the first part of longer ones). */
export const ARTICLE_TEXT_MAX = 30_000

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  eacute: "é",
  ntilde: "ñ",
  Ntilde: "Ñ",
  deg: "°",
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole
    }
    return NAMED[code] ?? NAMED[code.toLowerCase()] ?? whole
  })
}

const clean = (text: string) =>
  decodeEntities(text.replace(/<[^>]*>/g, " "))
    .replace(/[​­]/g, "")
    .replace(/\s+/g, " ")
    .trim()

/** <meta property|name="key" content="…"> in either attribute order. */
function meta(html: string, key: string): string {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const a = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i").exec(html)
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${k}["']`, "i").exec(html)
  return clean((a ?? b)?.[1] ?? "")
}

interface LdArticle {
  body: string
  headline: string
  published: string
}

const ARTICLE_TYPES = /^(NewsArticle|Article|BlogPosting|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle|WebPage|LiveBlogPosting|Report|PressRelease)$/

/** The article in the page's JSON-LD (schema.org), if it has its text. */
function jsonLdArticle(html: string): LdArticle | null {
  let best: LdArticle | null = null
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) return node.forEach(visit)
    const o = node as Record<string, unknown>
    const types = ([] as unknown[]).concat(o["@type"] ?? [])
    if (types.some((t) => typeof t === "string" && ARTICLE_TYPES.test(t)) && typeof o.articleBody === "string") {
      const body = clean(o.articleBody)
      if (!best || body.length > best.body.length) {
        best = { body, headline: typeof o.headline === "string" ? clean(o.headline) : "", published: typeof o.datePublished === "string" ? o.datePublished : "" }
      }
    }
    for (const value of Object.values(o)) if (value && typeof value === "object") visit(value)
  }
  for (const [, json] of scripts) {
    try {
      visit(JSON.parse(json.trim()))
    } catch {
      // not valid JSON: skip it
    }
  }
  return best
}

/** Lines that are page furniture, not the story. */
const BOILERPLATE =
  /^(advertisement|sponsored|read more|related( stories| articles)?|share( this)?|follow us|subscribe|sign up|newsletter|cookie|we use cookies|all rights reserved|copyright|©|click here|tags?:|photo:|image:|also read|recommended|trending|most read|loading)/i

/** The page without scripts, styles and the parts around the story. */
function strip(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|form|button|select|figure|figcaption|picture|video|audio)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ")
}

/** The biggest block of a tag (<article>, <main>) by its paragraph text. */
function biggest(html: string, tag: string): string | null {
  let best: string | null = null
  let bestLength = 0
  for (const [inner] of html.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"))) {
    const length = paragraphs(inner).join(" ").length
    if (length > bestLength) {
      best = inner
      bestLength = length
    }
  }
  return best
}

/** The text of the paragraphs (and sub-headings and list items) in a piece of HTML. */
function paragraphs(html: string): string[] {
  const out: string[] = []
  for (const [, tag, inner] of html.matchAll(/<(p|h2|h3|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = clean(inner)
    const min = tag.toLowerCase() === "p" || tag.toLowerCase() === "blockquote" ? 40 : 20
    if (text.length < min || BOILERPLATE.test(text)) continue
    if (out[out.length - 1] !== text) out.push(text)
  }
  return out
}

/** " | Inquirer.net", " - Rappler": the site name some pages add to their title. */
function withoutSiteSuffix(title: string, site: string): string {
  const parts = title.split(/\s+[|–—-]\s+/)
  if (parts.length < 2) return title
  // Compared on letters and digits only ("Gulf News" matches gulfnews.com).
  const bare = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "")
  const last = bare(parts[parts.length - 1])
  const name = bare(site.split(".")[0] ?? "")
  return last && site && (bare(site).includes(last) || last.includes(name)) ? parts.slice(0, -1).join(" - ") : title
}

export function extractArticle(html: string, pageUrl?: string): ExtractedArticle {
  let host = ""
  try {
    host = pageUrl ? new URL(pageUrl).hostname.replace(/^www\./, "") : ""
  } catch {
    host = ""
  }
  const site = meta(html, "og:site_name") || meta(html, "application-name") || host
  const ld = jsonLdArticle(html)
  const rawTitle = meta(html, "og:title") || meta(html, "twitter:title") || ld?.headline || clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "") || clean(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "")
  const title = withoutSiteSuffix(rawTitle, site)
  const description = meta(html, "og:description") || meta(html, "description") || meta(html, "twitter:description")
  const published =
    meta(html, "article:published_time") || ld?.published || meta(html, "datePublished") || /<time[^>]+datetime=["']([^"']+)["']/i.exec(html)?.[1] || ""

  let text = ld && ld.body.length >= 200 ? ld.body : ""
  if (!text) {
    const body = strip(html)
    const scope = biggest(body, "article") ?? biggest(body, "main") ?? body
    text = paragraphs(scope).join("\n\n")
    // Some pages keep the story outside <article>: use the whole page when that has more.
    if (scope !== body && text.length < 400) {
      const all = paragraphs(body).join("\n\n")
      if (all.length > text.length) text = all
    }
  }
  if (text.length < 200 && description && !text.includes(description)) text = [description, text].filter(Boolean).join("\n\n")
  if (text.length > ARTICLE_TEXT_MAX) text = `${text.slice(0, ARTICLE_TEXT_MAX)}…`
  return { title, site, published, description, text }
}

/** The article as the AI reads it: the title, where and when it was published, then the text. */
export function articleForAi(a: Pick<ExtractedArticle, "title" | "site" | "published" | "text">): string {
  const date = a.published ? a.published.slice(0, 10) : ""
  return [a.title, [a.site && `Source: ${a.site}`, date && `Published: ${date}`].filter(Boolean).join(" · "), "", a.text].filter((line, i) => line || i === 2).join("\n").trim()
}

/** True when the pasted text is just a web link (then it's read from the website). */
export function isLink(text: string): boolean {
  const t = text.trim()
  return /^https?:\/\/\S+$/i.test(t) && t.length < 2000
}
