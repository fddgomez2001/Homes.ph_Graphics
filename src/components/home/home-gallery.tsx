"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { addMonths, format, parse } from "date-fns"
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleCheck, CircleDashed, Download, Layers, Loader2, Plus } from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { useProjectSlides, useSlideRenders, type BoardSlide } from "@/components/board/slide-renders"
import { MadeBy } from "@/components/posting/made-by"
import { PostingChecklist, PostingChip } from "@/components/posting/posting-checklist"
import { CarouselPile } from "@/components/projects/carousel-pile"
import { useCreateCarousel } from "@/components/projects/create-carousel-dialog"
import { ProjectActionsMenu } from "@/components/projects/project-actions-menu"
import { PostedHint } from "@/components/projects/project-card"
import { StatusBadge } from "@/components/projects/status-badge"
import { useProjectActions, type ProjectActions } from "@/components/projects/use-project-actions"
import { useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ProjectRow } from "@/lib/types"
import { postingState } from "@/lib/data/posting"
import { cn } from "@/lib/utils"
import { CarouselPreview } from "./carousel-preview"

const PAGE = 20
/** Carousels without a publication date get their own entry in the month list. */
const NO_DATE = "none"

const monthOf = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM") : NO_DATE)
const monthDate = (month: string) => parse(month, "yyyy-MM", new Date())
const monthLabel = (month: string) => (month === NO_DATE ? "No date" : format(monthDate(month), "MMMM yyyy"))
const when = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY)

/** This month when it has carousels, otherwise the next month that does (or the latest one). */
function defaultMonth(counts: Map<string, number>, current: string) {
  if (counts.has(current)) return current
  const dated = [...counts.keys()].filter((m) => m !== NO_DATE).sort()
  return dated.find((m) => m > current) ?? dated.at(-1) ?? current
}

/**
 * Home: one month of carousels at a time, in publication order (Oct 31, Nov 1,
 * Nov 2…). Each is a pile of its slides; posted ones are greyed out. Clicking one
 * opens its preview; quick buttons: the posting checklist, download every slide
 * as numbered PNGs, and the ⋯ menu.
 */
export function HomeGallery() {
  const router = useRouter()
  const params = useSearchParams()
  const openCreate = useCreateCarousel()
  const [search, setSearch] = useState("")
  const [visible, setVisible] = useState(PAGE)
  // One cached list; months and search are filtered here (no extra requests).
  const { projects, loading, error, apply } = useProjects({ orderBy: "scheduled_at", ascending: true, limit: 500 })
  const { actions, dialogs } = useProjectActions(apply)
  const [viewing, setViewing] = useState<string | null>(null)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of projects) map.set(monthOf(p.scheduled_at), (map.get(monthOf(p.scheduled_at)) ?? 0) + 1)
    return map
  }, [projects])
  const current = format(new Date(), "yyyy-MM")
  const requested = params.get("month")
  const month = requested === NO_DATE || /^\d{4}-\d{2}$/.test(requested ?? "") ? requested! : defaultMonth(counts, current)
  const term = search.trim().toLowerCase()

  const options = useMemo(() => {
    const dated = new Set([...counts.keys()].filter((m) => m !== NO_DATE))
    dated.add(current)
    if (month !== NO_DATE) dated.add(month)
    return [...[...dated].sort(), ...(counts.has(NO_DATE) ? [NO_DATE] : [])]
  }, [counts, current, month])

  const list = useMemo(() => {
    const matching = term
      ? projects.filter((p) => `${p.title}\n${p.caption}`.toLowerCase().includes(term))
      : projects.filter((p) => monthOf(p.scheduled_at) === month)
    return [...matching].sort((a, b) => when(a.scheduled_at) - when(b.scheduled_at) || a.title.localeCompare(b.title))
  }, [projects, month, term])
  const shown = useMemo(() => list.slice(0, visible), [list, visible])
  const slides = useProjectSlides(shown)
  const renders = useSlideRenders(slides)

  const choose = (next: string) => {
    setVisible(PAGE)
    router.replace(next === current ? "/home" : `/home?month=${next}`, { scroll: false })
  }
  const step = (by: number) => choose(format(addMonths(monthDate(month === NO_DATE ? current : month), by), "yyyy-MM"))
  const posted = list.filter((p) => p.status === "published").length

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Home"
        description="Your carousels in publication order"
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setVisible(PAGE)
        }}
      />
      <div className="flex-1 px-4 py-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className={cn("flex items-center gap-0.5 rounded-lg border bg-card p-1 shadow-xs", term && "opacity-50")}>
            <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => step(-1)} disabled={!!term}>
              <ChevronLeft />
            </Button>
            <Select value={month} onValueChange={choose} disabled={!!term}>
              <SelectTrigger aria-label="Month" className="h-8 min-w-48 border-0 text-[15px] font-semibold shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                    <span className="text-muted-foreground"> · {counts.get(m) ?? 0}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => step(1)} disabled={!!term}>
              <ChevronRight />
            </Button>
          </div>
          {!term && month !== current && (
            <Button variant="outline" size="sm" onClick={() => choose(current)}>
              This month
            </Button>
          )}
          {!loading && (
            <span className="text-sm text-muted-foreground" role="status">
              {term
                ? `${list.length} match${list.length === 1 ? "" : "es"} in every month`
                : `${list.length} carousel${list.length === 1 ? "" : "s"}${posted ? ` · ${posted} posted` : ""}`}
            </span>
          )}
        </div>

        {error && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading carousels…
          </div>
        ) : list.length === 0 ? (
          <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-3 text-center">
            <Layers className="size-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {term ? "No carousels match your search" : projects.length ? `Nothing scheduled in ${monthLabel(month)}` : "No carousels yet"}
            </h2>
            {!term && (
              <Button onClick={() => openCreate()}>
                <Plus /> {projects.length ? "Create a carousel" : "Create your first carousel"}
              </Button>
            )}
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-label="Carousels">
              {shown.map((project) => (
                <li key={project.id} className="flex">
                  <CarouselTile
                    project={project}
                    slides={slides.get(project.id)}
                    renders={renders}
                    actions={actions}
                    onOpen={() => setViewing(project.id)}
                  />
                </li>
              ))}
            </ul>
            {list.length > visible && (
              <div className="mt-10 flex justify-center">
                <Button variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
                  Show more ({list.length - visible} more)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <CarouselPreview
        project={shown.find((p) => p.id === viewing) ?? null}
        slides={viewing ? slides.get(viewing) : undefined}
        renders={renders}
        actions={actions}
        onClose={() => setViewing(null)}
      />
      {dialogs}
    </div>
  )
}

function CarouselTile({
  project,
  slides,
  renders,
  actions,
  onOpen,
}: {
  project: ProjectRow
  slides?: BoardSlide[]
  renders: Map<string, string>
  actions: ProjectActions
  onOpen: () => void
}) {
  const [busy, setBusy] = useState(false)
  const cover = (slides?.[0] && renders.get(slides[0].key)) || project.thumbnail
  const cards = (slides ?? []).slice(1).map((card) => renders.get(card.key))
  const count = slides?.length ?? project.slide_count
  const posted = project.status === "published"
  const posting = postingState(project)

  const download = async () => {
    setBusy(true)
    try {
      await actions.downloadPngs(project, slides?.map((s) => ({ type: s.row.slide_type, design: s.design })))
    } finally {
      setBusy(false)
    }
  }

  return (
    // Same rows on every card (title, date, details, buttons), so a row of cards lines up.
    <div className="flex h-full w-full flex-col gap-2">
      <button type="button" onClick={onOpen} aria-label={`Open ${project.title}`} className="group block w-full focus-visible:outline-none">
        <CarouselPile
          seed={project.id}
          cover={cover}
          cards={cards}
          title={project.title}
          className={cn("transition-[filter,opacity] duration-300", posted && "opacity-55 grayscale group-hover:opacity-80 dark:opacity-70 dark:group-hover:opacity-90")}
        />
      </button>
      <button type="button" onClick={onOpen} className="text-left">
        <span className={cn("line-clamp-2 min-h-[2lh] text-sm leading-snug font-semibold", posted ? "text-muted-foreground" : "text-foreground")}>{project.title}</span>
      </button>
      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <div className={cn("flex items-center gap-1.5 font-medium", posted ? "text-muted-foreground" : "text-slate-700 dark:text-slate-200")}>
          <CalendarDays className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
          {project.scheduled_at ? format(new Date(project.scheduled_at), "EEE, MMMM d · h:mm a") : "No date"}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={project.status} className="text-[10px]" />
          <PostingChip project={project} className="text-[10px]" />
          <span>
            {count} slide{count === 1 ? "" : "s"}
          </span>
        </div>
        <PostedHint project={project} />
        <MadeBy project={project} />
      </div>
      <div className="mt-auto flex items-center gap-1.5 border-t pt-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Posting checklist for ${project.title}`}
              className={cn(
                "flex-1 justify-center",
                posting === "posted" && "border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300",
                posting === "partial" && "border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300",
              )}
            >
              {posting === "posted" ? <CheckCircle2 /> : posting === "partial" ? <CircleDashed /> : <CircleCheck />}
              {posting === "posted" ? "Posted" : posting === "partial" ? `${project.posted_count}/17` : "Checklist"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" collisionPadding={12} className="max-h-[min(42rem,var(--radix-popover-content-available-height))] w-80 overflow-y-auto">
            <PostingChecklist project={project} />
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-center"
              aria-label={`Download ${project.title} as PNG files`}
              disabled={busy}
              onClick={() => void download()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Download />} PNGs
            </Button>
          </TooltipTrigger>
          <TooltipContent>Every slide as a PNG: 1.png (cover), 2.png…</TooltipContent>
        </Tooltip>
        <ProjectActionsMenu project={project} actions={actions} />
      </div>
    </div>
  )
}
