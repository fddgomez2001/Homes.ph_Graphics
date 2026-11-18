"use client"

import { useState } from "react"
import { Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { suggestHighlight } from "@/lib/ai/client"
import { findPhrase } from "@/lib/design/konva-attrs"
import { cn, errorMessage } from "@/lib/utils"

/**
 * The headline words shown in the accent color: type them, or let the AI pick
 * the hook. Says when the words aren't in the headline (nothing is colored then).
 */
export function HighlightField({
  id,
  headline,
  value,
  accent,
  onChange,
  className,
}: {
  id?: string
  headline: string
  value: string
  /** The color the words get (shown as a swatch). */
  accent: string
  onChange: (phrase: string) => void
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const phrase = value.trim()
  const found = !phrase || !!findPhrase(headline, phrase)

  const pick = async () => {
    setBusy(true)
    try {
      onChange(await suggestHighlight(headline))
    } catch (e) {
      toast.error("Couldn't pick the words", { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Words from the headline"
            aria-invalid={!found || undefined}
            className="pr-8"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Remove the highlight"
              title="Remove the highlight"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void pick()}
          disabled={busy || !headline.trim()}
          title="Let AI pick the most eye-catching words"
          className="shrink-0 border-violet-400/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Pick with AI
        </Button>
      </div>
      <p className={cn("flex items-center gap-1.5 text-[11px]", found ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")} role="status">
        {!phrase ? (
          "Type words from the headline, or let AI pick the hook."
        ) : found ? (
          <>
            <span className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: accent }} aria-hidden="true" />
            These words are highlighted on the poster.
          </>
        ) : (
          "These words aren't in the headline, so nothing is highlighted."
        )}
      </p>
    </div>
  )
}
