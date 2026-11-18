"use client"

import { useMemo } from "react"
import { useCachedQuery } from "@/lib/cache"
import { listCoverTemplates } from "@/lib/data/projects"
import { carouselBrandOf, type CarouselBrand } from "@/lib/design/templates"
import type { ProjectRow } from "@/lib/types"
import { PROJECTS_CACHE } from "./use-projects"

/**
 * Which brand each carousel is (from its cover's template: Homes.ph, FHI Global Property or
 * PicklePlay), cached like the project lists. Unknown (still loading, no cover) counts as Homes.ph.
 */
export function useCarouselBrands(projects: Pick<ProjectRow, "id">[]): { brandOf: (id: string) => CarouselBrand; ready: boolean } {
  const ids = useMemo(() => projects.map((p) => p.id).sort(), [projects])
  // Short key: the count and a light hash of the ids (the list itself can be hundreds of ids).
  const key = useMemo(() => {
    let h = 0
    for (const id of ids) for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
    return ids.length ? `${PROJECTS_CACHE}brands:${ids.length}:${h}` : null
  }, [ids])
  const { data } = useCachedQuery(key, async () => Object.fromEntries(await listCoverTemplates(ids)))
  return useMemo(
    () => ({
      brandOf: (id: string) => carouselBrandOf(data?.[id]),
      ready: !!data || !ids.length,
    }),
    [data, ids.length],
  )
}
