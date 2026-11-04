"use client"

import { useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Compact month calendar: click a day to pick it. */
export function MiniCalendar({ value, onChange, className }: { value: Date; onChange: (day: Date) => void; className?: string }) {
  const [month, setMonth] = useState(() => startOfMonth(value))
  const days = eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) })

  return (
    <div className={cn("w-full max-w-[19rem] select-none", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="flex size-8 items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-muted"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-foreground" aria-live="polite">
          {format(month, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="flex size-8 items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-muted"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="py-1">
            {format(d, "EEEEEE")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label="Choose a publication date">
        {days.map((day) => {
          const selected = isSameDay(day, value)
          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={format(day, "EEEE, MMMM d, yyyy")}
              onClick={() => {
                onChange(day)
                if (!isSameMonth(day, month)) setMonth(startOfMonth(day))
              }}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                isSameMonth(day, month) ? "text-slate-800 dark:text-slate-100 hover:bg-muted" : "text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                isToday(day) && !selected && "font-semibold text-primary ring-1 ring-primary/40 ring-inset",
                selected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
    </div>
  )
}
