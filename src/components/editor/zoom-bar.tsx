"use client"

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CANVAS_SIZE } from "@/lib/design/types"
import { useEditor, useEditorStore } from "./store"

const PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2]

export function ZoomBar() {
  const store = useEditorStore()
  const zoom = useEditor((s) => s.zoom)
  const viewScale = useEditor((s) => s.viewScale)
  const index = useEditor((s) => s.slides.findIndex((x) => x.id === s.currentSlideId))
  const total = useEditor((s) => s.slides.length)
  const canvasW = useEditor((s) => (s.slides.find((x) => x.id === s.currentSlideId) ?? s.slides[0]).design.width || CANVAS_SIZE)
  const canvasH = useEditor((s) => (s.slides.find((x) => x.id === s.currentSlideId) ?? s.slides[0]).design.height || CANVAS_SIZE)

  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? PRESETS.find((p) => p > viewScale + 0.001) : [...PRESETS].reverse().find((p) => p < viewScale - 0.001)
    store.getState().setZoom(next ?? (dir > 0 ? PRESETS[PRESETS.length - 1] : PRESETS[0]))
  }
  const goTo = (i: number) => {
    const s = store.getState()
    const target = s.slides[i]
    if (target) s.setCurrentSlide(target.id)
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-t bg-card px-3 text-xs">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => goTo(index - 1)} disabled={index <= 0} aria-label="Previous slide">
          <ChevronLeft />
        </Button>
        <span className="min-w-24 text-center tabular-nums">
          Slide {index + 1} of {total}
          {index === 0 && <span className="text-muted-foreground"> · cover</span>}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => goTo(index + 1)} disabled={index >= total - 1} aria-label="Next slide">
          <ChevronRight />
        </Button>
      </div>
      <span className="ml-auto hidden text-muted-foreground sm:inline">
        Canvas {canvasW} × {canvasH} px
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Zoom out">
          <Minus />
        </Button>
        <Select value={zoom === "fit" ? "fit" : String(zoom)} onValueChange={(v) => store.getState().setZoom(v === "fit" ? "fit" : Number(v))}>
          <SelectTrigger size="sm" className="w-32" aria-label="Zoom">
            <SelectValue>{zoom === "fit" ? `Fit (${Math.round(viewScale * 100)}%)` : `${Math.round(zoom * 100)}%`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fit">Fit to screen</SelectItem>
            {PRESETS.map((p) => (
              <SelectItem key={p} value={String(p)}>
                {Math.round(p * 100)}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Zoom in">
          <Plus />
        </Button>
      </div>
    </div>
  )
}
