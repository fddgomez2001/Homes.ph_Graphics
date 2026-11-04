"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { CheckCircle2, CircleDashed, Database, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useCachedQuery } from "@/lib/cache"
import { markNotPosted, markPosted, projectFeatures } from "@/lib/data/projects"
import { getMyProfile, listPostChecks, listPostPages, postingState, setMyName, setPostCheck, type PostCheck } from "@/lib/data/posting"
import { LOGO_BLUE_SRC } from "@/lib/design/constants"
import type { ProjectRow } from "@/lib/types"
import { cn, errorMessage } from "@/lib/utils"

/** How often an open checklist picks up ticks made by teammates. */
const REFRESH_MS = 15_000

/** The Facebook page "avatar": the Homes.ph logo on white. */
export function PageLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/10", className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_BLUE_SRC} alt="" className="size-[62%] object-contain" draggable={false} />
    </span>
  )
}

/** "◐ 6/17" while a carousel is part-way posted. */
export function PostingChip({ project, total = 17, className }: { project: Pick<ProjectRow, "status" | "posted_count">; total?: number; className?: string }) {
  if (postingState(project) !== "partial") return null
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-amber-800 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
        className,
      )}
      title="Partially published"
    >
      <CircleDashed className="size-3" aria-hidden="true" />
      {project.posted_count}/{total} pages
    </span>
  )
}

/**
 * The 17 Facebook pages a carousel goes to. Tick a page after posting on it: the
 * signed-in person and the time are saved, teammates see it, and the carousel
 * becomes Published once every page is ticked.
 */
export function PostingChecklist({ project, className }: { project: ProjectRow; className?: string }) {
  const features = useCachedQuery("posting:features", () => projectFeatures(), { freshFor: 60_000 })
  const pages = useCachedQuery(features.data?.posting ? "posting:pages" : null, listPostPages, { freshFor: 24 * 3600_000, errorMessage })
  // Shown from the device cache at once, then always checked again: teammates tick too.
  const checks = useCachedQuery(features.data?.posting ? `posting:checks:${project.id}` : null, () => listPostChecks(project.id), {
    freshFor: 0,
    errorMessage,
  })
  const me = useCachedQuery("profile:me", getMyProfile, { freshFor: 60_000 })
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const { reload } = checks

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reload])

  const byPage = useMemo(() => new Map((checks.data ?? []).map((c) => [c.page_key, c])), [checks.data])
  const list = pages.data ?? []
  const isChecked = (key: string) => pending[key] ?? byPage.has(key)
  const done = list.filter((p) => isChecked(p.key)).length
  const total = list.length
  const posters = useMemo(() => {
    const names: string[] = []
    for (const c of checks.data ?? []) if (c.checked_by_name && !names.includes(c.checked_by_name)) names.push(c.checked_by_name)
    return names
  }, [checks.data])

  // A tick shows right away and stays until the saved list agrees with it.
  const settled = Object.keys(pending).filter((key) => byPage.has(key) === pending[key])
  if (settled.length) setPending((p) => Object.fromEntries(Object.entries(p).filter(([key]) => !settled.includes(key))))

  const toggle = async (key: string, checked: boolean) => {
    setPending((p) => ({ ...p, [key]: checked }))
    try {
      await setPostCheck(project.id, key, checked)
    } catch (e) {
      toast.error("Couldn't save the tick", { description: errorMessage(e) })
      setPending((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)))
    }
  }

  if (features.data && !features.data.posting) {
    // Before the migration: the 17-page checklist is off, a single "posted" switch still works.
    const posted = project.status === "published"
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Database className="mt-0.5 size-4 shrink-0" />
          <p>
            Turn on the 17-page checklist: run <code className="rounded bg-card/70 px-1">supabase/migrations/20261031000000_team_posting.sql</code> in the Supabase SQL
            Editor, then reload.
          </p>
        </div>
        <Button
          variant={posted ? "outline" : "default"}
          className={posted ? "" : "bg-emerald-600 text-white hover:bg-emerald-700"}
          onClick={() =>
            (posted ? markNotPosted(project) : markPosted(project.id, new Date())).then(
              () => toast.success(posted ? "Marked as not posted" : "Marked as posted"),
              (e) => toast.error(errorMessage(e)),
            )
          }
        >
          <CheckCircle2 /> {posted ? "Mark as not posted" : "Mark as posted now"}
        </Button>
      </div>
    )
  }

  const state = total > 0 && done >= total ? "posted" : done > 0 ? "partial" : project.status === "published" ? "posted" : "none"

  return (
    <section className={cn("flex flex-col gap-3", className)} aria-label="Posting checklist">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Facebook pages</h3>
        <span className="text-sm font-semibold tabular-nums" aria-label={`${done} of ${total} pages posted`}>
          {done}/{total || 17}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", state === "posted" ? "bg-emerald-500" : "bg-amber-500")}
          style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
        />
      </div>

      {me.data && !me.data.name && <NamePrompt onSaved={() => me.reload()} />}

      {pages.error || checks.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{pages.error ?? checks.error}</p>
      ) : !pages.data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading pages…
        </p>
      ) : (
        <ul className="flex flex-col">
          {list.map((page) => {
            const check: PostCheck | undefined = byPage.get(page.key)
            const checked = isChecked(page.key)
            return (
              <li key={page.key}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted",
                    checked && "bg-emerald-50/60 dark:bg-emerald-500/5",
                  )}
                  title={page.name}
                >
                  <PageLogo />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{page.short_name}</span>
                    {checked && check && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {check.checked_by_name || "Someone"} · {format(new Date(check.checked_at), "MMM d, h:mm a")}
                      </span>
                    )}
                  </span>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => void toggle(page.key, value === true)}
                    disabled={page.key in pending}
                    aria-label={`Posted on ${page.name}`}
                    className="size-5 data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white dark:data-checked:bg-emerald-600"
                  />
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {posters.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Posted: <span className="font-medium text-foreground">{posters.join(" | ")}</span>
        </p>
      )}

      <div
        role="status"
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold",
          state === "posted" && "animate-in bg-emerald-600 text-white duration-300 zoom-in-95",
          state === "partial" && "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
          state === "none" && "bg-muted text-muted-foreground",
        )}
      >
        {state === "posted" ? (
          <>
            <CheckCircle2 className="size-4" /> Published{done >= total && total ? ` · all ${total} pages` : ""}
          </>
        ) : state === "partial" ? (
          <>
            <CircleDashed className="size-4" /> Partially published · {done}/{total}
          </>
        ) : (
          "Not posted yet"
        )}
      </div>
    </section>
  )
}

/** Asks once for the name teammates see in "Posted by" and "Made by". */
function NamePrompt({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setBusy(true)
        try {
          await setMyName(name)
          toast.success("Name saved", { description: "Your ticks show as posted by you." })
          onSaved()
        } catch (err) {
          toast.error(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label htmlFor="my-name" className="text-xs font-medium text-blue-900 dark:text-blue-200">
        Your name, so the team sees who posted
      </label>
      <div className="flex gap-2">
        <Input id="my-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frank Gomez" className="h-8 bg-card" />
        <Button type="submit" size="sm" className="h-8" disabled={busy || !name.trim()}>
          Save
        </Button>
      </div>
    </form>
  )
}
