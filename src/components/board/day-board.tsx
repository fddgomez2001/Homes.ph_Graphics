"use client"

import { use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { io } from "next/cache"
import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format, isValid, parse, startOfDay } from "date-fns"
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Loader2, Maximize, Minus, Pencil, Plus, WandSparkles } from "lucide-react"
import { toast } from "sonner"
import { AiSuggestion } from "@/components/ai/ai-suggestion"
import { PageHeader } from "@/components/app-shell/page-header"
import { useCreateCarousel } from "@/components/projects/create-carousel-dialog"
import { useProjectSlides, useSlideRenders, type BoardSlide } from "./slide-renders"
import { ProjectActionsMenu } from "@/components/projects/project-actions-menu"
import { StatusBadge } from "@/components/projects/status-badge"
import { useProjectActions } from "@/components/projects/use-project-actions"
import { useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateProject } from "@/lib/data/projects"
import { suggestCaption } from "@/lib/ai/client"
import { draftCaption } from "@/lib/design/caption"
import { slideLabel } from "@/lib/design/templates"
import type { ProjectRow } from "@/lib/types"
import { cn, errorMessage } from "@/lib/utils"

/** Frame size on the board at 100% zoom (the slides themselves are 1254 × 1254). */
const FRAME = 300
const MIN_ZOOM = 0.1
const MAX_ZOOM = 3


function parseDay(value: string | null): Date | null {
  if (!value) return null
  const d = parse(value, "yyyy-MM-dd", new Date())
  return isValid(d) ? d : null
}

/**
 * Figma-style day workspace: every carousel scheduled on a day as a row of frames
 * (cover first, then cards) with its caption underneath. Pan and zoom like Figma;
 * click a frame to edit that slide.
 */
export function DayBoard() {
  use(io())
  const router = useRouter()
  const params = useSearchParams()
  const openCreate = useCreateCarousel()
  const day = useMemo(() => startOfDay(parseDay(params.get("date")) ?? new Date()), [params])
  const setDay = (d: Date) => router.replace(`/board?date=${format(d, "yyyy-MM-dd")}`, { scroll: false })

  const { projects, loading, error, apply, reload } = useProjects({
    from: day.toISOString(),
    to: addDays(day, 1).toISOString(),
    orderBy: "scheduled_at",
    ascending: true,
  })
  const { actions, dialogs } = useProjectActions(apply)

  const slides = useProjectSlides(projects)
  const renders = useSlideRenders(slides)

  return (
    <div className="flex h-screen flex-col">
      <PageHeader title="Day Board" description={format(day, "EEEE, MMMM d, yyyy")} createDate={day}>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setDay(startOfDay(new Date()))}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
            <ChevronRight />
          </Button>
          <Input
            type="date"
            value={format(day, "yyyy-MM-dd")}
            onChange={(e) => {
              const d = parseDay(e.target.value)
              if (d) setDay(d)
            }}
            className="h-9 w-40"
            aria-label="Board date"
          />
        </div>
      </PageHeader>

      <Canvas key={format(day, "yyyy-MM-dd")} ready={!loading}>
        {error && <p className="mb-6 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {!loading && projects.length === 0 && (
          <div className="flex w-[720px] flex-col items-start gap-3 rounded-2xl border border-dashed bg-card/70 p-10">
            <p className="text-2xl font-semibold">No carousels on {format(day, "MMMM d")} yet</p>
            <p className="text-lg text-muted-foreground">Create as many carousels for this day as you need — each appears here as a row.</p>
            <Button size="lg" onClick={() => openCreate({ date: day })} data-board-control>
              <Plus /> Create carousel for this day
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-24">
          {projects.map((project) => (
            <CarouselRow
              key={project.id}
              project={project}
              slides={slides.get(project.id)}
              renders={renders}
              actions={actions}
              onOpen={(slideId) => router.push(`/editor/${project.id}${slideId ? `?slide=${slideId}` : ""}`)}
              onAddCard={() => router.push(`/editor/${project.id}?add=card`)}
              onCaptionSaved={(p) => {
                apply({ type: "updated", project: p })
                reload()
              }}
            />
          ))}
          {projects.length > 0 && (
            <button
              type="button"
              data-board-control
              onClick={() => openCreate({ date: day })}
              className="flex h-24 w-[720px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-lg font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="size-5" /> New carousel for {format(day, "MMMM d")}
            </button>
          )}
        </div>
      </Canvas>
      {dialogs}
    </div>
  )
}

function CarouselRow({
  project,
  slides,
  renders,
  actions,
  onOpen,
  onAddCard,
  onCaptionSaved,
}: {
  project: ProjectRow
  slides?: BoardSlide[]
  renders: Map<string, string>
  actions: ReturnType<typeof useProjectActions>["actions"]
  onOpen: (slideId?: string) => void
  onAddCard: () => void
  onCaptionSaved: (project: ProjectRow) => void
}) {
  const rowWidth = Math.max(720, ((slides?.length ?? project.slide_count) + 1) * (FRAME + 24))
  return (
    <section className="flex flex-col gap-4" aria-label={project.title}>
      <div className="flex items-center gap-3" data-board-control>
        <h2 className="text-2xl font-semibold tracking-tight">{project.title}</h2>
        <StatusBadge status={project.status} className="text-xs" />
        {project.scheduled_at && <span className="text-sm text-muted-foreground">{format(new Date(project.scheduled_at), "h:mm a")}</span>}
        {!project.caption.trim() && (
          <span className="flex items-center gap-1 rounded-full border border-amber-300/80 dark:border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-3" /> Caption needed
          </span>
        )}
        <Button variant="outline" size="sm" onClick={() => onOpen()}>
          <ExternalLink /> Open editor
        </Button>
        <ProjectActionsMenu project={project} actions={actions} align="start" />
      </div>

      <div className="flex items-start gap-6">
        {(slides ?? Array.from({ length: project.slide_count }, () => null)).map((slide, index) => (
          <div key={slide?.row.id ?? index} className="flex flex-col gap-1.5" style={{ width: FRAME }}>
            <span className="truncate text-sm text-muted-foreground">
              {slide ? slideLabel(slide.design, index === 0 ? project.title : `Card ${index}`) : "…"}
            </span>
            <button
              type="button"
              data-board-control
              onClick={() => slide && onOpen(slide.row.id)}
              className="group relative block overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-sm ring-primary transition-shadow hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
              style={{ width: FRAME, height: FRAME }}
              aria-label={`Edit slide ${index + 1} of ${project.title}`}
            >
              {slide && renders.get(slide.key) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={renders.get(slide.key)} alt="" className="size-full" draggable={false} />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-slate-400 dark:text-slate-500" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2 text-left text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {index === 0 ? "Cover" : `Card ${index}`} · click to edit
              </span>
            </button>
          </div>
        ))}
        <div className="flex flex-col gap-1.5" style={{ width: FRAME }}>
          <span className="text-sm text-transparent">.</span>
          <button
            type="button"
            data-board-control
            onClick={onAddCard}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 text-muted-foreground hover:border-primary hover:text-primary"
            style={{ width: FRAME, height: FRAME }}
          >
            <Plus className="size-6" />
            <span className="text-sm font-medium">Add card</span>
          </button>
        </div>
      </div>

      <CaptionBlock project={project} slides={slides} width={rowWidth} onSaved={onCaptionSaved} />
    </section>
  )
}

function CaptionBlock({
  project,
  slides,
  width,
  onSaved,
}: {
  project: ProjectRow
  slides?: BoardSlide[]
  width: number
  onSaved: (project: ProjectRow) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.caption)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const caption = project.caption.trim()

  const edit = (text: string) => {
    setDraft(text)
    setEditing(true)
  }

  const save = async () => {
    if (!draft.trim()) return void toast.error("The caption is required.", { description: "Write a caption or draft one from the slides." })
    setBusy(true)
    try {
      onSaved(await updateProject(project.id, { caption: draft }))
      setEditing(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const copy = () =>
    navigator.clipboard.writeText(project.caption).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => toast.error("Couldn't access the clipboard"),
    )

  const ghost = "h-8 gap-1.5 px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-foreground"

  return (
    <div className="flex flex-col gap-3" style={{ width: Math.min(width, 880) }} data-board-control>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Caption</span>
        {!caption && <span className="text-[11px] font-medium tracking-wide text-amber-700 dark:text-amber-300">Required</span>}
        <span className="h-px flex-1 bg-slate-300/70 dark:bg-slate-700/70" />
        {caption && !editing && <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{project.caption.length} characters</span>}
        {!editing && (
          <div className="flex items-center">
            {caption ? (
              <>
                <Button size="sm" variant="ghost" className={ghost} onClick={copy}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" variant="ghost" className={ghost} onClick={() => edit(project.caption)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className={ghost} onClick={() => edit(draftCaption(slides ?? []))} disabled={!slides?.length}>
                  <WandSparkles className="size-3.5" /> Draft from slides
                </Button>
                <Button size="sm" variant="ghost" className={ghost} onClick={() => edit("")}>
                  <Pencil className="size-3.5" /> Write
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2.5">
          {slides?.length ? (
            <AiSuggestion
              label={draft.trim() ? "Rewrite caption with AI" : "Write caption with AI"}
              request={() => suggestCaption(slides.map((s) => ({ type: s.row.slide_type, design: s.design })), draft)}
              onUse={setDraft}
            />
          ) : null}
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void save()
              if (e.key === "Escape") setEditing(false)
            }}
            rows={5}
            placeholder="Write the post caption…"
            className="min-h-32 resize-y rounded-md border-slate-300/80 dark:border-slate-700/80 bg-transparent px-4 py-3 text-[17px] leading-relaxed text-slate-800 dark:text-slate-100 shadow-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:border-slate-400 focus-visible:ring-slate-900/5 dark:focus-visible:ring-white/10 md:text-[17px]"
            aria-label={`Caption for ${project.title}`}
          />
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={() => void save()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Save caption
            </Button>
            <Button size="sm" variant="ghost" className={ghost} onClick={() => setDraft(draftCaption(slides ?? []))} disabled={!slides?.length}>
              <WandSparkles className="size-3.5" /> Draft from slides
            </Button>
            <Button size="sm" variant="ghost" className={ghost} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">Ctrl+Enter to save · Esc to cancel</span>
          </div>
        </div>
      ) : caption ? (
        <p className="border-l border-slate-300 dark:border-slate-700 pl-5 text-[17px] leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-100">{project.caption}</p>
      ) : (
        <button
          type="button"
          onClick={() => edit("")}
          className="border-l border-slate-300 dark:border-slate-700 py-1 pl-5 text-left text-[15px] text-slate-400 dark:text-slate-500 italic transition-colors hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
        >
          No caption yet — every carousel needs one before it can be scheduled. Click to write it.
        </button>
      )}
    </div>
  )
}


/** Pan/zoom surface: scroll to pan, Ctrl+scroll (or pinch) to zoom, drag the background to move around. */
function Canvas({ children, ready }: { children: React.ReactNode; ready: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 48, y: 40, zoom: 0.8 })
  const [panning, setPanning] = useState(false)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const fitted = useRef(false)

  const fit = useCallback(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    const zoom = Math.max(MIN_ZOOM, Math.min(1, (viewport.clientWidth - 96) / Math.max(1, content.scrollWidth)))
    setView({ x: 48, y: 40, zoom })
  }, [])

  const zoomTo = useCallback((zoom: number, at?: { x: number; y: number }) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const point = at ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }
    setView((v) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
      return { zoom: next, x: point.x - (point.x - v.x) * (next / v.zoom), y: point.y - (point.y - v.y) * (next / v.zoom) }
    })
  }, [])

  // Fit the rows to the window once the content is there.
  useLayoutEffect(() => {
    if (!ready || fitted.current) return
    fitted.current = true
    const id = requestAnimationFrame(fit)
    return () => cancelAnimationFrame(id)
  }, [ready, fit])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = viewport.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        setView((v) => {
          const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * Math.exp(-e.deltaY * 0.0025)))
          const px = e.clientX - rect.left
          const py = e.clientY - rect.top
          return { zoom: next, x: px - (px - v.x) * (next / v.zoom), y: py - (py - v.y) * (next / v.zoom) }
        })
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX
        const dy = e.shiftKey ? 0 : e.deltaY
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }))
      }
    }
    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <div
      ref={viewportRef}
      className={cn("relative min-h-0 flex-1 touch-none overflow-hidden bg-[#E9EDF2] dark:bg-[#0b111d]", panning ? "cursor-grabbing" : "cursor-grab")}
      style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
      onPointerDown={(e) => {
        // Controls (frames, buttons, captions) keep their own clicks; the background pans.
        if ((e.target as HTMLElement).closest("[data-board-control]") || e.button === 2) return
        drag.current = { x: e.clientX, y: e.clientY }
        setPanning(true)
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        drag.current = { x: e.clientX, y: e.clientY }
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
      }}
      onPointerUp={() => {
        drag.current = null
        setPanning(false)
      }}
    >
      <div
        ref={contentRef}
        className="absolute top-0 left-0 w-max cursor-default"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: "0 0" }}
      >
        {children}
      </div>

      <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm" data-board-control>
        <Button variant="ghost" size="icon-sm" onClick={() => zoomTo(view.zoom / 1.25)} aria-label="Zoom out">
          <Minus />
        </Button>
        <button type="button" className="w-14 text-center text-xs tabular-nums hover:underline" onClick={() => zoomTo(1)} title="Zoom to 100%">
          {Math.round(view.zoom * 100)}%
        </button>
        <Button variant="ghost" size="icon-sm" onClick={() => zoomTo(view.zoom * 1.25)} aria-label="Zoom in">
          <Plus />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={fit} aria-label="Fit to screen">
          <Maximize />
        </Button>
      </div>
      <p className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-card/80 px-2 py-1 text-[11px] text-muted-foreground">
        Scroll to move · Ctrl + scroll to zoom · drag the background to pan · click a slide to edit
      </p>
    </div>
  )
}
