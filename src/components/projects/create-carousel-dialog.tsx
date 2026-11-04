"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { format, startOfDay } from "date-fns"
import { CalendarDays, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MiniCalendar } from "@/components/ui/mini-calendar"
import { LivePreview } from "./live-preview"
import { Textarea } from "@/components/ui/textarea"
import { createProject } from "@/lib/data/projects"
import { getTemplateContext } from "@/lib/data/settings"
import { combineDateTime, DEFAULT_PUBLISH_TIME, nextFreeDay, toDateInput } from "@/lib/dates"
import { mergeTitle } from "@/lib/design/cover-title"
import { buildCoverDesign, DEFAULT_TEMPLATE_CONTEXT, type TemplateContext } from "@/lib/design/templates"
import { cn, errorMessage } from "@/lib/utils"
import { useProjects } from "./use-projects"

interface OpenOptions {
  date?: Date | null
}

const CreateContext = createContext<((options?: OpenOptions) => void) | null>(null)

export function CreateCarouselProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [initialDate, setInitialDate] = useState<Date | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [wide, setWide] = useState(false)

  const openDialog = useCallback((options?: OpenOptions) => {
    setInitialDate(options?.date ?? null)
    setFormKey((k) => k + 1)
    setWide(false)
    setOpen(true)
  }, [])

  return (
    <CreateContext.Provider value={openDialog}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 transition-[max-width] duration-500 ease-out",
            wide ? "sm:max-w-[min(72rem,calc(100vw-2rem))]" : "sm:max-w-3xl",
          )}
        >
          <CreateForm key={formKey} initialDate={initialDate} onDone={() => setOpen(false)} onPreview={setWide} />
        </DialogContent>
      </Dialog>
    </CreateContext.Provider>
  )
}

export function useCreateCarousel() {
  const open = useContext(CreateContext)
  if (!open) throw new Error("useCreateCarousel must be used inside <CreateCarouselProvider>")
  return open
}

function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {children}
      </Label>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[13px] text-destructive">
      {children}
    </p>
  )
}

function CreateForm({ initialDate, onDone, onPreview }: { initialDate: Date | null; onDone: () => void; onPreview: (shown: boolean) => void }) {
  const router = useRouter()
  const [line1, setLine1] = useState("")
  const [line2, setLine2] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [caption, setCaption] = useState("")
  // One carousel a day: unless a date was picked (e.g. from the calendar), start
  // on the first day that has no carousel yet, at 11:00 PM.
  const { projects } = useProjects({ orderBy: "scheduled_at", ascending: true, limit: 500 })
  const [picked, setPicked] = useState<Date | null>(() => (initialDate ? startOfDay(initialDate) : null))
  const suggested = useMemo(() => nextFreeDay(projects.map((p) => p.scheduled_at)), [projects])
  const day = picked ?? suggested
  const sameDay = projects.filter((p) => p.scheduled_at && toDateInput(p.scheduled_at) === toDateInput(day))
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = mergeTitle(line1, line2)
  const typed = !!(line1.trim() || line2.trim() || subtitle.trim())
  const [ctx, setCtx] = useState<TemplateContext | null>(null)
  useEffect(() => {
    getTemplateContext().then(setCtx, () => setCtx(DEFAULT_TEMPLATE_CONTEXT))
  }, [])
  useEffect(() => onPreview(typed), [typed, onPreview])
  const previewDesign = useMemo(
    () => (typed && ctx ? buildCoverDesign(ctx, { white: line1.trim(), yellow: line2.trim(), description: subtitle.trim() }) : null),
    [typed, ctx, line1, line2, subtitle],
  )
  const missingLine1 = !line1.trim()
  const missingCaption = !caption.trim()

  async function submit() {
    setSubmitted(true)
    if (missingLine1 || missingCaption) return
    setBusy(true)
    setError(null)
    try {
      const ctx = await getTemplateContext()
      // Fit the title lines exactly as the editor will (real fonts), before saving.
      const { prepareDesign } = await import("@/lib/design/prepare")
      const cover = await prepareDesign(buildCoverDesign(ctx, { white: line1.trim(), yellow: line2.trim(), description: subtitle.trim() }))
      const scheduledAt = combineDateTime(toDateInput(day), DEFAULT_PUBLISH_TIME)
      const id = await createProject({ title, caption: caption.trim(), scheduledAt, status: "scheduled" }, cover)
      onDone()
      router.push(`/editor/${id}`)
    } catch (e) {
      setError(errorMessage(e))
      toast.error("Could not create the carousel")
    } finally {
      setBusy(false)
    }
  }

  const inputClass = "h-10 bg-card text-[15px]"

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      noValidate
      className="flex flex-col text-foreground"
    >
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-semibold tracking-tight">Create a new carousel</DialogTitle>
        <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
          Write the cover title, pick the publication date and add the caption. You&apos;ll add the content cards in the editor.
        </DialogDescription>
      </DialogHeader>

      <div className={cn("grid gap-6 px-6 py-5", typed ? "md:grid-cols-[minmax(0,1fr)_19rem] lg:grid-cols-[minmax(0,1fr)_19rem_minmax(0,22rem)]" : "md:grid-cols-[minmax(0,1fr)_19rem]")}>
        <section className="flex flex-col gap-4" aria-labelledby="cc-cover-heading">
          <h3 id="cc-cover-heading" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Cover title
          </h3>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="cc-line1" hint="White · required">
              Headline line 1
            </FieldLabel>
            <Input
              id="cc-line1"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="Type the first line"
              maxLength={200}
              autoFocus
              aria-invalid={submitted && missingLine1}
              className={inputClass}
            />
            {submitted && missingLine1 && <FieldError>Type the first line of the cover title.</FieldError>}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="cc-line2" hint="Gold · optional">
              Headline line 2
            </FieldLabel>
            <Input id="cc-line2" value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Type the second line" maxLength={200} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="cc-subtitle" hint="Optional">
              Subtitle
            </FieldLabel>
            <Input
              id="cc-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="One short line under the headline"
              maxLength={300}
              className={inputClass}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Each line shrinks automatically to fit on one line of the cover.</p>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="cc-date-heading">
          <h3 id="cc-date-heading" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Publication date
          </h3>
          <div className="rounded-lg border border-border p-3">
            <MiniCalendar value={day} onChange={setPicked} />
          </div>
          <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <CalendarDays className="size-4 text-primary" />
            Publishes on <span className="font-semibold">{format(new Date(combineDateTime(toDateInput(day), DEFAULT_PUBLISH_TIME)!), "EEE, MMMM d · h:mm a")}</span>
          </p>
          {sameDay.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
              This day already has “{sameDay[0].title}”{sameDay.length > 1 ? ` and ${sameDay.length - 1} more` : ""}.
            </p>
          ) : (
            !picked && (
              <p className="text-xs text-muted-foreground" role="status">
                The next day without a carousel.
              </p>
            )
          )}
        </section>

        {typed && previewDesign && (
          <section className="flex flex-col gap-3 md:col-span-2 lg:col-span-1 lg:row-span-2" aria-labelledby="cc-preview-heading">
            <h3 id="cc-preview-heading" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Cover preview
            </h3>
            <LivePreview design={previewDesign} label="Cover preview" className="mx-auto w-full max-w-sm" />
            {title && (
              <p className="text-center text-xs text-muted-foreground">
                Title: <span className="font-medium text-slate-700 dark:text-slate-200">{title}</span>
              </p>
            )}
          </section>
        )}

        <section className="flex flex-col gap-1.5 md:col-span-2">
          <FieldLabel htmlFor="cc-caption" hint={`Required · ${caption.length.toLocaleString()} characters`}>
            Caption
          </FieldLabel>
          <Textarea
            id="cc-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="Write the Facebook caption for this carousel"
            aria-invalid={submitted && missingCaption}
            className="min-h-24 bg-card text-[15px] leading-relaxed"
          />
          {submitted && missingCaption ? (
            <FieldError>Every carousel needs a caption. Write it now — you can edit it later.</FieldError>
          ) : (
            <p className="text-xs text-muted-foreground">Shown with the post on Facebook. Kept separate from the slides.</p>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive md:col-span-2">
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="mx-0 mb-0 border-t bg-slate-50/80 dark:bg-white/[0.03] px-6 py-4">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Create carousel
        </Button>
      </DialogFooter>
    </form>
  )
}
