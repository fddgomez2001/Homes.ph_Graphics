"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Cloud,
  ExternalLink,
  FolderOpen,
  Frame,
  Globe,
  HardDrive,
  Images,
  LayoutGrid,
  Loader2,
  Lock,
  Megaphone,
  Newspaper,
  ShieldAlert,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react"
import { BrandMark } from "@/components/brand-mark"
import { AssignedPagesPicker } from "@/components/pages/assigned-pages-picker"
import { ThemeToggle } from "@/components/theme/theme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { detectAiKey, getPosterAiConfig, getTavilyKey, looksLikeTavilyKey, setPosterAiConfig, setTavilyKey, syncKeysWithDesktop, tavilyStatus, testPosterAi } from "@/lib/ai/client"
import { aiProvider, type AiProviderConfig, type AiProviderId } from "@/lib/ai/types"
import { saveAssignment } from "@/lib/assignment"
import { useDesktop, type DesktopSetupStatus } from "@/lib/desktop"
import { EMPTY_ASSIGNMENT, hasAnyPage, HOMES_PAGE_LIST, LEGACY_ASSIGNMENT, normalizeAssignment, SITE_PAGE_LIST, type Assignment } from "@/lib/pages"
import { cn, errorMessage } from "@/lib/utils"

type Step = "welcome" | "pages" | "ai" | "storage" | "done"
const STEPS: { id: Step; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "pages", label: "Your pages" },
  { id: "ai", label: "Your AI" },
  { id: "storage", label: "Saving your work" },
  { id: "done", label: "Ready" },
]

const FEATURES: { icon: typeof LayoutGrid; title: string; text: string }[] = [
  { icon: LayoutGrid, title: "Carousels", text: "Plan, design and export daily carousels for Homes.ph, FHI Global Properties and PicklePlay PH. The AI researches a topic (with sources) and writes the slides." },
  { icon: Newspaper, title: "News Article", text: "Turn a news article or a link into a ready post with each brand's templates." },
  { icon: Frame, title: "Poster Maker", text: "AI headline, subtext, Facebook caption and hashtags, trending news with source links, and photo enhance." },
  { icon: Megaphone, title: "Advertisement", text: "PicklePlay History, Trivia and Fun Facts posters, and Coming Soon / Now Open court posts." },
  { icon: CalendarDays, title: "Calendar & Day Board", text: "Schedule posts, see each day's work and tick the posting checklist page by page." },
  { icon: ClipboardList, title: "Daily Report", text: "The daily report, with a floating window that saves the pictures for you." },
  { icon: Images, title: "Library & Templates", text: "Your photos and saved designs, ready to reuse." },
]

/** How to get a key, per AI service (the welcome setup changes with the one picked). */
const GUIDES: Record<AiProviderId, { badge: string; site: string; steps: string[]; note?: string }> = {
  groq: {
    badge: "Free · recommended",
    site: "Groq console",
    steps: ["Open the Groq console and sign in with Google or an email. It's free, no card needed.", "Click “Create API Key”, type any name (for example “Carousel Maker”) and click Submit.", "Copy the key (it starts with gsk_) and paste it below."],
    note: "Groq can also search the web, so Trending news and topic research work with just this key.",
  },
  gemini: {
    badge: "Free tier",
    site: "Google AI Studio",
    steps: ["Open Google AI Studio and sign in with your Google account.", "Click “Create API key” (pick any project, or let it make one for you).", "Copy the key (it starts with AIza) and paste it below."],
    note: "Free with daily limits. Gemini can also search Google, so Trending news and topic research work with just this key.",
  },
  perplexity: {
    badge: "Paid · searches the web",
    site: "Perplexity console",
    steps: [
      "Open the Perplexity console and sign in (make a project first if it asks).",
      "Add API credits under Billing (the API is paid separately from Perplexity Pro).",
      "Under API Keys, create a key, copy it (it starts with pplx-; it's shown only once) and paste it below.",
    ],
    note: "Perplexity also searches the web (about $5 per 1,000 searches), so Trending news and topic research work with just this key.",
  },
  openai: {
    badge: "Paid",
    site: "OpenAI platform",
    steps: ["Open the OpenAI platform and sign in.", "Add a little credit under Billing (the API is paid separately; ChatGPT Plus doesn't include it).", "Click “Create new secret key”, copy it (it starts with sk-) and paste it below."],
  },
  anthropic: {
    badge: "Paid",
    site: "Claude Console",
    steps: ["Open the Claude Console and sign in.", "Add credit under Billing.", "Click “Create Key”, copy it (it starts with sk-ant-) and paste it below."],
  },
  openrouter: {
    badge: "Some free models",
    site: "OpenRouter",
    steps: ["Open OpenRouter and sign in.", "Click “Create Key” and copy it (it starts with sk-or-).", "Paste it below."],
  },
  deepseek: {
    badge: "Low cost",
    site: "DeepSeek platform",
    steps: ["Open the DeepSeek platform and sign in.", "Top up a small amount, then click “Create new API key”.", "Copy it (it starts with sk-) and paste it below."],
  },
  xai: {
    badge: "Paid",
    site: "xAI console",
    steps: ["Open the xAI console and sign in.", "Go to API Keys → Create API key.", "Copy it (it starts with xai-) and paste it below."],
  },
  mistral: {
    badge: "Free plan",
    site: "Mistral console",
    steps: ["Open the Mistral console and sign in (the free Experiment plan works).", "Go to API Keys → Create new key.", "Copy it and paste it below."],
  },
}
const MAIN_PROVIDERS: AiProviderId[] = ["groq", "gemini", "openai", "anthropic"]
const MORE_PROVIDERS: AiProviderId[] = ["perplexity", "openrouter", "deepseek", "xai", "mistral"]
/** These can search the web with the same key (no Tavily key needed). */
const SEARCHES_TOO: AiProviderId[] = ["groq", "gemini", "perplexity"]

type Status = { busy: boolean; ok?: boolean; message?: string; canForce?: boolean }
type StorageChoice = "local" | "cloud" | "team"

const providerName = (id: string) => aiProvider(id)?.name ?? id
/** Errors that mean the key itself is wrong (saving it anyway wouldn't help). */
const BAD_KEY = /invalid|incorrect|not valid|unauthori[sz]ed|wrong|revoked|doesn't look like|401|403/i

export function WelcomeWizard() {
  const desktop = useDesktop()
  const [step, setStep] = useState<Step>("welcome")
  const [status, setStatus] = useState<DesktopSetupStatus | null>(null)
  const [loadError, setLoadError] = useState("")
  // An install from before 1.50 (already set up) is only asked its pages: /welcome?step=pages.
  const [onlyPages, setOnlyPages] = useState(false)

  useEffect(() => {
    if (!desktop?.setup) return
    desktop.setup
      .get()
      .then((s) => {
        if (new URLSearchParams(window.location.search).get("step") === "pages") {
          setOnlyPages(true)
          setStep("pages")
        }
        setStatus(s)
      })
      .catch((e) => setLoadError(errorMessage(e)))
    void syncKeysWithDesktop()
  }, [desktop])

  if (!desktop) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          This setup is for the Homes.ph SocMedSystem Windows app.{" "}
          <a href="/home" className="font-medium text-foreground underline underline-offset-2">
            Go to the app
          </a>
        </p>
      </Shell>
    )
  }
  if (!desktop.setup) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Please install the newest Homes.ph SocMedSystem to run the welcome setup.</p>
      </Shell>
    )
  }
  if (!status) {
    return (
      <Shell>
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Getting things ready…
          </p>
        )}
      </Shell>
    )
  }

  if (onlyPages) {
    return (
      <Shell>
        <PagesStep
          initial={normalizeAssignment(status.pages) ?? LEGACY_ASSIGNMENT}
          intro="New in this version: choose the pages you're assigned. The app and the Homes.ph Publisher extension show only these. You can change them any time in Settings → Assigned pages."
          nextLabel="Save and open the app"
          onNext={() => window.location.replace("/home")}
        />
      </Shell>
    )
  }

  return (
    <Shell step={step}>
      {step === "welcome" && <WelcomeStep onNext={() => setStep("pages")} />}
      {step === "pages" && (
        <PagesStep
          initial={normalizeAssignment(status.pages) ?? EMPTY_ASSIGNMENT}
          onBack={() => setStep("welcome")}
          onNext={(pages) => {
            setStatus({ ...status, pages })
            setStep("ai")
          }}
        />
      )}
      {step === "ai" && <AiStep onBack={() => setStep("pages")} onNext={() => setStep("storage")} />}
      {step === "storage" && (
        <StorageStep
          status={status}
          onBack={() => setStep("ai")}
          onSaved={(next) => {
            setStatus(next)
            setStep("done")
          }}
        />
      )}
      {step === "done" && <DoneStep status={status} onBack={() => setStep("storage")} />}
    </Shell>
  )
}

function Shell({ step, children }: { step?: Step; children: ReactNode }) {
  const at = STEPS.findIndex((s) => s.id === step)
  return (
    <main className="relative flex min-h-screen justify-center bg-background px-4 py-10">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10" />
          <div>
            <div className="text-lg font-semibold tracking-tight">Homes.ph SocMedSystem</div>
            <div className="text-xs text-muted-foreground">First-time setup</div>
          </div>
        </div>
        {step && (
          <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Setup steps">
            {STEPS.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                    i === at ? "border-primary bg-primary text-primary-foreground" : i < at ? "border-primary/40 text-foreground" : "text-muted-foreground",
                  )}
                  aria-current={i === at ? "step" : undefined}
                >
                  {i < at ? <CheckCircle2 className="size-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="h-px w-4 bg-border" />}
              </li>
            ))}
          </ol>
        )}
        <div className="rounded-xl border bg-card p-6 shadow-xs">{children}</div>
      </div>
    </main>
  )
}

function Footer({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function StatusLine({ status }: { status: Status }) {
  if (!status.message) return null
  return (
    <p
      className={cn("flex items-start gap-1.5 text-sm", status.busy ? "text-muted-foreground" : status.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")}
      role="status"
    >
      {status.busy ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /> : status.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
      {status.message}
    </p>
  )
}

// ---------- 1. Welcome ----------

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome!</h1>
      <p className="mt-1 text-sm text-muted-foreground">Homes.ph SocMedSystem helps the team make the day&apos;s social media posts quickly.</p>

      <div className="mt-5 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-300" />
        <div>
          <div className="font-semibold">For internal use only</div>
          <p className="mt-1 text-muted-foreground">
            This app is not for everyone. It was built by <span className="font-medium text-foreground">Frank Gomez</span> for the team, to make the daily work done easily. Please
            don&apos;t share it outside the team.
          </p>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-semibold">What you can do</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-lg border bg-background/40 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div>
              <div className="text-sm font-medium">{title}</div>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <Footer>
        <Button type="button" variant="ghost" onClick={onNext}>
          Skip
        </Button>
        <Button type="button" onClick={onNext}>
          Continue <ArrowRight />
        </Button>
      </Footer>
    </div>
  )
}

// ---------- 2. Your pages ----------

function PagesStep({ initial, intro, nextLabel, onBack, onNext }: { initial: Assignment; intro?: string; nextLabel?: string; onBack?: () => void; onNext: (pages: Assignment) => void }) {
  const [value, setValue] = useState<Assignment>(initial)
  const [state, setState] = useState<Status>({ busy: false })
  const empty = !hasAnyPage(value) && !value.carousel

  const save = async () => {
    setState({ busy: true, message: "Saving your pages…" })
    try {
      onNext(await saveAssignment(value))
    } catch (e) {
      setState({ busy: false, ok: false, message: errorMessage(e) })
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Your assigned pages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {intro ?? "Tick the pages you handle. News Article, Poster Maker, Advertisement, the Daily Report and the Homes.ph Publisher extension show only these. You can change them later in Settings → Assigned pages."}
      </p>
      <div className="mt-5">
        <AssignedPagesPicker value={value} onChange={setValue} disabled={state.busy} />
      </div>
      <div className="mt-4">
        {empty ? <p className="text-sm text-amber-700 dark:text-amber-300">Tick at least one page, or turn on Carousel.</p> : <StatusLine status={state} />}
      </div>
      <Footer onBack={onBack}>
        <Button type="button" onClick={() => void save()} disabled={state.busy || empty}>
          {state.busy && <Loader2 className="animate-spin" />} {nextLabel ?? "Continue"} {!state.busy && <ArrowRight />}
        </Button>
      </Footer>
    </div>
  )
}

/** "Homes.ph Caraga, Gensan · FHI Global Dubai · Carousel" */
function pagesSummary(pages: Assignment | null | undefined): string {
  if (!pages) return "Not chosen yet."
  const homes = HOMES_PAGE_LIST.filter((p) => pages.homes.includes(p.key)).map((p) => p.short)
  const sites = SITE_PAGE_LIST.filter((p) => pages.sites.includes(p.key)).map((p) => p.name)
  const parts = [homes.length ? `Homes.ph ${homes.join(", ")}` : "", ...sites, pages.carousel ? "Carousel" : ""].filter(Boolean)
  return parts.length ? parts.join(" · ") : "None."
}

// ---------- 3. Your AI ----------

function AiStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [saved, setSaved] = useState<AiProviderConfig | null>(null)
  const [provider, setProvider] = useState<AiProviderId>("groq")
  const [key, setKey] = useState("")
  const [state, setState] = useState<Status>({ busy: false })
  const [tavilySaved, setTavilySaved] = useState(false)

  useEffect(() => {
    const load = () => {
      const config = getPosterAiConfig()
      setSaved(config)
      if (config) setProvider(config.provider)
      setTavilySaved(!!getTavilyKey())
    }
    load()
    window.addEventListener("dcm-poster-ai", load)
    window.addEventListener("dcm-tavily-key", load)
    return () => {
      window.removeEventListener("dcm-poster-ai", load)
      window.removeEventListener("dcm-tavily-key", load)
    }
  }, [])

  const info = aiProvider(provider)!
  const guide = GUIDES[provider]
  const usingSaved = !!saved && saved.provider === provider && !key.trim()

  const pick = (id: AiProviderId) => {
    setProvider(id)
    setState({ busy: false })
  }

  const connect = async (force: boolean) => {
    const k = key.trim() || (usingSaved ? saved!.key : "")
    if (!k) return setState({ busy: false, ok: false, message: "Paste your API key first." })
    if (looksLikeTavilyKey(k)) {
      try {
        setTavilyKey(k)
        setKey("")
        setState({ busy: false, ok: true, message: "That's a Tavily web-search key: it's saved for web search. Now paste an AI key (Groq, Gemini…)." })
      } catch (e) {
        setState({ busy: false, ok: false, message: errorMessage(e) })
      }
      return
    }
    let id = provider
    if (!force) {
      setState({ busy: true, message: "Checking the key…" })
      try {
        const found = await detectAiKey(k, provider).catch(async (first: unknown) => {
          // Maybe a key for another service than the one picked: find which.
          const other = await detectAiKey(k, "auto").catch(() => null)
          if (other && other.provider !== provider) return other
          throw first
        })
        id = found.provider
        if (id !== provider) setProvider(id)
        setState({ busy: true, message: `${providerName(id)} key found. Trying a short test…` })
        await testPosterAi({ provider: id, key: k })
      } catch (e) {
        const message = errorMessage(e)
        setState({ busy: false, ok: false, message, canForce: !BAD_KEY.test(message) })
        return
      }
    }
    const config: AiProviderConfig = { provider: id, key: k }
    try {
      setPosterAiConfig(config)
    } catch (e) {
      return setState({ busy: false, ok: false, message: errorMessage(e) })
    }
    setSaved(config)
    setKey("")
    setState({
      busy: false,
      ok: true,
      message: force ? `Saved without a test. If ${providerName(id)} doesn't answer later, check the key in Settings → AI.` : `Connected to ${providerName(id)}. The AI is ready.`,
    })
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Sparkles className="size-6 text-violet-600 dark:text-violet-300" /> This app uses AI
      </h1>
      <div className="mt-4 flex gap-3 rounded-lg border border-violet-500/40 bg-violet-500/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-300" />
        <div>
          <div className="font-semibold">Please set up your own AI to use this app</div>
          <p className="mt-1 text-muted-foreground">
            The AI writes the headlines, captions, hashtags and carousel slides and searches for trending news. The app doesn&apos;t come with an AI key, so connect your own. It
            takes about a minute, and <span className="font-medium text-foreground">Groq is free</span>.
          </p>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-semibold">1. Pick an AI service</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="AI service">
        {MAIN_PROVIDERS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={provider === id}
            onClick={() => pick(id)}
            className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-muted/60", provider === id && "border-primary bg-primary/5 ring-1 ring-primary")}
          >
            <div className="text-sm font-medium">{providerName(id)}</div>
            <div className={cn("text-xs", id === "groq" ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>{GUIDES[id].badge}</div>
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>More:</span>
        {MORE_PROVIDERS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={provider === id}
            onClick={() => pick(id)}
            className={cn("rounded-full border px-2.5 py-1 hover:bg-muted/60", provider === id && "border-primary bg-primary/5 text-foreground")}
          >
            {providerName(id)}
          </button>
        ))}
      </div>

      <h2 className="mt-6 text-sm font-semibold">2. Get your {info.name} key</h2>
      <div className="mt-2 rounded-lg border bg-background/40 p-4">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          {guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <a href={info.keyUrl} target="_blank" rel="noreferrer">
            Open the {guide.site} <ExternalLink />
          </a>
        </Button>
        {guide.note && <p className="mt-3 text-xs text-muted-foreground">{guide.note}</p>}
      </div>

      <h2 className="mt-6 text-sm font-semibold">3. Paste it here</h2>
      <form
        className="mt-2 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void connect(false)
        }}
      >
        <Label htmlFor="welcome-ai-key" className="sr-only">
          {info.name} API key
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="welcome-ai-key"
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value)
              if (!state.busy) setState({ busy: false })
            }}
            placeholder={usingSaved ? "Saved (paste another key to change it)" : `Your ${info.name} key (${info.keyHint})`}
            autoComplete="off"
            spellCheck={false}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={state.busy || (!key.trim() && !usingSaved)}>
            {state.busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {usingSaved ? "Check again" : "Connect"}
          </Button>
        </div>
        <StatusLine status={state} />
        {state.canForce && !state.busy && (
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => void connect(true)}>
              Save it anyway
            </Button>
            <span className="ml-2 text-xs text-muted-foreground">For example when the internet is down right now.</span>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" /> The key stays on this computer (encrypted by Windows) and is sent only to {info.name}. Change it any time in Settings → AI.
        </p>
      </form>

      <TavilyBox needed={!SEARCHES_TOO.includes(provider)} saved={tavilySaved} providerLabel={info.name} />

      <Footer onBack={onBack}>
        {!saved && <span className="text-xs text-muted-foreground">Connect an AI to continue.</span>}
        <Button type="button" onClick={onNext} disabled={!saved}>
          Continue <ArrowRight />
        </Button>
      </Footer>
    </div>
  )
}

/** Web search with Tavily: needed for Trending news and topic research with any AI but Groq. */
function TavilyBox({ needed, saved, providerLabel }: { needed: boolean; saved: boolean; providerLabel: string }) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState("")
  const [state, setState] = useState<Status>({ busy: false })
  const shown = open || needed

  const save = async () => {
    const k = key.trim()
    if (!looksLikeTavilyKey(k)) return setState({ busy: false, ok: false, message: "A Tavily key starts with tvly-." })
    setState({ busy: true, message: "Checking the Tavily key…" })
    try {
      const result = await tavilyStatus({ key: k, check: true })
      setTavilyKey(k)
      setKey("")
      setState({ busy: false, ok: true, message: `Tavily works${result.limit ? `: ${(result.used ?? 0).toLocaleString()} of ${result.limit.toLocaleString()} searches used this month` : ""}.` })
    } catch (e) {
      setState({ busy: false, ok: false, message: errorMessage(e) })
    }
  }

  return (
    <div className="mt-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="size-4" /> Web search with Tavily {needed ? "(needed for trending news)" : "(optional)"}
          {saved && <span className="text-xs font-normal text-emerald-700 dark:text-emerald-300">· saved</span>}
        </h2>
        {!needed && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Add a Tavily key"}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {needed
          ? `Trending news and topic research search the web. With ${providerLabel}, that needs a free Tavily key (1,000 searches a month). You can add it later in Settings → AI.`
          : `${providerLabel} can search the web too. A free Tavily key makes searches faster and cheaper (you can choose which one searches in Settings → AI).`}
      </p>
      {shown && (
        <div className="mt-3 flex flex-col gap-2">
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            <li>Open Tavily and sign up for free.</li>
            <li>Copy your API key from the dashboard (it starts with tvly-) and paste it here.</li>
          </ol>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" size="sm">
              <a href="https://app.tavily.com/home" target="_blank" rel="noreferrer">
                Open Tavily <ExternalLink />
              </a>
            </Button>
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={saved ? "Saved (paste another key to change it)" : "tvly-…"}
              autoComplete="off"
              spellCheck={false}
              aria-label="Tavily API key"
              className="h-8 sm:flex-1"
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => void save()} disabled={state.busy || !key.trim()}>
              {state.busy && <Loader2 className="animate-spin" />} Save
            </Button>
          </div>
          <StatusLine status={state} />
        </div>
      )}
    </div>
  )
}

// ---------- 3. Where the work is saved ----------

function StorageStep({ status, onBack, onSaved }: { status: DesktopSetupStatus; onBack: () => void; onSaved: (next: DesktopSetupStatus) => void }) {
  const desktop = useDesktop()
  const [choice, setChoice] = useState<StorageChoice>(status.done && status.mode === "account" ? "team" : status.storage.kind === "cloudinary" ? "cloud" : "local")
  const [folder, setFolder] = useState(status.storage.folder)
  const [cloudName, setCloudName] = useState(status.cloudinary.cloudName)
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [state, setState] = useState<Status>({ busy: false })
  const hasCloudKeys = status.cloudinary.hasApiKey && status.cloudinary.hasApiSecret

  const chooseFolder = async () => {
    const picked = await desktop?.setup?.chooseFolder().catch((e) => {
      setState({ busy: false, ok: false, message: errorMessage(e) })
      return null
    })
    if (picked) setFolder(picked)
  }

  const save = async () => {
    const setup = desktop?.setup
    if (!setup) return
    if (choice === "cloud" && (!cloudName.trim() || (!hasCloudKeys && (!apiKey.trim() || !apiSecret.trim())))) {
      return setState({ busy: false, ok: false, message: "Fill in the cloud name, API key and API secret." })
    }
    setState({ busy: true, message: choice === "cloud" ? "Checking your Cloudinary…" : choice === "team" ? "One moment…" : "Making your folder…" })
    try {
      if (choice === "team") {
        await setup.save({ mode: "account", done: true })
        window.location.replace("/login")
        return
      }
      const next = await setup.save({
        mode: "local",
        storageKind: choice === "cloud" ? "cloudinary" : "local",
        folder,
        ...(choice === "cloud" ? { cloudinary: { cloudName: cloudName.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() } } : {}),
      })
      setState({ busy: false })
      onSaved(next)
    } catch (e) {
      // "Error invoking remote method 'desktop:setup-save': Error: …" → just the reason.
      setState({ busy: false, ok: false, message: errorMessage(e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "") })
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Where should your work be saved?</h1>
      <p className="mt-1 text-sm text-muted-foreground">No account is needed. Pick how you want to keep your carousels, posts and photos.</p>

      <div className="mt-5 flex flex-col gap-3" role="radiogroup" aria-label="Where your work is saved">
        <Choice
          selected={choice === "local"}
          onSelect={() => setChoice("local")}
          icon={<HardDrive className="size-5" />}
          title="On this computer"
          badge="Recommended"
          text="Everything is saved in a folder on this computer, photos too. Nothing goes online."
        />
        <Choice
          selected={choice === "cloud"}
          onSelect={() => setChoice("cloud")}
          icon={<Cloud className="size-5" />}
          title="Photos online, in my own Cloudinary"
          text="Your photos are uploaded to your Cloudinary account (free plan: 25 GB). Your carousels are still saved in the folder below."
        />
        <Choice
          selected={choice === "team"}
          onSelect={() => setChoice("team")}
          icon={<Users className="size-5" />}
          title="I have a Homes.ph team account"
          text="Sign in to share carousels with teammates in the team cloud."
        />
      </div>

      {choice !== "team" && (
        <div className="mt-5 rounded-lg border bg-background/40 p-4">
          <div className="text-sm font-semibold">Your work folder</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs" title={folder}>
              {folder}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={() => void chooseFolder()}>
              <FolderOpen /> Change…
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Your carousels and news posts go in its <span className="font-mono">projects</span> folder{choice === "local" ? <>, your photos in <span className="font-mono">images</span></> : null}. To
            back up, copy this whole folder. Exported pictures still go to your Downloads folder.
          </p>
          {folder !== status.defaultFolder && (
            <button type="button" className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setFolder(status.defaultFolder)}>
              Use the default folder (Documents\Daily Carousel Maker)
            </button>
          )}
        </div>
      )}

      {choice === "cloud" && (
        <div className="mt-4 rounded-lg border bg-background/40 p-4">
          <div className="text-sm font-semibold">Your Cloudinary</div>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm">
            <li>Open Cloudinary and sign in (or sign up for free).</li>
            <li>Go to Settings → API Keys. Copy the Cloud name shown at the top, then an API key and its API secret.</li>
          </ol>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href="https://console.cloudinary.com/settings/api-keys" target="_blank" rel="noreferrer">
              Open Cloudinary <ExternalLink />
            </a>
          </Button>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="welcome-cloud-name">Cloud name</Label>
              <Input id="welcome-cloud-name" value={cloudName} onChange={(e) => setCloudName(e.target.value)} placeholder="for example dxyz123ab" autoComplete="off" spellCheck={false} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="welcome-cloud-key">API key</Label>
              <Input id="welcome-cloud-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={status.cloudinary.hasApiKey ? "Saved" : "15 digits"} autoComplete="off" spellCheck={false} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="welcome-cloud-secret">API secret</Label>
              <Input
                id="welcome-cloud-secret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={status.cloudinary.hasApiSecret ? "Saved" : "API secret"}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Saved only in this app&apos;s settings on this computer.
          </p>
        </div>
      )}

      {choice === "team" && (
        <p className="mt-4 text-sm text-muted-foreground">You&apos;ll sign in with the email and password from your team. Ask Frank Gomez for an account if you don&apos;t have one.</p>
      )}

      <div className="mt-4">
        <StatusLine status={state} />
      </div>

      <Footer onBack={onBack}>
        <Button type="button" onClick={() => void save()} disabled={state.busy}>
          {state.busy && <Loader2 className="animate-spin" />}
          {choice === "team" ? "Sign in" : "Continue"} {!state.busy && <ArrowRight />}
        </Button>
      </Footer>
    </div>
  )
}

function Choice({ selected, onSelect, icon, title, badge, text }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; badge?: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn("flex gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/60", selected && "border-primary bg-primary/5 ring-1 ring-primary")}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{icon}</span>
      <span>
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {title}
          {badge && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">{badge}</span>}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
      </span>
    </button>
  )
}

// ---------- 4. Ready ----------

function DoneStep({ status, onBack }: { status: DesktopSetupStatus; onBack: () => void }) {
  const desktop = useDesktop()
  // Shown only in the browser (after the setup was read), so the saved key can be read right away.
  const [ai] = useState<AiProviderConfig | null>(() => getPosterAiConfig())
  const [state, setState] = useState<Status>({ busy: false })

  const openFolder = () => void desktop?.setup?.openFolder().catch((e) => setState({ busy: false, ok: false, message: errorMessage(e) }))

  const start = async () => {
    setState({ busy: true, message: "Opening the app…" })
    try {
      await desktop?.setup?.save({ done: true })
      // A full load: the app now opens with these choices.
      window.location.replace("/home")
    } catch (e) {
      setState({ busy: false, ok: false, message: errorMessage(e) })
    }
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-300" /> You&apos;re all set
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Here&apos;s how the app is set up. You can change all of it later in Settings.</p>

      <dl className="mt-5 flex flex-col gap-3 text-sm">
        <div className="rounded-lg border bg-background/40 p-4">
          <dt className="flex items-center gap-2 font-medium">
            <Users className="size-4 text-primary" /> Your pages
          </dt>
          <dd className="mt-1 text-muted-foreground">{pagesSummary(status.pages)} Settings → Assigned pages to change them.</dd>
        </div>
        <div className="rounded-lg border bg-background/40 p-4">
          <dt className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4 text-violet-600 dark:text-violet-300" /> AI
          </dt>
          <dd className="mt-1 text-muted-foreground">{ai ? `${providerName(ai.provider)} (your own key). Settings → AI to change it.` : "Not connected yet."}</dd>
        </div>
        <div className="rounded-lg border bg-background/40 p-4">
          <dt className="flex items-center gap-2 font-medium">
            <HardDrive className="size-4" /> Your work is saved in
          </dt>
          <dd className="mt-1 flex flex-col gap-2">
            <code className="truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs" title={status.storage.folder}>
              {status.storage.folder}
            </code>
            <span className="text-xs text-muted-foreground">
              {status.storage.kind === "cloudinary" ? "Photos go to your Cloudinary; everything else is in this folder." : "Everything, photos too, is in this folder."} Open it any time from Settings → Where
              your work is saved.
            </span>
            <span>
              <Button type="button" variant="outline" size="sm" onClick={openFolder}>
                <FolderOpen /> Open the folder
              </Button>
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <StatusLine status={state} />
      </div>

      <Footer onBack={onBack}>
        <Button type="button" onClick={() => void start()} disabled={state.busy}>
          {state.busy && <Loader2 className="animate-spin" />} Start using the app {!state.busy && <ArrowRight />}
        </Button>
      </Footer>
    </div>
  )
}
