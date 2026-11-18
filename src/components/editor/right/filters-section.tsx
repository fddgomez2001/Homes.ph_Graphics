"use client"

import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FILTER_PRESETS, NO_FILTER, normalizeFilter, type ImageFilter } from "@/lib/design/filters"
import { cn } from "@/lib/utils"
import { Section, SliderField } from "../fields"

/**
 * A picture's filter (1.54): a preset (Vivid, Bright, Warm, Cool, Dramatic, Vintage, Soft, B&W, Noir), then
 * brightness, contrast, saturation, warmth, blur and black & white by hand. `onChange(null)`: no filter.
 */
export function FiltersSection({ value, onChange, title = "Filters" }: { value: ImageFilter | null | undefined; onChange: (filter: ImageFilter | null) => void; title?: string }) {
  const f = value ?? NO_FILTER
  const set = (patch: Partial<ImageFilter>) => onChange(normalizeFilter({ ...f, ...patch, preset: null }))
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <Section
      title={title}
      action={
        value ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onChange(null)}>
            <RotateCcw /> None
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={title}>
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => onChange(null)}
          className={cn("rounded-md border px-1 py-1.5 text-[10.5px] font-medium", !value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
        >
          None
        </button>
        {FILTER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value?.preset === p.id}
            onClick={() => onChange({ ...p.values, preset: p.id })}
            className={cn("rounded-md border px-1 py-1.5 text-[10.5px] font-medium", value?.preset === p.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {p.name}
          </button>
        ))}
      </div>
      <SliderField label="Brightness" value={f.brightness} min={0.4} max={1.8} step={0.01} format={pct} onChange={(brightness) => set({ brightness })} />
      <SliderField label="Contrast" value={f.contrast} min={0.4} max={1.8} step={0.01} format={pct} onChange={(contrast) => set({ contrast })} />
      <SliderField label="Saturation" value={f.saturation} min={0} max={2.5} step={0.01} format={pct} onChange={(saturation) => set({ saturation })} />
      <SliderField label="Warmth" value={f.warmth} min={-1} max={1} step={0.01} format={(v) => (Math.abs(v) < 0.01 ? "0" : v > 0 ? `Warm ${pct(v)}` : `Cool ${pct(-v)}`)} onChange={(warmth) => set({ warmth })} />
      <SliderField label="Black & white" value={f.grayscale} min={0} max={1} step={0.01} format={pct} onChange={(grayscale) => set({ grayscale })} />
      <SliderField label="Blur" value={f.blur} min={0} max={20} step={0.1} format={(v) => `${v.toFixed(1)} px`} onChange={(blur) => set({ blur })} />
    </Section>
  )
}
