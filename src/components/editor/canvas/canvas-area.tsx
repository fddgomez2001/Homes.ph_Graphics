"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { ImagePlus, Replace } from "lucide-react"
import { Layer, Line, Rect, Stage, Transformer } from "react-konva"
import { Button } from "@/components/ui/button"
import { CANVAS_SIZE, type DesignElement } from "@/lib/design/types"
import { cn } from "@/lib/utils"
import {
  ASSET_DRAG_TYPE,
  filesFromDataTransfer,
  hasEmptyBackground,
  importImageFiles,
  placeAsset,
  readAssetDrag,
  type ImportTarget,
} from "../image-import"
import { useCurrentSlide, useEditor, useEditorStore } from "../store"
import { ElementNode, type NodeHandlers } from "./element-nodes"
import { TextEditOverlay } from "./text-edit-overlay"

const PAD = 40
const SNAP_PX = 6
const TEXT_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"]
const ALL_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]

type Guide = { orientation: "v" | "h"; pos: number }
type DropZone = "primary" | "secondary"

export function CanvasArea({ stageRef }: { stageRef: React.RefObject<Konva.Stage | null> }) {
  const store = useEditorStore()
  const slide = useCurrentSlide()
  // This slide's canvas: 1254 × 1254 carousels; news articles 1408 × 1408, 1152 × 1408 or 1742 × 1436.
  const canvasW = slide.design.width || CANVAS_SIZE
  const canvasH = slide.design.height || canvasW
  const snapLines = useMemo(
    () => ({ v: [0, 40, canvasW / 2, canvasW - 40, canvasW], h: [0, 40, canvasH / 2, canvasH - 40, canvasH] }),
    [canvasW, canvasH],
  )
  const selectedId = useEditor((s) => s.selectedId)
  const editingTextId = useEditor((s) => s.editingTextId)
  const cropId = useEditor((s) => s.cropId)
  const zoom = useEditor((s) => s.zoom)
  const viewportRef = useRef<HTMLDivElement>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [guides, setGuides] = useState<Guide[]>([])
  const [drag, setDrag] = useState<{ zone: DropZone } | null>(null)
  const dragDepth = useRef(0)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const fitScale = viewport.width
    ? Math.max(0.05, Math.min((viewport.width - PAD * 2) / canvasW, (viewport.height - PAD * 2) / canvasH))
    : 0.4
  const scale = zoom === "fit" ? fitScale : zoom
  const boxW = Math.round(canvasW * scale)
  const boxH = Math.round(canvasH * scale)

  useEffect(() => {
    store.setState({ viewScale: scale })
  }, [scale, store])

  const design = slide.design
  const selected = design.elements.find((e) => e.id === selectedId) ?? null

  // Attach the transformer to the selected node.
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const canTransform = selected && !selected.locked && selected.visible && editingTextId !== selected.id && cropId !== selected.id
    const node = canTransform ? stage.findOne(`#${selected.id}`) : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selected, editingTextId, cropId, stageRef, slide.id])

  const handlers = useMemo<NodeHandlers>(
    () => ({
      onSelect: (id) => {
        const s = store.getState()
        if (s.cropId && s.cropId !== id) s.setCrop(null)
        if (s.selectedId !== id) s.select(id)
      },
      onDoubleClick: (el) => {
        if (el.type === "text") store.getState().setEditingText(el.id)
        if (el.type === "image" && el.src && el.fit === "cover") store.getState().setCrop(el.id)
      },
      onDragMove: (e) => setGuides(snapNode(e.target, scale, snapLines)),
      onDragEnd: (el, node) => {
        setGuides([])
        store.getState().updateElement(el.id, { x: Math.round(node.x()), y: Math.round(node.y()) }, { history: null, manualMove: true })
      },
      onTransformEnd: (el, node) => commitTransform(el, node, (id, patch) => store.getState().updateElement(id, patch, { history: null })),
      onCropChange: (id, patch) => store.getState().updateElement(id, patch, { history: `crop:${id}` }),
      getActiveAnchor: () => transformerRef.current?.getActiveAnchor() ?? null,
    }),
    [store, scale, snapLines],
  )

  const onStageMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const target = e.target
    if (target === target.getStage() || target.hasName("canvas-bg")) {
      const s = store.getState()
      if (s.cropId) s.setCrop(null)
      s.select(null)
    }
  }

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    const s = store.getState()
    if (!s.cropId) return
    e.evt.preventDefault()
    const el = slide.design.elements.find((x) => x.id === s.cropId)
    if (el?.type !== "image") return
    const zoomValue = Math.min(5, Math.max(1, el.zoom * (e.evt.deltaY < 0 ? 1.06 : 1 / 1.06)))
    s.updateElement(el.id, { zoom: Math.round(zoomValue * 100) / 100 }, { history: `crop-zoom:${el.id}` })
  }

  // ---- Drag & drop of files and library images onto the canvas ----
  const isImageDrag = (e: DragEvent) =>
    e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes(ASSET_DRAG_TYPE)

  const zoneAt = (e: DragEvent): DropZone => {
    const rect = viewportRef.current?.querySelector("[data-canvas-box]")?.getBoundingClientRect()
    if (!rect) return "primary"
    return e.clientY < rect.top + rect.height * 0.22 ? "secondary" : "primary"
  }

  const canvasPoint = (e: DragEvent) => {
    const rect = viewportRef.current?.querySelector("[data-canvas-box]")?.getBoundingClientRect()
    if (!rect) return undefined
    return {
      x: Math.min(canvasW, Math.max(0, (e.clientX - rect.left) / scale)),
      y: Math.min(canvasH, Math.max(0, (e.clientY - rect.top) / scale)),
    }
  }

  const bgEmpty = hasEmptyBackground(design)

  const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setDrag(null)
      const zone = zoneAt(e)
      // Empty background slot: the main zone fills it. Otherwise the main zone adds a new image where it was dropped.
      const wantsBackground = bgEmpty ? zone === "primary" : zone === "secondary"
      const target: ImportTarget = wantsBackground
        ? { mode: "background", slideId: slide.id }
        : { mode: "object", slideId: slide.id, at: canvasPoint(e) }
      const asset = readAssetDrag(e.dataTransfer)
      if (asset) {
        await placeAsset(store, asset, target)
        return
      }
      const files = filesFromDataTransfer(e.dataTransfer)
      if (files.length) await importImageFiles(store, files, target)
  }

  const editingEl = design.elements.find((e) => e.id === editingTextId)

  return (
    <div
      ref={viewportRef}
      className="relative min-h-0 flex-1 overflow-auto bg-[#EEF2F6] dark:bg-[#0b111d]"
      onDragEnter={(e) => {
        if (!isImageDrag(e)) return
        dragDepth.current++
        setDrag({ zone: zoneAt(e) })
      }}
      onDragOver={(e) => {
        if (!isImageDrag(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
        const zone = zoneAt(e)
        if (drag?.zone !== zone) setDrag({ zone })
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDrag(null)
      }}
      onDrop={onDrop}
    >
      <div
        className="flex items-center justify-center"
        style={{ minWidth: boxW + PAD * 2, minHeight: boxH + PAD * 2, width: "100%", height: "100%" }}
      >
        <div
          data-canvas-box
          role="region"
          aria-label="Slide canvas, 1254 by 1254 pixels"
          className={cn("relative shadow-[0_1px_3px_rgba(15,23,42,0.12),0_8px_24px_rgba(15,23,42,0.08)]", design.background === "transparent" && "bg-checker")}
          style={{ width: boxW, height: boxH }}
        >
          <Stage
            ref={stageRef}
            width={boxW}
            height={boxH}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={onStageMouseDown}
            onTouchStart={onStageMouseDown}
            onWheel={onWheel}
          >
            <Layer>
              <Rect
                name="canvas-bg"
                x={0}
                y={0}
                width={canvasW}
                height={canvasH}
                fill={design.background === "transparent" ? "rgba(0,0,0,0)" : design.background}
              />
              {design.elements.map((el) => (
                <ElementNode
                  key={el.id}
                  el={el}
                  hidden={editingTextId === el.id}
                  cropping={cropId === el.id}
                  interactive={!el.locked || cropId === el.id}
                  viewScale={scale}
                  handlers={handlers}
                />
              ))}
            </Layer>
            <Layer>
              {selected && (selected.locked || !selected.visible) && selected.type !== "text" && (
                <Rect
                  x={selected.x}
                  y={selected.y}
                  width={selected.width}
                  height={selected.height}
                  rotation={selected.rotation}
                  stroke="#0F4C81"
                  strokeWidth={2 / scale}
                  dash={[8 / scale, 6 / scale]}
                  listening={false}
                />
              )}
              <Transformer
                ref={transformerRef}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                rotationSnapTolerance={4}
                keepRatio={selected?.type !== "shape"}
                enabledAnchors={selected?.type === "text" ? TEXT_ANCHORS : ALL_ANCHORS}
                anchorSize={10}
                anchorCornerRadius={3}
                anchorStroke="#0F4C81"
                anchorFill="#FFFFFF"
                borderStroke="#0F4C81"
                borderStrokeWidth={1.5}
                rotateAnchorOffset={28}
                flipEnabled={false}
                ignoreStroke
                boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10 ? oldBox : newBox)}
              />
              {guides.map((g, i) => (
                <Line
                  key={i}
                  points={g.orientation === "v" ? [g.pos, 0, g.pos, canvasH] : [0, g.pos, canvasW, g.pos]}
                  stroke="#F97316"
                  strokeWidth={1 / scale}
                  dash={[6 / scale, 4 / scale]}
                  listening={false}
                />
              ))}
            </Layer>
          </Stage>

          {editingEl?.type === "text" && <TextEditOverlay el={editingEl} scale={scale} />}

          {cropId && (
            <div className="absolute -top-11 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-card px-2 py-1 text-xs shadow-sm">
              <span className="whitespace-nowrap text-muted-foreground">Drag the photo to reposition · scroll to zoom</span>
              <Button size="xs" onClick={() => store.getState().setCrop(null)}>
                Done
              </Button>
            </div>
          )}

          {drag && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col text-sm font-medium">
              <div
                className={cn(
                  "flex h-[22%] items-center justify-center gap-2 border-2 border-dashed transition-colors",
                  drag.zone === "secondary" ? "border-[#F97316] bg-[#F97316]/80 text-white" : "border-white/70 bg-slate-900/45 text-white/90",
                )}
              >
                {bgEmpty ? <ImagePlus className="size-4" /> : <Replace className="size-4" />}
                {bgEmpty ? "Add as a separate image" : "Replace background photo"}
              </div>
              <div
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 border-2 border-dashed transition-colors",
                  drag.zone === "primary" ? "border-[#0F4C81] bg-[#0F4C81]/70 text-white" : "border-white/70 bg-slate-900/35 text-white/90",
                )}
              >
                {bgEmpty ? <Replace className="size-5" /> : <ImagePlus className="size-5" />}
                {bgEmpty ? "Drop to set as the background photo" : "Drop to add an image here"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Snaps a dragged node's edges/center to the canvas center, edges and 40 px margins. */
function snapNode(node: Konva.Node, scale: number, snapLines: { v: number[]; h: number[] }): Guide[] {
  const layer = node.getLayer()
  if (!layer) return []
  const box = node.getClientRect({ relativeTo: layer as unknown as Konva.Container })
  const threshold = SNAP_PX / scale
  const guides: Guide[] = []
  const pick = (edges: number[], lines: number[]) => {
    let best: { delta: number; line: number } | null = null
    for (const edge of edges) {
      for (const line of lines) {
        const delta = line - edge
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line }
      }
    }
    return best
  }
  const v = pick([box.x, box.x + box.width / 2, box.x + box.width], snapLines.v)
  const h = pick([box.y, box.y + box.height / 2, box.y + box.height], snapLines.h)
  if (v) {
    node.x(node.x() + v.delta)
    guides.push({ orientation: "v", pos: v.line })
  }
  if (h) {
    node.y(node.y() + h.delta)
    guides.push({ orientation: "h", pos: h.line })
  }
  return guides
}

/** Converts a finished transform into element properties (no lingering scale). */
function commitTransform(el: DesignElement, node: Konva.Node, update: (id: string, patch: Partial<DesignElement>) => void) {
  const base = { x: Math.round(node.x()), y: Math.round(node.y()), rotation: Math.round(node.rotation() * 10) / 10 }
  if (el.type === "text") {
    const label = node as Konva.Label
    const sx = label.scaleX()
    const sy = label.scaleY()
    label.scaleX(1)
    label.scaleY(1)
    if (Math.abs(sy - 1) > 0.001 || Math.abs(sx - 1) > 0.001) {
      // Corner handles scale the text proportionally.
      const k = sy
      update(el.id, {
        ...base,
        fontSize: Math.max(4, Math.round(el.fontSize * k)),
        lineHeight: Math.max(4, Math.round(el.lineHeight * k)),
        letterSpacing: Math.round(el.letterSpacing * k * 10) / 10,
        width: Math.max(20, Math.round(el.width * sx)),
        background: { ...el.background, padding: Math.round(el.background.padding * k) },
      } as Partial<DesignElement>)
    } else {
      update(el.id, { ...base, width: Math.max(20, Math.round(label.getText().width())) })
    }
    return
  }
  const width = Math.max(4, Math.round(node.width() * node.scaleX()))
  const height = Math.max(4, Math.round(node.height() * node.scaleY()))
  node.scaleX(1)
  node.scaleY(1)
  update(el.id, { ...base, width, height } as Partial<DesignElement>)
}
