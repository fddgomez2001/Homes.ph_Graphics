import "server-only"

import type { AiRequest, CarouselText } from "./types"

/**
 * Writing suggestions with Groq (server-only: the API key never reaches the browser).
 * Prompts are short and fixed per task, answers are capped, and the reasoning
 * models run at low effort, so each suggestion costs a fraction of a cent.
 */

/** Overridable for proxies or local testing. */
const api = () => `${(process.env.GROQ_API_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/+$/, "")}/chat/completions`
/** Most accurate first; the next ones are used only if a model is unavailable. */
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message)
  }
}

export function groqConfigured() {
  return !!process.env.GROQ_API_KEY?.trim()
}

const RULES = `You write copy for Homes.ph, a Philippine real estate and lifestyle brand, for its Facebook carousel posts.
Rules:
- Use only facts, names, places, numbers and prices found in the input. Never invent or guess details.
- Clear, natural, formal English for Filipino readers. Write like a careful editor, not an ad.
- No emojis, hashtags, em dashes or quotation marks around the answer.
- Avoid filler and AI-sounding phrases such as "dive into", "unlock", "elevate", "discover the magic", "nestled", "a testament to", "whether you're", "look no further", "in today's".
- Reply with the requested text only, nothing else.`

const clip = (text: string, max: number) => {
  const t = text.replace(/\s+/g, " ").trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Compact outline of the carousel (keeps prompts small). */
function outline(c: CarouselText, descriptionChars: number) {
  const lines = [`Title: ${clip(c.title, 200) || "(none)"}`, `Subtitle: ${clip(c.subtitle, 200) || "(none)"}`, `Cards (${c.cards.length}):`]
  c.cards.forEach((card, i) => {
    const parts = [clip(card.title, 120), clip(card.subtitle, 120)].filter(Boolean).join(" | ")
    const desc = clip(card.description, descriptionChars)
    lines.push(`${i + 1}. ${parts || "(untitled)"}${desc ? `: ${desc}` : ""}`)
  })
  return lines.join("\n")
}

function prompt(req: AiRequest): { user: string; maxTokens: number } {
  const c = req.carousel
  if (req.task === "card-description") {
    const card = c.cards[req.cardIndex]
    return {
      maxTokens: 700,
      user: `Carousel: ${clip(c.title, 200)}${c.subtitle ? ` (${clip(c.subtitle, 200)})` : ""}
Card ${req.cardIndex + 1} of ${c.cards.length}
Card title: ${clip(card.title, 160) || "(none)"}
Card subtitle: ${clip(card.subtitle, 160) || "(none)"}
Current description: ${clip(card.description, 900) || "(empty)"}

Write the description for this card in ${req.minChars}-${req.maxChars} characters, one or two sentences.
Base it on the current description: keep its most useful facts and make it informative.
Do not repeat the card title, the card subtitle or the carousel title.`,
    }
  }
  if (req.task === "cover-subtitle") {
    return {
      maxTokens: 500,
      user: `${outline(c, 140)}

Write the cover subtitle: one line, at most ${req.maxChars} characters, Title Case, no period at the end.
It must tell readers exactly what the cards cover. When the cards are a list (places, units, tips, items), start with their number, like "6 Condos In Bonifacio Global City Under ₱10M".
If the current subtitle is accurate, keep its idea but make it shorter or clearer. Do not repeat the words of the title.`,
    }
  }
  return {
    maxTokens: 900,
    user: `${outline(c, 220)}
Current caption: ${clip(c.caption ?? "", 600) || "(none)"}

Write the Facebook caption for this carousel: 2 to 4 sentences, 200-380 characters, one paragraph.
Open with a hook taken from the content (a specific detail, number or question). Name the key items from the cards. End with a short line that invites people to swipe through.
Example of the Homes.ph tone: "Discover 6 Filipino restaurants where history lives on through Toho Panciteria Antigua, The Aristocrat and Casa Roces. Every meal carries a little taste of the past and memories worth sharing."`,
  }
}

/** Removes wrappers models sometimes add ("Subtitle:", quotes, hashtags…). */
export function cleanAnswer(text: string, task: AiRequest["task"]): string {
  let t = text.trim()
  t = t.replace(/^(here(?:'s| is)[^:]*:|subtitle:|caption:|description:)\s*/i, "")
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
  t = t.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",")
  if (task !== "caption") t = t.replace(/#\w+/g, "").replace(/\s+/g, " ")
  if (task === "cover-subtitle") t = t.replace(/[.。]+$/, "")
  return t.trim()
}

async function callGroq(model: string, user: string, maxTokens: number, signal: AbortSignal) {
  const res = await fetch(api(), {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY!.trim()}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: RULES },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_completion_tokens: maxTokens,
      // Short thinking keeps the cost and wait low; the answers are short.
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
    }),
    signal,
  })
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[]
    error?: { message?: string; code?: string }
  }
  return { res, body }
}

export async function generate(req: AiRequest): Promise<string> {
  if (!groqConfigured()) throw new AiError("AI suggestions aren't set up yet (GROQ_API_KEY is missing).", 503)
  const { user, maxTokens } = prompt(req)
  const models = [process.env.GROQ_MODEL?.trim(), ...MODELS].filter((m, i, all): m is string => !!m && all.indexOf(m) === i)
  const signal = AbortSignal.timeout(30_000)
  let lastError = "The AI didn't answer."
  const blocked: string[] = []
  for (const model of models) {
    let call
    try {
      call = await callGroq(model, user, maxTokens, signal)
    } catch {
      throw new AiError(signal.aborted ? "The AI took too long. Please try again." : "Couldn't reach the AI service. Check your connection.", 504)
    }
    const { res, body } = call
    if (res.status === 401) throw new AiError("The Groq API key was rejected. Check GROQ_API_KEY.", 502)
    if (res.status === 429) throw new AiError("The AI limit was reached. Please try again in a minute.", 429)
    // Model removed, not available or blocked for this account: try the next one.
    if (res.status === 404 || ((res.status === 400 || res.status === 403) && /model/i.test(body.error?.message ?? ""))) {
      if (/blocked/i.test(body.error?.message ?? "")) blocked.push(model)
      lastError = body.error?.message ?? `Model ${model} isn't available.`
      continue
    }
    if (!res.ok) throw new AiError(body.error?.message || `The AI service answered ${res.status}.`, 502)
    const text = cleanAnswer(body.choices?.[0]?.message?.content ?? "", req.task)
    if (text) return text
    lastError = "The AI returned an empty answer. Please try again."
  }
  if (blocked.length === models.length) {
    throw new AiError(
      `Your Groq account blocks these AI models (${blocked.join(", ")}). Turn one on at console.groq.com → Settings → Limits (openai/gpt-oss-120b is recommended), then try again.`,
      503,
    )
  }
  throw new AiError(lastError, 502)
}
