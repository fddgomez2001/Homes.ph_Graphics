import "server-only"

import { aiProvider, type AiProviderConfig, type AiProviderId } from "./types"

/**
 * The user's own AI key (Settings → AI): requests to Groq, OpenAI, Anthropic (Claude),
 * Google Gemini, Perplexity, OpenRouter, DeepSeek, xAI (Grok) or Mistral. The
 * endpoints are fixed here (never taken from the request) and the key is only used for
 * the call at hand. With only a key, the provider is found from the key and a model is
 * picked from the ones the key can use.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    /** "key": rejected; "model": the model isn't available; "limit": rate limit. */
    readonly kind: "key" | "model" | "limit" | "other" = "other",
  ) {
    super(message)
  }
}

export interface ProviderCall {
  system: string
  user: string
  maxTokens: number
  temperature: number
  signal: AbortSignal
}

/** OpenAI-compatible chat completions endpoints. */
const CHAT_URL: Record<Exclude<AiProviderId, "anthropic" | "perplexity">, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
}

const MODELS_URL: Record<AiProviderId, string> = {
  groq: "https://api.groq.com/openai/v1/models",
  openai: "https://api.openai.com/v1/models",
  anthropic: "https://api.anthropic.com/v1/models?limit=1000",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
  openrouter: "https://openrouter.ai/api/v1/models",
  deepseek: "https://api.deepseek.com/models",
  xai: "https://api.x.ai/v1/models",
  mistral: "https://api.mistral.ai/v1/models",
  // Public list (no key needed): "provider/model" ids that Perplexity's Agent API runs.
  perplexity: "https://api.perplexity.ai/v1/models",
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
/** Perplexity's Agent API (Responses-style). Its Sonar chat completions API was retired on 2026-09-27. */
export const PERPLEXITY_AGENT_URL = "https://api.perplexity.ai/v1/agent"

function authHeaders(provider: AiProviderId, key: string): Record<string, string> {
  if (provider === "anthropic") return { "x-api-key": key, "anthropic-version": "2023-06-01" }
  if (provider === "gemini") return { "x-goog-api-key": key }
  return { authorization: `Bearer ${key}` }
}

// ---------- which provider a key belongs to ----------

/**
 * The providers a key can belong to, from its format (most likely first). An unknown
 * format is only tried with Mistral (its keys have no prefix); other keys are never sent
 * to services they can't belong to.
 */
export function providersForKey(key: string): AiProviderId[] {
  const k = key.trim()
  if (k.startsWith("gsk_")) return ["groq"]
  if (k.startsWith("sk-ant-")) return ["anthropic"]
  if (k.startsWith("AIza")) return ["gemini"]
  if (k.startsWith("sk-or-")) return ["openrouter"]
  if (k.startsWith("xai-")) return ["xai"]
  if (k.startsWith("pplx-")) return ["perplexity"]
  if (/^sk-(proj|svcacct|admin)-/.test(k)) return ["openai"]
  if (k.startsWith("sk-")) return ["openai", "deepseek"]
  if (/^[A-Za-z0-9]{32}$/.test(k)) return ["mistral"]
  return []
}

// ---------- models ----------

/** Models that can't write chat answers (embeddings, speech, images, moderation…). */
const NOT_CHAT = /embed|whisper|tts|dall-e|image|imagen|veo|audio|moderation|guard|realtime|transcribe|search|computer-use|davinci|babbage|^ft:|-instruct$|aqa|learnlm|playai|distil|rerank|ocr|codestral-embed|vision-preview|live|native-audio/i

export function chatModels(ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => id && !NOT_CHAT.test(id))
}

/** The numbers in a model name ("gpt-5.1-mini" → [5, 1]); dates (8 digits) are left out. */
function versionOf(id: string): number[] {
  return (id.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => n.length < 8).flatMap((n) => n.split(".").map(Number))
}

function newestFirst(a: string, b: string) {
  const va = versionOf(a)
  const vb = versionOf(b)
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? -1) - (va[i] ?? -1)
    if (d) return d
  }
  return a.length - b.length
}

/** Fast, capable and cheap models first (headlines are short); newest version of each kind. */
const PREFERRED: Record<AiProviderId, (RegExp | string)[]> = {
  groq: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", /^qwen/, /^llama/],
  openai: [/^gpt-\d+(\.\d+)?-mini$/, /^gpt-\d+(\.\d+)?$/, /^gpt-4o-mini$/, /^gpt-4\.1-mini/, /^gpt/],
  anthropic: [/haiku/, /sonnet/, /claude/],
  gemini: [/^gemini-\d+(\.\d+)?-flash$/, /^gemini-flash-latest$/, /^gemini-\d+(\.\d+)?-flash(?!.*(lite|thinking|exp))/, /^gemini-\d+(\.\d+)?-pro$/, /^gemini/],
  openrouter: ["openrouter/auto", /^openai\/gpt-\d+(\.\d+)?-mini$/, /^google\/gemini-\d+(\.\d+)?-flash$/, /^anthropic\/claude.*haiku/, /^deepseek\/deepseek-chat/],
  deepseek: ["deepseek-chat", /deepseek/],
  xai: [/^grok-\d+(\.\d+)?-(fast|mini)/, /^grok-\d+(\.\d+)?$/, /^grok/],
  mistral: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest", /^mistral-small/, /^mistral/],
  // Perplexity's own model is the cheapest; the others are billed at their makers' prices.
  perplexity: ["perplexity/sonar", /^openai\/gpt-[\d.]+-(luna|mini)$/, /^google\/gemini-[\d.]+-flash$/, /^anthropic\/claude-haiku/, /^perplexity\//],
}

/** The model to use when none is chosen: the first preference the key has (newest version). */
export function recommendModel(provider: AiProviderId, ids: string[]): string | null {
  const models = chatModels(ids)
  for (const pref of PREFERRED[provider]) {
    const hits = models.filter((m) => (typeof pref === "string" ? m === pref : pref.test(m))).sort(newestFirst)
    if (hits.length) return hits[0]
  }
  return models[0] ?? null
}

/** The models this key can use (chat models only). Throws ProviderError (kind "key") when the key is rejected. */
export async function listModels(provider: AiProviderId, key: string, signal: AbortSignal): Promise<string[]> {
  const info = aiProvider(provider)!
  if (provider === "openrouter") {
    // Its model list is public: check the key on its own.
    const check = await fetch("https://openrouter.ai/api/v1/key", { headers: authHeaders(provider, key), signal })
    if (check.status === 401 || check.status === 403) throw new ProviderError(`${info.name} rejected the key.`, 401, "key")
  }
  if (provider === "perplexity") await checkPerplexityKey(key, signal)
  const res = await fetch(MODELS_URL[provider], { headers: authHeaders(provider, key), signal })
  if (res.status === 401 || res.status === 403 || (provider === "gemini" && res.status === 400)) throw new ProviderError(`${info.name} rejected the key.`, 401, "key")
  if (!res.ok) throw new ProviderError(`${info.name} answered ${res.status} when listing models.`, 502)
  const body = (await res.json().catch(() => ({}))) as { data?: { id?: string }[]; models?: { name?: string; supportedGenerationMethods?: string[] }[] }
  const ids =
    provider === "gemini"
      ? (body.models ?? []).filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent")).map((m) => (m.name ?? "").replace(/^models\//, ""))
      : (body.data ?? []).map((m) => m.id ?? "")
  return chatModels(ids)
}

export interface DetectedKey {
  provider: AiProviderId
  models: string[]
  recommended: string | null
}

/**
 * Finds the provider of a key (the one given, or from the key's format) by listing its
 * models, and recommends one.
 */
export async function detectKey(key: string, provider: AiProviderId | "auto", signal: AbortSignal): Promise<DetectedKey> {
  const candidates = provider === "auto" ? providersForKey(key) : [provider]
  if (!candidates.length) {
    throw new ProviderError("This key's service can't be told from the key. Choose the AI provider, then check the key again.", 400, "key")
  }
  let last: unknown = null
  for (const candidate of candidates) {
    try {
      const models = await listModels(candidate, key, signal)
      return { provider: candidate, models, recommended: recommendModel(candidate, models) }
    } catch (e) {
      last = e
      if (signal.aborted) break
    }
  }
  if (last instanceof ProviderError && last.kind === "key") {
    const names = candidates.map((c) => aiProvider(c)!.name).join(" or ")
    throw new ProviderError(`${names} didn't accept this key. Check that it's copied in full and still active.`, 401, "key")
  }
  if (signal.aborted) throw new ProviderError("The AI service took too long to answer. Please try again.", 504)
  throw last instanceof ProviderError ? last : new ProviderError("Couldn't reach the AI service. Check your connection.", 504)
}

/**
 * Perplexity's model list is public, so the key is checked with the smallest real request: a few
 * words from its own model, with no web search (costs a tiny fraction of a cent).
 */
async function checkPerplexityKey(key: string, signal: AbortSignal) {
  const res = await perplexityAgent(key, "perplexity/sonar", { system: "Reply with the word OK.", user: "OK?", maxTokens: 16, temperature: 0, signal })
  if (res.status === 401 || res.status === 403) throw new ProviderError("Perplexity rejected the key.", 401, "key")
  if (res.status === 402) throw new ProviderError("Perplexity accepted the key, but the account has no API credits. Add credits at console.perplexity.ai → Billing.", 402, "key")
  if (!res.ok && res.status !== 429) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new ProviderError(`Perplexity answered ${res.status}${body.error?.message ? `: ${body.error.message}` : ""}.`, 502)
  }
}

// ---------- writing ----------

/**
 * One answer with the user's key. With no model chosen it uses the provider's default,
 * and if that model isn't available to the key it picks one the key has. Returns the
 * text and the model that wrote it.
 */
export async function callProvider(config: AiProviderConfig, call: ProviderCall): Promise<{ text: string; model: string }> {
  const info = aiProvider(config.provider)
  if (!info) throw new ProviderError("Unknown AI provider.", 400)
  const chosen = config.model?.trim()
  const model = chosen || info.defaultModel
  try {
    return { text: await callModel(config, model, call), model }
  } catch (e) {
    if (chosen || !(e instanceof ProviderError) || e.kind !== "model") throw e
    // No model was chosen and the default isn't available: use one this key has.
    const fallback = recommendModel(config.provider, await listModels(config.provider, config.key, call.signal).catch(() => []))
    if (!fallback || fallback === model) throw e
    return { text: await callModel(config, fallback, call), model: fallback }
  }
}

async function callModel(config: AiProviderConfig, model: string, call: ProviderCall): Promise<string> {
  const info = aiProvider(config.provider)!
  let res: Response
  try {
    res =
      config.provider === "anthropic"
        ? await anthropic(config.key, model, call)
        : config.provider === "perplexity"
          ? await perplexityAgent(config.key, model, call)
          : await openAiCompatible(config, model, call)
  } catch {
    throw new ProviderError(call.signal.aborted ? `${info.name} took too long. Please try again.` : `Couldn't reach ${info.name}. Check your connection.`, 504)
  }
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string | null } }[]
    content?: { type?: string; text?: string }[]
    output_text?: string
    output?: PerplexityOutput[]
    error?: { message?: string } | string
  }
  const message = typeof body.error === "string" ? body.error : (body.error?.message ?? "")
  if (res.status === 401 || res.status === 403) {
    if (/model/i.test(message) && res.status === 403) throw new ProviderError(`${info.name} can't use the model "${model}" with this key${message ? ` (${message})` : ""}.`, 502, "model")
    throw new ProviderError(`Your ${info.name} API key was rejected${message ? ` (${message})` : ""}. Check it in Settings → AI.`, 502, "key")
  }
  if (res.status === 429) throw new ProviderError(`${info.name}: the limit for your key was reached${message ? ` (${message})` : ""}.`, 429, "limit")
  if (res.status === 402) throw new ProviderError(`${info.name}: the account has no API credits left${message ? ` (${message})` : ""}. Add credits on the ${info.name} website.`, 402, "limit")
  if (res.status === 404 || (res.status === 400 && /model/i.test(message))) {
    throw new ProviderError(`${info.name} can't use the model "${model}"${message ? ` (${message})` : ""}. Check the model in Settings → AI.`, 502, "model")
  }
  if (!res.ok) throw new ProviderError(`${info.name} answered ${res.status}${message ? `: ${message}` : ""}.`, 502)
  if (config.provider === "perplexity") return perplexityText(body)
  return config.provider === "anthropic"
    ? (body.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
    : (body.choices?.[0]?.message?.content ?? "")
}

function openAiCompatible(config: AiProviderConfig, model: string, call: ProviderCall) {
  const provider = config.provider as keyof typeof CHAT_URL
  // Reasoning models (OpenAI o-series and GPT-5) don't take a temperature, and their
  // thinking counts toward the token limit, so they get more room.
  const reasoning = provider === "openai" && /^(o\d|gpt-5)/i.test(model)
  const roomy = reasoning || provider === "gemini" || provider === "openrouter" || provider === "xai"
  const limit = roomy ? Math.max(call.maxTokens * 4, 4000) : call.maxTokens
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: call.system },
      { role: "user", content: call.user },
    ],
    ...(reasoning ? { reasoning_effort: "low" } : { temperature: call.temperature }),
    ...(provider === "openai" || provider === "groq" ? { max_completion_tokens: limit } : { max_tokens: limit }),
    ...(provider === "groq" && model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
  }
  return fetch(CHAT_URL[provider], {
    method: "POST",
    // Gemini's OpenAI-compatible endpoint takes the key as a Bearer token.
    headers: { ...(provider === "gemini" ? { authorization: `Bearer ${config.key}` } : authHeaders(provider, config.key)), "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: call.signal,
  })
}

/** One item of a Perplexity Agent API answer (`output[]`). */
export interface PerplexityOutput {
  type?: string
  content?: { type?: string; text?: string }[]
  results?: { url?: string; title?: string; date?: string | null }[]
}

/** The answer's words (the "message" items' output_text), without [1] / [web:1] citation marks. */
export function perplexityText(body: { output_text?: string; output?: PerplexityOutput[] }): string {
  const text =
    typeof body.output_text === "string" && body.output_text.trim()
      ? body.output_text
      : (body.output ?? [])
          .filter((o) => o?.type === "message")
          .flatMap((o) => o.content ?? [])
          .filter((c) => c?.type === "output_text" && typeof c.text === "string")
          .map((c) => c.text)
          .join("")
  return text.replace(/\s?\[(?:web:)?\d+\]/g, "")
}

/**
 * Perplexity's Agent API without tools: the model answers from what it knows (no web search, so
 * it costs only the tokens). Anthropic models there need max_output_tokens, so it's always sent.
 */
function perplexityAgent(key: string, model: string, call: ProviderCall) {
  return fetch(PERPLEXITY_AGENT_URL, {
    method: "POST",
    headers: { ...authHeaders("perplexity", key), "content-type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: call.system,
      input: call.user,
      max_output_tokens: Math.max(call.maxTokens * 4, 2000),
      temperature: call.temperature,
    }),
    signal: call.signal,
  })
}

function anthropic(key: string, model: string, call: ProviderCall) {
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { ...authHeaders("anthropic", key), "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: Math.max(call.maxTokens, 1024),
      system: call.system,
      messages: [{ role: "user", content: call.user }],
    }),
    signal: call.signal,
  })
}
