"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { buildBackup, backupFileName, loadBackupProjects, type BackupProgress, type BackupProject } from "@/lib/backup"
import { downloadBlob } from "@/lib/export"
import { errorMessage } from "@/lib/utils"

const progressText = (p: BackupProgress) => (p.total > 1 ? `${p.label}… ${Math.min(p.done + 1, p.total)} of ${p.total}` : `${p.label}…`)

/** Creates backup ZIPs (carousels + original images) with progress toasts. */
export function useBackup() {
  const save = useCallback(async (projects: BackupProject[] | (() => Promise<BackupProject[]>), toastId: string | number) => {
    try {
      const onProgress = (p: BackupProgress) => toast.loading(progressText(p), { id: toastId })
      const list = typeof projects === "function" ? await projects() : projects
      if (!list.length) {
        toast.info("There are no carousels to back up yet.", { id: toastId })
        return
      }
      const { blob, missing } = await buildBackup(list, onProgress)
      downloadBlob(blob, backupFileName(list))
      const what = list.length === 1 ? `"${list[0].title}"` : `${list.length} carousels`
      if (missing.length) {
        toast.warning(`Backup of ${what} saved — ${missing.length} image${missing.length === 1 ? "" : "s"} couldn't be included`, {
          id: toastId,
          description: "Those images couldn't be downloaded (check your connection). Text and layouts are all included.",
        })
      } else {
        toast.success(`Backup of ${what} saved`, { id: toastId, description: "Keep the .zip somewhere safe. Restore it from Settings → Backup & restore." })
      }
    } catch (e) {
      toast.error("Backup failed", { id: toastId, description: errorMessage(e) })
    }
  }, [])

  /** Saved carousels from the database ("all" includes archived ones). */
  const backupSaved = useCallback(
    (ids: string[] | "all") => {
      const toastId = toast.loading("Preparing backup…")
      return save(() => loadBackupProjects(ids, (p) => toast.loading(progressText(p), { id: toastId })), toastId)
    },
    [save],
  )

  /** Carousels already in memory (e.g. the editor's current state, unsaved edits included). */
  const backupLoaded = useCallback((projects: BackupProject[]) => save(projects, toast.loading("Preparing backup…")), [save])

  return { backupSaved, backupLoaded }
}
