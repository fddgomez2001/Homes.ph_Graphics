"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Download, ImageDown, Loader2, PanelTopOpen, Share2 } from "lucide-react"
import { toast } from "sonner"
import { useProjectSlides, useSlideRenders, type BoardSlide } from "@/components/board/slide-renders"
import { useExport } from "@/components/export/export-provider"
import { MadeBy } from "@/components/posting/made-by"
import { openChecklistWindow } from "@/components/posting/open-checklist"
import { PostingChecklist } from "@/components/posting/posting-checklist"
import { Button } from "@/components/ui/button"
import { useCachedQuery } from "@/lib/cache"
import { getProject } from "@/lib/data/projects"
import { formatSchedule } from "@/lib/dates"
import { copyText } from "@/lib/native"
import type { ProjectRow } from "@/lib/types"
import { cn, errorMessage } from "@/lib/utils"
import { PostStatePill, postState } from "./post-state"
import { useSiteLinks } from "./site-links"

/** Viewer previews: sharp on big and high-density screens, kept on this device. */
const VIEW_SIZE = 1080

/** One carousel, ready to post: the slides, the caption, downloads and "Mark as posted". */
export function SiteCarousel({ id: shownId }: { id?: string } = {}) {
  const params = useParams<{ id?: string }>()
  const id = shownId ?? params.id ?? ""
  const query = useCachedQuery(`projects:one:${id}`, () => getProject(id), { errorMessage })
  const project = query.data
  const slidesMap = useProjectSlides(useMemo(() => (project ? [project] : []), [project]))
  const slides = useMemo(() => slidesMap.get(id) ?? [], [slidesMap, id])
  const renders = useSlideRenders(slidesMap, VIEW_SIZE)

  if (!project) {
    return query.error ? (
      <Unavailable title="This carousel isn't available" text={query.error} />
    ) : (
      <SiteCarouselSkeleton />
    )
  }
  if (project.deleted_at) return <Unavailable title="This carousel was deleted" text="It's in the Trash of the Carousel Maker." />
  if (project.kind === "news") return <Unavailable title="News articles aren't listed here" text="This website shows carousels only." />

  return <CarouselPage project={project} slides={slides} renders={renders} />
}

function CarouselPage({
  project,
  slides,
  renders,
}: {
  project: ProjectRow
  slides: BoardSlide[]
  renders: Map<string, string>
}) {
  const { runExport, busy } = useExport()
  const links = useSiteLinks()
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const state = postState(project)
  const exportSlides = useMemo(() => slides.map((s) => ({ type: s.row.slide_type, design: s.design })), [slides])
  const ready = slides.length > 0

  const download = (kind: "zip" | "separate" | "single", slideIndex = 0, share = false) =>
    void runExport({ meta: project, slides: exportSlides, kind, format: "png", slideIndex, checks: false, share })

  // Facebook doesn't take a caption from other apps: copy it first, paste it in the post.
  const share = async () => {
    if (project.caption.trim()) {
      await copyText(project.caption).then(
        () => toast.success("Caption copied", { description: "Paste it into the post." }),
        () => {},
      )
    }
    download("separate", 0, true)
  }

  const copyCaption = () =>
    copyText(project.caption).then(
      () => {
        setCopied(true)
        toast.success("Caption copied", { description: "Paste it into the post." })
        setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error("Couldn't copy — select the text and copy it instead."),
    )

  return (
    <main className={cn("mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6", links.app ? "pt-4" : "pt-6")}>
      {!links.app && (
        <Link
          href={links.home}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" /> All carousels
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-[28px]">{project.title}</h1>
        <PostStatePill project={project} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {project.scheduled_at ? `Scheduled for ${formatSchedule(project.scheduled_at)}` : "Not scheduled"} · {slides.length || project.slide_count} slides ·
        1254 × 1254 px
      </p>
      <MadeBy project={project} className="mt-1 block text-xs" />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <SlideViewer slides={slides} renders={renders} title={project.title} index={index} onIndex={setIndex} onDownload={(i) => download("single", i)} disabled={busy} />

        <div className="flex flex-col gap-4 lg:sticky lg:top-22">
          {links.app ? (
            <Step number={1} title="Save or share the slides">
              <p className="text-[13px] text-muted-foreground">
                PNG, 1254 × 1254 px each, in order: <span className="font-medium text-slate-700 dark:text-slate-200">1</span> is the cover. Saved in Photos → Homes.ph.
              </p>
              <Button className="mt-3 h-11 w-full" onClick={() => download("separate")} disabled={!ready || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <ImageDown />} Save all {slides.length || ""} slides to Photos
              </Button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-10" onClick={() => void share()} disabled={!ready || busy}>
                  <Share2 /> Share…
                </Button>
                <Button variant="outline" className="h-10" onClick={() => download("single", index)} disabled={!ready || busy}>
                  <Download /> Only slide {index + 1}
                </Button>
              </div>
            </Step>
          ) : (
            <Step number={1} title="Download the slides">
              <p className="text-[13px] text-muted-foreground">
                PNG, 1254 × 1254 px each, named in order: <span className="font-medium text-slate-700 dark:text-slate-200">1.png</span> is the cover, then 2.png, 3.png…
              </p>
              <Button className="mt-3 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => download("zip")} disabled={!ready || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Download />} Download all {slides.length || ""} slides (ZIP)
              </Button>
              <Button variant="outline" className="mt-2 h-9 w-full" onClick={() => download("single", index)} disabled={!ready || busy}>
                <Download /> Only slide {index + 1} ({index + 1}.png)
              </Button>
            </Step>
          )}

          <Step number={2} title="Copy the caption">
            {project.caption.trim() ? (
              <>
                <p className="max-h-64 overflow-y-auto text-[14px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200" aria-label="Caption">
                  {project.caption}
                </p>
                <Button variant="outline" className={cn("mt-3 w-full", links.app ? "h-10" : "h-9")} onClick={copyCaption}>
                  {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />} {copied ? "Copied" : "Copy caption"}
                </Button>
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">No caption yet.</p>
            )}
          </Step>

          <Step number={3} title={state === "posted" ? "Posted on every page" : "Post on the Facebook pages"} done={state === "posted"}>
            <p className="mb-3 text-[13px] text-muted-foreground">
              {state === "draft"
                ? "Still a draft — check with the designer before posting."
                : "Tick each page after posting on it. Your name and the time are saved; it's Published once all pages are ticked."}
            </p>
            <PostingChecklist project={project} />
            {!links.app && (
              <Button variant="outline" className="mt-3 h-9 w-full" onClick={() => openChecklistWindow(project.id)}>
                <PanelTopOpen /> Open in a small window
              </Button>
            )}
          </Step>
        </div>
      </div>

    </main>
  )
}

function Step({ number, title, done, children }: { number: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs" aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2.5 text-[15px] font-semibold">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
            done ? "bg-emerald-600 text-white" : "bg-muted text-slate-600 dark:text-slate-300",
          )}
          aria-hidden="true"
        >
          {done ? <Check className="size-3.5" /> : number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Swipe or use the arrows; the thumbnails jump straight to a slide. */
function SlideViewer({
  slides,
  renders,
  title,
  index,
  onIndex,
  onDownload,
  disabled,
}: {
  slides: BoardSlide[]
  renders: Map<string, string>
  title: string
  index: number
  onIndex: (i: number) => void
  onDownload: (i: number) => void
  disabled: boolean
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const count = slides.length

  const go = useCallback(
    (i: number) => {
      const el = scroller.current
      if (!el || !count) return
      const next = Math.max(0, Math.min(count - 1, i))
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" })
      onIndex(next)
    },
    [count, onIndex],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, [contenteditable], [role=dialog]")) return
      if (e.key === "ArrowRight") go(index + 1)
      if (e.key === "ArrowLeft") go(index - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, index])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative mx-auto w-full max-w-[640px]">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
            if (i !== index) onIndex(i)
          }}
          className="flex snap-x snap-mandatory overflow-x-auto bg-[#0B1F8E] shadow-[0_2px_6px_rgba(15,23,42,0.18),0_24px_48px_-16px_rgba(15,23,42,0.45)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={`Slides of ${title}`}
          aria-roledescription="carousel"
        >
          {count === 0 ? (
            <div className="aspect-square w-full animate-pulse bg-gradient-to-b from-[#1A3ED6] to-[#0B1F8E]" />
          ) : (
            slides.map((slide, i) => (
              <figure key={slide.key} className="relative aspect-square w-full shrink-0 snap-center" aria-label={`Slide ${i + 1} of ${count}`}>
                {renders.get(slide.key) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={renders.get(slide.key)} alt={i === 0 ? `Cover of ${title}` : `Slide ${i + 1}`} className="size-full" draggable={false} />
                ) : (
                  <span className="flex size-full items-center justify-center bg-gradient-to-b from-[#1A3ED6] to-[#0B1F8E] text-white/80">
                    <Loader2 className="size-6 animate-spin" />
                  </span>
                )}
              </figure>
            ))
          )}
        </div>
        {count > 1 && (
          <>
            <ViewerButton side="left" label="Previous slide" hidden={index === 0} onClick={() => go(index - 1)}>
              <ChevronLeft className="size-5" />
            </ViewerButton>
            <ViewerButton side="right" label="Next slide" hidden={index >= count - 1} onClick={() => go(index + 1)}>
              <ChevronRight className="size-5" />
            </ViewerButton>
          </>
        )}
        {count > 0 && (
          <>
            {/* Top corner: the band there has no text to cover. */}
            <span className="absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white tabular-nums backdrop-blur">
              {index === 0 ? "Cover" : `Slide ${index + 1}`} · {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => onDownload(index)}
              disabled={disabled}
              aria-label={`Download slide ${index + 1}`}
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-card/90 text-slate-800 dark:text-slate-100 shadow-md backdrop-blur transition hover:bg-card disabled:opacity-50"
            >
              <Download className="size-4" />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="mx-auto flex w-full max-w-[640px] gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose a slide">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}`}
              onClick={() => go(i)}
              className={cn(
                "relative aspect-square w-16 shrink-0 overflow-hidden bg-[#0B1F8E] transition outline-none sm:w-[72px]",
                i === index ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100",
              )}
            >
              {renders.get(slide.key) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={renders.get(slide.key)} alt="" className="size-full" draggable={false} />
              )}
              <span className="absolute bottom-0.5 left-1 text-[10px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{i + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ViewerButton({ side, label, hidden, onClick, children }: { side: "left" | "right"; label: string; hidden: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      tabIndex={hidden ? -1 : 0}
      className={cn(
        "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-slate-800 dark:text-slate-100 shadow-md backdrop-blur transition hover:bg-card",
        side === "left" ? "left-3" : "right-3",
        hidden && "pointer-events-none opacity-0",
      )}
    >
      {children}
    </button>
  )
}

function Unavailable({ title, text }: { title: string; text: string }) {
  const links = useSiteLinks()
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 pt-24 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" className="mt-2 rounded-full bg-card">
        <Link href={links.home}>
          <ArrowLeft /> All carousels
        </Link>
      </Button>
    </main>
  )
}

export function SiteCarouselSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6" aria-busy="true">
      <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="mx-auto aspect-square w-full max-w-[640px] animate-pulse bg-slate-200 dark:bg-slate-800" />
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    </main>
  )
}
