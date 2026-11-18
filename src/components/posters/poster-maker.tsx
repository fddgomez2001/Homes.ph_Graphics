"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ClipboardEvent, type DragEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format, isToday, isValid, parse, startOfDay } from "date-fns"
import {
  CalendarClock,
  Check,
  ChevronLeft,
  Copy,
  ChevronRight,
  ClipboardPaste,
  Database,
  Download,
  FolderOpen,
  ImagePlus,
  Loader2,
  MapPin,
  MessageSquareText,
  ClipboardList,
  PencilLine,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app-shell/page-header"
import { useProjectSlides } from "@/components/board/slide-renders"
import { useExport } from "@/components/export/export-provider"
import { invalidateProjects, useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  applyNewsChange,
  createNewsArticle,
  newsCredit,
  newsHeadline,
  newsEvent,
  newsHighlight,
  newsPage,
  newsPhotoFrame,
  newsSubtextLook,
  newsSubtextState,
  newsTag,
  newsPhotoFilter,
  storeNewsPhoto,
  updateNewsArticle,
  type NewsChange,
  type NewsCredit,
  type NewsPhoto,
  type PhotoFrame,
} from "@/lib/data/news"
import { listPostPages } from "@/lib/data/posting"
import { getProject, getProjectSlides, onProjectSaved, projectFeatures, updateProject } from "@/lib/data/projects"
import { useCachedQuery } from "@/lib/cache"
import { combineDateTime } from "@/lib/dates"
import {
  DEFAULT_HOMES_PAGES,
  GENSAN_PAGE,
  getNewsTemplate,
  HOMES_POSTER_PAGE,
  pageDisplayName,
  EVENT_POSTER_TEMPLATE_IDS,
  isEventPosterTemplate,
  isPosterTemplate,
  posterKindOf,
  POSTER_LAYOUTS,
  posterLayoutOf,
  posterTemplateId,
  type PosterLayout,
  newsFileName,
  newsPostLabel,
  newsTimeLabel,
  RENTSOUQ_BRAND,
  type NewsTime,
} from "@/lib/design/news-templates"
import { DESIGN_THUMB, designHasSecondLine, isDesignPoster, POSTER_DESIGN_COUNT, posterDesignOf } from "@/lib/design/poster-designs"
import { normalizeDesign } from "@/lib/design/normalize"
import { loadImage } from "@/lib/design/image-cache"
import { isOpenInEditor, settleUploadsOf } from "@/lib/image-sync"
import {
  autoSubtextHook,
  isPosterSubtext,
  NEWS_HEADLINE_PLACEHOLDER,
  POSTER_CREDIT_PREFIX,
  POSTER_SAMPLE_HIGHLIGHT,
  POSTER_SUBTEXT_COLORS,
  POSTER_SUBTEXT_DARK,
  POSTER_SUBTEXT_SIZE,
} from "@/lib/design/templates"
import type { SlideDesign, SubtextStyle, TextElement } from "@/lib/design/types"
import { suggestPosterCaption, suggestTrendDetails } from "@/lib/ai/client"
import { DETAILS_MAX } from "@/lib/ai/headlines"
import { captionForPost } from "@/lib/ai/types"
import { useDesktop, type DesktopFolders } from "@/lib/desktop"
import {
  canEnhancePhoto,
  EnhanceCancelled,
  enhancePhoto,
  getAutoEnhance,
  imageToBlob,
  photoNeedsEnhance,
  setAutoEnhance,
  subscribeAutoEnhance,
} from "@/lib/photo-enhance"
import type { ProjectRow, SlideRow } from "@/lib/types"
import { cn, errorMessage } from "@/lib/utils"
import { ArticleHeadlineDialog } from "./article-headline-dialog"
import { articleMemoryOf, articleScope, captionFor, loadArticleMemory, posterArticleScope, rememberCaption } from "./article-memory"
import { HighlightField } from "./highlight-field"
import { PhotoFrameControls, usePhotoFrame } from "./photo-frame"
import { PosterBrandTabs, PosterDayBoard, RENTSOUQ_DELETE_NOTE, UpcomingPosters, useDeletePoster } from "./poster-board"
import { NoPagesAssigned } from "@/components/pages/page-tabs"
import { useAssignment } from "@/lib/assignment"
import { homesPage, homesPageByName, sitePage, type SitePageKey } from "@/lib/pages"
import {
  brandForPage,
  dayQuery,
  inScope,
  isPosterTabParam,
  LOOK_BRAND,
  lookDesign,
  lookOfTab,
  nextPosterTime,
  pageFromSlug,
  POSTER_BRANDS,
  posterBrandOf,
  posterPageOf,
  readLastBrand,
  readLastPage,
  rememberBrand,
  rememberPage,
  RENTSOUQ_ACCENT,
  rentsouqLayoutOf,
  scopeName,
  tabOfBrand,
  tabOfParam,
  ymd,
  type PosterBrand,
  type PosterLook,
  type PosterScope,
  type PosterTab,
  type PosterTabParam,
} from "./poster-shared"
import { pageSlug, samePage } from "@/lib/ai/homes-places"
import { brandPostId, brandPostTemplate, isPostKind, type PostBrand } from "@/lib/brand-templates/catalog"
import type { BrandPostKind } from "@/lib/brand-templates/types"
import { BrandPostEditor } from "./brand-post-editor"
import { PhotoFilterChips, PostKindNav, rememberKind, readLastKind, TemplateGallery } from "./post-kind-nav"

/** The last photographer's name typed (filled in when the credit is turned on). */
const CREDIT_NAME_KEY = "dcm-poster-credit-name"

/** "news": headline only. "event": LOCATION and DATE & TIME under the headline (tournaments, games, new courts). */
type PosterFormat = "news" | "event"
const hasEventPoster = (brand: PosterBrand) => !!EVENT_POSTER_TEMPLATE_IDS[brand]
/**
 * The brand's poster template: one of the brand's poster templates 01–11 (1.52, `post`: "01"), or news or event,
 * New Template (1126 × 1408) or Old Template (1254 × 1254), or a Homes.ph design 1–10 (1.51).
 */
const templateIdOf = (brand: PosterBrand, format: PosterFormat = "news", layout: PosterLayout = "portrait", design: number | null = null, post: string | null = null) =>
  post ? brandPostId(brand as PostBrand, "news", post) : posterTemplateId(brand, format, layout, design)!
/** A news poster's brand template number ("01"…"11"), or null on the older templates. */
const postOf = (templateId: string | null | undefined) => {
  const t = brandPostTemplate(templateId)
  return t?.kind === "news" ? t.def.num : null
}
/** Bayanihan has the 1.52 templates only. */
const hasOlderTemplates = (brand: PosterBrand) => brand !== "bayanihan"
/** Who the poster is for: "PicklePlay PH", "Homes.ph BGC Taguig". */
const posterLabel = (d: Pick<Draft, "brand" | "page">) => newsPostLabel(d.brand, d.brand === "homes" ? d.page : null)
const isHomesBrand = (brand: PosterBrand) => brand === "homes" || brand === "gensan"

/** The Homes.ph pages, from the posting checklist (the built-in list until it loads, or without it). */
function useHomesPages(): readonly string[] {
  const postPages = useCachedQuery("posting:pages", listPostPages, { freshFor: 24 * 3600_000 })
  return useMemo(() => (postPages.data?.length ? postPages.data.map((p) => p.name) : DEFAULT_HOMES_PAGES), [postPages.data])
}
/** A posting slot: brand (and Homes.ph page) at a time. Two Homes.ph pages can post at the same time. */

const noSubscribe = () => () => {}

interface Draft {
  brand: PosterBrand
  day: string
  /** null = the first free posting time of the day. */
  time: string | null
  headline: string
  highlight: string
  credit: NewsCredit
  /** Homes.ph posters: the Facebook page ("Homes.ph BGC Taguig"). */
  page: string
  format: PosterFormat
  /** New Template (1126 × 1408, the default) or Old Template (1254 × 1254). */
  layout: PosterLayout
  /** Homes.ph posters: one of the poster designs 1–10 (1.51), or null for the New / Old Template. */
  design: number | null
  /** One of the brand's poster templates 01–11 (1.52), or null for the older templates. */
  post: string | null
  /** Template 07's tag pill ("" = none, null = the template's own). */
  tag: string | null
  /** Event posters: under the headline. */
  location: string
  when: string
  /** News posters: the subtext under the headline ("" = headline only). */
  subtext: string
  /** Show the subtext (off: the text is kept, the poster is headline-only). */
  subtextOn: boolean
  /** How the subtext looks. */
  subtextStyle: SubtextStyle
  /** Highlight look: its words in the brand color ("" = picked automatically). */
  subtextHook: string
  /** The Facebook caption (text, blank line, hashtags), saved with the poster. */
  caption: string
  /** Daily report "Details" (Daily Trend News): what the news is about and why it's a trend. Saved as the poster's topic. */
  details: string
}

/** A new poster starts on the brand's poster template 01 (1.52, every brand). */
const DEFAULT_POST = "01"

function freshDraft(brand: PosterBrand, day = ymd(new Date()), time: string | null = null, page = ""): Draft {
  return { brand, day, time, headline: "", highlight: "", credit: { enabled: false, name: "" }, page, format: "news", layout: "portrait", design: null, post: DEFAULT_POST, tag: null, location: "", when: "", subtext: "", subtextOn: true, subtextStyle: "classic", subtextHook: "", caption: "", details: "" }
}

/** The text fields as a news change; an empty headline goes back to the sample text. */
function textChange(d: Draft): NewsChange {
  const headline = d.headline.replace(/\s+/g, " ").trim()
  const phrase = d.highlight.replace(/\s+/g, " ").trim()
  return {
    headline: headline || NEWS_HEADLINE_PLACEHOLDER,
    highlight: headline ? (phrase ? [phrase] : []) : [POSTER_SAMPLE_HIGHLIGHT],
    credit: { enabled: d.credit.enabled, name: d.credit.name },
    page: d.brand === "homes" ? d.page || null : null,
    ...(d.post && d.tag !== null ? { tag: d.tag } : {}),
    ...(d.format === "event"
      ? { event: { location: d.location, when: d.when } }
      : { subtext: d.subtext, subtextOn: d.subtextOn, subtextStyle: d.subtextStyle, subtextHook: d.subtextHook }),
  }
}

/** Waits until `current()` has stopped changing for 150 ms (600 ms at most). */
async function typingPause<T>(current: () => T) {
  const started = Date.now()
  for (;;) {
    const before = current()
    await new Promise((resolve) => setTimeout(resolve, 150))
    if (current() === before || Date.now() - started >= 600) return
  }
}

/**
 * Poster Maker: FHI Global Property, PicklePlay PH and Homes.ph posters: the New Template (1126 × 1408,
 * the default) or the Old Template (1254 × 1254), switched per poster.
 * Tabs: FHI Global Property, Rentsouq.ae (FHI's posters drawn on the Rentsouq.ae template, its own New / Old
 * choice per poster; nothing is saved as Rentsouq.ae), PicklePlay PH and Homes.ph (with a dropdown of every
 * Homes.ph page, each with its own posters); the chosen day shows the brand's (or page's) posters at their posting times
 * (any day, so posters can be made in advance), then the poster being made and the upcoming posters.
 * Posters are saved as news posts at their time but are kept apart from News Article, the phone's
 * News tab and the Daily Report.
 * URL: ?brand=pickleplay&day=2026-11-06, ?brand=homes&page=cebu, ?brand=rentsouq (&id=… an open poster, &time=09:00 a new one).
 */
export function PosterMaker() {
  const router = useRouter()
  const params = useSearchParams()
  const idParam = params.get("id")
  const brandParam = params.get("brand")
  const lastBrand = useSyncExternalStore(noSubscribe, readLastBrand, () => null)
  const lastPage = useSyncExternalStore(noSubscribe, readLastPage, () => null)
  const allPages = useHomesPages()
  // The assigned pages (1.50): their tabs only, and only their Homes.ph pages in the Homes.ph dropdown.
  const { assignment } = useAssignment()
  const pages = useMemo(() => assignment.homes.map((k) => allPages.find((n) => homesPageByName(n)?.key === k) ?? homesPage(k).name), [assignment.homes, allPages])
  // Poster, Did You Know or Engagement Posts (1.52).
  const kindParam = params.get("type")
  const lastKind = useSyncExternalStore(noSubscribe, readLastKind, () => null)
  const kind: BrandPostKind = isPostKind(kindParam) ? kindParam : (lastKind ?? "news")
  const tabs = useMemo(
    () =>
      (["fhi", "rentsouq", "pickleplay", "homes", "bayanihan"] as PosterTab[]).filter(
        // Rentsouq.ae is FHI's posters on its own template (Poster only).
        (t) => (t === "homes" ? assignment.homes.length > 0 : assignment.sites.includes(t) && (t !== "rentsouq" || kind === "news")),
      ),
    [assignment, kind],
  )
  // Assigned sites without poster templates (Filipino Homes, Bayanihan Dubai): a tab with a note.
  const extra = useMemo(
    () => assignment.sites.filter((k): k is SitePageKey => !["fhi", "rentsouq", "pickleplay", "bayanihan"].includes(k)).map((k) => ({ id: k, label: sitePage(k).name })),
    [assignment.sites],
  )
  const extraTab = extra.some((x) => x.id === brandParam) ? brandParam : !tabs.length && extra.length ? extra[0].id : null
  // ?brand=fhi | rentsouq | pickleplay | homes ("gensan" from before 1.38: the Homes.ph tab on the Gensan page).
  const wanted: PosterTabParam = isPosterTabParam(brandParam) ? brandParam : (lastBrand ?? "fhi")
  const asked: PosterTabParam = tabs.includes(tabOfParam(wanted)) ? wanted : (tabs[0] ?? "fhi")
  const tab: PosterTab = tabOfParam(asked)
  const pageParam = params.get("page")
  const assignedPage = (p: string | null | undefined) => (p && pages.some((n) => samePage(n, p)) ? p : null)
  const page =
    tab === "homes"
      ? (asked === "gensan" ? assignedPage(GENSAN_PAGE) : null) ??
        pageFromSlug(pageParam, pages) ??
        assignedPage(lastPage) ??
        assignedPage(HOMES_POSTER_PAGE) ??
        pages[0] ??
        HOMES_POSTER_PAGE
      : null
  // Rentsouq.ae: FHI's posters on the Rentsouq.ae template.
  const look = lookOfTab(tab)
  // A new poster's brand: the tab's (FHI on Rentsouq.ae), or the Homes.ph page's (the Gensan page has its own template).
  const brand: PosterBrand = page ? brandForPage(page) : asked === "rentsouq" ? LOOK_BRAND.rentsouq : asked
  const scope = useMemo<PosterScope>(() => ({ brand, page, look, kind }), [brand, page, look, kind])
  const dayParam = params.get("day")
  const day = useMemo(() => {
    const parsed = dayParam ? parse(dayParam, "yyyy-MM-dd", new Date()) : null
    return startOfDay(parsed && isValid(parsed) ? parsed : new Date())
  }, [dayParam])
  const timeParam = params.get("time")
  const [supported, setSupported] = useState<boolean | null>(null)
  // Which poster the form shows. A poster made here keeps its form (no reload) when its id lands in the URL.
  const [count, setCount] = useState(0)
  const newKey = `new-${kind}-${count}-${brand}-${page ? pageSlug(page) : ""}-${ymd(day)}-${timeParam ?? ""}`
  const [session, setSession] = useState<{ key: string; id: string | null; newKey: string; created: string | null }>({ key: idParam ?? newKey, id: idParam, newKey, created: null })
  if (idParam !== session.id || (!idParam && session.newKey !== newKey)) {
    // The poster just made here, while its id reaches the address (a render or two later): the same form,
    // never reloaded (a reload would drop what was typed meanwhile, e.g. the headline right after the photo).
    const catchingUp =
      !!session.created && (idParam === session.created || (idParam === null && session.id === session.created && newKey === session.newKey))
    setSession(catchingUp ? { ...session, id: idParam, newKey } : { key: idParam ?? newKey, id: idParam, newKey, created: null })
  }

  useEffect(() => {
    let cancelled = false
    projectFeatures().then(
      (f) => !cancelled && setSupported(f.news),
      () => !cancelled && setSupported(null),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const go = (next: { tab?: PosterTab; page?: string | null; day?: Date; id?: string | null; time?: string | null; kind?: BrandPostKind }, replace = false) => {
    const q = new URLSearchParams()
    const t = next.tab ?? tab
    const k = next.kind ?? kind
    if (k !== "news") q.set("type", k)
    // Rentsouq.ae has posters only: Did You Know and engagement posts are FHI's.
    q.set("brand", k !== "news" && t === "rentsouq" ? LOOK_BRAND.rentsouq : t)
    if (t === "homes") q.set("page", pageSlug(next.page ?? page ?? lastPage ?? HOMES_POSTER_PAGE))
    q.set("day", ymd(next.day ?? day))
    if (next.id) q.set("id", next.id)
    if (next.time) q.set("time", next.time)
    const url = `/posters?${q.toString()}`
    if (replace) router.replace(url, { scroll: false })
    else router.push(url, { scroll: false })
  }

  const pickExtra = (id: string) => router.push(`/posters?brand=${id}${kind !== "news" ? `&type=${kind}` : ""}`, { scroll: false })

  /** Poster, Did You Know or Engagement Posts: that navigation's posts of the tab (and day) shown. */
  const pickKind = (k: BrandPostKind) => {
    if (k === kind) return
    rememberKind(k)
    go({ kind: k })
  }

  const pickTab = (t: PosterTab) => {
    rememberBrand(t)
    // FHI ↔ Rentsouq.ae show the same posters: the poster open (or being made) stays open, on the other template.
    const twins = t !== tab && (t === "rentsouq" ? tab === LOOK_BRAND.rentsouq : t === LOOK_BRAND.rentsouq && tab === "rentsouq")
    go(twins ? { tab: t, id: session.id, time: session.id ? null : timeParam } : { tab: t })
  }

  /** Another Homes.ph page: its posters, records and trending-news keywords. */
  const pickPage = (p: string) => {
    rememberBrand("homes")
    rememberPage(p)
    go({ tab: "homes", page: p })
  }

  const startNew = (time?: string) => {
    setCount((n) => n + 1)
    go({ time: time ?? null })
    if (time) requestAnimationFrame(() => document.getElementById("poster-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  const open = (id: string, onDay?: Date) => {
    go({ id, day: onDay })
    requestAnimationFrame(() => document.getElementById("poster-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Poster Maker"
        description="Posters, Did You Know and engagement posts for your assigned pages, on each brand's templates. Separate from News Article."
      >
        <Button onClick={() => startNew()} disabled={supported === false || !tabs.length || !!extraTab}>
          <Plus /> {kind === "news" ? "New poster" : kind === "dyk" ? "New Did You Know" : "New engagement post"}
        </Button>
      </PageHeader>
      <div className="flex flex-1 flex-col gap-8 px-4 py-6 lg:px-8">
        {supported === false ? (
          <div className="flex max-w-3xl gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Database className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Turn on News Articles first</p>
              <p className="mt-1">
                Posters are saved like news posts. Run <code className="rounded bg-card/70 px-1">supabase/migrations/20261030000000_trash_and_news.sql</code> in the Supabase SQL
                Editor, then reload.
              </p>
            </div>
          </div>
        ) : !tabs.length && !extra.length ? (
          <NoPagesAssigned what="Poster Maker" />
        ) : extraTab ? (
          <div className="flex flex-col gap-5">
            <PostKindNav kind={kind} onChange={pickKind} />
            <PosterBrandTabs tab={tab} tabs={tabs} extra={extra} extraTab={extraTab} page={page} pages={pages} day={day} kind={kind} onChange={pickTab} onExtra={pickExtra} onPage={pickPage} />
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-14 text-center">
              <p className="font-medium">No poster template for {extra.find((x) => x.id === extraTab)?.label} yet</p>
              <p className="max-w-md text-sm text-muted-foreground">Send the Figma design and its posters can be made here like the other pages.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-5">
              <PostKindNav kind={kind} onChange={pickKind} />
              <PosterBrandTabs tab={tab} tabs={tabs} extra={extra} page={page} pages={pages} day={day} kind={kind} onChange={pickTab} onExtra={pickExtra} onPage={pickPage} />
              <PosterDayBoard
                scope={scope}
                day={day}
                currentId={session.id}
                onDay={(d) => go({ day: d })}
                onOpen={(id) => open(id)}
                onNew={(time) => startNew(time)}
                onDeleted={(id) => id === session.id && startNew()}
              />
            </div>
            <section id="poster-editor" className="scroll-mt-20 border-t pt-6" aria-label={session.id ? (kind === "news" ? "Poster" : "Post") : kind === "news" ? "New poster" : "New post"}>
              <h2 className="mb-4 text-base font-semibold">
                {kind === "news"
                  ? session.id
                    ? "Poster"
                    : `New ${scopeName(scope)} poster`
                  : `${session.id ? "" : "New "}${scopeName(scope)} ${kind === "dyk" ? "Did You Know post" : "engagement post"}`}
              </h2>
              {kind !== "news" ? (
                <BrandPostEditor
                  key={session.key}
                  kind={kind}
                  brand={brand}
                  initialPage={page}
                  pages={pages}
                  initialId={session.id}
                  initialDay={ymd(day)}
                  initialTime={timeParam}
                  onCreated={(id, onDay) => {
                    setSession((s) => ({ ...s, id, created: id }))
                    go({ id, day: parse(onDay, "yyyy-MM-dd", new Date()) }, true)
                  }}
                  onLoaded={(b, onDay, onPage, loadedKind) => {
                    const t = tabOfBrand(b)
                    if (loadedKind !== kind || t !== tab || (onPage && !samePage(onPage, page)) || onDay !== ymd(day))
                      go({ tab: t, page: onPage, day: parse(onDay, "yyyy-MM-dd", new Date()), id: session.id, kind: loadedKind }, true)
                  }}
                  onPage={(p) => {
                    rememberPage(p)
                    go({ tab: "homes", page: p, id: session.id }, true)
                  }}
                  onMoved={(onDay) => go({ day: parse(onDay, "yyyy-MM-dd", new Date()), id: session.id }, true)}
                  onDeleted={() => startNew()}
                />
              ) : (
              <PosterEditor
                key={session.key}
                brand={brand}
                look={look}
                initialPage={page}
                pages={pages}
                initialId={session.id}
                initialDay={ymd(day)}
                initialTime={timeParam}
                onCreated={(id, onDay) => {
                  setSession((s) => ({ ...s, id, created: id }))
                  go({ id, day: parse(onDay, "yyyy-MM-dd", new Date()) }, true)
                }}
                onLoaded={(b, onDay, onPage) => {
                  // An FHI poster stays on the Rentsouq.ae tab.
                  const t = look && b === LOOK_BRAND[look] ? tab : tabOfBrand(b)
                  if (t !== tab || (onPage && !samePage(onPage, page)) || onDay !== ymd(day))
                    go({ tab: t, page: onPage, day: parse(onDay, "yyyy-MM-dd", new Date()), id: session.id }, true)
                }}
                onPage={(p) => {
                  rememberPage(p)
                  go({ tab: "homes", page: p, id: session.id }, true)
                }}
                onMoved={(onDay) => go({ day: parse(onDay, "yyyy-MM-dd", new Date()), id: session.id }, true)}
                onDeleted={() => startNew()}
                onOtherKind={(k) => go({ id: session.id, kind: k }, true)}
              />
              )}
            </section>
            <UpcomingPosters scope={scope} currentId={session.id} onOpen={(id, d) => open(id, d)} />
          </>
        )}
      </div>
    </div>
  )
}

function PosterEditor({
  brand: initialBrand,
  look: tabLook,
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
  onOtherKind,
}: {
  /** An opened post is a Did You Know or engagement post (1.52): it opens in its own navigation. */
  onOtherKind: (kind: BrandPostKind) => void
  /** The tab's brand (a new poster's brand; an opened poster has its own). */
  brand: PosterBrand
  /** Rentsouq.ae tab: the FHI poster is shown, saved as a picture and downloaded on the Rentsouq.ae template. */
  look: PosterLook | null
  /** The Homes.ph page picked above (a new Homes.ph poster is for it). */
  initialPage: string | null
  /** Every Homes.ph page (the page field, and keywords added for every page). */
  pages: readonly string[]
  initialId: string | null
  initialDay: string
  /** A new poster's posting time ("09:00"), or null for the first free one. */
  initialTime: string | null
  onCreated: (id: string, day: string) => void
  /** An opened poster's brand, day and Homes.ph page (the page follows them). */
  onLoaded: (brand: PosterBrand, day: string, page: string | null) => void
  /** This poster moved to another Homes.ph page. */
  onPage: (page: string) => void
  /** A saved poster moved to another day. */
  onMoved: (day: string) => void
  /** This poster was deleted (moved to the Trash). */
  onDeleted: () => void
}) {
  const router = useRouter()
  const { runExport, busy: exporting } = useExport()
  const [rawDraft, setDraft] = useState<Draft>(() => {
    const valid = !!initialTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(initialTime)
    return freshDraft(initialBrand, initialDay, valid ? initialTime : null, isHomesBrand(initialBrand) ? (initialPage ?? "") : "")
  })
  // A Homes.ph poster is for the page picked above (Homes.ph CARAGA when there's none); Gensan posters for Homes.ph Gensan.
  const draft = useMemo(
    () =>
      rawDraft.brand === "gensan" && !samePage(rawDraft.page, GENSAN_PAGE)
        ? { ...rawDraft, page: GENSAN_PAGE }
        : rawDraft.brand === "homes" && !rawDraft.page
          ? { ...rawDraft, page: HOMES_POSTER_PAGE }
          : rawDraft,
    [rawDraft],
  )
  // The saved design with the changes made here (photo, brand); the text fields go on top for the preview.
  const [base, setBase] = useState<SlideDesign>(() => getNewsTemplate(templateIdOf(initialBrand, "news", "portrait", null, DEFAULT_POST))!.build())
  const [project, setProject] = useState<Pick<ProjectRow, "id" | "status" | "scheduled_at" | "title"> | null>(null)
  const [loading, setLoading] = useState(!!initialId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"photo" | "save" | null>(null)
  const [dirty, setDirty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Latest values for saves that run after a delay.
  const draftRef = useRef(draft)
  /** The caption and the report details as saved (they're saved with the next text save when they changed). */
  const savedCaption = useRef("")
  const savedDetails = useRef("")
  const baseRef = useRef(base)
  useEffect(() => {
    draftRef.current = draft
    baseRef.current = base
  })

  const onLoadedRef = useRef(onLoaded)
  const onOtherKindRef = useRef(onOtherKind)
  useEffect(() => {
    onLoadedRef.current = onLoaded
    onOtherKindRef.current = onOtherKind
  })

  // ---------- load a saved poster ----------
  /** The poster this form created (its id then reaches the address): it's already here, so it isn't loaded again. */
  const createdHere = useRef<string | null>(null)

  /** The revision shown (a newer save made elsewhere, e.g. in the editor, is read again). */
  const shownRevision = useRef(0)
  /** Shows a saved poster: its design, its form fields, its caption and report details. False: not a poster. */
  const showSaved = (row: ProjectRow, slides: SlideRow[]) => {
    const design = normalizeDesign(slides[0]?.design_json)
    if (!isPosterTemplate(design.templateId)) return false
    // A Did You Know or engagement post opens in its own navigation.
    if (posterKindOf(design.templateId) !== "news") {
      onOtherKindRef.current(posterKindOf(design.templateId))
      return true
    }
    // Never back to an older version (a slow read that started before the editor's save landed).
    if (row.revision < shownRevision.current) return true
    shownRevision.current = row.revision
    const headline = newsHeadline(design)
    const at = row.scheduled_at ? new Date(row.scheduled_at) : null
    setBase(design)
    setProject(row)
    const loadedBrand = posterBrandOf(design)
    onLoadedRef.current(loadedBrand, at ? ymd(at) : ymd(new Date()), isHomesBrand(loadedBrand) ? posterPageOf(design) : null)
    setDraft({
      brand: loadedBrand,
      day: at ? ymd(at) : ymd(new Date()),
      time: at ? format(at, "HH:mm") : null,
      headline: headline === NEWS_HEADLINE_PLACEHOLDER ? "" : headline,
      highlight: headline === NEWS_HEADLINE_PLACEHOLDER ? "" : newsHighlight(design).join(" "),
      credit: newsCredit(design) ?? { enabled: false, name: "" },
      page: isHomesBrand(loadedBrand) ? posterPageOf(design) : newsPage(design),
      format: isEventPosterTemplate(design.templateId) ? "event" : "news",
      layout: posterLayoutOf(design.templateId),
      design: posterDesignOf(design.templateId),
      post: postOf(design.templateId),
      tag: newsTag(design),
      location: newsEvent(design)?.location ?? "",
      when: newsEvent(design)?.when ?? "",
      subtext: newsSubtextState(design)?.text ?? "",
      // Empty: typing one shows it.
      subtextOn: newsSubtextState(design)?.text ? (newsSubtextState(design)?.on ?? true) : true,
      subtextStyle: newsSubtextLook(design)?.style ?? "classic",
      subtextHook: newsSubtextLook(design)?.hook ?? "",
      caption: row.caption ?? "",
      details: row.topic ?? "",
    })
    savedCaption.current = row.caption ?? ""
    savedDetails.current = row.topic ?? ""
    setDirty(false)
    return true
  }
  const showSavedRef = useRef(showSaved)
  useEffect(() => {
    showSavedRef.current = showSaved
  })

  useEffect(() => {
    // Loading it again would replace what was typed meanwhile (e.g. the headline typed while the photo was saving).
    if (!initialId || initialId === createdHere.current) return
    let cancelled = false
    ;(async () => {
      try {
        const [row, slides] = await Promise.all([getProject(initialId), getProjectSlides(initialId)])
        if (cancelled) return
        if (!showSavedRef.current(row, slides)) setLoadError("This news post isn't a poster. Open it on News Article or in the editor.")
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

  // ---------- the day's posts (free times, the posters strip) ----------
  const dayStart = useMemo(() => startOfDay(parse(draft.day, "yyyy-MM-dd", new Date())), [draft.day])
  const { projects } = useProjects(dayQuery(dayStart))
  const daySlides = useProjectSlides(projects)
  // No fixed hours: a new poster goes after the brand's last poster that day (changeable to any time).
  const otherTimes = useMemo(
    () =>
      projects
        .filter((p) => p.id !== project?.id && p.scheduled_at && inScope(daySlides.get(p.id)?.[0]?.design, { brand: draft.brand, page: isHomesBrand(draft.brand) ? draft.page : null }))
        .map((p) => format(new Date(p.scheduled_at!), "HH:mm")),
    [projects, daySlides, project?.id, draft.brand, draft.page],
  )
  const time = draft.time ?? nextPosterTime(otherTimes)
  const timeSlot: NewsTime = { time, label: newsTimeLabel(time) }

  // ---------- saving: one at a time, in order ----------
  const projectIdRef = useRef<string | null>(initialId)
  /** Something was changed here since the page was shown again (a save made elsewhere then isn't read over it). */
  const editedHere = useRef(false)
  const creating = useRef<Promise<string> | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveNow = async (change: NewsChange, scheduledAt?: string | null) => {
    const id = projectIdRef.current ?? (creating.current ? await creating.current : null)
    if (id) {
      const { caption, details } = draftRef.current
      const captionChanged = caption !== savedCaption.current
      const detailsChanged = details !== savedDetails.current
      if (Object.keys(change).length || captionChanged || detailsChanged)
        await updateNewsArticle(id, change, { ...(captionChanged ? { caption } : {}), ...(detailsChanged ? { topic: details } : {}) })
      if (captionChanged) savedCaption.current = caption
      if (detailsChanged) savedDetails.current = details
      if (scheduledAt !== undefined) setProject(await updateProject(id, { scheduled_at: scheduledAt }))
    } else {
      const d = draftRef.current
      const text = textChange(d)
      creating.current = createNewsArticle({
        templateId: baseRef.current.templateId ?? templateIdOf(d.brand, d.format, d.layout, d.design, d.post),
        headline: d.headline.trim() ? d.headline.trim() : "",
        scheduledAt: scheduledAt ?? combineDateTime(d.day, time),
        photo: change.photo,
        highlight: text.highlight,
        credit: text.credit,
        page: text.page,
        event: text.event,
        subtext: text.subtext,
        subtextOn: text.subtextOn,
        subtextStyle: text.subtextStyle,
        subtextHook: text.subtextHook,
        tag: text.tag,
        rentsouqLayout: rentsouqLayoutOf(baseRef.current),
        caption: d.caption,
        topic: d.details,
      })
      savedCaption.current = d.caption
      savedDetails.current = d.details
      try {
        const newId = await creating.current
        projectIdRef.current = newId
        createdHere.current = newId
        setProject(await getProject(newId))
        onCreated(newId, d.day)
      } catch (e) {
        creating.current = null
        throw e
      }
    }
    invalidateProjects()
  }

  const save = (change: NewsChange, scheduledAt?: string | null, kind: "photo" | "save" = "save") => {
    editedHere.current = true
    setBusy(kind)
    const next = queue.current
      .catch(() => {})
      .then(() => saveNow(change, scheduledAt))
      .then(
        () => setDirty(false),
        (e) => toast.error("Couldn't save the poster", { description: errorMessage(e) }),
      )
      .finally(() => setBusy(null))
    queue.current = next
    return next
  }

  /** Saves typed text after a short pause (a new poster starts once there's a headline). */
  const saveTextSoon = () => {
    editedHere.current = true
    setDirty(true)
    if (textTimer.current) clearTimeout(textTimer.current)
    textTimer.current = setTimeout(flushText, 800)
  }
  function flushText() {
    if (textTimer.current) clearTimeout(textTimer.current)
    textTimer.current = null
    const d = draftRef.current
    if (!projectIdRef.current && !creating.current && !d.headline.trim() && !d.caption.trim() && !d.details.trim()) return setDirty(false)
    void save(textChange(d))
  }

  const flushRef = useRef(flushText)
  useEffect(() => {
    flushRef.current = flushText
  })
  // Typing then leaving the page (New poster, another poster) still saves.
  useEffect(() => () => (textTimer.current ? flushRef.current() : undefined), [])

  // Coming back from the editor, Next.js shows this page again: the poster form as it was (hidden meanwhile),
  // or made again and read. Either way the editor's last save can land a moment after Back (a photo takes a
  // while), so a newer save of this poster in the minute after the form shows is read too, until something
  // is changed here. The form shown again as it was is also read at once.
  const shownBefore = useRef(false)
  useEffect(() => {
    let cancelled = false
    let listening = true
    const stopListening = setTimeout(() => (listening = false), 60_000)
    const readAgain = async () => {
      await queue.current.catch(() => {})
      const id = projectIdRef.current
      if (!id || cancelled) return
      const [row, slides] = await Promise.all([getProject(id), getProjectSlides(id)])
      if (!cancelled && !editedHere.current) showSavedRef.current(row, slides)
    }
    if (shownBefore.current) {
      // What was typed here goes first (it's saved), then the poster as it is now.
      if (textTimer.current) flushRef.current()
      editedHere.current = false
      void readAgain().catch(() => {})
      invalidateProjects()
    }
    shownBefore.current = true
    const off = onProjectSaved(({ id, revision }) => {
      if (id !== projectIdRef.current || editedHere.current || !listening || revision <= shownRevision.current) return
      void readAgain().catch(() => {})
    })
    return () => {
      cancelled = true
      clearTimeout(stopListening)
      off()
    }
  }, [])

  const editText = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    saveTextSoon()
  }

  // ---------- photo ----------
  const addPhoto = async (file: File) => {
    let photo: NewsPhoto
    setBusy("photo")
    try {
      photo = await storeNewsPhoto(file)
    } catch (e) {
      setBusy(null)
      return void toast.error("Couldn't add the photo", { description: errorMessage(e) })
    }
    enhanceAbort.current?.abort()
    setEnhanced(null)
    setBase((b) => applyNewsChange(b, { photo }))
    if (textTimer.current) clearTimeout(textTimer.current)
    textTimer.current = null
    const d = draftRef.current
    void save({ photo, ...(projectIdRef.current || creating.current ? textChange(d) : {}) }, undefined, "photo")
    // A small photo for the frame (it would look soft or pixelated) is enhanced right away.
    const card = newsPhotoFrame(baseRef.current)?.box
    if (autoEnhance && card && photoNeedsEnhance(photo.naturalWidth, photo.naturalHeight, card.width, card.height)) void enhance(file, photo)
  }

  // ---------- enhance the photo (AI, on this computer) ----------
  // Read on the client only (the page is also rendered on the server).
  const autoEnhance = useSyncExternalStore(subscribeAutoEnhance, getAutoEnhance, () => true)
  const [enhancing, setEnhancing] = useState<{ progress: number; backend: string } | null>(null)
  /** The photo before enhancing (Use original puts it back), and the enhanced one. */
  const [enhanced, setEnhanced] = useState<{ original: NewsPhoto; result: NewsPhoto } | null>(null)
  const enhanceAbort = useRef<AbortController | null>(null)
  /** The photo enhancement running now (the editor opens after it, so it never saves over the editor's work). */
  const enhanceRun = useRef<Promise<void> | null>(null)

  const enhance = (source: Blob, original: NewsPhoto) => {
    const run = enhanceNow(source, original)
    enhanceRun.current = run
    void run.finally(() => {
      if (enhanceRun.current === run) enhanceRun.current = null
    })
    return run
  }

  const enhanceNow = async (source: Blob, original: NewsPhoto) => {
    enhanceAbort.current?.abort()
    const abort = new AbortController()
    enhanceAbort.current = abort
    setEnhancing({ progress: 0, backend: "" })
    try {
      const result = await enhancePhoto(source, { signal: abort.signal, onProgress: (progress, backend) => setEnhancing({ progress, backend }) })
      if (abort.signal.aborted) return
      // The poster is open in the editor now: saving the photo here would undo the editor's changes ("Conflict").
      if (projectIdRef.current && isOpenInEditor(projectIdRef.current)) {
        toast.info("The enhanced photo wasn't used", { description: "The poster is open in the editor. Click Enhance photo again in the Poster Maker." })
        return
      }
      const name = `${(original.name ?? "Poster photo").replace(/\.[a-z0-9]+$/i, "")} (enhanced).jpg`
      const photo = await storeNewsPhoto(new File([result.blob], name, { type: "image/jpeg" }))
      // Only if the photo wasn't changed meanwhile; it keeps its zoom and position.
      if (newsPhotoFrame(baseRef.current)?.src !== original.src) return
      const frame = newsPhotoFrame(baseRef.current)
      const keep = frame ? { photoFrame: { zoom: frame.zoom, focusX: frame.focusX, focusY: frame.focusY } } : {}
      setBase((b) => applyNewsChange(b, { photo, ...keep }))
      setEnhanced({ original, result: photo })
      void save({ photo, ...keep, ...(projectIdRef.current || creating.current ? textChange(draftRef.current) : {}) }, undefined, "photo")
      toast.success("Photo enhanced", {
        description: `${result.from.width} × ${result.from.height} → ${result.width} × ${result.height} px, sharper and cleaner (${(result.ms / 1000).toFixed(1)} s).`,
      })
    } catch (e) {
      if (e instanceof EnhanceCancelled || abort.signal.aborted) return
      toast.error("Couldn't enhance the photo", { description: errorMessage(e) })
    } finally {
      if (enhanceAbort.current === abort) {
        enhanceAbort.current = null
        setEnhancing(null)
      }
    }
  }

  /** Enhance the photo that's on the poster now (e.g. a saved poster's). */
  const enhanceCurrent = async () => {
    const frame = newsPhotoFrame(base)
    if (!frame?.src) return
    try {
      const img = await loadImage(frame.src)
      const original: NewsPhoto = { src: frame.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }
      const photo = base.elements.find((e) => e.type === "image" && e.src === frame.src)
      if (photo?.type === "image") Object.assign(original, { assetId: photo.assetId, publicId: photo.publicId })
      await enhance(await imageToBlob(img), original)
    } catch (e) {
      toast.error("Couldn't enhance the photo", { description: errorMessage(e) })
    }
  }

  const restoreOriginal = () => {
    if (!enhanced) return
    const frame = newsPhotoFrame(base)
    const keep = frame ? { photoFrame: { zoom: frame.zoom, focusX: frame.focusX, focusY: frame.focusY } } : {}
    const photo = enhanced.original
    setBase((b) => applyNewsChange(b, { photo, ...keep }))
    setEnhanced(null)
    void save({ photo, ...keep }, undefined, "photo")
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
        if (type) {
          const blob = await item.getType(type)
          return void addPhoto(new File([blob], `Pasted poster photo.${type.split("/")[1] ?? "png"}`, { type }))
        }
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

  // ---------- day, time, type, page ----------
  const setFormat = (format: PosterFormat) => {
    if (format === draft.format) return
    const templateId = templateIdOf(draft.brand, format, draft.layout, draft.design)
    const next: Draft = { ...draft, format, post: null }
    setBase((b) => applyNewsChange(b, { templateId }))
    setDraft(next)
    draftRef.current = next
    if (projectIdRef.current || creating.current) void save({ templateId, ...textChange(next) })
  }

  /** New Template ↔ Old Template: the poster is redrawn on the other one, keeping everything written and its photo. */
  const setLayout = (layout: PosterLayout) => {
    if (layout === draft.layout && draft.design === null && draft.post === null) return
    const templateId = templateIdOf(draft.brand, draft.format, layout)
    const next: Draft = { ...draft, layout, design: null, post: null }
    setBase((b) => applyNewsChange(b, { templateId }))
    setDraft(next)
    draftRef.current = next
    if (projectIdRef.current || creating.current) void save({ templateId, ...textChange(next) })
  }

  /** One of the Homes.ph poster designs (1.51): the poster is redrawn on it, keeping everything written and its photo. */
  const setDesign = (design: number) => {
    if (design === draft.design) return
    const templateId = templateIdOf(draft.brand, "news", "portrait", design)
    const next: Draft = { ...draft, format: "news", layout: "portrait", design, post: null }
    setBase((b) => applyNewsChange(b, { templateId }))
    setDraft(next)
    draftRef.current = next
    if (projectIdRef.current || creating.current) void save({ templateId, ...textChange(next) })
  }

  /** One of the brand's poster templates 01–11 (1.52): the poster is redrawn on it, keeping everything written and its photo. */
  const setPost = (post: string) => {
    if (post === draft.post) return
    const templateId = templateIdOf(draft.brand, "news", "portrait", null, post)
    const next: Draft = { ...draft, format: "news", layout: "portrait", design: null, post }
    setBase((b) => applyNewsChange(b, { templateId }))
    setDraft(next)
    draftRef.current = next
    if (projectIdRef.current || creating.current) void save({ templateId, ...textChange(next) })
  }

  /** Rentsouq.ae tab: New Template ↔ Old Template of this poster's Rentsouq.ae version (FHI's own template stays). */
  const setRentsouqLayout = (layout: PosterLayout) => {
    if (layout === rentsouqLayoutOf(base)) return
    const change: NewsChange = { rentsouqLayout: layout }
    setBase((b) => applyNewsChange(b, change))
    if (projectIdRef.current || creating.current) void save(change)
  }

  /** Moves the poster to another Homes.ph page (to or from Gensan, its template changes to that page's; it looks the same). */
  const setPage = (page: string) => {
    if (samePage(page, draft.page)) return
    const brand = brandForPage(page)
    const next = { ...draft, page, brand }
    setDraft(next)
    draftRef.current = next
    if (brand !== draft.brand) {
      const templateId = templateIdOf(brand, draft.format, draft.layout, draft.design, draft.post)
      setBase((b) => applyNewsChange(b, { templateId, page: brand === "homes" ? page : null }))
      if (projectIdRef.current || creating.current) void save({ templateId, ...textChange(next) })
    } else if (projectIdRef.current || creating.current) void save({ page: brand === "homes" ? page : null })
    onPage(page)
  }

  const pageOptions = useMemo(() => (draft.page && !pages.some((p) => samePage(p, draft.page)) ? [draft.page, ...pages] : [...pages]), [pages, draft.page])

  // ---------- AI headline from an article ----------
  const [articleOpen, setArticleOpen] = useState(false)

  const setWhen = (patch: { day?: string; time?: string }) => {
    const next = { ...draft, ...patch, time: patch.time ?? draft.time }
    setDraft(next)
    if (projectIdRef.current || creating.current) {
      const movedDay = patch.day && patch.day !== draft.day ? patch.day : null
      // A saved poster moved to another day: the day's posters above follow it.
      void save({}, combineDateTime(next.day, next.time ?? time)).then(() => movedDay && projectIdRef.current && onMoved(movedDay))
    }
  }

  const setCredit = (credit: NewsCredit) => {
    if (credit.name.trim()) {
      try {
        localStorage.setItem(CREDIT_NAME_KEY, credit.name.trim())
      } catch {
        // remembered for this session only
      }
    }
    editText({ credit })
  }

  // ---------- preview ----------
  const design = useMemo(() => applyNewsChange(base, textChange(draft)), [base, draft])
  // Rentsouq.ae tab (FHI posters only): the same poster on the Rentsouq.ae template; previewed, saved and downloaded like that.
  const look = tabLook && draft.brand === LOOK_BRAND[tabLook] ? tabLook : null
  const shown = useMemo(() => lookDesign(design, look), [design, look])
  /** Who the picture is for (its file name): "Rentsouq.ae" on that tab. */
  const pictureLabel = look ? RENTSOUQ_BRAND.name : posterLabel(draft)
  const [preview, setPreview] = useState<string | null>(null)
  /** The headline's size after shrinking to fit its box (68 px at most). */
  const [fittedSize, setFittedSize] = useState<number | null>(null)
  /** The subtext's size after fitting (30 px in the design). */
  const [fittedSubtext, setFittedSubtext] = useState<number | null>(null)
  // The sizes the design asks for (68 and 30 px, or what was set in the editor).
  const designSizeOf = (el: TextElement | undefined) => (el ? (el.boxFit?.maxSize ?? el.autoFit?.maxSize ?? el.fontSize) : null)
  const headlineSize = designSizeOf(shown.elements.find((e): e is TextElement => e.type === "text" && e.role === "title")) ?? 68
  const subtextSize = designSizeOf(shown.elements.find(isPosterSubtext)) ?? POSTER_SUBTEXT_SIZE
  const latest = useRef(shown)
  const rendering = useRef(false)

  // ---------- move / zoom the photo inside the photo card ----------
  /** The preview element (the photo zooms with the mouse wheel over it). */
  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null)
  const photoFrame = usePhotoFrame(
    shown,
    (frame: PhotoFrame) => {
      setBase((b) => applyNewsChange(b, { photoFrame: frame }))
      if (projectIdRef.current || creating.current) void save({ photoFrame: frame })
    },
    previewEl,
  )
  const renderedRef = useRef(photoFrame.rendered)
  useEffect(() => {
    renderedRef.current = photoFrame.rendered
  })
  useEffect(() => {
    latest.current = shown
    if (rendering.current) return
    rendering.current = true
    ;(async () => {
      const [{ renderThumbnail }, { prepareDesign }] = await Promise.all([import("@/lib/design/render"), import("@/lib/design/prepare")])
      let drawn: SlideDesign | null = null
      while (drawn !== latest.current) {
        if (drawn) await typingPause(() => latest.current)
        drawn = latest.current
        const url = await prepareDesign(drawn)
          .then((prepared) => {
            const title = prepared.elements.find((e): e is TextElement => e.type === "text" && e.role === "title")
            setFittedSize(title?.fontSize ?? null)
            const sub = prepared.elements.find(isPosterSubtext)
            setFittedSubtext(sub?.visible ? sub.fontSize : null)
            return renderThumbnail(prepared, prepared.width, 0.9)
          })
          .catch(() => null)
        if (url) {
          setPreview(url)
          renderedRef.current(drawn)
        }
      }
      rendering.current = false
    })()
  }, [shown])

  const download = async () => {
    const { prepareDesign } = await import("@/lib/design/prepare")
    const prepared = await prepareDesign(shown)
    await runExport({
      meta: { title: draft.headline.trim() || "Poster", caption: draft.caption, status: project?.status ?? "draft", scheduled_at: combineDateTime(draft.day, time) },
      slides: [{ type: "cover", design: prepared }],
      kind: "single",
      format: "png",
      checks: false,
      fileName: newsFileName(dayStart, timeSlot, pictureLabel),
    })
  }

  // ---------- desktop app: save straight into the poster folder ----------
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
      const [{ prepareDesign }, { renderSlideImage }] = await Promise.all([import("@/lib/design/prepare"), import("@/lib/design/render")])
      const blob = await renderSlideImage(await prepareDesign(shown), "png")
      const file = await desktop.savePoster(newsFileName(dayStart, timeSlot, pictureLabel), new Uint8Array(await blob.arrayBuffer()))
      toast.success("Poster saved", {
        description: file,
        action: desktop.showFile ? { label: "Show in folder", onClick: () => void desktop.showFile?.(file) } : undefined,
      })
    } catch (e) {
      toast.error("Couldn't save the poster", { description: errorMessage(e) })
    } finally {
      setSavingFile(false)
    }
  }

  const chooseFolder = async () => {
    try {
      const next = await desktop?.folders?.choose("posters")
      if (next) {
        setFolders(next)
        toast.success("Posters will be saved here", { description: next.posters })
      }
    } catch (e) {
      toast.error("Couldn't change the folder", { description: errorMessage(e) })
    }
  }

  const openEditor = async () => {
    // A photo being enhanced is saved first (it would otherwise land while the editor is open: "Conflict").
    if (enhanceRun.current) {
      toast.info("Finishing the photo enhancement first…", { description: "The editor opens when it's done." })
      await enhanceRun.current.catch(() => {})
    }
    flushText()
    await queue.current.catch(() => {})
    // Its photo, still uploading, is finished first (else its update lands under the editor: "Conflict").
    if (projectIdRef.current) await settleUploadsOf(projectIdRef.current)
    // On the Rentsouq.ae tab, the editor opens the Rentsouq.ae version (its own sizes and layout).
    if (projectIdRef.current) router.push(`/editor/${projectIdRef.current}${look ? `?look=${look}` : ""}`)
  }

  const deletePoster = useDeletePoster()
  const hasPhoto = base.elements.some((e) => e.type === "image" && e.role === "background" && !!e.src)
  const accent = look ? RENTSOUQ_ACCENT : POSTER_BRANDS.find((b) => b.id === draft.brand)!.accent
  /** The template the poster is drawn on here (the Rentsouq.ae one on that tab): its subtext colors. */
  const shownTemplate = shown.templateId ?? templateIdOf(draft.brand)
  /** A Homes.ph poster design (1.51): a one-line headline and a two-line subtext with gold words. */
  const isDesign = isDesignPoster(shownTemplate)
  /** One of the brand's poster templates (1.52): its own text rules (the team's instructions). */
  const brandTemplate = brandPostTemplate(shownTemplate)
  const isBrand = !!brandTemplate
  const brandInfo = brandTemplate?.info
  /** The Template switch: this poster's own, or its Rentsouq.ae version's on that tab. */
  const layout = look ? rentsouqLayoutOf(base) : draft.layout
  const saved = !!project
  const status = busy === "photo" ? "Adding the photo…" : busy === "save" || dirty ? "Saving…" : saved ? "Saved" : "Not saved yet: add a photo or type the headline"

  if (loadError) {
    return (
      <div className="max-w-xl rounded-lg border bg-card p-4 text-sm">
        <p className="font-medium">Couldn&apos;t open this poster</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link href={`/posters?brand=${tabLook ?? initialBrand}`}>
            <Plus /> New poster
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* ---------- the form ---------- */}
        <div className={cn("flex flex-col gap-5", loading && "pointer-events-none opacity-60")} aria-busy={loading}>
          <Field
            label={look ? `${RENTSOUQ_BRAND.name} template` : "Template"}
            hint={look ? "FHI Global Property keeps its own" : brandTemplate ? `${brandTemplate.def.num} · ${brandTemplate.def.name} · 1080 × 1350` : undefined}
          >
            {!look && <TemplateGallery kind="news" brand={draft.brand as PostBrand} value={draft.post} onChange={setPost} />}
            {(look || hasOlderTemplates(draft.brand)) && (
            <details open={!!look || !draft.post} className={cn(!look && "mt-2 rounded-lg border bg-card/50 px-2 py-1.5")}>
              {/* (On Rentsouq.ae its switch shows as it always did: the summary is hidden, the box open.) */}
              <summary className={cn("cursor-pointer text-[11px] font-medium text-muted-foreground select-none", look && "hidden")}>
                Older templates (New / Old Template{isHomesBrand(draft.brand) ? ", Designs 1–10" : ""})
              </summary>
            <div className={cn("grid grid-cols-2 gap-1 rounded-lg border bg-card p-1", !look && "mt-1.5")} role="radiogroup" aria-label={look ? `${RENTSOUQ_BRAND.name} template` : "Older template"}>
              {POSTER_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={layout === l.id && (!!look || (draft.design === null && !draft.post))}
                  onClick={() => (look ? setRentsouqLayout(l.id) : setLayout(l.id))}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                    layout === l.id && (!!look || (draft.design === null && !draft.post)) ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {/* A small outline of the poster's shape. */}
                  <span
                    aria-hidden="true"
                    className={cn("inline-block shrink-0 rounded-[2px] border-[1.5px] border-current", l.id === "portrait" ? "h-[15px] w-3" : "size-[13px]")}
                  />
                  <span className="flex flex-col items-start leading-tight">
                    {l.name}
                    <span className={cn("text-[10.5px] font-normal", layout === l.id && (!!look || (draft.design === null && !draft.post)) ? "text-primary-foreground/80" : "text-muted-foreground")}>{l.size}</span>
                  </span>
                </button>
              ))}
            </div>
            {!look && isHomesBrand(draft.brand) && (
              <div className="mt-2">
                <div className="mb-1 text-[11px] text-muted-foreground">Designs · 1126 × 1408 · one-line headline, two-line subtext</div>
                <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Poster design">
                  {Array.from({ length: POSTER_DESIGN_COUNT }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={draft.design === n}
                      aria-label={`Design ${n}`}
                      title={`Design ${n}`}
                      onClick={() => setDesign(n)}
                      className={cn(
                        "relative overflow-hidden rounded-md ring-offset-2 ring-offset-background transition",
                        draft.design === n ? "ring-2 ring-primary" : "opacity-80 ring-1 ring-border hover:opacity-100",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={DESIGN_THUMB(n)} alt="" className="aspect-[1126/1408] w-full object-cover" draggable={false} />
                      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            </details>
            )}
          </Field>
          {hasEventPoster(draft.brand) && !isBrand && (
            <Field label="Poster type">
              <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-1" role="radiogroup" aria-label="Poster type">
                {(
                  [
                    { id: "news", label: "News", hint: "Headline" },
                    { id: "event", label: "Event", hint: "Location, date & time" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={draft.format === f.id}
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "flex flex-col items-center rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                      draft.format === f.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                    <span className={cn("text-[10.5px] font-normal", draft.format === f.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{f.hint}</span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          {isHomesBrand(draft.brand) && (
            <Field label="Homes.ph page" hint="The Facebook page this poster is for (another one moves it there)">
              <Select value={pageOptions.find((p) => samePage(p, draft.page)) ?? undefined} onValueChange={setPage}>
                <SelectTrigger className="w-full bg-card" aria-label="This poster's Homes.ph page">
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
                value={draft.day}
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
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="poster-time"
                type="time"
                step={300}
                value={time}
                onChange={(e) => e.target.value && setWhen({ time: e.target.value })}
                aria-label="Posting time"
                className="w-36 bg-card"
              />
              <span className="text-[11px] text-muted-foreground">Any time you like (no fixed hours).</span>
            </div>
          </Field>

          <Field label="Photo">
            <div className="flex gap-1.5">
              <Button variant="outline" className="flex-1" onClick={() => void pasteFromClipboard()} disabled={busy === "photo"}>
                <ClipboardPaste /> Paste
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy === "photo"}>
                <ImagePlus /> Choose photo
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                aria-label="Choose the poster photo"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) void addPhoto(file)
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Or drop it on the preview, or click the preview and press Ctrl+V. Then drag it on the preview to move it; scroll or pinch on it to zoom (zoom
              out to show the whole photo over a blurred copy).
            </p>
            {hasPhoto && (
              <PhotoFilterChips
                value={newsPhotoFilter(base)}
                onChange={(photoFilter) => {
                  setBase((b) => applyNewsChange(b, { photoFilter }))
                  if (projectIdRef.current || creating.current) void save({ photoFilter })
                }}
              />
            )}
            <EnhancePanel
              enhancing={enhancing}
              enhanced={!!enhanced && newsPhotoFrame(base)?.src === enhanced.result.src}
              photo={newsPhotoFrame(base)}
              auto={autoEnhance}
              onAuto={setAutoEnhance}
              onEnhance={() => void enhanceCurrent()}
              onCancel={() => enhanceAbort.current?.abort()}
              onOriginal={restoreOriginal}
            />
          </Field>

          <Field
            label="Headline"
            htmlFor="poster-headline"
            action={
              draft.brand !== "bayanihan" && <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setArticleOpen(true)}
                title="Paste the whole article: AI writes the headline and the subtext"
                className="h-7 border-violet-400/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
              >
                <Sparkles /> Write from article
              </Button>
            }
          >
            <Textarea
              id="poster-headline"
              value={draft.headline}
              // A poster design's headline is one line.
              {...(isDesign ? { rows: 2 } : {})}
              onChange={(e) => editText({ headline: e.target.value })}
              onBlur={() => textTimer.current && flushText()}
              rows={3}
              placeholder="Type the headline, or write it from the article with AI"
              className="min-h-24 resize-none bg-card text-[15px] uppercase placeholder:normal-case"
            />
            <p className="mt-1 text-[11px] text-muted-foreground" role="status">
              {brandInfo?.headline
                ? brandInfo.headline.singleLine
                  ? "The name only (artist, group, athlete), on ONE big line: a long name gets smaller to fit. Highlight one word at most."
                  : `Up to ${brandInfo.headline.maxLines ?? 2} lines (it wraps by itself): a longer headline gets smaller to fit. Highlight one key phrase.`
                : isDesign
                ? fittedSize && fittedSize < headlineSize && draft.headline.trim()
                  ? `One line: shrunk to ${fittedSize} px to fit the width (the design's size is ${headlineSize} px). Shorter reads bigger.`
                  : `One line, at the design's size (${headlineSize} px); a long headline shrinks to fit the width.`
                : fittedSize && fittedSize !== headlineSize && draft.headline.trim()
                ? fittedSize < headlineSize
                  ? `Shrunk to ${fittedSize} px to fit the headline space (the design's size is ${headlineSize} px).`
                  : `Enlarged to ${fittedSize} px to fill the headline space (the design's size is ${headlineSize} px).`
                : draft.format === "event"
                  ? "Fills the space above the location and time: short headlines get bigger, long ones smaller."
                  : draft.subtextOn && draft.subtext.trim()
                    ? "Fills the space above the subtext: short headlines get bigger, long ones smaller."
                    : "Fills the headline box (1006 × 231): short headlines get bigger, long ones smaller."}
            </p>
          </Field>
          {draft.format === "news" && (!brandInfo || brandInfo.subtext) && (
            <Field
              label="Subtext"
              htmlFor="poster-subtext"
              action={
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {draft.subtextOn ? "On" : "Off"}
                  <Switch
                    checked={draft.subtextOn}
                    onCheckedChange={(subtextOn) => editText({ subtextOn })}
                    aria-label="Show the subtext"
                    size="sm"
                  />
                </label>
              }
            >
              {!isDesign && !isBrand && <SubtextStylePicker
                value={draft.subtextStyle}
                accent={POSTER_SUBTEXT_COLORS[shownTemplate] ?? accent}
                dark={POSTER_SUBTEXT_DARK[shownTemplate] ?? "#0D1969"}
                onChange={(subtextStyle) => editText({ subtextStyle })}
              />}
              {isBrand ? (
                <Textarea
                  id="poster-subtext"
                  value={draft.subtext}
                  onChange={(e) => {
                    // Two lines at most: a third Enter joins the rest onto the second line.
                    const [one, ...rest] = e.target.value.split("\n")
                    const subtext = rest.length ? `${one}\n${rest.join(" ")}` : one
                    editText({ subtext, subtextOn: draft.subtextOn || !!subtext.trim() })
                  }}
                  onBlur={() => textTimer.current && flushText()}
                  rows={2}
                  maxLength={160}
                  placeholder={brandInfo?.headline?.singleLine ? "e.g. November 25, 2026\nAraneta Coliseum" : "Short supporting text (Enter starts line 2)"}
                  className={cn("min-h-16 resize-none bg-card text-[14px]", !draft.subtextOn && "opacity-60")}
                />
              ) : isDesign ? (
                <Textarea
                  id="poster-subtext"
                  value={draft.subtext}
                  onChange={(e) => {
                    // Two lines at most: a third Enter joins the rest onto the second line.
                    const [one, ...rest] = e.target.value.split("\n")
                    const subtext = designHasSecondLine(posterDesignOf(shownTemplate) ?? 1) && rest.length ? `${one}\n${rest.join(" ")}` : [one, ...rest].join(" ")
                    editText({ subtext, subtextOn: draft.subtextOn || !!subtext.trim() })
                  }}
                  onBlur={() => textTimer.current && flushText()}
                  rows={2}
                  maxLength={160}
                  placeholder={designHasSecondLine(posterDesignOf(shownTemplate) ?? 1) ? "Line 1\nLine 2 (press Enter for the second line)" : "One line"}
                  className={cn("min-h-16 resize-none bg-card text-[14px]", !draft.subtextOn && "opacity-60")}
                />
              ) : (
              <Input
                id="poster-subtext"
                value={draft.subtext}
                // Typing a subtext shows it.
                onChange={(e) => editText({ subtext: e.target.value, subtextOn: draft.subtextOn || !!e.target.value.trim() })}
                onBlur={() => textTimer.current && flushText()}
                placeholder="e.g. Nov 22, 2026 | Cebu City, or the article's key point"
                maxLength={160}
                className={cn("bg-card uppercase placeholder:normal-case", !draft.subtextOn && "opacity-60")}
              />
              )}
              <p className={cn("mt-1 text-[11px]", draft.subtextOn && draft.subtext.trim().length > SUBTEXT_LONG ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")} role="status">
                {isBrand && draft.subtextOn
                  ? "Up to 2 lines: press Enter where line 2 should start, or it wraps by itself; a longer one gets smaller. Keep each line under ~35 letters."
                  : isDesign && draft.subtextOn
                  ? designHasSecondLine(posterDesignOf(shownTemplate) ?? 1)
                    ? "Two lines, each on one line (a long one shrinks to fit). Press Enter where line 2 should start, or it's split for you."
                    : "One line: a long one shrinks to fit the width."
                  : !draft.subtextOn
                  ? draft.subtext.trim()
                    ? "Off: headline-only poster (the text is kept). Switch it on to show it."
                    : "Off: headline-only poster."
                  : !draft.subtext.trim()
                    ? "The key details (Date | Location), the article's main point, or a short quote. Empty = headline only."
                    : draft.subtext.trim().length > SUBTEXT_LONG
                      ? `Long: it wraps onto two lines and gets smaller${fittedSubtext ? ` (${fittedSubtext} px)` : ""}. Shorter reads better.`
                      : fittedSubtext && fittedSubtext !== subtextSize
                        ? `${fittedSubtext > subtextSize ? "Enlarged" : "Shrunk"} to ${fittedSubtext} px to fit the width (the design's size is ${subtextSize} px).`
                        : "Sizes itself to the width: short ones get bigger, long ones wrap onto two lines."}
              </p>
              {(isDesign || isBrand || draft.subtextStyle === "highlight") && (
                <label className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="shrink-0">In {draft.brand === "pickleplay" ? "lime" : "gold"}:</span>
                  <Input
                    value={draft.subtextHook}
                    onChange={(e) => editText({ subtextHook: e.target.value })}
                    onBlur={() => textTimer.current && flushText()}
                    placeholder={
                      isDesign || isBrand
                        ? `Words to show in ${draft.brand === "pickleplay" ? "lime" : "gold"} (optional; commas for more)`
                        : autoSubtextHook(draft.subtext)
                          ? `Automatic: ${autoSubtextHook(draft.subtext)}`
                          : "The words to show in the brand color"
                    }
                    aria-label="Subtext words in the brand color"
                    className={cn("h-7 bg-card text-xs placeholder:normal-case", !isDesign && !isBrand && "uppercase")}
                  />
                </label>
              )}
            </Field>
          )}
          {brandInfo?.tag != null && (
            <Field
              label="Tag"
              htmlFor="poster-tag"
              hint="The pill over the headline"
              action={
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {(draft.tag ?? brandInfo.tag) ? "On" : "Off"}
                  <Switch
                    checked={!!(draft.tag ?? brandInfo.tag)}
                    onCheckedChange={(on) => editText({ tag: on ? brandInfo.tag ?? "TRENDING NOW" : "" })}
                    aria-label="Show the tag"
                    size="sm"
                  />
                </label>
              }
            >
              <Input
                id="poster-tag"
                value={draft.tag ?? brandInfo.tag ?? ""}
                onChange={(e) => editText({ tag: e.target.value })}
                onBlur={() => textTimer.current && flushText()}
                placeholder="e.g. TRENDING NOW, BREAKING, JUST IN"
                maxLength={30}
                className="bg-card uppercase placeholder:normal-case"
              />
            </Field>
          )}
          {draft.brand !== "bayanihan" && (
          <ArticleHeadlineDialog
            // Each brand and Homes.ph page has its own article, results and trending news.
            key={posterArticleScope(draft.brand, isHomesBrand(draft.brand) ? draft.page : null)}
            open={articleOpen}
            onOpenChange={setArticleOpen}
            brand={draft.brand}
            page={isHomesBrand(draft.brand) ? draft.page : null}
            allPages={[...pages]}
            day={draft.day}
            brandName={posterLabel(draft)}
            accent={accent}
            subtextColor={POSTER_SUBTEXT_COLORS[shownTemplate] ?? accent}
            allowSubtext={draft.format === "news"}
            onApplyHeadline={(option) => editText({ headline: option.headline, highlight: option.highlight })}
            onApplySubtext={(subtext, on) => editText({ subtext, subtextOn: on })}
            current={{ headline: draft.headline, subtext: draft.subtext, subtextOn: draft.subtextOn, caption: draft.caption }}
            onApplyCaption={(caption) => editText({ caption })}
            onApplyDetails={(details) => editText({ details })}
          />
          )}

          <Field label="Highlighted words" htmlFor="poster-highlight">
            <HighlightField
              id="poster-highlight"
              headline={draft.headline}
              value={draft.highlight}
              accent={accent}
              onChange={(highlight) => editText({ highlight })}
            />
          </Field>

          {draft.format === "event" && (
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-3" role="group" aria-label="Event details">
              <div className="text-sm font-medium">
                Event details
                <span className="block text-[11px] font-normal text-muted-foreground">Shown under the headline. Leave one empty to hide its line.</span>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <MapPin className="size-3.5" /> Location
                </span>
                <Input
                  id="poster-location"
                  value={draft.location}
                  onChange={(e) => editText({ location: e.target.value })}
                  onBlur={() => textTimer.current && flushText()}
                  placeholder="e.g. PicklePlay Courts, BGC Taguig"
                  maxLength={120}
                  className="uppercase placeholder:normal-case"
                />
                {draft.location.trim().length > EVENT_LONG && <LongLineHint />}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <CalendarClock className="size-3.5" /> Date &amp; time
                </span>
                <Input
                  id="poster-when"
                  value={draft.when}
                  onChange={(e) => editText({ when: e.target.value })}
                  onBlur={() => textTimer.current && flushText()}
                  placeholder="e.g. November 22, 2026 · 8:00 AM"
                  maxLength={120}
                  className="uppercase placeholder:normal-case"
                />
                {draft.when.trim().length > EVENT_LONG && <LongLineHint />}
              </label>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              <span>
                Photo credit
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {brandTemplate
                    ? brandTemplate.def.num === "11"
                      ? "Shows “SOURCE: NAME” (underlined) under the headline."
                      : "Shows “PHOTO: NAME” at the top left."
                    : <>Shows &ldquo;{POSTER_CREDIT_PREFIX.trim()} NAME&rdquo; under the photo.</>}
                </span>
              </span>
              <Switch
                checked={draft.credit.enabled}
                onCheckedChange={(enabled) => {
                  let name = draft.credit.name
                  if (enabled && !name.trim()) {
                    try {
                      name = localStorage.getItem(CREDIT_NAME_KEY) ?? ""
                    } catch {
                      name = ""
                    }
                  }
                  setCredit({ enabled, name })
                }}
                aria-label="Photo credit"
              />
            </label>
            {draft.credit.enabled && (
              <Input
                value={draft.credit.name}
                onChange={(e) => setCredit({ ...draft.credit, name: e.target.value })}
                onBlur={() => textTimer.current && flushText()}
                placeholder={brandTemplate?.def.num === "11" ? "The source (e.g. Manila Bulletin)" : "Photographer's name"}
                aria-label="Photographer's name"
                autoFocus={!draft.credit.name}
                className="uppercase placeholder:normal-case"
              />
            )}
          </div>
          <CaptionField
            value={draft.caption}
            brandName={posterLabel(draft)}
            headline={draft.headline}
            onChange={(caption) => editText({ caption })}
            onBlur={() => textTimer.current && flushText()}
            onNeedArticle={() => setArticleOpen(true)}
          />
          <DetailsField
            value={draft.details}
            brandName={posterLabel(draft)}
            headline={draft.headline}
            subtext={draft.format === "event" ? [draft.location, draft.when].filter((t) => t.trim()).join(" | ") : draft.subtextOn ? draft.subtext : ""}
            caption={draft.caption}
            onChange={(details) => editText({ details })}
            onBlur={() => textTimer.current && flushText()}
          />
        </div>

        {/* ---------- preview ---------- */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-20">
          <div
            ref={setPreviewEl}
            role="button"
            tabIndex={0}
            aria-label={`Poster preview. ${hasPhoto ? "" : "No photo yet. "}Click, then paste a picture (Ctrl+V), or drop one here.`}
            onPaste={onPaste}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onDoubleClick={() => void openEditor()}
            {...photoFrame.handlers}
            style={{ aspectRatio: `${shown.width} / ${shown.height}`, maxWidth: `min(100%, calc((100dvh - 12rem) * ${shown.width / shown.height}))` }}
            className={cn(
              "relative w-full touch-none overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-black/10 outline-none select-none focus-visible:ring-3 focus-visible:ring-primary",
              photoFrame.available && "cursor-grab active:cursor-grabbing",
            )}
          >
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full" draggable={false} />
            )}
            {photoFrame.overlay}
            {enhancing && (
              <span className="pointer-events-none absolute inset-x-4 bottom-[30%] flex items-center justify-center gap-2 rounded-md bg-black/65 px-3 py-2 text-xs font-medium text-white backdrop-blur">
                <WandSparkles className="size-3.5" /> Enhancing the photo… {Math.round(enhancing.progress * 100)}%
              </span>
            )}
            {(!preview || loading || busy === "photo") && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                <Loader2 className="size-6 animate-spin" />
              </span>
            )}
            {!hasPhoto && busy !== "photo" && !loading && (
              <span className="pointer-events-none absolute inset-x-4 top-[24%] rounded-md bg-black/60 px-3 py-2 text-center text-xs font-medium text-white backdrop-blur">
                Click here, then Ctrl+V to paste the photo, or drop one here
              </span>
            )}
          </div>
          <PhotoFrameControls frame={photoFrame} />
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
            <Button
              variant="outline"
              onClick={() => void openEditor()}
              disabled={!saved}
              title={isBrand ? "Add pictures, cut-out people (remove background), text and shapes between the template's layers" : undefined}
            >
              <PencilLine /> {look ? "Open Rentsouq.ae in editor" : isBrand ? "Open in editor (layers)" : "Open in editor"}
            </Button>
            {project && (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void deletePoster(project.id, project.title, look ? RENTSOUQ_DELETE_NOTE : undefined).then((done) => done && onDeleted())}
              >
                <Trash2 /> Delete
              </Button>
            )}
            <span className="text-xs text-muted-foreground" role="status">
              {status}
            </span>
          </div>
          {canSaveToFolder && (
            <div className="flex max-w-[min(100%,calc(100dvh-12rem))] flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-card px-3 py-2 text-xs">
              <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">Saves to</span>
              <span className="min-w-0 flex-1 truncate font-medium" title={folders?.posters}>
                {folders?.posters ?? "…"}
              </span>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => void chooseFolder()}>
                Change…
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => void desktop?.folders?.open("posters").catch((e) => toast.error(errorMessage(e)))}>
                Open
              </Button>
              {folders?.postersMissing && (
                <span className="w-full text-amber-700 dark:text-amber-300">
                  {folders.postersMissing} can&apos;t be found right now, so posters go to {folders.posters}.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

const SUBTEXT_STYLE_LABELS: Record<SubtextStyle, { label: string; hint: string }> = {
  classic: { label: "Classic", hint: "Brand color, sizes itself" },
  big: { label: "Big", hint: "Bolder and bigger" },
  highlight: { label: "Highlight", hint: "White, key words in color" },
  banner: { label: "Banner", hint: "On a colored band" },
}

/** The four subtext looks, each shown as a small sample in the brand's colors. */
function SubtextStylePicker({ value, accent, dark, onChange }: { value: SubtextStyle; accent: string; dark: string; onChange: (style: SubtextStyle) => void }) {
  return (
    <div className="mb-1.5 grid grid-cols-4 gap-1" role="radiogroup" aria-label="Subtext style">
      {(Object.keys(SUBTEXT_STYLE_LABELS) as SubtextStyle[]).map((style) => (
        <button
          key={style}
          type="button"
          role="radio"
          aria-checked={value === style}
          aria-label={`${SUBTEXT_STYLE_LABELS[style].label} subtext: ${SUBTEXT_STYLE_LABELS[style].hint}`}
          title={SUBTEXT_STYLE_LABELS[style].hint}
          onClick={() => onChange(style)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-md border bg-card p-1.5 text-[10.5px] font-medium transition-colors outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary",
            value === style ? "border-primary ring-1 ring-primary" : "text-muted-foreground",
          )}
        >
          <span className="flex h-7 w-full items-center justify-center rounded bg-[#0D1969] font-['League_Spartan',sans-serif] font-bold uppercase">
            {style === "classic" && (
              <span className="text-[9px]" style={{ color: accent }}>
                Nov 22 | Cebu
              </span>
            )}
            {style === "big" && (
              <span className="text-[13px] leading-none" style={{ color: accent }}>
                Nov 22
              </span>
            )}
            {style === "highlight" && (
              <span className="text-[10px] text-white">
                <span style={{ color: accent }}>₱50K</span> Prize
              </span>
            )}
            {style === "banner" && (
              <span className="rounded-sm px-1.5 py-0.5 text-[9px]" style={{ background: accent, color: dark }}>
                Nov 22 | Cebu
              </span>
            )}
          </span>
          {SUBTEXT_STYLE_LABELS[style].label}
        </button>
      ))}
    </div>
  )
}

/** Caption length (before the hashtags) that reads well on Facebook. */
const CAPTION_GOOD = 500

/**
 * The post's caption (Facebook, Instagram…): written by AI with the headline (Write from
 * article), or again from the same article here; editable; Copy puts it on the clipboard.
 */
function CaptionField({
  value,
  brandName,
  headline,
  onChange,
  onBlur,
  onNeedArticle,
}: {
  value: string
  brandName: string
  headline: string
  onChange: (caption: string) => void
  onBlur: () => void
  onNeedArticle: () => void
}) {
  const [busy, setBusy] = useState(false)
  const body = value.split(/\n\s*\n(?=#)/)[0].trim()
  const tags = (value.match(/#[\p{L}\p{N}_]+/gu) ?? []).length

  const write = async () => {
    // The article this poster's headline was written from, else this brand's last one.
    const memory = articleMemoryOf(headline, brandName) ?? loadArticleMemory(articleScope(brandName))
    if (memory.article.trim().length < 60) {
      toast.info("Paste the article first", { description: "The caption is written from the article, so it only says what's true." })
      return onNeedArticle()
    }
    setBusy(true)
    try {
      const { fellBack, ...caption } = await suggestPosterCaption(memory.article, brandName, headline)
      rememberCaption(caption, brandName)
      onChange(captionForPost(captionFor(caption, brandName)))
      toast.success("Caption written", { description: fellBack ?? `From: ${memory.source?.title || memory.article.slice(0, 60)}…` })
    } catch (e) {
      toast.error("Couldn't write the caption", { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const copyCaption = async () => {
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
        <label htmlFor="poster-caption" className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquareText className="size-4 text-muted-foreground" /> Facebook caption
        </label>
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-violet-400/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
            onClick={() => void write()}
            disabled={busy}
            title="A new caption from the article (Write from article)"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {value.trim() ? "Write another" : "Write with AI"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => void copyCaption()} disabled={!value.trim()}>
            <Copy /> Copy
          </Button>
        </span>
      </div>
      <Textarea
        id="poster-caption"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 5000))}
        onBlur={onBlur}
        rows={7}
        placeholder="The caption for the post: a hook, the key facts and a warm closing line, then the hashtags. Write from article fills it in."
        className="min-h-32 resize-y bg-card text-[13px] leading-relaxed"
      />
      <p className={cn("text-[11px]", body.length > CAPTION_GOOD ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")} role="status">
        {value.trim()
          ? `${body.length} characters${tags ? ` + ${tags} hashtag${tags === 1 ? "" : "s"}` : ""}${body.length > CAPTION_GOOD ? ": a little long, people read the first lines" : ""}. Saved with the poster.`
          : "No emojis, only facts from the article, with hashtags to help people find the post."}
      </p>
    </div>
  )
}

/**
 * The poster's "Details" for the team's daily report (Daily Trend News in the floating report):
 * what the news is about and why it's a trend, in 1–2 sentences. Write from article fills it in;
 * here the AI writes it again from the same article (or from the headline, subtext and caption).
 */
function DetailsField({
  value,
  brandName,
  headline,
  subtext,
  caption,
  onChange,
  onBlur,
}: {
  value: string
  brandName: string
  headline: string
  subtext: string
  caption: string
  onChange: (details: string) => void
  onBlur: () => void
}) {
  const [busy, setBusy] = useState(false)

  const write = async () => {
    if (!headline.trim()) return void toast.info("Type the headline first", { description: "The details say what the poster's news is about." })
    // The remembered article only when it's this poster's (its headline is one of the AI's choices).
    const memory = articleMemoryOf(headline, brandName)
    setBusy(true)
    try {
      const { details, fellBack } = await suggestTrendDetails({ article: memory?.article ?? "", brand: brandName, headline, subtext, caption })
      onChange(details)
      toast.success("Details written", { description: fellBack ?? (memory ? "From the article." : "From the headline, subtext and caption.") })
    } catch (e) {
      toast.error("Couldn't write the details", { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="poster-details" className="flex items-center gap-1.5 text-sm font-medium">
          <ClipboardList className="size-4 text-muted-foreground" /> Details for the daily report
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-violet-400/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
          onClick={() => void write()}
          disabled={busy}
          title="What the news is about and why it's a trend, in 1–2 sentences"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {value.trim() ? "Write another" : "Write with AI"}
        </Button>
      </div>
      <Textarea
        id="poster-details"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\n+/g, " ").slice(0, DETAILS_MAX))}
        onBlur={onBlur}
        rows={3}
        placeholder="1–2 sentences: what the news is about and why it's today's trend. Write from article fills it in."
        className="min-h-16 resize-y bg-card text-[13px] leading-relaxed"
      />
      <p className="text-[11px] text-muted-foreground">Copied with the poster under Daily Trend News in the floating report. Saved with the poster.</p>
    </div>
  )
}

/** Above this, the subtext wraps onto a second line (and gets smaller). */
const SUBTEXT_LONG = 60

/**
 * Photo enhancing under the Photo buttons: the Enhance button (small photos), progress while
 * it works, "Use original" after, and the switch for doing it automatically.
 */
function EnhancePanel({
  enhancing,
  enhanced,
  photo,
  auto,
  onAuto,
  onEnhance,
  onCancel,
  onOriginal,
}: {
  enhancing: { progress: number; backend: string } | null
  enhanced: boolean
  photo: ReturnType<typeof newsPhotoFrame>
  auto: boolean
  onAuto: (on: boolean) => void
  onEnhance: () => void
  onCancel: () => void
  onOriginal: () => void
}) {
  const small = !!photo?.src && photoNeedsEnhance(photo.naturalWidth, photo.naturalHeight, photo.box.width, photo.box.height)
  const can = !!photo?.src && canEnhancePhoto(photo.naturalWidth, photo.naturalHeight)
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border bg-card p-3 text-xs" role="group" aria-label="Enhance photo">
      {enhancing ? (
        <div className="flex flex-col gap-1.5" role="status">
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-violet-600 dark:text-violet-300" />
            <span className="font-medium">Enhancing the photo… {Math.round(enhancing.progress * 100)}%</span>
            <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={onCancel}>
              <X /> Cancel
            </Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-violet-600 transition-[width]" style={{ width: `${Math.max(3, enhancing.progress * 100)}%` }} />
          </div>
          <span className="text-muted-foreground">
            AI is making it sharper and 4× bigger on this computer{enhancing.backend === "wasm" ? " (on the processor: this can take a minute)" : ""}.
          </span>
        </div>
      ) : enhanced ? (
        <div className="flex items-center gap-2">
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">Enhanced with AI</span>
          <span className="text-muted-foreground">
            {photo?.naturalWidth} × {photo?.naturalHeight} px
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={onOriginal}>
            <Undo2 /> Use original
          </Button>
        </div>
      ) : can ? (
        <div className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1", small ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
            {small ? `Small photo (${photo?.naturalWidth} × ${photo?.naturalHeight} px): it may look soft or pixelated on the poster.` : "Make the photo sharper and bigger with AI."}
          </span>
          <Button size="sm" className="h-7 shrink-0 bg-violet-600 text-white hover:bg-violet-600/90" onClick={onEnhance}>
            <WandSparkles /> Enhance photo
          </Button>
        </div>
      ) : (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <WandSparkles className="size-3.5" />
          {photo?.src ? "The photo is sharp enough for the poster." : "Small, blurry or pixelated photos can be enhanced with AI."}
        </span>
      )}
      <label className="flex items-center justify-between gap-2 border-t pt-2 text-muted-foreground">
        Enhance small photos automatically when added
        <Switch checked={auto} onCheckedChange={onAuto} aria-label="Enhance small photos automatically" size="sm" />
      </label>
    </div>
  )
}

/** About this many characters fit a detail line at full size (28 px in 800 px, with its label). */
const EVENT_LONG = 34

function LongLineHint() {
  return <span className="text-[11px] text-amber-700 dark:text-amber-300">Long: this line gets smaller to stay on one line. Shorter reads better on the poster.</span>
}

function Field({ label, hint, htmlFor, action, children }: { label: string; hint?: string; htmlFor?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("flex justify-between gap-2", action ? "items-center" : "items-baseline")}>
        <label htmlFor={htmlFor} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        {action}
      </div>
      {children}
    </div>
  )
}
