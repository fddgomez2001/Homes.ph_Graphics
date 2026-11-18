"use client"

import { useMemo, useRef } from "react"
import { ArrowLeftRight, Check, ImageIcon, ImageUp, ListOrdered, RotateCcw, Shuffle, Trash } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  applyCollage,
  canUseCollage,
  cardPhoto,
  COLLAGE_LAYOUTS,
  collageTitleShown,
  getCollageLayout,
  matchCardOrder,
  photoSlots,
  removeCollage,
  setCollageTitleShown,
  shuffleCollage,
  slotDef,
  swapSlotPhotos,
  type SlotElement,
} from "@/lib/design/cover-collage"
import { useCanvasImage } from "@/lib/design/image-cache"
import { cn } from "@/lib/utils"
import { Section, SliderField } from "../fields"
import { importImageFiles } from "../image-import"
import { useEditor, useEditorStore } from "../store"
import { useImageFilePicker } from "../use-file-picker"

const OWN = "own"

/** The cover slide and, for each card, whether it has a photo (Card 1 first). */
function useCover() {
  const slides = useEditor((s) => s.slides)
  return useMemo(() => ({ cover: slides[0], cards: slides.slice(1).map((sl) => !!cardPhoto(sl.design)) }), [slides])
}

/** Opens the file picker for one slot: the chosen picture becomes that slot's own photo. */
function useSlotUpload(slideId: string) {
  const store = useEditorStore()
  const target = useRef<string | null>(null)
  const picker = useImageFilePicker((files) => {
    if (target.current) void importImageFiles(store, files.slice(0, 1), { mode: "replace", slideId, elementId: target.current })
  })
  return {
    input: picker.input,
    open: (slotId: string) => {
      target.current = slotId
      picker.open()
    },
  }
}

/** Small picture of what a slot shows (its color while empty). */
function SlotThumb({ el, className }: { el: SlotElement; className?: string }) {
  const { image } = useCanvasImage(el.src)
  return (
    <span className={cn("block shrink-0 overflow-hidden rounded-md", className)} style={{ background: slotDef(el.slot)?.color ?? "#CBD5E1" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image.src} alt="" className="size-full object-cover" draggable={false} />}
    </span>
  )
}

/** Which photo a slot shows: one of the cards' (it follows that card) or the user's own picture. */
function SlotSource({ el, cards, onUpload }: { el: SlotElement; cards: boolean[]; onUpload: () => void }) {
  const store = useEditorStore()
  // A slot can point at a card that doesn't exist yet (Photo 6 of a 4-card carousel).
  const count = Math.max(cards.length, el.slot.card ?? 0)
  return (
    <Select
      value={el.slot.card === null ? OWN : String(el.slot.card)}
      onValueChange={(v) => {
        if (v === OWN) return onUpload()
        store.getState().updateElement(el.id, { slot: { ...el.slot, card: Number(v) } }, { history: null })
      }}
    >
      <SelectTrigger size="sm" className="h-7 w-full min-w-0 text-xs" aria-label={`Photo ${el.slot.index} shows`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: count }, (_, i) => (
          <SelectItem key={i + 1} value={String(i + 1)}>
            Card {i + 1}&apos;s photo{cards[i] ? "" : i < cards.length ? " (no photo yet)" : " (no card yet)"}
          </SelectItem>
        ))}
        <SelectItem value={OWN}>{el.slot.card === null && el.src ? "Own photo" : "Upload own photo…"}</SelectItem>
      </SelectContent>
    </Select>
  )
}

/** The template choices: one photo, or one of the collage templates. */
export function CollagePicker() {
  const store = useEditorStore()
  const { cover } = useCover()
  const current = cover.design.collage ?? null
  const choose = (id: string | null) => {
    if (id === current) return
    const s = store.getState()
    s.updateDesign(cover.id, (d) => (id ? applyCollage(d, id) : removeCollage(d)))
    s.select(null)
    if (id && !current) toast.success("Cover collage on", { description: "Photo 1 shows Card 1's picture, Photo 2 shows Card 2's, and so on. Undo with Ctrl+Z." })
  }
  const tile = (active: boolean) =>
    cn("flex min-w-0 flex-col items-center gap-1 rounded-lg border bg-card p-1 text-center transition", active ? "border-transparent ring-2 ring-primary" : "hover:border-foreground/30")
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Cover photo template">
      <button type="button" role="radio" aria-checked={!current} onClick={() => choose(null)} className={tile(!current)} title="One background photo">
        <span className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ImageIcon className="size-6" />
        </span>
        <span className="w-full truncate text-[11px] leading-tight font-medium">One photo</span>
      </button>
      {COLLAGE_LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          type="button"
          role="radio"
          aria-checked={current === layout.id}
          onClick={() => choose(layout.id)}
          className={tile(current === layout.id)}
          title={`${layout.name}: ${layout.description}`}
        >
          <span className="relative block aspect-square w-full overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={layout.preview} alt="" className="size-full object-cover" draggable={false} />
            {current === layout.id && (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            )}
          </span>
          <span className="w-full truncate text-[11px] leading-tight font-medium">{layout.name}</span>
        </button>
      ))}
    </div>
  )
}

/** Cover settings (nothing selected): pick a collage template and manage what each photo slot shows. */
export function CoverCollageSection() {
  const store = useEditorStore()
  const { cover, cards } = useCover()
  const upload = useSlotUpload(cover.id)
  if (!canUseCollage(cover.design)) return null
  const design = cover.design
  const slots = design.collage ? photoSlots(design) : []
  const edit = (fn: typeof shuffleCollage) => store.getState().updateDesign(cover.id, (d) => fn(d))

  return (
    <Section title="Cover photos">
      {upload.input}
      <p className="text-xs text-muted-foreground">
        Choose one photo or a collage template. In a collage, each photo slot shows the picture of the card with the same number.
      </p>
      <CollagePicker />

      {design.collage && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => edit(shuffleCollage)} title="Mix the photos between the slots">
              <Shuffle /> Shuffle photos
            </Button>
            <Button variant="outline" size="sm" onClick={() => edit(matchCardOrder)} title="Photo 1 = Card 1, Photo 2 = Card 2…">
              <ListOrdered /> Card order
            </Button>
          </div>

          <ul className="flex flex-col gap-1.5">
            {slots.map((el) => (
              <li key={el.id} className="flex items-center gap-2 rounded-lg border bg-card p-1.5">
                <button
                  type="button"
                  onClick={() => store.getState().select(el.id)}
                  title={`Edit Photo ${el.slot.index} on the cover`}
                  className="flex shrink-0 flex-col items-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SlotThumb el={el} className="size-10" />
                  <span className="text-[10px] leading-none font-medium text-muted-foreground">Photo {el.slot.index}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <SlotSource el={el} cards={cards} onUpload={() => upload.open(el.id)} />
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => upload.open(el.id)} aria-label={`Upload a photo for Photo ${el.slot.index}`} title="Upload own photo">
                  <ImageUp />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Click a photo on the cover (or its picture here), then drag it to move it and scroll to zoom. While a photo is selected, clicks go to the photos, not
            the title over them; press Done when finished. You can also drop a picture onto a slot.
          </p>

          <label className="flex items-center justify-between gap-2 text-sm">
            <span>Show title, logo and footer</span>
            <Switch
              checked={collageTitleShown(design)}
              onCheckedChange={(shown) => store.getState().updateDesign(cover.id, (d) => setCollageTitleShown(d, shown))}
              aria-label="Show title, logo and footer"
            />
          </label>
        </>
      )}
    </Section>
  )
}

/** A selected photo slot: its photo, position and zoom, and swapping with another slot. */
export function SlotProperties({ el }: { el: SlotElement }) {
  const store = useEditorStore()
  const { cover, cards } = useCover()
  const upload = useSlotUpload(cover.id)
  const layout = getCollageLayout(el.slot.layout)
  const others = photoSlots(cover.design).filter((s) => s.id !== el.id)
  const update = (patch: Partial<SlotElement>, history?: string) => store.getState().updateElement(el.id, patch, history ? { history } : {})
  const hasCard = el.slot.card !== null
  const status = el.src
    ? hasCard
      ? `Showing Card ${el.slot.card}'s photo. It changes when that card's photo changes.`
      : "Showing its own photo."
    : hasCard
      ? el.slot.card! <= cards.length
        ? `Card ${el.slot.card} has no photo yet. Add one to the card and it appears here.`
        : `There is no Card ${el.slot.card} yet. Its photo appears here once it has one.`
      : "No photo yet."

  return (
    <div>
      {upload.input}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SlotThumb el={el} className="size-10" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Photo {el.slot.index}</div>
            <div className="truncate text-xs text-muted-foreground">Cover photo slot{layout ? ` · ${layout.name}` : ""}</div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => store.getState().select(null)}>
          All photos
        </Button>
      </div>

      <Section title="Photo">
        <SlotSource el={el} cards={cards} onUpload={() => upload.open(el.id)} />
        <p className="text-[11px] leading-snug text-muted-foreground">{status}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => upload.open(el.id)}>
            <ImageUp /> Upload own
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!el.src && !hasCard}
            onClick={() => update({ src: null, assetId: null, publicId: null, uploadId: null, slot: { ...el.slot, card: null } })}
          >
            <Trash /> Remove
          </Button>
        </div>
      </Section>

      {el.src && (
        <Section title="Move & zoom">
          <SliderField label="Zoom" value={el.zoom} min={1} max={5} step={0.01} onChange={(zoom) => update({ zoom }, `zoom:${el.id}`)} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderField
            label="Left ↔ right"
            value={Math.round(el.focusX * 100)}
            min={0}
            max={100}
            onChange={(v) => update({ focusX: v / 100 }, `focus:${el.id}`)}
            format={(v) => `${v}%`}
          />
          <SliderField
            label="Up ↔ down"
            value={Math.round(el.focusY * 100)}
            min={0}
            max={100}
            onChange={(v) => update({ focusY: v / 100 }, `focus:${el.id}`)}
            format={(v) => `${v}%`}
          />
          <Button variant="ghost" size="sm" className="self-start" onClick={() => update({ zoom: 1, focusX: 0.5, focusY: 0.5 })}>
            <RotateCcw /> Center and fit
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">Or drag the photo on the cover, scroll to zoom, and use the arrow keys for small moves.</p>
        </Section>
      )}

      {others.length > 0 && (
        <Section title="Swap with another slot">
          <div className="grid grid-cols-5 gap-1.5">
            {others.map((other) => (
              <button
                key={other.id}
                type="button"
                onClick={() => store.getState().updateDesign(cover.id, (d) => swapSlotPhotos(d, el.id, other.id))}
                title={`Swap with Photo ${other.slot.index}`}
                className="flex flex-col items-center gap-0.5 rounded-md p-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SlotThumb el={other} className="aspect-square w-full" />
                <span className="text-[10px] leading-none font-medium text-muted-foreground">{other.slot.index}</span>
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ArrowLeftRight className="size-3 shrink-0" /> Click a photo to trade places with it.
          </p>
        </Section>
      )}
    </div>
  )
}
