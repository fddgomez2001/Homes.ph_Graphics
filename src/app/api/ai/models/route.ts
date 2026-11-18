import { NextResponse } from "next/server"
import { detectKey, ProviderError } from "@/lib/ai/providers"
import { AI_HEADERS, aiProvider, type AiModelsResponse, type AiProviderId } from "@/lib/ai/types"
import { getRequestUser } from "@/lib/supabase/server"

const recent = new Map<string, number[]>()

/**
 * Settings → Poster Maker AI → Check key: which service an API key belongs to (from its
 * format, confirmed by that service) and the chat models it can use, with the one we'd
 * pick. The key comes in a request header and is only sent to that service.
 */
export async function POST(request: Request) {
  const { user } = await getRequestUser({ duringSetup: true })
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  const now = Date.now()
  const hits = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= 10) return NextResponse.json({ error: "Too many key checks in a minute. Please wait a moment." }, { status: 429 })
  recent.set(user.id, [...hits, now])

  const key = request.headers.get(AI_HEADERS.key)?.trim() ?? ""
  if (key.length < 10 || key.length > 400 || /\s/.test(key)) return NextResponse.json({ error: "Paste the whole API key first." }, { status: 400 })
  let provider: AiProviderId | "auto" = "auto"
  try {
    const body = (await request.json().catch(() => ({}))) as { provider?: unknown }
    if (typeof body.provider === "string" && body.provider !== "auto") {
      const info = aiProvider(body.provider)
      if (!info) return NextResponse.json({ error: "Unknown AI provider." }, { status: 400 })
      provider = info.id
    }
  } catch {
    // automatic
  }

  try {
    const found = await detectKey(key, provider, AbortSignal.timeout(20_000))
    return NextResponse.json({ provider: found.provider, models: found.models.slice(0, 500), recommended: found.recommended } satisfies AiModelsResponse)
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 502
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't check the key." }, { status })
  }
}
