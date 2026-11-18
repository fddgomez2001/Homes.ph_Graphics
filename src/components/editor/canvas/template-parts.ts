"use client"

import { useEffect, useRef, useState } from "react"
import { isBrandPostDesign } from "@/lib/brand-templates/posts"
import type { SlideDesign } from "@/lib/design/types"

export interface TemplateParts {
  back?: HTMLCanvasElement
  front?: HTMLCanvasElement
}

/**
 * A brand post's two template layers (1.53), drawn from its SVG for the editor's canvas: drawn again when the
 * post's texts, photos or template change (set in the Poster Maker), not when its own layers move. Null for
 * any other design.
 */
export function useTemplateParts(design: SlideDesign): TemplateParts | null {
  const brand = isBrandPostDesign(design)
  const key = brand
    ? JSON.stringify({ t: design.templateId, b: design.brandPost, h: design.subtextHook ?? null, c: design.elements.filter((e) => e.carrier) })
    : ""
  const designRef = useRef(design)
  useEffect(() => {
    designRef.current = design
  })
  const [parts, setParts] = useState<TemplateParts>({})
  useEffect(() => {
    if (!key) return
    let cancelled = false
    import("@/lib/brand-templates/render")
      .then(({ renderBrandPostParts }) => renderBrandPostParts(designRef.current, { pixelRatio: 1, tolerateMissingImages: true }))
      .then(
        (next) => !cancelled && setParts(next),
        (e) => console.warn("The template's layers couldn't be drawn", e),
      )
    return () => {
      cancelled = true
    }
  }, [key])
  return brand ? parts : null
}
