"use client"

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Lock,
  LockOpen,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CANVAS_SIZE, type DesignElement } from "@/lib/design/types"
import { FieldRow, NumberField, Section, SliderField } from "../fields"
import { useEditor, useEditorStore, useSelectedElement } from "../store"
import { ImageProperties } from "./image-properties"
import { ShapeProperties } from "./shape-properties"
import { SlideProperties } from "./slide-properties"
import { TextProperties } from "./text-properties"

export function PropertiesPanel() {
  const el = useSelectedElement()
  if (!el) return <SlideProperties />
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{el.name}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {el.type === "shape" ? "Shape" : el.type}
            {el.locked && " · locked"}
          </div>
        </div>
        <ElementActions el={el} />
      </div>
      {el.type === "text" && <TextProperties el={el} />}
      {el.type === "image" && <ImageProperties el={el} />}
      {el.type === "shape" && <ShapeProperties el={el} />}
      <ArrangeSection el={el} />
    </div>
  )
}

function IconButton({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ElementActions({ el }: { el: DesignElement }) {
  const store = useEditorStore()
  return (
    <div className="flex shrink-0 items-center">
      <IconButton icon={Copy} label="Duplicate (Ctrl+D)" onClick={() => store.getState().duplicateElement(el.id)} />
      <IconButton
        icon={el.locked ? LockOpen : Lock}
        label={el.locked ? "Unlock (allow moving on the canvas)" : "Lock in place"}
        onClick={() => store.getState().updateElement(el.id, { locked: !el.locked }, { history: null })}
      />
      <IconButton icon={Trash2} label="Delete (Del)" onClick={() => store.getState().removeElement(el.id)} />
    </div>
  )
}

function elementHeight(el: DesignElement, measure: (e: Extract<DesignElement, { type: "text" }>) => number) {
  return el.type === "text" ? measure(el) : el.height
}

function ArrangeSection({ el }: { el: DesignElement }) {
  const store = useEditorStore()
  const measure = useEditor((s) => s.measure)
  // Selectors return primitives so zustand doesn't see a new object on every render.
  const at = useEditor((s) => (s.slides.find((x) => x.id === s.currentSlideId) ?? s.slides[0]).design.elements.findIndex((e) => e.id === el.id))
  const count = useEditor((s) => (s.slides.find((x) => x.id === s.currentSlideId) ?? s.slides[0]).design.elements.length)
  const index = { at, count }
  const update = (patch: Partial<DesignElement>) => store.getState().updateElement(el.id, patch)
  const height = elementHeight(el, measure)
  const align = (mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => {
    const patch: Partial<DesignElement> = {}
    if (mode === "left") patch.x = 0
    const design = store.getState().slides.find((x) => x.id === store.getState().currentSlideId)?.design
    const w = design?.width ?? CANVAS_SIZE
    const h = design?.height ?? w
    if (mode === "hcenter") patch.x = Math.round((w - el.width) / 2)
    if (mode === "right") patch.x = Math.round(w - el.width)
    if (mode === "top") patch.y = 0
    if (mode === "vcenter") patch.y = Math.round((h - height) / 2)
    if (mode === "bottom") patch.y = Math.round(h - height)
    store.getState().updateElement(el.id, patch, { history: null, manualMove: "y" in patch })
  }
  const move = (dir: "forward" | "backward" | "front" | "back") => store.getState().moveLayer(el.id, dir)

  return (
    <>
      <Section title="Position & size">
        <FieldRow>
          <NumberField label="X" value={el.x} onChange={(x) => update({ x })} suffix="px" />
          <NumberField
            label="Y"
            value={el.y}
            onChange={(y) => store.getState().updateElement(el.id, { y }, { manualMove: true })}
            suffix="px"
          />
          <NumberField label="Width" value={el.width} min={1} onChange={(width) => update({ width })} suffix="px" />
          {el.type === "text" ? (
            <NumberField label="Height (auto)" value={Math.round(height)} onChange={() => {}} disabled suffix="px" />
          ) : (
            <NumberField label="Height" value={el.height} min={1} onChange={(h) => update({ height: h })} suffix="px" />
          )}
          <NumberField label="Rotation" value={el.rotation} min={-360} max={360} onChange={(rotation) => update({ rotation })} suffix="°" />
        </FieldRow>
        <SliderField
          label="Opacity"
          value={Math.round(el.opacity * 100)}
          min={0}
          max={100}
          onChange={(v) => update({ opacity: v / 100 })}
          format={(v) => `${v}%`}
        />
      </Section>
      <Section title="Align to canvas">
        <div className="flex flex-wrap gap-0.5">
          <IconButton icon={AlignStartVertical} label="Align left" onClick={() => align("left")} />
          <IconButton icon={AlignCenterVertical} label="Center horizontally" onClick={() => align("hcenter")} />
          <IconButton icon={AlignEndVertical} label="Align right" onClick={() => align("right")} />
          <IconButton icon={AlignStartHorizontal} label="Align top" onClick={() => align("top")} />
          <IconButton icon={AlignCenterHorizontal} label="Center vertically" onClick={() => align("vcenter")} />
          <IconButton icon={AlignEndHorizontal} label="Align bottom" onClick={() => align("bottom")} />
        </div>
      </Section>
      <Section title="Layer order">
        <div className="flex flex-wrap gap-0.5">
          <IconButton icon={ArrowUpToLine} label="Bring to front" onClick={() => move("front")} disabled={index.at === index.count - 1} />
          <IconButton icon={ArrowUp} label="Bring forward" onClick={() => move("forward")} disabled={index.at === index.count - 1} />
          <IconButton icon={ArrowDown} label="Send backward" onClick={() => move("backward")} disabled={index.at === 0} />
          <IconButton icon={ArrowDownToLine} label="Send to back" onClick={() => move("back")} disabled={index.at === 0} />
        </div>
      </Section>
    </>
  )
}
