"use client"

import { ensureFonts } from "./fonts"
import { applyTextStack } from "./layout"
import { measureLineWidth, measureTextHeight } from "./measure"
import { applyTitleFit } from "./title-fit"
import type { SlideDesign } from "./types"

/**
 * Makes a freshly built design look exactly like it will in the editor: loads its
 * fonts, auto-fits title lines to one line and runs the text stack (auto layout).
 */
export async function prepareDesign(design: SlideDesign): Promise<SlideDesign> {
  await ensureFonts([design])
  let next = applyTitleFit(design, measureLineWidth)
  if (next.stack?.enabled) next = applyTextStack(next, measureTextHeight)
  return next
}
