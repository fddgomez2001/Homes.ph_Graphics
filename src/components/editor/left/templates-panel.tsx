"use client"

import { useEffect, useState } from "react"
import { useBuiltInPreviews } from "@/components/templates/use-template-previews"
import { LayoutTemplate, Loader2, Plus, Trash2, WandSparkles } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { swr } from "@/lib/cache"
import { deleteTemplate, listTemplates } from "@/lib/data/templates"
import { normalizeDesign } from "@/lib/design/normalize"
import {
  applyTemplateKeepingContent,
  BUILT_IN_TEMPLATES,
  CAROUSEL_BRANDS,
  isHomesLook,
  carouselBrandOf,
  carouselBrandOfSlides,
  cloneDesignWithNewIds,
  isCarouselCover,
  isContentCard,
  rebrandDesign,
  type CarouselBrand,
} from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"
import type { TemplateRow } from "@/lib/types"
import { cn, errorMessage } from "@/lib/utils"
import { canUseCollage } from "@/lib/design/cover-collage"
import { CollagePicker } from "../right/cover-collage"
import { SaveTemplateDialog, templateEvents } from "../save-template-dialog"
import { useCurrentSlide, useEditor, useEditorStore } from "../store"

export function TemplatesPanel() {
  const store = useEditorStore()
  const confirm = useConfirm()
  const slide = useCurrentSlide()
  const ctx = useEditor((s) => s.templateContext)
  const previews = useBuiltInPreviews(ctx)
  const [saved, setSaved] = useState<TemplateRow[] | null>(null)
  const [version, setVersion] = useState(0)
  const [saveOpen, setSaveOpen] = useState(false)

  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1)
    templateEvents.addEventListener("changed", refresh)
    return () => templateEvents.removeEventListener("changed", refresh)
  }, [])
  useEffect(() => swr("templates", listTemplates, setSaved, () => setSaved((s) => s ?? [])), [version])

  const addSlide = (design: SlideDesign) => {
    store.getState().addSlide(cloneDesignWithNewIds(design), { afterId: slide.id })
    toast.success("New slide added from template")
  }

  // Carousel brand: the whole carousel (cover + content cards) in Homes.ph, FHI or PicklePlay colors.
  // On the cover: the photo collage templates.
  const onCover = useEditor((s) => s.slides[0].id === slide.id && canUseCollage(s.slides[0].design))
  const brand = useEditor((s) => carouselBrandOfSlides(s.slides.map((sl) => sl.design)))
  const switchBrand = async (next: CarouselBrand) => {
    const info = CAROUSEL_BRANDS.find((b) => b.id === next)!
    const slides = store.getState().slides
    const changing = slides.filter((sl) => (isCarouselCover(sl.design.templateId) || isContentCard(sl.design.templateId)) && carouselBrandOf(sl.design.templateId) !== next)
    if (!changing.length) {
      toast.info(`This carousel already uses the ${info.name} template.`)
      return
    }
    const ok = await confirm({
      title: `Make this a ${info.name} carousel?`,
      description: `The cover and content cards (${changing.length} slide${changing.length === 1 ? "" : "s"}) change to the ${info.name} template: its logo, swoosh, colors, gradient and footer. Your words and photos are kept; other slides stay as they are. You can undo with Ctrl+Z.`,
      confirmLabel: `Apply ${info.name} to all`,
    })
    if (!ok) return
    store.getState().updateAllDesigns((d) => rebrandDesign(d, next, ctx))
    toast.success(`${changing.length} slide${changing.length === 1 ? "" : "s"} now use the ${info.name} template`)
  }

  const applyHere = async (name: string, design: SlideDesign) => {
    const ok = await confirm({
      title: `Apply "${name}" to this slide?`,
      description: "Your text and background photo are kept and moved into the new layout. Other elements are replaced. You can undo with Ctrl+Z.",
      confirmLabel: "Apply template",
    })
    if (!ok) return
    store.getState().updateDesign(slide.id, (d) => applyTemplateKeepingContent(d, design))
    store.getState().select(null)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Templates</h2>
        <Button size="xs" variant="outline" onClick={() => setSaveOpen(true)}>
          <LayoutTemplate /> Save this slide
        </Button>
      </div>
      <BrandSwitch value={brand} onChange={(b) => void switchBrand(b)} />
      {onCover && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cover photos</h3>
          <CollagePicker />
          <p className="text-[11px] leading-snug text-muted-foreground">A collage shows the cards&apos; photos on the cover: Photo 1 is Card 1&apos;s picture, and so on.</p>
        </section>
      )}
      {/* The carousel's own brand first, then the other brands' templates. */}
      {[...CAROUSEL_BRANDS].sort((a, b) => Number(b.id === brand) - Number(a.id === brand)).map((b) => (
        <TemplateList
          key={b.id}
          title={b.name}
          items={BUILT_IN_TEMPLATES.filter((t) => (t.brand ?? "homes") === b.id).map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            thumbnail: previews[t.id],
            design: () => t.build(ctx),
          }))}
          onAdd={addSlide}
          onApply={applyHere}
        />
      ))}
      <TemplateList
        title="Saved by you"
        loading={!saved}
        empty="Customize a slide, then use “Save this slide” to reuse it."
        items={(saved ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          thumbnail: t.thumbnail ?? undefined,
          design: () => normalizeDesign(t.design_json),
          onDelete: async () => {
            const ok = await confirm({ title: `Delete template "${t.name}"?`, description: "Slides made from it are not affected.", confirmLabel: "Delete", destructive: true })
            if (!ok) return
            try {
              await deleteTemplate(t.id)
              setVersion((v) => v + 1)
            } catch (e) {
              toast.error(errorMessage(e))
            }
          },
        }))}
        onAdd={addSlide}
        onApply={applyHere}
      />
      <SaveTemplateDialog open={saveOpen} onOpenChange={setSaveOpen} />
    </div>
  )
}

/** Edit carousel → the brand of the whole carousel: picking another one applies its template to every cover and card. */
function BrandSwitch({ value, onChange }: { value: CarouselBrand; onChange: (brand: CarouselBrand) => void }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Carousel brand</h3>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Carousel brand">
        {CAROUSEL_BRANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={value === b.id}
            onClick={() => onChange(b.id)}
            title={value === b.id ? `This carousel uses the ${b.name} template` : `Apply the ${b.name} template to all slides`}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-lg border bg-card px-1 py-2 text-center transition",
              value === b.id ? "border-transparent ring-2 ring-primary" : "hover:border-foreground/30",
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-md p-1" style={{ background: isHomesLook(b.id) ? "#FFFFFF" : b.dark }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logo} alt="" className="size-full object-contain" draggable={false} />
            </span>
            <span className="w-full truncate text-[11px] leading-tight font-medium">{b.id === "fhi" ? "FHI Global" : b.id === "gensan" ? "Gensan" : b.name}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">Pick a brand to apply its template to the cover and all cards. Words and photos are kept.</p>
    </section>
  )
}

interface TemplateItem {
  id: string
  name: string
  description?: string
  thumbnail?: string
  design: () => SlideDesign
  onDelete?: () => void
}

function TemplateList({
  title,
  items,
  onAdd,
  onApply,
  loading,
  empty,
}: {
  title: string
  items: TemplateItem[]
  onAdd: (design: SlideDesign) => void
  onApply: (name: string, design: SlideDesign) => void
  loading?: boolean
  empty?: string
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {!loading && items.length === 0 && empty && <p className="text-[11px] text-muted-foreground">{empty}</p>}
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-2 rounded-lg border bg-card p-2">
          <div className="flex gap-2.5">
            <div className="size-16 shrink-0 overflow-hidden rounded bg-muted">
              {item.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnail} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full animate-pulse bg-slate-200 dark:bg-slate-800" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start gap-1">
                <span className="min-w-0 flex-1 text-xs leading-snug font-medium break-words">{item.name}</span>
                {item.onDelete && (
                  <Button variant="ghost" size="icon-xs" onClick={item.onDelete} aria-label={`Delete template ${item.name}`}>
                    <Trash2 />
                  </Button>
                )}
              </div>
              {item.description && <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">{item.description}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="xs" className="w-full min-w-0" onClick={() => onAdd(item.design())}>
              <Plus /> <span className="truncate">Add slide</span>
            </Button>
            <Button size="xs" variant="outline" className="w-full min-w-0" onClick={() => onApply(item.name, item.design())}>
              <WandSparkles /> <span className="truncate">Apply here</span>
            </Button>
          </div>
        </div>
      ))}
    </section>
  )
}
