"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Check, Copy, Download, Loader2, PanelTopOpen, PencilLine } from "lucide-react"
import { toast } from "sonner"
import type { BoardSlide } from "@/components/board/slide-renders"
import { MadeBy } from "@/components/posting/made-by"
import { openChecklistWindow } from "@/components/posting/open-checklist"
import { PostingChecklist, PostingChip } from "@/components/posting/posting-checklist"
import { StatusBadge } from "@/components/projects/status-badge"
import type { ProjectActions } from "@/components/projects/use-project-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ProjectRow } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * One carousel at a glance, laid out like the posting sheet: the cover large on
 * the left, the cards three across beside it, the caption underneath, and the
 * Facebook pages checklist on the side.
 */
export function CarouselPreview({
  project,
  slides,
  renders,
  actions,
  onClose,
}: {
  project: ProjectRow | null
  slides?: BoardSlide[]
  renders: Map<string, string>
  actions: ProjectActions
  onClose: () => void
}) {
  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-[min(90rem,calc(100vw-2rem))]">
        {project && <PreviewBody project={project} slides={slides ?? []} renders={renders} actions={actions} />}
      </DialogContent>
    </Dialog>
  )
}

function PreviewBody({ project, slides, renders, actions }: { project: ProjectRow; slides: BoardSlide[]; renders: Map<string, string>; actions: ProjectActions }) {
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)
  const count = slides.length || project.slide_count

  const copyCaption = () =>
    navigator.clipboard.writeText(project.caption).then(
      () => {
        setCopied(true)
        toast.success("Caption copied")
        setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error("Couldn't access the clipboard"),
    )

  return (
    <>
      <DialogHeader className="gap-2 border-b px-6 pt-5 pb-4 text-left">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 pr-8">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-xl leading-tight">{project.title}</DialogTitle>
            <DialogDescription className="mt-1">
              {project.scheduled_at ? format(new Date(project.scheduled_at), "EEEE, MMMM d, yyyy · h:mm a") : "No publication date"} · {count} slide
              {count === 1 ? "" : "s"}
            </DialogDescription>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={project.status} />
              <PostingChip project={project} />
              <MadeBy project={project} className="text-xs" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/editor/${project.id}`)}>
              <PencilLine /> Edit
            </Button>
            <Button
              variant="outline"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true)
                try {
                  await actions.downloadPngs(project, slides.map((s) => ({ type: s.row.slide_type, design: s.design })))
                } finally {
                  setDownloading(false)
                }
              }}
            >
              {downloading ? <Loader2 className="animate-spin" /> : <Download />} Download PNGs
            </Button>
            <Button onClick={() => openChecklistWindow(project.id)}>
              <PanelTopOpen /> Floating checklist
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5" aria-label="Slides">
            {(slides.length ? slides : [null]).map((slide, i) => {
              const src = slide ? renders.get(slide.key) : project.thumbnail
              return (
                <li key={slide?.key ?? "cover"} className={cn(i === 0 && "col-span-3 sm:col-span-2 sm:row-span-2")}>
                  <button
                    type="button"
                    onClick={() => router.push(`/editor/${project.id}${slide ? `?slide=${slide.row.id}` : ""}`)}
                    className="group relative block aspect-square w-full overflow-hidden bg-[#0B1F8E] shadow-sm ring-1 ring-black/5 transition hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    aria-label={i === 0 ? `Edit the cover of ${project.title}` : `Edit slide ${i + 1}`}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={i === 0 ? `Cover of ${project.title}` : `Slide ${i + 1}`} className="size-full" draggable={false} />
                    ) : (
                      <span className="block size-full animate-pulse bg-gradient-to-b from-[#1A3ED6] to-[#0B1F8E]" />
                    )}
                    <span className="absolute top-1.5 left-1.5 rounded bg-black/55 px-1.5 text-[10px] font-semibold text-white tabular-nums">{i + 1}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <section aria-label="Caption" className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Caption</h3>
              <span className="h-px flex-1 bg-border" />
              {project.caption.trim() && (
                <Button variant="ghost" size="sm" onClick={copyCaption}>
                  {copied ? <Check className="text-emerald-600" /> : <Copy />} {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </div>
            {project.caption.trim() ? (
              <p className="text-[17px] leading-relaxed font-medium whitespace-pre-wrap">{project.caption}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No caption yet.</p>
            )}
          </section>
        </div>

        <aside className="lg:border-l lg:pl-6">
          <PostingChecklist project={project} />
        </aside>
      </div>
    </>
  )
}
