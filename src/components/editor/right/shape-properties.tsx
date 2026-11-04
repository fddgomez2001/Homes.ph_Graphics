"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { parseColor } from "@/lib/design/color"
import { fillToCss } from "@/lib/design/geometry"
import type { Fill, GradientStop, ShapeElement } from "@/lib/design/types"
import { ColorField, NumberField, Section, SliderField } from "../fields"
import { useEditorStore } from "../store"

function withAlpha(color: string, alpha: number) {
  const n = parseInt(parseColor(color).hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function firstColor(fill: Fill) {
  return fill.type === "solid" ? fill.color : fill.stops[0]?.color ?? "#0F4C81"
}

function convert(fill: Fill, type: Fill["type"]): Fill {
  const base = firstColor(fill)
  const stops: GradientStop[] = fill.type === "solid" ? [{ offset: 0, color: base }, { offset: 1, color: withAlpha(base, 0) }] : fill.stops
  if (type === "solid") return { type: "solid", color: base }
  if (type === "linear") return { type: "linear", angle: fill.type === "linear" ? fill.angle : 180, stops }
  return { type: "radial", cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5, stops }
}

/** Solid, linear or radial (glow) fill editor — used for shapes, overlays and gradient text. */
export function FillEditor({
  fill,
  onChange,
  historyKey,
  allowRadial = true,
}: {
  fill: Fill
  onChange: (fill: Fill, history?: string) => void
  historyKey: string
  allowRadial?: boolean
}) {
  const setStops = (stops: GradientStop[], key?: string) => {
    if (fill.type !== "solid") onChange({ ...fill, stops }, key)
  }
  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={fill.type}
        onValueChange={(v) => v && v !== fill.type && onChange(convert(fill, v as Fill["type"]))}
        className="w-full"
        aria-label="Fill type"
      >
        <ToggleGroupItem value="solid" className="flex-1">
          Solid
        </ToggleGroupItem>
        <ToggleGroupItem value="linear" className="flex-1">
          Linear
        </ToggleGroupItem>
        {(allowRadial || fill.type === "radial") && (
          <ToggleGroupItem value="radial" className="flex-1">
            Radial
          </ToggleGroupItem>
        )}
      </ToggleGroup>

      {fill.type === "solid" ? (
        <ColorField label="Color" value={fill.color} onChange={(color) => onChange({ type: "solid", color }, `${historyKey}:color`)} />
      ) : (
        <>
          <div className="h-6 rounded-md border" style={{ background: fillToCss(fill.type === "linear" ? { ...fill, angle: 90 } : fill) }} aria-hidden="true" />
          {fill.type === "linear" ? (
            <SliderField
              label="Angle"
              value={fill.angle}
              min={0}
              max={360}
              onChange={(angle) => onChange({ ...fill, angle }, `${historyKey}:angle`)}
              format={(v) => `${v}°`}
            />
          ) : (
            <>
              <SliderField
                label="Width of the glow"
                value={Math.round(fill.rx * 100)}
                min={5}
                max={120}
                onChange={(v) => onChange({ ...fill, rx: v / 100 }, `${historyKey}:rx`)}
                format={(v) => `${v}%`}
              />
              <SliderField
                label="Height of the glow"
                value={Math.round(fill.ry * 100)}
                min={5}
                max={120}
                onChange={(v) => onChange({ ...fill, ry: v / 100 }, `${historyKey}:ry`)}
                format={(v) => `${v}%`}
              />
            </>
          )}
          {fill.stops.map((stop, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border p-2">
              <div className="flex items-start gap-1">
                <div className="flex-1">
                  <ColorField
                    label={`Stop ${i + 1}`}
                    value={stop.color}
                    onChange={(color) => setStops(fill.stops.map((s, j) => (j === i ? { ...s, color } : s)), `${historyKey}:stop${i}`)}
                  />
                </div>
                {fill.stops.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="mt-5"
                    aria-label={`Remove stop ${i + 1}`}
                    onClick={() => setStops(fill.stops.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                )}
              </div>
              <SliderField
                label="Position"
                value={Math.round(stop.offset * 100)}
                min={0}
                max={100}
                onChange={(v) => setStops(fill.stops.map((s, j) => (j === i ? { ...s, offset: v / 100 } : s)), `${historyKey}:pos${i}`)}
                format={(v) => `${v}%`}
              />
            </div>
          ))}
          {fill.stops.length < 5 && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setStops([...fill.stops, { offset: 0.5, color: fill.stops[0].color }])}>
              <Plus /> Add color stop
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export function ShapeProperties({ el }: { el: ShapeElement }) {
  const store = useEditorStore()
  const update = (patch: Partial<ShapeElement>, history?: string) => store.getState().updateElement(el.id, patch, history ? { history } : {})
  return (
    <>
      <Section title="Fill">
        <FillEditor fill={el.fill} historyKey={`fill:${el.id}`} onChange={(fill, history) => update({ fill }, history)} />
      </Section>
      <Section title="Effects">
        <SliderField
          label="Blur (soft glow)"
          value={el.blur ?? 0}
          min={0}
          max={250}
          step={0.5}
          onChange={(blur) => update({ blur }, `blur:${el.id}`)}
          format={(v) => `${v}px`}
        />
        <NumberField
          label="Corner radius"
          value={el.cornerRadius}
          min={0}
          max={Math.round(Math.min(el.width, el.height) / 2)}
          onChange={(cornerRadius) => update({ cornerRadius })}
          suffix="px"
        />
      </Section>
    </>
  )
}
