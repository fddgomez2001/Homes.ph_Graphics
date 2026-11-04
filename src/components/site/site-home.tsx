"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { format, isThisYear, isToday, isTomorrow, isYesterday, startOfDay, startOfToday } from "date-fns"
import { CheckCircle2, Search, Sparkles } from "lucide-react"
import { useProjectSlides, useSlideRenders } from "@/components/board/slide-renders"
import { CarouselPile } from "@/components/projects/carousel-pile"
import { useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ProjectRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PostStatePill } from "./post-state"
import { useSiteLinks } from "./site-links"

type Show = "to-post" | "posted" | "all"

const SHOWS: { id: Show; label: string }[] = [
  { id: "to-post", label: "To post" },
  { id: "posted", label: "Posted" },
  { id: "all", label: "All" },
]

const PAGE = 24

interface Group {
  key: string
  title: string
  note?: string
  tone?: "late"
  items: ProjectRow[]
}

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)

function dayTitle(day: Date) {
  const date = format(day, isThisYear(day) ? "EEEE, MMMM d" : "EEEE, MMMM d, yyyy")
  if (isToday(day)) return { title: "Today", note: date }
  if (isTomorrow(day)) return { title: "Tomorrow", note: date }
  if (isYesterday(day)) return { title: "Yesterday", note: date }
  return { title: date }
}

function byDay(items: ProjectRow[], at: (p: ProjectRow) => string | null | undefined): Group[] {
  const groups = new Map<string, Group>()
  for (const p of items) {
    const value = at(p)
    const day = value ? startOfDay(new Date(value)) : null
    const key = day ? day.toISOString() : "none"
    if (!groups.has(key)) groups.set(key, { key, ...(day ? dayTitle(day) : { title: "No date" }), items: [] })
    groups.get(key)!.items.push(p)
  }
  return [...groups.values()]
}

/** The posting website's home: what to post next, what's already posted, everything. */
export function SiteHome() {
  const params = useSearchParams()
  const router = useRouter()
  const links = useSiteLinks()
  const requested = params.get("show")
  const show: Show = requested === "posted" || requested === "all" ? requested : "to-post"
  const [search, setSearch] = useState("")
  const [limit, setLimit] = useState(PAGE)
  // One cached list for every tab and the search: no extra requests while browsing.
  const { projects, loading, error } = useProjects({ orderBy: "scheduled_at", ascending: true, limit: 500 })

  const term = search.trim().toLowerCase()
  const lists = useMemo(() => {
    const matching = term ? projects.filter((p) => `${p.title}\n${p.caption}`.toLowerCase().includes(term)) : projects
    return {
      "to-post": matching.filter((p) => p.status === "scheduled").sort((a, b) => time(a.scheduled_at) - time(b.scheduled_at)),
      posted: matching
        .filter((p) => p.status === "published")
        .sort((a, b) => time(b.posted_at ?? b.scheduled_at) - time(a.posted_at ?? a.scheduled_at)),
      all: [...matching].sort((a, b) => time(b.scheduled_at ?? b.updated_at) - time(a.scheduled_at ?? a.updated_at)),
    } satisfies Record<Show, ProjectRow[]>
  }, [projects, term])

  const list = lists[show]
  const shown = useMemo(() => list.slice(0, limit), [list, limit])
  const slides = useProjectSlides(shown)
  const renders = useSlideRenders(slides)

  const groups = useMemo<Group[]>(() => {
    if (show === "all") return [{ key: "all", title: "", items: shown }]
    if (show === "posted") return byDay(shown, (p) => p.posted_at ?? p.scheduled_at)
    const today = startOfToday()
    const late = shown.filter((p) => p.scheduled_at && new Date(p.scheduled_at) < today)
    const upcoming = shown.filter((p) => !late.includes(p))
    return [
      ...(late.length ? [{ key: "late", title: "Not posted yet", note: "Their date has passed", tone: "late" as const, items: late }] : []),
      ...byDay(upcoming, (p) => p.scheduled_at),
    ]
  }, [show, shown])

  const choose = (next: Show) => {
    setLimit(PAGE)
    router.replace(links.show(next), { scroll: false })
  }

  const heading = show === "to-post" ? "Ready to post" : show === "posted" ? "Posted" : "All carousels"
  const summary =
    show === "to-post"
      ? lists["to-post"].length
        ? `${lists["to-post"].length} carousel${lists["to-post"].length === 1 ? "" : "s"} waiting to go live`
        : "Nothing waiting right now"
      : show === "posted"
        ? `${lists.posted.length} posted`
        : `${lists.all.length} carousel${lists.all.length === 1 ? "" : "s"}`

  return (
    <main className={cn("mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6", links.app ? "pt-5" : "pt-8")}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{loading ? "Loading carousels…" : summary}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div role="tablist" aria-label="Show" className="inline-flex self-start rounded-full border border-border bg-card p-1 shadow-xs">
            {SHOWS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={show === s.id}
                onClick={() => choose(s.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  show === s.id ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 dark:text-slate-300 hover:text-foreground",
                )}
              >
                {s.label}
                {!loading && (
                  <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", show === s.id ? "bg-white/20" : "bg-muted text-muted-foreground")}>
                    {lists[s.id].length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(PAGE)
              }}
              placeholder="Search carousels"
              aria-label="Search carousels"
              className="h-9 rounded-full border-border bg-card pl-9"
            />
          </div>
        </div>
      </div>

      {error && <p className="mt-6 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="flex flex-col gap-3">
              <span className="m-[10%] block aspect-square animate-pulse bg-slate-200 dark:bg-slate-800" />
              <span className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </li>
          ))}
        </ul>
      ) : list.length === 0 ? (
        <EmptyState show={show} searching={!!term} />
      ) : (
        <div className="mt-8 flex flex-col gap-12">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.title || heading}>
              {group.title && (
                <h2 className="mb-5 flex items-baseline gap-2 border-b border-border pb-2">
                  <span className={cn("text-base font-semibold", group.tone === "late" ? "text-amber-800 dark:text-amber-300" : "text-foreground")}>{group.title}</span>
                  {group.note && <span className="text-sm text-muted-foreground">{group.note}</span>}
                  <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 tabular-nums">{group.items.length}</span>
                </h2>
              )}
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4 xl:grid-cols-5" aria-label="Carousels">
                {group.items.map((p) => {
                  const own = slides.get(p.id)
                  const count = own?.length ?? p.slide_count
                  const when = p.scheduled_at ? new Date(p.scheduled_at) : null
                  return (
                    <li key={p.id}>
                      <Link href={links.carousel(p.id)} className="group flex flex-col gap-2 rounded-xl outline-none" aria-label={`Open ${p.title}`}>
                        <CarouselPile
                          seed={p.id}
                          cover={(own?.[0] && renders.get(own[0].key)) || p.thumbnail}
                          cards={(own ?? []).slice(1).map((s) => renders.get(s.key))}
                          title={p.title}
                        />
                        <span className="px-1">
                          <span className="line-clamp-2 text-[15px] leading-snug font-semibold text-foreground group-hover:text-primary">{p.title}</span>
                          <span className="mt-1 block text-[13px] text-muted-foreground">
                            {when ? format(when, show === "to-post" ? "h:mm a" : "MMM d · h:mm a") : "No date"} · {count} slide{count === 1 ? "" : "s"}
                          </span>
                          <PostStatePill project={p} className="mt-2" />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {list.length > limit && (
            <div className="flex justify-center">
              <Button variant="outline" className="rounded-full bg-card px-5" onClick={() => setLimit((n) => n + PAGE)}>
                Show more ({list.length - limit} more)
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function EmptyState({ show, searching }: { show: Show; searching: boolean }) {
  const Icon = show === "posted" ? CheckCircle2 : Sparkles
  return (
    <div className="mx-auto mt-20 flex max-w-sm flex-col items-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border">
        <Icon className="size-5" />
      </span>
      <h2 className="text-lg font-semibold">
        {searching ? "No carousels match your search" : show === "to-post" ? "All caught up" : show === "posted" ? "Nothing posted yet" : "No carousels yet"}
      </h2>
      {!searching && (
        <p className="text-sm text-muted-foreground">
          {show === "to-post"
            ? "Carousels show up here as soon as they're scheduled in the Carousel Maker."
            : show === "posted"
              ? "Open a carousel and choose “Mark as posted” after it goes live."
              : "Carousels made in the Carousel Maker appear here."}
        </p>
      )}
    </div>
  )
}

export function SiteHomeSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    </main>
  )
}
