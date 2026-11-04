"use client"

import { RectangleHorizontal, Square, SquareDashedBottom } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BRAND } from "@/lib/design/constants"
import { loadFont } from "@/lib/design/fonts"
import { shapeElement, textElement } from "@/lib/design/templates"
import { CANVAS_SIZE, type ShapeElement, type TextElement } from "@/lib/design/types"
import { useEditorStore } from "../store"

const SHADOW = { enabled: true, color: "#000000", blur: 5, offsetX: 4, offsetY: 4 }

interface Preset {
  label: string
  hint: string
  make: () => TextElement
}

const WIDTH = 1000
const X = (CANVAS_SIZE - WIDTH) / 2

const PRESETS: Preset[] = [
  {
    label: "Heading",
    hint: "Outfit Extra Bold 90",
    make: () => textElement({ name: "Heading", text: "Add a heading", x: X, y: 520, width: WIDTH, fontSize: 90, fontWeight: 800, lineHeight: 96, align: "center", shadow: SHADOW }),
  },
  {
    label: "Subheading",
    hint: "Outfit Bold 56",
    make: () => textElement({ name: "Subheading", text: "Add a subheading", x: X, y: 560, width: WIDTH, fontSize: 56, fontWeight: 700, lineHeight: 66, align: "center" }),
  },
  {
    label: "Description",
    hint: "Outfit Regular 40",
    make: () =>
      textElement({ name: "Description", text: "Add a short description.", x: X, y: 580, width: WIDTH, fontSize: 40, fontWeight: 400, lineHeight: 52, align: "center" }),
  },
  {
    label: "Highlighted text",
    hint: "Outfit Black 80 · yellow",
    make: () =>
      textElement({ name: "Highlight", text: "HIGHLIGHT", x: X, y: 540, width: WIDTH, fontSize: 80, fontWeight: 900, lineHeight: 88, align: "center", fill: BRAND.yellow, shadow: SHADOW }),
  },
  {
    label: "Label",
    hint: "Small tag on a yellow box",
    make: () =>
      textElement({
        name: "Label",
        text: "NEW LISTING",
        x: (CANVAS_SIZE - 320) / 2,
        y: 600,
        width: 320,
        fontSize: 30,
        fontWeight: 700,
        lineHeight: 38,
        letterSpacing: 2,
        align: "center",
        fill: BRAND.overlayBlue,
        background: { enabled: true, color: BRAND.yellow, padding: 14, radius: 10 },
      }),
  },
  {
    label: "Small caption",
    hint: "Inter Regular 26",
    make: () =>
      textElement({ name: "Caption", text: "Small caption or photo credit", x: X, y: 1160, width: WIDTH, fontFamily: "Inter", fontSize: 26, fontWeight: 400, lineHeight: 34, align: "center" }),
  },
  {
    label: "Custom text",
    hint: "Plus Jakarta Sans Medium 44",
    make: () =>
      textElement({ name: "Text", text: "Your text", x: X, y: 580, width: WIDTH, fontFamily: "Plus Jakarta Sans", fontSize: 44, fontWeight: 500, lineHeight: 56, align: "center" }),
  },
]

const SHAPES: { label: string; icon: typeof Square; make: () => ShapeElement }[] = [
  {
    label: "Rectangle",
    icon: Square,
    make: () => shapeElement({ name: "Rectangle", x: 427, y: 507, width: 400, height: 240, fill: { type: "solid", color: BRAND.deepBlue }, cornerRadius: 16 }),
  },
  {
    label: "Gradient overlay",
    icon: SquareDashedBottom,
    make: () =>
      shapeElement({
        name: "Gradient overlay",
        y: CANVAS_SIZE / 2,
        height: CANVAS_SIZE / 2,
        fill: {
          type: "linear",
          angle: 0,
          stops: [
            { offset: 0, color: BRAND.overlayBlue },
            { offset: 1, color: "rgba(13, 25, 105, 0)" },
          ],
        },
      }),
  },
  {
    label: "Accent bar",
    icon: RectangleHorizontal,
    make: () => shapeElement({ name: "Accent bar", x: 527, y: 620, width: 200, height: 12, fill: { type: "solid", color: BRAND.yellow }, cornerRadius: 6 }),
  },
]

export function TextPanel() {
  const store = useEditorStore()
  const addText = async (preset: Preset) => {
    const el = preset.make()
    await loadFont(el.fontFamily, el.fontWeight, el.text)
    store.getState().addElement(el)
  }
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Text</h2>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => void addText(preset)}
            className="flex flex-col items-start rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <span className="text-sm font-medium">{preset.label}</span>
            <span className="text-[11px] text-muted-foreground">{preset.hint}</span>
          </button>
        ))}
        <p className="text-[11px] text-muted-foreground">Double-click text on the canvas to type. Paste text with Ctrl+V to add it as a text box.</p>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Shapes</h3>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map((shape) => (
            <Button
              key={shape.label}
              variant="outline"
              className="h-auto flex-col gap-1 py-2 text-[11px]"
              onClick={() => store.getState().addElement(shape.make())}
            >
              <shape.icon className="size-4" />
              {shape.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
