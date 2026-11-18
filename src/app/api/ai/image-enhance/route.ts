import { NextResponse } from "next/server"
import { AI_HEADERS } from "@/lib/ai/types"
import { getRequestUser } from "@/lib/supabase/server"

/**
 * Editor → Picture tools → AI Enhance (1.54): the picture made sharper, cleaner and better lit by an image AI,
 * with the person's own key (Gemini's image model, or OpenAI's gpt-image-1), nothing added or changed. The key
 * comes in a header, is used for this one request, and is never stored or logged here.
 *
 * In: { image: base64, mime: "image/jpeg" | "image/png" | "image/webp", prompt? }  Out: { image: base64, mime, model }
 */

const PROMPT =
  "Enhance this photo like a professional photo retoucher: make it sharper and more detailed, remove noise, blur and compression artifacts, improve the exposure and lighting, and make the colors natural and vivid. Keep everything exactly the same: the same people and faces, poses, clothes, hair, background, text, logos, composition and framing. Do not add, remove, move or restyle anything. Return only the enhanced photo, the same shape as the original."

/** Gemini's image models, newest first that a key may have (a missing one is skipped). */
const GEMINI_MODELS = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview", "gemini-3-pro-image-preview"]

export async function POST(request: Request) {
  const { user } = await getRequestUser()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  const provider = request.headers.get(AI_HEADERS.provider)?.trim() ?? ""
  const key = request.headers.get(AI_HEADERS.key)?.trim() ?? ""
  const body = (await request.json().catch(() => ({}))) as { image?: unknown; mime?: unknown; prompt?: unknown }
  const image = typeof body.image === "string" ? body.image : ""
  const mime = body.mime === "image/png" || body.mime === "image/webp" ? body.mime : "image/jpeg"
  if (!image || image.length > 25_000_000 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200))) return NextResponse.json({ error: "The picture is missing or too big." }, { status: 400 })
  if (!key) return NextResponse.json({ error: "AI Enhance uses your own Gemini or OpenAI key: add one in Settings → AI." }, { status: 400 })
  const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim().slice(0, 1500) : PROMPT
  try {
    if (provider === "gemini") return NextResponse.json(await gemini(key, image, mime, prompt))
    if (provider === "openai") return NextResponse.json(await openai(key, image, mime, prompt))
    return NextResponse.json({ error: "AI Enhance works with a Gemini or OpenAI key (Settings → AI)." }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The AI couldn't enhance the picture." }, { status: 502 })
  }
}

async function gemini(key: string, image: string, mime: string, prompt: string) {
  let last = ""
  for (const model of GEMINI_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
      signal: AbortSignal.timeout(110_000),
    })
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; status?: string }
      candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }[] }; finishReason?: string }[]
    }
    if (res.status === 404 || (res.status === 400 && /not found|not supported|unknown model/i.test(json.error?.message ?? ""))) {
      last = json.error?.message ?? `${model} isn't available`
      continue
    }
    if (res.status === 401 || res.status === 403) throw new Error("Gemini didn't accept the key (Settings → AI).")
    if (res.status === 429) throw new Error("Gemini's limit for pictures is reached on this key (its free plan may not include image editing). Try again later, or use a paid key.")
    if (!res.ok) throw new Error(json.error?.message || `Gemini answered ${res.status}.`)
    const parts = json.candidates?.[0]?.content?.parts ?? []
    for (const p of parts) {
      const data = p.inlineData?.data ?? p.inline_data?.data
      if (data) return { image: data, mime: p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? "image/png", model }
    }
    const said = parts.map((p) => p.text).filter(Boolean).join(" ").slice(0, 300)
    throw new Error(said ? `Gemini gave no picture: ${said}` : "Gemini gave no picture back. Try again.")
  }
  throw new Error(`No Gemini image model is available on this key (${last}).`)
}

async function openai(key: string, image: string, mime: string, prompt: string) {
  const form = new FormData()
  form.append("model", "gpt-image-1")
  form.append("image", new Blob([Buffer.from(image, "base64")], { type: mime }), mime === "image/png" ? "photo.png" : mime === "image/webp" ? "photo.webp" : "photo.jpg")
  form.append("prompt", prompt)
  form.append("quality", "high")
  form.append("size", "auto")
  form.append("input_fidelity", "high")
  const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(170_000) })
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string }; data?: { b64_json?: string }[] }
  if (res.status === 401) throw new Error("OpenAI didn't accept the key (Settings → AI).")
  if (!res.ok) throw new Error(json.error?.message || `OpenAI answered ${res.status}.`)
  const data = json.data?.[0]?.b64_json
  if (!data) throw new Error("OpenAI gave no picture back. Try again.")
  return { image: data, mime: "image/png", model: "gpt-image-1" }
}
