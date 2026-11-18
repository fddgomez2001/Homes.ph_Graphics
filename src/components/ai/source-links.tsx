"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, Link2 } from "lucide-react"
import { toast } from "sonner"
import type { AiSource } from "@/lib/ai/types"
import { cn } from "@/lib/utils"

/** "gulfnews.com/business/property/emaar-…" — the link as it reads, without https:// and www. */
export function readableLink(url: string): string {
  try {
    const u = new URL(url)
    const path = decodeURI(u.pathname).replace(/\/+$/, "")
    return `${u.hostname.replace(/^www\./, "")}${path}${u.search}`
  } catch {
    return url
  }
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
    return true
  } catch {
    toast.error(`Couldn't copy the ${what.toLowerCase()}`)
    return false
  }
}

function CopyButton({ text, what, label }: { text: string; what: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copy(text, what)) {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        }
      }}
      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={label}
      title={label}
    >
      {done ? <Check className="size-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3" />}
    </button>
  )
}

/** One source: "Source: gulfnews.com/business/…" (opens the page) and a copy button. */
export function SourceLink({ url, className, label = "Source" }: { url: string; className?: string; label?: string }) {
  if (!url) return null
  return (
    <span className={cn("flex min-w-0 items-center gap-1 text-[11px]", className)}>
      <Link2 className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <a href={url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-primary hover:underline" title={url}>
        {readableLink(url)}
      </a>
      <ExternalLink className="size-3 shrink-0 text-primary" aria-hidden="true" />
      <CopyButton text={url} what="Link" label={`Copy the link ${url}`} />
    </span>
  )
}

/**
 * Every web page a search used, with its title and link (each opens in the browser), and
 * "Copy all links". Open by default so the sources are always in view.
 */
export function SourceLinks({ sources, title, className, open = true }: { sources: AiSource[]; title?: string; className?: string; open?: boolean }) {
  if (!sources.length) return null
  const heading = title ?? `Sources: the ${sources.length} web page${sources.length === 1 ? "" : "s"} searched`
  return (
    <details open={open} className={cn("rounded-lg border bg-card px-2.5 py-2 text-xs", className)}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 font-medium text-muted-foreground">
        <span>{heading}</span>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-normal hover:bg-muted hover:text-foreground"
          onClick={(e) => {
            e.preventDefault()
            void copy(sources.map((s) => (s.title ? `${s.title}\n${s.url}` : s.url)).join("\n\n"), "Links")
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              void copy(sources.map((s) => (s.title ? `${s.title}\n${s.url}` : s.url)).join("\n\n"), "Links")
            }
          }}
        >
          <Copy className="size-3" /> Copy all links
        </span>
      </summary>
      <ol className="mt-1.5 flex max-h-48 flex-col gap-1 overflow-y-auto" aria-label="Sources">
        {sources.map((s, i) => (
          <li key={`${s.url}-${i}`} className="min-w-0">
            {s.title && <p className="truncate text-[11.5px] leading-snug">{s.title}</p>}
            <SourceLink url={s.url} label={`${i + 1}`} />
          </li>
        ))}
      </ol>
    </details>
  )
}
