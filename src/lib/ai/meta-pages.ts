import "server-only"

import { publishedDay, type TavilyResult } from "./tavily"

/**
 * Trending news → Facebook Pages (optional): the recent posts of the Pages the person lists, read with
 * their own Meta access token through the official Graph API. A token reads only what Meta allows it:
 * the Pages the person manages (Page access token, or a user token with pages_read_engagement), or any
 * public Page when their app has Meta's "Page Public Content Access". Nothing is scraped, and a Page
 * the token may not read comes back as a plain-words error.
 */

const GRAPH = "https://graph.facebook.com/v27.0"

/** Meta access tokens start with "EA" (letters and numbers only). Checked before one is sent anywhere. */
export const META_TOKEN_PATTERN = /^EA[A-Za-z0-9]{20,1000}$/

/** At most this many Pages are read per search (each is one Graph API call). */
export const MAX_PAGES = 10

const NOT_PAGES = /^(people|groups|events|watch|share|story\.php|permalink\.php|photo|photo\.php|photos|reel|reels|videos|marketplace|hashtag|search|login|home\.php)$/i

/**
 * What the person typed → the Page's ID or username for the Graph API: "facebook.com/CamellaHomes",
 * "https://www.facebook.com/profile.php?id=1000123", "@pickleplayph" or "123456789". null when it
 * isn't a Page (a group, an event, a post link…).
 */
export function pageRef(input: string): string | null {
  let t = input.trim()
  const link = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)?(?:facebook|fb)\.com\/(.+)$/i.exec(t)
  if (link) {
    const rest = link[1]
    const id = /^profile\.php\?(?:.*&)?id=(\d{5,25})/i.exec(rest)?.[1]
    if (id) return id
    const old = /^pages\/[^/]+\/(\d{5,25})/i.exec(rest)?.[1]
    if (old) return old
    t = rest.split(/[/?#]/)[0]
    if (NOT_PAGES.test(t)) return null
  }
  t = t.replace(/^@/, "")
  return /^[A-Za-z0-9.]{2,100}$/.test(t) && !/^\.|\.$/.test(t) ? t : null
}

/** The Graph API's error answers in plain words (`page`: the Page it was reading, if any). */
export function metaError(error: { code?: unknown; message?: unknown } | undefined, page = ""): string {
  const code = typeof error?.code === "number" ? error.code : 0
  const message = typeof error?.message === "string" ? error.message.slice(0, 200) : ""
  const which = page ? ` ${page}` : " the Page"
  if (code === 190) return "The Facebook access token expired or was rejected. Make a new one and save it in Settings → AI."
  if (code === 4 || code === 17 || code === 32 || code === 613) return "Facebook's limit for reading Pages was reached. Try again later."
  if (code === 10 || (code >= 200 && code < 300))
    return `Facebook didn't allow reading${which}: a token reads only the Pages you manage (other Pages need Meta's Page Public Content Access approval).`
  if (code === 100 && /does not exist|missing permissions|unsupported get request/i.test(message)) return `Couldn't read${which}: the Page wasn't found, or your token may not read it.`
  return message ? `Facebook${page ? ` (${page})` : ""}: ${message}` : `Facebook couldn't read${which}.`
}

/** "2026-11-09T03:15:00+0000" → "2026-11-09" (the UTC day, like the other searches). */
const postDay = (value: unknown) => (typeof value === "string" ? publishedDay(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")) : null)

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** One post → a result for the AI (posts without words are left out). */
export function pagePost(post: Record<string, unknown>, page: string): TavilyResult | null {
  const message = typeof post.message === "string" ? post.message.replace(/\r\n?/g, "\n").trim() : ""
  if (message.length < 20) return null
  const id = typeof post.id === "string" ? post.id : ""
  const permalink = typeof post.permalink_url === "string" && /^https:\/\//i.test(post.permalink_url) ? post.permalink_url : id ? `https://www.facebook.com/${id}` : ""
  if (!permalink) return null
  const from = post.from && typeof post.from === "object" && typeof (post.from as { name?: unknown }).name === "string" ? ((post.from as { name: string }).name).slice(0, 100) : page
  const first = message.split("\n").find((l) => l.trim())?.trim() ?? message
  const image = typeof post.full_picture === "string" && /^https:\/\//i.test(post.full_picture) ? post.full_picture.slice(0, 1000) : ""
  return {
    title: first.length > 140 ? `${first.slice(0, 139).replace(/\s+\S*$/, "")}…` : first,
    url: permalink.slice(0, 500),
    content: message.replace(/\s+/g, " ").slice(0, 1500),
    published: postDay(post.created_time),
    kind: "page",
    from,
    ...(image ? { image } : {}),
  }
}

async function graph(path: string, params: Record<string, string>, token: string, signal: AbortSignal): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: { code?: unknown; message?: unknown } | undefined; network?: boolean }> {
  let res: Response
  try {
    res = await fetch(`${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: token })}`, { signal })
  } catch {
    return { ok: false, error: { message: signal.aborted ? "Facebook took too long to answer." : "Couldn't reach Facebook. Check your connection." }, network: true }
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { code?: unknown; message?: unknown } }
  return res.ok && !body.error ? { ok: true, body } : { ok: false, error: body.error ?? { message: `Facebook answered ${res.status}.` } }
}

/**
 * The posts of each listed Page (at most 10 Pages) published in the window (one day of slack before
 * it, like the news). Pages the token may not read come back in `errors`; the rest still count.
 */
export async function readPagePosts(token: string, pages: string[], day: string, days: number, signal: AbortSignal): Promise<{ results: TavilyResult[]; errors: string[]; read: number }> {
  const refs = [...new Set(pages.map(pageRef).filter((r): r is string => !!r))].slice(0, MAX_PAGES)
  const since = Math.floor(Date.parse(`${addDays(day, -days)}T00:00:00Z`) / 1000)
  const until = Math.floor(Date.parse(`${addDays(day, 1)}T00:00:00Z`) / 1000)
  const errors: string[] = []
  let read = 0
  const lists = await Promise.all(
    refs.map(async (ref) => {
      const r = await graph(`${encodeURIComponent(ref)}/posts`, { fields: "id,message,created_time,permalink_url,full_picture,from{name}", since: String(since), until: String(until), limit: "25" }, token.trim(), signal)
      if (!r.ok) {
        const text = metaError(r.error, ref)
        if (!errors.includes(text)) errors.push(text)
        return []
      }
      read++
      const data = Array.isArray(r.body.data) ? (r.body.data as Record<string, unknown>[]) : []
      return data.map((p) => pagePost(p, ref)).filter((p): p is TavilyResult => !!p)
    }),
  )
  const seen = new Set<string>()
  const results = lists.flat().filter((p) => !seen.has(p.url) && (seen.add(p.url), true))
  return { results: results.slice(0, 30), errors, read }
}

/** Settings → Test: who the token is and the Pages it manages (no posts are read). */
export async function checkMetaToken(token: string, signal: AbortSignal): Promise<string> {
  const me = await graph("me", { fields: "id,name" }, token.trim(), signal)
  if (!me.ok) throw new Error(metaError(me.error))
  const name = typeof me.body.name === "string" ? me.body.name : "your account"
  // A user token lists the Pages its person manages; a Page token is the Page itself (this call fails then).
  const accounts = await graph("me/accounts", { fields: "name", limit: "25" }, token.trim(), signal)
  const managed = accounts.ok && Array.isArray(accounts.body.data) ? (accounts.body.data as { name?: unknown }[]).flatMap((p) => (typeof p.name === "string" ? [p.name] : [])) : []
  return managed.length ? `Works: ${name} · Pages you manage: ${managed.slice(0, 6).join(", ")}${managed.length > 6 ? "…" : ""}` : `Works: ${name}`
}
