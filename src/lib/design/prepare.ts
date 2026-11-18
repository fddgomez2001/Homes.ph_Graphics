"use client"

import { applyBoxFit, applyHug } from "./box-fit"
import { ensureFonts } from "./fonts"
import { applyTextStack } from "./layout"
import { measureLineWidth, measureTextHeight, measureWidestLine } from "./measure"
import { applyTitleFit } from "./title-fit"
import type { SlideDesign } from "./types"
import { isBrandPostDesign } from "@/lib/brand-templates/posts"

/**
 * Makes a freshly built design look exactly like it will in the editor: loads its
 * fonts, auto-fits title lines to one line, shrinks box-fit text (poster headlines)
 * to its box and runs the text stack (auto layout).
 */
export async function prepareDesign(design: SlideDesign): Promise<SlideDesign> {
  // A brand post (1.52): its template lays its text out when it's drawn.
  if (isBrandPostDesign(design)) return design
  await ensureFonts([design])
  let next = applyHug(applyBoxFit(applyTitleFit(design, measureLineWidth), measureTextHeight), measureWidestLine)
  if (next.stack?.enabled) next = applyTextStack(next, measureTextHeight)
  return next
}
