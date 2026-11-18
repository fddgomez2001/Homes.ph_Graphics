import { NextResponse } from "next/server"
import { AiError, generate } from "@/lib/ai/groq"
import { SEARCH_AI_TASKS, type AiErrorBody, type AiResponse } from "@/lib/ai/types"
import { parseAiProvider, parseAiRequest, parseSearchSetup } from "@/lib/ai/validate"
import { getRequestUser } from "@/lib/supabase/server"

const perMinute = new Map<string, number[]>()
const perDay = new Map<string, number[]>()

function limited(userId: string) {
  const now = Date.now()
  const minute = (perMinute.get(userId) ?? []).filter((t) => now - t < 60_000)
  const day = (perDay.get(userId) ?? []).filter((t) => now - t < 86_400_000)
  if (minute.length >= 20) return "Too many AI requests in a minute. Please wait a moment."
  if (day.length >= 400) return "The daily AI limit for this app was reached. Please try again tomorrow."
  perMinute.set(userId, [...minute, now])
  perDay.set(userId, [...day, now])
  return null
}

/**
 * Writing suggestions (card description, cover subtitle, post caption, poster
 * headlines) for signed-in users. The Groq key stays on the server; only the fixed
 * tasks are accepted, with size limits and a per-user rate limit. Poster Maker tasks
 * may carry the user's own key (Settings → Poster Maker AI) in request headers, and web
 * searches the user's own Tavily key; they are used for that one request and never stored or
 * logged here.
 */
export async function POST(request: Request) {
  const { user } = await getRequestUser({ duringSetup: true })
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was incomplete." }, { status: 400 })
  }
  const req = parseAiRequest(body)
  if (typeof req === "string") return NextResponse.json({ error: req }, { status: 400 })

  // The person's own AI (any task). The desktop app has no built-in AI key: it must be set up first.
  const own = parseAiProvider(request.headers)
  if (typeof own === "string") return NextResponse.json({ error: own, own: true } satisfies AiErrorBody, { status: 400 })

  // Web searches: the engine chosen in Settings → AI and the saved keys that can search (Tavily,
  // Perplexity, Groq, Gemini); the app's own keys, if it has any, come after them.
  const search = SEARCH_AI_TASKS.includes(req.task) ? parseSearchSetup(request.headers) : null

  const tooMany = limited(user.id)
  if (tooMany) return NextResponse.json({ error: tooMany }, { status: 429 })

  try {
    return NextResponse.json((await generate(req, own, search)) satisfies AiResponse)
  } catch (e) {
    const status = e instanceof AiError ? e.status : 502
    const body: AiErrorBody = { error: e instanceof Error ? e.message : "The AI didn't answer.", ...(e instanceof AiError && e.own ? { own: true } : {}) }
    return NextResponse.json(body, { status })
  }
}
