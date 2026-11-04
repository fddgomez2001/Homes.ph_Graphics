"use client"

import { useState, type DragEvent } from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, Copy, GripVertical, Plus, Trash2 } from "lucide-react"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BUILT_IN_TEMPLATES, buildCardDesign } from "@/lib/design/templates"
import type { EditorSlide } from "@/lib/design/types"
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
import { useEditor, useEditorStore } from "../store"

type PendingDrop = { slideId: string; files: File[]; asset: ReturnType<typeof readAssetDrag> }

export function SlidesPanel() {
  const store = useEditorStore()
  const slides = useEditor((s) => s.slides)
  const isNews = useEditor((s) => !!s.slides[0]?.design.templateId?.endsWith("-news"))
  const templateContext = useEditor((s) => s.templateContext)
  const [pending, setPending] = useState<PendingDrop | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [cover, ...cards] = slides

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const to = slides.findIndex((s) => s.id === over.id)
    store.getState().moveSlide(String(active.id), Math.max(1, to))
  }

  const deliver = async (drop: PendingDrop, mode: "background" | "object") => {
    const target: ImportTarget = mode === "background" ? { mode, slideId: drop.slideId } : { mode, slideId: drop.slideId }
    store.getState().setCurrentSlide(drop.slideId)
    if (drop.asset) await placeAsset(store, drop.asset, target)
    else await importImageFiles(store, drop.files, target)
  }

  const onImageDrop = (slide: EditorSlide, e: DragEvent) => {
    const asset = readAssetDrag(e.dataTransfer)
    const files = filesFromDataTransfer(e.dataTransfer)
    if (!asset && !files.length) return
    e.preventDefault()
    const drop = { slideId: slide.id, files, asset }
    // An empty photo slot is filled directly; otherwise ask what the user meant.
    if (hasEmptyBackground(slide.design)) void deliver(drop, "background")
    else setPending(drop)
  }

  const addCard = (templateId?: string) => {
    const template = BUILT_IN_TEMPLATES.find((t) => t.id === templateId)
    store.getState().addSlide(template ? template.build(templateContext) : buildCardDesign())
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold">Slides</h2>
        <span className="text-xs text-muted-foreground">{slides.length} total</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <ol className="flex flex-col gap-2">
          <SlideThumb slide={cover} index={0} onImageDrop={onImageDrop} />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {cards.map((slide, i) => (
                <SortableSlide key={slide.id} slide={slide} index={i + 1} onImageDrop={onImageDrop} />
              ))}
            </SortableContext>
          </DndContext>
        </ol>
      </div>
      {/* A news article is a single graphic: no cards. */}
      <div className={cn("flex gap-1 border-t p-3", isNews && "hidden")}>
        <Button className="flex-1" onClick={() => addCard()}>
          <Plus /> Add card
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Add a card from another template">
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {BUILT_IN_TEMPLATES.filter((t) => t.slideType === "card").map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => addCard(t.id)}>
                {t.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add this image to the slide</DialogTitle>
            <DialogDescription>This slide already has a background photo. What would you like to do?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (pending) void deliver(pending, "object")
                  setPending(null)
                }}
              >
                Add as new image
              </Button>
              <Button
                onClick={() => {
                  if (pending) void deliver(pending, "background")
                  setPending(null)
                }}
              >
                Replace background
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SortableSlide(props: { slide: EditorSlide; index: number; onImageDrop: (slide: EditorSlide, e: DragEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.slide.id })
  return (
    <SlideThumb
      {...props}
      containerRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      handle={
        <button
          type="button"
          className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Reorder slide ${props.index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      }
    />
  )
}

function SlideThumb({
  slide,
  index,
  onImageDrop,
  containerRef,
  style,
  dragging,
  handle,
}: {
  slide: EditorSlide
  index: number
  onImageDrop: (slide: EditorSlide, e: DragEvent) => void
  containerRef?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
  dragging?: boolean
  handle?: React.ReactNode
}) {
  const store = useEditorStore()
  const confirm = useConfirm()
  const active = useEditor((s) => s.currentSlideId === slide.id)
  const thumb = useEditor((s) => s.thumbnails[slide.id])
  const [dropOver, setDropOver] = useState(false)
  const isCover = index === 0

  return (
    <li
      ref={containerRef}
      style={style}
      className={cn("group/slide relative", dragging && "z-10 opacity-80")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files") && !e.dataTransfer.types.includes(ASSET_DRAG_TYPE)) return
        e.preventDefault()
        setDropOver(true)
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        setDropOver(false)
        onImageDrop(slide, e)
      }}
    >
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {handle ?? <span className="w-[22px]" />}
        <span>{index + 1}</span>
        <span>· {isCover ? "Cover" : "Card"}</span>
        <div className="ml-auto flex opacity-0 transition-opacity group-hover/slide:opacity-100 group-focus-within/slide:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={() => store.getState().duplicateSlide(slide.id)} aria-label={`Duplicate slide ${index + 1}`}>
                <Copy />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isCover ? "Duplicate as a new card" : "Duplicate"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={isCover}
                  aria-label={`Delete slide ${index + 1}`}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete slide ${index + 1}?`,
                      description: "You can undo this with Ctrl+Z.",
                      confirmLabel: "Delete slide",
                      destructive: true,
                    })
                    if (ok) store.getState().deleteSlide(slide.id)
                  }}
                >
                  <Trash2 />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{isCover ? "The cover always stays first and can't be deleted" : "Delete"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <button
        type="button"
        onClick={() => store.getState().setCurrentSlide(slide.id)}
        aria-current={active ? "true" : undefined}
        aria-label={`Slide ${index + 1}${isCover ? " (cover)" : ""}`}
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-muted transition-colors",
          active ? "border-primary" : "border-transparent hover:border-primary/40",
          dropOver && "border-[#F97316]",
        )}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <div className="size-full animate-pulse bg-gradient-to-b from-slate-200 dark:from-slate-800 to-slate-300 dark:to-slate-700" />
        )}
        {dropOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F97316]/70 text-xs font-semibold text-white">Drop image</div>
        )}
      </button>
    </li>
  )
}
