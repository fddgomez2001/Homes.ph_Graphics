"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format, isToday, isTomorrow, isValid, isYesterday, parse, startOfDay } from "date-fns"
import { AlertTriangle, Check, ChevronLeft, ChevronRight, ClipboardCheck, Copy, FileText, ImageDown, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast, type ExternalToast } from "sonner"
import { ThemeToggle } from "@/components/theme/theme"
import { Button } from "@/components/ui/button"
import { DETAILS_MAX } from "@/lib/ai/headlines"
import { loadReportData, type ReportCarousel, type ReportData, type ReportPoster } from "@/lib/data/report"
import { LOGO_BLUE_SRC, PICKLEPLAY_LOGO_SRC } from "@/lib/design/constants"
import { coverTitle } from "@/lib/design/cover-title"
import { newsFileName, newsTimeLabel, type DailyBrand } from "@/lib/design/news-templates"
import { useAssignment } from "@/lib/assignment"
import { isPageLane, laneTimesOf, type ReportBrand } from "@/lib/news-lanes"
import { homesPage } from "@/lib/pages"
import { getDesktop } from "@/lib/desktop"
import { FHI_EMBLEM_SRC } from "@/lib/report/daily-report"
import { fileSize, renderCarouselCollage, renderFullSize, saveReportImage, type SavedReportFile } from "@/lib/report/report-files"
import {
  CAROUSEL_DETAILS,
  CAROUSEL_TITLE_LINE,
  carouselUpdateText,
  clockLabel,
  postingDetails,
  postingLine,
  postingTitle,
  reportBrandInfo,
  trendBrandName,
  trendHeadline,
  trendLabel,
  trendText,
} from "@/lib/report/report-texts"
import { headlineOf, posterFolder, posterPage, posterSubtext, saveTrendDetails, trendGroups, writeTrendDetails } from "@/lib/report/trend-news"
import { cn, errorMessage } from "@/lib/utils"

type Tab = "news" | "trends" | "carousel"
const TABS: { id: Tab; label: string }[] = [
  { id: "news", label: "News Article Posting" },
  { id: "trends", label: "Daily Trend News" },
  { id: "carousel", label: "Carousel" },
]
const TAB_KEY = "dcm-report-float-tab"
const isTab = (v: string | null | undefined): v is Tab => TABS.some((t) => t.id === v)

const NEWS_LOGOS: Record<DailyBrand, string> = { pickleplay: PICKLEPLAY_LOGO_SRC, fhi: FHI_EMBLEM_SRC, caraga: LOGO_BLUE_SRC, gensan: LOGO_BLUE_SRC }
const logoOf = (brand: ReportBrand) => (isPageLane(brand) ? LOGO_BLUE_SRC : NEWS_LOGOS[brand])
/** The report folder of a row: its brand's, or the Homes.ph page's ("homes:Cebu" → Homes.ph Cebu). */
const folderOf = (brand: ReportBrand) => (isPageLane(brand) ? (`homes:${homesPage(brand.slice(6) as Parameters<typeof homesPage>[0]).short}` as const) : brand)

const noSubscribe = () => () => {}

/** Notices at the top of this small window: at the bottom they'd cover the strip that says what was copied. */
const note = {
  info: (message: string, options: ExternalToast = {}) => toast.info(message, { position: "top-center", ...options }),
  error: (message: string, options: ExternalToast = {}) => toast.error(message, { position: "top-center", ...options }),
}
function storedTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_KEY)
    return isTab(v) ? v : "news"
  } catch {
    return "news"
  }
}

function dayOf(value: string | null) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : null
  return parsed && isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date())
}
const dayName = (day: Date) => (isToday(day) ? "Today" : isTomorrow(day) ? "Tomorrow" : isYesterday(day) ? "Yesterday" : format(day, "EEEE"))

/** Puts text on the clipboard (the older way when the Clipboard API isn't allowed). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement("textarea")
      area.value = text
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.opacity = "0"
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand("copy")
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

interface Copied {
  label: string
  text: string
  /** When: each copy flashes the strip again. */
  at: number
}

/** The picture saved with the last copy (an article, a poster, the carousel). */
interface Saving {
  label: string
  status: "saving" | "saved" | "failed"
  file?: SavedReportFile
  error?: string
  at: number
}

/** "…\New Article Posting\Pickleplay\2026-11-06 9AM Pickleplay.ph.png" */
function shortPath(where: string) {
  const parts = where.split(/[\\/]/)
  return parts.length > 3 ? `…\\${parts.slice(-3).join("\\")}` : where
}

/**
 * The floating report: a small always-on-top window with the day's report lines, each one a
 * click away on the clipboard. News Article Posting (each brand's title, details and one line
 * per posting time with the article's link), Daily Trend News (the posters, with AI details) and
 * the Carousel line (written by AI).
 */
export function ReportFloat() {
  const params = useSearchParams()
  const router = useRouter()
  const day = dayOf(params.get("day"))
  const dayKey = format(day, "yyyy-MM-dd")
  const remembered = useSyncExternalStore(noSubscribe, storedTab, () => "news" as Tab)
  const asked = params.get("tab")
  // The Carousel tab only for the people who make the carousel (Settings → Assigned pages).
  const { assignment } = useAssignment()
  const tabs = TABS.filter((t) => t.id !== "carousel" || assignment.carousel)
  const wantedTab: Tab = isTab(asked) ? asked : remembered
  const tab: Tab = tabs.some((t) => t.id === wantedTab) ? wantedTab : "news"

  const [data, setData] = useState<{ key: string; report: ReportData } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)
  const [copied, setCopied] = useState<Copied | null>(null)
  const [saving, setSaving] = useState<Saving | null>(null)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const lastFocusLoad = useRef(0)

  const go = (next: { day?: Date; tab?: Tab }) => {
    const q = new URLSearchParams()
    const d = next.day ?? day
    if (!isToday(d)) q.set("day", format(d, "yyyy-MM-dd"))
    q.set("tab", next.tab ?? tab)
    if (next.tab) {
      try {
        localStorage.setItem(TAB_KEY, next.tab)
      } catch {
        // remembered for this window only
      }
    }
    router.replace(`/report-float?${q}`, { scroll: false })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const report = await loadReportData(parse(dayKey, "yyyy-MM-dd", new Date()))
        if (cancelled) return
        setError(null)
        setData({ key: dayKey, report })
      } catch (e) {
        if (!cancelled) setError(errorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dayKey, version])

  // Fresh when something is saved in the app (another window) and when coming back to this window.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const soon = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setVersion((v) => v + 1), 500)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("dcm-invalidated:projects:")) soon()
    }
    const onFocus = () => {
      if (Date.now() - lastFocusLoad.current < 8000) return
      lastFocusLoad.current = Date.now()
      soon()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  const report = data?.key === dayKey ? data.report : null

  /** Copies and shows what was copied at the bottom. */
  const copy = async (label: string, text: string) => {
    if (await copyText(text)) {
      // The strip at the bottom says what was copied (a toast would cover it in this small window).
      setCopied({ label, text, at: Date.now() })
      return true
    }
    note.error("Couldn't copy", { description: "Click inside this window first, then try again." })
    return false
  }

  /** Saves a picture after a copy, one at a time; the strip at the bottom says where it went. */
  const save: OnSave = (label, job) => {
    const at = Date.now()
    setSaving({ label, status: "saving", at })
    const run = saveQueue.current
      .catch(() => {})
      .then(job)
      .then(
        (file) => setSaving((s) => (s?.at === at ? { label, status: "saved", file, at } : s)),
        (e) => {
          setSaving((s) => (s?.at === at ? { label, status: "failed", error: errorMessage(e), at } : s))
          note.error(`Couldn't save the ${label} picture`, { description: errorMessage(e) })
        },
      )
    saveQueue.current = run
  }

  /** The newest data now (e.g. a headline was just typed in the app). */
  const fresh = async () => {
    const next = await loadReportData(parse(dayKey, "yyyy-MM-dd", new Date()))
    setData({ key: dayKey, report: next })
    return next
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-background/95 px-3 pt-3 pb-2 backdrop-blur">
        <div className="flex items-center gap-1">
          <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
          <h1 className="flex-1 text-sm font-semibold tracking-tight">Daily Report</h1>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Refresh" title="Refresh" onClick={() => setVersion((v) => v + 1)}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
          <ThemeToggle className="size-8" />
        </div>
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Previous day" onClick={() => go({ day: addDays(day, -1) })}>
            <ChevronLeft />
          </Button>
          <p className="flex-1 text-center text-[13px] leading-tight" aria-live="polite">
            <span className="font-semibold">{dayName(day)}</span> <span className="text-muted-foreground">· {format(day, "MMMM d, yyyy")}</span>
          </p>
          {!isToday(day) && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => go({ day: new Date() })}>
              Today
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8" aria-label="Next day" onClick={() => go({ day: addDays(day, 1) })}>
            <ChevronRight />
          </Button>
        </div>
        <nav className={cn("grid gap-1 rounded-xl bg-muted p-1", tabs.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="tablist" aria-label="Report sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="report-float-panel"
              onClick={() => go({ tab: t.id })}
              className={cn(
                "rounded-lg px-1.5 py-1.5 text-[12px] leading-tight font-medium transition-colors",
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div id="report-float-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-1 flex-col gap-3 p-3">
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {!report ? (
          !error && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading the day…
            </p>
          )
        ) : tab === "news" ? (
          <NewsPosting report={report} onCopy={copy} onSave={save} fresh={fresh} />
        ) : tab === "trends" ? (
          <TrendNews day={report.today.day} posters={report.today.posters ?? []} onCopy={copy} onSave={save} />
        ) : (
          <CarouselLines carousels={report.today.carousels} onCopy={copy} onSave={save} />
        )}
      </div>

      <footer className="sticky bottom-0 border-t bg-background/95 px-3 py-2 backdrop-blur" aria-live="polite">
        {copied ? (
          <div key={copied.at} className="-mx-1.5 flex animate-in items-start gap-2 rounded-lg bg-emerald-500/10 px-1.5 py-1 duration-300 fade-in slide-in-from-bottom-1">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">Copied · {copied.label}</p>
              <p className="line-clamp-3 text-[12px] leading-snug whitespace-pre-line">{copied.text}</p>
            </div>
          </div>
        ) : (
          <p className="text-center text-[11px] text-muted-foreground">Click a logo, Details, a time or a DTN to copy it. Green times have an article.</p>
        )}
        {saving && <SaveStatus saving={saving} />}
      </footer>
    </main>
  )
}

type OnCopy = (label: string, text: string) => Promise<boolean>
type OnSave = (label: string, job: () => Promise<SavedReportFile>) => void

function SaveStatus({ saving }: { saving: Saving }) {
  const desktop = getDesktop()
  const file = saving.file
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground" role="status">
      {saving.status === "saving" ? (
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
      ) : saving.status === "saved" ? (
        <ImageDown className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-3 shrink-0 text-destructive" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate" title={file?.where ?? saving.error}>
        {saving.status === "saving"
          ? `Saving the ${saving.label} picture…`
          : saving.status === "saved" && file
            ? `${file.desktop ? `Saved ${shortPath(file.where)}` : `Downloaded ${file.where}`} · ${fileSize(file.bytes)}`
            : `Couldn't save the picture: ${saving.error}`}
      </span>
      {saving.status === "saved" && file?.desktop && desktop?.showFile && (
        <button type="button" className="shrink-0 font-medium text-primary hover:underline" onClick={() => void desktop.showFile?.(file.where).catch(() => {})}>
          Show
        </button>
      )}
    </div>
  )
}

/** A brand logo that copies a line (with a ring on hover and a check after copying). */
function CopyLogo({ src, label, title, onCopy, className }: { src: string; label: string; title: string; onCopy: () => void | Promise<unknown>; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      aria-label={label}
      title={title}
      className={cn(
        "group relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white p-1 ring-1 ring-black/5 transition hover:ring-2 hover:ring-primary/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-full object-contain" draggable={false} />
      <span className="absolute -right-1 -bottom-1 flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <Copy className="size-2.5" aria-hidden="true" />
      </span>
    </button>
  )
}

/** The elegant "Details" box beside a logo: copies the details line. */
function DetailsButton({ name, text, onCopy }: { name: string; text: string; onCopy: () => void | Promise<unknown> }) {
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title={`Copy: ${text}`}
      aria-label={`Copy the ${name} details`}
      className="group flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/25 bg-gradient-to-b from-primary/10 to-primary/5 px-3 py-2 text-[12px] font-semibold text-primary shadow-xs transition hover:border-primary/50 hover:from-primary/15 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95"
    >
      <FileText className="size-3.5" aria-hidden="true" /> Details
      <Copy className="size-3 opacity-60 group-hover:opacity-100" aria-hidden="true" />
    </button>
  )
}

function Section({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section aria-label={label} className="rounded-2xl border bg-card p-3 shadow-xs">
      {children}
    </section>
  )
}

// ---------- News Article Posting ----------

function NewsPosting({ report, onCopy, onSave, fresh }: { report: ReportData; onCopy: OnCopy; onSave: OnSave; fresh: () => Promise<ReportData> }) {
  const postAt = (r: ReportData, brand: ReportBrand, time: string) => r.today.posts.find((p) => p.brand === brand && p.time === time)
  const headlineAt = (r: ReportData, brand: ReportBrand, time: string) => {
    const post = postAt(r, brand, time)
    return post ? headlineOf(post.design) : ""
  }

  /** The time's line on the clipboard, and the post's picture saved (New Article Posting\<brand>). */
  const copySlot = async (brand: ReportBrand, time: string) => {
    let current = report
    // Not here yet: maybe it was just typed in the app.
    if (!headlineAt(current, brand, time)) current = await fresh().catch(() => report)
    const post = postAt(current, brand, time)
    const headline = post ? headlineOf(post.design) : ""
    const name = reportBrandInfo(brand).name
    const label = `${name} · ${clockLabel(time)}`
    if (!post || !headline) return void note.info(`No article at ${clockLabel(time)} yet`, { description: `Add its headline on News Article (${name}).` })
    if (!(await onCopy(label, postingLine(brand, time, headline)))) return
    const fileName = newsFileName(current.today.day, { time, label: newsTimeLabel(time) }, name).replace(/\.png$/i, "")
    onSave(label, async () => saveReportImage(await renderFullSize(post.design), "news", folderOf(brand), fileName))
  }

  return (
    <>
      {!report.brands.length && <p className="px-1 py-6 text-sm text-muted-foreground">None of your assigned pages has News Article posts (Settings → Assigned pages).</p>}
      {report.brands.map((id) => {
        const b = { id }
        const name = reportBrandInfo(b.id).name
        const times = laneTimesOf(b.id)
        const done = times.filter((t) => headlineAt(report, b.id, t.time)).length
        return (
          <Section key={b.id} label={`${name} article posting`}>
            <div className="flex items-center gap-3">
              <CopyLogo
                src={logoOf(b.id)}
                label={`Copy “${postingTitle(b.id)}”`}
                title={`Copy: ${postingTitle(b.id)}`}
                onCopy={() => onCopy(`${name} · title`, postingTitle(b.id))}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {done} of {times.length} articles
                </p>
              </div>
              <DetailsButton name={name} text={postingDetails(b.id)} onCopy={() => onCopy(`${name} · details`, postingDetails(b.id))} />
            </div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(62px,1fr))] gap-1.5" role="group" aria-label={`${name} posting times`}>
              {times.map((t) => {
                const headline = headlineAt(report, b.id, t.time)
                return (
                  <button
                    key={t.time}
                    type="button"
                    onClick={() => void copySlot(b.id, t.time)}
                    title={headline ? `Copy: [${clockLabel(t.time)}] ${headline}` : `No article at ${clockLabel(t.time)} yet`}
                    aria-label={headline ? `Copy the ${clockLabel(t.time)} article: ${headline}` : `${clockLabel(t.time)}: no article yet`}
                    className={cn(
                      "rounded-full border px-1 py-1.5 text-center text-[11.5px] font-semibold whitespace-nowrap tabular-nums transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95",
                      headline
                        ? "border-emerald-500/50 bg-emerald-500/12 text-emerald-800 hover:bg-emerald-500/22 dark:text-emerald-300"
                        : "border-dashed text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {clockLabel(t.time)}
                  </button>
                )
              })}
            </div>
          </Section>
        )
      })}
    </>
  )
}

// ---------- Daily Trend News ----------

function TrendNews({ day, posters, onCopy, onSave }: { day: Date; posters: ReportPoster[]; onCopy: OnCopy; onSave: OnSave }) {
  // The brands, then each other Homes.ph page with posters that day ("Homes.ph Cebu").
  const groups = trendGroups(posters)
  const untitled = posters.filter((p) => !headlineOf(p.design)).length
  return (
    <>
      {groups.map((g) => (
        <Section key={g.id} label={`${g.name} Daily Trend News`}>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white p-1 ring-1 ring-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.logo} alt="" className="size-full object-contain" draggable={false} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{g.name}</p>
              <p className="text-[11px] text-muted-foreground">{g.posters.length ? `${g.posters.length} poster${g.posters.length === 1 ? "" : "s"}` : "No posters on this day"}</p>
            </div>
          </div>
          {g.posters.length > 0 && (
            <ol className="mt-3 flex flex-col gap-2">
              {g.posters.map((p, i) => (
                <TrendItem key={p.project.id} day={day} poster={p} n={i + 1} onCopy={onCopy} onSave={onSave} />
              ))}
            </ol>
          )}
        </Section>
      ))}
      {untitled > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">
          {untitled} poster{untitled === 1 ? "" : "s"} without a headline {untitled === 1 ? "isn't" : "aren't"} listed.
        </p>
      )}
    </>
  )
}

function TrendItem({ day, poster, n, onCopy, onSave }: { day: Date; poster: ReportPoster; n: number; onCopy: OnCopy; onSave: OnSave }) {
  const page = posterPage(poster)
  const name = trendBrandName(poster.brand, page)
  const headline = headlineOf(poster.design)
  const subtext = posterSubtext(poster.design)
  const saved = poster.project.topic ?? ""
  const [details, setDetails] = useState(saved)
  const [seen, setSeen] = useState(saved)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  // Saved somewhere else (the Poster Maker, another window): show it, unless it's being typed here.
  if (saved !== seen) {
    setSeen(saved)
    if (!editing) setDetails(saved)
  }
  const label = trendLabel(name, n)

  const save = async (text: string) => {
    try {
      await saveTrendDetails(poster, text)
    } catch (e) {
      note.error("Couldn't save the details", { description: errorMessage(e) })
    }
  }

  const write = async () => {
    setBusy(true)
    try {
      // With the article from "Write from article" when it was this poster's.
      const { details: next, fellBack } = await writeTrendDetails({ name, headline, subtext, caption: poster.project.caption ?? "" })
      setDetails(next)
      await save(next)
      if (fellBack) note.info("Written by the built-in AI", { description: fellBack })
      return next
    } catch (e) {
      note.error("Couldn't write the details", { description: errorMessage(e) })
      return null
    } finally {
      setBusy(false)
    }
  }

  /** The whole entry (without details the AI writes them first), and the poster saved (Daily Trend News\<brand>). */
  const copyEntry = async () => {
    let text = details.trim()
    if (!text) text = (await write()) ?? ""
    const when = poster.project.scheduled_at ? new Date(poster.project.scheduled_at) : day
    if (!(await onCopy(label, trendText({ name, n, day: when, headline, subtext, details: text })))) return
    onSave(label, async () => saveReportImage(await renderFullSize(poster.design), "trends", posterFolder(poster.brand, page), `${format(when, "yyyy-MM-dd")} ${label}`))
  }

  return (
    <li className="rounded-xl border bg-background/60 p-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void copyEntry()}
          disabled={busy}
          title={`Copy ${label}`}
          className="group flex min-w-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[12px] font-semibold text-primary transition hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95 disabled:opacity-70"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          <span className="truncate">[ {label} ]</span>
        </button>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">{poster.time ? clockLabel(poster.time) : ""}</span>
      </div>
      <p className="mt-2 text-[13px] leading-snug font-medium">{trendHeadline(headline, subtext)}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <label htmlFor={`details-${poster.project.id}`} className="text-[11px] font-medium text-muted-foreground">
          Details
        </label>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-violet-700 dark:text-violet-300" onClick={() => void write()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {details.trim() ? "Write again" : "Write with AI"}
        </Button>
      </div>
      <textarea
        id={`details-${poster.project.id}`}
        value={details}
        onChange={(e) => setDetails(e.target.value.replace(/\n+/g, " ").slice(0, DETAILS_MAX))}
        onFocus={() => setEditing(true)}
        onBlur={(e) => {
          setEditing(false)
          void save(e.currentTarget.value)
        }}
        rows={2}
        placeholder="What the news is about and why it's a trend (Write with AI, or type it)."
        className="mt-1 field-sizing-content min-h-12 w-full resize-none rounded-lg border border-input bg-card px-2 py-1.5 text-[12px] leading-snug outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    </li>
  )
}

// ---------- Carousel ----------

/**
 * The day's carousels for the report: the Homes.ph logo copies the title line and Details the
 * carousel details; each carousel's schedule line (every page ✅) is shown and can be copied once
 * every page is ticked on the posting checklist (with the carousel saved as one picture).
 */
function CarouselLines({ carousels, onCopy, onSave }: { carousels: ReportCarousel[]; onCopy: OnCopy; onSave: OnSave }) {
  return (
    <Section label="Carousel">
      <div className="flex items-center gap-3">
        <CopyLogo
          src={LOGO_BLUE_SRC}
          label={`Copy “${CAROUSEL_TITLE_LINE}”`}
          title={`Copy: ${CAROUSEL_TITLE_LINE}`}
          onCopy={() => onCopy("Carousel · title", CAROUSEL_TITLE_LINE)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">Homes.ph Pages</p>
          <p className="text-[11px] text-muted-foreground">
            {carousels.length ? `${carousels.length} carousel${carousels.length === 1 ? "" : "s"} on this day` : "No carousel on this day"}
          </p>
        </div>
        <DetailsButton name="carousel" text={CAROUSEL_DETAILS} onCopy={() => onCopy("Carousel · details", CAROUSEL_DETAILS)} />
      </div>
      {carousels.map((c) => (
        <CarouselSchedule key={c.project.id} carousel={c} onCopy={onCopy} onSave={onSave} />
      ))}
    </Section>
  )
}

function CarouselSchedule({ carousel, onCopy, onSave }: { carousel: ReportCarousel; onCopy: OnCopy; onSave: OnSave }) {
  const { project, slides } = carousel
  const title = (slides[0] ? coverTitle(slides[0]) : "") || project.title
  const at = project.scheduled_at ? new Date(project.scheduled_at) : null
  const posted = carousel.postedPages.length
  const total = posted + carousel.pagesLeft.length
  // Every Homes.ph page ticked on the posting checklist: the line can go in the report.
  const complete = posted > 0 && carousel.pagesLeft.length === 0
  const pages = [...carousel.postedPages.map((p) => ({ ...p, done: true })), ...carousel.pagesLeft.map((p) => ({ ...p, done: false }))].sort((a, b) => a.sort - b.sort)
  const text = carouselUpdateText({ title, at, pages })

  /** The schedule line on the clipboard, and the carousel saved as one picture (Carousel). */
  const copy = async () => {
    if (!complete || !(await onCopy("Carousel · scheduled", text))) return
    const day = format(at ?? new Date(), "yyyy-MM-dd")
    onSave("carousel", async () => saveReportImage(await renderCarouselCollage(slides), "carousel", "", `${day} Carousel ${title}`, { tryPng: false }))
  }

  return (
    <div className="mt-3 rounded-xl border bg-background/60 p-2.5">
      <div className="flex items-center gap-2">
        <p className="line-clamp-1 min-w-0 flex-1 text-[13px] font-semibold">{title}</p>
        <span className={cn("shrink-0 text-[11px] tabular-nums", complete ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
          {total ? `${posted}/${total} posted` : "No checklist"}
        </span>
      </div>
      <div aria-label={`Carousel schedule: ${title}`} className="mt-2 rounded-lg border bg-card px-2.5 py-2 text-[12px] leading-relaxed whitespace-pre-line">
        {text}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {!complete && (
          <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">
            {total ? `Copy unlocks when all ${total} pages are ticked on the posting checklist.` : "The posting checklist isn't set up."}
          </span>
        )}
        <Button
          type="button"
          size="sm"
          className="h-7 bg-emerald-600 text-[12px] text-white hover:bg-emerald-700"
          onClick={() => void copy()}
          disabled={!complete}
          title={complete ? "Copy the schedule line and save the carousel as one picture" : "Every page must be posted first"}
        >
          <Copy /> Copy
        </Button>
      </div>
    </div>
  )
}
