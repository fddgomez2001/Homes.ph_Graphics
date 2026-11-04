"use client"

import { useEffect, useState } from "react"
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns"
import { Database, Loader2, RotateCcw, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { ProjectThumb } from "@/components/projects/project-thumb"
import { useProjectActions } from "@/components/projects/use-project-actions"
import { useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { projectFeatures, purgeOldTrash, TRASH_DAYS } from "@/lib/data/projects"

/** Deleted carousels and news articles: restore them, or delete them forever. Kept for 30 days. */
export function TrashBrowser() {
  const { projects, loading, error, apply, reload } = useProjects({ trash: "only", kind: "all", orderBy: "deleted_at", ascending: false })
  const { actions, dialogs } = useProjectActions(apply)
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    projectFeatures().then(
      (f) => !cancelled && setSupported(f.trash),
      () => !cancelled && setSupported(null),
    )
    // Items older than 30 days are removed for good when the Trash is opened.
    purgeOldTrash().then((n) => n && reload(), () => {})
    return () => {
      cancelled = true
    }
  }, [reload])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Trash" description={`Deleted carousels stay here for ${TRASH_DAYS} days, then they're deleted for good`} />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 lg:px-6">
        {supported === false && (
          <div className="mb-4 flex gap-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            <Database className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Turn on the Trash</p>
              <p className="mt-1">
                Run <code className="rounded bg-card/70 px-1">supabase/migrations/20261030000000_trash_and_news.sql</code> in the Supabase SQL
                Editor, then reload. Until then, deleting a carousel removes it for good.
              </p>
            </div>
          </div>
        )}
        {error && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading the Trash…
          </p>
        ) : projects.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center text-muted-foreground">
            <Trash2 className="size-8" />
            <p className="font-medium text-foreground">The Trash is empty</p>
            <p className="text-sm">Deleted carousels and news articles show up here.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border bg-card" aria-label="Deleted carousels">
            {projects.map((p) => {
              const deletedAt = p.deleted_at ? new Date(p.deleted_at) : null
              const daysLeft = deletedAt ? Math.max(0, TRASH_DAYS - differenceInCalendarDays(new Date(), deletedAt)) : TRASH_DAYS
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                  <ProjectThumb src={p.thumbnail} title={p.title} className="size-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.kind === "news" ? "News article" : `Carousel · ${p.slide_count} slide${p.slide_count === 1 ? "" : "s"}`}
                      {deletedAt && ` · deleted ${formatDistanceToNow(deletedAt, { addSuffix: true })}`} · deleted forever in {daysLeft} day
                      {daysLeft === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void actions.restore(p)}>
                      <RotateCcw /> Restore
                    </Button>
                    <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={() => void actions.deleteForever(p)}>
                      <Trash2 /> Delete forever
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {dialogs}
    </div>
  )
}
