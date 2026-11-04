"use client"

import { PROJECT_STATUSES, STATUS_LABELS, type ProjectStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { STATUS_STYLES } from "./status-badge"

/** Toggle chips; an empty selection means "all statuses". */
export function StatusFilter({ value, onChange }: { value: ProjectStatus[]; onChange: (v: ProjectStatus[]) => void }) {
  const toggle = (s: ProjectStatus) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s])
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
      {PROJECT_STATUSES.map((s) => {
        const active = value.includes(s)
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(s)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
              active ? "border-primary/40 bg-accent text-primary" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("size-1.5 rounded-full", STATUS_STYLES[s].dot)} aria-hidden="true" />
            {STATUS_LABELS[s]}
          </button>
        )
      })}
      {value.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="px-1 text-xs text-muted-foreground hover:text-foreground">
          Clear
        </button>
      )}
    </div>
  )
}
