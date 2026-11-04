"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, isToday } from "date-fns"
import { ArrowLeft, ClipboardList, GalleryHorizontalEnd, Newspaper, RefreshCw, Settings, WifiOff } from "lucide-react"
import { SetupGate } from "@/components/app-shell/setup-gate"
import { BrandMark } from "@/components/brand-mark"
import { ExportProvider } from "@/components/export/export-provider"
import { invalidateProjects } from "@/components/projects/use-projects"
import { DailyReport, reportDay } from "@/components/report/daily-report-page"
import { SiteCarousel } from "@/components/site/site-carousel"
import { SiteHome } from "@/components/site/site-home"
import { SiteLinksProvider, type SiteLinks } from "@/components/site/site-links"
import { ThemeToggle } from "@/components/theme/theme"
import { Button } from "@/components/ui/button"
import { pruneCache } from "@/lib/cache"
import { isSupabaseConfigured } from "@/lib/env"
import { getSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { MobileLogin } from "./mobile-login"
import { MobileNews } from "./mobile-news"
import { MobileSettings } from "./mobile-settings"
import { useNativeShell } from "./native-shell"

type Tab = "carousels" | "news" | "report" | "settings"

const TABS: { id: Tab; label: string; title: string; icon: typeof Settings }[] = [
  { id: "carousels", label: "Carousels", title: "Carousels", icon: GalleryHorizontalEnd },
  { id: "news", label: "News", title: "News posts", icon: Newspaper },
  { id: "report", label: "Report", title: "Daily report", icon: ClipboardList },
  { id: "settings", label: "Settings", title: "Settings", icon: Settings },
]

const isTab = (value: string | null): value is Tab => TABS.some((t) => t.id === value)

/** Tabs and days switch in place (no new history entry); opening a carousel adds one, so Back closes it. */
function replaceQuery(change: Record<string, string | null>) {
  const query = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(change)) {
    if (value === null) query.delete(key)
    else query.set(key, value)
  }
  window.history.replaceState(null, "", query.size ? `/?${query}` : "/")
}

type Session = "loading" | "in" | "out"

function useSession(): Session {
  const [session, setSession] = useState<Session>(() => (isSupabaseConfigured() ? "loading" : "out"))
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => setSession(data.session ? "in" : "out"))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ? "in" : "out"))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  return online
}

/**
 * The Android app: one page with four tabs (carousels to post, the day's news
 * posts, the daily report, settings). A carousel opens on top of the list, so
 * going back returns to the same place in it.
 */
export function MobileApp() {
  const session = useSession()
  const params = useSearchParams()
  useNativeShell(session !== "loading")

  useEffect(() => {
    const idle = (fn: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500))
    idle(() => {
      pruneCache()
      void import("@/lib/design/render").catch(() => {})
    })
  }, [])

  if (session === "loading") return <Splash />
  if (session === "out") return <MobileLogin error={params.get("error")} />
  return <SignedIn />
}

function SignedIn() {
  const params = useSearchParams()
  const router = useRouter()
  const online = useOnline()
  const tabParam = params.get("tab")
  const tab: Tab = isTab(tabParam) ? tabParam : "carousels"
  const openId = params.get("id")
  const query = params.toString()

  // Tabs stay mounted once opened: switching back is instant and keeps the scroll position.
  const [visited, setVisited] = useState<Tab[]>([tab])
  if (!visited.includes(tab)) setVisited([...visited, tab])
  const scrolls = useRef(new Map<Tab, number>())
  const shownTab = useRef(tab)
  useLayoutEffect(() => {
    if (shownTab.current === tab) return
    shownTab.current = tab
    window.scrollTo({ top: scrolls.current.get(tab) ?? 0 })
  }, [tab])

  const links = useMemo<SiteLinks>(() => {
    const base = new URLSearchParams(query)
    base.delete("id")
    const href = (change: Record<string, string | null>) => {
      const next = new URLSearchParams(base)
      for (const [key, value] of Object.entries(change)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      return next.size ? `/?${next}` : "/"
    }
    return {
      home: href({}),
      carousel: (id) => href({ id }),
      show: (show) => href({ show: show === "to-post" ? null : show }),
      app: true,
    }
  }, [query])

  const goTab = (next: Tab) => {
    if (next === tab) {
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    scrolls.current.set(tab, window.scrollY)
    replaceQuery({ tab: next === "carousels" ? null : next, id: null })
  }

  // The carousel sheet: Back returns to the list it was opened from.
  const openedHere = useRef(false)
  useEffect(() => {
    if (!openId) openedHere.current = true
  }, [openId])
  const closeCarousel = useCallback(() => {
    if (openedHere.current && window.history.length > 1) router.back()
    else replaceQuery({ id: null })
  }, [router])

  const [refreshing, setRefreshing] = useState(false)
  const refresh = () => {
    invalidateProjects()
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 700)
  }
  const title = TABS.find((t) => t.id === tab)!.title

  return (
    <SiteLinksProvider value={links}>
      <ExportProvider>
        <div className="min-h-dvh bg-[#F6F7FA] text-foreground dark:bg-background">
          <header className="pt-safe sticky top-0 z-30 border-b border-border/70 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-2.5 px-4">
              <BrandMark className="size-7" />
              <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight">{title}</h1>
              {(tab === "carousels" || tab === "news") && (
                <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Refresh" onClick={refresh}>
                  <RefreshCw className={cn(refreshing && "animate-spin")} />
                </Button>
              )}
              <ThemeToggle />
            </div>
            {!online && (
              <p className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                <WifiOff className="size-3.5" /> Offline — showing what was saved on this phone
              </p>
            )}
          </header>

          <SetupGate>
            <div className="pb-nav">
              {visited.map((t) => (
                <section key={t} hidden={t !== tab} aria-label={TABS.find((x) => x.id === t)!.title}>
                  <TabView tab={t} />
                </section>
              ))}
            </div>
            {openId && <CarouselSheet id={openId} onClose={closeCarousel} />}
          </SetupGate>

          <BottomNav tab={tab} onTab={goTab} />
        </div>
      </ExportProvider>
    </SiteLinksProvider>
  )
}

function TabView({ tab }: { tab: Tab }) {
  if (tab === "news") return <MobileNews />
  if (tab === "report") return <MobileReport />
  if (tab === "settings") return <MobileSettings />
  return <SiteHome />
}

function MobileReport() {
  const params = useSearchParams()
  const onDay = (day: Date) => replaceQuery({ day: isToday(day) ? null : format(day, "yyyy-MM-dd") })
  return <DailyReport day={reportDay(params.get("day"))} onDay={onDay} className="mx-auto w-full max-w-5xl px-4 pt-5 pb-8" />
}

/** One carousel, over the list: slides, caption, posting checklist. */
function CarouselSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true })
    // The list underneath keeps its place; only the sheet scrolls.
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])
  return (
    <div
      ref={sheet}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Carousel"
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-[#F6F7FA] outline-none duration-200 animate-in fade-in-0 slide-in-from-right-8 dark:bg-background"
    >
      <header className="pt-safe sticky top-0 z-10 border-b border-border/70 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-2">
          <Button variant="ghost" className="h-10 gap-1.5 px-2.5 text-[15px]" onClick={onClose}>
            <ArrowLeft className="size-5" /> Carousels
          </Button>
        </div>
      </header>
      <div className="pb-safe">
        <SiteCarousel id={id} />
      </div>
    </div>
  )
}

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <nav
      aria-label="Sections"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-4">
        {TABS.map((t) => {
          const active = t.id === tab
          const Icon = t.icon
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex size-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors outline-none select-none focus-visible:bg-muted",
                  active ? "text-primary" : "text-muted-foreground active:text-foreground",
                )}
              >
                <span className={cn("flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200", active && "bg-primary/12")}>
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                {t.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function Splash() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background">
      <BrandMark className="size-14 animate-pulse" />
    </main>
  )
}
