"use client"

import Konva from "konva"
import { textAttrs } from "./konva-attrs"
import type { MeasureText } from "./layout"
import type { MeasureLine } from "./title-fit"

let measurer: Konva.Text | null = null
let lineMeasurer: Konva.Text | null = null

/** Rendered height of a text element (including background padding), via Konva's own layout. */
export const measureTextHeight: MeasureText = (el) => {
  measurer ??= new Konva.Text({})
  measurer.setAttrs(textAttrs(el))
  return measurer.height()
}

/** Width of the text on a single line (no wrapping), including letter spacing. */
export const measureLineWidth: MeasureLine = (el) => {
  lineMeasurer ??= new Konva.Text({})
  lineMeasurer.setAttrs({ ...textAttrs(el), width: undefined, wrap: "none", padding: 0 })
  return lineMeasurer.getTextWidth()
}
