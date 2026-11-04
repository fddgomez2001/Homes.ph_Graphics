"use client"

import { AlertCircle, CheckCircle2 } from "lucide-react"
import { DESCRIPTION_LINES, descriptionStatus } from "@/lib/design/content-rules"
import type { MeasureText } from "@/lib/design/layout"
import type { TextElement } from "@/lib/design/types"
import { cn } from "@/lib/utils"

/** Live "2–3 lines" guidance under a card description field. */
export function DescriptionHint({ el, measure, className }: { el: TextElement; measure: MeasureText; className?: string }) {
  const { lines, ok } = descriptionStatus(el, measure)
  const message = ok
    ? `${lines} lines — good (${DESCRIPTION_LINES.min}–${DESCRIPTION_LINES.max} lines)`
    : lines === 0
      ? "Add a description — it should fill 2 to 3 lines."
      : lines < DESCRIPTION_LINES.min
        ? "Only 1 line — add a few more words so it fills 2 to 3 lines."
        : `${lines} lines — please shorten it to 3 lines or fewer.`
  return (
    <p className={cn("flex items-start gap-1.5 text-[11px] leading-snug", ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300", className)} role="status">
      {ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <AlertCircle className="mt-px size-3.5 shrink-0" />}
      {message}
    </p>
  )
}
