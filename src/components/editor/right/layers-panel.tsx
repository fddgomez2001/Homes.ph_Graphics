"use client"

import { useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Copy, Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, LockOpen, Square, Trash2, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DesignElement } from "@/lib/design/types"
import { cn } from "@/lib/utils"
import { useCurrentSlide, useEditor, useEditorStore } from "../store"

export function LayersPanel() {
  const store = useEditorStore()
  const slide = useCurrentSlide()
  const selectedId = useEditor((s) => s.selectedId)
  const elements = slide.design.elements
  const topFirst = [...elements].reverse()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toListIndex = topFirst.findIndex((e) => e.id === over.id)
    store.getState().reorderLayer(String(active.id), elements.length - 1 - toListIndex)
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      <p className="px-1 pb-1 text-[11px] text-muted-foreground">Top of the list is in front. Drag to reorder; locked layers can only be selected here.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={topFirst.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {topFirst.map((el) => (
              <LayerRow key={el.id} el={el} selected={el.id === selectedId} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function LayerRow({ el, selected }: { el: DesignElement; selected: boolean }) {
  const store = useEditorStore()
  const [renaming, setRenaming] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: el.id })
  const Icon = el.type === "text" ? Type : el.type === "image" ? ImageIcon : Square
  const update = (patch: Partial<DesignElement>) => store.getState().updateElement(el.id, patch, { history: null })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/layer flex items-center gap-1 rounded-md border bg-card px-1 py-1",
        selected && "border-primary/50 bg-accent",
        isDragging && "z-10 shadow-md",
      )}
    >
      <button
        type="button"
        className="cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground"
        aria-label={`Reorder ${el.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {renaming ? (
        <Input
          autoFocus
          defaultValue={el.name}
          className="h-6 flex-1 px-1 text-xs"
          aria-label="Layer name"
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== el.name) update({ name })
            setRenaming(false)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            if (e.key === "Escape") setRenaming(false)
          }}
        />
      ) : (
        <button
          type="button"
          className={cn("min-w-0 flex-1 truncate text-left text-xs", !el.visible && "text-muted-foreground line-through")}
          onClick={() => store.getState().select(el.id)}
          onDoubleClick={() => setRenaming(true)}
          title="Click to select · double-click to rename"
        >
          {el.name}
        </button>
      )}
      <div className="flex items-center opacity-60 group-hover/layer:opacity-100">
        <Button variant="ghost" size="icon-xs" onClick={() => update({ visible: !el.visible })} aria-label={el.visible ? `Hide ${el.name}` : `Show ${el.name}`}>
          {el.visible ? <Eye /> : <EyeOff />}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => update({ locked: !el.locked })} aria-label={el.locked ? `Unlock ${el.name}` : `Lock ${el.name}`}>
          {el.locked ? <Lock /> : <LockOpen />}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => store.getState().duplicateElement(el.id)} aria-label={`Duplicate ${el.name}`}>
          <Copy />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => store.getState().removeElement(el.id)} aria-label={`Delete ${el.name}`}>
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
