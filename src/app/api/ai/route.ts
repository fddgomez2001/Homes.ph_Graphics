import { NextResponse } from "next/server"
import { AiError, generate } from "@/lib/ai/groq"
import type { AiResponse } from "@/lib/ai/types"
import { parseAiRequest } from "@/lib/ai/validate"
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
 * Writing suggestions (card description, cover subtitle, post caption) for
 * signed-in users. The Groq key stays on the server; only the three fixed
 * tasks are accepted, with size limits and a per-user rate limit.
 */
export async function POST(request: Request) {
  const { user } = await getRequestUser()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was incomplete." }, { status: 400 })
  }
  const req = parseAiRequest(body)
  if (typeof req === "string") return NextResponse.json({ error: req }, { status: 400 })

  const tooMany = limited(user.id)
  if (tooMany) return NextResponse.json({ error: tooMany }, { status: 429 })

  try {
    return NextResponse.json({ text: await generate(req) } satisfies AiResponse)
  } catch (e) {
    const status = e instanceof AiError ? e.status : 502
    return NextResponse.json({ error: e instanceof Error ? e.message : "The AI didn't answer." }, { status })
  }
}
