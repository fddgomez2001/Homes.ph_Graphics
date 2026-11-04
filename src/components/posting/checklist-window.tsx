"use client"

import { useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, startOfDay, subDays } from "date-fns"
import { Loader2 } from "lucide-react"
import { useProjectSlides, useSlideRenders } from "@/components/board/slide-renders"
import { useProjects } from "@/components/projects/use-projects"
import { ThemeToggle } from "@/components/theme/theme"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { postingState } from "@/lib/data/posting"
import type { ProjectRow } from "@/lib/types"
import { MadeBy } from "./made-by"
import { PostingChecklist, PostingChip } from "./posting-checklist"

const MARK = { posted: "✓", partial: "◐", none: "○" } as const

/** Which carousel to show when none was chosen: the first one not fully posted from today on. */
function pickDefault(projects: ProjectRow[]) {
  const today = startOfDay(new Date()).getTime()
  const upcoming = projects.filter((p) => p.scheduled_at && new Date(p.scheduled_at).getTime() >= today)
  return upcoming.find((p) => p.status !== "published") ?? upcoming[0] ?? projects.at(-1)
}

/**
 * The floating posting checklist: one carousel's Facebook pages, small enough to
 * sit on top of the browser while posting. The picker shows which carousels are
 * posted (✓), part-way (◐) or not yet (○).
 */
export function ChecklistWindow() {
  const params = useSearchParams()
  const router = useRouter()
  const { projects, loading, error } = useProjects({ orderBy: "scheduled_at", ascending: true, limit: 500 })
  const requested = params.get("id")
  const project = projects.find((p) => p.id === requested) ?? (requested ? undefined : pickDefault(projects))
  const slides = useProjectSlides(useMemo(() => (project ? [project] : []), [project]))
  const renders = useSlideRenders(slides)
  const coverSlide = project ? slides.get(project.id)?.[0] : undefined
  const cover = (coverSlide && renders.get(coverSlide.key)) || project?.thumbnail

  // The last week and everything ahead, plus the open one.
  const choices = useMemo(() => {
    const from = subDays(startOfDay(new Date()), 7).getTime()
    return projects.filter((p) => p.id === project?.id || (p.scheduled_at && new Date(p.scheduled_at).getTime() >= from))
  }, [projects, project?.id])

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-background p-4">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-sm font-semibold tracking-tight">Posting checklist</h1>
        <ThemeToggle className="size-8" />
      </header>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading carousels…
        </p>
      ) : !project ? (
        <p className="text-sm text-muted-foreground">{requested ? "This carousel isn't available." : "No carousels yet."}</p>
      ) : (
        <>
          <Select value={project.id} onValueChange={(id) => router.replace(`/checklist?id=${id}`)}>
            <SelectTrigger aria-label="Carousel" className="h-auto w-full py-2 text-left">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-96">
              {choices.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="w-4 text-center" aria-hidden="true">
                    {MARK[postingState(p)]}
                  </span>
                  <span className="truncate">
                    {p.scheduled_at ? format(new Date(p.scheduled_at), "MMM d") : "No date"} · {p.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-3">
            <span className="block size-20 shrink-0 overflow-hidden bg-[#0B1F8E] shadow-sm ring-1 ring-black/5">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={`Cover of ${project.title}`} className="size-full" draggable={false} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm leading-snug font-semibold">{project.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {project.scheduled_at ? format(new Date(project.scheduled_at), "EEE, MMMM d · h:mm a") : "No date"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <PostingChip project={project} />
                <MadeBy project={project} />
              </div>
            </div>
          </div>

          <PostingChecklist key={project.id} project={project} />
          <p className="text-center text-[11px] text-muted-foreground">Stays on top while you post on Facebook.</p>
        </>
      )}
    </main>
  )
}
