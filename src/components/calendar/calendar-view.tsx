"use client"

import { use, useMemo, useState, type DragEvent, type ReactNode } from "react"
import { io } from "next/cache"
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { CalendarPlus, ChevronLeft, ChevronRight, Inbox, Loader2, PanelsTopLeft, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/app-shell/page-header"
import { useCreateCarousel } from "@/components/projects/create-carousel-dialog"
import { PROJECT_DRAG_TYPE, ProjectCard, ProjectChip } from "@/components/projects/project-card"
import { StatusFilter } from "@/components/projects/status-filter"
import { useProjectActions, type ProjectChange } from "@/components/projects/use-project-actions"
import { useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { moveToDay } from "@/lib/dates"
import { useDebouncedValue, usePreference } from "@/lib/hooks"
import { PROJECT_STATUSES, STATUS_LABELS, type ProjectRow, type ProjectStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const VIEWS = ["month", "week", "day", "board"] as const
type View = (typeof VIEWS)[number]

function rangeFor(view: View, cursor: Date) {
  if (view === "week") {
    const start = startOfWeek(cursor)
    return { start, end: addDays(start, 7) }
  }
  if (view === "day") {
    const start = startOfDay(cursor)
    return { start, end: addDays(start, 1) }
  }
  if (view === "board") {
    const start = startOfMonth(cursor)
    return { start, end: addDays(endOfMonth(cursor), 1) }
  }
  const start = startOfWeek(startOfMonth(cursor))
  return { start, end: addDays(endOfWeek(endOfMonth(cursor)), 1) }
}

function rangeLabel(view: View, cursor: Date) {
  if (view === "day") return format(cursor, "EEEE, MMMM d, yyyy")
  if (view === "week") {
    const start = startOfWeek(cursor)
    const end = endOfWeek(cursor)
    return isSameMonth(start, end)
      ? `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
      : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
  }
  return format(cursor, "MMMM yyyy")
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd")

export function CalendarView() {
  // The current date is read at request time in the browser, never baked into the static shell.
  use(io())
  const openCreate = useCreateCarousel()
  const router = useRouter()
  const openBoard = (d: Date) => router.push(`/board?date=${format(d, "yyyy-MM-dd")}`)
  const [view, setView] = usePreference<View>("dcm:calendar-view", "month", VIEWS)
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [search, setSearch] = useState("")
  const term = useDebouncedValue(search.trim())
  const [statuses, setStatuses] = useState<ProjectStatus[]>([])
  const range = useMemo(() => rangeFor(view, cursor), [view, cursor])

  const dated = useProjects({
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    statuses,
    search: term,
    orderBy: "scheduled_at",
    ascending: true,
  })
  const unscheduled = useProjects({ unscheduledOnly: true, statuses, search: term, orderBy: "updated_at" })
  const onChange = (change: ProjectChange) => {
    dated.apply(change)
    unscheduled.apply(change)
  }
  const { actions, dialogs } = useProjectActions(onChange)

  const byDay = useMemo(() => {
    const map = new Map<string, ProjectRow[]>()
    for (const p of dated.projects) {
      if (!p.scheduled_at) continue
      const key = dayKey(new Date(p.scheduled_at))
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return map
  }, [dated.projects])

  const step = (dir: 1 | -1) => {
    setCursor((c) =>
      view === "day" ? addDays(c, dir) : view === "week" ? addWeeks(c, dir) : addMonths(c, dir),
    )
  }

  const findProject = (id: string) =>
    dated.projects.find((p) => p.id === id) ?? unscheduled.projects.find((p) => p.id === id)

  const dropOnDay = (e: DragEvent, day: Date) => {
    const id = e.dataTransfer.getData(PROJECT_DRAG_TYPE)
    const project = id ? findProject(id) : undefined
    if (!project) return
    e.preventDefault()
    dated.patchLocal(project.id, { scheduled_at: moveToDay(project.scheduled_at, day) })
    void actions.moveToDate(project, day)
  }

  const loading = dated.loading || unscheduled.loading
  const error = dated.error ?? unscheduled.error

  return (
    <>
      <PageHeader title="Calendar" search={search} onSearchChange={setSearch} createDate={view === "day" ? cursor : null}>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setCursor(startOfDay(new Date()))}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Next">
            <ChevronRight />
          </Button>
          <span className="min-w-36 text-sm font-medium" aria-live="polite">
            {rangeLabel(view, cursor)}
          </span>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 border-b bg-card/50 px-4 py-2 lg:px-6">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={(v) => v && setView(v as View)}
          aria-label="Calendar view"
        >
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
          <ToggleGroupItem value="board">Board</ToggleGroupItem>
        </ToggleGroup>
        <StatusFilter value={statuses} onChange={setStatuses} />
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:p-6">
        <div className="min-w-0 flex-1">
          {view === "month" && (
            <MonthGrid
              cursor={cursor}
              byDay={byDay}
              actions={actions}
              onCreate={(day) => openCreate({ date: day })}
              onShowDay={openBoard}
              onDrop={dropOnDay}
            />
          )}
          {view === "week" && (
            <WeekColumns
              cursor={cursor}
              byDay={byDay}
              actions={actions}
              onCreate={(day) => openCreate({ date: day })}
              onDrop={dropOnDay}
            />
          )}
          {view === "day" && (
            <div className="mb-4">
              <Button variant="outline" onClick={() => openBoard(cursor)}>
                <PanelsTopLeft /> Open this day on the Day Board
              </Button>
            </div>
          )}
          {view === "day" && (
            <DayList
              day={cursor}
              projects={byDay.get(dayKey(cursor)) ?? []}
              actions={actions}
              loading={dated.loading}
              onCreate={() => openCreate({ date: cursor })}
            />
          )}
          {view === "board" && (
            <Board
              projects={[...dated.projects, ...unscheduled.projects]}
              actions={actions}
              onMove={(project, status) => {
                if (status !== "scheduled" || project.scheduled_at) dated.patchLocal(project.id, { status })
                void actions.setStatus(project, status)
              }}
            />
          )}
        </div>
        {view !== "board" && (
          <UnscheduledTray projects={unscheduled.projects} actions={actions} loading={unscheduled.loading} />
        )}
      </div>
      {dialogs}
    </>
  )
}

function DropCell({
  onDrop,
  className,
  children,
  label,
}: {
  onDrop: (e: DragEvent) => void
  className?: string
  children: ReactNode
  label: string
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      aria-label={label}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(PROJECT_DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        onDrop(e)
      }}
      className={cn(className, over && "bg-accent ring-2 ring-primary/40 ring-inset")}
    >
      {children}
    </div>
  )
}

function MonthGrid({
  cursor,
  byDay,
  actions,
  onCreate,
  onShowDay,
  onDrop,
}: {
  cursor: Date
  byDay: Map<string, ProjectRow[]>
  actions: ReturnType<typeof useProjectActions>["actions"]
  onCreate: (day: Date) => void
  onShowDay: (day: Date) => void
  onDrop: (e: DragEvent, day: Date) => void
}) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) })
  const MAX = 3
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="py-2">
            <span className="hidden sm:inline">{format(d, "EEE")}</span>
            <span className="sm:hidden">{format(d, "EEEEE")}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = byDay.get(dayKey(day)) ?? []
          const inMonth = isSameMonth(day, cursor)
          return (
            <DropCell
              key={day.toISOString()}
              label={format(day, "EEEE, MMMM d")}
              onDrop={(e) => onDrop(e, day)}
              className={cn(
                "group/cell relative flex min-h-28 flex-col gap-1 border-r border-b p-1.5 last:border-r-0 nth-[7n]:border-r-0",
                !inMonth && "bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onShowDay(day)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-muted",
                    !inMonth && "text-muted-foreground/60",
                    isToday(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  aria-label={`Open the board for ${format(day, "MMMM d")}`}
                >
                  {format(day, "d")}
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100"
                  onClick={() => onCreate(day)}
                  aria-label={`Create carousel on ${format(day, "MMMM d")}`}
                >
                  <Plus />
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                {items.slice(0, MAX).map((p) => (
                  <ProjectChip key={p.id} project={p} actions={actions} />
                ))}
                {items.length > MAX && (
                  <button
                    type="button"
                    onClick={() => onShowDay(day)}
                    className="rounded px-1 text-left text-xs font-medium text-primary hover:underline"
                  >
                    +{items.length - MAX} more
                  </button>
                )}
              </div>
              {items.length === 0 && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="absolute inset-0 top-8 cursor-pointer"
                  onClick={() => onCreate(day)}
                />
              )}
            </DropCell>
          )
        })}
      </div>
    </div>
  )
}

function WeekColumns({
  cursor,
  byDay,
  actions,
  onCreate,
  onDrop,
}: {
  cursor: Date
  byDay: Map<string, ProjectRow[]>
  actions: ReturnType<typeof useProjectActions>["actions"]
  onCreate: (day: Date) => void
  onDrop: (e: DragEvent, day: Date) => void
}) {
  const days = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) })
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => {
        const items = byDay.get(dayKey(day)) ?? []
        return (
          <DropCell
            key={day.toISOString()}
            label={format(day, "EEEE, MMMM d")}
            onDrop={(e) => onDrop(e, day)}
            className="flex min-h-64 flex-col gap-2 rounded-xl border bg-card p-2"
          >
            <div className="flex items-center justify-between px-1">
              <div className={cn("text-sm font-medium", isToday(day) && "text-primary")}>
                {format(day, "EEE")} <span className="text-muted-foreground">{format(day, "MMM d")}</span>
              </div>
              <Button variant="ghost" size="icon-xs" onClick={() => onCreate(day)} aria-label={`Create carousel on ${format(day, "MMMM d")}`}>
                <Plus />
              </Button>
            </div>
            {items.map((p) => (
              <ProjectCard key={p.id} project={p} actions={actions} draggable />
            ))}
            {items.length === 0 && (
              <button
                type="button"
                onClick={() => onCreate(day)}
                className="flex flex-1 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
              >
                <CalendarPlus className="mr-1 size-3.5" /> Add
              </button>
            )}
          </DropCell>
        )
      })}
    </div>
  )
}

function DayList({
  day,
  projects,
  actions,
  loading,
  onCreate,
}: {
  day: Date
  projects: ProjectRow[]
  actions: ReturnType<typeof useProjectActions>["actions"]
  loading: boolean
  onCreate: () => void
}) {
  if (!loading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <CalendarPlus className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">Nothing planned for {isToday(day) ? "today" : format(day, "MMMM d")}</p>
          <p className="text-sm text-muted-foreground">Create a carousel for this date.</p>
        </div>
        <Button onClick={onCreate}>
          <Plus /> Create carousel
        </Button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} actions={actions} />
      ))}
    </div>
  )
}

function Board({
  projects,
  actions,
  onMove,
}: {
  projects: ProjectRow[]
  actions: ReturnType<typeof useProjectActions>["actions"]
  onMove: (project: ProjectRow, status: ProjectStatus) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {PROJECT_STATUSES.map((status) => {
        const items = projects.filter((p) => p.status === status)
        return (
          <DropCell
            key={status}
            label={`${STATUS_LABELS[status]} column`}
            onDrop={(e) => {
              const id = e.dataTransfer.getData(PROJECT_DRAG_TYPE)
              const project = projects.find((p) => p.id === id)
              if (!project || project.status === status) return
              e.preventDefault()
              onMove(project, status)
            }}
            className="flex min-h-80 flex-col gap-3 rounded-xl border bg-muted/40 p-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {items.map((p) => (
                <ProjectCard key={p.id} project={p} actions={actions} draggable />
              ))}
            </div>
            {items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Drag carousels here</p>}
          </DropCell>
        )
      })}
    </div>
  )
}

function UnscheduledTray({
  projects,
  actions,
  loading,
}: {
  projects: ProjectRow[]
  actions: ReturnType<typeof useProjectActions>["actions"]
  loading: boolean
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-2 rounded-xl border bg-card p-3 lg:w-64" aria-label="Unscheduled carousels">
      <div className="flex items-center gap-2">
        <Inbox className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Unscheduled</h2>
        <span className="ml-auto text-xs text-muted-foreground">{loading ? "…" : projects.length}</span>
      </div>
      <p className="text-xs text-muted-foreground">Drag onto a day to schedule.</p>
      <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
        {projects.map((p) => (
          <ProjectChip key={p.id} project={p} actions={actions} />
        ))}
        {!loading && projects.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Everything has a date.</p>}
      </div>
    </aside>
  )
}
