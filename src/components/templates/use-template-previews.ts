"use client"

import { useEffect, useState } from "react"
import { readCache, writeCache } from "@/lib/cache"
import { BUILT_IN_TEMPLATES, type TemplateContext } from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"

const previewCache = new Map<string, string>()

/** Short content hash of a design (element ids are random, so they're left out). */
function designHash(design: SlideDesign) {
  const json = JSON.stringify(design, (k, v) => (k === "id" ? undefined : v))
  let h = 2166136261
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/** Rendered previews of the built-in templates (kept on this device until the template changes). */
export function useBuiltInPreviews(ctx: TemplateContext, size = 240) {
  const [previews, setPreviews] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const t of BUILT_IN_TEMPLATES) {
        const design = t.build(ctx)
        const key = `preview:${t.id}|${size}|${designHash(design)}`
        if (!previewCache.has(key)) {
          const stored = (await readCache<string>(key))?.data
          if (stored) previewCache.set(key, stored)
          else {
            const [{ renderThumbnail }, { prepareDesign }] = await Promise.all([import("@/lib/design/render"), import("@/lib/design/prepare")])
            const url = await renderThumbnail(await prepareDesign(design), size, 0.8, false).catch(() => "")
            if (url) void writeCache(key, url)
            previewCache.set(key, url || (await renderThumbnail(design, size).catch(() => "")))
          }
        }
        if (cancelled) return
        setPreviews((p) => ({ ...p, [t.id]: previewCache.get(key)! }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ctx, size])
  return previews
}
