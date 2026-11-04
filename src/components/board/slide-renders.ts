"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { readCache, useCachedQuery, writeCache } from "@/lib/cache"
import { listSlidesForProjects } from "@/lib/data/projects"
import { normalizeDesign } from "@/lib/design/normalize"
import type { SlideDesign } from "@/lib/design/types"
import type { ProjectRow, SlideRow } from "@/lib/types"
import { errorMessage } from "@/lib/utils"

/** Rendered previews (data URLs) by size and slide revision, shared by the Day Board, Home and the website. */
const renderCache = new Map<string, string>()

export interface BoardSlide {
  row: SlideRow
  design: SlideDesign
  /** Slide id + last change: a new preview is made only after an edit. */
  key: string
}

/** Every slide of these carousels, grouped per carousel (cached until a carousel changes). */
export function useProjectSlides(projects: Pick<ProjectRow, "id" | "updated_at">[]) {
  // Keyed by each project's last change, so cached slides are reused until a carousel is edited.
  const projectKey = projects.map((p) => `${p.id}:${p.updated_at}`).join("|")
  const slideRows = useCachedQuery(
    projectKey ? `slides:${projectKey}` : null,
    () => listSlidesForProjects(projectKey.split("|").map((k) => k.split(":")[0])),
    { freshFor: Infinity, errorMessage },
  )
  useEffect(() => {
    if (slideRows.error) toast.error(slideRows.error)
  }, [slideRows.error])
  // A change to a carousel (even just its status) gives a new key: keep showing the
  // slides we had for these carousels until the fresh copy arrives, instead of blanking.
  const [kept, setKept] = useState<SlideRow[] | undefined>(undefined)
  if (slideRows.data && slideRows.data !== kept) setKept(slideRows.data)
  const rows = useMemo(() => {
    if (slideRows.data) return slideRows.data
    const ids = new Set(projectKey.split("|").map((k) => k.split(":")[0]))
    return (kept ?? []).filter((row) => ids.has(row.project_id))
  }, [slideRows.data, kept, projectKey])
  const slides = useMemo(() => {
    const map = new Map<string, BoardSlide[]>()
    for (const row of rows) {
      const list = map.get(row.project_id) ?? []
      list.push({ row, design: normalizeDesign(row.design_json), key: `${row.id}:${row.updated_at}` })
      map.set(row.project_id, list)
    }
    return map
  }, [rows])

  return slides
}

/**
 * Renders slide previews one at a time, `size` px wide (600 is sharp up to ~2× zoom).
 * Kept on this device, so a carousel is drawn again only after it changes. The
 * returned map is keyed by `BoardSlide.key`.
 */
export function useSlideRenders(slides: Map<string, BoardSlide[]>, size = 600) {
  const cacheKey = (key: string) => (size === 600 ? key : `${size}:${key}`)
  const [renders, setRenders] = useState<Map<string, string>>(() => {
    const known = new Map<string, string>()
    for (const slide of [...slides.values()].flat()) {
      const url = renderCache.get(cacheKey(slide.key))
      if (url) known.set(slide.key, url)
    }
    return known
  })
  useEffect(() => {
    let cancelled = false
    const all = [...slides.values()].flat()
    ;(async () => {
      const { renderThumbnail } = await import("@/lib/design/render")
      for (const slide of all) {
        if (cancelled) return
        const key = cacheKey(slide.key)
        if (!renderCache.has(key)) {
          // Saved previews survive restarts; only complete renders (all images loaded) are kept.
          const stored = (await readCache<string>(`render:${key}`))?.data
          let url = stored ?? ""
          if (!stored) {
            url = await renderThumbnail(slide.design, size, 0.88, false).then(
              (complete) => {
                void writeCache(`render:${key}`, complete)
                return complete
              },
              () => renderThumbnail(slide.design, size, 0.88).catch(() => ""),
            )
          }
          renderCache.set(key, url)
        }
        const url = renderCache.get(key)!
        if (!cancelled) setRenders((prev) => (prev.get(slide.key) === url ? prev : new Map(prev).set(slide.key, url)))
      }
    })()
    return () => {
      cancelled = true
    }
    // cacheKey only depends on size
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, size])
  return renders
}
