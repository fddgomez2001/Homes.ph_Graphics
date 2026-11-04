"use client"

import { useId, useState, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { formatColor, isValidHex, parseColor } from "@/lib/design/color"
import { BRAND_SWATCHES } from "@/lib/design/constants"
import { cn } from "@/lib/utils"

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Numeric input that commits on Enter/blur, and live on arrow keys. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  className?: string
  disabled?: boolean
}) {
  const id = useId()
  const display = String(Math.round(value * 100) / 100)
  // While typing we show the draft; otherwise the live value (so canvas drags and undo show up).
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string) => {
    const n = Number(raw.replace(",", "."))
    if (!Number.isFinite(n)) return
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={id} className="text-[11px] font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={draft ?? display}
          disabled={disabled}
          onFocus={() => setDraft(display)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            commit(e.target.value)
            setDraft(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit((e.target as HTMLInputElement).value)
              setDraft(null)
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault()
              const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
              const next = Math.round((value + delta) * 100) / 100
              commit(String(next))
              setDraft(String(next))
            }
          }}
          className={cn("h-8 px-2 text-sm tabular-nums", suffix && "pr-7")}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  )
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (v) => String(v),
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  )
}

/** Color picker with alpha and Homes.ph brand swatches. Emits #RRGGBB or rgba(). */
export function ColorField({
  label,
  value,
  onChange,
  allowTransparent,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  allowTransparent?: boolean
}) {
  const id = useId()
  const transparent = value === "transparent"
  const parsed = parseColor(value)
  const [hexDraft, setHexDraft] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-[11px] font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="bg-checker relative size-8 shrink-0 overflow-hidden rounded-md border"
              aria-label={`${label}: choose color`}
            >
              <span className="absolute inset-0" style={{ background: transparent ? "transparent" : value }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60" align="start">
            <div className="flex flex-col gap-3">
              <input
                type="color"
                value={parsed.hex.toLowerCase()}
                onChange={(e) => onChange(formatColor(e.target.value, transparent ? 1 : parsed.alpha))}
                className="h-24 w-full cursor-pointer rounded-md border bg-transparent"
                aria-label="Color"
              />
              <div className="grid grid-cols-5 gap-1.5">
                {BRAND_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange(formatColor(c, transparent ? 1 : parsed.alpha))}
                    className="h-7 rounded-md border"
                    style={{ background: c }}
                    aria-label={`Use ${c}`}
                    title={c}
                  />
                ))}
              </div>
              {allowTransparent && (
                <button type="button" onClick={() => onChange("transparent")} className="text-left text-xs text-primary hover:underline">
                  Transparent (keeps PNG transparency)
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          value={transparent ? "transparent" : (hexDraft ?? parsed.hex)}
          onFocus={() => setHexDraft(parsed.hex)}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => {
            if (hexDraft && isValidHex(hexDraft)) {
              onChange(formatColor(hexDraft.startsWith("#") ? hexDraft : `#${hexDraft}`, transparent ? 1 : parsed.alpha))
            }
            setHexDraft(null)
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-8 min-w-0 px-2 font-mono text-xs uppercase"
          disabled={transparent}
        />
        <div className="relative w-16 shrink-0">
          <Input
            aria-label={`${label} opacity`}
            inputMode="numeric"
            value={transparent ? "0" : String(Math.round(parsed.alpha * 100))}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) onChange(formatColor(parsed.hex, Math.min(100, Math.max(0, n)) / 100))
            }}
            className="h-8 pr-5 pl-2 text-xs tabular-nums"
          />
          <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
        </div>
      </div>
    </div>
  )
}

export function FieldRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4")}>{children}</div>
}
