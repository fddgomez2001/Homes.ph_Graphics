"use client"

import { useState, type ReactNode } from "react"
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, errorMessage } from "@/lib/utils"

/**
 * "✨ … with AI" button that shows the suggestion first; nothing changes until
 * "Use this" is clicked. "Try again" asks for another version.
 */
export function AiSuggestion({
  label,
  request,
  onUse,
  emphasis = false,
  note,
  className,
}: {
  label: string
  request: () => Promise<string>
  onUse: (text: string) => void
  /** Highlight the button (e.g. the text is too long). */
  emphasis?: boolean
  /** Extra line under a suggestion (e.g. its line count). */
  note?: (text: string) => ReactNode
  className?: string
}) {
  const [state, setState] = useState<{ status: "idle" } | { status: "loading" } | { status: "done"; text: string } | { status: "error"; message: string }>({
    status: "idle",
  })

  const run = async () => {
    setState({ status: "loading" })
    try {
      setState({ status: "done", text: await request() })
    } catch (e) {
      setState({ status: "error", message: errorMessage(e) })
    }
  }

  if (state.status === "done") {
    return (
      <div className={cn("flex flex-col gap-2 rounded-lg border border-violet-200 dark:border-violet-500/30 bg-violet-50/60 dark:bg-violet-500/10 p-2.5", className)} role="status" aria-label="AI suggestion">
        <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-violet-700 dark:text-violet-300 uppercase">
          <Sparkles className="size-3" /> AI suggestion
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-100">{state.text}</p>
        {note?.(state.text)}
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="xs"
            onClick={() => {
              onUse(state.text)
              setState({ status: "idle" })
            }}
          >
            <Check /> Use this
          </Button>
          <Button size="xs" variant="outline" onClick={() => void run()}>
            <RefreshCw /> Try again
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setState({ status: "idle" })} aria-label="Dismiss suggestion">
            <X /> Dismiss
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={state.status === "loading"}
        onClick={() => void run()}
        className={cn(
          "w-fit gap-1.5",
          emphasis ? "border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/15" : "text-violet-700 dark:text-violet-300 hover:text-violet-800 dark:hover:text-violet-300",
        )}
      >
        {state.status === "loading" ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {state.status === "loading" ? "Writing…" : label}
      </Button>
      {state.status === "error" && <p className="text-[11px] leading-snug text-destructive">{state.message}</p>}
    </div>
  )
}
