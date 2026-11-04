"use client"

import { useRef, useState } from "react"
import { ArchiveRestore, DatabaseBackup, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { BackupError, readBackup, restoreBackup, type BackupProgress, type RestoreResult } from "@/lib/backup"
import { errorMessage } from "@/lib/utils"
import { useBackup } from "./use-backup"

/** Settings card: back up every carousel with its images, or restore a backup. */
export function BackupSection() {
  const confirm = useConfirm()
  const { backupSaved } = useBackup()
  const input = useRef<HTMLInputElement>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [progress, setProgress] = useState<BackupProgress | null>(null)
  const [result, setResult] = useState<RestoreResult | null>(null)

  const backup = async () => {
    setBackingUp(true)
    try {
      await backupSaved("all")
    } finally {
      setBackingUp(false)
    }
  }

  const restore = async (file: File) => {
    setResult(null)
    let opened: ReturnType<typeof readBackup>
    try {
      opened = readBackup(new Uint8Array(await file.arrayBuffer()))
    } catch (e) {
      toast.error("Can't restore this file", { description: e instanceof BackupError ? e.message : errorMessage(e) })
      return
    }
    const { projects, images } = opened.manifest
    const ok = await confirm({
      title: `Restore ${projects.length} carousel${projects.length === 1 ? "" : "s"}?`,
      description: `They're added as new carousels with their captions, dates and ${images.length} image${images.length === 1 ? "" : "s"}. Nothing you already have is changed or replaced.`,
      confirmLabel: "Restore",
    })
    if (!ok) return
    setProgress({ label: "Starting", done: 0, total: 1 })
    try {
      const res = await restoreBackup(opened, setProgress)
      setResult(res)
      if (res.failed.length) toast.warning(`Restored ${res.restored} of ${projects.length} carousels`, { description: "See the details in Settings." })
      else toast.success(`Restored ${res.restored} carousel${res.restored === 1 ? "" : "s"}`, { description: "You'll find them in the calendar and All Content." })
    } catch (e) {
      toast.error("Restore failed", { description: errorMessage(e) })
    } finally {
      setProgress(null)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <DatabaseBackup className="size-4 text-muted-foreground" /> Backup &amp; restore
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A backup is a single .zip with every carousel — text, captions, dates, layouts — and the original images. Restoring it brings
        everything back as new carousels.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void backup()} disabled={backingUp || !!progress}>
          {backingUp ? <Loader2 className="animate-spin" /> : <DatabaseBackup />} Back up all carousels
        </Button>
        <Button variant="outline" onClick={() => input.current?.click()} disabled={backingUp || !!progress}>
          {progress ? <Loader2 className="animate-spin" /> : <ArchiveRestore />} Restore from backup…
        </Button>
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          aria-label="Backup file to restore"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void restore(file)
          }}
        />
      </div>
      {progress && (
        <div className="mt-4 flex flex-col gap-1.5" role="status">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.label}…</span>
            {progress.total > 1 && (
              <span className="tabular-nums">
                {Math.min(progress.done + 1, progress.total)} / {progress.total}
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
        </div>
      )}
      {result && (
        <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm" role="status">
          <p className="font-medium">
            Restored {result.restored} carousel{result.restored === 1 ? "" : "s"} and {result.imagesUploaded} image{result.imagesUploaded === 1 ? "" : "s"}.
          </p>
          {result.failed.map((f) => (
            <p key={f.title} className="mt-1 text-destructive">
              “{f.title}” wasn&apos;t restored: {f.message}
            </p>
          ))}
          {result.imageProblems.length > 0 && (
            <details className="mt-1 text-muted-foreground">
              <summary className="cursor-pointer">
                {result.imageProblems.length} image{result.imageProblems.length === 1 ? "" : "s"} kept their original link or need re-adding
              </summary>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {result.imageProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
