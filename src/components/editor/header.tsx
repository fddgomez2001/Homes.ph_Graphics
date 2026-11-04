"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CloudOff,
  DatabaseBackup,
  Download,
  PictureInPicture2,
  FileText,
  Loader2,
  PanelRight,
  Redo2,
  Save,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { useBackup } from "@/components/backup/use-backup"
import { useExport } from "@/components/export/export-provider"
import { toBackupProject } from "@/lib/backup"
import { setFloatMode, useFloatAvailable, useFloatMode } from "@/lib/float"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getProject } from "@/lib/data/projects"
import { combineDateTime, formatSchedule, toDateInput, toTimeInput } from "@/lib/dates"
import type { ExportFormat } from "@/lib/design/render"
import { PROJECT_STATUSES, STATUS_LABELS, type ProjectStatus } from "@/lib/types"
import { errorMessage } from "@/lib/utils"
import { coverTitle } from "@/lib/design/cover-title"
import { ThemeToggle } from "@/components/theme/theme"
import { clearBackup } from "./persistence"
import { saveStatusOf, useEditor, useEditorStore } from "./store"

export function EditorHeader({ onToggleRight }: { onToggleRight: () => void }) {
  const store = useEditorStore()
  const router = useRouter()
  const title = useEditor((s) => s.project.title)
  const status = useEditor((s) => s.project.status)
  const scheduledAt = useEditor((s) => s.project.scheduled_at)
  const hasCaption = useEditor((s) => !!s.project.caption.trim())
  const titleFromCover = useEditor((s) => !!coverTitle(s.slides[0].design))
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const setStatus = (next: ProjectStatus) => {
    if (next !== "draft" && !hasCaption) {
      toast.error("Add the caption first", { description: "Every carousel needs a caption before it can be scheduled or published (Caption tab)." })
      return
    }
    if (next === "scheduled" && !scheduledAt) {
      toast.info("Pick a publication date to schedule this carousel.")
      setScheduleOpen(true)
      return
    }
    store.getState().setMeta({ status: next })
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => {
              store.getState().requestSave()
              if (window.history.length > 1) router.back()
              else router.push("/home")
            }}
          >
            <ArrowLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Back</TooltipContent>
      </Tooltip>

      {titleFromCover ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <h1 className="min-w-0 max-w-80 flex-1 truncate px-1 text-sm font-semibold" aria-label={`Carousel title: ${title}`}>
              {title}
            </h1>
          </TooltipTrigger>
          <TooltipContent>The title comes from the cover: Headline 1 + Headline 2</TooltipContent>
        </Tooltip>
      ) : (
        <Input
          value={title}
          onChange={(e) => store.getState().setMeta({ title: e.target.value })}
          onBlur={(e) => !e.target.value.trim() && store.getState().setMeta({ title: "Untitled carousel" })}
          aria-label="Carousel title"
          maxLength={300}
          className="h-9 max-w-72 min-w-0 flex-1 border-transparent bg-transparent text-sm font-semibold shadow-none hover:border-input focus-visible:border-ring"
        />
      )}

      <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
        <SelectTrigger size="sm" className="hidden w-32 md:flex" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROJECT_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="hidden max-w-56 lg:flex" aria-label="Publication date">
            <CalendarDays /> <span className="truncate">{formatSchedule(scheduledAt)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <ScheduleForm onDone={() => setScheduleOpen(false)} />
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-1">
        <SaveIndicator />
        <ThemeToggle />
        <FloatButton />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!canUndo} onClick={() => store.getState().undo()} aria-label="Undo">
              <Undo2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!canRedo} onClick={() => store.getState().redo()} aria-label="Redo">
              <Redo2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => store.getState().requestSave()}>
              <Save /> Save
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save now (Ctrl+S). Changes also save automatically.</TooltipContent>
        </Tooltip>
        <ExportMenu />
        <Button variant="ghost" size="icon" className="xl:hidden" onClick={onToggleRight} aria-label="Toggle properties panel">
          <PanelRight />
        </Button>
      </div>
    </header>
  )
}

function ScheduleForm({ onDone }: { onDone: () => void }) {
  const store = useEditorStore()
  const scheduledAt = useEditor((s) => s.project.scheduled_at)
  const status = useEditor((s) => s.project.status)
  const [date, setDate] = useState(toDateInput(scheduledAt))
  const [time, setTime] = useState(toTimeInput(scheduledAt))
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const iso = combineDateTime(date, time)
        if (!iso) return
        store.getState().setMeta({ scheduled_at: iso, ...(status === "draft" ? { status: "scheduled" as const } : {}) })
        onDone()
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ed-date" className="text-xs">
            Date
          </Label>
          <Input id="ed-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ed-time" className="text-xs">
            Time
          </Label>
          <Input id="ed-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Status never changes to Published automatically.</p>
      <div className="flex justify-between gap-2">
        {scheduledAt ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              store.getState().setMeta({ scheduled_at: null, ...(status === "scheduled" ? { status: "draft" as const } : {}) })
              onDone()
            }}
          >
            Remove date
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm">
          Set date
        </Button>
      </div>
    </form>
  )
}

function SaveIndicator() {
  const store = useEditorStore()
  const status = useEditor(saveStatusOf)
  const error = useEditor((s) => s.saveError)
  const lastSavedAt = useEditor((s) => s.lastSavedAt)

  if (status === "conflict") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
        <AlertTriangle className="size-3.5" /> Conflict
      </span>
    )
  }
  if (status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => store.getState().requestSave()}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <CloudOff className="size-3.5" /> Save failed · Retry
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{error} Your changes are kept on this computer and will be retried automatically.</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <span className="hidden items-center gap-1 px-1.5 text-xs text-muted-foreground sm:flex" role="status" aria-live="polite">
      {status === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" /> Saving…
        </>
      )}
      {status === "dirty" && (
        <>
          <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" /> Unsaved changes
        </>
      )}
      {status === "saved" && (
        <span title={lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : undefined} className="flex items-center gap-1">
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Saved
        </span>
      )}
    </span>
  )
}

/** Windows app only: a small always-on-top editor that pops up when you switch to another app. */
function FloatButton() {
  const available = useFloatAvailable()
  const on = useFloatMode()
  if (!available) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={on ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={on}
          className={on ? "text-primary" : undefined}
          onClick={() => {
            setFloatMode(!on)
            if (!on) {
              toast.success("Floating editor is on", {
                description: "Switch to Chrome, ChatGPT or any app and a small editor pops up so you can paste text and images. Come back here and it hides.",
              })
            }
          }}
        >
          <PictureInPicture2 /> <span className="hidden lg:inline">Float</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {on ? "Turn off the floating editor" : "Floating editor: edit this carousel's text and images from a small window on top of other apps"}
      </TooltipContent>
    </Tooltip>
  )
}

function ExportMenu() {
  const store = useEditorStore()
  const { runExport, busy } = useExport()
  const { backupLoaded } = useBackup()

  const backup = () => {
    const s = store.getState()
    void backupLoaded([toBackupProject({ ...s.project, archived_at: null }, s.slides.map((sl) => ({ slide_type: sl.type, design: sl.design })))])
  }

  const job = (kind: "single" | "zip" | "separate", format: ExportFormat) => {
    const s = store.getState()
    void runExport({
      meta: s.project,
      slides: s.slides.map((sl) => ({ type: sl.type, design: sl.design })),
      kind,
      format,
      slideIndex: s.slides.findIndex((sl) => sl.id === s.currentSlideId),
    })
  }

  const summary = async () => {
    try {
      const s = store.getState()
      const lib = await import("@/lib/export")
      const text = lib.buildProjectSummary(
        s.project,
        s.slides.map((sl) => ({ type: sl.type, design: sl.design })),
      )
      lib.downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${lib.exportBaseName(s.project)}-summary.txt`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />} Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Exact 1254 × 1254 px from the original photos. PNG is lossless (best); JPEG uses maximum quality.
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => job("single", "png")}>Current slide · PNG</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => job("single", "jpeg")}>Current slide · JPEG</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => job("zip", "png")}>All slides · ZIP of PNGs</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => job("zip", "jpeg")}>All slides · ZIP of JPEGs</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => job("separate", "png")}>All slides · separate PNG files</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void summary()}>
          <FileText /> Caption & slide list (.txt)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={backup}>
          <DatabaseBackup /> Backup · images + text (.zip)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ConflictBanner() {
  const store = useEditorStore()
  const conflict = useEditor((s) => s.conflict)
  const projectId = useEditor((s) => s.project.id)
  if (!conflict) return null
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-b bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="size-4" />
      <span className="flex-1">This carousel was changed in another window or tab, so your latest edits were not saved yet.</span>
      <Button
        size="sm"
        variant="outline"
        className="bg-card"
        onClick={() => {
          clearBackup(projectId)
          window.location.reload()
        }}
      >
        Load the other version
      </Button>
      <Button
        size="sm"
        onClick={async () => {
          try {
            const latest = await getProject(projectId)
            store.getState().resolveConflictKeepMine(latest.revision)
            store.getState().requestSave()
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      >
        Keep my version
      </Button>
    </div>
  )
}
