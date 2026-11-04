"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useBackup } from "@/components/backup/use-backup"
import { useConfirm } from "@/components/confirm-dialog"
import { useExport } from "@/components/export/export-provider"
import {
  deleteProject,
  duplicateProject,
  getProjectSlides,
  projectFeatures,
  restoreProject,
  trashProject,
  TRASH_DAYS,
  updateProject,
  type ProjectPatch,
} from "@/lib/data/projects"
import { moveToDay } from "@/lib/dates"
import type { ExportSlide } from "@/lib/export"
import { STATUS_LABELS, type ProjectRow, type ProjectStatus } from "@/lib/types"
import { errorMessage } from "@/lib/utils"
import { RescheduleDialog } from "./reschedule-dialog"

export interface ProjectActions {
  open: (p: ProjectRow) => void
  duplicate: (p: ProjectRow) => Promise<void>
  remove: (p: ProjectRow) => Promise<void>
  setArchived: (p: ProjectRow, archived: boolean) => Promise<void>
  setStatus: (p: ProjectRow, status: ProjectStatus) => Promise<void>
  reschedule: (p: ProjectRow) => void
  moveToDate: (p: ProjectRow, day: Date) => Promise<void>
  download: (p: ProjectRow) => Promise<void>
  /** Every slide as its own PNG, numbered 1.png (cover), 2.png… Uses `slides` when already loaded. */
  downloadPngs: (p: ProjectRow, slides?: ExportSlide[]) => Promise<void>
  backup: (p: ProjectRow) => Promise<void>
  /** Trash only: put the carousel back. */
  restore: (p: ProjectRow) => Promise<void>
  /** Trash only: delete for good (asks to type the title). */
  deleteForever: (p: ProjectRow) => Promise<void>
}

export type ProjectChange =
  | { type: "updated"; project: ProjectRow }
  | { type: "deleted"; id: string }
  | { type: "created"; id: string }

/**
 * Shared project actions with toasts, confirmations and undo.
 * `onChange` lets lists update in place (or refetch after a create).
 */
export function useProjectActions(onChange: (change: ProjectChange) => void): {
  actions: ProjectActions
  dialogs: ReactNode
} {
  const router = useRouter()
  const confirm = useConfirm()
  const { runExport } = useExport()
  const { backupSaved } = useBackup()
  const [rescheduling, setRescheduling] = useState<{ project: ProjectRow; requireDate: boolean } | null>(null)

  async function patch(p: ProjectRow, changes: ProjectPatch, message: string, undo?: ProjectPatch) {
    try {
      const updated = await updateProject(p.id, changes)
      onChange({ type: "updated", project: updated })
      toast.success(message, {
        action: undo
          ? {
              label: "Undo",
              onClick: async () => {
                try {
                  onChange({ type: "updated", project: await updateProject(p.id, undo) })
                } catch (e) {
                  toast.error(errorMessage(e))
                }
              },
            }
          : undefined,
      })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const actions: ProjectActions = {
    open: (p) => router.push(`/editor/${p.id}`),
    duplicate: async (p) => {
      try {
        const id = await duplicateProject(p.id)
        onChange({ type: "created", id })
        toast.success("Carousel duplicated as a draft", {
          action: { label: "Open", onClick: () => router.push(`/editor/${id}`) },
        })
      } catch (e) {
        toast.error(errorMessage(e))
      }
    },
    remove: async (p) => {
      const { trash } = await projectFeatures().catch(() => ({ trash: false }))
      const what = p.kind === "news" ? "news article" : "carousel"
      const ok = await confirm({
        title: `Delete this ${what}?`,
        description: trash
          ? `"${p.title}" and its ${p.slide_count} slide${p.slide_count === 1 ? "" : "s"} move to the Trash. You can restore it from there for ${TRASH_DAYS} days.`
          : `"${p.title}" and all ${p.slide_count} slide${p.slide_count === 1 ? "" : "s"} will be permanently deleted. Images stay in your library.`,
        confirmLabel: trash ? "Move to Trash" : `Delete ${what}`,
        destructive: true,
        typeToConfirm: p.title,
      })
      if (!ok) return
      try {
        const toTrash = await trashProject(p.id)
        onChange({ type: "deleted", id: p.id })
        toast.success(toTrash ? "Moved to Trash" : `${what[0].toUpperCase()}${what.slice(1)} deleted`, {
          action: toTrash
            ? {
                label: "Undo",
                onClick: async () => {
                  try {
                    await restoreProject(p.id)
                    onChange({ type: "created", id: p.id })
                  } catch (e) {
                    toast.error(errorMessage(e))
                  }
                },
              }
            : undefined,
        })
      } catch (e) {
        toast.error(errorMessage(e))
      }
    },
    restore: async (p) => {
      try {
        await restoreProject(p.id)
        onChange({ type: "deleted", id: p.id })
        toast.success(`"${p.title}" restored`, { action: { label: "Open", onClick: () => router.push(`/editor/${p.id}`) } })
      } catch (e) {
        toast.error(errorMessage(e))
      }
    },
    deleteForever: async (p) => {
      const ok = await confirm({
        title: "Delete forever?",
        description: `"${p.title}" and all its slides will be permanently deleted. This can't be undone. Images stay in your library.`,
        confirmLabel: "Delete forever",
        destructive: true,
        typeToConfirm: p.title,
      })
      if (!ok) return
      try {
        await deleteProject(p.id)
        onChange({ type: "deleted", id: p.id })
        toast.success("Deleted forever")
      } catch (e) {
        toast.error(errorMessage(e))
      }
    },
    setArchived: (p, archived) =>
      patch(
        p,
        { archived_at: archived ? new Date().toISOString() : null },
        archived ? "Carousel archived" : "Carousel restored",
        { archived_at: p.archived_at },
      ),
    setStatus: async (p, status) => {
      if (status !== "draft" && !p.caption.trim()) {
        toast.error("Add the caption first", { description: "Open the carousel and write its caption, then schedule or publish it." })
        return
      }
      if (status === "scheduled" && !p.scheduled_at) {
        setRescheduling({ project: p, requireDate: true })
        return
      }
      await patch(p, { status }, `Marked as ${STATUS_LABELS[status]}`, { status: p.status })
    },
    reschedule: (p) => setRescheduling({ project: p, requireDate: false }),
    backup: (p) => backupSaved([p.id]),
    moveToDate: async (p, day) => {
      const scheduled_at = moveToDay(p.scheduled_at, day)
      if (scheduled_at === p.scheduled_at) return
      await patch(p, { scheduled_at }, "Carousel rescheduled", { scheduled_at: p.scheduled_at })
    },
    downloadPngs: async (p, loaded) => {
      try {
        const slides = loaded?.length ? loaded : (await import("@/lib/export")).slidesFromRows(await getProjectSlides(p.id))
        await runExport({ meta: p, slides, kind: "separate", format: "png" })
      } catch (e) {
        toast.error(errorMessage(e))
      }
    },
    download: async (p) => {
      const toastId = toast.loading("Preparing download…")
      try {
        const { slidesFromRows } = await import("@/lib/export")
        const slides = slidesFromRows(await getProjectSlides(p.id))
        toast.dismiss(toastId)
        await runExport({ meta: p, slides, kind: "zip", format: "png" })
      } catch (e) {
        toast.error(errorMessage(e), { id: toastId })
      }
    },
  }

  const dialogs = (
    <RescheduleDialog
      project={rescheduling?.project ?? null}
      requireDate={rescheduling?.requireDate}
      onClose={() => setRescheduling(null)}
      onSave={async (result) => {
        if (!rescheduling) return
        const p = rescheduling.project
        await patch(p, result, result.scheduled_at ? "Publication date updated" : "Date removed", {
          scheduled_at: p.scheduled_at,
          status: p.status,
        })
      }}
    />
  )

  return { actions, dialogs }
}
