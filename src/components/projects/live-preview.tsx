"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import type { SlideDesign } from "@/lib/design/types"
import { cn } from "@/lib/utils"

/**
 * Live preview of a slide while its text is being typed: renders the real
 * template (same fonts, auto-fit and layout as the editor and export) a moment
 * after the typing pauses, and fades in.
 */
export function LivePreview({ design, label, className }: { design: SlideDesign | null; label: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const latest = useRef(design)

  useEffect(() => {
    latest.current = design
    if (!design) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setBusy(true)
      try {
        const [{ prepareDesign }, { renderThumbnail }] = await Promise.all([import("@/lib/design/prepare"), import("@/lib/design/render")])
        const url = await renderThumbnail(await prepareDesign(design), 640, 0.9)
        if (!cancelled && latest.current === design) setSrc(url)
      } catch {
        // keep the last preview
      } finally {
        if (!cancelled) setBusy(false)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [design])

  return (
    <figure className={cn("flex flex-col gap-2 duration-500 animate-in fade-in slide-in-from-right-6", className)} aria-label={label}>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#0B1F8E] shadow-[0_18px_40px_rgba(8,20,70,0.28)] ring-1 ring-black/5">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="size-full transition-opacity duration-300" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-white/60" />
          </div>
        )}
        {busy && src && <Loader2 className="absolute top-2 right-2 size-4 animate-spin text-white/80" />}
      </div>
    </figure>
  )
}
