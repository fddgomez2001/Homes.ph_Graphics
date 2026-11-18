"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { format, startOfDay } from "date-fns"
import { AlertTriangle, CalendarDays, Check, ChevronDown, Lightbulb, Link2, Loader2, Minus, Plus, Search, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MiniCalendar } from "@/components/ui/mini-calendar"
import { LivePreview } from "./live-preview"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { articleForAi, isLink } from "@/lib/ai/article-extract"
import type { CarouselDraftCard } from "@/lib/ai/carousel-draft"
import { posterAiLabel, readArticleLink, researchCarouselTopic, suggestCarouselDraft, suggestCarouselTopics } from "@/lib/ai/client"
import {
  buildHistory,
  featuredBefore,
  locationIssue,
  researchNotes,
  similarTopic,
  type CarouselHistory,
  type ResearchResult,
  type TopicIdea,
} from "@/lib/ai/carousel-research"
import { ARTICLE_MAX, CAROUSEL_CARDS } from "@/lib/ai/validate"
import { fitCardDescriptions, saveCarouselCards } from "@/lib/carousel-from-article"
import { createProject, listSlideTitles, updateProject } from "@/lib/data/projects"
import { getTemplateContext } from "@/lib/data/settings"
import { combineDateTime, DEFAULT_PUBLISH_TIME, nextFreeDay, planPriorityInsert, toDateInput } from "@/lib/dates"
import { mergeTitle } from "@/lib/design/cover-title"
import { buildCoverDesign, CAROUSEL_BRANDS, DEFAULT_TEMPLATE_CONTEXT, isHomesLook, type CarouselBrand, type TemplateContext } from "@/lib/design/templates"
import type { ProjectRow } from "@/lib/types"
import { cn, errorMessage } from "@/lib/utils"
import { useWebSearchEngine } from "@/components/posters/use-web-search"
import { searchEngineName, type AiSearchInfo } from "@/lib/ai/types"
import { useCarouselBrands } from "./use-carousel-brands"
import { useProjects } from "./use-projects"
import { SourceLink, SourceLinks } from "@/components/ai/source-links"

interface OpenOptions {
  date?: Date | null
  /** Whose carousel to start with (Homes.ph unless the page says otherwise). */
  brand?: CarouselBrand | null
  /** Start "Make it with AI" from this article: its link, or its text (Trending news → Carousel). */
  article?: StartArticle | null
}

/** An article to start the AI carousel from: read from its link, or the text itself. */
type StartArticle = { link?: string; text?: string }

const CreateContext = createContext<((options?: OpenOptions) => void) | null>(null)

export function CreateCarouselProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [initialDate, setInitialDate] = useState<Date | null>(null)
  const [initialBrand, setInitialBrand] = useState<CarouselBrand | null>(null)
  const [initialArticle, setInitialArticle] = useState<StartArticle | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [wide, setWide] = useState(false)

  const openDialog = useCallback((options?: OpenOptions) => {
    setInitialDate(options?.date ?? null)
    setInitialBrand(options?.brand ?? null)
    setInitialArticle(options?.article ?? null)
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
          <CreateForm key={formKey} initialDate={initialDate} initialBrand={initialBrand} initialArticle={initialArticle} onDone={() => setOpen(false)} onPreview={setWide} />
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

function CreateForm({
  initialDate,
  initialBrand,
  initialArticle,
  onDone,
  onPreview,
}: {
  initialDate: Date | null
  initialBrand: CarouselBrand | null
  initialArticle: StartArticle | null
  onDone: () => void
  onPreview: (shown: boolean) => void
}) {
  const router = useRouter()
  const [line1, setLine1] = useState("")
  const [line2, setLine2] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [caption, setCaption] = useState("")
  // Whose carousel: Homes.ph (default), FHI Global Property or PicklePlay.
  const [brand, setBrand] = useState<CarouselBrand>(initialBrand ?? "homes")
  // One carousel a day per brand: unless a date was picked (e.g. from the calendar), start
  // on the first day that brand has no carousel yet, at 11:00 PM.
  const { projects: allProjects } = useProjects({ orderBy: "scheduled_at", ascending: true, limit: 500 })
  const brands = useCarouselBrands(allProjects)
  const projects = useMemo(() => allProjects.filter((p) => brands.brandOf(p.id) === brand), [allProjects, brands, brand])
  // What the brand's earlier carousels featured: no repeated topics or places.
  const history = useCarouselHistory(projects)
  const [picked, setPicked] = useState<Date | null>(() => (initialDate ? startOfDay(initialDate) : null))
  const suggested = useMemo(() => nextFreeDay(projects.map((p) => p.scheduled_at)), [projects])
  const day = picked ?? suggested
  const sameDay = projects.filter((p) => p.scheduled_at && toDateInput(p.scheduled_at) === toDateInput(day))
  // Priority: the day is taken → this carousel gets it, the others move one day later (until a free day).
  const [priority, setPriority] = useState(true)
  const moves = useMemo(() => planPriorityInsert(projects, day), [projects, day])
  // Content cards written by AI from an article (empty: the cards are added in the editor).
  const [cards, setCards] = useState<CarouselDraftCard[]>([])
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
    () => (typed && ctx ? buildCoverDesign(ctx, { white: line1.trim(), yellow: line2.trim(), description: subtitle.trim() }, brand) : null),
    [typed, ctx, line1, line2, subtitle, brand],
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
      const cover = await prepareDesign(buildCoverDesign(ctx, { white: line1.trim(), yellow: line2.trim(), description: subtitle.trim() }, brand))
      const scheduledAt = combineDateTime(toDateInput(day), DEFAULT_PUBLISH_TIME)
      const id = await createProject({ title, caption: caption.trim(), scheduledAt, status: "scheduled" }, cover)
      const kept = cards.filter((c) => c.title.trim())
      if (kept.length) await saveCarouselCards(id, kept, brand)
      // Priority: the carousels already on this day (and the next ones, up to a free day) move one day later.
      const moved = priority ? moves : []
      for (const m of [...moved].reverse()) await updateProject(m.id, { scheduled_at: m.to })
      if (moved.length)
        toast.success(`${moved.length} carousel${moved.length === 1 ? "" : "s"} moved one day later`, {
          description: moved.map((m) => `${m.title} → ${format(new Date(m.to), "EEE, MMM d")}`).join(" · "),
        })
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
          Write the cover title, pick the publication date and add the caption, or let AI make it all: search a topic on the web, or use an article. {cards.length ? "The cards are added too; put their photos in the editor." : "You'll add the content cards in the editor."}
        </DialogDescription>
      </DialogHeader>

      <div className={cn("grid gap-6 px-6 py-5", typed ? "md:grid-cols-[minmax(0,1fr)_19rem] lg:grid-cols-[minmax(0,1fr)_19rem_minmax(0,22rem)]" : "md:grid-cols-[minmax(0,1fr)_19rem]")}>
        <BrandPicker className={typed ? "md:col-span-2 lg:col-span-3" : "md:col-span-2"} value={brand} onChange={setBrand} />
        <ArticleToCarousel
          initial={initialArticle}
          brand={brand}
          className={typed ? "md:col-span-2 lg:col-span-3" : "md:col-span-2"}
          hasDraft={cards.length > 0}
          history={history}
          onDraft={(draft) => {
            setLine1(draft.line1)
            setLine2(draft.line2)
            setSubtitle(draft.subtitle)
            if (draft.caption) setCaption(draft.caption)
            setCards(draft.cards)
          }}
          onCards={setCards}
        />

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
            <FieldLabel htmlFor="cc-line2" hint={`${brand === "pickleplay" ? "Lime" : "Gold"} · optional`}>
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
          {moves.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5" role="group" aria-label="Priority">
              <label className="flex items-start gap-2.5 text-[13px] leading-snug">
                <Switch checked={priority} onCheckedChange={setPriority} className="mt-0.5" aria-label="Priority: move the others one day later" />
                <span>
                  <span className="font-semibold">Priority</span>: this carousel takes {format(day, "EEE, MMM d")}; the ones already scheduled move one day later.
                </span>
              </label>
              {priority ? (
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground" aria-label="Carousels that move">
                  {moves.map((m) => (
                    <li key={m.id} className="truncate">
                      “{m.title}” → <span className="font-medium text-foreground">{format(new Date(m.to), "EEE, MMM d")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
                  This day already has “{sameDay[0]?.title ?? moves[0].title}”{sameDay.length > 1 ? ` and ${sameDay.length - 1} more` : ""}: both will be on it.
                </p>
              )}
            </div>
          ) : sameDay.length > 0 ? (
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

        {cards.length > 0 && <CardsEditor cards={cards} onChange={setCards} history={history} />}

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

/** Whose carousel it is: the Homes.ph template (Homes.ph or Homes.ph Gensan), or the same layout in FHI's or PicklePlay's colors. */
function BrandPicker({ className, value, onChange }: { className?: string; value: CarouselBrand; onChange: (brand: CarouselBrand) => void }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Brand</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Brand">
        {CAROUSEL_BRANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={value === b.id}
            onClick={() => onChange(b.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left text-sm transition",
              value === b.id ? "border-transparent ring-2 ring-primary" : "hover:border-foreground/30",
            )}
            style={value === b.id ? { boxShadow: `inset 4px 0 0 ${b.accent}` } : undefined}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md p-1" style={{ background: isHomesLook(b.id) ? "#FFFFFF" : b.dark }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logo} alt="" className="size-full object-contain" draggable={false} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{b.name}</span>
              <span className="block text-[11px] text-muted-foreground">{b.id === "homes" ? "Default template" : b.id === "gensan" ? "Homes.ph, GenSan topics" : "Same layout, brand colors"}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** "Nov 7" */
const shortDate = (iso: string | null) => (iso ? ` (${format(new Date(iso), "MMM d")})` : "")

/**
 * What the recent carousels (up to 200) featured: their topics and their cards' places, loaded once
 * from the slides' saved titles. null while loading (or when it couldn't be read: then there's no
 * repeat check).
 */
function useCarouselHistory(projects: ProjectRow[]): CarouselHistory | null {
  const recent = useMemo(() => projects.filter((p) => p.scheduled_at).slice(-200), [projects])
  const key = `${recent.length}:${recent[0]?.id ?? ""}:${recent.at(-1)?.id ?? ""}`
  const [history, setHistory] = useState<{ key: string; value: CarouselHistory } | null>(null)
  useEffect(() => {
    if (!recent.length || history?.key === key) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listSlideTitles(recent.map((p) => p.id))
        if (!cancelled) setHistory({ key, value: buildHistory(recent, rows) })
      } catch {
        // No history: the AI still works, without the repeat check.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, recent, history?.key])
  return history?.value ?? null
}

/** The places of the most recent carousels (newest first, no repeats): the AI must not pick them again. */
function recentPlaces(history: CarouselHistory, max: number): string[] {
  const names: string[] = []
  for (const p of [...history.places].reverse()) {
    if (!names.some((n) => n.toLowerCase() === p.name.toLowerCase())) names.push(p.name)
    if (names.length >= max) break
  }
  return names
}

type Mode = "search" | "paste" | "link"
type Busy = "ideas" | "searching" | "reading" | "writing" | "fitting" | null

const BUSY_LABEL: Record<Exclude<Busy, null>, string> = {
  ideas: "Thinking of topics…",
  searching: "Searching the web…",
  reading: "Reading the page…",
  writing: "Writing the carousel…",
  fitting: "Fitting the descriptions…",
}

/**
 * Create New Carousel with AI: search a topic on the web (the places found are listed with their
 * sources to check first), or paste an article or its link. Then the AI writes the cover
 * (Headline 1, Headline 2, subtitle), the caption and every card. Topics and places that earlier
 * carousels already featured are flagged and left out.
 */
function ArticleToCarousel({
  initial,
  className,
  brand,
  hasDraft,
  history,
  onDraft,
  onCards,
}: {
  initial?: StartArticle | null
  className?: string
  brand: CarouselBrand
  hasDraft: boolean
  history: CarouselHistory | null
  onDraft: (draft: { line1: string; line2: string; subtitle: string; caption: string; cards: CarouselDraftCard[] }) => void
  onCards: (cards: CarouselDraftCard[]) => void
}) {
  // Opened from Trending news → Carousel: the story's link (or text) is ready to write from.
  const [open, setOpen] = useState(!!(initial?.link || initial?.text))
  const [mode, setMode] = useState<Mode>(initial?.link ? "link" : initial?.text ? "paste" : "search")
  const [topic, setTopic] = useState("")
  const [ideas, setIdeas] = useState<TopicIdea[]>([])
  const [research, setResearch] = useState<(ResearchResult & { search?: AiSearchInfo }) | null>(null)
  const searchEngine = useWebSearchEngine()
  const [picked, setPicked] = useState<boolean[]>([])
  const [article, setArticle] = useState(initial?.link ? "" : (initial?.text ?? ""))
  const [link, setLink] = useState(initial?.link ?? "")
  const [count, setCount] = useState<number>(CAROUSEL_CARDS.default)
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const using = open ? posterAiLabel() : ""
  const repeatTopic = history && topic.trim().length > 5 ? similarTopic(topic, history.topics) : null
  const pickedCount = picked.filter(Boolean).length

  /** The AI writes the carousel from these facts; descriptions longer than 3 lines are written again, shorter. */
  const makeFrom = async (text: string, cards: number) => {
    setBusy("writing")
    const { fellBack, ...draft } = await suggestCarouselDraft(text, cards, brand)
    onDraft(draft)
    setBusy("fitting")
    const ctx = await getTemplateContext().catch(() => DEFAULT_TEMPLATE_CONTEXT)
    const cover = buildCoverDesign(ctx, { white: draft.line1, yellow: draft.line2, description: draft.subtitle }, brand)
    const fitted = await fitCardDescriptions(cover, draft.cards, brand)
    if (fitted.shortened) onCards(fitted.cards)
    const repeats = history ? draft.cards.filter((c) => featuredBefore(c.title, history.places)).length : 0
    const notes = [
      draft.cards.length < cards ? `There were ${draft.cards.length} items to show, so the carousel has ${draft.cards.length} cards.` : "",
      repeats ? `${repeats} card${repeats === 1 ? " was" : "s were"} featured in an earlier carousel (marked below).` : "",
      fellBack ? `Written by the built-in AI (${fellBack}).` : "",
    ].filter(Boolean)
    setNote(notes.join(" ") || null)
    toast.success("Carousel written", { description: `Cover, caption and ${draft.cards.length} cards. Check them, then Create carousel.` })
  }

  const run = async (job: () => Promise<void>) => {
    setError(null)
    setNote(null)
    try {
      await job()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const suggest = () =>
    run(async () => {
      setBusy("ideas")
      const avoid = history ? history.topics.slice(-80).map((t) => (t.subtitle ? `${t.title} (${t.subtitle})` : t.title)) : []
      const list = await suggestCarouselTopics(format(new Date(), "MMMM yyyy"), avoid, 6, brand)
      // An idea close to a topic already done is left out.
      const fresh = history ? list.filter((i) => !similarTopic(i.topic, history.topics)) : list
      setIdeas(fresh.length ? fresh : list)
    })

  const search = () =>
    run(async () => {
      if (topic.trim().length < 3) throw new Error("Type a topic first, or pick a suggested one.")
      setResearch(null)
      setBusy("searching")
      const result = await researchCarouselTopic(topic.trim(), count, history ? recentPlaces(history, 150) : [], brand)
      setResearch(result)
      // Places featured before, with a source the search didn't really open, or a location that looks wrong start unticked.
      const ok = result.items.map((it) => it.verified && !locationIssue(it.location) && !(history && featuredBefore(it.name, history.places)))
      setPicked(ok)
      const off = ok.filter((x) => !x).length
      if (off) setNote(`${off} place${off === 1 ? " is" : "s are"} unticked: featured before, a source that couldn't be confirmed, or a location to check. Tick it if you still want it.`)
    })

  const make = () =>
    run(async () => {
      if (!research) return
      const items = research.items.filter((_, i) => picked[i])
      if (!items.length) throw new Error("Tick at least one place.")
      await makeFrom(researchNotes(research.topic || topic.trim(), items), items.length)
    })

  const write = () =>
    run(async () => {
      let text = article.trim()
      const url = mode === "link" ? link.trim() : isLink(text) ? text : ""
      if (url) {
        setBusy("reading")
        const found = await readArticleLink(url)
        text = articleForAi(found).slice(0, ARTICLE_MAX)
        setArticle(text)
        setMode("paste")
      }
      if (text.length < 60) throw new Error(mode === "link" ? "Paste the article's link first." : "Paste the whole article first (at least a few sentences).")
      await makeFrom(text, count)
    })

  if (!open)
    return (
      <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border border-violet-400/30 bg-violet-500/5 px-3 py-2.5", className)}>
        <Sparkles className="size-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Make it with AI.</span>{" "}
          <span className="text-muted-foreground">Search a topic on the web, or paste an article or its link: AI writes the cover, caption and every card.</span>
        </p>
        <Button type="button" variant="outline" size="sm" className="border-violet-400/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300" onClick={() => setOpen(true)}>
          <Sparkles /> {hasDraft ? "Write again" : "Use AI"}
        </Button>
      </div>
    )

  return (
    <section className={cn("flex flex-col gap-3 rounded-lg border border-violet-400/30 bg-violet-500/5 p-3", className)} aria-label="Make the carousel with AI">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
        <h3 className="flex-1 text-sm font-semibold">Make it with AI</h3>
        <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Make it from">
          {(
            [
              ["search", "Search a topic"],
              ["paste", "Paste the article"],
              ["link", "From a link"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium", mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Hide" onClick={() => setOpen(false)}>
          <ChevronDown className="rotate-180" />
        </Button>
      </div>

      {mode === "search" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              id="cc-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 200))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void search()
                }
              }}
              placeholder="e.g. Top Restaurants In Cebu City 2026 For Filipino Cuisine, or Top 2 Resorts Each In Luzon, Visayas And Mindanao"
              className="h-9 bg-card"
              aria-label="Topic"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void suggest()} disabled={!!busy} title="Topic ideas for this month that you haven't done yet">
              {busy === "ideas" ? <Loader2 className="animate-spin" /> : <Lightbulb />} Suggest topics
            </Button>
          </div>
          {repeatTopic && (
            <p role="status" className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Close to a carousel you already made: “{repeatTopic.title}”{shortDate(repeatTopic.date)}. Try another place or angle.
            </p>
          )}
          {ideas.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Suggested topics">
              {ideas.map((idea) => (
                <li key={idea.topic}>
                  <button
                    type="button"
                    onClick={() => {
                      setTopic(idea.topic)
                      setResearch(null)
                    }}
                    title={idea.why}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-left text-xs transition hover:border-violet-400/60 hover:bg-violet-500/10",
                      topic === idea.topic ? "border-violet-500 bg-violet-500/15 font-medium" : "bg-card",
                    )}
                  >
                    {idea.topic}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : mode === "paste" ? (
        <Textarea
          id="cc-article"
          value={article}
          onChange={(e) => setArticle(e.target.value.slice(0, ARTICLE_MAX))}
          rows={5}
          placeholder="Paste the whole article here (or its link). The AI uses only what it says: names, places, prices and dates."
          className="min-h-28 bg-card text-[13px] leading-relaxed"
          aria-label="Article"
        />
      ) : (
        <div className="flex items-center gap-2">
          <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input id="cc-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… (the article's web address)" className="h-9 bg-card" aria-label="Article link" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm" role="group" aria-label="Number of cards">
          <span className="text-muted-foreground">Cards</span>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Fewer cards" onClick={() => setCount((n) => Math.max(CAROUSEL_CARDS.min, n - 1))} disabled={count <= CAROUSEL_CARDS.min}>
            <Minus />
          </Button>
          <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite" id="cc-card-count">
            {count}
          </span>
          <Button type="button" variant="outline" size="icon-sm" aria-label="More cards" onClick={() => setCount((n) => Math.min(CAROUSEL_CARDS.max, n + 1))} disabled={count >= CAROUSEL_CARDS.max}>
            <Plus />
          </Button>
        </div>
        {mode === "search" ? (
          <Button type="button" onClick={() => void search()} disabled={!!busy} className="bg-violet-600 text-white hover:bg-violet-700">
            {busy === "searching" ? <Loader2 className="animate-spin" /> : <Search />} {busy === "searching" ? BUSY_LABEL.searching : research ? "Search again" : "Search the web"}
          </Button>
        ) : (
          <Button type="button" onClick={() => void write()} disabled={!!busy} className="bg-violet-600 text-white hover:bg-violet-700">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy && busy !== "ideas" ? BUSY_LABEL[busy] : hasDraft ? "Write again" : "Write the carousel"}
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          AI: {mode === "search" ? (searchEngine === "tavily" || searchEngine === "perplexity" ? `${searchEngineName(searchEngine)} search + ${using}` : searchEngine ? searchEngineName(searchEngine) : "no web search yet (Settings → AI)") : using}
        </span>
      </div>

      {mode === "search" && research && (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-2.5" aria-label="Places found">
          <p className="text-xs text-muted-foreground">
            Found {research.items.length} place{research.items.length === 1 ? "" : "s"} on {research.sources.length} web page{research.sources.length === 1 ? "" : "s"}
            {research.search ? ` (${searchEngineName(research.search.engine)})` : ""}. Check them (open the sources), untick any you don&apos;t want, then make the
            carousel.
          </p>
          {research.search?.note && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              {research.search.note} {searchEngineName(research.search.engine)} searched instead.
            </p>
          )}
          <ol className="flex flex-col gap-1.5">
            {research.items.map((it, i) => {
              const before = history ? featuredBefore(it.name, history.places) : null
              const issue = locationIssue(it.location)
              return (
                <li key={`${it.name}-${i}`} className={cn("flex items-start gap-2 rounded-md border p-2", !picked[i] && "opacity-70")}>
                  <Checkbox
                    checked={!!picked[i]}
                    onCheckedChange={(v) => setPicked((p) => p.map((x, j) => (j === i ? v === true : x)))}
                    aria-label={`Use ${it.name}`}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug font-medium">
                      {it.name}
                      {it.location && <span className="font-normal text-muted-foreground"> · {it.location}</span>}
                    </p>
                    {it.facts && <p className="text-xs leading-snug text-muted-foreground">{it.facts}</p>}
                    {it.url && <SourceLink url={it.url} className="mt-0.5" />}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      {!it.url && <span className="text-muted-foreground">No source given</span>}
                      {it.verified ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                          <Check className="size-3" aria-hidden="true" /> found in the search
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="size-3" aria-hidden="true" /> source not confirmed
                        </span>
                      )}
                      {before && (
                        <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="size-3" aria-hidden="true" /> featured before in “{before.carousel}”{shortDate(before.date)}
                        </span>
                      )}
                      {issue && (
                        <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="size-3" aria-hidden="true" /> check the location: {issue}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
          <SourceLinks sources={research.sources} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void make()} disabled={!!busy || !pickedCount} className="bg-violet-600 text-white hover:bg-violet-700">
              {busy === "writing" || busy === "fitting" ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {busy === "writing" || busy === "fitting" ? BUSY_LABEL[busy] : `Make the carousel (${pickedCount} ${pickedCount === 1 ? "card" : "cards"})`}
            </Button>
            <span className="text-[11px] text-muted-foreground">Written only from the facts above.</span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          {note}
        </p>
      )}
    </section>
  )
}

/** The cards the AI wrote: check and change them before creating the carousel (places featured before are marked). */
function CardsEditor({ cards, onChange, history }: { cards: CarouselDraftCard[]; onChange: (cards: CarouselDraftCard[]) => void; history: CarouselHistory | null }) {
  const set = (i: number, patch: Partial<CarouselDraftCard>) => onChange(cards.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  return (
    <section className="flex flex-col gap-2 md:col-span-2" aria-labelledby="cc-cards-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="cc-cards-heading" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Cards ({cards.length})
        </h3>
        <span className="text-xs text-muted-foreground">Written by AI. Add the photos in the editor.</span>
      </div>
      <ol className="flex flex-col gap-2">
        {cards.map((card, i) => {
          const before = history && card.title.trim() ? featuredBefore(card.title, history.places) : null
          return (
            <li key={i} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border bg-card p-2.5" aria-label={`Card ${i + 1}`}>
              <span className="mt-1.5 flex size-6 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">{i + 1}</span>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <Input value={card.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Card title" aria-label={`Card ${i + 1} title`} className="h-8 font-semibold" maxLength={120} />
                <Input value={card.subtitle} onChange={(e) => set(i, { subtitle: e.target.value })} placeholder="Card subtitle (optional)" aria-label={`Card ${i + 1} subtitle`} className="h-8" maxLength={120} />
                <Textarea
                  value={card.description}
                  onChange={(e) => set(i, { description: e.target.value.replace(/\n+/g, " ") })}
                  placeholder="Card description (2–3 lines)"
                  aria-label={`Card ${i + 1} description`}
                  rows={2}
                  className="min-h-14 text-[13px] leading-snug sm:col-span-2"
                  maxLength={400}
                />
                {before && (
                  <p role="status" className="flex items-center gap-1 text-[11px] text-amber-700 sm:col-span-2 dark:text-amber-300">
                    <AlertTriangle className="size-3" aria-hidden="true" /> Featured before in “{before.carousel}”{shortDate(before.date)}. Remove it or change it to avoid a repeat.
                  </p>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove card ${i + 1}`} onClick={() => onChange(cards.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
