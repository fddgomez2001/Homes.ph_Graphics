"use client"

import { useEffect } from "react"
import { ConflictError } from "@/lib/data/errors"
import { saveProject, type SaveSlidePayload } from "@/lib/data/projects"
import { renderThumbnail } from "@/lib/design/render"
import { summarizeDesign } from "@/lib/design/templates"
import type { EditorSlide } from "@/lib/design/types"
import { errorMessage } from "@/lib/utils"
import type { EditorStore, ProjectMeta } from "./store"

const DEBOUNCE_MS = 1200
const MAX_WAIT_MS = 6000

export interface LocalBackup {
  projectId: string
  revision: number
  savedAt: number
  project: ProjectMeta
  slides: EditorSlide[]
}

const backupKey = (projectId: string) => `dcm:backup:${projectId}`

export function readBackup(projectId: string): LocalBackup | null {
  try {
    const raw = window.localStorage.getItem(backupKey(projectId))
    return raw ? (JSON.parse(raw) as LocalBackup) : null
  } catch {
    return null
  }
}

export function clearBackup(projectId: string) {
  try {
    window.localStorage.removeItem(backupKey(projectId))
  } catch {
    // ignore
  }
}

function writeBackup(backup: LocalBackup) {
  try {
    window.localStorage.setItem(backupKey(backup.projectId), JSON.stringify(backup))
  } catch {
    // Storage full or blocked: the server save is still the source of truth.
  }
}

export function toSavePayload(slide: EditorSlide): SaveSlidePayload {
  return {
    id: slide.id,
    slide_type: slide.type,
    ...summarizeDesign(slide.design),
    canvas_width: slide.design.width,
    canvas_height: slide.design.height,
    design_json: slide.design,
  }
}

/**
 * Debounced autosave with a single request in flight at a time. Each save sends
 * the revision it was based on, so the server rejects stale writes (409) instead
 * of overwriting newer edits. Failed saves retry with backoff and when the
 * browser comes back online; unsaved work is mirrored to localStorage.
 */
export function useAutosave(store: EditorStore) {
  useEffect(() => {
    const projectId = store.getState().project.id
    let timer: ReturnType<typeof setTimeout> | null = null
    let backupTimer: ReturnType<typeof setTimeout> | null = null
    let inflight: Promise<void> | null = null
    let firstPendingAt = 0
    let retryDelay = 0
    let lastThumbSource: unknown = null
    let disposed = false

    const isDirty = () => {
      const s = store.getState()
      return s.changeVersion > s.savedVersion
    }

    const schedule = (delay = DEBOUNCE_MS) => {
      if (timer) clearTimeout(timer)
      const now = Date.now()
      if (!firstPendingAt) firstPendingAt = now
      const wait = Math.min(delay, Math.max(0, firstPendingAt + MAX_WAIT_MS - now))
      timer = setTimeout(() => void flush(), wait)
    }

    const save = async () => {
      const s = store.getState()
      if (s.conflict || !isDirty()) return
      const version = s.changeVersion
      const project: Record<string, unknown> = {}
      for (const key of Object.keys(s.dirtyMeta) as (keyof ProjectMeta)[]) project[key] = s.project[key]

      // Refresh the cover preview used by the calendar and lists when the cover changed.
      const cover = s.slides[0]
      if (cover.design !== lastThumbSource) {
        try {
          project.thumbnail = await renderThumbnail(cover.design, 360)
          lastThumbSource = cover.design
        } catch {
          // A missing preview must never block saving the real design.
        }
      }

      store.getState().markSaving()
      try {
        const result = await saveProject({
          projectId,
          expectedRevision: s.revision,
          project,
          slides: s.slides.map(toSavePayload),
        })
        store.getState().markSaved(result.revision, version)
        retryDelay = 0
        if (!isDirty()) clearBackup(projectId)
      } catch (error) {
        if (error instanceof ConflictError) {
          store.getState().markConflict()
          return
        }
        store.getState().markSaveError(errorMessage(error, "Save failed"))
        retryDelay = Math.min(30_000, retryDelay ? retryDelay * 2 : 2_000)
        if (!disposed) schedule(retryDelay)
      }
    }

    const flush = async (): Promise<void> => {
      if (timer) clearTimeout(timer)
      timer = null
      firstPendingAt = 0
      if (inflight) {
        await inflight
        if (isDirty() && !store.getState().saveError) return flush()
        return
      }
      inflight = save().finally(() => {
        inflight = null
      })
      await inflight
      // Edits made while the request was in flight get their own save.
      if (!disposed && isDirty() && !store.getState().saveError && !store.getState().conflict) schedule(400)
    }

    store.setState({ requestSave: () => void flush() })
    if (isDirty()) schedule(300)

    const unsubscribe = store.subscribe((state, prev) => {
      if (state.changeVersion === prev.changeVersion) return
      if (!state.saveError) schedule()
      if (backupTimer) clearTimeout(backupTimer)
      backupTimer = setTimeout(() => {
        const s = store.getState()
        if (s.changeVersion > s.savedVersion) {
          writeBackup({ projectId, revision: s.revision, savedAt: Date.now(), project: s.project, slides: s.slides })
        }
      }, 500)
    })

    const onOnline = () => {
      retryDelay = 0
      if (isDirty()) void flush()
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty() && !inflight) return
      void flush()
      event.preventDefault()
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      // Runs on unmount and when the route is hidden: save what's pending now.
      disposed = true
      unsubscribe()
      window.removeEventListener("online", onOnline)
      window.removeEventListener("beforeunload", onBeforeUnload)
      if (backupTimer) clearTimeout(backupTimer)
      if (timer) clearTimeout(timer)
      if (isDirty() && !store.getState().conflict) {
        // Wait for a running save so both don't use the same base revision.
        void (inflight ?? Promise.resolve()).then(() => (isDirty() ? save() : undefined))
      }
      store.setState({ requestSave: () => {} })
    }
  }, [store])
}
