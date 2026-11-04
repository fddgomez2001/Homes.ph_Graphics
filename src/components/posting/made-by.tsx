import { madeTiming, madeTimingLabel } from "@/lib/dates"
import type { ProjectRow } from "@/lib/types"
import { cn } from "@/lib/utils"

/** "Made early · 3 days ahead · by Frank Gomez" */
export function MadeBy({ project, className }: { project: Pick<ProjectRow, "created_at" | "scheduled_at" | "created_by_name">; className?: string }) {
  const timing = madeTiming(project.created_at, project.scheduled_at)
  if (!timing && !project.created_by_name) return null
  return (
    <span className={cn("text-[11px] text-muted-foreground", className)}>
      {timing && (
        <span
          className={cn(
            "font-medium",
            timing.kind === "early" && "text-emerald-700 dark:text-emerald-300",
            timing.kind === "late" && "text-amber-700 dark:text-amber-300",
          )}
        >
          {madeTimingLabel(timing)}
        </span>
      )}
      {timing && project.created_by_name && " · "}
      {project.created_by_name && <>by {project.created_by_name}</>}
    </span>
  )
}
