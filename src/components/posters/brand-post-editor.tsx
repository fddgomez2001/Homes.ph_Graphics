"use client"

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from "react"
import { addDays, format, isToday, parse, startOfDay } from "date-fns"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ClipboardPaste, Copy, Download, FolderOpen, ImagePlus, Loader2, MessageSquareText, PencilLine, Save, Sparkles, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { useProjectSlides } from "@/components/board/slide-renders"
import { useExport } from "@/components/export/export-provider"
import { invalidateProjects, useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { samePage } from "@/lib/ai/homes-places"
import { brandPostId, brandPostTemplate, firstTemplate, type PostBrand } from "@/lib/brand-templates/catalog"
import { buildBrandPost, photoNamed, SECOND_PHOTO, switchPostTemplate, withNamedPhoto, withPostFields } from "@/lib/brand-templates/posts"
import type { BrandPostKind, PhotoFocus, PostFields } from "@/lib/brand-templates/types"
import { createBrandPost, saveBrandPost } from "@/lib/data/brand-posts"
import { storeNewsPhoto, type NewsPhoto } from "@/lib/data/news"
import { settleUploadsOf } from "@/lib/image-sync"
import { getProject, getProjectSlides, onProjectSaved, updateProject } from "@/lib/data/projects"
import { combineDateTime } from "@/lib/dates"
import { GENSAN_PAGE, HOMES_POSTER_PAGE, isPosterTemplate, newsFileName, newsPostLabel, newsTimeLabel, pageDisplayName, posterKindOf, type NewsTime } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import type { SlideDesign } from "@/lib/design/types"
import { useDesktop, type DesktopFolders } from "@/lib/desktop"
import type { ProjectRow, SlideRow } from "@/lib/types"
import { cn, errorMessage } from "@/lib/utils"
import { writeBrandPostText } from "@/lib/ai/client"
import type { BrandPostAiField } from "@/lib/ai/brand-post-ai"
import { useDeletePoster } from "./poster-board"
import { TemplateGallery } from "./post-kind-nav"
import { brandForPage, dayQuery, inScope, nextPosterTime, posterBrandOf, posterPageOf, ymd, type PosterBrand } from "./poster-shared"

const isHomesBrand = (b: PosterBrand) => b === "homes" || b === "gensan"

/** What each template's fields are called in the form (the team's instructions), by "<kind>-<NN>". */
const LABELS: Record<string, Partial<Record<keyof PostFields, string>>> = {
  "dyk-02": { subtitle: "The fact" },
  "dyk-08": { title: "Title", facts: "Facts (up to 3)" },
  "engagement-01": { title: "Title: a “Remember when…?” question" },
  "engagement-03": { title: "Title", subtitle: "Subtitle" },
  "engagement-04": { kicker: "Pill", title: "The choice (a question)", subtitle: "The ask", labels: "Photo labels" },
  "engagement-05": { title: "Title", subtitle: "Subtitle", labels: "Photo labels" },
  "engagement-06": { kicker: "Pill", title: "The question", options: "Answers (one is right)" },
  "engagement-07": { kicker: "Pill", title: "The clue", subtitle: "The hint", cta: "Call to action (on the photo)" },
  "engagement-09": { question: "The question (in the card)", subtitle: "The ask" },
}

/** How long each field should be (the instructions' "Writing good content"). */
const GOOD: Partial<Record<keyof PostFields, { max: number; tip: string }>> = {
  title: { max: 70, tip: "30–70 letters; a question ends with “?”" },
  question: { max: 90, tip: "Up to 3 lines in the card; ends with “?”" },
  subtitle: { max: 45, tip: "One short line, under ~45 letters" },
  kicker: { max: 18, tip: "1–3 words" },
}

/** The photos' names in the form. */
function photoLabels(key: string, n: number): string[] {
  if (key === "engagement-04") return ["Photo A", "Photo B"]
  if (key === "engagement-05") return ["Then (the old photo)", "Now (the new photo)"]
  return n > 1 ? ["Photo 1", "Photo 2"] : ["Photo"]
}

const FOCUS: { id: PhotoFocus; label: string; hint: string }[] = [
  { id: "top", label: "Top", hint: "Keeps faces and heads in" },
  { id: "center", label: "Center", hint: "Wide places" },
  { id: "bottom", label: "Bottom", hint: "Keeps the ground in" },
]

/** Waits until `current()` has stopped changing for 150 ms (600 ms at most). */
async function typingPause<T>(current: () => T) {
  const started = Date.now()
  for (;;) {
    const before = current()
    await new Promise((resolve) => setTimeout(resolve, 150))
    if (current() === before || Date.now() - started >= 600) return
  }
}

interface Meta {
  day: string
  /** null = the first free posting time of the day. */
  time: string | null
  /** Homes.ph posts: the Facebook page. */
  page: string
  caption: string
}

/**
 * Poster Maker → Did You Know and Engagement Posts (1.52): a post on one of the brand's templates (the team's SVG
 * templates, public/ALL-BRAND-TEMPLATES), its texts and photos as the template's instructions describe them; the
 * template lays them out (more text = a shorter photo). Saved like a poster: a news post at its posting time.
 */
export function BrandPostEditor({
  kind,
  brand: initialBrand,
  initialPage,
  pages,
  initialId,
  initialDay,
  initialTime,
  onCreated,
  onLoaded,
  onPage,
  onMoved,
  onDeleted,
}: {
  kind: Exclude<BrandPostKind, "news">
  brand: PosterBrand
  initialPage: string | null
  pages: readonly string[]
  initialId: string | null
  initialDay: string
  initialTime: string | null
  onCreated: (id: string, day: string) => void
  onLoaded: (brand: PosterBrand, day: string, page: string | null, kind: BrandPostKind) => void
  onPage: (page: string) => void
  onMoved: (day: string) => void
  onDeleted: () => void
}) {
  const { runExport, busy: exporting } = useExport()
  const firstPage = isHomesBrand(initialBrand) ? (initialBrand === "gensan" ? GENSAN_PAGE : initialPage || HOMES_POSTER_PAGE) : ""
  const [brand, setBrand] = useState<PosterBrand>(initialBrand)
  const [design, setDesign] = useState<SlideDesign>(() => {
    const d = buildBrandPost(brandPostId(initialBrand as PostBrand, kind, firstTemplate(kind).num))
    return initialBrand === "homes" ? { ...d, page: firstPage } : d
  })
  const [meta, setMeta] = useState<Meta>(() => {
    const valid = !!initialTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(initialTime)
    return { day: initialDay, time: valid ? initialTime : null, page: firstPage, caption: "" }
  })
  const [project, setProject] = useState<Pick<ProjectRow, "id" | "status" | "scheduled_at" | "title"> | null>(null)
  const [loading, setLoading] = useState(!!initialId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"photo" | "save" | null>(null)
  const [dirty, setDirty] = useState(false)

  const t = brandPostTemplate(design.templateId)!
  const info = t.info
  const key = `${kind}-${t.def.num}`
  const fields = design.brandPost?.fields ?? {}

  const designRef = useRef(design)
  const metaRef = useRef(meta)
  const onLoadedRef = useRef(onLoaded)
  useEffect(() => {
    designRef.current = design
    metaRef.current = meta
    onLoadedRef.current = onLoaded
  })

  // ---------- load a saved post ----------
  const createdHere = useRef<string | null>(null)
  const shownRevision = useRef(0)
  const showSaved = (row: ProjectRow, slides: SlideRow[]) => {
    const saved = normalizeDesign(slides[0]?.design_json)
    if (!isPosterTemplate(saved.templateId) || !brandPostTemplate(saved.templateId) || posterKindOf(saved.templateId) === "news") return false
    if (row.revision < shownRevision.current) return true
    shownRevision.current = row.revision
    const at = row.scheduled_at ? new Date(row.scheduled_at) : null
    const b = posterBrandOf(saved)
    const page = isHomesBrand(b) ? posterPageOf(saved) : ""
    setDesign(saved)
    setBrand(b)
    setProject(row)
    setMeta({ day: at ? ymd(at) : ymd(new Date()), time: at ? format(at, "HH:mm") : null, page, caption: row.caption ?? "" })
    onLoadedRef.current(b, at ? ymd(at) : ymd(new Date()), isHomesBrand(b) ? page : null, posterKindOf(saved.templateId))
    setDirty(false)
    return true
  }
  const showSavedRef = useRef(showSaved)
  useEffect(() => {
    showSavedRef.current = showSaved
  })
  useEffect(() => {
    if (!initialId || initialId === createdHere.current) return
    let cancelled = false
    ;(async () => {
      try {
        const [row, slides] = await Promise.all([getProject(initialId), getProjectSlides(initialId)])
        if (cancelled) return
        if (!showSavedRef.current(row, slides)) setLoadError("This post isn't a Did You Know or engagement post. Open it on its own page.")
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialId])

  // ---------- the day's posts (the next free time) ----------
  const dayStart = useMemo(() => startOfDay(parse(meta.day, "yyyy-MM-dd", new Date())), [meta.day])
  const { projects } = useProjects(dayQuery(dayStart))
  const daySlides = useProjectSlides(projects)
  const otherTimes = useMemo(
    () =>
      projects
        .filter((p) => p.id !== project?.id && p.scheduled_at && inScope(daySlides.get(p.id)?.[0]?.design, { brand, page: isHomesBrand(brand) ? meta.page : null, kind }))
        .map((p) => format(new Date(p.scheduled_at!), "HH:mm")),
    [projects, daySlides, project?.id, brand, meta.page, kind],
  )
  const time = meta.time ?? nextPosterTime(otherTimes)
  const timeSlot: NewsTime = { time, label: newsTimeLabel(time) }
  const timeRef = useRef(time)
  useEffect(() => {
    timeRef.current = time
  })

  // ---------- saving: one at a time, in order ----------
  const projectIdRef = useRef<string | null>(initialId)
  const creating = useRef<Promise<string> | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editedHere = useRef(false)
  /** Photos added since the last save (uploaded in the background once saved). */
  const newPhotos = useRef<NewsPhoto[]>([])

  const saveNow = async (scheduledAt?: string | null) => {
    const id = projectIdRef.current ?? (creating.current ? await creating.current : null)
    const photos = newPhotos.current.splice(0)
    const m = metaRef.current
    if (id) {
      await saveBrandPost(id, designRef.current, { caption: m.caption, photos })
      if (scheduledAt !== undefined) setProject(await updateProject(id, { scheduled_at: scheduledAt }))
    } else {
      creating.current = createBrandPost({ design: designRef.current, scheduledAt: scheduledAt ?? combineDateTime(m.day, timeRef.current), caption: m.caption, photos })
      try {
        const newId = await creating.current
        projectIdRef.current = newId
        createdHere.current = newId
        setProject(await getProject(newId))
        onCreated(newId, m.day)
      } catch (e) {
        creating.current = null
        throw e
      }
    }
    invalidateProjects()
  }

  const save = (scheduledAt?: string | null, kindOfBusy: "photo" | "save" = "save") => {
    editedHere.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setBusy(kindOfBusy)
    const next = queue.current
      .catch(() => {})
      .then(() => saveNow(scheduledAt))
      .then(
        () => setDirty(false),
        (e) => toast.error("Couldn't save the post", { description: errorMessage(e) }),
      )
      .finally(() => setBusy(null))
    queue.current = next
    return next
  }
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  /** Saves after a short pause in typing. */
  const saveSoon = () => {
    editedHere.current = true
    setDirty(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void saveRef.current(), 800)
  }
  // Typing then leaving (another post, New post) still saves.
  useEffect(
    () => () => {
      if (timer.current) void saveRef.current()
    },
    [],
  )
  // A save of this post made elsewhere (another window) is read, until something is changed here.
  useEffect(() => {
    const off = onProjectSaved(({ id, revision }) => {
      if (id !== projectIdRef.current || editedHere.current || revision <= shownRevision.current) return
      void Promise.all([getProject(id), getProjectSlides(id)]).then(([row, slides]) => showSavedRef.current(row, slides)).catch(() => {})
    })
    return off
  }, [])

  const change = (next: SlideDesign, now = false) => {
    setDesign(next)
    designRef.current = next
    if (now) void save()
    else saveSoon()
  }
  const setField = (patch: Partial<PostFields>) => change(withPostFields(designRef.current, patch))
  const setCaption = (caption: string) => {
    const next = { ...metaRef.current, caption }
    setMeta(next)
    metaRef.current = next
    saveSoon()
  }

  // ---------- AI: the post's texts and caption ----------
  const [topic, setTopic] = useState("")
  const [writing, setWriting] = useState(false)
  const writeWithAi = async () => {
    const asked = (["kicker", "title", "subtitle", "question", "labels", "options", "facts", "cta"] as const).filter((f) => f in (info.sample ?? {})) as BrandPostAiField[]
    const avoid = projects
      .filter((p) => p.id !== project?.id && inScope(daySlides.get(p.id)?.[0]?.design, { brand, page: isHomesBrand(brand) ? meta.page : null, kind }))
      .map((p) => p.title)
    setWriting(true)
    try {
      const r = await writeBrandPostText({
        brand: newsPostLabel(brand, brand === "homes" ? meta.page : null),
        kind,
        template: t.def.name,
        fields: asked,
        topic,
        avoid,
      })
      const patch: Partial<PostFields> = {}
      for (const f of asked) if (r[f] !== undefined) Object.assign(patch, { [f]: r[f] })
      change(withPostFields(designRef.current, patch))
      if (r.caption) setCaption(r.caption)
      toast.success("Written with AI", {
        description: [r.answer !== undefined && r.options ? `Answer: ${"ABC"[r.answer]} · ${r.options[r.answer]}` : "", r.fellBack ?? "Check the facts before posting."].filter(Boolean).join(" · "),
      })
    } catch (e) {
      toast.error("Couldn't write the post", { description: errorMessage(e) })
    } finally {
      setWriting(false)
    }
  }

  // ---------- template, page, time ----------
  const setTemplate = (num: string) => {
    if (num === t.def.num) return
    change(switchPostTemplate(designRef.current, brandPostId(brand as PostBrand, kind, num)), !!projectIdRef.current)
  }

  const setPage = (page: string) => {
    if (samePage(page, meta.page)) return
    const b = brandForPage(page)
    let next = designRef.current
    if (b !== brand) next = switchPostTemplate(next, brandPostId(b as PostBrand, kind, t.def.num))
    next = { ...next, page: b === "homes" ? page : null }
    setBrand(b)
    const m = { ...metaRef.current, page }
    setMeta(m)
    metaRef.current = m
    change(next, !!projectIdRef.current)
    onPage(page)
  }
  const pageOptions = useMemo(() => (meta.page && !pages.some((p) => samePage(p, meta.page)) ? [meta.page, ...pages] : [...pages]), [pages, meta.page])

  const setWhen = (patch: { day?: string; time?: string }) => {
    const next = { ...meta, ...patch, time: patch.time ?? meta.time }
    setMeta(next)
    metaRef.current = next
    if (projectIdRef.current || creating.current) {
      const movedDay = patch.day && patch.day !== meta.day ? patch.day : null
      void save(combineDateTime(next.day, next.time ?? time)).then(() => movedDay && projectIdRef.current && onMoved(movedDay))
    }
  }

  // ---------- photos ----------
  const slots = info.photos ?? 0
  const slotNames = ["Photo", SECOND_PHOTO].slice(0, slots)
  const labels = photoLabels(key, slots)
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  const addPhoto = async (file: File, slot: number) => {
    setBusy("photo")
    let photo: NewsPhoto
    try {
      photo = await storeNewsPhoto(file)
    } catch (e) {
      setBusy(null)
      return void toast.error("Couldn't add the photo", { description: errorMessage(e) })
    }
    newPhotos.current.push(photo)
    const next = withNamedPhoto(designRef.current, slotNames[slot] ?? "Photo", photo)
    setDesign(next)
    designRef.current = next
    void save(undefined, "photo")
  }
  const removePhoto = (slot: number) => change(withNamedPhoto(designRef.current, slotNames[slot] ?? "Photo", null), true)
  /** A dropped or pasted photo goes in the first empty photo (else the first). */
  const targetSlot = () => Math.max(0, slotNames.findIndex((n) => !photoNamed(designRef.current, n)?.src))
  const onPaste = (e: ClipboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea") || !slots) return
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"))
    if (!file) return
    e.preventDefault()
    void addPhoto(file, targetSlot())
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"))
    if (file && slots) void addPhoto(file, targetSlot())
  }
  const pasteInto = async (slot: number) => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((x) => x.startsWith("image/"))
        if (type) return void addPhoto(new File([await item.getType(type)], `Pasted photo.${type.split("/")[1] ?? "png"}`, { type }), slot)
      }
      toast.info("No picture on the clipboard", { description: "Copy a picture, then click Paste (or click the preview and press Ctrl+V)." })
    } catch {
      toast.info("Click the preview and press Ctrl+V to paste the picture.")
    }
  }
  const setFocus = (slot: number, focus: PhotoFocus) => {
    const list = [...(fields.focus ?? [])]
    while (list.length < slots) list.push("center")
    list[slot] = focus
    change(withPostFields(designRef.current, { focus: list }), true)
  }

  // ---------- preview ----------
  const [preview, setPreview] = useState<string | null>(null)
  const latest = useRef(design)
  const rendering = useRef(false)
  useEffect(() => {
    latest.current = design
    if (rendering.current) return
    rendering.current = true
    ;(async () => {
      const { renderThumbnail } = await import("@/lib/design/render")
      let drawn: SlideDesign | null = null
      while (drawn !== latest.current) {
        if (drawn) await typingPause(() => latest.current)
        drawn = latest.current
        const url = await renderThumbnail(drawn, drawn.width, 0.9).catch((e) => {
          console.warn("Couldn't draw the post", e)
          return null
        })
        if (url) setPreview(url)
      }
      rendering.current = false
    })()
  }, [design])

  // ---------- the picture ----------
  const typeName = kind === "dyk" ? "Did You Know" : "Engagement"
  const pictureLabel = `${newsPostLabel(brand, brand === "homes" ? meta.page : null)} ${typeName}`
  const fileName = newsFileName(dayStart, timeSlot, pictureLabel)
  const desktop = useDesktop()
  const [folders, setFolders] = useState<DesktopFolders | null>(null)
  const [savingFile, setSavingFile] = useState(false)
  useEffect(() => {
    desktop?.folders?.get().then(setFolders, () => setFolders(null))
  }, [desktop])
  const canSaveToFolder = !!desktop?.savePoster && !!desktop.folders
  const saveToFolder = async () => {
    if (!desktop?.savePoster) return
    setSavingFile(true)
    try {
      const { renderSlideImage } = await import("@/lib/design/render")
      const blob = await renderSlideImage(designRef.current, "png")
      const file = await desktop.savePoster(fileName, new Uint8Array(await blob.arrayBuffer()))
      toast.success("Post saved", { description: file, action: desktop.showFile ? { label: "Show in folder", onClick: () => void desktop.showFile?.(file) } : undefined })
    } catch (e) {
      toast.error("Couldn't save the post", { description: errorMessage(e) })
    } finally {
      setSavingFile(false)
    }
  }
  const download = () =>
    runExport({
      meta: { title: project?.title || typeName, caption: meta.caption, status: project?.status ?? "draft", scheduled_at: combineDateTime(meta.day, time) },
      slides: [{ type: "cover", design: designRef.current }],
      kind: "single",
      format: "png",
      checks: false,
      fileName,
    })

  const deletePost = useDeletePoster()

  /** The editor (1.53): pictures, cut-out people, text and shapes between the template's layers. Saved first. */
  const router = useRouter()
  const openEditor = async () => {
    if (timer.current) void save()
    await queue.current.catch(() => {})
    // Its photos, still uploading, are finished first (else their update lands under the editor: "Conflict").
    if (projectIdRef.current) await settleUploadsOf(projectIdRef.current)
    // What the editor saves is read back here (nothing changed here meanwhile).
    editedHere.current = false
    if (projectIdRef.current) router.push(`/editor/${projectIdRef.current}`)
  }
  const status = busy === "photo" ? "Adding the photo…" : busy === "save" || dirty ? "Saving…" : project ? "Saved" : "Not saved yet: change a text or add a photo"

  if (loadError) {
    return (
      <div className="max-w-xl rounded-lg border bg-card p-4 text-sm">
        <p className="font-medium">Couldn&apos;t open this post</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  const label = (k: keyof PostFields) => LABELS[key]?.[k]
  const sample = info.sample ?? {}
  const textField = (k: "title" | "subtitle" | "question", rows: number) => {
    const name = label(k)
    if (!name || !(k in sample)) return null
    return (
      <PostTextField
        id={`post-${k}`}
        name={name}
        hint={k === "subtitle" && kind === "engagement" ? "Optional" : undefined}
        value={fields[k] ?? ""}
        sample={sample[k] ?? ""}
        good={GOOD[k]}
        rows={rows}
        onChange={(value) => setField({ [k]: value })}
      />
    )
  }
  const listField = (k: "labels" | "options" | "facts", count: number, letters: string[]) => {
    const name = label(k)
    if (!name) return null
    return <PostListField kind={k} name={name} list={fields[k] ?? []} sample={sample[k] ?? []} count={count} letters={letters} onChange={(list) => setField({ [k]: list })} />
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className={cn("flex flex-col gap-5", loading && "pointer-events-none opacity-60")} aria-busy={loading}>
        <Field label="Template" hint={`${t.def.num} · ${t.def.name} · ${info.width} × ${info.height}`}>
          <TemplateGallery kind={kind} brand={brand as PostBrand} value={t.def.num} onChange={setTemplate} />
          <p className="text-[11px] text-muted-foreground">{t.def.hint}. More text makes the photo shorter; the spacing never changes.</p>
        </Field>

        <div className="flex flex-col gap-2 rounded-lg border border-violet-400/30 bg-violet-500/5 p-3">
          <label htmlFor="post-topic" className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="size-4 text-violet-600 dark:text-violet-300" /> Write with AI
          </label>
          <div className="flex gap-1.5">
            <Input
              id="post-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !writing && void writeWithAi()}
              placeholder={kind === "dyk" ? "Topic, e.g. Cebu history (empty: AI picks)" : "Topic, e.g. Christmas in Cebu (empty: AI picks)"}
              maxLength={200}
              className="bg-card"
            />
            <Button type="button" variant="outline" className="shrink-0 border-violet-400/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300" onClick={() => void writeWithAi()} disabled={writing}>
              {writing ? <Loader2 className="animate-spin" /> : <Sparkles />} Write
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Fills this template&apos;s texts and the caption, by the team&apos;s writing rules. Check facts before posting.</p>
        </div>

        {isHomesBrand(brand) && (
          <Field label="Homes.ph page" hint="The Facebook page this post is for">
            <Select value={pageOptions.find((p) => samePage(p, meta.page)) ?? undefined} onValueChange={setPage}>
              <SelectTrigger className="w-full bg-card" aria-label="This post's Homes.ph page">
                <SelectValue placeholder="Choose the page" />
              </SelectTrigger>
              <SelectContent>
                {pageOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {pageDisplayName(name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Posting time" hint={`${format(dayStart, "EEEE, MMMM d")} · ${timeSlot.label}`}>
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous day" onClick={() => setWhen({ day: ymd(addDays(dayStart, -1)) })}>
              <ChevronLeft />
            </Button>
            <Input
              type="date"
              value={meta.day}
              onChange={(e) => e.target.value && setWhen({ day: e.target.value })}
              aria-label="Posting day"
              className="h-8 flex-1 border-0 bg-transparent text-center shadow-none dark:bg-transparent"
            />
            <Button variant="ghost" size="icon-sm" aria-label="Next day" onClick={() => setWhen({ day: ymd(addDays(dayStart, 1)) })}>
              <ChevronRight />
            </Button>
            {!isToday(dayStart) && (
              <Button variant="ghost" size="sm" onClick={() => setWhen({ day: ymd(new Date()) })}>
                Today
              </Button>
            )}
          </div>
          <Input type="time" step={300} value={time} onChange={(e) => e.target.value && setWhen({ time: e.target.value })} aria-label="Posting time" className="mt-1.5 w-36 bg-card" />
        </Field>

        {slotNames.map((name, i) => {
          const photo = photoNamed(design, name)
          const focus = fields.focus?.[i] ?? "center"
          return (
            <Field key={name} label={labels[i]} hint={info.background && i === 0 ? "Also the blurred background" : undefined}>
              <div className="flex gap-1.5">
                <Button variant="outline" className="flex-1" onClick={() => void pasteInto(i)} disabled={busy === "photo"}>
                  <ClipboardPaste /> Paste
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => fileRefs.current[i]?.click()} disabled={busy === "photo"}>
                  <ImagePlus /> {photo?.src ? "Replace" : "Choose photo"}
                </Button>
                {photo?.src && (
                  <Button variant="ghost" size="icon" aria-label={`Remove ${labels[i]}`} title="Remove the photo" onClick={() => removePhoto(i)}>
                    <X />
                  </Button>
                )}
                <input
                  ref={(el) => {
                    fileRefs.current[i] = el
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  aria-label={`Choose ${labels[i]}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    if (file) void addPhoto(file, i)
                  }}
                />
              </div>
              {photo?.src && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>Keep in view:</span>
                  <div className="flex gap-0.5 rounded-md border bg-card p-0.5" role="radiogroup" aria-label={`${labels[i]}: crop`}>
                    {FOCUS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        role="radio"
                        aria-checked={focus === f.id}
                        title={f.hint}
                        onClick={() => setFocus(i, f.id)}
                        className={cn("rounded px-2 py-0.5 font-medium", focus === f.id ? "bg-primary text-primary-foreground" : "hover:text-foreground")}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Field>
          )
        })}

        {label("kicker") && "kicker" in sample && (
          <Field label={label("kicker")!} htmlFor="post-kicker" hint="Empty: no pill">
            <Input
              id="post-kicker"
              value={fields.kicker ?? ""}
              onChange={(e) => setField({ kicker: e.target.value })}
              maxLength={30}
              placeholder={sample.kicker}
              className="bg-card uppercase placeholder:normal-case"
            />
          </Field>
        )}
        {textField("question", 3)}
        {textField("title", key === "dyk-08" ? 2 : 3)}
        {textField("subtitle", key === "dyk-02" ? 4 : 2)}
        {"labels" in sample && listField("labels", 2, key === "engagement-05" ? ["Then", "Now"] : ["A", "B"])}
        {"options" in sample && listField("options", 3, ["A", "B", "C"])}
        {"facts" in sample && listField("facts", 3, ["1", "2", "3"])}
        {label("cta") && "cta" in sample && (
          <Field label={label("cta")!} htmlFor="post-cta" hint="Empty: no pill">
            <Input id="post-cta" value={fields.cta ?? ""} onChange={(e) => setField({ cta: e.target.value })} maxLength={40} placeholder={sample.cta} className="bg-card uppercase placeholder:normal-case" />
          </Field>
        )}
        <p className="-mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Put <span className="font-semibold text-foreground">*stars*</span> around the words to highlight (one key phrase is best), e.g. Remember the{" "}
          <span className="font-semibold text-foreground">*Old TOPS*</span>? Enter starts a new line. Long text gets smaller to fit.
        </p>

        <CaptionBox value={meta.caption} onChange={setCaption} />
      </div>

      {/* ---------- preview ---------- */}
      <div className="flex flex-col gap-3 lg:sticky lg:top-20">
        <div
          role="button"
          tabIndex={0}
          aria-label={`Post preview. ${slots ? "Click, then paste a picture (Ctrl+V), or drop one here." : ""}`}
          onPaste={onPaste}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onDoubleClick={() => project && void openEditor()}
          style={{ aspectRatio: `${design.width} / ${design.height}`, maxWidth: `min(100%, calc((100dvh - 12rem) * ${design.width / design.height}))` }}
          className="relative w-full overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-black/10 outline-none select-none focus-visible:ring-3 focus-visible:ring-primary"
        >
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full" draggable={false} />
          )}
          {(!preview || loading || busy === "photo") && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
              <Loader2 className="size-6 animate-spin" />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSaveToFolder ? (
            <Button onClick={() => void saveToFolder()} disabled={savingFile || loading} title={folders ? `Saves the PNG in ${folders.posters}` : undefined}>
              {savingFile ? <Loader2 className="animate-spin" /> : <Save />} Save PNG
            </Button>
          ) : (
            <Button onClick={() => void download()} disabled={exporting || loading}>
              <Download /> Download PNG
            </Button>
          )}
          <Button variant="outline" onClick={() => void openEditor()} disabled={!project} title="Add pictures, cut-out people (remove background), text and shapes between the template's layers">
            <PencilLine /> Open in editor (layers)
          </Button>
          {project && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void deletePost(project.id, project.title).then((done) => done && onDeleted())}
            >
              <Trash2 /> Delete
            </Button>
          )}
          <span className="text-xs text-muted-foreground" role="status">
            {status}
          </span>
        </div>
        {canSaveToFolder && folders && (
          <div className="flex max-w-[min(100%,calc(100dvh-12rem))] items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs">
            <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Saves to</span>
            <span className="min-w-0 flex-1 truncate font-medium" title={folders.posters}>
              {folders.posters}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** A text of the post (title, subtitle, question), with how long it should be. */
function PostTextField(props: {
  id: string
  name: string
  hint?: string
  value: string
  sample: string
  good?: { max: number; tip: string }
  rows: number
  onChange: (value: string) => void
}) {
  const { id, name, hint, value, sample, good, rows, onChange } = props
  const letters = value.replace(/\*/g, "").length
  const long = !!good && letters > good.max
  return (
    <Field label={name} htmlFor={id} hint={hint}>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={400} placeholder={sample} className="min-h-0 resize-none bg-card text-[14px]" />
      {good && (
        <p className={cn("text-[11px]", long ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
          {long ? `Long (${letters} letters): it gets smaller to fit. ` : ""}
          {good.tip}.
        </p>
      )}
    </Field>
  )
}

/** The photo labels, trivia answers or facts (2 or 3 lines). */
function PostListField(props: { kind: "labels" | "options" | "facts"; name: string; list: string[]; sample: string[]; count: number; letters: string[]; onChange: (list: string[]) => void }) {
  const { kind, name, list, sample, count, letters, onChange } = props
  const set = (i: number, value: string) => {
    const next = [...list]
    while (next.length < count) next.push("")
    next[i] = value
    onChange(next)
  }
  return (
    <Field label={name}>
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <label key={i} className="flex items-start gap-2">
            <span className="mt-2 w-12 shrink-0 text-right text-[11px] font-semibold text-muted-foreground">{letters[i]}</span>
            {kind === "facts" ? (
              <Textarea
                value={list[i] ?? ""}
                onChange={(e) => set(i, e.target.value)}
                rows={2}
                maxLength={200}
                placeholder={sample[i] ?? ""}
                aria-label={`${name} ${letters[i]}`}
                className="min-h-0 resize-none bg-card text-[13px]"
              />
            ) : (
              <Input
                value={list[i] ?? ""}
                onChange={(e) => set(i, e.target.value)}
                maxLength={kind === "labels" ? 30 : 60}
                placeholder={sample[i] ?? ""}
                aria-label={`${name} ${letters[i]}`}
                className={cn("bg-card text-[13px]", kind === "labels" && "uppercase placeholder:normal-case")}
              />
            )}
          </label>
        ))}
        <p className="text-[11px] text-muted-foreground">
          {kind === "facts"
            ? "One sentence each, under ~90 letters. Leave one empty for 2 facts (the rows share the space)."
            : kind === "options"
              ? "One line each, under ~40 letters. Fewer answers: the photo grows."
              : "Under ~22 letters each, e.g. “A · Tops Lookout”, “Then · 1990s”. Empty: no label."}
        </p>
      </div>
    </Field>
  )
}

/** The Facebook caption, saved with the post. */
function CaptionBox({ value, onChange }: { value: string; onChange: (caption: string) => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Caption copied", { description: "Paste it in the Facebook post." })
    } catch {
      toast.error("Couldn't copy the caption")
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="post-caption" className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquareText className="size-4 text-muted-foreground" /> Facebook caption
        </label>
        <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => void copy()} disabled={!value.trim()}>
          <Copy /> Copy
        </Button>
      </div>
      <Textarea
        id="post-caption"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 5000))}
        rows={5}
        placeholder="The caption for the post: the question or fact, a clear ask (“Comment below!”), then hashtags."
        className="min-h-24 resize-y bg-card text-[13px] leading-relaxed"
      />
    </div>
  )
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
