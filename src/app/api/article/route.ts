import { NextResponse } from "next/server"
import { extractArticle, type ExtractedArticle } from "@/lib/ai/article-extract"
import { RemoteImageError } from "@/lib/remote-image"
import { downloadWebPage } from "@/lib/remote-page"
import { getRequestUser } from "@/lib/supabase/server"

const recent = new Map<string, number[]>()

export interface ArticleResponse extends ExtractedArticle {
  /** Where the page ended up after redirects. */
  url: string
}

/**
 * Poster Maker → Write from article → a link: downloads the page and returns the
 * article in it (title, site, date, text) for the AI. Signed-in users only, rate
 * limited, public internet only (see downloadWebPage). Nothing is stored.
 */
export async function POST(request: Request) {
  const { user } = await getRequestUser()
  if (!user) return error(401, "Please sign in again.")

  const now = Date.now()
  const hits = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= 20) return error(429, "Too many links in a minute. Please wait a moment.")
  recent.set(user.id, [...hits, now])

  let url = ""
  try {
    const body = (await request.json()) as { url?: unknown }
    url = typeof body.url === "string" ? body.url.trim() : ""
  } catch {
    // handled below
  }
  if (!url || url.length > 2000) return error(400, "Paste the article's link first.")
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`

  try {
    const page = await downloadWebPage(url)
    const article = extractArticle(page.html, page.url)
    if (article.text.length < 120) {
      return error(422, "Couldn't find the article text on that page (it may load with JavaScript or need a sign-in). Copy the article and paste it instead.")
    }
    return NextResponse.json({ ...article, url: page.url } satisfies ArticleResponse, { headers: { "cache-control": "no-store" } })
  } catch (e) {
    if (e instanceof RemoteImageError) return error(e.status, e.message)
    return error(502, "Couldn't read that page.")
  }
}

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}
