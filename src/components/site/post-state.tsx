"use client"

import { startOfToday } from "date-fns"
import { CheckCircle2, CircleDashed } from "lucide-react"
import { formatPosted } from "@/lib/dates"
import type { ProjectRow } from "@/lib/types"
import { cn } from "@/lib/utils"

export type PostState = "posted" | "partial" | "ready" | "late" | "draft"

/** Where a carousel stands for the people posting it. */
export function postState(project: Pick<ProjectRow, "status" | "scheduled_at" | "posted_count">): PostState {
  if (project.status === "published") return "posted"
  if ((project.posted_count ?? 0) > 0) return "partial"
  if (project.status === "draft") return "draft"
  return project.scheduled_at && new Date(project.scheduled_at) < startOfToday() ? "late" : "ready"
}

const PILL: Record<PostState, string> = {
  posted: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30",
  partial: "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30",
  ready: "bg-blue-50 dark:bg-blue-500/10 text-primary ring-blue-200 dark:ring-blue-500/30",
  late: "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30",
  draft: "bg-muted text-slate-600 dark:text-slate-300 ring-border",
}

export function PostStatePill({
  project,
  className,
}: {
  project: Pick<ProjectRow, "status" | "scheduled_at" | "posted_at" | "posted_count">
  className?: string
}) {
  const state = postState(project)
  const label =
    state === "posted"
      ? project.posted_at
        ? `Posted · ${formatPosted(project.posted_at)}`
        : "Posted"
      : state === "partial"
        ? `Partially published · ${project.posted_count}/17`
        : state === "ready"
          ? "Ready to post"
          : state === "late"
            ? "Not posted yet"
            : "Draft"
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", PILL[state], className)}>
      {state === "posted" && <CheckCircle2 className="size-3" aria-hidden="true" />}
      {state === "partial" && <CircleDashed className="size-3" aria-hidden="true" />}
      {label}
    </span>
  )
}
