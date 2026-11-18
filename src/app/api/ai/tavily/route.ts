import { NextResponse } from "next/server"
import { isTavilyKey, TavilyError, tavilyUsage } from "@/lib/ai/tavily"
import { AI_HEADERS, type TavilyStatus } from "@/lib/ai/types"
import { getRequestUser } from "@/lib/supabase/server"

/**
 * Settings → Poster Maker AI → Web search: which Tavily key the searches use (the user's own,
 * sent in a header, or the app's) and, with `check`, its credits this month (costs no credit).
 * The key is used for this one request and never stored or logged here.
 */
export async function POST(request: Request) {
  const { user } = await getRequestUser({ duringSetup: true })
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { check?: unknown }
  const header = request.headers.get(AI_HEADERS.tavily)?.trim() ?? ""
  if (header && !isTavilyKey(header)) return NextResponse.json({ error: "That doesn't look like a Tavily key (it starts with tvly-)." }, { status: 400 })
  const builtIn = process.env.TAVILY_API_KEY?.trim() ?? ""
  const key = header || builtIn
  const status: TavilyStatus = { source: header ? "own" : builtIn ? "built-in" : "none" }
  if (!key || body.check !== true) return NextResponse.json(status)
  try {
    return NextResponse.json({ ...status, ...(await tavilyUsage(key, AbortSignal.timeout(15_000))) } satisfies TavilyStatus)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn't check the Tavily key."
    return NextResponse.json({ error: message }, { status: e instanceof TavilyError && e.status < 500 ? 400 : 502 })
  }
}
