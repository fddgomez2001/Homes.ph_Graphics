"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react"
import { format } from "date-fns"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleHelp,
  ClipboardPaste,
  Copy,
  DoorOpen,
  Download,
  FolderOpen,
  ImageOff,
  ImagePlus,
  Images,
  Landmark,
  LayoutTemplate,
  Lightbulb,
  Loader2,
  MapPin,
  PencilLine,
  RotateCcw,
  Save,
  Sparkles,
  Store,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { posterAiLabel, writePickleballPost } from "@/lib/ai/client"
import {
  AD_KINDS,
  AD_SIZE,
  adTemplates,
  hasLogo,
  hasPhoto,
  isCourtKind,
  numberLabel,
  SAMPLE_CONTENT,
  type AdContent,
  type AdKind,
  type AdManifest,
  type AdTemplateId,
} from "@/lib/ads/render"
import { logoOriginal, prepareLogo } from "@/lib/ads/court-logo"
import { adPosterBlob as posterBlob, loadAdManifest as loadManifest, NO_ADJUST, paintAd as paint, type LogoAdjust, type LogoLook } from "@/lib/ads/poster"
import { adTimeLabel } from "@/lib/ads/schedule-time"
import { createAd, getAd, subscribeAds, updateAd, type AdDraft, type ScheduledAd } from "@/lib/ads/scheduled"
import { useDesktop } from "@/lib/desktop"
import { downloadBlob } from "@/lib/export"
import { cn, errorMessage } from "@/lib/utils"
import { SourceLinks } from "@/components/ai/source-links"
import type { AiSource } from "@/lib/ai/types"
import { AdScheduleCard, dayKeyOf, dayOfKey, useAdTimeCheck } from "./ad-schedule"

// ---------------------------------------------------------------------------------------------
// Saved on this computer: the last post of each kind, the facts already made (so the AI picks
// new ones) and the next poster number.
// ---------------------------------------------------------------------------------------------

interface KindState {
  content: AdContent | null
  template: AdTemplateId
  caption: string
  topic: string
  /** The web pages behind the last post (the typed topic's search, or links to check the fact). */
  sources?: AiSource[]
  /** The topic was typed (the AI used these pages) rather than looked up after writing. */
  searchedTopic?: boolean
  /** Coming Soon / Now Open: an article or announcement about the court, for the AI. */
  article?: string
  /** Coming Soon / Now Open: the court logo's size and offset on each template. */
  logoAdjust?: Partial<Record<AdTemplateId, LogoAdjust>>
}

interface Saved {
  kind: AdKind
  byKind: Record<AdKind, KindState>
  posted: Record<AdKind, string[]>
  next: Record<AdKind, number>
}

const STORE = "dcm-ads-pickleplay"
const KIND_IDS = AD_KINDS.map((k) => k.id)
const perKind = <T,>(make: (k: AdKind) => T) => Object.fromEntries(KIND_IDS.map((k) => [k, make(k)])) as Record<AdKind, T>
const freshKind = (k: AdKind): KindState => ({ content: null, template: `${k}-1`, caption: "", topic: "" })
const fresh = (): Saved => ({
  kind: "history",
  byKind: perKind(freshKind),
  posted: perKind(() => []),
  next: perKind(() => 1),
})

function load(): Saved {
  const base = fresh()
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<Saved> | null
    if (!raw) return base
    for (const k of KIND_IDS) {
      const s = raw.byKind?.[k]
      if (s && adTemplates(k).includes(s.template)) base.byKind[k] = { ...base.byKind[k], ...s, content: s.content?.kind === k ? upgrade(s.content) : null }
      if (Array.isArray(raw.posted?.[k])) base.posted[k] = raw.posted[k].filter((t) => typeof t === "string").slice(-80)
      if (typeof raw.next?.[k] === "number" && raw.next[k] > 0) base.next[k] = Math.floor(raw.next[k])
    }
    if (raw.kind && KIND_IDS.includes(raw.kind)) base.kind = raw.kind
  } catch {
    // Nothing saved (or not readable): start fresh.
  }
  return base
}

/** A History post saved by 1.31.0 had a year and a place; now the focus word and the story tag. */
function upgrade(c: AdContent): AdContent {
  if (c.kind !== "history" || typeof c.focus === "string") return c
  const old = c as unknown as { year?: string; place?: string }
  return { ...c, focus: old.year ?? "", storyTag: [old.year, old.place].filter(Boolean).join(" · ") }
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s))
  } catch {
    // Storage full or blocked: the post still works for now.
  }
}

// ---------------------------------------------------------------------------------------------
// Drawing (src/lib/ads/poster.ts: the same code draws a scheduled ad for the Chrome extension)
// ---------------------------------------------------------------------------------------------

function AdCanvas({
  id,
  content,
  photo,
  logo,
  size = AD_SIZE,
  className,
  onOverflow,
}: {
  id: AdTemplateId
  content: AdContent
  photo: HTMLImageElement | null
  logo?: LogoLook | null
  /** Canvas pixels (smaller previews draw the same poster scaled down). */
  size?: number
  className?: string
  onOverflow?: (fields: string[]) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let live = true
    const canvas = ref.current
    if (!canvas) return
    paint(canvas, id, content, photo, logo).then(
      (r) => {
        if (live) onOverflow?.(r.overflow)
      },
      () => {},
    )
    return () => {
      live = false
    }
    // onOverflow is a state setter (stable).
  }, [id, content, photo, logo, onOverflow])
  return <canvas ref={ref} width={size} height={size} className={cn("aspect-square h-auto w-full", className)} />
}

// ---------------------------------------------------------------------------------------------
// The background photo: the template's court photo, or one the user pastes or uploads (kept per
// kind on this computer, shrunk so it fits in the browser's storage).
// ---------------------------------------------------------------------------------------------

const PHOTO_STORE = (kind: AdKind) => `dcm-ads-pickleplay-photo-${kind}`

function loadPhotos(): Record<AdKind, string | null> {
  const read = (k: AdKind) => {
    try {
      return localStorage.getItem(PHOTO_STORE(k))
    } catch {
      return null
    }
  }
  return perKind(read)
}

/** The court logo (Coming Soon and Now Open share it): the original and the one shown (cut out, trimmed). */
interface CourtLogo {
  original: string
  shown: string
  /** Make a plain background transparent. */
  clearBackground: boolean
}
const LOGO_STORE = "dcm-ads-pickleplay-court-logo"

function loadLogo(): CourtLogo | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LOGO_STORE) ?? "null") as Partial<CourtLogo> | null
    return raw && typeof raw.original === "string" && typeof raw.shown === "string" ? { original: raw.original, shown: raw.shown, clearBackground: raw.clearBackground !== false } : null
  } catch {
    return null
  }
}

/** A picture file as a JPEG data URL, at most 1800 px on its long side. */
async function photoDataUrl(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("That file isn't a picture the app can read."))
      i.src = url
    })
    const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.9)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The loaded picture for a data URL (null while it loads or when there's none). */
function usePhotoImage(src: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement } | null>(null)
  useEffect(() => {
    if (!src) return
    let live = true
    const img = new Image()
    img.onload = () => {
      if (live) setLoaded({ src, img })
    }
    img.src = src
    return () => {
      live = false
    }
  }, [src])
  return src && loaded?.src === src ? loaded.img : null
}

// ---------------------------------------------------------------------------------------------
// The fields each kind has (what the AI wrote; all editable)
// ---------------------------------------------------------------------------------------------

interface Field {
  key: string
  label: string
  /** About this many characters fit like the template's sample. */
  max: number
  long?: boolean
  /** Only these templates show it. */
  only?: number[]
  hint?: string
}

const FIELDS: Record<AdKind, Field[]> = {
  funfact: [
    { key: "number", label: "Number", max: 3, hint: "#01, #02…" },
    { key: "lead", label: "Line before the big one", max: 28 },
    { key: "big", label: "Big number or word", max: 7, hint: "40, DINK, ERNE…" },
    { key: "word", label: "Word after it", max: 8 },
    { key: "body", label: "Explanation", max: 115, long: true, only: [1, 3, 4] },
    { key: "leftLabel", label: "Left side: label", max: 8, only: [2] },
    { key: "leftValue", label: "Left side: number", max: 5, only: [2] },
    { key: "leftText", label: "Left side: words", max: 14, only: [2] },
    { key: "rightLabel", label: "Right side: label", max: 8, only: [2] },
    { key: "rightValue", label: "Right side: number", max: 5, only: [2] },
    { key: "rightText", label: "Right side: words", max: 14, only: [2] },
    { key: "note", label: "Takeaway line", max: 58, only: [2] },
    { key: "caption", label: "Caption on the picture", max: 24, only: [3] },
  ],
  history: [
    { key: "focus", label: "Big word (a year, name or thing)", max: 10, only: [2, 4], hint: "1965, Kitchen, Erne…" },
    { key: "headline", label: "Headline (the big word shows in color)", max: 42, only: [1, 3, 4] },
    { key: "shortHeadline", label: "Headline without the big word", max: 34, only: [2] },
    { key: "body", label: "The story", max: 150, long: true },
    { key: "startTitle", label: "Story title", max: 18, only: [2] },
    { key: "storyTag", label: "Story tag", max: 28, only: [3], hint: "1965 · Bainbridge Island, WA" },
    { key: "sideTitle", label: "Second card title", max: 20 },
    { key: "sideBody", label: "Second card text", max: 125, long: true },
    { key: "badge", label: "Badge", max: 11, only: [3] },
  ],
  trivia: [
    { key: "number", label: "Number", max: 3, only: [4], hint: "#07" },
    { key: "question", label: "Question", max: 40, only: [1, 2], hint: "[words] get the green box" },
    { key: "longQuestion", label: "Longer question", max: 88, long: true, only: [3], hint: "[words] get the green box" },
    { key: "shortQuestion", label: "Short question", max: 22, only: [4], hint: "[word] gets the green box" },
    { key: "answer", label: "Answer", max: 10 },
    { key: "explanation", label: "Why", max: 100, long: true },
  ],
  courtowner: [
    { key: "headline", label: "Headline", max: 12 },
    { key: "highlight", label: "Highlight (the green block)", max: 10 },
    { key: "detail1", label: "Benefit 1", max: 30, only: [1, 2, 3, 4, 7] },
    { key: "detail2", label: "Benefit 2", max: 30, only: [1, 2, 3, 4, 7] },
    { key: "detail3", label: "Benefit 3", max: 32, only: [1, 2, 3, 4, 7] },
    { key: "feature1", label: "Feature 1", max: 16, only: [5, 6] },
    { key: "feature2", label: "Feature 2", max: 16, only: [5, 6] },
    { key: "feature3", label: "Feature 3", max: 16, only: [5, 6] },
  ],
  comingsoon: [
    { key: "tag", label: "Tag (template 2: the stamp)", max: 14, hint: "Coming soon" },
    { key: "kicker", label: "Kicker", max: 16, only: [2], hint: "You’re invited" },
    { key: "chip", label: "Photo chip", max: 12, only: [3], hint: "New court" },
    { key: "headline", label: "Headline", max: 14, hint: "Is coming to" },
    { key: "highlight", label: "Highlight (the green block)", max: 14, hint: "Pickleplay.ph" },
    { key: "detail", label: "Detail", max: 44 },
    { key: "cta", label: "Call to action", max: 34 },
  ],
  nowopen: [
    { key: "tag", label: "Ribbon / tag", max: 16, only: [1, 2], hint: "Grand opening" },
    { key: "audience", label: "Tag", max: 22, only: [3, 4], hint: "New court now open" },
    { key: "logoTab", label: "Logo card tab", max: 12, only: [4], hint: "New court" },
    { key: "headline", label: "Headline (template 1: its last word in the green block)", max: 12, only: [1, 2], hint: "Now open!" },
    { key: "highlight", label: "Highlight (the green block)", max: 12, only: [2], hint: "Book today!" },
    { key: "headlineIn", label: "Headline", max: 12, only: [3, 4], hint: "Now open in" },
    { key: "spotlight", label: "Big word (usually the city)", max: 10, only: [3, 4], hint: "Mandaue" },
    { key: "perk", label: "Perk", max: 36, only: [2, 3, 4] },
    { key: "cta", label: "Call to action", max: 44, only: [1] },
  ],
}

/** The court's own details (Coming Soon / Now Open): always shown as typed. */
const COURT_FIELDS: Record<"comingsoon" | "nowopen", Field[]> = {
  comingsoon: [
    { key: "courtName", label: "Court name", max: 24, hint: "e.g. Bouncy Kitchen Pickle Court" },
    { key: "barangay", label: "Barangay", max: 20, hint: "e.g. Brgy. Tacunan" },
    { key: "city", label: "City", max: 16, hint: "e.g. Davao City" },
  ],
  nowopen: [
    { key: "courtName", label: "Court name", max: 24, hint: "e.g. Bouncy Kitchen Pickle Court" },
    { key: "barangay", label: "Barangay", max: 20, hint: "e.g. Brgy. Tacunan" },
    { key: "city", label: "City", max: 16, hint: "e.g. Davao City" },
    { key: "hours", label: "Hours", max: 34, hint: "Open daily · 6:00 AM – 10:00 PM" },
  ],
}

const KIND_ICON: Record<AdKind, typeof Landmark> = { history: Landmark, trivia: CircleHelp, funfact: Lightbulb, courtowner: Store, comingsoon: CalendarClock, nowopen: DoorOpen }
const TOPIC_HINT: Record<AdKind, string> = {
  history: "e.g. the kitchen, the Erne, the first paddles, the name",
  trivia: "e.g. the kitchen, scoring, the net, famous players",
  funfact: "e.g. the ball, the dink, court size, the serve",
  courtowner: "e.g. online bookings, open play, tournaments",
  comingsoon: "e.g. grand launch, indoor courts, first in the city",
  nowopen: "e.g. grand opening, book today, open play nights",
}
const SINGULAR: Record<AdKind, string> = { history: "History", trivia: "Trivia", funfact: "Fun Fact", courtowner: "Court Owner ad", comingsoon: "Coming Soon post", nowopen: "Now Open post" }

const templateNumber = (id: AdTemplateId) => Number(id.split("-")[1])

function fileName(id: AdTemplateId, c: AdContent) {
  if (c.kind === "courtowner") return `PicklePlay Court Owner Ad (Day ${templateNumber(id)}).png`
  if (c.kind === "comingsoon" || c.kind === "nowopen")
    return `PicklePlay ${c.kind === "comingsoon" ? "Coming Soon" : "Now Open"} ${c.courtName.trim() || "Court"} (Template ${templateNumber(id)}).png`.replace(/[\\/:*?"<>|]/g, "")
  const tag = c.kind === "history" ? c.focus || "post" : numberLabel(c.number)
  return `PicklePlay ${SINGULAR[c.kind]} ${tag} (Template ${templateNumber(id)}).png`.replace(/[\\/:*?"<>|]/g, "")
}

/** An ad from the calendar open in the editor, and what the editor had before (put back after Save changes or Cancel). */
interface Editing {
  ad: ScheduledAd
  before: {
    kind: AdKind
    kinds: Partial<Record<AdKind, { state: KindState; photo: string | null }>>
    logo?: { value: CourtLogo | null }
  }
}

// ---------------------------------------------------------------------------------------------

export function PicklePlayAds({ editRequest, onEditing }: { editRequest?: { id: string; at: number } | null; onEditing?: (id: string | null) => void } = {}) {
  const [state, setState] = useState<Saved>(fresh)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [overflow, setOverflow] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [photos, setPhotos] = useState<Record<AdKind, string | null>>(() => perKind(() => null))
  const [courtLogo, setCourtLogo] = useState<CourtLogo | null>(null)
  const [manifest, setManifest] = useState<AdManifest | null>(null)
  const [when, setWhen] = useState<{ day: string; time: string | null }>(() => ({ day: dayKeyOf(new Date()), time: null }))
  const [editing, setEditing] = useState<Editing | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const desktop = useDesktop()
  const fileInput = useRef<HTMLInputElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  const editBar = useRef<HTMLDivElement>(null)

  // localStorage is only readable in the browser: load after the first render.
  useEffect(() => {
    const restore = () => {
      setState(load())
      setPhotos(loadPhotos())
      setCourtLogo(loadLogo())
      setReady(true)
    }
    restore()
    loadManifest().then(setManifest, () => toast.error("The templates didn't load. Reload the page."))
  }, [])
  // While a scheduled ad is edited, the editor's own draft stays saved as it was (it comes back after).
  const isEditing = !!editing
  useEffect(() => {
    if (ready && !isEditing) save(state)
  }, [state, ready, isEditing])

  const kind = state.kind
  const k = state.byKind[kind]
  const sample = !k.content
  const nextNumber = state.next[kind]
  // The same object between renders (the previews redraw only when it changes).
  const content: AdContent = useMemo(
    () => k.content ?? { ...SAMPLE_CONTENT[kind], ...("number" in SAMPLE_CONTENT[kind] ? { number: numberLabel(String(nextNumber)) } : {}) },
    [k.content, kind, nextNumber],
  )
  const shown = useDeferredValue(content)
  const photo = usePhotoImage(photos[kind])
  const templateHasPhoto = !manifest || hasPhoto(manifest, k.template)
  const court = isCourtKind(kind)
  const logoImage = usePhotoImage(court ? courtLogo?.shown ?? null : null)
  const logoLook = useMemo<LogoLook | null>(() => (court ? { image: logoImage, adjust: k.logoAdjust } : null), [court, logoImage, k.logoAdjust])
  const adjust = k.logoAdjust?.[k.template] ?? NO_ADJUST
  const templateHasLogo = !manifest || hasLogo(manifest, k.template)

  const keepLogo = (next: CourtLogo | null, persist = !editing) => {
    setCourtLogo(next)
    if (!persist) return
    try {
      if (next) localStorage.setItem(LOGO_STORE, JSON.stringify(next))
      else localStorage.removeItem(LOGO_STORE)
    } catch {
      toast.info("The logo is used now, but it's too big to keep after closing the app.")
    }
  }

  const addLogo = async (file: Blob, clearBackground = courtLogo?.clearBackground ?? true) => {
    try {
      const original = await logoOriginal(file)
      const { dataUrl, removed } = await prepareLogo(original, clearBackground)
      keepLogo({ original, shown: dataUrl, clearBackground })
      toast.success("Logo added", { description: removed ? "Its background was made transparent and the empty edges trimmed." : "It fits the logo's place on every template." })
    } catch (e) {
      toast.error("Couldn't use that logo", { description: errorMessage(e) })
    }
  }

  const setClearBackground = async (on: boolean) => {
    if (!courtLogo) return
    try {
      const { dataUrl } = await prepareLogo(courtLogo.original, on)
      keepLogo({ ...courtLogo, shown: dataUrl, clearBackground: on })
    } catch (e) {
      toast.error("Couldn't change the logo", { description: errorMessage(e) })
    }
  }

  const pasteLogo = async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"))
        if (type) return void addLogo(await item.getType(type))
      }
      toast.info("No picture on the clipboard", { description: "Copy the court's logo, then click Paste logo." })
    } catch {
      toast.info("Copy the logo, then click Paste logo again (or choose the file).")
    }
  }

  const setAdjust = (patch: Partial<LogoAdjust>) => patchKind({ logoAdjust: { ...k.logoAdjust, [k.template]: { ...adjust, ...patch } } })

  /** Back to the template as designed: its sample text, photo and logo. Undo puts it all back. */
  const useDefaultTemplate = () => {
    const before = { k, photo: photos[kind], logo: courtLogo }
    patchKind({ content: null, caption: "", sources: undefined, logoAdjust: undefined })
    if (photos[kind]) setPhoto(null)
    if (court && courtLogo) keepLogo(null)
    toast.success("Back to the default template", {
      description: court ? "The template's own text, photo and logo." : "The template's own text and photo.",
      action: {
        label: "Undo",
        onClick: () => {
          patchKind(before.k)
          if (before.photo) setPhoto(before.photo)
          if (before.logo) keepLogo(before.logo)
        },
      },
    })
  }

  const setPhotoFor = (of: AdKind, dataUrl: string | null, persist = !editing) => {
    setPhotos((p) => ({ ...p, [of]: dataUrl }))
    if (!persist) return
    try {
      if (dataUrl) localStorage.setItem(PHOTO_STORE(of), dataUrl)
      else localStorage.removeItem(PHOTO_STORE(of))
    } catch {
      toast.info("The photo is used now, but it's too big to keep after closing the app.")
    }
  }
  const setPhoto = (dataUrl: string | null) => setPhotoFor(kind, dataUrl)

  const addPhoto = async (file: Blob) => {
    try {
      setPhoto(await photoDataUrl(file))
    } catch (e) {
      toast.error("Couldn't use that photo", { description: errorMessage(e) })
    }
  }

  const onPaste = (e: ClipboardEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("input, textarea")) return
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"))
    if (!file) return
    e.preventDefault()
    void addPhoto(file)
  }

  const pasteFromClipboard = async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"))
        if (type) return void addPhoto(await item.getType(type))
      }
      toast.info("No picture on the clipboard", { description: "Copy a picture, then click Paste (or click the preview and press Ctrl+V)." })
    } catch {
      toast.info("Click the preview and press Ctrl+V to paste the picture.")
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"))
    if (file) void addPhoto(file)
  }

  const setKind = (next: AdKind) => setState((s) => ({ ...s, kind: next }))
  const patchKind = (patch: Partial<KindState>) => setState((s) => ({ ...s, byKind: { ...s.byKind, [s.kind]: { ...s.byKind[s.kind], ...patch } } }))
  const patchContent = (key: string, value: unknown) => patchKind({ content: { ...content, [key]: value } as AdContent })

  const generate = async () => {
    setBusy(true)
    try {
      const number = numberLabel(String(state.next[kind]))
      const typed = content as unknown as Record<string, string>
      const post = await writePickleballPost({
        kind,
        topic: k.topic.trim(),
        avoid: state.posted[kind].slice(-60),
        number,
        ...(court
          ? {
              article: k.article ?? "",
              // Typed details only (the template's "Court Name" sample isn't a court).
              court: {
                name: k.content ? typed.courtName ?? "" : "",
                barangay: k.content ? typed.barangay ?? "" : "",
                city: k.content ? typed.city ?? "" : "",
                hours: k.content ? typed.hours ?? "" : "",
              },
            }
          : {}),
      })
      setState((s) => ({
        ...s,
        byKind: { ...s.byKind, [kind]: { ...s.byKind[kind], content: post.content, caption: post.facebookCaption, sources: post.sources, searchedTopic: !!k.topic.trim() } },
        posted: { ...s.posted, [kind]: post.topic ? [...s.posted[kind].filter((t) => t !== post.topic), post.topic].slice(-80) : s.posted[kind] },
      }))
      if (post.fellBack) toast.warning("Your AI key didn't work, so the built-in Groq wrote it", { description: post.fellBack })
    } catch (e) {
      toast.error("Couldn't write the post", { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  /** After a poster is downloaded or saved, the next one gets the next number. */
  const used = () => {
    if (!("number" in content)) return
    const n = Number(numberLabel(content.number))
    setState((s) => (n >= s.next[kind] ? { ...s, next: { ...s.next, [kind]: n + 1 } } : s))
  }

  const download = async (ids: AdTemplateId[]) => {
    setSaving(ids.length > 1 ? "all" : "download")
    try {
      for (const id of ids) downloadBlob(await posterBlob(id, content, photo, logoLook), fileName(id, content))
      used()
      toast.success(ids.length > 1 ? `${ids.length} posters downloaded` : "Poster downloaded")
    } catch (e) {
      toast.error("Couldn't download the poster", { description: errorMessage(e) })
    } finally {
      setSaving(null)
    }
  }

  const saveToFolder = async () => {
    if (!desktop?.savePoster) return
    setSaving("folder")
    try {
      const blob = await posterBlob(k.template, content, photo, logoLook)
      const file = await desktop.savePoster(fileName(k.template, content), new Uint8Array(await blob.arrayBuffer()))
      used()
      toast.success("Poster saved", {
        description: file,
        action: desktop.showFile ? { label: "Show in folder", onClick: () => void desktop.showFile?.(file) } : undefined,
      })
    } catch (e) {
      toast.error("Couldn't save the poster", { description: errorMessage(e) })
    } finally {
      setSaving(null)
    }
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(k.caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy. Select the caption and press Ctrl+C.")
    }
  }

  // ---------- scheduling, and editing a scheduled ad from the calendar ----------

  const check = useAdTimeCheck({ brand: "pickleplay", day: when.day, typed: when.time, editing: editing?.ad ?? null })
  const blocked = sample ? (court ? "Type the court’s details or write the words first." : `Generate the ${SINGULAR[kind]} with AI (or type it) first.`) : null

  /** The ad as it is in the editor now, at a day and time. */
  const draftOf = (day: string, time: string): AdDraft => ({
    brand: "pickleplay",
    kind,
    template: k.template,
    content,
    caption: k.caption,
    photo: photos[kind],
    logo: court ? courtLogo : null,
    logoAdjust: court ? (k.logoAdjust ?? null) : null,
    day,
    time,
  })

  const schedule = async () => {
    if (!check.time || check.problem || blocked) return
    setScheduling(true)
    try {
      const ad = await createAd(draftOf(when.day, check.time))
      used()
      setWhen((w) => ({ ...w, time: null }))
      toast.success(`Scheduled: ${adTimeLabel(ad.time)} ${ad.kindLabel}`, {
        description: `${format(dayOfKey(ad.day), "EEEE, MMM d")} · on the Advertisement calendar (Edit there to change it)${ad.caption.trim() ? "" : " · it has no Facebook caption yet"}`,
      })
    } catch (e) {
      toast.error("Couldn't schedule the ad", { description: errorMessage(e) })
    } finally {
      setScheduling(false)
    }
  }

  /** Opens a scheduled ad in the editor (the editor's own draft comes back after Save changes or Cancel). */
  const enterEdit = (ad: ScheduledAd) => {
    const prev = editing?.before ?? { kind: state.kind, kinds: {} }
    const before: Editing["before"] = { ...prev, kinds: { ...prev.kinds } }
    if (!before.kinds[ad.kind]) before.kinds[ad.kind] = { state: state.byKind[ad.kind], photo: photos[ad.kind] }
    if (isCourtKind(ad.kind) && !before.logo) before.logo = { value: courtLogo }
    setState((s) => ({
      ...s,
      kind: ad.kind,
      byKind: { ...s.byKind, [ad.kind]: { ...s.byKind[ad.kind], content: ad.content, template: ad.template, caption: ad.caption, logoAdjust: ad.logoAdjust ?? undefined } },
    }))
    setPhotoFor(ad.kind, ad.photo, false)
    if (isCourtKind(ad.kind)) keepLogo(ad.logo, false)
    setWhen({ day: ad.day, time: ad.time })
    setEditing({ ad, before })
    onEditing?.(ad.id)
  }

  /** Back to the editor's own draft. */
  const leaveEdit = () => {
    if (!editing) return
    const { before } = editing
    setState((s) => {
      const byKind = { ...s.byKind }
      for (const [id, v] of Object.entries(before.kinds)) byKind[id as AdKind] = v.state
      return { ...s, kind: before.kind, byKind }
    })
    setPhotos((p) => {
      const next = { ...p }
      for (const [id, v] of Object.entries(before.kinds)) next[id as AdKind] = v.photo
      return next
    })
    if (before.logo) setCourtLogo(before.logo.value)
    setEditing(null)
    setWhen({ day: dayKeyOf(new Date()), time: null })
    onEditing?.(null)
  }

  const saveChanges = async () => {
    if (!editing || !check.time || check.problem || blocked) return
    setScheduling(true)
    try {
      const { ad, changed } = await updateAd(editing.ad.id, draftOf(when.day, check.time))
      if (changed)
        toast.success(`Changes saved: the ${adTimeLabel(ad.time)} ${ad.kindLabel} ad`, {
          description: ad.facebook ? "The Facebook post itself doesn’t change." : "The Chrome extension posts this version.",
        })
      else toast.info("Nothing changed", { description: `The ${adTimeLabel(ad.time)} ${ad.kindLabel} ad is as it was.` })
      leaveEdit()
    } catch (e) {
      toast.error("Couldn't save the changes", { description: errorMessage(e) })
    } finally {
      setScheduling(false)
    }
  }

  // The calendar's Edit (once the editor's own state is loaded).
  const enterRef = useRef(enterEdit)
  const leaveRef = useRef(leaveEdit)
  useEffect(() => {
    enterRef.current = enterEdit
    leaveRef.current = leaveEdit
  })
  const asked = useRef<number | null>(null)
  useEffect(() => {
    if (!ready || !editRequest || asked.current === editRequest.at) return
    asked.current = editRequest.at
    getAd(editRequest.id).then(
      (ad) => {
        if (ad) enterRef.current(ad)
        else toast.error("This ad was deleted.")
      },
      (e) => toast.error("Couldn't open the ad", { description: errorMessage(e) }),
    )
  }, [ready, editRequest])

  // The ad being edited: deleted, or scheduled / posted from Chrome meanwhile.
  const editingId = editing?.ad.id ?? null
  useEffect(() => {
    if (!editingId) return
    editBar.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    return subscribeAds(() => {
      void getAd(editingId).then((ad) => {
        if (!ad) {
          toast.info("The ad you were editing was deleted", { description: "The editor is back to your own draft." })
          leaveRef.current()
          return
        }
        setEditing((e) => (e && e.ad.id === ad.id ? { ...e, ad: { ...e.ad, facebook: ad.facebook, postedAt: ad.postedAt, postedRevision: ad.postedRevision } } : e))
      }, () => {})
    })
  }, [editingId])

  const fieldValue = (key: string) => String((content as unknown as Record<string, unknown>)[key] ?? "")
  const tn = templateNumber(k.template)
  const allFields = [...FIELDS[kind], ...(court ? COURT_FIELDS[kind] : [])]
  const overflowLabels = overflow.map((f) => allFields.find((x) => x.key === f)?.label ?? (f === "choices" ? "Choices" : f))
  const fieldInput = (f: Field) => {
    const value = fieldValue(f.key)
    const over = value.length > f.max
    const off = f.only && !f.only.includes(tn)
    return (
      <div key={f.key} className={cn("flex flex-col gap-1", off && "opacity-55")}>
        <Label htmlFor={`ad-${f.key}`} className="flex items-center justify-between gap-2 text-xs">
          <span>
            {f.label}
            {f.only && <span className="ml-1.5 font-normal text-muted-foreground">(template {f.only.join(", ")})</span>}
          </span>
          <span className={cn("tabular-nums", over ? "font-medium text-amber-600 dark:text-amber-400" : "font-normal text-muted-foreground")}>
            {value.length}/{f.max}
          </span>
        </Label>
        {f.long ? (
          <Textarea id={`ad-${f.key}`} value={value} onChange={(e) => patchContent(f.key, e.target.value)} rows={3} className="resize-y text-sm" />
        ) : (
          <Input id={`ad-${f.key}`} value={value} onChange={(e) => patchContent(f.key, e.target.value)} placeholder={f.hint} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {editing && (
        <div ref={editBar} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 shadow-sm" role="status">
          <PencilLine className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Editing the {adTimeLabel(editing.ad.time)} {editing.ad.kindLabel} ad · {format(dayOfKey(editing.ad.day), "MMM d")}
            </p>
            {editing.ad.facebook ? (
              <p className="mt-0.5 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                It&apos;s already {editing.ad.facebook === "posted" ? "posted" : "scheduled"} on Facebook: saving here won&apos;t change the Facebook post itself.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">Change the words, photo, template, caption or time, then save. The Chrome extension posts the newest version.</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" onClick={() => void saveChanges()} disabled={scheduling || !!check.problem || !check.time || !!blocked} title={check.problem?.message ?? blocked ?? undefined}>
              {scheduling ? <Loader2 className="animate-spin" /> : <Save />} Save changes
            </Button>
            <Button type="button" variant="outline" onClick={leaveEdit} disabled={scheduling}>
              <X /> Cancel
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        {/* Left: what to make */}
        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Post type</h2>
            <div className="grid grid-cols-3 gap-1 rounded-xl border bg-card p-1" role="tablist" aria-label="Post type">
              {AD_KINDS.map((t) => {
                const Icon = KIND_ICON[t.id]
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={kind === t.id}
                    onClick={() => setKind(t.id)}
                    disabled={!!editing && kind !== t.id}
                    title={editing && kind !== t.id ? "Save or cancel the ad you're editing first" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40",
                      kind === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {t.short}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Template</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                onClick={useDefaultTemplate}
                disabled={sample && !photos[kind] && !(court && courtLogo) && !k.logoAdjust}
                title="Use the template as designed: its own text, photo and logo"
              >
                <LayoutTemplate /> Default template
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Template">
              {adTemplates(kind).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={k.template === id}
                  aria-label={kind === "courtowner" ? `Day ${templateNumber(id)}` : `Template ${templateNumber(id)}`}
                  onClick={() => patchKind({ template: id })}
                  className={cn(
                    "relative overflow-hidden rounded-lg border-2 transition-all",
                    k.template === id ? "border-primary ring-2 ring-primary/30" : "border-transparent opacity-80 hover:opacity-100",
                  )}
                >
                  <AdCanvas id={id} content={SAMPLE_CONTENT[kind]} photo={photo} logo={logoLook} size={240} />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">
                    {kind === "courtowner" ? `Day ${templateNumber(id)}` : templateNumber(id)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {court && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="The court">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <MapPin className="size-4" /> The court
              </h2>
              <p className="-mt-1 text-xs text-muted-foreground">Shown exactly as you type it on every template (the AI never changes these).</p>
              {COURT_FIELDS[kind].map(fieldInput)}
            </section>
          )}

          <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            {court ? (
              <>
                <Label htmlFor="ad-article" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Article or announcement <span className="font-normal normal-case">(optional)</span>
                </Label>
                <Textarea
                  id="ad-article"
                  value={k.article ?? ""}
                  onChange={(e) => patchKind({ article: e.target.value })}
                  rows={4}
                  placeholder="Paste a post, article or note about the court (its opening, its courts, what’s special). The AI writes the hook words from it."
                  className="resize-y text-sm"
                />
                <Label htmlFor="ad-topic" className="mt-1 text-xs text-muted-foreground">
                  Angle <span className="font-normal">(optional)</span>
                </Label>
                <Input id="ad-topic" value={k.topic} onChange={(e) => patchKind({ topic: e.target.value })} placeholder={TOPIC_HINT[kind]} maxLength={160} />
                <p className="text-xs text-muted-foreground">
                  The AI writes new hook words each time (tag, headline, highlight, details, call to action and the caption). The court&apos;s name, barangay, city
                  {kind === "nowopen" ? " and hours" : ""} stay as typed; with an article, the AI fills in the ones you left empty.
                </p>
              </>
            ) : (
              <>
                <Label htmlFor="ad-topic" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Topic <span className="font-normal normal-case">(optional)</span>
                </Label>
                <Input id="ad-topic" value={k.topic} onChange={(e) => patchKind({ topic: e.target.value })} placeholder={TOPIC_HINT[kind]} maxLength={160} />
                <p className="text-xs text-muted-foreground">
                  {kind === "courtowner"
                    ? "Leave it empty for a new angle each time. The AI writes only what PicklePlay offers court owners and never repeats an ad you already made."
                    : "Leave it empty for a new fact each time. The AI writes from checked pickleball facts and never repeats one you already made."}
                </p>
              </>
            )}
            <Button type="button" onClick={() => void generate()} disabled={busy} className="mt-1 bg-[#B6F23A] text-[#091B5C] hover:bg-[#a6e02c]">
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {busy ? "Writing…" : court ? (k.caption ? "Write new words with AI" : "Write the words with AI") : sample ? `Generate ${SINGULAR[kind]} with AI` : `New ${SINGULAR[kind]}`}
            </Button>
            {k.content && kind !== "courtowner" && !court && (
              <SourceLinks
                sources={k.sources ?? []}
                title={k.searchedTopic ? `Sources: the ${(k.sources ?? []).length} web pages searched for “${k.topic.trim() || "the topic"}”` : `Sources to check this fact (${(k.sources ?? []).length} web pages)`}
                className="mt-1"
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              Writing with {posterAiLabel()}.{" "}
              {state.posted[kind].length
                ? kind === "courtowner" || court
                  ? `${state.posted[kind].length} ${SINGULAR[kind].toLowerCase()}${state.posted[kind].length === 1 ? "" : "s"} made so far.`
                  : `${state.posted[kind].length} ${SINGULAR[kind].toLowerCase()} fact${state.posted[kind].length === 1 ? "" : "s"} made so far.`
                : ""}
            </p>
          </section>

          {court && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Court logo">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Court logo</h2>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void pasteLogo()}>
                  <ClipboardPaste /> Paste logo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => logoInput.current?.click()}>
                  <ImagePlus /> Choose logo
                </Button>
                {courtLogo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => keepLogo(null)}>
                    <ImageOff /> Use the template&apos;s logo
                  </Button>
                )}
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Choose the court's logo"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    if (file) void addLogo(file)
                  }}
                />
              </div>
              <label className={cn("flex items-center justify-between gap-3 text-sm", !courtLogo && "opacity-55")}>
                <span>
                  Transparent background
                  <span className="block text-xs text-muted-foreground">A plain (white or one-color) background is removed, like the sample logo.</span>
                </span>
                <Switch checked={courtLogo?.clearBackground ?? true} disabled={!courtLogo} onCheckedChange={(on) => void setClearBackground(on)} aria-label="Transparent background" />
              </label>
              <div className={cn("flex flex-col gap-2.5", !templateHasLogo && "opacity-55")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">On template {tn}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => setAdjust(NO_ADJUST)} disabled={adjust.scale === 1 && adjust.dx === 0 && adjust.dy === 0}>
                    <RotateCcw /> Reset
                  </Button>
                </div>
                {(
                  [
                    ["scale", "Size", 0.4, 1.6, 0.01, (v: number) => `${Math.round(v * 100)}%`],
                    ["dx", "Left – right", -0.5, 0.5, 0.01, (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}`],
                    ["dy", "Up – down", -0.5, 0.5, 0.01, (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}`],
                  ] as const
                ).map(([key, label, min, max, step, show]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
                    <Slider value={[adjust[key]]} min={min} max={max} step={step} onValueChange={([v]) => setAdjust({ [key]: v })} aria-label={`Logo ${label.toLowerCase()}`} disabled={!templateHasLogo} />
                    <span className="w-11 shrink-0 text-right text-xs tabular-nums">{show(adjust[key])}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">The logo fits the sample logo&apos;s place on every template; size and position are set per template.</p>
            </section>
          )}

          <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-label="Background photo">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Background photo</h2>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void pasteFromClipboard()}>
                <ClipboardPaste /> Paste
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                <ImagePlus /> Choose photo
              </Button>
              {photos[kind] && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)}>
                  <ImageOff /> Use the template&apos;s photo
                </Button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Choose a background photo"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) void addPhoto(file)
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {templateHasPhoto
                ? `Or drop a photo on the preview, or click it and press Ctrl+V. It fills the court photo's place (with the same see-through look) on every ${SINGULAR[kind]} template.`
                : `Template ${tn} has no background photo; the photo shows on the other ${SINGULAR[kind]} templates.`}
            </p>
          </section>

          {(!sample || court) && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <PencilLine className="size-4" /> {court ? "The words" : "Edit the text"}
                </h2>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => patchKind({ content: null, caption: "" })} title="Back to the template's sample text">
                  <RotateCcw /> Clear
                </Button>
              </div>
              {FIELDS[kind].map(fieldInput)}
              {content.kind === "trivia" && (
                <div className={cn("flex flex-col gap-1.5", tn !== 2 && "opacity-55")}>
                  <Label className="text-xs">
                    Choices <span className="ml-1 font-normal text-muted-foreground">(template 2 · tick the right one)</span>
                  </Label>
                  {content.choices.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => patchContent("correct", i)}
                        aria-label={`${"ABCD"[i]} is the right answer`}
                        aria-pressed={content.correct === i}
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                          content.correct === i ? "border-[#91c51f] bg-[#B6F23A] text-[#091B5C]" : "text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {content.correct === i ? <Check className="size-4" /> : "ABCD"[i]}
                      </button>
                      <Input
                        value={c}
                        onChange={(e) => patchContent("choices", content.choices.map((x, j) => (j === i ? e.target.value : x)))}
                        aria-label={`Choice ${"ABCD"[i]}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right: the poster */}
        <div className="flex min-w-0 flex-col gap-4">
          <div
            className="relative mx-auto w-full max-w-[720px] rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
            tabIndex={0}
            aria-label="Poster preview: drop or paste a background photo here"
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <AdCanvas id={k.template} content={shown} photo={photo} logo={logoLook} className="rounded-xl border shadow-sm" onOverflow={setOverflow} />
            {sample && (
              <span className="absolute top-3 left-3 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">
                {court ? "Sample text · type the court’s details or press Generate" : "Sample text · press Generate"}
              </span>
            )}
          </div>
          {overflow.length > 0 && !sample && (
            <p className="mx-auto flex w-full max-w-[720px] items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Too long for template {tn} even at the smallest size: {overflowLabels.join(", ")}. Shorten it a little.
            </p>
          )}
          <div className="mx-auto flex w-full max-w-[720px] flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void download([k.template])} disabled={!!saving}>
              {saving === "download" ? <Loader2 className="animate-spin" /> : <Download />} Download PNG
            </Button>
            {desktop?.savePoster && (
              <Button type="button" variant="outline" onClick={() => void saveToFolder()} disabled={!!saving}>
                {saving === "folder" ? <Loader2 className="animate-spin" /> : <FolderOpen />} Save to poster folder
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => void download(adTemplates(kind))} disabled={!!saving}>
              {saving === "all" ? <Loader2 className="animate-spin" /> : <Images />} Download all {adTemplates(kind).length}
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {AD_SIZE} × {AD_SIZE} PNG
            </span>
          </div>

          <section className="mx-auto w-full max-w-[720px]">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {kind === "courtowner" ? "The ad on every day of the week" : "The same post on every template"}
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {adTemplates(kind).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patchKind({ template: id })}
                  aria-label={kind === "courtowner" ? `Use Day ${templateNumber(id)}` : `Use template ${templateNumber(id)}`}
                  className={cn("overflow-hidden rounded-lg border-2", k.template === id ? "border-primary" : "border-transparent hover:border-muted-foreground/30")}
                >
                  <AdCanvas id={id} content={shown} photo={photo} logo={logoLook} size={360} />
                </button>
              ))}
            </div>
          </section>

          {!sample && (
            <section className="mx-auto flex w-full max-w-[720px] flex-col gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ad-caption" className="text-sm font-semibold">
                  Facebook caption
                </Label>
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => void copyCaption()} disabled={!k.caption.trim()}>
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Textarea id="ad-caption" value={k.caption} onChange={(e) => patchKind({ caption: e.target.value })} rows={5} className="resize-y text-sm" />
              <p className="text-[11px] text-muted-foreground">Check the facts before posting.</p>
            </section>
          )}

          <AdScheduleCard
            brand="pickleplay"
            day={when.day}
            check={check}
            onDay={(day) => setWhen((w) => ({ day, time: editing ? (w.time ?? check.time) : null }))}
            onTime={(time) => setWhen((w) => ({ ...w, time }))}
            editing={editing?.ad ?? null}
            blocked={blocked}
            busy={scheduling}
            onSchedule={() => void schedule()}
            onSave={() => void saveChanges()}
            onCancel={leaveEdit}
          />
        </div>
      </div>
    </div>
  )
}
