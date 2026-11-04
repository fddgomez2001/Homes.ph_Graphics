"use client"

import { useState } from "react"
import { AlertTriangle, Crop, Eye, EyeOff, ImagePlus, ImageUp, LayoutTemplate, Minimize2, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { findTextWarnings, shrinkStackToFit } from "@/lib/design/layout"
import { titleFitReport } from "@/lib/design/title-fit"
import type { DesignElement, ShapeElement, TextElement } from "@/lib/design/types"
import { ColorField, NumberField, Section, SliderField } from "../fields"
import { importImageFiles, slideBackground } from "../image-import"
import { SaveTemplateDialog } from "../save-template-dialog"
import { useCurrentSlide, useEditor, useEditorStore } from "../store"
import { useImageFilePicker } from "../use-file-picker"
import { DescriptionHint } from "../description-hint"
import { SlideTextAi } from "../slide-text-ai"
import { FillEditor } from "./shape-properties"

/** Shown when nothing is selected: settings for the whole slide. */
export function SlideProperties() {
  const store = useEditorStore()
  const slide = useCurrentSlide()
  const index = useEditor((s) => s.slides.findIndex((x) => x.id === s.currentSlideId))
  const measure = useEditor((s) => s.measure)
  const [saveOpen, setSaveOpen] = useState(false)
  const design = slide.design
  const bg = slideBackground(design)
  const overlays = design.elements.filter((e): e is ShapeElement => e.type === "shape" && e.role === "overlay")
  const warnings = findTextWarnings(design, measure)
  const stackTexts = (design.stack?.items ?? [])
    .map((item) => design.elements.find((e): e is TextElement => e.id === item.id && e.type === "text"))
    .filter((e): e is TextElement => !!e)
  const picker = useImageFilePicker((files) => void importImageFiles(store, files.slice(0, 1), { mode: "background", slideId: slide.id }))
  const updateEl = (id: string, patch: Partial<DesignElement>, history?: string) =>
    store.getState().updateElement(id, patch, history ? { history } : {})

  return (
    <div>
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">{index === 0 ? "Cover" : `Card ${index}`}</div>
        <div className="text-xs text-muted-foreground">
          Slide {index + 1} · {design.width} × {design.height} px · select something on the canvas to edit it
        </div>
      </div>

      {stackTexts.length > 0 && (
        <Section title="Slide text">
          {stackTexts.map((el) => (
            <div key={el.id} className="flex flex-col gap-1">
              <Label htmlFor={`st-${el.id}`} className="text-[11px] font-normal text-muted-foreground">
                {el.name}
              </Label>
              <Textarea
                id={`st-${el.id}`}
                value={el.text}
                rows={el.role === "description" ? 3 : 1}
                onChange={(e) => store.getState().updateElement(el.id, { text: e.target.value }, { history: `text:${el.id}` })}
                className="min-h-0 text-sm"
              />
              {el.role === "subtitle" && (
                <p className="text-[11px] text-muted-foreground">Leave empty to use the layout without a subtitle.</p>
              )}
              {el.role === "description" && design.templateId === "homes-card" && <DescriptionHint el={el} measure={measure} />}
              <SlideTextAi el={el} />
              {el.role === "highlight" && !el.text.trim() && (
                <p className="text-[11px] text-muted-foreground">Empty — the cover shows only the white line.</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {warnings.length > 0 && (
        <Section title="Needs attention">
          {warnings.map((w) => (
            <div key={w.elementId + w.kind} className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => store.getState().updateDesign(slide.id, (d) => shrinkStackToFit(d, measure))}
          >
            <Minimize2 /> Shrink text to fit
          </Button>
        </Section>
      )}

      <Section title="Background photo">
        {picker.input}
        {bg?.src ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={picker.open}>
                <ImageUp /> Replace
              </Button>
              <Button variant="outline" size="sm" onClick={() => store.getState().setCrop(bg.id)} disabled={bg.fit !== "cover"}>
                <Crop /> Adjust crop
              </Button>
            </div>
            <SliderField
              label="Zoom"
              value={bg.zoom}
              min={1}
              max={5}
              step={0.01}
              onChange={(zoom) => updateEl(bg.id, { zoom }, `zoom:${bg.id}`)}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <SliderField
              label="Horizontal position"
              value={Math.round(bg.focusX * 100)}
              min={0}
              max={100}
              onChange={(v) => updateEl(bg.id, { focusX: v / 100 }, `focus:${bg.id}`)}
              format={(v) => `${v}%`}
            />
            <SliderField
              label="Vertical position"
              value={Math.round(bg.focusY * 100)}
              min={0}
              max={100}
              onChange={(v) => updateEl(bg.id, { focusY: v / 100 }, `focus:${bg.id}`)}
              format={(v) => `${v}%`}
            />
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => updateEl(bg.id, { src: null, assetId: null, publicId: null, uploadId: null })}
            >
              <Trash /> Remove photo
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" className="self-start" onClick={picker.open}>
              <ImagePlus /> Add background photo
            </Button>
            <p className="text-[11px] text-muted-foreground">Or drag a photo onto the canvas, or paste one with Ctrl+V.</p>
          </>
        )}
      </Section>

      <Section title="Base color">
        <ColorField
          label="Shown where nothing covers the canvas"
          value={design.background}
          allowTransparent
          onChange={(background) => store.getState().updateDesign(slide.id, (d) => ({ ...d, background }), { history: `base:${slide.id}` })}
        />
      </Section>

      {overlays.map((overlay) => (
        <Section
          key={overlay.id}
          title={overlay.name}
          action={
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => updateEl(overlay.id, { visible: !overlay.visible })}
              aria-label={overlay.visible ? `Hide ${overlay.name}` : `Show ${overlay.name}`}
            >
              {overlay.visible ? <Eye /> : <EyeOff />}
            </Button>
          }
        >
          <FillEditor
            fill={overlay.fill}
            historyKey={`fill:${overlay.id}`}
            onChange={(fill, history) => store.getState().updateElement(overlay.id, { fill }, history ? { history } : {})}
          />
          <SliderField
            label="Overlay opacity"
            value={Math.round(overlay.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) => updateEl(overlay.id, { opacity: v / 100 }, `opacity:${overlay.id}`)}
            format={(v) => `${v}%`}
          />
        </Section>
      ))}

      {design.titleFit && (
        <Section title="Title auto-fit">
          <p className="text-xs text-muted-foreground">
            Each title line stays on one line, shrinking from its max size until it fits — the same rules as the Homes.ph Title
            Auto-Fit plugin.
          </p>
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>Same size for white &amp; gold lines</span>
            <Switch
              checked={design.titleFit.matchHeadlines}
              onCheckedChange={(matchHeadlines) =>
                store.getState().updateDesign(slide.id, (d) => (d.titleFit ? { ...d, titleFit: { ...d.titleFit, matchHeadlines } } : d))
              }
              aria-label="Same size for white and gold lines"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>Keep Title Block centered</span>
            <Switch
              checked={!!design.stack?.enabled}
              onCheckedChange={(enabled) =>
                store.getState().updateDesign(slide.id, (d) => (d.stack ? { ...d, stack: { ...d.stack, enabled } } : d))
              }
              aria-label="Keep Title Block centered"
            />
          </label>
          <SliderField
            label="Extra line gap"
            value={design.titleFit.extraGap}
            min={-20}
            max={40}
            onChange={(extraGap) =>
              store.getState().updateDesign(slide.id, (d) => (d.titleFit ? { ...d, titleFit: { ...d.titleFit, extraGap } } : d), {
                history: `title-gap:${slide.id}`,
              })
            }
            format={(v) => `${v}px`}
          />
          <div className="rounded-md bg-muted/70 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-line text-muted-foreground" aria-live="polite">
            {titleFitReport(design).join("\n")}
          </div>
        </Section>
      )}

      {design.stack && !design.titleFit && (
        <Section
          title="Auto-arrange text"
          action={
            <Switch
              checked={design.stack.enabled}
              onCheckedChange={(enabled) =>
                store.getState().updateDesign(slide.id, (d) => (d.stack ? { ...d, stack: { ...d.stack, enabled } } : d))
              }
              aria-label="Auto-arrange text"
            />
          }
        >
          <p className="text-xs text-muted-foreground">
            Keeps the title, subtitle and description stacked from the bottom, so longer text pushes the block up instead of
            overlapping.
          </p>
          {design.stack.enabled && (
            <NumberField
              label="Distance from bottom edge"
              value={design.height - design.stack.bottom}
              min={0}
              max={600}
              suffix="px"
              onChange={(v) =>
                store.getState().updateDesign(slide.id, (d) => (d.stack ? { ...d, stack: { ...d.stack, bottom: d.height - v } } : d), {
                  history: `stack-bottom:${slide.id}`,
                })
              }
            />
          )}
        </Section>
      )}

      <Section title="Reuse">
        <Button variant="outline" size="sm" className="self-start" onClick={() => setSaveOpen(true)}>
          <LayoutTemplate /> Save slide as template
        </Button>
      </Section>
      <SaveTemplateDialog open={saveOpen} onOpenChange={setSaveOpen} />
    </div>
  )
}
