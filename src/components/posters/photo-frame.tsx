"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { Maximize, Minimize, Minus, Move, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { newsPhotoFrame, type PhotoFrame } from "@/lib/data/news"
import { blurredCopy } from "@/lib/design/blur-fill"
import { coverLayout, fitZoom, frameLayout } from "@/lib/design/geometry"
import { loadImage } from "@/lib/design/image-cache"
import { MIN_FRAME_ZOOM, type SlideDesign } from "@/lib/design/types"

/** Every poster's photo card has a 6 px border inside its edge; the live view stays inside it. */
const BORDER = 6
const MAX_ZOOM = 3
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const sameFrame = (a: PhotoFrame, b: PhotoFrame) =>
  Math.abs(a.zoom - b.zoom) < 1e-4 && Math.abs(a.focusX - b.focusX) < 1e-4 && Math.abs(a.focusY - b.focusY) < 1e-4
/** Focus for a photo placed at `offset` when it can move over `range` (frame minus photo size). */
const focusAt = (offset: number, range: number, fallback: number) => (Math.abs(range) > 0.5 ? clamp01(offset / range) : fallback)

/**
 * Move and zoom the photo inside a poster's photo card, right on the preview: drag to move,
 * mouse wheel or pinch to zoom (towards the pointer), or the slider under the preview. The
 * photo can zoom out below 100% (down to the whole photo and further); the card's empty space
 * then shows a blurred copy of the photo. While moving the photo is drawn live over the
 * preview; letting go saves it, and the live view goes once the preview shows it.
 */
export function usePhotoFrame(design: SlideDesign, commit: (frame: PhotoFrame) => void, preview: HTMLElement | null) {
  const info = useMemo(() => newsPhotoFrame(design), [design])
  const src = info?.src ?? null
  const [live, setLive] = useState<PhotoFrame | null>(null)
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement } | null>(null)
  const img = loaded && loaded.src === src ? loaded.img : null
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; start: PhotoFrame; scale: number; rangeX: number; rangeY: number } | null>(null)
  const liveRef = useRef<PhotoFrame | null>(null)
  // Committed but not yet on the preview: the live view stays until it is.
  const waiting = useRef<PhotoFrame | null>(null)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    liveRef.current = live
  })

  useEffect(() => {
    if (!src) return
    let cancelled = false
    loadImage(src).then(
      (image) => !cancelled && setLoaded({ src, img: image }),
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [src])

  const box = info?.box
  const blurFill = !!info?.blurFill
  const radius = info?.radius ?? 0
  /** Where the photo sits in the card at a given zoom / focus. */
  const layoutOf = useCallback(
    (frame: PhotoFrame) => {
      if (!img || !box) return null
      if (blurFill) return frameLayout(img.naturalWidth, img.naturalHeight, box.width, box.height, frame.zoom, frame.focusX, frame.focusY)
      const cover = coverLayout(img.naturalWidth, img.naturalHeight, box.width, box.height, frame.zoom, frame.focusX, frame.focusY)
      return { ...cover, dest: { x: 0, y: 0, width: box.width, height: box.height }, rangeX: -cover.overflowX, rangeY: -cover.overflowY, covers: true }
    },
    [img, box, blurFill],
  )
  /** Smallest zoom: the whole photo fits (and a bit further, so it can sit inside a blurred border). */
  const minZoom = img && box && blurFill ? Math.max(MIN_FRAME_ZOOM, Math.min(0.5, fitZoom(img.naturalWidth, img.naturalHeight, box.width, box.height))) : 1
  const clampZoom = useCallback((z: number) => Math.min(MAX_ZOOM, Math.max(minZoom, z)), [minZoom])

  // Draw the live view (the whole card; its container clips it inside the border).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !live || !img || !box) return
    const ctx = canvas.getContext("2d")
    const layout = layoutOf(live)
    if (!ctx || !layout) return
    const k = canvas.width / box.width
    ctx.imageSmoothingQuality = "high"
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!layout.covers) {
      const blurred = blurredCopy(img)
      const { crop } = coverLayout(blurred.width, blurred.height, box.width, box.height)
      ctx.drawImage(blurred, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
    }
    const { crop, dest } = layout
    if (dest.width > 0 && dest.height > 0) ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, dest.x * k, dest.y * k, dest.width * k, dest.height * k)
  }, [live, img, box, layoutOf])

  const current: PhotoFrame | null = live ?? (info ? { zoom: info.zoom, focusX: info.focusX, focusY: info.focusY } : null)

  const save = useCallback(
    (frame: PhotoFrame) => {
      if (info && sameFrame(frame, info)) {
        waiting.current = null
        setLive(null)
        return
      }
      waiting.current = frame
      commit(frame)
    },
    [info, commit],
  )

  /** Called with each design the preview finished drawing: the live view goes once it shows the saved frame. */
  const rendered = (drawn: SlideDesign) => {
    const shown = newsPhotoFrame(drawn)
    if (waiting.current && shown && sameFrame(waiting.current, shown)) {
      waiting.current = null
      setLive(null)
    }
  }

  /** The pointer's spot in the photo card (design px), or null when it's outside the card. */
  const pointInCard = useCallback(
    (el: HTMLElement, clientX: number, clientY: number) => {
      if (!info) return null
      const rect = el.getBoundingClientRect()
      const scale = rect.width / design.width
      const px = (clientX - rect.left) / scale - info.box.x
      const py = (clientY - rect.top) / scale - info.box.y
      if (px < 0 || px > info.box.width || py < 0 || py > info.box.height) return null
      return { px, py, scale }
    },
    [info, design.width],
  )

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!info || !img || !current || e.button !== 0) return
    const at = pointInCard(e.currentTarget, e.clientX, e.clientY)
    const layout = layoutOf(current)
    if (!at || !layout) return
    drag.current = { x: e.clientX, y: e.clientY, start: current, scale: at.scale, rangeX: layout.rangeX, rangeY: layout.rangeY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setLive(current)
    e.preventDefault()
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.x) / d.scale
    const dy = (e.clientY - d.y) / d.scale
    const move = (focus: number, by: number, range: number) => (Math.abs(range) > 0.5 ? clamp01(focus + by / range) : focus)
    setLive({ zoom: d.start.zoom, focusX: move(d.start.focusX, dx, d.rangeX), focusY: move(d.start.focusY, dy, d.rangeY) })
  }

  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    if (liveRef.current) save(liveRef.current)
  }

  /** Zoom keeping the photo's spot under (px, py) in place (card px); the middle of the card without a spot. */
  const zoomed = useCallback(
    (from: PhotoFrame, zoom: number, px?: number, py?: number): PhotoFrame => {
      const next = clampZoom(zoom)
      const before = layoutOf(from)
      const after = layoutOf({ ...from, zoom: next })
      if (!before || !after || !box) return { ...from, zoom: next }
      const x = px ?? box.width / 2
      const y = py ?? box.height / 2
      // The photo pixel under the spot, and where the photo must go to keep it there.
      const u = (x - before.image.x) / before.scale
      const v = (y - before.image.y) / before.scale
      return {
        zoom: next,
        focusX: focusAt(x - u * after.scale, after.rangeX, from.focusX),
        focusY: focusAt(y - v * after.scale, after.rangeY, from.focusY),
      }
    },
    [clampZoom, layoutOf, box],
  )

  // Mouse wheel / trackpad pinch over the photo (on `preview`) zooms it (saved a moment after the last turn).
  const wheel = useRef<(e: WheelEvent) => void>(() => {})
  useEffect(() => {
    wheel.current = (e: WheelEvent) => {
      const el = preview
      const base = liveRef.current ?? current
      if (!el || !img || !base) return
      const at = pointInCard(el, e.clientX, e.clientY)
      if (!at) return
      e.preventDefault()
      const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const next = zoomed(base, base.zoom * Math.exp((-e.deltaY * lines) / (e.ctrlKey ? 100 : 500)), at.px, at.py)
      setLive(next)
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => {
        wheelTimer.current = null
        if (liveRef.current) save(liveRef.current)
      }, 350)
    }
  })
  useEffect(() => {
    if (!preview) return
    const onWheel = (e: WheelEvent) => wheel.current(e)
    // Not passive: the page mustn't scroll while the photo zooms.
    preview.addEventListener("wheel", onWheel, { passive: false })
    return () => preview.removeEventListener("wheel", onWheel)
  }, [preview])

  const setZoom = (zoom: number) => current && setLive(zoomed(current, zoom))
  const saveZoom = (zoom: number) => current && save(zoomed(current, zoom))
  const place = (frame: PhotoFrame) => {
    if (img) setLive(frame)
    save(frame)
  }
  /** 100%: the photo just covers the card, centered. */
  const reset = () => place({ zoom: 1, focusX: 0.5, focusY: 0.5 })
  /** The whole photo inside the card (blurred copy around it), centered. */
  const fit = () => img && box && place({ zoom: clampZoom(fitZoom(img.naturalWidth, img.naturalHeight, box.width, box.height)), focusX: 0.5, focusY: 0.5 })

  const W = design.width
  const H = design.height
  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  const overlay =
    live && img && box ? (
      <div
        className="pointer-events-none absolute overflow-hidden"
        style={{
          left: pct(box.x + BORDER, W),
          top: pct(box.y + BORDER, H),
          width: pct(box.width - 2 * BORDER, W),
          height: pct(box.height - 2 * BORDER, H),
          // The card's rounded corners (inside its border) while the photo is moved.
          ...(radius > BORDER ? { borderRadius: `${pct(radius - BORDER, box.width - 2 * BORDER)} / ${pct(radius - BORDER, box.height - 2 * BORDER)}` } : {}),
        }}
        aria-hidden="true"
      >
        <canvas
          ref={canvasRef}
          width={Math.round(box.width)}
          height={Math.round(box.height)}
          className="absolute"
          style={{
            left: pct(-BORDER, box.width - 2 * BORDER),
            top: pct(-BORDER, box.height - 2 * BORDER),
            width: pct(box.width, box.width - 2 * BORDER),
            height: pct(box.height, box.height - 2 * BORDER),
          }}
        />
      </div>
    ) : null

  return {
    /** The design has a photo card with a photo in it. */
    available: !!info && !!src,
    current,
    minZoom,
    /** It can zoom out over a blurred copy of itself. */
    blurFill,
    overlay,
    rendered,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    setZoom,
    saveZoom,
    reset,
    fit,
  }
}

/** Zoom slider (down to the whole photo, up to 300%) with − / +, Fit and Reset, under the preview. */
export function PhotoFrameControls({ frame }: { frame: ReturnType<typeof usePhotoFrame> }) {
  if (!frame.available || !frame.current) return null
  const zoom = Math.round(frame.current.zoom * 100)
  const min = Math.round(frame.minZoom * 100)
  const step = (by: number) => frame.saveZoom((zoom + by) / 100)
  return (
    <div className="flex max-w-[min(100%,calc(100dvh-12rem))] flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-card px-3 py-2 text-xs" role="group" aria-label="Photo position">
      <Move className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">
        Drag the photo to move it; scroll or pinch on it to zoom.{frame.blurFill && zoom < 100 ? " The blurred photo fills the rest of the frame." : ""}
      </span>
      <span className="ml-auto flex min-w-64 flex-1 items-center gap-1.5">
        <span className="shrink-0 font-medium">Zoom</span>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => step(-10)} disabled={zoom <= min}>
          <Minus />
        </Button>
        <Slider
          value={[zoom]}
          min={min}
          max={MAX_ZOOM * 100}
          step={1}
          onValueChange={([v]) => frame.setZoom(v / 100)}
          onValueCommit={([v]) => frame.saveZoom(v / 100)}
          aria-label="Photo zoom"
          className="min-w-24 flex-1"
        />
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => step(10)} disabled={zoom >= MAX_ZOOM * 100}>
          <Plus />
        </Button>
        <span className="w-10 text-right tabular-nums">{zoom}%</span>
        {frame.blurFill && (
          <Button variant="ghost" size="sm" className="h-7" onClick={frame.fit} title="Show the whole photo (the blurred photo fills the rest of the frame)">
            <Minimize /> Fit
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7" onClick={frame.reset} title="Fill the card (100%), centered">
          {frame.blurFill ? <Maximize /> : <RotateCcw />} {frame.blurFill ? "Fill" : "Reset"}
        </Button>
      </span>
    </div>
  )
}
