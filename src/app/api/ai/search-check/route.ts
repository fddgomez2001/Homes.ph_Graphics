import { NextResponse } from "next/server"
import { checkMetaToken, META_TOKEN_PATTERN } from "@/lib/ai/meta-pages"
import { AI_HEADERS, type SearchCheckResult } from "@/lib/ai/types"
import { SearchFailed, serpAccount, SERPAPI_KEY_PATTERN } from "@/lib/ai/web-search"
import { getRequestUser } from "@/lib/supabase/server"

/**
 * Settings → AI → Check & save / Test for the keys that aren't AIs: a SerpApi key (its searches left
 * this month; SerpApi's account call costs no search) or a Meta access token (who it is and the Pages it
 * manages; no posts are read). The key comes in a header, is used for this one request, and is never
 * stored or logged here.
 */
export async function POST(request: Request) {
  const { user } = await getRequestUser({ duringSetup: true })
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { service?: unknown }
  try {
    if (body.service === "serpapi") {
      const key = request.headers.get(AI_HEADERS.serpapi)?.trim() ?? ""
      if (!SERPAPI_KEY_PATTERN.test(key)) return NextResponse.json({ error: "That doesn't look like a SerpApi key (64 letters and numbers, from serpapi.com/manage-api-key)." }, { status: 400 })
      return NextResponse.json({ text: await serpAccount(key, AbortSignal.timeout(15_000)) } satisfies SearchCheckResult)
    }
    if (body.service === "meta") {
      const token = request.headers.get(AI_HEADERS.meta)?.trim() ?? ""
      if (!META_TOKEN_PATTERN.test(token)) return NextResponse.json({ error: "That doesn't look like a Meta access token (it starts with EA…)." }, { status: 400 })
      return NextResponse.json({ text: await checkMetaToken(token, AbortSignal.timeout(15_000)) } satisfies SearchCheckResult)
    }
    return NextResponse.json({ error: "Unknown service." }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn't check the key."
    return NextResponse.json({ error: message }, { status: e instanceof SearchFailed && e.status >= 500 ? 502 : 400 })
  }
}
