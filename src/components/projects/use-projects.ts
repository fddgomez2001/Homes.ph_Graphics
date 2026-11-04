"use client"

import { useCallback } from "react"
import { invalidate, useCachedQuery } from "@/lib/cache"
import { listProjects, type ProjectQuery } from "@/lib/data/projects"
import type { ProjectRow } from "@/lib/types"
import { errorMessage } from "@/lib/utils"
import type { ProjectChange } from "./use-project-actions"

/** Every project list is cached under this prefix. */
export const PROJECTS_CACHE = "projects:"

/** Call after creating/changing/deleting carousels so every list refreshes. */
export function invalidateProjects() {
  invalidate(PROJECTS_CACHE)
}

/**
 * Loads projects for a query. Shows the cached list instantly (also after an
 * app restart) and refreshes it in the background, on focus, and after changes.
 */
export function useProjects(query: ProjectQuery | null) {
  const key = query ? `${PROJECTS_CACHE}${JSON.stringify(query)}` : null
  const { data, error, reload, mutate } = useCachedQuery(key, () => listProjects(query ?? {}), { errorMessage })

  /** Applies a change locally right away, then refetches every list to stay consistent. */
  const apply = useCallback(
    (change: ProjectChange) => {
      mutate((projects) => {
        if (!projects) return projects
        if (change.type === "deleted") return projects.filter((p) => p.id !== change.id)
        if (change.type === "updated") return projects.map((p) => (p.id === change.project.id ? change.project : p))
        return projects
      })
      invalidateProjects()
    },
    [mutate],
  )

  const patchLocal = useCallback(
    (id: string, patch: Partial<ProjectRow>) => mutate((projects) => projects?.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [mutate],
  )

  return {
    projects: data ?? [],
    error,
    /** True until there is something to show for this query (cached or fresh). */
    loading: data === undefined && !error,
    reload,
    apply,
    patchLocal,
  }
}
