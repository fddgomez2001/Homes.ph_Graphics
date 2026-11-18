"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CheckCircle2, ExternalLink, Globe, KeyRound, Loader2, PenLine, Sparkles, Trash2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useWebSearchEngine } from "@/components/posters/use-web-search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  checkSearchKey,
  detectAiKey,
  getAiKeys,
  getPosterAiConfig,
  getSearchEngine,
  getSearchKeys,
  getSearchUsage,
  getTavilyKey,
  looksLikeTavilyKey,
  posterAiLabel,
  setAiKey,
  setSearchEngine,
  setSearchKey,
  setTavilyKey,
  tavilyStatus,
  testPosterAi,
  writeWith,
  type SavedAiKeys,
  type SavedSearchKeys,
  type SearchUsage,
} from "@/lib/ai/client"
import { AI_PROVIDERS, aiProvider, SEARCH_ENGINES, searchEngineName, type AiProviderConfig, type AiProviderId, type SearchEngineId, type TavilyStatus } from "@/lib/ai/types"
import { getIntegrationStatus } from "@/lib/data/assets"
import { useDesktop } from "@/lib/desktop"
import { cn, errorMessage } from "@/lib/utils"

const mask = (key: string) => (key.length > 12 ? `${key.slice(0, 5)}…${key.slice(-4)}` : "••••")
/** Select value for "let the app choose the model". */
const AUTO_MODEL = "__auto"

/** "7 of 1,000 credits used this month · Researcher plan" */
export function creditsText(s: TavilyStatus): string {
  if (typeof s.used !== "number") return ""
  const used = s.used.toLocaleString("en-US")
  const of = typeof s.limit === "number" ? ` of ${s.limit.toLocaleString("en-US")}` : ""
  return `${used}${of} credits used this month${s.plan ? ` · ${s.plan} plan` : ""}`
}

type RowId = AiProviderId | "tavily" | "serpapi" | "meta"
type Message = { ok: boolean; text: string } | null

/** The rows whose key searches but doesn't write (SerpApi) or reads Facebook Pages (Meta). */
const isSearchKey = (id: RowId): id is "serpapi" | "meta" => id === "serpapi" || id === "meta"

/** What each service is for, in the keys list. */
const ROW_INFO: Record<RowId, { badge: string; searches: boolean; writes: boolean; pages?: boolean }> = {
  groq: { badge: "Free", writes: true, searches: true },
  gemini: { badge: "Free tier", writes: true, searches: true },
  openai: { badge: "Paid", writes: true, searches: false },
  anthropic: { badge: "Paid", writes: true, searches: false },
  perplexity: { badge: "Paid", writes: true, searches: true },
  openrouter: { badge: "Some free models", writes: true, searches: false },
  deepseek: { badge: "Low cost", writes: true, searches: false },
  xai: { badge: "Paid", writes: true, searches: false },
  mistral: { badge: "Free plan", writes: true, searches: false },
  tavily: { badge: "Free · 1,000 a month", writes: false, searches: true },
  serpapi: { badge: "Free · 250 a month", writes: false, searches: true },
  meta: { badge: "Optional", writes: false, searches: false, pages: true },
}
const ROWS: RowId[] = ["groq", "gemini", "openai", "anthropic", "perplexity", "openrouter", "deepseek", "xai", "mistral", "tavily", "serpapi", "meta"]
const OTHER_ROWS: Record<"tavily" | "serpapi" | "meta", { name: string; keyUrl: string; hint: string; about?: string }> = {
  tavily: { name: "Tavily", keyUrl: "https://app.tavily.com/home", hint: "tvly-…" },
  serpapi: {
    name: "Google Search (SerpApi)",
    keyUrl: "https://serpapi.com/manage-api-key",
    hint: "64 letters and numbers",
    about: "Google's results: Google News and the public Facebook posts Google has indexed. Repeated searches within an hour are free.",
  },
  meta: {
    name: "Facebook Pages (Meta)",
    keyUrl: "https://developers.facebook.com/tools/explorer/",
    hint: "EAA…",
    about:
      "Optional: Trending news reads the posts of the Facebook Pages you list there. A Page access token (or a user token with pages_read_engagement) reads the Pages you manage; other Pages need Meta's Page Public Content Access. Tokens expire: use a long-lived one.",
  },
}
const rowName = (id: RowId) => (id === "tavily" || id === "serpapi" || id === "meta" ? OTHER_ROWS[id].name : aiProvider(id)!.name)

/** The saved keys, the writing AI and the web search choice, kept in step with every change. */
function useAiSettings() {
  const [keys, setKeys] = useState<SavedAiKeys>({})
  const [tavily, setTavily] = useState<string | null>(null)
  const [searchKeys, setSearchKeys] = useState<SavedSearchKeys>({})
  const [writing, setWriting] = useState<AiProviderConfig | null>(null)
  const [engine, setEngine] = useState<SearchEngineId | "auto">("auto")
  // localStorage is only readable in the browser: load after the first render.
  useEffect(() => {
    const load = () => {
      setKeys(getAiKeys())
      setTavily(getTavilyKey())
      setSearchKeys(getSearchKeys())
      setWriting(getPosterAiConfig())
      setEngine(getSearchEngine())
    }
    load()
    const events = ["dcm-ai-keys", "dcm-poster-ai", "dcm-tavily-key", "dcm-search-engine", "dcm-search-keys"]
    for (const name of events) window.addEventListener(name, load)
    return () => {
      for (const name of events) window.removeEventListener(name, load)
    }
  }, [])
  return { keys, tavily, searchKeys, writing, engine }
}

/**
 * Settings → AI & web search: the person's API keys (one per service), which AI writes, and which
 * engine searches the web (Tavily, Perplexity, Groq or Gemini with Google Search). Keys stay on this
 * computer and travel only to the app's server for the request at hand, then to their own service.
 */
export function PosterAiSection() {
  // The desktop app has no built-in AI: the person's own keys are what the AI features use.
  const app = !!useDesktop()
  const { keys, tavily, searchKeys, writing, engine } = useAiSettings()
  const inUse = useWebSearchEngine()
  const [builtIn, setBuiltIn] = useState({ tavily: false, groq: false })

  useEffect(() => {
    let cancelled = false
    void Promise.all([tavilyStatus().catch(() => null), getIntegrationStatus().catch(() => null)]).then(([t, s]) => {
      if (!cancelled) setBuiltIn({ tavily: t?.source === "built-in", groq: !!s?.ai })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="scroll-mt-20 rounded-xl border bg-card p-5" id="poster-ai">
      <h2 className="flex items-center gap-2 font-semibold" id="ai">
        <Sparkles className="size-4 text-violet-600 dark:text-violet-300" /> AI &amp; web search
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {app ? "This app uses AI: it reads articles, writes headlines, subtexts, captions, hashtags and carousel text, and searches for trending news. " : ""}
        Save your API keys below (as many as you like), then pick <span className="font-medium text-foreground">which AI writes</span> and{" "}
        <span className="font-medium text-foreground">which one searches the web</span>. Keys are kept on this computer only and sent just to their own service.
        {!app && " Without a key, the built-in Groq writes."}
      </p>

      <div className="mb-5 grid gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <PenLine className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Writing:</span>
          <span className="truncate font-medium">{posterAiLabel(writing)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Web search:</span>
          <span className="truncate font-medium">{inUse ? searchEngineName(inUse) : "not set up"}</span>
        </div>
      </div>

      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-4 text-muted-foreground" /> 1. Your API keys
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">Paste a key and click Save: the app checks it with its service first. Groq and Tavily are free.</p>
      <ul className="divide-y rounded-lg border" aria-label="API keys">
        {ROWS.map((id) => (
          <KeyRow key={id} id={id} saved={id === "tavily" ? tavily : isSearchKey(id) ? (searchKeys[id] ?? null) : (keys[id]?.key ?? null)} writing={writing?.provider === id} hasWriter={!!writing} />
        ))}
      </ul>

      <WritingAi keys={keys} writing={writing} app={app} builtInGroq={builtIn.groq} />

      <WebSearchChoice keys={keys} tavily={tavily} serpapi={!!searchKeys.serpapi} engine={engine} inUse={inUse} builtIn={builtIn} />
    </section>
  )
}

// ---------- 1. one key per service ----------

function KeyRow({ id, saved, writing, hasWriter }: { id: RowId; saved: string | null; writing: boolean; hasWriter: boolean }) {
  const info = ROW_INFO[id]
  const provider = id === "tavily" || isSearchKey(id) ? null : aiProvider(id)!
  const other = id === "tavily" || isSearchKey(id) ? OTHER_ROWS[id] : null
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [credits, setCredits] = useState("")

  // Tavily's credits / SerpApi's searches left this month (their usage calls are free).
  useEffect(() => {
    if ((id !== "tavily" && id !== "serpapi") || !saved) return
    let cancelled = false
    ;(id === "tavily" ? tavilyStatus({ check: true }).then(creditsText) : checkSearchKey("serpapi", saved)).then(
      (text) => !cancelled && setCredits(text),
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [id, saved])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const k = value.trim()
    if (!k) return setMessage({ ok: false, text: "Paste the key first." })
    setBusy(true)
    setMessage(null)
    try {
      if (isSearchKey(id)) {
        // Checked with SerpApi (searches left) or Meta (who the token is) before it's saved.
        const text = await checkSearchKey(id, k)
        setSearchKey(id, k)
        setValue("")
        setOpen(false)
        if (id === "serpapi") setCredits(text)
        toast.success(`${rowName(id)} key saved.`, { description: text })
        return
      }
      if (id === "tavily" || looksLikeTavilyKey(k)) {
        if (!looksLikeTavilyKey(k)) throw new Error("A Tavily key starts with tvly-.")
        const s = await tavilyStatus({ key: k, check: true })
        setTavilyKey(k)
        setValue("")
        setOpen(false)
        toast.success(id === "tavily" ? "Tavily key saved." : "That's a Tavily key: saved under Tavily.", { description: creditsText(s) || undefined })
        return
      }
      // Checked with the service (and moved to the right row when it's another service's key).
      const found = await detectAiKey(k, "auto").catch(() => detectAiKey(k, id))
      setAiKey(found.provider, { key: k })
      if (!hasWriter) writeWith(found.provider)
      setValue("")
      setOpen(false)
      const name = aiProvider(found.provider)!.name
      toast.success(found.provider === id ? `${name} key saved.` : `That's a ${name} key: saved under ${name}.`, {
        description: !hasWriter ? `${name} writes for you now.` : found.recommended ? `Recommended model: ${found.recommended}` : undefined,
      })
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    if (!saved) return
    setBusy(true)
    setMessage(null)
    try {
      if (id === "tavily") {
        const s = await tavilyStatus({ check: true })
        setCredits(creditsText(s))
        setMessage({ ok: true, text: `Works. ${creditsText(s) || "Tavily answered."}` })
      } else if (isSearchKey(id)) {
        const text = await checkSearchKey(id, saved)
        if (id === "serpapi") setCredits(text)
        setMessage({ ok: true, text: id === "serpapi" ? `Works. ${text}` : text })
      } else {
        const model = getAiKeys()[id]?.model
        const words = await testPosterAi({ provider: id, key: saved, ...(model ? { model } : {}) })
        setMessage({ ok: true, text: `Works. ${provider!.name} picked “${words}” from a sample headline.` })
      }
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (id === "tavily") setTavilyKey(null)
    else if (isSearchKey(id)) setSearchKey(id, null)
    else setAiKey(id, null)
    setMessage(null)
    toast.success(`${rowName(id)} key removed from this computer.`, { description: writing ? "Pick another AI to write in Writing AI below." : undefined })
  }

  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {rowName(id)}
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-normal", info.badge.startsWith("Free") ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
              {info.badge}
            </span>
            {info.writes && <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">writes</span>}
            {info.searches && <span className="rounded-full border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-normal text-sky-700 dark:text-sky-300">searches the web</span>}
            {info.pages && <span className="rounded-full border border-blue-500/40 px-1.5 py-0.5 text-[10px] font-normal text-blue-700 dark:text-blue-300">reads Facebook Pages</span>}
            {writing && <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-normal text-violet-700 dark:text-violet-300">writing now</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {saved ? (
              <>
                <span className="text-emerald-700 dark:text-emerald-300">Saved</span> · <span className="font-mono">{mask(saved)}</span>
                {(id === "tavily" || id === "serpapi") && credits && ` · ${credits}`}
              </>
            ) : (
              "No key"
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <a href={other ? other.keyUrl : provider!.keyUrl} target="_blank" rel="noreferrer">
              Get a key <ExternalLink />
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {saved ? "Change" : "Add key"}
          </Button>
          {saved && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => void test()} disabled={busy}>
                {busy && !open ? <Loader2 className="animate-spin" /> : <Sparkles />} Test
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive" aria-label={`Remove the ${rowName(id)} key`}>
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </div>
      {open && (
        <form onSubmit={(e) => void save(e)} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Label htmlFor={`key-${id}`} className="sr-only">
            {rowName(id)} API key
          </Label>
          <Input
            id={`key-${id}`}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={other ? other.hint : provider!.keyHint}
            autoComplete="off"
            spellCheck={false}
            className="h-8 sm:flex-1"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={busy || !value.trim()}>
            {busy && <Loader2 className="animate-spin" />} Check &amp; save
          </Button>
        </form>
      )}
      {open && other?.about && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{other.about}</p>}
      {message && (
        <p className={cn("mt-1.5 flex items-start gap-1.5 text-xs", message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")} role="status">
          {message.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <XCircle className="mt-px size-3.5 shrink-0" />}
          {message.text}
        </p>
      )}
    </li>
  )
}

// ---------- 2. which AI writes ----------

function WritingAi({ keys, writing, app, builtInGroq }: { keys: SavedAiKeys; writing: AiProviderConfig | null; app: boolean; builtInGroq: boolean }) {
  const saved = AI_PROVIDERS.filter((p) => keys[p.id])
  const [models, setModels] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const active = writing ? aiProvider(writing.provider) : null

  const pick = (id: AiProviderId) => {
    try {
      writeWith(id)
      setModels([])
      setMessage(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const loadModels = async () => {
    if (!writing) return
    setBusy(true)
    try {
      const found = await detectAiKey(writing.key, writing.provider)
      setModels(found.models)
      setMessage({ ok: true, text: `${found.models.length} model${found.models.length === 1 ? "" : "s"}${found.recommended ? ` · recommended: ${found.recommended}` : ""}` })
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const setModel = (model: string) => {
    if (!writing) return
    setAiKey(writing.provider, { key: writing.key, ...(model ? { model } : {}) })
  }

  const test = async () => {
    if (!writing) return
    setBusy(true)
    setMessage(null)
    try {
      const words = await testPosterAi(writing)
      setMessage({ ok: true, text: `Works. ${active?.name} picked “${words}” from a sample headline.` })
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const options = writing?.model && !models.includes(writing.model) ? [writing.model, ...models] : models

  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <PenLine className="size-4 text-muted-foreground" /> 2. Writing AI
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">Writes the headlines, subtexts, captions, hashtags and carousel text. Pick one of your saved keys.</p>
      {saved.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {app ? "Save an AI key above first (Groq is free)." : builtInGroq ? "The built-in Groq writes. Save a key above to use your own AI." : "Save an AI key above first."}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Writing AI">
          {saved.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={writing?.provider === p.id}
              onClick={() => pick(p.id)}
              className={cn("rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-muted/60", writing?.provider === p.id && "border-primary bg-primary/5 ring-1 ring-primary")}
            >
              <div className="font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{keys[p.id]?.model || "model chosen automatically"}</div>
            </button>
          ))}
        </div>
      )}
      {writing && active && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-col gap-1.5 sm:max-w-md">
            <Label htmlFor="ai-model">{active.name} model</Label>
            <div className="flex gap-2">
              <Select value={writing.model || AUTO_MODEL} onValueChange={(v) => setModel(v === AUTO_MODEL ? "" : v)}>
                <SelectTrigger id="ai-model" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={AUTO_MODEL}>Automatic ({active.defaultModel}, or one your key has)</SelectItem>
                  {options.length > 0 && <SelectSeparator />}
                  {options.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => void loadModels()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null} Show models
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void test()} disabled={busy}>
              <Sparkles /> Test the writing AI
            </Button>
            {message && (
              <span className={cn("text-xs", message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")} role="status">
                {message.text}
              </span>
            )}
          </div>
          {writing.provider === "perplexity" && (
            <p className="text-[11px] text-muted-foreground">
              Perplexity writes through its Agent API without searching (billed per token; perplexity/sonar is the cheapest). Its web search is chosen below.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- 3. which engine searches the web ----------

function WebSearchChoice({
  keys,
  tavily,
  serpapi,
  engine,
  inUse,
  builtIn,
}: {
  keys: SavedAiKeys
  tavily: string | null
  serpapi: boolean
  engine: SearchEngineId | "auto"
  inUse: SearchEngineId | null
  builtIn: { tavily: boolean; groq: boolean }
}) {
  const has: Record<SearchEngineId, boolean> = {
    tavily: !!tavily || builtIn.tavily,
    serpapi,
    perplexity: !!keys.perplexity,
    groq: !!keys.groq || builtIn.groq,
    gemini: !!keys.gemini,
  }
  const choose = (value: SearchEngineId | "auto") => {
    try {
      setSearchEngine(value)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  return (
    <div className="mt-6" id="web-search">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Globe className="size-4 text-sky-600 dark:text-sky-300" /> 3. Web search
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Finds the newest news for <span className="font-medium text-foreground">Trending news</span>, the places for <span className="font-medium text-foreground">Search a topic</span>{" "}
        and the links for PicklePlay facts. If the chosen one can&apos;t search (no credits, a bad key), the next one with a key does, and the results say so.
      </p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Web search">
        <SearchOption
          selected={engine === "auto"}
          disabled={false}
          onSelect={() => choose("auto")}
          title="Automatic"
          about={`The first one with a key: Tavily, then Google (SerpApi), Perplexity, Groq, Gemini.${engine === "auto" && inUse ? ` Now: ${searchEngineName(inUse)}.` : ""}`}
        />
        {SEARCH_ENGINES.map((e) => (
          <SearchOption
            key={e.id}
            selected={engine === e.id}
            disabled={!has[e.id]}
            onSelect={() => choose(e.id)}
            title={e.name}
            about={`${e.about} ${e.cost}`}
            missing={!has[e.id] ? `Save a ${e.id === "groq" ? "Groq" : e.id === "gemini" ? "Gemini" : e.id === "serpapi" ? "SerpApi" : e.name} key above to use it.` : undefined}
          />
        ))}
      </div>
      {engine !== "auto" && !has[engine] && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{searchEngineName(engine)} has no key now: {inUse ? `${searchEngineName(inUse)} searches instead.` : "no web search works yet."}</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Trending news can also search public Facebook posts (when no news is found, always, or never: chosen there). Google through SerpApi finds the most; Tavily and Perplexity some.
      </p>
      <SearchUsageLine />
    </div>
  )
}

const USAGE_UNITS: Record<SearchEngineId, [string, string]> = {
  tavily: ["credit", "credits"],
  serpapi: ["search", "searches"],
  perplexity: ["search", "searches"],
  groq: ["search", "searches"],
  gemini: ["search", "searches"],
}

/** What the web searches used this month on this computer (each service's own site has the exact numbers). */
function SearchUsageLine() {
  const [usage, setUsage] = useState<SearchUsage | null>(null)
  useEffect(() => {
    const load = () => setUsage(getSearchUsage())
    load()
    window.addEventListener("dcm-search-usage", load)
    return () => window.removeEventListener("dcm-search-usage", load)
  }, [])
  const parts = usage ? (Object.entries(usage.counts) as [SearchEngineId, number][]).filter(([, n]) => n > 0) : []
  if (!parts.length) return null
  return (
    <p className="mt-1 text-[11px] text-muted-foreground" aria-label="Web search usage this month">
      Used this month on this computer:{" "}
      {parts.map(([id, n]) => `${searchEngineName(id)} ${n.toLocaleString("en-US")} ${USAGE_UNITS[id][n === 1 ? 0 : 1]}`).join(" · ")}.
    </p>
  )
}

function SearchOption({ selected, disabled, onSelect, title, about, missing }: { selected: boolean; disabled: boolean; onSelect: () => void; title: string; about: string; missing?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      onClick={() => !disabled && onSelect()}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/60",
        selected && "border-primary bg-primary/5 ring-1 ring-primary",
      )}
    >
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", selected && "border-primary")}>
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{about}</span>
        {missing && <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">{missing}</span>}
      </span>
    </button>
  )
}
