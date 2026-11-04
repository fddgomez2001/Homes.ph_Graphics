"use client"

import { AlertTriangle, AlignCenter, AlignJustify, AlignLeft, AlignRight, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FONTS, WEIGHT_LABELS } from "@/lib/design/constants"
import { loadFont, supportedWeight } from "@/lib/design/fonts"
import { findTextWarnings, shrinkStackToFit } from "@/lib/design/layout"
import type { Fill, TextElement } from "@/lib/design/types"
import { ColorField, FieldRow, NumberField, Section } from "../fields"
import { useCurrentSlide, useEditor, useEditorStore } from "../store"
import { DescriptionHint } from "../description-hint"
import { SlideTextAi } from "../slide-text-ai"
import { FillEditor } from "./shape-properties"

export function TextProperties({ el }: { el: TextElement }) {
  const store = useEditorStore()
  const slide = useCurrentSlide()
  const measure = useEditor((s) => s.measure)
  const update = (patch: Partial<TextElement>, history?: string) => store.getState().updateElement(el.id, patch, history ? { history } : {})
  const family = FONTS.find((f) => f.family === el.fontFamily) ?? FONTS[0]
  const warnings = findTextWarnings(slide.design, measure).filter((w) => w.elementId === el.id)
  const inStack = !!slide.design.stack?.enabled && slide.design.stack.items.some((i) => i.id === el.id)

  // Load the typeface first so the canvas measures and draws the real font.
  const setFont = async (fontFamily: string, fontWeight: number) => {
    const weight = supportedWeight(fontFamily, fontWeight)
    await loadFont(fontFamily, weight, el.text)
    update({ fontFamily, fontWeight: weight })
  }

  return (
    <>
      <Section title="Text">
        <Textarea
          value={el.text}
          onChange={(e) => update({ text: e.target.value }, `text:${el.id}`)}
          rows={3}
          aria-label="Text content"
          className="min-h-20 text-sm"
        />
        <p className="-mt-1 text-[11px] text-muted-foreground">Tip: double-click text on the canvas to edit it in place.</p>
        {warnings.map((w) => (
          <div key={w.kind} className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <div className="flex flex-col gap-1.5">
              <span>{w.message}</span>
              <Button
                size="xs"
                variant="outline"
                className="self-start bg-card"
                onClick={() =>
                  store.getState().updateDesign(slide.id, (d) => shrinkStackToFit(d, measure, { onlyIds: inStack ? undefined : [el.id] }))
                }
              >
                <Minimize2 /> Shrink text to fit
              </Button>
            </div>
          </div>
        ))}
        {el.role === "description" && slide.design.templateId === "homes-card" && <DescriptionHint el={el} measure={measure} />}
        <SlideTextAi el={el} />
        {inStack && (
          <p className="text-[11px] text-muted-foreground">
            Auto-arranged with the other text at the bottom. Longer text pushes the block upward.
          </p>
        )}
      </Section>

      <Section title="Font">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] font-normal text-muted-foreground">Typeface</Label>
          <Select value={family.family} onValueChange={(v) => void setFont(v, el.fontWeight)}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.family} value={f.family} style={{ fontFamily: `"${f.family}"` }}>
                  {f.family}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] font-normal text-muted-foreground">Weight</Label>
          <Select value={String(el.fontWeight)} onValueChange={(v) => void setFont(el.fontFamily, Number(v))}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {family.weights.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {WEIGHT_LABELS[w]} ({w})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {el.autoFit ? (
          <>
            <FieldRow cols={3}>
              <NumberField
                label="Max size"
                value={el.autoFit.maxSize}
                min={8}
                max={600}
                onChange={(maxSize) => update({ autoFit: { ...el.autoFit!, maxSize } })}
                suffix="px"
              />
              <NumberField label="Now" value={el.fontSize} onChange={() => {}} disabled suffix="px" />
              <NumberField
                label="Max width"
                value={el.autoFit.maxWidth}
                min={50}
                max={1254}
                onChange={(maxWidth) => update({ autoFit: { ...el.autoFit!, maxWidth } })}
                suffix="px"
              />
            </FieldRow>
            <p className="text-[11px] text-muted-foreground">
              Stays on one line: the size shrinks from the max until the line fits the width (line height 100%).
            </p>
          </>
        ) : (
          <FieldRow cols={3}>
            <NumberField label="Size" value={el.fontSize} min={4} max={600} onChange={(fontSize) => update({ fontSize })} suffix="px" />
            <NumberField label="Line height" value={el.lineHeight} min={4} max={800} onChange={(lineHeight) => update({ lineHeight })} suffix="px" />
            <NumberField
              label="Letter sp."
              value={el.letterSpacing}
              min={-20}
              max={100}
              step={0.5}
              onChange={(letterSpacing) => update({ letterSpacing })}
              suffix="px"
            />
          </FieldRow>
        )}
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Shrink to fit on one line</span>
          <Switch
            checked={!!el.autoFit}
            onCheckedChange={(on) =>
              update(
                on
                  ? { autoFit: { maxWidth: Math.round(el.width), maxSize: el.fontSize, letterSpacingEm: Math.round((el.letterSpacing / el.fontSize) * 1000) / 1000 } }
                  : { autoFit: null },
              )
            }
            aria-label="Shrink to fit on one line"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Capital letters</span>
          <Switch checked={el.textCase === "upper"} onCheckedChange={(on) => update({ textCase: on ? "upper" : null })} aria-label="Capital letters" />
        </label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={el.align}
          onValueChange={(v) => v && update({ align: v as TextElement["align"] })}
          aria-label="Text alignment"
          className="w-full"
        >
          <ToggleGroupItem value="left" aria-label="Align left" className="flex-1">
            <AlignLeft />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Align center" className="flex-1">
            <AlignCenter />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Align right" className="flex-1">
            <AlignRight />
          </ToggleGroupItem>
          <ToggleGroupItem value="justify" aria-label="Justify" className="flex-1">
            <AlignJustify />
          </ToggleGroupItem>
        </ToggleGroup>
        <FillEditor
          fill={el.fillGradient ?? { type: "solid", color: el.fill }}
          allowRadial={false}
          historyKey={`fill:${el.id}`}
          onChange={(fill: Fill, history) =>
            fill.type === "solid"
              ? update({ fill: fill.color, fillGradient: null }, history)
              : fill.type === "linear"
                ? update({ fillGradient: fill }, history)
                : undefined
          }
        />
      </Section>

      <Section
        title="Shadow"
        action={
          <Switch
            checked={el.shadow.enabled}
            onCheckedChange={(enabled) => update({ shadow: { ...el.shadow, enabled } })}
            aria-label="Text shadow"
          />
        }
      >
        {el.shadow.enabled && (
          <>
            <ColorField
              label="Shadow color"
              value={el.shadow.color}
              onChange={(color) => update({ shadow: { ...el.shadow, color } }, `shadow:${el.id}`)}
            />
            <FieldRow cols={3}>
              <NumberField label="Blur" value={el.shadow.blur} min={0} max={100} onChange={(blur) => update({ shadow: { ...el.shadow, blur } })} />
              <NumberField
                label="Offset X"
                value={el.shadow.offsetX}
                min={-100}
                max={100}
                onChange={(offsetX) => update({ shadow: { ...el.shadow, offsetX } })}
              />
              <NumberField
                label="Offset Y"
                value={el.shadow.offsetY}
                min={-100}
                max={100}
                onChange={(offsetY) => update({ shadow: { ...el.shadow, offsetY } })}
              />
            </FieldRow>
          </>
        )}
      </Section>

      <Section
        title="Highlight box"
        action={
          <Switch
            checked={el.background.enabled}
            onCheckedChange={(enabled) => update({ background: { ...el.background, enabled } })}
            aria-label="Background box behind text"
          />
        }
      >
        {el.background.enabled && (
          <>
            <ColorField
              label="Box color"
              value={el.background.color}
              onChange={(color) => update({ background: { ...el.background, color } }, `bg:${el.id}`)}
            />
            <FieldRow>
              <NumberField
                label="Padding"
                value={el.background.padding}
                min={0}
                max={200}
                onChange={(padding) => update({ background: { ...el.background, padding } })}
                suffix="px"
              />
              <NumberField
                label="Corner radius"
                value={el.background.radius}
                min={0}
                max={200}
                onChange={(radius) => update({ background: { ...el.background, radius } })}
                suffix="px"
              />
            </FieldRow>
          </>
        )}
      </Section>
    </>
  )
}
