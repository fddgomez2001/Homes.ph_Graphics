"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format, isToday, isTomorrow, isValid, parse, startOfDay } from "date-fns"
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  GalleryHorizontalEnd,
  ImageOff,
  Loader2,
  Maximize2,
  Newspaper,
  RefreshCw,
  Share2,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app-shell/page-header"
import { useProjectSlides, useSlideRenders } from "@/components/board/slide-renders"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { loadReportData, type ReportCarousel, type ReportData, type ReportPost } from "@/lib/data/report"
import { IS_MOBILE_APP } from "@/lib/env"
import { LOGO_BLUE_SRC, PICKLEPLAY_LOGO_SRC } from "@/lib/design/constants"
import { NEWS_BRANDS, newsTimeLabel, newsTimesFor, type NewsBrand } from "@/lib/design/news-templates"
import { NEWS_HEADLINE_PLACEHOLDER } from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"
import { doneCarousels, FHI_EMBLEM_SRC, planPending, REPORT_WIDTH, type PendingItem, type ReportImages } from "@/lib/report/daily-report"
import { cn, errorMessage } from "@/lib/utils"

type Size = "standard" | "full"
const SCALE: Record<Size, number> = { standard: 0.5, full: 1 }

const images: ReportImages = {
  design: async (design: SlideDesign, width: number) => {
    const { renderDesignToCanvas } = await import("@/lib/design/render")
    return renderDesignToCanvas(design, { pixelRatio: width / design.width, tolerateMissingImages: true })
  },
}

/** Logo and post shape of each brand on this page. */
const BRAND_UI: Record<NewsBrand, { logo: string; aspect: string }> = {
  pickleplay: { logo: PICKLEPLAY_LOGO_SRC, aspect: "aspect-square" },
  fhi: { logo: FHI_EMBLEM_SRC, aspect: "aspect-[1152/1408]" },
  caraga: { logo: LOGO_BLUE_SRC, aspect: "aspect-square" },
}

type Zoom = { src: string; alt: string; wide?: boolean }

/** The day in a "?day=yyyy-MM-dd" search param (today when missing or invalid). */
export function reportDay(value: string | null) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : null
  return parsed && isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date())
}

const dayName = (day: Date) => (isToday(day) ? "Today" : isTomorrow(day) ? "Tomorrow" : format(day, "EEEE"))

/**
 * Daily Report: the "Daily Tasks" image for a day — the PicklePlay, FHI and
 * Homes.ph CARAGA article posts, the carousel and the Homes.ph pages it went out on (DONE),
 * and what's still to do (PENDING) — laid out as a dashboard and downloaded as a PNG.
 */
export function DailyReportPage() {
  const router = useRouter()
  const params = useSearchParams()
  const go = (next: Date) => router.replace(isToday(next) ? "/report" : `/report?day=${format(next, "yyyy-MM-dd")}`, { scroll: false })
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Daily Report" description="What was posted today and what's still to do, as the Daily Tasks image" />
      <DailyReport day={reportDay(params.get("day"))} onDay={go} className="flex-1 px-4 py-6 lg:px-8" />
    </div>
  )
}

/** Day picker and download, the day at a glance, the posts and carousel, what's pending, and the image itself. */
export function DailyReport({ day, onDay, className }: { day: Date; onDay: (day: Date) => void; className?: string }) {
  const dayKey = format(day, "yyyy-MM-dd")
  const [size, setSize] = useState<Size>("standard")
  const [data, setData] = useState<{ key: string; report: ReportData } | null>(null)
  const [preview, setPreview] = useState<{ key: string; url: string; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [progress, setProgress] = useState<{ done: number; total: number; saving?: boolean } | null>(null)
  const [zoom, setZoom] = useState<Zoom | null>(null)

  // Data, then a small preview of the image.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const report = await loadReportData(parse(dayKey, "yyyy-MM-dd", new Date()))
        if (cancelled) return
        setError(null)
        setData({ key: dayKey, report })
        const { renderDailyReport } = await import("@/lib/report/daily-report")
        const canvas = await renderDailyReport(report, { scale: 0.12, images })
        if (!cancelled) setPreview({ key: dayKey, url: canvas.toDataURL("image/jpeg", 0.86), height: Math.round(canvas.height / 0.12) })
      } catch (e) {
        if (!cancelled) setError(errorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dayKey, version])

  const report = data?.key === dayKey ? data.report : null
  const shown = preview?.key === dayKey ? preview : null

  // Post and slide pictures: the same cached previews as News Article and Home.
  const carousels = useMemo(() => (report ? doneCarousels(report.today) : []), [report])
  const projects = useMemo(() => (report ? [...report.today.posts.map((p) => p.project), ...carousels.map((c) => c.project)] : []), [report, carousels])
  const slides = useProjectSlides(projects)
  const renders = useSlideRenders(slides)
  const picture = (projectId: string, index = 0) => {
    const slide = slides.get(projectId)?.[index]
    return slide ? renders.get(slide.key) : undefined
  }

  const download = async (share = false) => {
    if (!report) return
    setProgress({ done: 0, total: 1 })
    try {
      const { renderDailyReport } = await import("@/lib/report/daily-report")
      const { canvasToBlob } = await import("@/lib/design/render")
      const { downloadBlob } = await import("@/lib/export")
      const canvas = await renderDailyReport(report, { scale: SCALE[size], images, onProgress: (done, total) => setProgress({ done, total }) })
      setProgress((p) => (p ? { ...p, saving: true } : p))
      const blob = await canvasToBlob(canvas, "image/png")
      const file = { name: `Daily Tasks ${dayKey}.png`, blob }
      if (IS_MOBILE_APP) {
        const native = await import("@/lib/native")
        if (share) return void (await native.shareFiles([file], `Daily Tasks ${dayKey}`))
        const where = await native.saveToGallery([file], "Reports")
        toast.success("Report saved", { description: `${where} · ${canvas.width} × ${canvas.height} px` })
        return
      }
      downloadBlob(blob, file.name)
      toast.success("Report downloaded", { description: `${canvas.width} × ${canvas.height} px` })
    } catch (e) {
      toast.error("Couldn't make the report", { description: errorMessage(e) })
    } finally {
      setProgress(null)
    }
  }

  const pending = report ? planPending(report) : []
  const postsOf = (brand: NewsBrand) => report?.today.posts.filter((p) => p.brand === brand) ?? []
  const pageCount = report?.pages.length || 17
  const dayCarousel = report?.today.carousels[0]

  // Phones get the standard size: a full-size canvas can be more than a phone's memory allows.
  const sizes = IS_MOBILE_APP ? (["standard"] as const) : (["standard", "full"] as const)
  const busy = progress !== null

  return (
    <div className={cn("mx-auto flex w-full max-w-[1400px] flex-col gap-6", className)}>
      {/* Toolbar: the day, then what to do with the image */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-2.5 shadow-xs">
        <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-between">
          <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => onDay(addDays(day, -1))}>
            <ChevronLeft />
          </Button>
          <div className="min-w-40 px-1 text-center" aria-live="polite">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{dayName(day)}</p>
            <p className="text-[15px] leading-tight font-semibold">{format(day, "MMMM d, yyyy")}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => onDay(addDays(day, 1))}>
            <ChevronRight />
          </Button>
        </div>
        {!isToday(day) && (
          <Button variant="outline" size="sm" onClick={() => onDay(new Date())}>
            Today
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full sm:ml-auto">
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw />
          </Button>
          {sizes.length > 1 && (
            <div className="inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Image size">
              {sizes.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={size === id}
                  onClick={() => setSize(id)}
                  className={cn(
                    "rounded-md px-3 py-1 text-[13px] font-medium whitespace-nowrap transition-colors",
                    size === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {id === "standard" ? `Standard · ${REPORT_WIDTH * SCALE.standard} px` : `Full size · ${REPORT_WIDTH} px`}
                </button>
              ))}
            </div>
          )}
          {IS_MOBILE_APP && (
            <Button variant="outline" onClick={() => void download(true)} disabled={!report || busy}>
              <Share2 /> Share…
            </Button>
          )}
          <Button onClick={() => void download()} disabled={!report || busy} className="max-sm:flex-1">
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {progress
              ? progress.saving
                ? "Saving PNG…"
                : `Drawing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
              : IS_MOBILE_APP
                ? "Save to Photos"
                : "Download report (PNG)"}
          </Button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {/* The day at a glance */}
      <section aria-label="Report summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {NEWS_BRANDS.map((b) => (
          <StatTile
            key={b.id}
            icon={<BrandLogo src={BRAND_UI[b.id].logo} />}
            label={b.name}
            value={report ? postsOf(b.id).length : null}
            total={newsTimesFor(b.id).length}
            note={(left) => (left ? `${left} still to post` : "All posted")}
          />
        ))}
        <StatTile
          icon={<TileIcon className="bg-primary/12 text-primary"><GalleryHorizontalEnd /></TileIcon>}
          label="Carousel pages"
          value={report ? (dayCarousel ? (carousels[0]?.postedPages.length ?? 0) : null) : null}
          total={pageCount}
          note={(left) => (left ? `${left} page${left === 1 ? "" : "s"} left` : "Posted everywhere")}
          empty={report && !dayCarousel ? "No carousel this day" : undefined}
        />
        <StatTile
          icon={<TileIcon className={pending.length ? "bg-amber-500/12 text-amber-600 dark:text-amber-400" : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"}><Clock /></TileIcon>}
          label="Pending"
          className="max-sm:col-span-2"
          value={report ? pending.length : null}
          note={() => (pending.length ? `item${pending.length === 1 ? "" : "s"} to do` : "All caught up")}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionHeading icon={<CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />} title="Done" note={report ? `${format(day, "MMMM d")}` : undefined} />
          {NEWS_BRANDS.map((b) => (
            <BrandCard
              key={b.id}
              brand={b.id}
              name={b.name}
              site={b.site}
              posts={postsOf(b.id)}
              loading={!report}
              picture={picture}
              onZoom={setZoom}
            />
          ))}
          {report && carousels.length === 0 ? (
            <EmptyCard icon={<GalleryHorizontalEnd />} text={dayCarousel ? "Today's carousel isn't posted on any page yet." : "No carousel scheduled for this day."} />
          ) : (
            carousels.map((c) => <CarouselCard key={c.project.id} carousel={c} pageCount={pageCount} picture={picture} onZoom={setZoom} />)
          )}

          <SectionHeading icon={<Clock className="text-amber-600 dark:text-amber-400" />} title="Pending" note={report ? `${pending.length} item${pending.length === 1 ? "" : "s"}` : undefined} />
          {report ? <PendingList items={pending} /> : <div className="h-32 animate-pulse rounded-2xl bg-muted" />}
        </div>

        {/* The image itself, exactly what downloads */}
        <aside aria-label="Report image" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs lg:sticky lg:top-20">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Daily Tasks image</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {REPORT_WIDTH * SCALE[size]} × {shown ? Math.round(shown.height * SCALE[size]) : "…"} px
            </span>
          </div>
          <figure aria-label="Report preview" className="relative overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {shown ? (
              <button
                type="button"
                onClick={() => setZoom({ src: shown.url, alt: `Daily Tasks report for ${format(day, "MMMM d, yyyy")}`, wide: true })}
                className="group block max-h-[min(62vh,40rem)] w-full cursor-zoom-in overflow-hidden"
                aria-label="View the report full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shown.url} alt={`Daily Tasks report for ${format(day, "MMMM d, yyyy")}`} className="w-full transition duration-300 group-hover:opacity-90" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
              </button>
            ) : (
              <div className="flex aspect-[1/2] items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin" /> Drawing the preview…
              </div>
            )}
          </figure>
          <Button variant="outline" disabled={!shown} onClick={() => shown && setZoom({ src: shown.url, alt: `Daily Tasks report for ${format(day, "MMMM d, yyyy")}`, wide: true })}>
            <Maximize2 /> View full size
          </Button>
        </aside>
      </div>

      <Dialog open={!!zoom} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className={cn("max-h-[92vh] overflow-y-auto p-2 sm:p-3", zoom?.wide ? "sm:max-w-[min(94vw,1100px)]" : "sm:max-w-[min(92vw,640px)]")}>
          <DialogTitle className="sr-only">{zoom?.alt ?? "Preview"}</DialogTitle>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={zoom.src} alt={zoom.alt} className="w-full rounded-md bg-white" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function BrandLogo({ src, className }: { src: string; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-black/5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-full object-contain" draggable={false} />
    </span>
  )
}

function TileIcon({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]", className)}>{children}</span>
}

function StatTile({
  icon,
  label,
  value,
  total,
  note,
  empty,
  className,
}: {
  icon: ReactNode
  label: string
  value: number | null
  total?: number
  note: (left: number) => string
  empty?: string
  className?: string
}) {
  const complete = total !== undefined && value !== null && value >= total
  const left = total !== undefined && value !== null ? Math.max(0, total - value) : 0
  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-xs", className)}>
      <div className="flex items-center gap-2.5">
        {icon}
        <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight font-medium text-muted-foreground">{label}</p>
        {complete && <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Complete" />}
      </div>
      {empty ? (
        <p className="mt-3 text-sm font-medium text-muted-foreground">{empty}</p>
      ) : value === null ? (
        <span className="mt-3 h-8 w-16 animate-pulse rounded-md bg-muted" />
      ) : (
        <p className="mt-3 text-[26px] leading-none font-semibold tracking-tight tabular-nums">
          {value}
          {total !== undefined && <span className="text-base font-medium text-muted-foreground">/{total}</span>}
        </p>
      )}
      {total !== undefined && !empty && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", complete ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${value === null ? 0 : Math.min(100, (value / total) * 100)}%` }}
          />
        </div>
      )}
      {value !== null && !empty && <p className="mt-2 text-xs text-muted-foreground">{note(left)}</p>}
    </div>
  )
}

function SectionHeading({ icon, title, note }: { icon: ReactNode; title: string; note?: string }) {
  return (
    <div className="-mb-2 flex items-center gap-2 [&_svg]:size-[18px]">
      {icon}
      <h2 className="text-[13px] font-semibold tracking-[0.14em] uppercase">{title}</h2>
      {note && <span className="text-xs text-muted-foreground">· {note}</span>}
    </div>
  )
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      {children}
    </section>
  )
}

function EmptyCard({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed px-5 py-6 text-sm text-muted-foreground [&_svg]:size-5">
      {icon}
      {text}
    </div>
  )
}

const headlineOf = (post: ReportPost) => {
  const title = post.design.elements.find((e) => e.type === "text" && e.role === "title")
  const text = title?.type === "text" ? title.text.trim() : ""
  return text && text !== NEWS_HEADLINE_PLACEHOLDER ? text : post.project.title
}

/** One brand's day: its five posting times in a row, each post's picture or an empty slot. */
function BrandCard({
  brand,
  name,
  site,
  posts,
  loading,
  picture,
  onZoom,
}: {
  brand: NewsBrand
  name: string
  site: string
  posts: ReportPost[]
  loading: boolean
  picture: (projectId: string) => string | undefined
  onZoom: (zoom: Zoom) => void
}) {
  const times = newsTimesFor(brand)
  const made = times.filter((t) => posts.some((p) => p.time === t.time)).length
  const ui = BRAND_UI[brand]
  return (
    <Card label={`${name} article posting`}>
      <header className="flex flex-wrap items-center gap-3">
        <BrandLogo src={ui.logo} className="size-11 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold">
            {name} <span className="font-normal text-muted-foreground">Article Posting</span>
          </h3>
          <p className="text-xs text-muted-foreground">{site} · {times.map((t) => t.label).join(" · ")}</p>
        </div>
        {!loading && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
              made === times.length ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground",
            )}
          >
            {made} of {times.length} posted
          </span>
        )}
      </header>
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5" aria-label={`${name} posts by time`}>
        {times.map((slot) => {
          const post = posts.find((p) => p.time === slot.time)
          const src = post ? picture(post.project.id) : undefined
          const headline = post ? headlineOf(post) : ""
          return (
            <li key={slot.time} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold tabular-nums">{slot.label}</span>
                {post && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" /> Done
                  </span>
                )}
              </div>
              {loading ? (
                <span className={cn("animate-pulse rounded-lg bg-muted", ui.aspect)} />
              ) : post ? (
                <button
                  type="button"
                  onClick={() => src && onZoom({ src, alt: headline })}
                  className={cn(
                    "group relative flex items-center justify-center overflow-hidden rounded-lg bg-muted/70 ring-1 ring-border transition hover:ring-primary/60",
                    src ? "cursor-zoom-in" : "cursor-default",
                    ui.aspect,
                  )}
                  aria-label={`View the ${slot.label} ${name} post`}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="size-full object-contain transition duration-300 group-hover:scale-[1.03]" draggable={false} />
                  ) : (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  )}
                </button>
              ) : (
                <div className={cn("flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-muted-foreground", ui.aspect)}>
                  <ImageOff className="size-5 opacity-50" />
                  <span className="text-xs">Not posted</span>
                </div>
              )}
              {post && (
                <p className="line-clamp-2 text-xs leading-snug text-muted-foreground" title={headline}>
                  {headline}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** The carousel: its slides, the Homes.ph pages it went out on (and the ones left), and its caption. */
function CarouselCard({
  carousel,
  pageCount,
  picture,
  onZoom,
}: {
  carousel: ReportCarousel
  pageCount: number
  picture: (projectId: string, index?: number) => string | undefined
  onZoom: (zoom: Zoom) => void
}) {
  const { project, slides, postedPages, pagesLeft } = carousel
  const [showCaption, setShowCaption] = useState(false)
  const caption = project.caption.trim()
  const all = pagesLeft.length === 0
  return (
    <Card label={`Scheduled carousel posting: ${project.title}`}>
      <header className="flex flex-wrap items-start gap-3">
        <TileIcon className="size-11 rounded-2xl bg-primary/12 text-primary">
          <GalleryHorizontalEnd />
        </TileIcon>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Scheduled Carousel Posting · Homes.ph Pages</p>
          <h3 className="text-[15px] leading-snug font-semibold">{project.title}</h3>
          <p className="text-xs text-muted-foreground">
            {project.scheduled_at ? format(new Date(project.scheduled_at), "MMMM d · h:mm a") : "No time"} · {slides.length} slide{slides.length === 1 ? "" : "s"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
            all ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
          )}
        >
          Posted on {postedPages.length} of {pageCount} pages
        </span>
      </header>

      <ul className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-7" aria-label="Slides">
        {slides.map((_, i) => {
          const src = picture(project.id, i)
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => src && onZoom({ src, alt: i === 0 ? `Cover of ${project.title}` : `Slide ${i + 1}` })}
                className={cn("group relative block aspect-square w-full overflow-hidden rounded-lg bg-muted ring-1 ring-border transition hover:ring-primary/60", src && "cursor-zoom-in")}
                aria-label={i === 0 ? "View the cover" : `View slide ${i + 1}`}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" draggable={false} />
                ) : (
                  <span className="absolute inset-0 animate-pulse bg-muted" />
                )}
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 text-[10px] font-semibold text-white tabular-nums">{i === 0 ? "Cover" : i + 1}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Facebook pages</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Facebook pages">
          {postedPages.map((p) => (
            <li key={p.key} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary dark:text-blue-300">
              <Check className="size-3" /> {p.short_name}
            </li>
          ))}
          {pagesLeft.map((p) => (
            <li key={p.key} className="inline-flex items-center rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground">
              {p.short_name}
            </li>
          ))}
        </ul>
      </div>

      {caption && (
        <div className="mt-5 rounded-xl bg-muted/60 px-4 py-3">
          <p className={cn("text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/85", !showCaption && "line-clamp-3")}>{caption}</p>
          {caption.split("\n").length > 3 || caption.length > 220 ? (
            <button type="button" onClick={() => setShowCaption((v) => !v)} className="mt-1 text-xs font-medium text-primary hover:underline">
              {showCaption ? "Show less" : "Show the whole caption"}
            </button>
          ) : null}
        </div>
      )}
    </Card>
  )
}

/** What's still to do, by day: empty article slots and carousels not (fully) posted. */
function PendingList({ items }: { items: PendingItem[] }) {
  if (!items.length) return <EmptyCard icon={<CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />} text="Nothing pending — all caught up." />
  const days = [...new Map(items.map((item) => [format(item.day, "yyyy-MM-dd"), item.day])).values()]
  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <Card key={day.toISOString()} label={`Pending for ${format(day, "MMMM d")}`}>
          <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {dayName(day)} · {format(day, "MMMM d")}
          </p>
          <ul className="divide-y">
            {items
              .filter((item) => format(item.day, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))
              .map((item, i) => (
                <PendingRow key={i} item={item} />
              ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

function PendingRow({ item }: { item: PendingItem }) {
  const article = item.kind === "articles"
  const title = article
    ? item.brands.map((b) => NEWS_BRANDS.find((x) => x.id === b)?.name ?? b).join(" & ")
    : item.state === "not-made"
      ? "Carousel not made yet"
      : (item.title ?? "Carousel")
  const times = article ? item.times : [item.time]
  const state = article
    ? `${times.length} post${times.length === 1 ? "" : "s"} to make`
    : item.state === "not-made"
      ? "Not made yet"
      : item.state === "not-posted"
        ? "Not posted yet"
        : `${item.pagesLeft.length} page${item.pagesLeft.length === 1 ? "" : "s"} left`
  const shownPages = item.kind === "carousel" ? item.pagesLeft.slice(0, 8) : []
  const morePages = item.kind === "carousel" ? item.pagesLeft.length - shownPages.length : 0
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <TileIcon className="bg-amber-500/12 text-amber-600 dark:text-amber-400">{article ? <Newspaper /> : <GalleryHorizontalEnd />}</TileIcon>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{article ? "Article Posting" : "Scheduled Carousel Posting"}</p>
          <span className="ml-auto text-xs font-medium text-amber-700 dark:text-amber-300">{state}</span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Times">
          {times.map((t) => (
            <li key={t} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
              {newsTimeLabel(t)}
            </li>
          ))}
          {shownPages.map((p) => (
            <li key={p} className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
              {p}
            </li>
          ))}
          {morePages > 0 && <li className="px-1 py-0.5 text-xs text-muted-foreground">+{morePages} more</li>}
        </ul>
      </div>
    </li>
  )
}
