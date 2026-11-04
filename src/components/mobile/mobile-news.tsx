"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { addDays, format, isToday, startOfDay } from "date-fns"
import { ChevronLeft, ChevronRight, ImageDown, Loader2, Share2 } from "lucide-react"
import { useProjectSlides, useSlideRenders, type BoardSlide } from "@/components/board/slide-renders"
import { useExport } from "@/components/export/export-provider"
import { useProjects } from "@/components/projects/use-projects"
import { reportDay } from "@/components/report/daily-report-page"
import { Button } from "@/components/ui/button"
import { NEWS_BRANDS, newsBrandOf, newsFileName, newsTimesFor } from "@/lib/design/news-templates"
import { NEWS_HEADLINE_PLACEHOLDER } from "@/lib/design/templates"
import type { ProjectRow } from "@/lib/types"
import { cn } from "@/lib/utils"

const ymd = (d: Date) => format(d, "yyyy-MM-dd")

/** The day's news posts (PicklePlay PH, FHI Global Property and Homes.ph CARAGA, five a day each), ready to save or share. */
export function MobileNews() {
  const params = useSearchParams()
  const day = reportDay(params.get("newsDay"))
  const from = startOfDay(day)
  const { projects, loading, error } = useProjects({
    kind: "news",
    from: from.toISOString(),
    to: addDays(from, 1).toISOString(),
    orderBy: "scheduled_at",
    ascending: true,
    limit: 200,
  })
  const slides = useProjectSlides(projects)
  const renders = useSlideRenders(slides)

  const slots = useMemo(() => {
    const slots = new Map<string, ProjectRow>()
    for (const p of projects) {
      const design = slides.get(p.id)?.[0]?.design
      if (!design || !p.scheduled_at) continue
      const key = `${newsBrandOf(design)}@${format(new Date(p.scheduled_at), "HH:mm")}`
      if (!slots.has(key)) slots.set(key, p)
    }
    return slots
  }, [projects, slides])
  const waiting = loading || projects.some((p) => !slides.get(p.id))

  const go = (next: Date) => {
    const query = new URLSearchParams(window.location.search)
    if (isToday(next)) query.delete("newsDay")
    else query.set("newsDay", ymd(next))
    window.history.replaceState(null, "", query.size ? `/?${query}` : "/")
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-8">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center justify-between gap-1 rounded-xl border bg-card p-1 shadow-xs sm:flex-none">
          <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => go(addDays(day, -1))}>
            <ChevronLeft />
          </Button>
          <span className="min-w-40 text-center text-[15px] font-semibold" aria-live="polite">
            {isToday(day) ? "Today" : format(day, "EEE, MMM d")}
            <span className="block text-[11px] font-normal text-muted-foreground">{format(day, "MMMM d, yyyy")}</span>
          </span>
          <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => go(addDays(day, 1))}>
            <ChevronRight />
          </Button>
        </div>
        {!isToday(day) && (
          <Button variant="outline" className="h-11 rounded-xl bg-card" onClick={() => go(new Date())}>
            Today
          </Button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {NEWS_BRANDS.map((brand) => {
        const times = newsTimesFor(brand.id)
        const made = times.filter((t) => slots.has(`${brand.id}@${t.time}`)).length
        return (
          <section key={brand.id} className="mt-7" aria-label={`${brand.name} posts`}>
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-border pb-2">
              <span className="text-base font-semibold">{brand.name}</span>
              <span className="text-xs text-muted-foreground">{brand.site}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{waiting ? "…" : `${made}/${times.length} made`}</span>
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={`${brand.name} posting times`}>
              {times.map((slot) => {
                const project = slots.get(`${brand.id}@${slot.time}`)
                const slide = project ? slides.get(project.id)?.[0] : undefined
                return (
                  <li key={`${ymd(from)}-${slot.time}`}>
                    <NewsCard
                      brandName={brand.name}
                      label={slot.label}
                      fileName={newsFileName(from, slot, brand.name)}
                      project={project}
                      slide={slide}
                      render={slide ? renders.get(slide.key) : undefined}
                      waiting={waiting}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <p className="mt-8 text-center text-xs text-muted-foreground">News posts are made in the Carousel Maker on the computer.</p>
    </div>
  )
}

function NewsCard({
  brandName,
  label,
  fileName,
  project,
  slide,
  render,
  waiting,
}: {
  brandName: string
  label: string
  fileName: string
  project?: ProjectRow
  slide?: BoardSlide
  render?: string
  waiting: boolean
}) {
  const { runExport, busy } = useExport()
  const headline = project && slide ? (project.title === NEWS_HEADLINE_PLACEHOLDER ? "" : project.title) : ""
  const save = (share: boolean) =>
    project &&
    slide &&
    void runExport({ meta: project, slides: [{ type: "cover", design: slide.design }], kind: "single", format: "png", checks: false, fileName, share })

  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border bg-card p-2 shadow-xs">
      <div className="flex items-center justify-between px-0.5">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{label}</span>
        {project && <span className="text-[10px] text-muted-foreground uppercase">{project.status === "published" ? "Posted" : "Ready"}</span>}
      </div>
      {project && slide ? (
        <div className="overflow-hidden rounded-md bg-muted" style={{ aspectRatio: `${slide.design.width} / ${slide.design.height}` }}>
          {render ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={render} alt={headline || `${label} post`} className="size-full object-cover" draggable={false} />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </span>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "flex aspect-square flex-col items-center justify-center rounded-md border border-dashed px-2 text-center text-[11px] text-muted-foreground",
            waiting && "animate-pulse",
          )}
        >
          {waiting ? "" : "Not made yet"}
        </div>
      )}
      {project && slide && (
        <>
          <p className="line-clamp-2 min-h-[2lh] px-0.5 text-[12px] leading-snug font-medium">{headline || <span className="text-muted-foreground">No headline</span>}</p>
          <div className="mt-auto grid grid-cols-[1fr_auto] gap-1.5">
            <Button variant="outline" size="sm" className="h-9" disabled={busy} onClick={() => save(false)} aria-label={`Save ${brandName} ${label} post to Photos`}>
              <ImageDown /> Save
            </Button>
            <Button variant="outline" size="icon" className="size-9" disabled={busy} onClick={() => save(true)} aria-label={`Share ${brandName} ${label} post`}>
              <Share2 />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
