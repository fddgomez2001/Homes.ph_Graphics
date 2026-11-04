"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ExportFormat } from "@/lib/design/render"
import { CANVAS_SIZE } from "@/lib/design/types"
import { getDesktop } from "@/lib/desktop"
import { IS_MOBILE_APP } from "@/lib/env"
import type { ExportProjectMeta, ExportSlide, RenderedSlide } from "@/lib/export"
import { errorMessage } from "@/lib/utils"

export interface ExportJob {
  meta: ExportProjectMeta
  slides: ExportSlide[]
  /** single = one slide (slideIndex), zip = all slides in one ZIP, separate = one download per slide */
  kind: "single" | "zip" | "separate"
  format: ExportFormat
  jpegQuality?: number
  slideIndex?: number
  /** false = skip the "fix before export" warnings (the website can't edit slides). */
  checks?: boolean
  /** Name for a single exported image (e.g. "2026-11-01 9AM PicklePlay PH.png"); slides are numbered otherwise. */
  fileName?: string
  /** Phone app: open the share sheet (Facebook, Messenger…) instead of saving to the gallery. */
  share?: boolean
}

type Phase = { size: string } & (
  | { name: "idle" }
  | { name: "preparing"; title: string }
  | { name: "confirm"; title: string; warnings: { slide: number; message: string }[] }
  | { name: "running"; title: string; done: number; total: number }
  | { name: "failed"; title: string; failures: { slide: number; message: string }[]; partial: RenderedSlide[]; job: ExportJob }
)

interface ExportContextValue {
  runExport: (job: ExportJob) => Promise<boolean>
  busy: boolean
}

const ExportContext = createContext<ExportContextValue | null>(null)

export function ExportProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ name: "idle", size: `${CANVAS_SIZE} × ${CANVAS_SIZE}` })
  const decision = useRef<((go: boolean) => void) | null>(null)

  const runExport = useCallback(async (job: ExportJob) => {
    const lib = await import("@/lib/export")
    const { ensureFonts } = await import("@/lib/design/fonts")
    const targets = job.kind === "single" ? [job.slides[job.slideIndex ?? 0]] : job.slides
    const indexOffset = job.kind === "single" ? (job.slideIndex ?? 0) : 0
    // Carousels are 1254 × 1254; news articles have their template's size (e.g. 1152 × 1408).
    const size = targets[0] ? `${targets[0].design.width} × ${targets[0].design.height}` : `${CANVAS_SIZE} × ${CANVAS_SIZE}`
    const title =
      job.kind === "single"
        ? `Exporting slide ${indexOffset + 1} as ${job.format.toUpperCase()}`
        : `Exporting ${targets.length} slides as ${job.format.toUpperCase()}`
    try {
      setPhase({ name: "preparing", title, size })
      await ensureFonts(targets.map((s) => s.design))

      const warnings = job.checks === false ? [] : lib.exportWarnings(targets).map((w) => ({ ...w, slide: w.slide + indexOffset }))
      if (warnings.length) {
        setPhase({ name: "confirm", title, warnings, size })
        const go = await new Promise<boolean>((resolve) => {
          decision.current = resolve
        })
        decision.current = null
        if (!go) {
          setPhase({ name: "idle", size })
          return false
        }
      }

      setPhase({ name: "running", title, done: 0, total: targets.length, size })
      const { files, failures } = await lib.renderSlides(job.meta, targets, job.format, job.jpegQuality ?? 1, (p) =>
        setPhase({ name: "running", title, done: p.done, total: p.total, size }),
      )
      // Keep file names numbered by their real position in the carousel (the cover is 1).
      const named = files.map((f) => ({ ...f, name: job.kind === "single" && job.fileName ? job.fileName : lib.slideFileName(f.index + indexOffset, job.format) }))
      const realFailures = failures.map((f) => ({ ...f, slide: f.slide + indexOffset }))

      if (realFailures.length) {
        setPhase({ name: "failed", title, failures: realFailures, partial: named, job, size })
        return false
      }
      // The share sheet opens on top: close this dialog first.
      if (job.share) setPhase({ name: "idle", size })
      const where = await deliver(job, named)
      setPhase({ name: "idle", size })
      if (!job.share) {
        toast.success(job.kind === "single" ? `Slide exported (${size} px)` : `${named.length} slides exported (${size} px each)`, {
          description: where,
        })
      }
      return true
    } catch (error) {
      setPhase({ name: "failed", title, failures: [{ slide: 0, message: errorMessage(error) }], partial: [], job, size })
      return false
    }
  }, [])

  const close = () => {
    decision.current?.(false)
    setPhase((p) => ({ name: "idle", size: p.size }))
  }

  return (
    <ExportContext.Provider value={{ runExport, busy: phase.name !== "idle" }}>
      {children}
      <Dialog open={phase.name !== "idle"} onOpenChange={(open) => !open && phase.name !== "running" && close()}>
        <DialogContent className="sm:max-w-md" showCloseButton={phase.name !== "running" && phase.name !== "preparing"}>
          {phase.name !== "idle" && (
            <DialogHeader>
              <DialogTitle>{phase.title}</DialogTitle>
              <DialogDescription>
                Every image is rendered at exactly {phase.size} px from the original photos, numbered in order (1 = cover).
              </DialogDescription>
            </DialogHeader>
          )}

          {phase.name === "preparing" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading fonts and full-resolution images…
            </p>
          )}

          {phase.name === "running" && (
            <div className="flex flex-col gap-2" role="status" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.round((phase.done / Math.max(1, phase.total)) * 100)}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Rendering slide {Math.min(phase.done + 1, phase.total)} of {phase.total}…
              </p>
            </div>
          )}

          {phase.name === "confirm" && (
            <>
              <div className="flex gap-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <ul className="flex flex-col gap-1.5">
                  {phase.warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-medium">Slide {w.slide}:</span> {w.message}
                    </li>
                  ))}
                </ul>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => decision.current?.(false)}>
                  Go back and fix
                </Button>
                <Button onClick={() => decision.current?.(true)}>Export anyway</Button>
              </DialogFooter>
            </>
          )}

          {phase.name === "failed" && (
            <>
              <div className="flex gap-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <ul className="flex flex-col gap-1.5">
                  {phase.failures.map((f, i) => (
                    <li key={i}>
                      {f.slide > 0 && <span className="font-medium">Slide {f.slide}: </span>}
                      {f.message}
                    </li>
                  ))}
                </ul>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Close
                </Button>
                {phase.partial.length > 0 && (
                  <Button
                    onClick={async () => {
                      await deliver(phase.job, phase.partial)
                      close()
                    }}
                  >
                    <CheckCircle2 /> Download the {phase.partial.length} slide{phase.partial.length === 1 ? "" : "s"} that worked
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ExportContext.Provider>
  )
}

/** Downloads the files; returns where they went when that's worth saying. */
async function deliver(job: ExportJob, files: RenderedSlide[]): Promise<string | undefined> {
  const lib = await import("@/lib/export")
  // Phone app: no ZIPs or downloads folder — straight to the gallery (or the share sheet).
  if (IS_MOBILE_APP) {
    const native = await import("@/lib/native")
    if (job.share) return void (await native.shareFiles(files, job.meta.title))
    const where = await native.saveToGallery(files, files.length > 1 ? lib.exportBaseName(job.meta) : undefined)
    return files.length > 1 ? `Saved to ${where}. 1 is the cover.` : `Saved to ${where}.`
  }
  if (job.kind === "zip") {
    const zip = await lib.buildZip(job.meta, files, job.slides)
    lib.downloadBlob(zip, `${lib.exportBaseName(job.meta)}.zip`)
    return "Inside the ZIP: 1.png is the cover, then 2.png, 3.png…"
  }
  // Desktop app: separate files go into their own folder (Downloads\<carousel>\1.png, 2.png…).
  const folder = job.kind === "separate" && files.length > 1 ? getDesktop()?.exportFolder : undefined
  const name = lib.exportBaseName(job.meta)
  if (folder) await folder(name, files.length).catch(() => {})
  for (const file of files) {
    lib.downloadBlob(file.blob, file.name)
    // Browsers may drop rapid consecutive downloads.
    if (files.length > 1) await new Promise((r) => setTimeout(r, 350))
  }
  return folder ? `Saved in Downloads\\${name}` : undefined
}

export function useExport(): ExportContextValue {
  const ctx = useContext(ExportContext)
  if (!ctx) throw new Error("useExport must be used inside <ExportProvider>")
  return ctx
}
