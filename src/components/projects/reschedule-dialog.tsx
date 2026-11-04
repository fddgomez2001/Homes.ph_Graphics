"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { combineDateTime, toDateInput, toTimeInput } from "@/lib/dates"
import type { ProjectRow, ProjectStatus } from "@/lib/types"

export interface RescheduleResult {
  scheduled_at: string | null
  status: ProjectStatus
}

export function RescheduleDialog({
  project,
  requireDate,
  onClose,
  onSave,
}: {
  project: ProjectRow | null
  /** True when the user is switching the status to "Scheduled". */
  requireDate?: boolean
  onClose: () => void
  onSave: (result: RescheduleResult) => Promise<void>
}) {
  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {project && (
          <RescheduleForm key={project.id} project={project} requireDate={requireDate} onClose={onClose} onSave={onSave} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RescheduleForm({
  project,
  requireDate,
  onClose,
  onSave,
}: {
  project: ProjectRow
  requireDate?: boolean
  onClose: () => void
  onSave: (result: RescheduleResult) => Promise<void>
}) {
  const [date, setDate] = useState(toDateInput(project.scheduled_at))
  const [time, setTime] = useState(toTimeInput(project.scheduled_at))
  const [markScheduled, setMarkScheduled] = useState(requireDate || project.status === "scheduled")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(clear = false) {
    const scheduled_at = clear ? null : combineDateTime(date, time)
    const status: ProjectStatus = clear
      ? project.status === "scheduled"
        ? "draft"
        : project.status
      : markScheduled && project.status !== "published"
        ? "scheduled"
        : project.status === "scheduled" && !markScheduled
          ? "draft"
          : project.status
    if (!clear && !scheduled_at) {
      setError("Pick a date.")
      return
    }
    setBusy(true)
    try {
      await onSave({ scheduled_at, status })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{requireDate ? "Schedule carousel" : "Reschedule carousel"}</DialogTitle>
        <DialogDescription className="line-clamp-2">{project.title}</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rs-date">Publication date</Label>
          <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rs-time">Time</Label>
          <Input id="rs-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {project.status !== "published" && !requireDate && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={markScheduled} onCheckedChange={(v) => setMarkScheduled(v === true)} />
          Mark as Scheduled
        </label>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="sm:justify-between">
        {project.scheduled_at && !requireDate ? (
          <Button type="button" variant="ghost" onClick={() => void submit(true)} disabled={busy}>
            Remove date
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
