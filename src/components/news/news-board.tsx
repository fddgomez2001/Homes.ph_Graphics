"use client"

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react"
import { useRouter } from "next/navigation"
import { addDays, format, startOfDay } from "date-fns"
import { ClipboardPaste, Download, ImagePlus, Loader2, PencilLine, Shapes } from "lucide-react"
import { toast } from "sonner"
import { useProjectSlides, useSlideRenders, type BoardSlide } from "@/components/board/slide-renders"
import { useExport } from "@/components/export/export-provider"
import { ProjectActionsMenu } from "@/components/projects/project-actions-menu"
import type { ProjectActions } from "@/components/projects/use-project-actions"
import { invalidateProjects, useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createNewsArticle, newsHeadline, storeNewsPhoto, updateNewsArticle, type NewsPhoto } from "@/lib/data/news"
import { combineDateTime } from "@/lib/dates"
import {
  getNewsTemplate,
  articleTemplatesFor,
  defaultArticleTemplate,
  isPosterTemplate,
  newsBrandOf,
  newsFileName,
  newsPostLabel,
  type DailyBrand,
  type NewsTemplate,
  type NewsTime,
} from "@/lib/design/news-templates"
import { laneOfDesign, slotKeyOf, type NewsLane } from "@/lib/news-lanes"
import type { ProjectRow } from "@/lib/types"
import { NEWS_HEADLINE_PLACEHOLDER } from "@/lib/design/templates"
import { cn, errorMessage } from "@/lib/utils"

const ymd = (d: Date) => format(d, "yyyy-MM-dd")

/** Empty-slot previews of each template, drawn once per session. */
const templatePreviews = new Map<string, Promise<string>>()

function useTemplatePreview(template: NewsTemplate) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!templatePreviews.has(template.id)) {
      templatePreviews.set(
        template.id,
        import("@/lib/design/render").then(({ renderThumbnail }) => renderThumbnail(template.build({ headline: "Your news headline goes here" }), 480, 0.85)),
      )
    }
    templatePreviews.get(template.id)!.then((u) => !cancelled && setUrl(u), () => {})
    return () => {
      cancelled = true
    }
  }, [template])
  return url
}

/**
 * News Article, daily posts: for one day, the chosen page's row (PicklePlay PH, FHI Global Property, a Homes.ph
 * page…) with its five posting times. Each slot is a template ready to paste a photo into and type the headline;
 * it becomes a news article scheduled at that time as soon as something is added.
 */
export function NewsBoard({ day, lane, actions }: { day: Date; lane: NewsLane; actions: ProjectActions }) {
  const from = startOfDay(day)
  // Cached per query (the key is the query itself), like every other list.
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

  // Each article goes in its page's row at its time; this page's others (and posts of no page) are listed below.
  const { slots, others } = useMemo(() => {
    const slots = new Map<string, ProjectRow>()
    const others: ProjectRow[] = []
    for (const p of projects) {
      const design = slides.get(p.id)?.[0]?.design
      // Posters belong to the Poster Maker, not to News Article.
      if (!design || isPosterTemplate(design.templateId)) continue
      const key = slotKeyOf(design, p.scheduled_at)
      if (key && !slots.has(key)) slots.set(key, p)
      else {
        const page = laneOfDesign(design)
        if (!page || page === lane.id) others.push(p)
      }
    }
    return { slots, others }
  }, [projects, slides, lane.id])
  const waiting = loading || projects.some((p) => !slides.get(p.id))
  const brand = lane.brand

  if (!brand)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-14 text-center">
        <Shapes className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">No News Article template for {lane.name} yet</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Its articles are still posted from the dash (the Homes.ph Publisher extension uses the dash&apos;s own picture). Send the Figma design to add its template here.
          </p>
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-10">
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {[lane].map((row) => (
        <section key={row.id} aria-label={`${row.name} posts`}>
          <h2 className="mb-4 flex items-baseline gap-2 border-b pb-2">
            <span className="text-base font-semibold">{row.name}</span>
            <span className="text-xs text-muted-foreground">
              {row.site} · {row.times.length} posts a day
            </span>
          </h2>
          <div className="overflow-x-auto pb-2">
            <ul className="grid min-w-[1100px] grid-cols-5 items-start gap-5" aria-label={`${row.name} posting times`}>
              {row.times.map((slot) => {
                const project = slots.get(`${row.id}@${slot.time}`)
                const slide = project ? slides.get(project.id)?.[0] : undefined
                return (
                  <li key={`${row.id}-${ymd(from)}-${slot.time}`}>
                    <NewsSlot
                      brand={brand}
                      page={row.page}
                      brandName={row.name}
                      slot={slot}
                      day={from}
                      project={project}
                      slide={slide}
                      render={slide ? renders.get(slide.key) : undefined}
                      waiting={waiting}
                      actions={actions}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      ))}
      {others.length > 0 && (
        <section aria-label="Other news articles this day">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Also on this day</h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((p) => {
              const design = slides.get(p.id)?.[0]?.design
              const text = (
                <>
                  {p.scheduled_at ? format(new Date(p.scheduled_at), "h:mm a") : "No time"} · {design ? `${newsPostLabel(newsBrandOf(design), design.page)} · ` : ""}
                  {p.title}
                </>
              )
              return (
                <li key={p.id} className="rounded-md border bg-card px-3 py-1.5 text-sm">
                  {text}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function NewsSlot({
  brand,
  page,
  brandName,
  slot,
  day,
  project,
  slide,
  render,
  waiting,
  actions,
}: {
  brand: DailyBrand | "homes"
  /** The Homes.ph page's name, kept on its posts ("homes" brand). */
  page: string | null
  brandName: string
  slot: NewsTime
  day: Date
  project?: ProjectRow
  slide?: BoardSlide
  render?: string
  waiting: boolean
  actions: ProjectActions
}) {
  const router = useRouter()
  const { runExport, busy: exporting } = useExport()
  const templates = articleTemplatesFor(brand)
  // FHI alternates Portrait / Wide day by day; the other brands start with their first template.
  const [emptyTemplateId, setEmptyTemplateId] = useState(() => defaultArticleTemplate(brand, day).id)
  const template = getNewsTemplate(slide?.design.templateId) ?? getNewsTemplate(emptyTemplateId)!
  const preview = useTemplatePreview(template)
  // FHI Template 1 (portrait) shows the headline in capitals; Template 2 as typed.
  const capitals = (slide?.design ?? template.build()).elements.some((e) => e.type === "text" && e.role === "title" && e.textCase === "upper")
  // The template's placeholder isn't a headline yet: the box stays empty until one is typed.
  const written = slide ? newsHeadline(slide.design) : ""
  const saved = written === NEWS_HEADLINE_PLACEHOLDER ? "" : written
  const [headline, setHeadline] = useState(saved)
  const [lastSaved, setLastSaved] = useState(saved)
  const [busy, setBusy] = useState<"photo" | "save" | "template" | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const label = `${slot.label} ${brandName}`
  // Posters open in the Poster Maker (headline highlight, photo credit); other articles in the editor.
  const editHref = (id: string) => `/editor/${id}`

  // A headline saved elsewhere (editor, another window) shows here unless you're typing.
  if (saved !== lastSaved) {
    setLastSaved(saved)
    if (busy !== "save") setHeadline(saved)
  }

  // The post created from this slot, until the list shows it: later changes go to it (never a second post).
  const created = useRef<Promise<string> | null>(null)

  // One save at a time: each starts from the latest saved version, so a headline typed and a
  // photo pasted right after never clash ("changed somewhere else") or undo each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const apply = (change: { headline?: string; photo?: NewsPhoto; templateId?: string }) => {
    const next = queue.current.catch(() => {}).then(() => applyNow(change))
    queue.current = next
    return next
  }

  const applyNow = async (change: { headline?: string; photo?: NewsPhoto; templateId?: string }) => {
    const id = project?.id ?? (created.current ? await created.current : null)
    if (id) await updateNewsArticle(id, change)
    else {
      created.current = createNewsArticle({
        templateId: change.templateId ?? template.id,
        headline: change.headline ?? headline,
        scheduledAt: combineDateTime(ymd(day), slot.time),
        photo: change.photo,
        page,
      })
      await created.current.catch((e) => {
        created.current = null
        throw e
      })
    }
    invalidateProjects()
  }

  const run = async (kind: "photo" | "save" | "template", task: () => Promise<void>, failure: string) => {
    setBusy(kind)
    try {
      await task()
    } catch (e) {
      toast.error(failure, { description: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  const addPhoto = (file: File) =>
    run(
      "photo",
      async () => {
        const photo = await storeNewsPhoto(file)
        await apply({ photo })
      },
      "Couldn't add the photo",
    )

  const saveHeadline = (text: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (text.trim() === saved.trim() || (!project && !text.trim())) return
    void run("save", () => apply({ headline: text.trim() }), "Couldn't save the headline")
  }

  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"))
    if (!file) return
    e.preventDefault()
    void addPhoto(file)
  }

  const pasteFromClipboard = async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"))
        if (type) {
          const blob = await item.getType(type)
          return void addPhoto(new File([blob], `Pasted ${slot.label}.${type.split("/")[1] ?? "png"}`, { type }))
        }
      }
      toast.info("No picture on the clipboard", { description: "Copy a picture, then click Paste (or click the frame and press Ctrl+V)." })
    } catch {
      toast.info("Click the frame and press Ctrl+V to paste the picture.")
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"))
    if (file) void addPhoto(file)
  }

  const hasPhoto = !!slide?.design.elements.some((el) => el.type === "image" && el.role === "background" && el.src)
  const shown = render ?? (project ? undefined : preview)

  return (
    <div className="flex flex-col gap-3">
      <div className="text-3xl leading-none font-bold tracking-[0.12em] text-[#2F3A80] dark:text-[#7F8BE0]" aria-hidden="true">
        {slot.label}
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}: ${hasPhoto ? "photo" : "no photo yet"}. Click, then paste a picture (Ctrl+V), or drop one here.`}
        onPaste={onPaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onDoubleClick={() => project && router.push(editHref(project.id))}
        className="group relative w-full overflow-hidden bg-muted shadow-sm ring-1 ring-black/10 outline-none focus-visible:ring-3 focus-visible:ring-primary"
        style={{ aspectRatio: `${template.width} / ${template.height}` }}
      >
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className={cn("size-full", !project && "opacity-45")} draggable={false} />
        )}
        {(busy === "photo" || busy === "template" || (waiting && !project && !shown)) && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
            <Loader2 className="size-6 animate-spin" />
          </span>
        )}
        {!hasPhoto && busy !== "photo" && (
          <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-black/60 px-2 py-1.5 text-center text-[11px] font-medium text-white backdrop-blur">
            Click, then Ctrl+V to paste a photo — or drop one here
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => void pasteFromClipboard()} disabled={busy !== null}>
          <ClipboardPaste /> Paste
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          <ImagePlus /> Photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-label={`Choose a photo for ${label}`}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void addPhoto(file)
          }}
        />
      </div>
      <Textarea
        value={headline}
        onChange={(e) => {
          const text = e.target.value
          setHeadline(text)
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => saveHeadline(text), 1200)
        }}
        onBlur={() => saveHeadline(headline)}
        rows={3}
        placeholder="Type the headline"
        aria-label={`Headline for ${label}`}
        className={cn("min-h-20 resize-none bg-card text-sm", capitals && "uppercase placeholder:normal-case")}
      />
      {templates.length > 1 && (
        <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label={`Template for ${label}`}>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === template.id}
              disabled={busy !== null}
              onClick={() => {
                if (t.id === template.id) return
                if (project) void run("template", () => apply({ templateId: t.id }), "Couldn't change the template")
                else setEmptyTemplateId(t.id)
              }}
              className={cn(
                "flex flex-1 flex-col items-center rounded px-2 py-1 text-[11px] leading-tight font-medium transition-colors",
                t.id === template.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              title={`${t.name} (${t.size})`}
            >
              {/* "New Template" with "1126x1408" under it. */}
              <span>{t.name.replace(/^Template \d · /, "")}</span>
              <span className="text-[10px] font-normal tabular-nums opacity-80">
                {t.width}x{t.height}
              </span>
            </button>
          ))}
        </div>
      )}
      {project && slide && (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => router.push(editHref(project.id))}>
            <PencilLine /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={exporting}
            aria-label={`Download ${label} as PNG`}
            onClick={() =>
              void runExport({
                meta: project,
                slides: [{ type: "cover", design: slide.design }],
                kind: "single",
                format: "png",
                checks: false,
                fileName: newsFileName(day, slot, brandName),
              })
            }
          >
            <Download /> PNG
          </Button>
          <ProjectActionsMenu project={project} actions={actions} />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {template.size} · {busy === "save" ? "Saving…" : project ? (hasPhoto ? "Ready" : "Add the photo") : "Empty"}
      </p>
    </div>
  )
}
