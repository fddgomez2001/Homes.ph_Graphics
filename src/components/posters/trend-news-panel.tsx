"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, format, isToday, parse, startOfDay } from "date-fns"
import {
  AlertTriangle,
  Award,
  Bookmark,
  CalendarDays,
  Clock,
  Flame,
  BookmarkCheck,
  Building2,
  Check,
  ExternalLink,
  FileText,
  Hash,
  Images,
  Loader2,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react"
import { SourceLink, SourceLinks } from "@/components/ai/source-links"
import { useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getSearchKeys, searchTrendingNews } from "@/lib/ai/client"
import {
  defaultTrendKeywords,
  homesPlace,
  samePage,
  splitTerms,
  swapPlace,
  trendBrandOfPage,
  trendPlace,
  trendScope,
  type HomesPlace,
} from "@/lib/ai/homes-places"
import {
  DEFAULT_TREND_DEVELOPERS,
  isFacebookLink,
  keywordsIn,
  negativeIn,
  POST_TIMING_TEXT,
  postTiming,
  storyDate,
  newsAnchor,
  partnerIn,
  placeIn,
  relevanceScore,
  similarHeadline,
  SOURCE_CHECK_TEXT,
  sourceCheck,
  storyAgeDays,
  type TrendStory,
} from "@/lib/ai/trend-news"
import { pickStories, type PickedStory } from "@/lib/ai/story-pick"
import { areaOf, cleanAreaKeywords, foreignKeyword, keywordsInTurn, otherPlaceIn, trendArea, type TrendArea } from "@/lib/ai/trend-area"
import { BRAND_LOOKS, extraLooks, LOOK_KIND, lookLabel } from "@/lib/ai/trend-looks"
import { POSTS_MODES, searchEngineName, type AiSearchInfo, type AiSource, type PostsMode, type TrendBrand, type TrendLook } from "@/lib/ai/types"
import { cn, errorMessage } from "@/lib/utils"
import { NewsArticleDialog } from "./news-article-dialog"
import { searchCostText, useWebSearchEngine } from "./use-web-search"

const KEYWORDS_KEY = "dcm-trend-keywords"
const DEVELOPERS_KEY = "dcm-trend-developers"
const PAGES_KEY = "dcm-trend-pages"
/** The keywords, developers and Pages turned off (kept in the lists, not searched), per brand. */
const OFF_KEY = "dcm-trend-off"
const POSTS_KEY = "dcm-trend-posts"
const SAVED_KEY = "dcm-trend-saved"
const RESULTS_KEY = "dcm-trend-results"
const RESULTS_BY_SCOPE_KEY = "dcm-trend-results-by-scope"
/** "off": keywords added on a Homes.ph page stay on that page (by default they go to every page). */
const TO_ALL_PAGES_KEY = "dcm-trend-all-pages"
/** Where each brand's or page's next search starts in its keyword list (they take turns). */
const CURSOR_KEY = "dcm-trend-cursor"
/** Keywords about other places taken out of a list (1.47), kept here in case they're wanted back. */
const REMOVED_KEY = "dcm-trend-removed-keywords"

function loadCursor(scope: string): number {
  try {
    const n = (JSON.parse(localStorage.getItem(CURSOR_KEY) ?? "{}") as Record<string, unknown>)[scope]
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

function saveCursor(scope: string, n: number) {
  try {
    const all = JSON.parse(localStorage.getItem(CURSOR_KEY) ?? "{}") as Record<string, unknown>
    all[scope] = n
    localStorage.setItem(CURSOR_KEY, JSON.stringify(all))
  } catch {
    // starts from the top next time
  }
}


type ListName = "keywords" | "developers" | "pages"

function readToAllPages(): boolean {
  try {
    return localStorage.getItem(TO_ALL_PAGES_KEY) !== "off"
  } catch {
    return true
  }
}

/** A brand's list (keywords, partner developers or Facebook Pages): the one saved on this computer (even an emptied one), or the team's defaults. */
function loadList(key: string, scope: string, defaults: readonly string[]): string[] {
  try {
    const saved = (JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>)[scope]
    if (Array.isArray(saved) && saved.every((k) => typeof k === "string")) return saved as string[]
  } catch {
    // the defaults
  }
  return [...defaults]
}

function saveList(key: string, scope: string, list: string[] | null) {
  try {
    const all = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>
    if (list) all[scope] = list
    else delete all[scope]
    localStorage.setItem(key, JSON.stringify(all))
  } catch {
    // kept for this window only
  }
}

function loadOff(scope: string): Record<ListName, string[]> {
  const empty = { keywords: [], developers: [], pages: [] }
  try {
    const saved = (JSON.parse(localStorage.getItem(OFF_KEY) ?? "{}") as Record<string, Partial<Record<ListName, unknown>>>)[scope]
    const pick = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])
    return saved ? { keywords: pick(saved.keywords), developers: pick(saved.developers), pages: pick(saved.pages) } : empty
  } catch {
    return empty
  }
}

function saveOff(scope: string, off: Record<ListName, string[]>) {
  try {
    const all = JSON.parse(localStorage.getItem(OFF_KEY) ?? "{}") as Record<string, unknown>
    if (off.keywords.length || off.developers.length || off.pages.length) all[scope] = off
    else delete all[scope]
    localStorage.setItem(OFF_KEY, JSON.stringify(all))
  } catch {
    // kept for this window only
  }
}

function loadPostsMode(): PostsMode {
  try {
    const v = localStorage.getItem(POSTS_KEY)
    return POSTS_MODES.find((m) => m === v) ?? "fallback"
  } catch {
    return "fallback"
  }
}

/**
 * Editable chips: the brand's keywords, partner developers or Facebook Pages, saved on this computer.
 * Click one to turn it off (kept, not searched) or on; All on / All off; Edit adds (one, or a whole
 * pasted list separated by commas or new lines, any length), removes one, or deletes them all; Default
 * brings the team's list back.
 */
function TermsEditor({
  title,
  terms,
  off,
  defaults,
  placeholder,
  label,
  noun,
  note,
  addOption,
  onChange,
  onOff,
  onAdded,
  accept,
}: {
  title: string
  terms: string[]
  off: string[]
  defaults: readonly string[]
  placeholder: string
  label: string
  /** "keyword", "developer", "Page" */
  noun: string
  note?: string
  /** Under the add box (Homes.ph keywords: also add them to the other pages). */
  addOption?: React.ReactNode
  onChange: (next: string[]) => void
  onOff: (next: string[]) => void
  /** After new ones were added here: what else happened ("also added to 16 other pages"). */
  onAdded?: (added: string[]) => string | void
  /** Which typed ones may be added (keywords about another place aren't), and what to say about the others. */
  accept?: (typed: string[]) => { kept: string[]; note: string }
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [confirmClear, setConfirmClear] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const offSet = new Set(off)
  const on = terms.filter((t) => !offSet.has(t)).length
  const isDefault = terms.join("|") === defaults.join("|")
  const plural = `${noun}s`
  const typed = splitTerms(draft)
  const add = () => {
    const have = new Set(terms.map((x) => x.toLowerCase()))
    const checked = accept ? accept(typed) : { kept: typed, note: "" }
    const fresh = checked.kept.filter((t) => !have.has(t.toLowerCase()))
    const already = checked.kept.length - fresh.length
    setDraft("")
    if (!typed.length) return
    if (fresh.length) onChange([...terms, ...fresh])
    const more = fresh.length ? onAdded?.(fresh) : ""
    setAdded(
      [
        fresh.length ? `Added ${fresh.length} ${fresh.length === 1 ? noun : plural} and saved on this computer.` : "",
        already ? `${already} ${already === 1 ? "was" : "were"} already in the list.` : "",
        checked.note,
        more || "",
      ]
        .filter(Boolean)
        .join(" "),
    )
  }
  const toggle = (t: string) => onOff(offSet.has(t) ? off.filter((x) => x !== t) : [...off, t])
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title} <span className="font-normal normal-case">({on === terms.length ? terms.length : `${on} of ${terms.length} on`})</span>
        </span>
        <span className="flex items-center gap-1">
          {terms.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => onOff(on < terms.length ? [] : [...terms])}
              title={on < terms.length ? `Turn every ${noun} on` : `Turn every ${noun} off (they stay in the list)`}
            >
              <Power /> {on < terms.length ? "All on" : "All off"}
            </Button>
          )}
          {!isDefault && defaults.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => onChange([...defaults])} title="Back to the team's list">
              <RotateCcw /> Default
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setEditing((e) => !e)
              setConfirmClear(false)
            }}
            aria-pressed={editing}
            aria-label={`${editing ? "Done editing" : "Edit"} ${label}`}
          >
            <Pencil /> {editing ? "Done" : "Edit"}
          </Button>
        </span>
      </div>
      {note && <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>}
      <ul className="flex max-h-28 flex-wrap gap-1 overflow-y-auto" aria-label={label}>
        {terms.map((k) => {
          const isOff = offSet.has(k)
          return (
            <li key={k} className={cn("flex items-center rounded-full border text-[11px]", isOff ? "border-dashed bg-transparent" : "bg-background")}>
              <button
                type="button"
                aria-pressed={!isOff}
                onClick={() => toggle(k)}
                title={isOff ? `Off: not searched. Click to turn it on.` : `On. Click to turn it off (it stays in the list).`}
                className={cn("rounded-full py-0.5 pl-2", editing ? "pr-0.5" : "pr-2", isOff && "text-muted-foreground line-through decoration-muted-foreground/60")}
              >
                {k}
              </button>
              {editing && (
                <button
                  type="button"
                  aria-label={`Remove ${k}`}
                  className="mr-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => onChange(terms.filter((x) => x !== k))}
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          )
        })}
        {!terms.length && <li className="text-[11px] text-muted-foreground">None. {editing ? `Add a ${noun} below.` : `Click Edit to add ${plural}.`}</li>}
      </ul>
      {terms.length > 0 && <p className="text-[10.5px] text-muted-foreground">Click a {noun} to turn it off or on: only the ones on are searched.</p>}
      {editing && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-1.5">
            <Textarea
              value={draft}
              rows={1}
              onChange={(e) => {
                setDraft(e.target.value)
                setAdded(null)
              }}
              onKeyDown={(e) => {
                // Enter adds; Shift+Enter starts a new line (a pasted list keeps its lines).
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  add()
                }
              }}
              placeholder={placeholder}
              className="max-h-40 min-h-8 resize-none bg-background py-1.5 text-sm md:text-sm"
              aria-label={`New ${plural}`}
            />
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={add} disabled={!typed.length}>
              <Plus /> {typed.length > 1 ? `Add ${typed.length}` : "Add"}
            </Button>
          </div>
          <p className="text-[10.5px] text-muted-foreground">
            Add many at once: paste them separated by commas or on separate lines (no length limit). They&apos;re saved on this computer.
          </p>
          {addOption}
          {added && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300" role="status">
              <Check className="mr-0.5 inline size-3" aria-hidden="true" /> {added}
            </p>
          )}
          {terms.length > 0 &&
            (confirmClear ? (
              <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs" role="alert">
                <span className="flex-1">
                  Delete all {terms.length} {terms.length === 1 ? noun : plural}?{defaults.length ? " Default brings the team's list back." : ""}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    onChange([])
                    onOff([])
                    setConfirmClear(false)
                  }}
                >
                  <Trash2 /> Delete all
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="h-7 self-start text-destructive hover:text-destructive" onClick={() => setConfirmClear(true)}>
                <Trash2 /> Delete all {plural}
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}

type SavedStory = Omit<TrendStory, "date"> & { date: string | null }

interface Found {
  brand: TrendBrand
  /** Whose search it was: the brand, or a Homes.ph page ("homes@cebu"). Not on results saved before 1.38. */
  scope?: string
  anchor: string
  days: number
  stories: SavedStory[]
  sources: AiSource[]
  /** Which engine searched (and why another didn't), the Facebook posts and Pages. */
  search?: AiSearchInfo
  /** The "Look for" kinds searched (none on results saved before 1.43). */
  look?: TrendLook[]
}

/** A story kept on this computer (as JSON) → a story (results saved before 1.36 have no kind). */
function storyOf(s: SavedStory): TrendStory {
  return { ...s, kind: s.kind ?? (isFacebookLink(s.url) ? "facebook" : "news"), date: s.date ? parse(s.date, "yyyy-MM-dd", new Date()) : null }
}

const toSaved = (s: TrendStory): SavedStory => ({ ...s, date: s.date ? format(s.date, "yyyy-MM-dd") : null })
const storyKey = (s: Pick<TrendStory, "url" | "title">) => (s.url || s.title).toLowerCase()

/** The last search (kept until the next one, like the article and its results). */
function loadResults(scope: string): Found | null {
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_BY_SCOPE_KEY) ?? "{}") as Record<string, Found | undefined>
    const mine = all[scope]
    if (mine && Array.isArray(mine.stories)) return mine
    // The one search kept before 1.47 (shown only for the brand or page it was made for).
    const raw = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? "null") as Found | null
    return raw && (raw.scope ?? raw.brand) === scope && Array.isArray(raw.stories) ? raw : null
  } catch {
    return null
  }
}

/** Keeps a brand's or page's last search apart from the others' (the 24 newest searches stay). */
function saveResults(scope: string, found: Found) {
  const all = JSON.parse(localStorage.getItem(RESULTS_BY_SCOPE_KEY) ?? "{}") as Record<string, Found & { at?: number }>
  all[scope] = { ...found, at: Date.now() } as Found & { at?: number }
  const keep = Object.entries(all)
    .sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0))
    .slice(0, 24)
  localStorage.setItem(RESULTS_BY_SCOPE_KEY, JSON.stringify(Object.fromEntries(keep)))
  localStorage.removeItem(RESULTS_KEY)
}

function loadSaved(scope: string): SavedStory[] {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as Record<string, unknown>
    const list = all[scope]
    return Array.isArray(list) ? (list as SavedStory[]).filter((s) => s && typeof s.title === "string") : []
  } catch {
    return []
  }
}

function writeSaved(scope: string, list: SavedStory[]) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as Record<string, unknown>
    if (list.length) all[scope] = list
    else delete all[scope]
    localStorage.setItem(SAVED_KEY, JSON.stringify(all))
  } catch {
    // kept for this window only
  }
}

/** "Look for" kinds, per brand (all of the brand's kinds until changed). */
const LOOK_KEY = "dcm-trend-look"

function loadLooks(brand: TrendBrand): TrendLook[] {
  try {
    const all = JSON.parse(localStorage.getItem(LOOK_KEY) ?? "{}") as Record<string, unknown>
    const list = all[brand]
    if (Array.isArray(list)) return BRAND_LOOKS[brand].filter((l) => list.includes(l))
  } catch {
    // the defaults
  }
  return [...BRAND_LOOKS[brand]]
}

function saveLooks(brand: TrendBrand, looks: TrendLook[]) {
  try {
    const all = JSON.parse(localStorage.getItem(LOOK_KEY) ?? "{}") as Record<string, unknown>
    if (looks.length === BRAND_LOOKS[brand].length) delete all[brand]
    else all[brand] = looks
    localStorage.setItem(LOOK_KEY, JSON.stringify(all))
  } catch {
    // this window only
  }
}

const WINDOWS = [
  { days: 1, label: "That day only" },
  { days: 2, label: "+ the day before" },
  { days: 3, label: "Last 3 days" },
  { days: 7, label: "This week" },
]

const POSTS_OPTIONS: { id: PostsMode; label: string; about: string }[] = [
  { id: "fallback", label: "If no news is found", about: "Public Facebook posts are searched only when no news with a link is found (2 more searches)." },
  { id: "always", label: "Always", about: "Public Facebook posts are searched every time, with the news (2 more searches each time)." },
  { id: "off", label: "Off", about: "News only." },
]

type Filter = "all" | "news" | "facebook" | "partner"
type Sort = "relevant" | "latest"

const KIND_BADGE: Record<TrendStory["kind"], { text: string; className: string }> = {
  news: { text: "News site", className: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
  facebook: { text: "Facebook post", className: "bg-blue-600/12 text-blue-700 dark:text-blue-300" },
  page: { text: "Facebook Page", className: "bg-blue-600/12 text-blue-700 dark:text-blue-300" },
}

/**
 * Each story with its checks (date, positive, posted already, partner, keywords, place, source, relevance).
 * `helpful`: the search looked for helpful information too, so a price drop or a closure isn't flagged.
 */
function checkStory(story: TrendStory, ctx: { anchor: Date; days: number; posted: string[]; developers: string[]; keywords: string[]; brand: TrendBrand; place: HomesPlace | null; area: TrendArea | null; helpful: boolean }) {
  const age = storyAgeDays(story, ctx.anchor)
  const fresh = age !== null && age >= -1 && age < ctx.days
  const text = `${story.title} ${story.summary}`
  const negative = negativeIn(text, ctx.helpful)
  const repeat = ctx.posted.find((t) => similarHeadline(t, story.title)) ?? ""
  // A partner developer's news goes first (the team's top priority).
  const partner = partnerIn(`${text} ${story.from ?? ""}`, ctx.developers)
  const matched = keywordsIn(text, ctx.keywords)
  const place = placeIn(`${text} ${story.from ?? ""}`, ctx.brand, ctx.place)
  // In the page's own place, or elsewhere (1.47: Homes.ph Gensan = General Santos City only, CARAGA = Caraga, PicklePlay = the Philippines).
  const placeText = `${text} ${story.where ?? ""} ${story.from ?? ""}`
  const area = areaOf(placeText, ctx.area)
  const elsewhere = area === "outside" ? otherPlaceIn(placeText, ctx.area) : ""
  const check = sourceCheck(story)
  const score = relevanceScore({ age, days: ctx.days, check, partner: !!partner, keywords: matched.length, place: !!place, negative: !!negative, repeat: !!repeat, trending: !!story.why, look: !!story.look && story.look !== "realestate", hot: story.trending })
  // When to post it: an event today or tomorrow goes out now; older news only stays "good this week".
  const timing = postTiming(story, ctx.anchor)
  // A Facebook post often shows no date a search engine can read: shown, but flagged.
  const undatedPost = age === null && story.kind !== "news"
  const ok = fresh && (story.verified || story.kind === "page") && !negative && !repeat && area !== "outside"
  return { story, age, fresh, undatedPost, negative, repeat, partner, matched, place: place || story.where || "", area, elsewhere, check, score, timing, ok, old: !fresh && !undatedPost }
}

type Checked = ReturnType<typeof checkStory>

/**
 * Poster Maker → Trending news: the chosen web search (Tavily, Google through SerpApi, Perplexity, Groq
 * or Gemini) looks for the newest positive stories about the brand's keywords (those turned on),
 * published on the poster's day or just before it, never later than today. When no news with a link
 * is found, public Facebook posts are searched too (or always, or never), and the Facebook Pages the
 * person lists are read with their own Meta token. Each story shows its source, date, place, keywords,
 * how relevant it is and what to check; "Use this news" writes the poster from it, "Write article"
 * writes a full article, "Carousel" starts a carousel from it, and Save keeps it for later.
 * Each Homes.ph page has its own lists and place: Homes.ph Cebu starts with "Cebu Real Estate"…, and
 * its searches stay in Cebu.
 */
export function TrendNewsPanel({
  brand,
  brandName,
  page = null,
  allPages = [],
  day,
  disabled,
  onUse,
  onCarousel,
}: {
  brand: TrendBrand
  brandName: string
  /** Homes.ph posters: the Facebook page ("Homes.ph Cebu"): its own keywords and place. */
  page?: string | null
  /** Every Homes.ph page (new keywords can go to all of them, each with its own place). */
  allPages?: string[]
  day: string
  disabled: boolean
  onUse: (story: TrendStory) => void
  /** Starts a carousel from the story (closes the poster's dialog first). */
  onCarousel?: (story: TrendStory) => void
}) {
  const engine = useWebSearchEngine()
  // Whose lists these are (the brand, or the Homes.ph page), and the page's place for the search.
  const scope = trendScope(brand, page)
  const place = trendPlace(brand, page)
  const keywordDefaults = defaultTrendKeywords(brand, page)
  const isHomes = brand === "homes" || brand === "gensan"
  // The page's own place: stories and keywords about other places are left out (none for FHI and the Main Page).
  const area = trendArea(brand, place)
  const [developers, setDevelopers] = useState<string[]>(() => loadList(DEVELOPERS_KEY, scope, DEFAULT_TREND_DEVELOPERS[brand]))
  // Keywords about other places (Koronadal on Homes.ph Gensan; Caraga's copied to Homes.ph Cebu) are taken out when the list opens.
  const [cleaned] = useState(() => cleanAreaKeywords(loadList(KEYWORDS_KEY, scope, keywordDefaults), area, place, [...developers, ...DEFAULT_TREND_DEVELOPERS[brand]]))
  const [keywords, setKeywords] = useState<string[]>(cleaned.kept)
  const [pages, setPages] = useState<string[]>(() => loadList(PAGES_KEY, scope, []))
  const [off, setOff] = useState<Record<ListName, string[]>>(() => loadOff(scope))
  const [toAllPages, setToAllPages] = useState(readToAllPages)
  const [postsMode, setPostsMode] = useState<PostsMode>(loadPostsMode)
  const [looks, setLooks] = useState<TrendLook[]>(() => loadLooks(brand))
  const [hasMeta, setHasMeta] = useState(() => !!getSearchKeys().meta)
  const hasDevelopers = DEFAULT_TREND_DEVELOPERS[brand].length > 0 || developers.length > 0
  const [days, setDays] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<Found | null>(() => loadResults(scope))
  const [showOld, setShowOld] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<Sort>("relevant")
  const [query, setQuery] = useState("")
  const [saved, setSaved] = useState<SavedStory[]>(() => loadSaved(scope))
  const [showSaved, setShowSaved] = useState(false)
  const [articleFor, setArticleFor] = useState<TrendStory | null>(null)

  // The cleaned list is saved (and what was taken out is kept apart, in case it's wanted back).
  useEffect(() => {
    if (!cleaned.removed.length) return
    saveList(KEYWORDS_KEY, scope, cleaned.kept)
    try {
      const all = JSON.parse(localStorage.getItem(REMOVED_KEY) ?? "{}") as Record<string, unknown>
      const before = Array.isArray(all[scope]) ? (all[scope] as string[]) : []
      all[scope] = [...new Set([...before, ...cleaned.removed])]
      localStorage.setItem(REMOVED_KEY, JSON.stringify(all))
    } catch {
      // only the list is saved
    }
  }, [cleaned, scope])

  // A Meta token saved or removed in Settings shows or hides the Facebook Pages list.
  useEffect(() => {
    const load = () => setHasMeta(!!getSearchKeys().meta)
    window.addEventListener("dcm-search-keys", load)
    return () => window.removeEventListener("dcm-search-keys", load)
  }, [])

  const posterDay = parse(day, "yyyy-MM-dd", new Date())
  const anchor = newsAnchor(posterDay)
  const anchorKey = format(anchor, "yyyy-MM-dd")
  // Headlines posted in the last 30 days (posters and articles): the same story isn't suggested again.
  const recent = useProjects({ kind: "news", from: addDays(startOfDay(anchor), -30).toISOString(), to: addDays(startOfDay(posterDay), 2).toISOString(), orderBy: "scheduled_at", ascending: false, limit: 300 })
  const posted = useMemo(() => [...new Set(recent.projects.map((p) => p.title).filter((t) => t && !/^untitled/i.test(t)))].slice(0, 100), [recent.projects])

  const active = (list: string[], name: ListName) => list.filter((t) => !off[name].includes(t))
  const onKeywords = active(keywords, "keywords")
  const onDevelopers = active(developers, "developers")
  const onPages = hasMeta ? active(pages, "pages") : []

  const changeList = (name: ListName, next: string[]) => {
    const defaults = name === "keywords" ? keywordDefaults : name === "developers" ? DEFAULT_TREND_DEVELOPERS[brand] : []
    if (name === "keywords") setKeywords(next)
    else if (name === "developers") setDevelopers(next)
    else setPages(next)
    saveList(name === "keywords" ? KEYWORDS_KEY : name === "developers" ? DEVELOPERS_KEY : PAGES_KEY, scope, next.join("|") === defaults.join("|") ? null : next)
    // A removed term is no longer "off".
    if (off[name].some((t) => !next.includes(t))) changeOff(name, off[name].filter((t) => next.includes(t)))
  }
  const changeOff = (name: ListName, next: string[]) => {
    setOff((prev) => {
      const all = { ...prev, [name]: next }
      saveOff(scope, all)
      return all
    })
  }
  const changeToAllPages = (on: boolean) => {
    setToAllPages(on)
    try {
      if (on) localStorage.removeItem(TO_ALL_PAGES_KEY)
      else localStorage.setItem(TO_ALL_PAGES_KEY, "off")
    } catch {
      // this window only
    }
  }
  /** Keywords just added on this Homes.ph page also go to every other page, with that page's place. */
  const addToOtherPages = (added: string[]): string => {
    if (!isHomes || !page || !toAllPages) return ""
    const from = homesPlace(page)
    let changed = 0
    for (const other of allPages) {
      if (samePage(other, page)) continue
      const otherBrand = trendBrandOfPage(other)
      const otherScope = trendScope(otherBrand, other)
      const list = loadList(KEYWORDS_KEY, otherScope, defaultTrendKeywords(otherBrand, other))
      const have = new Set(list.map((k) => k.toLowerCase()))
      const otherArea = trendArea(otherBrand, trendPlace(otherBrand, other))
      const fresh = added
        .map((k) => swapPlace(k, from, homesPlace(other)))
        .filter((k) => k && !foreignKeyword(k, otherArea, DEFAULT_TREND_DEVELOPERS[otherBrand]) && !have.has(k.toLowerCase()) && !!have.add(k.toLowerCase()))
      if (!fresh.length) continue
      saveList(KEYWORDS_KEY, otherScope, [...list, ...fresh])
      changed += 1
    }
    return changed ? `Also added to ${changed} other Homes.ph ${changed === 1 ? "page" : "pages"}, each with its own place.` : ""
  }
  const toggleLook = (look: TrendLook) => {
    const next = BRAND_LOOKS[brand].filter((l) => (l === look ? !looks.includes(l) : looks.includes(l)))
    setLooks(next)
    saveLooks(brand, next)
  }
  // Partner developers are searched when real estate is on (or the brand has no real estate kind).
  const searchesDevelopers = onDevelopers.length > 0 && (looks.includes("realestate") || !BRAND_LOOKS[brand].includes("realestate"))
  const kinds = extraLooks(looks).length
  const helpfulOn = looks.includes("helpful")

  const changePosts = (mode: PostsMode) => {
    setPostsMode(mode)
    try {
      if (mode === "fallback") localStorage.removeItem(POSTS_KEY)
      else localStorage.setItem(POSTS_KEY, mode)
    } catch {
      // this window only
    }
  }

  /** Searches the news (`n`: how many days, from "Search more days"). */
  const search = async (n = days) => {
    if (!onKeywords.length) return setError(keywords.length ? "Turn on at least one keyword (click it)." : "Add at least one keyword (Edit).")
    setBusy(true)
    setError(null)
    try {
      // The first keyword every time; the others take turns, from where the last search stopped.
      const at = loadCursor(scope)
      const { stories, sources, search: how } = await searchTrendingNews({
        brand,
        keywords: keywordsInTurn(onKeywords, at),
        ...(onDevelopers.length ? { developers: onDevelopers } : {}),
        day: anchorKey,
        days: n,
        avoid: posted,
        posts: postsMode,
        ...(onPages.length ? { pages: onPages } : {}),
        ...(place ? { place: place.page } : {}),
        ...(looks.length ? { look: looks } : {}),
      })
      if (how?.keywordsUsed) saveCursor(scope, at + Math.max(0, how.keywordsUsed - 1))
      const next: Found = { brand, scope, anchor: anchorKey, days: n, stories: stories.map(toSaved), sources, search: how, ...(looks.length ? { look: looks } : {}) }
      setFound(next)
      setShowOld(false)
      setFilter("all")
      setQuery("")
      try {
        saveResults(scope, next)
      } catch {
        // kept until this window closes
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // (The React Compiler keeps these from being worked out again on every render.)
  const ctx = { anchor: parse(found?.anchor ?? anchorKey, "yyyy-MM-dd", new Date()), days: found?.days ?? days, posted, developers, keywords, brand, place, area, helpful: !!found?.look?.includes("helpful") }
  const checkedAll = found ? found.stories.map((s) => checkStory(storyOf(s), ctx)) : []
  // News from another place isn't shown at all (the page's news only).
  const stories = checkedAll.filter((s) => s.area !== "outside")
  const elsewhere = checkedAll.filter((s) => s.area === "outside")
  const counts = {
    all: stories.filter((s) => !s.old).length,
    news: stories.filter((s) => !s.old && s.story.kind === "news").length,
    facebook: stories.filter((s) => !s.old && s.story.kind !== "news").length,
    partner: stories.filter((s) => !s.old && !!s.partner).length,
  }
  // The story picker: the best one for the poster's day and up to 3 backups (the rest: why not).
  const picks = pickStories(stories, { brand, day: parse(day, "yyyy-MM-dd", new Date()), page: place, posted })
  const ranked = new Map<string, { rank: number; p: PickedStory<Checked> }>()
  ;[picks.pick, ...picks.backups].forEach((p, rank) => p && ranked.set(storyKey(p.c.story), { rank, p }))
  const rejects = new Map(picks.rejected.map((r) => [storyKey(r.c.story), r.reason]))
  const rankOf = (c: Checked) => ranked.get(storyKey(c.story))?.rank ?? 9
  const q = query.trim().toLowerCase()
  const shown = stories
    .filter((s) => !s.old || showOld)
    .filter((s) => (filter === "news" ? s.story.kind === "news" : filter === "facebook" ? s.story.kind !== "news" : filter === "partner" ? !!s.partner : true))
    .filter((s) => !q || `${s.story.title} ${s.story.summary} ${s.story.site} ${s.story.from ?? ""} ${s.story.sourceName ?? ""} ${s.place} ${s.matched.join(" ")} ${s.story.look ? LOOK_KIND[s.story.look] : ""}`.toLowerCase().includes(q))
    .sort((a, b) =>
      sort === "latest"
        ? (b.story.date?.getTime() ?? 0) - (a.story.date?.getTime() ?? 0) || b.score - a.score
        : rankOf(a) - rankOf(b) || Number(b.ok) - Number(a.ok) || Number(!!b.partner) - Number(!!a.partner) || b.score - a.score,
    )
  const hidden = stories.filter((s) => s.old).length
  const savedKeys = new Set(saved.map(storyKey))
  const savedChecked = saved.map((s) => checkStory(storyOf(s), ctx))

  const toggleSave = (story: TrendStory) => {
    const key = storyKey(story)
    const next = savedKeys.has(key) ? saved.filter((s) => storyKey(s) !== key) : [toSaved(story), ...saved].slice(0, 50)
    setSaved(next)
    writeSaved(scope, next)
  }

  // Few or no stories: one click searches more days.
  const searchedDays = error ? days : (found?.days ?? days)
  const wider = WINDOWS.filter((w) => w.days > searchedDays).slice(0, 2)
  const showWider = !busy && wider.length > 0 && (!!error || (!!found && counts.all < 2))
  const widerButtons = showWider && (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      {error ? "Nothing found? Search more days:" : "Only a few stories? Search more days:"}
      {wider.map((w) => (
        <Button
          key={w.days}
          type="button"
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          disabled={disabled}
          onClick={() => {
            setDays(w.days)
            void search(w.days)
          }}
        >
          {w.label}
        </Button>
      ))}
    </p>
  )

  const windowText = (n: number, at: Date) =>
    n === 1 ? format(at, "EEE, MMM d") : `${format(addDays(at, -(n - 1)), "MMM d")} – ${format(at, "MMM d")}`

  const posts = found?.search?.posts
  const meta = found?.search?.meta

  const card = (c: Checked, i: number, inSaved = false) => (
    <StoryCard
      key={`${storyKey(c.story)}-${i}`}
      c={c}
      saved={savedKeys.has(storyKey(c.story))}
      disabled={disabled || busy}
      inSaved={inSaved}
      picked={inSaved ? undefined : ranked.get(storyKey(c.story))}
      rejected={inSaved ? undefined : rejects.get(storyKey(c.story))}
      onUse={() => onUse(c.story)}
      onArticle={() => setArticleFor(c.story)}
      onCarousel={onCarousel ? () => onCarousel(c.story) : undefined}
      onSave={() => toggleSave(c.story)}
    />
  )

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <TermsEditor
        title={`Keywords for ${brandName}`}
        terms={keywords}
        off={off.keywords}
        defaults={keywordDefaults}
        placeholder={
          isHomes
            ? `Add keywords, e.g. ${homesPlace(page ?? "Caraga").keyword} Restaurants Opening Soon, ${homesPlace(page ?? "Caraga").keyword} Cafe Grand Opening`
            : brand === "fhi"
              ? "Add keywords, e.g. Dubai Hotel Openings, Abu Dhabi New Projects"
              : "Add keywords, e.g. Pickleball Cebu, Pickleball Court Grand Opening"
        }
        label="Keywords"
        noun="keyword"
        note={place ? `Written for ${place.page === "Main Page" ? "the whole Philippines" : place.page}: every search stays in ${place.region}.` : undefined}
        addOption={
          isHomes && page && allPages.length > 1 ? (
            <label className="flex items-start gap-2 text-[11px] leading-snug">
              <Checkbox checked={toAllPages} onCheckedChange={(v) => changeToAllPages(v === true)} className="mt-px" />
              <span>
                Also add them to every other Homes.ph page, with that page&apos;s place
                <span className="text-muted-foreground"> (e.g. &ldquo;{homesPlace(page).keyword} Restaurant Grand Opening&rdquo; becomes &ldquo;{homesPlace(samePage(page, "Cebu") ? "Caraga" : "Cebu").keyword} Restaurant Grand Opening&rdquo; on Homes.ph {samePage(page, "Cebu") ? "CARAGA" : "Cebu"})</span>
              </span>
            </label>
          ) : undefined
        }
        onChange={(next) => changeList("keywords", next)}
        onOff={(next) => changeOff("keywords", next)}
        onAdded={addToOtherPages}
        accept={(typed) => {
          const devs = [...developers, ...DEFAULT_TREND_DEVELOPERS[brand]]
          const other = typed.filter((k) => foreignKeyword(k, area, devs))
          return {
            kept: typed.filter((k) => !other.includes(k)),
            note: other.length ? `Not added (about another place, not ${area?.label}): ${other.join(", ")}.` : "",
          }
        }}
      />
      {cleaned.removed.length > 0 && (
        <p className="-mt-1 text-[11px] text-muted-foreground">
          Took out {cleaned.removed.length} {cleaned.removed.length === 1 ? "keyword" : "keywords"} about other places (only {area?.label} is searched here):{" "}
          {cleaned.removed.slice(0, 6).join(", ")}
          {cleaned.removed.length > 6 ? `, and ${cleaned.removed.length - 6} more` : ""}.
        </p>
      )}
      {hasDevelopers && (
        <TermsEditor
          title="Partner developers"
          terms={developers}
          off={off.developers}
          defaults={DEFAULT_TREND_DEVELOPERS[brand]}
          placeholder="Add a developer, e.g. Emaar Properties"
          label="Partner developers"
          noun="developer"
          note={
            brand === "fhi"
              ? "Their positive news anywhere in the UAE comes first: new projects, launches, awards, record sales."
              : `Their new, proposed or launched projects in ${brand === "gensan" ? "General Santos City" : place ? place.region : "Caraga"} come first. Every story names its place.`
          }
          onChange={(next) => changeList("developers", next)}
          onOff={(next) => changeOff("developers", next)}
        />
      )}
      {hasMeta && (
        <TermsEditor
          title="Facebook Pages to read"
          terms={pages}
          off={off.pages}
          defaults={[]}
          placeholder="A Page's link or name, e.g. facebook.com/CamellaHomes"
          label="Facebook Pages"
          noun="Page"
          note="Read with your Meta token (Settings → AI), at most 10 each search. A token reads only the Pages you manage, unless your Meta app has Page Public Content Access; the others are listed with the results."
          onChange={(next) => changeList("pages", next)}
          onOff={(next) => changeOff("pages", next)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="How new">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              role="radio"
              aria-checked={days === w.days}
              onClick={() => setDays(w.days)}
              className={cn("rounded-md px-2 py-1 text-xs font-medium", days === w.days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {w.label}
            </button>
          ))}
        </div>
        <Button type="button" onClick={() => void search(days)} disabled={busy || disabled || !onKeywords.length} className="bg-violet-600 text-white hover:bg-violet-600/90">
          {busy ? <Loader2 className="animate-spin" /> : <Search />} {busy ? "Searching the news…" : found ? "Search again" : "Search trending news"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Look for">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Your keywords are always searched. These add other kinds of news in the same place, so there is something to post every day.">
          <Sparkles className="size-3.5" aria-hidden="true" /> Look for:
        </span>
        {BRAND_LOOKS[brand].map((l) => {
          const on = looks.includes(l)
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              onClick={() => toggleLook(l)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                on ? "border-violet-500/40 bg-violet-500/12 text-violet-700 dark:text-violet-300" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {on && <Check className="size-3" aria-hidden="true" />}
              {lookLabel(l, brand)}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Megaphone className="size-3.5" aria-hidden="true" /> Facebook posts:
        </span>
        <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Public Facebook posts">
          {POSTS_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={postsMode === o.id}
              title={o.about}
              onClick={() => changePosts(o.id)}
              className={cn("rounded-md px-2 py-1 text-xs font-medium", postsMode === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        News published {windowText(days, anchor)}
        {isToday(anchor) ? " (up to today" + (startOfDay(posterDay).getTime() > anchor.getTime() ? `; the poster is for ${format(posterDay, "MMM d")}` : "") + ")" : ""},{" "}
        {helpfulOn ? "positive and helpful stories" : "positive stories only"}
        {kinds ? " of your keywords and the kinds above" : ""},{" "}
        {searchCostText(engine, searchesDevelopers, kinds)} {POSTS_OPTIONS.find((o) => o.id === postsMode)?.about}
        {!onKeywords.length && <span className="text-amber-700 dark:text-amber-300"> Turn on or add at least one keyword to search.</span>}
      </p>
      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
      {error && widerButtons}

      {saved.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowSaved((v) => !v)}
            aria-expanded={showSaved}
          >
            <BookmarkCheck className="size-3.5" /> {showSaved ? "Hide" : "Show"} saved stories ({saved.length})
          </button>
          {showSaved && (
            <ol className="flex flex-col gap-1.5 rounded-lg border border-dashed p-1.5" aria-label="Saved stories">
              {savedChecked.map((c, i) => card(c, i, true))}
            </ol>
          )}
        </div>
      )}

      {found && (
        <div className="flex min-h-0 flex-col gap-1.5" aria-label="Trending stories">
          <p className="text-xs text-muted-foreground">
            {counts.all} new {counts.all === 1 ? "story" : "stories"} for {windowText(found.days, parse(found.anchor, "yyyy-MM-dd", new Date()))}
            {found.sources.length ? ` · ${found.sources.length} pages searched` : ""}
            {found.search ? ` with ${searchEngineName(found.search.engine)}` : ""}. Pick one: its article is read and the poster is written from it.
          </p>
          {elsewhere.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {elsewhere.length} {elsewhere.length === 1 ? "story" : "stories"} from other places left out ({[...new Set(elsewhere.map((s) => s.elsewhere).filter(Boolean))].slice(0, 4).join(", ")}): only {area?.label ?? "the page's place"}.
            </p>
          )}
          {!!found.search?.queries?.length && (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer select-none hover:text-foreground">What was searched ({found.search.queries.length})</summary>
              <ul className="mt-1 list-disc pl-4">
                {found.search.queries.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              {!!found.search.skipped?.length && <p className="mt-1">Not searched (about another place): {found.search.skipped.join(", ")}</p>}
            </details>
          )}
          {found.search?.note && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              {found.search.note} {searchEngineName(found.search.engine)} searched instead.
            </p>
          )}
          {!error && widerButtons}
          {posts && (
            <p className={cn("text-[11px]", posts.error ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
              {posts.error
                ? `Facebook posts couldn't be searched: ${posts.error}`
                : posts.why === "no-news"
                  ? posts.found
                    ? `No news with a link was found for these days, so public Facebook posts were searched (${searchEngineName(posts.engine)}, ${posts.found} found). Search engines index only some public posts, and some need a Facebook login to open: check each one is from the official Page.`
                    : "No news with a link was found, and no public Facebook posts for these days either."
                  : `Public Facebook posts searched too (${searchEngineName(posts.engine)}${posts.found ? `, ${posts.found} found` : ", none found"}).`}
            </p>
          )}
          {meta && (
            <div className="text-[11px] text-muted-foreground">
              {meta.posts} {meta.posts === 1 ? "post" : "posts"} read from {meta.pages} Facebook {meta.pages === 1 ? "Page" : "Pages"}.
              {meta.errors.map((e) => (
                <p key={e} className="text-amber-700 dark:text-amber-300">
                  {e}
                </p>
              ))}
            </div>
          )}

          {stories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex flex-wrap rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Show">
                {(
                  [
                    ["all", "All"],
                    ["news", "News sites"],
                    ["facebook", "Facebook"],
                    ["partner", "Partner developers"],
                  ] as const
                ).map(([id, label]) =>
                  id === "partner" && !hasDevelopers ? null : (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={filter === id}
                      onClick={() => setFilter(id)}
                      className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", filter === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {label} <span className="opacity-70">{counts[id]}</span>
                    </button>
                  ),
                )}
              </div>
              <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Order">
                {(
                  [
                    ["relevant", "Most relevant"],
                    ["latest", "Latest"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={sort === id}
                    onClick={() => setSort(id)}
                    className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", sort === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter: keyword or place" className="h-7 w-48 bg-background text-xs md:text-xs" aria-label="Filter the stories" />
            </div>
          )}

          {picks.pick ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/8 px-2.5 py-2 text-xs">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                <Award className="size-3.5" aria-hidden="true" /> Best pick for {format(parse(day, "yyyy-MM-dd", new Date()), "EEE, MMM d")}
                <span className="font-normal text-muted-foreground">
                  score {picks.pick.score.total}/100 · {picks.backups.length ? `${picks.backups.length} backup${picks.backups.length === 1 ? "" : "s"}` : "no backup"} · {picks.rejected.length} not suitable
                </span>
              </p>
              <p className="mt-0.5 leading-snug font-medium">{picks.pick.c.story.title}</p>
              {picks.pick.why && <p className="mt-0.5 leading-snug text-muted-foreground">{picks.pick.why}</p>}
            </div>
          ) : (
            picks.notes && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/8 px-2.5 py-2 text-xs leading-snug text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {picks.notes}
              </p>
            )
          )}
          <ol className="flex flex-col gap-1.5">{shown.map((c, i) => card(c, i))}</ol>
          {hidden > 0 && (
            <button type="button" className="self-start text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setShowOld((v) => !v)}>
              {showOld ? "Hide" : "Show"} {hidden} older or undated {hidden === 1 ? "story" : "stories"}
            </button>
          )}
          {!shown.length && (stories.length ? <p className="text-xs text-muted-foreground">No story matches this filter.</p> : <p className="text-xs text-muted-foreground">Nothing new found. Try more days, or other keywords.</p>)}
          <SourceLinks sources={found.sources} />
        </div>
      )}

      <NewsArticleDialog story={articleFor} brandName={brandName} onOpenChange={(open) => !open && setArticleFor(null)} />
    </div>
  )
}

function StoryCard({
  c,
  saved,
  disabled,
  inSaved,
  picked,
  rejected,
  onUse,
  onArticle,
  onCarousel,
  onSave,
}: {
  c: Checked
  saved: boolean
  disabled: boolean
  inSaved: boolean
  /** The story picker's choice: 0 the best pick, 1–3 a backup. */
  picked?: { rank: number; p: PickedStory<Checked> }
  /** Why the story picker left it out. */
  rejected?: string
  onUse: () => void
  onArticle: () => void
  onCarousel?: () => void
  onSave: () => void
}) {
  const { story, age, fresh, undatedPost, negative, repeat, partner, matched, place, check, score, timing, ok } = c
  const eventDay = story.eventDate ? storyDate(story.eventDate) : null
  const [imageOk, setImageOk] = useState(true)
  const badge = KIND_BADGE[story.kind]
  const goodCheck = check === "official" || check === "trusted" || check === "found" || check === "page"
  return (
    <li className={cn("flex items-start gap-2 rounded-lg border bg-card p-2.5", !ok && "opacity-90", picked?.rank === 0 && "border-emerald-500/60 ring-1 ring-emerald-500/30")}>
      {story.image && imageOk ? (
        // Google's thumbnail or the post's photo (remote; hidden when it doesn't load).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageOk(false)} className="mt-0.5 size-14 shrink-0 rounded-md border object-cover" />
      ) : (
        <TrendingUp className={cn("mt-0.5 size-4 shrink-0", ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug font-semibold">{story.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1">
          {picked && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                picked.rank === 0 ? "bg-emerald-600 text-white" : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
              )}
              title={`Pick score ${picked.p.score.total}/100: audience fit ${picked.p.score.fit}/25, partner developer ${picked.p.score.partner}/20, timing ${picked.p.score.timing}/15, usefulness ${picked.p.score.useful}/15, keywords and kinds ${picked.p.score.match}/10, poster potential ${picked.p.score.poster}/10, buzz ${picked.p.score.buzz}/5. Source: Tier ${picked.p.tier}.`}
            >
              <Award className="size-3" aria-hidden="true" /> {picked.rank === 0 ? "Best pick" : `Backup ${picked.rank}`} · {picked.p.score.total}
            </span>
          )}
          {picked && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold" title="Tier 1: government and official offices, a partner developer's own Page. Tier 2: established news outlets. Tier 3: local pages and sites.">
              Tier {picked.p.tier}
            </span>
          )}
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold", badge.className)}>{badge.text}</span>
          {story.look && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/12 px-1.5 py-0.5 text-[10.5px] font-semibold text-orange-700 dark:text-orange-300">
              <Tag className="size-3" aria-hidden="true" /> {LOOK_KIND[story.look]}
            </span>
          )}
          {partner && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-700 dark:text-violet-300">
              <Building2 className="size-3" aria-hidden="true" /> Partner developer: {partner}
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
              score >= 70 ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : score >= 45 ? "bg-muted text-foreground" : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
            )}
            title="How well it fits: new, on your keywords and place, a partner developer, a trusted source"
          >
            Relevance {score}
          </span>
          {story.trending && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                story.trending >= 70 ? "bg-rose-500/12 text-rose-700 dark:text-rose-300" : "bg-muted text-foreground",
              )}
              title="How hot the AI rates this story for the page's followers (its own estimate, not a measured number)"
            >
              <Flame className="size-3" aria-hidden="true" /> Trending {story.trending}%
            </span>
          )}
          {ok && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                timing === "now" ? "bg-rose-500/12 text-rose-700 dark:text-rose-300" : timing === "today" ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-muted text-foreground",
              )}
              title="When to post it: an event today or tomorrow goes out now, the day's news today, the rest stays useful this week"
            >
              <Clock className="size-3" aria-hidden="true" /> {POST_TIMING_TEXT[timing]}
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{story.date ? `${format(story.date, "EEE, MMM d")}${age === 0 ? " (that day)" : age === 1 ? " (a day before)" : ""}` : "date not given"}</span>
          {eventDay && (
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              <CalendarDays className="size-3" aria-hidden="true" /> Happens {format(eventDay, "EEE, MMM d")}
            </span>
          )}
          {(story.from || story.site || story.sourceName) && (
            <span>{story.kind === "page" ? story.from || story.site : story.sourceName && story.sourceName.toLowerCase() !== story.site.toLowerCase() ? `${story.sourceName}${story.site ? ` · ${story.site}` : ""}` : story.site}</span>
          )}
          <span className={cn("inline-flex items-center gap-0.5", goodCheck ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300")}>
            {check === "official" || check === "trusted" ? <ShieldCheck className="size-3" aria-hidden="true" /> : goodCheck ? <Check className="size-3" aria-hidden="true" /> : <AlertTriangle className="size-3" aria-hidden="true" />}
            {SOURCE_CHECK_TEXT[check]}
          </span>
        </p>
        {story.url ? <SourceLink url={story.url} className="mt-0.5" /> : <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">No source link given</p>}
        {story.summary && <p className="mt-1 text-xs leading-snug">{story.summary}</p>}
        {story.why && <p className="mt-0.5 text-[11px] text-muted-foreground italic">Why it fits: {story.why}</p>}
        {(place || matched.length > 0) && (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-[10.5px] text-muted-foreground">
            {place && (
              <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px">
                <MapPin className="size-3" aria-hidden="true" /> {place}
              </span>
            )}
            {matched.map((k) => (
              <span key={k} className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px">
                <Hash className="size-3" aria-hidden="true" /> {k}
              </span>
            ))}
          </p>
        )}
        {picked && picked.rank > 0 && picked.p.why && <p className="mt-0.5 text-[11px] text-muted-foreground">Why a backup: {picked.p.why}</p>}
        {picked && picked.p.notes.length > 0 && (
          <ul className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-sky-800 dark:text-sky-300">
            {picked.p.notes.map((n) => (
              <li key={n} className="inline-flex items-start gap-1">
                <Check className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> Check before posting: {n}
              </li>
            ))}
          </ul>
        )}
        {rejected && fresh && !negative && !repeat && (
          <p className="mt-0.5 inline-flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> Not a pick: {rejected}
          </p>
        )}
        {(!fresh || negative || repeat) && (
          <p className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-amber-700 dark:text-amber-300">
            {!fresh && (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="size-3" aria-hidden="true" />{" "}
                {story.date ? "Older than the days you picked: may be outdated" : undatedPost ? "Post date not shown: open it to check it's new" : "Its date couldn't be confirmed"}
              </span>
            )}
            {negative && (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="size-3" aria-hidden="true" /> May not be positive news (“{negative}”)
              </span>
            )}
            {repeat && (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="size-3" aria-hidden="true" /> Looks already posted: “{repeat}”
              </span>
            )}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Button type="button" size="sm" variant={ok ? "default" : "outline"} className="h-7" onClick={onUse} disabled={disabled}>
            Use this news
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={onArticle} disabled={disabled} title="A Facebook headline, a short and a detailed article, the caption, carousel cards and an image prompt">
            <FileText /> Write article
          </Button>
          {onCarousel && (
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={onCarousel} disabled={disabled} title="Start a new carousel from this story">
              <Images /> Carousel
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onSave} aria-pressed={saved} title={saved ? "Remove from the saved stories" : "Keep it in the saved stories"}>
            {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? (inSaved ? "Remove" : "Saved") : "Save"}
          </Button>
          {story.url && (
            <Button asChild type="button" size="sm" variant="ghost" className="h-7 text-muted-foreground">
              <a href={story.url} target="_blank" rel="noreferrer">
                Open source <ExternalLink />
              </a>
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
