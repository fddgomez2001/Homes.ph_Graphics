import { cn } from "@/lib/utils"
import { STATUS_LABELS, type ProjectStatus } from "@/lib/types"

export const STATUS_STYLES: Record<ProjectStatus, { badge: string; dot: string }> = {
  draft: { badge: "bg-muted text-slate-700 dark:text-slate-200 ring-border", dot: "bg-slate-400" },
  scheduled: { badge: "bg-blue-50 dark:bg-blue-500/10 text-primary ring-blue-200 dark:ring-blue-500/30", dot: "bg-primary" },
  published: { badge: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30", dot: "bg-emerald-500" },
}

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        STATUS_STYLES[status].badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_STYLES[status].dot)} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}

export function StatusDot({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_STYLES[status].dot, className)}
      title={STATUS_LABELS[status]}
      aria-label={STATUS_LABELS[status]}
    />
  )
}
