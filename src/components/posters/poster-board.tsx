"use client"

import { useMemo } from "react"
import { addDays, differenceInCalendarDays, format, isToday, isTomorrow, parse, startOfDay } from "date-fns"
import { CalendarClock, ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useProjectSlides, useSlideRenders, type BoardSlide } from "@/components/board/slide-renders"
import { useConfirm } from "@/components/confirm-dialog"
import { invalidateProjects, useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { pageShortName, pageSlug } from "@/lib/ai/homes-places"
import { restoreProject, trashProject } from "@/lib/data/projects"
import { isPosterTemplate, newsTimeLabel, pageDisplayName, posterKindOf } from "@/lib/design/news-templates"
import type { BrandPostKind } from "@/lib/brand-templates/types"
import type { ProjectRow } from "@/lib/types"
import { cn, errorMessage } from "@/lib/utils"
import {
  dayQuery,
  inScope,
  lookDesign,
  nextPosterTime,
  POSTER_TABS,
  posterBrandOf,
  posterPageOf,
  scopeName,
  tabOfBrand,
  ymd,
  type PosterScope,
  type PosterTab,
} from "./poster-shared"

type Slides = ReturnType<typeof useProjectSlides>

/** Previews of a look (Rentsouq.ae) are kept apart from the brand's own; a new number redraws them after a template change. */
const LOOK_RENDERS = "look1"

/**
 * One brand's (or one Homes.ph page's) posters in a list of news posts (News Article posts and the others left out).
 * On the Rentsouq.ae tab: FHI's posters, each drawn on the Rentsouq.ae template.
 */
function scopePosters(projects: ProjectRow[], slides: Slides, scope: PosterScope) {
  const map = new Map<string, BoardSlide[]>()
  for (const p of projects) {
    const list = slides.get(p.id)
    if (!list?.[0] || !inScope(list[0].design, scope)) continue
    const look = scope.look
    map.set(p.id, look ? list.map((s) => ({ ...s, design: lookDesign(s.design, look), key: `${LOOK_RENDERS}:${look}:${s.key}` })) : list)
  }
  return map
}

/** How far ahead the upcoming list looks. */
const UPCOMING_DAYS = 60

/** The posters made in advance (tomorrow and the next 60 days): the same query everywhere, fetched once. */
function useUpcoming() {
  const from = useMemo(() => startOfDay(addDays(new Date(), 1)), [])
  return useProjects({ kind: "news", from: from.toISOString(), to: addDays(from, UPCOMING_DAYS).toISOString(), orderBy: "scheduled_at", ascending: true, limit: 400 })
}

/** "Homes.ph Caraga" → "CARAGA", "Homes.ph Main Page" → "Main Page". */
const shortPage = (page: string) => pageShortName(pageDisplayName(page))

/**
 * Posters per tab (Rentsouq.ae shows FHI's), and per Homes.ph page (by its slug, with the name a poster gives it),
 * of one navigation (Poster, Did You Know or Engagement Posts).
 */
function countPosters(projects: ProjectRow[], slides: Slides, kind: BrandPostKind) {
  const tabs: Record<PosterTab, number> = { fhi: 0, rentsouq: 0, pickleplay: 0, homes: 0, bayanihan: 0 }
  const pages = new Map<string, { name: string; n: number }>()
  for (const p of projects) {
    const design = slides.get(p.id)?.[0]?.design
    if (!design || !isPosterTemplate(design.templateId) || posterKindOf(design.templateId) !== kind) continue
    const brand = posterBrandOf(design)
    tabs[tabOfBrand(brand)] += 1
    if (brand !== "homes" && brand !== "gensan") continue
    const name = posterPageOf(design)
    const key = pageSlug(name)
    pages.set(key, { name: pages.get(key)?.name ?? name, n: (pages.get(key)?.n ?? 0) + 1 })
  }
  tabs.rentsouq = kind === "news" ? tabs.fhi : 0
  return { tabs, pages }
}

/**
 * The Poster Maker's navigation: FHI Global Property, Rentsouq.ae (FHI's posters on its template), PicklePlay PH
 * and Homes.ph, with how many posters the chosen day has. On Homes.ph, the page dropdown: every Homes.ph Facebook page with its posters
 * that day and the ones made in advance; the board below shows the chosen page's posters.
 */
export function PosterBrandTabs({
  tab,
  tabs,
  extra = [],
  extraTab = null,
  page,
  pages,
  day,
  kind = "news",
  onChange,
  onExtra,
  onPage,
}: {
  /** The navigation whose posts are counted (1.52). */
  kind?: BrandPostKind
  /** The tab shown (ignored while an `extra` tab is). */
  tab: PosterTab
  /** The tabs of the assigned pages (1.50). */
  tabs: readonly PosterTab[]
  /** Assigned sites without a poster template yet (their tab shows a note). */
  extra?: readonly { id: string; label: string }[]
  extraTab?: string | null
  /** The Homes.ph page (Homes.ph tab). */
  page: string | null
  /** The assigned Homes.ph pages, in the posting checklist's order. */
  pages: readonly string[]
  day: Date
  onChange: (tab: PosterTab) => void
  onExtra?: (id: string) => void
  onPage: (page: string) => void
}) {
  const { projects } = useProjects(dayQuery(day))
  const slides = useProjectSlides(projects)
  const counts = useMemo(() => countPosters(projects, slides, kind), [projects, slides, kind])
  const upcoming = useUpcoming()
  const upcomingSlides = useProjectSlides(upcoming.projects)
  const ahead = useMemo(() => countPosters(upcoming.projects, upcomingSlides, kind), [upcoming.projects, upcomingSlides, kind])
  // The assigned Homes.ph pages (and the one shown, if it somehow isn't one).
  const list = useMemo(() => {
    const names = [...pages]
    if (page && !names.some((n) => pageSlug(n) === pageSlug(page))) names.unshift(page)
    return names
  }, [pages, page])
  const shown = POSTER_TABS.filter((b) => tabs.includes(b.id))
  const columns = shown.length + extra.length
  const dayCount = (name: string) => counts.pages.get(pageSlug(name))?.n ?? 0
  const aheadCount = (name: string) => ahead.pages.get(pageSlug(name))?.n ?? 0
  const withPosters = list.filter((n) => dayCount(n) > 0).length

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn("grid grid-cols-2 gap-1 rounded-xl border bg-card p-1", columns >= 4 ? "sm:grid-cols-4" : columns === 3 ? "sm:grid-cols-3" : columns === 1 ? "grid-cols-1" : "")}
        style={columns > 4 ? { gridTemplateColumns: `repeat(${Math.min(columns, 6)}, minmax(0, 1fr))` } : undefined}
        role="tablist"
        aria-label="Pages"
      >
        {shown.map((b) => {
          const on = !extraTab && tab === b.id
          // One Homes.ph page assigned: the tab is that page ("Homes.ph Gensan"), no dropdown under it.
          const name = b.id === "homes" && list.length === 1 ? pageDisplayName(list[0]) : b.name
          const short = b.id === "homes" && list.length === 1 ? pageDisplayName(list[0]) : b.short
          const n = b.id === "homes" ? list.reduce((sum, p) => sum + dayCount(p), 0) : counts.tabs[b.id]
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(b.id)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors",
                on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <span className="size-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: b.accent }} aria-hidden="true" />
              <span className="truncate">
                <span className="hidden xl:inline">{name}</span>
                <span className="xl:hidden">{short}</span>
              </span>
              <span
                className={cn("shrink-0 rounded-full px-1.5 text-[11px] font-medium tabular-nums", on ? "bg-white/20" : "bg-muted text-muted-foreground")}
                title={`${n} poster${n === 1 ? "" : "s"} on ${format(day, "MMMM d")}${b.id === "homes" && list.length > 1 ? " (your Homes.ph pages)" : b.id === "rentsouq" ? " (FHI Global Property's, on the Rentsouq.ae template)" : ""}`}
              >
                {n}
              </span>
            </button>
          )
        })}
        {extra.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={extraTab === x.id}
            onClick={() => onExtra?.(x.id)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors",
              extraTab === x.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <span className="truncate">{x.label}</span>
          </button>
        ))}
      </div>
      {!extraTab && tab === "rentsouq" && (
        <p className="rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Rentsouq.ae</span> shows the FHI Global Property posters on the Rentsouq.ae template: the same
          posters, so a change here shows in both tabs, and a poster added here is an FHI Global Property poster too. Save PNG gives the Rentsouq.ae
          picture. Rentsouq.ae isn&apos;t in the Daily Report (FHI Global Property is).
        </p>
      )}
      {!extraTab && tab === "homes" && page && list.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border bg-card px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <MapPin className="size-3.5" aria-hidden="true" /> Homes.ph page
          </span>
          <Select value={pageSlug(page)} onValueChange={(slug) => onPage(list.find((n) => pageSlug(n) === slug) ?? page)}>
            <SelectTrigger className="h-9 w-full bg-background font-semibold sm:w-72" aria-label="Homes.ph page">
              <SelectValue>
                <span className="truncate">{pageDisplayName(page)}</span>
                <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">{dayCount(page)}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[min(28rem,var(--radix-select-content-available-height))]">
              {list.map((name) => {
                const n = dayCount(name)
                const later = aheadCount(name)
                return (
                  <SelectItem key={pageSlug(name)} value={pageSlug(name)} aria-label={`${pageDisplayName(name)}: ${n} on ${format(day, "MMMM d")}, ${later} made in advance`}>
                    <span className="flex min-w-52 items-center gap-2">
                      <span className="flex-1 truncate">{shortPage(name)}</span>
                      {later > 0 && <span className="text-[10.5px] text-muted-foreground tabular-nums">{later} ahead</span>}
                      <span
                        className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] font-medium tabular-nums", n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                        title={`${n} poster${n === 1 ? "" : "s"} on ${format(day, "MMMM d")}`}
                      >
                        {n}
                      </span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {withPosters ? `${withPosters} of ${list.length} pages have posters on ${format(day, "MMMM d")}` : `No Homes.ph posters on ${format(day, "MMMM d")} yet`}. Each page
            shows that day&apos;s posters; &ldquo;ahead&rdquo; counts the ones made in advance.
          </span>
        </div>
      )}
    </div>
  )
}

/** "poster" (Poster), "Did You Know post", "engagement post" (1.52). */
const nounOf = (scope: PosterScope) => (scope.kind === "dyk" ? "Did You Know post" : scope.kind === "engagement" ? "engagement post" : "poster")

/** On the Rentsouq.ae tab the poster is FHI's: deleting it there deletes it from both tabs. */
export const RENTSOUQ_DELETE_NOTE = "It's the FHI Global Property poster, so it leaves the FHI Global Property tab too."

/** Asks, then moves a poster to the Trash (restorable from Trash, or Undo right away). */
export function useDeletePoster() {
  const confirm = useConfirm()
  return async (id: string, title: string, note?: string): Promise<boolean> => {
    const ok = await confirm({
      title: "Delete this poster?",
      description: (
        <>
          &ldquo;{title}&rdquo; moves to the Trash. You can restore it from <span className="font-medium">Trash</span>.{note ? ` ${note}` : ""}
        </>
      ),
      confirmLabel: "Delete poster",
      destructive: true,
    })
    if (!ok) return false
    try {
      const toTrash = await trashProject(id)
      invalidateProjects()
      toast.success(toTrash ? "Poster moved to the Trash" : "Poster deleted", {
        description: title,
        action: toTrash ? { label: "Undo", onClick: () => void restoreProject(id).then(invalidateProjects, (e) => toast.error(errorMessage(e))) } : undefined,
      })
      return true
    } catch (e) {
      toast.error("Couldn't delete the poster", { description: errorMessage(e) })
      return false
    }
  }
}

/**
 * The chosen day for one brand: its posters in posting-time order (any time, as many as
 * needed), and Add poster for one more. Any day can be picked, so posters can be made
 * in advance.
 */
export function PosterDayBoard({
  scope,
  day,
  currentId,
  onDay,
  onOpen,
  onNew,
  onDeleted,
}: {
  /** The brand, or the Homes.ph page, whose posters it shows. */
  scope: PosterScope
  day: Date
  currentId: string | null
  onDay: (day: Date) => void
  onOpen: (id: string) => void
  /** A new poster at this time ("HH:mm"): after the day's last poster. */
  onNew: (time: string) => void
  onDeleted: (id: string) => void
}) {
  const { projects, loading } = useProjects(dayQuery(day))
  const slides = useProjectSlides(projects)
  const posters = useMemo(() => scopePosters(projects, slides, scope), [projects, slides, scope])
  const renders = useSlideRenders(posters, 300, !!scope.look)
  const deletePoster = useDeletePoster()
  const list = projects.filter((p) => posters.has(p.id)).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
  const at = (p: ProjectRow) => (p.scheduled_at ? format(new Date(p.scheduled_at), "HH:mm") : "")
  const nextTime = nextPosterTime(list.map(at).filter(Boolean))
  const waiting = loading || projects.some((p) => !slides.get(p.id))
  const name = scopeName(scope)
  const noun = nounOf(scope)

  return (
    <section aria-label={`${name} ${noun}s on ${format(day, "MMMM d")}`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-baseline gap-2">
          <span className="text-base font-semibold">{isToday(day) ? "Today" : isTomorrow(day) ? "Tomorrow" : format(day, "EEEE")}</span>
          <span className="text-sm text-muted-foreground">{format(day, "MMMM d, yyyy")}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            · {waiting ? "…" : `${list.length} ${noun}${list.length === 1 ? "" : "s"}`}
            {scope.page ? ` for ${name}` : ""}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous day" onClick={() => onDay(addDays(day, -1))}>
              <ChevronLeft />
            </Button>
            <Input
              type="date"
              value={ymd(day)}
              onChange={(e) => e.target.value && onDay(startOfDay(parse(e.target.value, "yyyy-MM-dd", new Date())))}
              aria-label="Day"
              className="h-8 w-36 border-0 bg-transparent text-center shadow-none dark:bg-transparent"
            />
            <Button variant="ghost" size="icon-sm" aria-label="Next day" onClick={() => onDay(addDays(day, 1))}>
              <ChevronRight />
            </Button>
            {!isToday(day) && (
              <Button variant="ghost" size="sm" onClick={() => onDay(startOfDay(new Date()))}>
                Today
              </Button>
            )}
            {!isTomorrow(day) && (
              <Button variant="ghost" size="sm" onClick={() => onDay(startOfDay(addDays(new Date(), 1)))} title={`Make ${noun}s in advance`}>
                Tomorrow
              </Button>
            )}
          </div>
          <Button onClick={() => onNew(nextTime)} disabled={waiting}>
            <Plus /> Add {noun}
          </Button>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Posters this day">
        {list.map((p) => {
          const slide = posters.get(p.id)![0]
          const render = renders.get(slide.key)
          return (
            <li key={p.id} className="group/tile relative flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{p.scheduled_at ? newsTimeLabel(at(p)) : "No time"}</span>
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                aria-current={p.id === currentId || undefined}
                className={cn(
                  "group flex w-full flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-primary",
                  p.id === currentId && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
                title={`Open: ${p.title}`}
              >
                <span className="block aspect-[4/5] w-full overflow-hidden rounded-md bg-muted ring-1 ring-black/10">
                  {render && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={render} alt="" className="size-full object-contain transition-transform group-hover:scale-[1.02]" draggable={false} />
                  )}
                </span>
                <span className="line-clamp-2 text-[11px] text-muted-foreground">{p.title}</span>
              </button>
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute top-7 right-1.5 bg-black/60 text-white opacity-0 shadow-sm backdrop-blur transition-opacity group-hover/tile:opacity-100 hover:bg-red-600 hover:text-white focus-visible:opacity-100"
                aria-label={`Delete ${noun}: ${p.title}`}
                title={`Delete ${noun}`}
                onClick={() => void deletePoster(p.id, p.title, scope.look ? RENTSOUQ_DELETE_NOTE : undefined).then((done) => done && onDeleted(p.id))}
              >
                <Trash2 />
              </Button>
            </li>
          )
        })}
        <li className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{list.length ? `Next · ${newsTimeLabel(nextTime)}` : newsTimeLabel(nextTime)}</span>
          <button
            type="button"
            onClick={() => onNew(nextTime)}
            disabled={waiting}
            className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-50"
            aria-label={`Add a ${name} ${noun}`}
          >
            <Plus className="size-5" /> Add {noun}
            <span className="text-[10.5px] font-normal">Set any posting time</span>
          </button>
        </li>
      </ul>
    </section>
  )
}

/**
 * The brand's (or the Homes.ph page's) posters made in advance (tomorrow and later), by day. Click one to open it.
 */
export function UpcomingPosters({ scope, currentId, onOpen }: { scope: PosterScope; currentId: string | null; onOpen: (id: string, day: Date) => void }) {
  const { projects, loading } = useUpcoming()
  const slides = useProjectSlides(projects)
  const posters = useMemo(() => scopePosters(projects, slides, scope), [projects, slides, scope])
  const renders = useSlideRenders(posters, 200, !!scope.look)
  const days = useMemo(() => {
    const groups: { day: Date; items: ProjectRow[] }[] = []
    for (const p of projects) {
      if (!posters.has(p.id) || !p.scheduled_at) continue
      const day = startOfDay(new Date(p.scheduled_at))
      const last = groups[groups.length - 1]
      if (last && last.day.getTime() === day.getTime()) last.items.push(p)
      else groups.push({ day, items: [p] })
    }
    return groups
  }, [projects, posters])
  const name = scopeName(scope)
  const waiting = loading || projects.some((p) => !slides.get(p.id))
  const total = days.reduce((n, d) => n + d.items.length, 0)

  return (
    <section aria-label={`Upcoming ${name} ${nounOf(scope)}s`} className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2 border-b pb-2">
        <CalendarClock className="size-4 self-center text-muted-foreground" aria-hidden="true" />
        <span className="text-base font-semibold">
          Upcoming {name} {nounOf(scope)}s
        </span>
        <span className="text-xs text-muted-foreground">{waiting ? "…" : total ? `${total} made in advance (next ${UPCOMING_DAYS} days)` : `None in the next ${UPCOMING_DAYS} days`}</span>
      </h2>
      {!waiting && total === 0 && (
        <p className="text-sm text-muted-foreground">
          To make a {nounOf(scope)} in advance, pick a later day above (<span className="font-medium text-foreground">Tomorrow</span>, › or the calendar) and click a posting time.
        </p>
      )}
      {days.length > 0 && (
        <ol className="flex flex-col gap-4">
          {days.map(({ day, items }) => {
            const inDays = differenceInCalendarDays(day, new Date())
            return (
              <li key={day.toISOString()} className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  {format(day, "EEEE, MMMM d")}{" "}
                  <span className="text-xs font-normal text-muted-foreground">· {inDays === 1 ? "tomorrow" : `in ${inDays} days`}</span>
                </span>
                <ul className="flex flex-wrap gap-3">
                  {items.map((p) => {
                    const slide = posters.get(p.id)![0]
                    const render = renders.get(slide.key)
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(p.id, day)}
                          aria-current={p.id === currentId || undefined}
                          className={cn(
                            "group flex w-32 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-primary",
                            p.id === currentId && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                          )}
                          title={`Open: ${p.title}`}
                        >
                          <span className="block aspect-[4/5] w-full overflow-hidden rounded-md bg-muted ring-1 ring-black/10">
                            {render && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={render} alt="" className="size-full object-contain transition-transform group-hover:scale-[1.02]" draggable={false} />
                            )}
                          </span>
                          <span className="truncate text-[11px] font-medium">{format(new Date(p.scheduled_at!), "h:mm a")}</span>
                          <span className="line-clamp-2 text-[11px] text-muted-foreground">{p.title}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
