"use client"

import { parse, startOfDay } from "date-fns"
import { getProject } from "@/lib/data/projects"
import { loadPosterMakerPosts, loadTrendPosters } from "@/lib/data/report"
import { getDesktop } from "@/lib/desktop"
import { adLookBlob } from "@/lib/ads/poster"
import { adImageName, adTimeLabel } from "@/lib/ads/schedule-time"
import { getAd, listAdsOfDay, markAdPosted, markAdSaved, type AdFacebook } from "@/lib/ads/scheduled"
import { postEntries, saveTrendDetails, trendEntries, trendEntryText, trendFileBase, writeTrendDetails, type PostEntry, type TrendEntry } from "@/lib/report/trend-news"
import { getProjectSlides } from "@/lib/data/projects"
import { normalizeDesign } from "@/lib/design/normalize"
import { isNewsPosterTemplate, isPosterTemplate, newsTimeLabel } from "@/lib/design/news-templates"
import { format } from "date-fns"
import { errorMessage } from "@/lib/utils"

/**
 * What the Homes.ph Publisher Chrome extension asks the app about advertisements (scheduled on the
 * Advertisement page) and Daily Trend News (the Poster Maker's posters), through the desktop bridge:
 * a day's list, a full-size PNG (the latest version, saved once per version in the download folder),
 * the ad's Facebook post marked, and the floating report's Daily Trend News texts.
 */

async function base64Of(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ""
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Saves a PNG like the download buttons (the desktop app puts it in the download folder); where it went. */
async function saveDownload(blob: Blob, name: string): Promise<string> {
  const { downloadBlob } = await import("@/lib/export")
  downloadBlob(blob, name)
  const folders = await getDesktop()?.folders?.get().catch(() => null)
  return folders?.downloads || "Downloads"
}

const dayDate = (day: string) => startOfDay(parse(day, "yyyy-MM-dd", new Date()))

// ---------- advertisements ----------

/** The ads scheduled on `day` ("2026-11-12"), by time. */
export async function extensionAdsDay({ day }: { day: string }) {
  const ads = await listAdsOfDay(day)
  return {
    day,
    ads: ads.map((a) => ({
      id: a.id,
      brand: a.brand,
      kind: a.kind,
      kindLabel: a.kindLabel,
      title: a.title,
      caption: a.caption,
      time: a.time,
      revision: a.revision,
      postedAt: a.postedAt,
      facebook: a.facebook,
      postedRevision: a.postedRevision,
    })),
  }
}

const GONE = "This advertisement isn't in Homes.ph SocMedSystem anymore (it was deleted)."

/** "1:00 PM History" */
export const adLabel = (ad: { time: string; kindLabel: string }) => `${adTimeLabel(ad.time)} ${ad.kindLabel}`

/** The ad at full size (its latest version); saved in the download folder once per version when `save`. */
export async function extensionAdImage({ id, save }: { id: string; save: boolean }) {
  const ad = await getAd(id)
  if (!ad) throw new Error(GONE)
  const blob = await adLookBlob({ template: ad.template, content: ad.content, photo: ad.photo, logo: ad.logo?.shown ?? null, logoAdjust: ad.logoAdjust })
  const name = adImageName(ad)
  let savedTo: string | null = null
  if (save && ad.savedRevision !== ad.revision) {
    savedTo = await saveDownload(blob, name)
    await markAdSaved(id, ad.revision).catch(() => {})
  }
  return { id, revision: ad.revision, name, type: "image/png" as const, base64: await base64Of(blob), savedTo, label: adLabel(ad) }
}

/** The ad's Facebook post was scheduled (or posted): its calendar shows it, for this version. */
export async function extensionAdPosted({ id, facebook }: { id: string; facebook: AdFacebook }) {
  const ad = await markAdPosted(id, facebook)
  return { ok: true as const, postedAt: ad.postedAt, label: adLabel(ad) }
}

// ---------- Daily Trend News ----------

function trendInfo(e: TrendEntry) {
  const p = e.poster
  return {
    id: p.project.id,
    group: e.group,
    groupName: e.groupName,
    page: e.page,
    n: e.n,
    time: p.time,
    headline: e.headline,
    subtext: e.subtext,
    caption: p.project.caption ?? "",
    details: p.project.topic ?? "",
    revision: p.project.revision,
  }
}

/** The day's Poster Maker posters, as the floating report's Daily Trend News lists them (without a headline: left out). */
export async function extensionTrendsDay({ day }: { day: string }) {
  const [posters, posts] = await Promise.all([loadTrendPosters(dayDate(day)), loadPosterMakerPosts(dayDate(day))])
  // The Poster Maker's three navigations: posters (Daily Trend News), Did You Know and engagement posts (1.53).
  return { day, posters: trendEntries(posters).map(trendInfo), posts: postEntries(posts).map(postInfo) }
}

function postInfo(e: PostEntry) {
  const p = e.poster
  return {
    id: p.project.id,
    kind: e.kind,
    group: e.group,
    groupName: e.groupName,
    page: e.page,
    n: e.n,
    time: p.time,
    headline: e.title,
    caption: p.project.caption ?? "",
    revision: p.project.revision,
  }
}

/** A Did You Know or engagement post at full size (1.53): "2026-11-18 4PM Homes.ph Cebu Did You Know.png". */
async function postImage(id: string, save: boolean) {
  const project = await getProject(id)
  const rows = await getProjectSlides(id)
  const design = rows[0] ? normalizeDesign(rows[0].design_json) : null
  if (!design || !isPosterTemplate(design.templateId) || isNewsPosterTemplate(design.templateId) || !project.scheduled_at) throw new Error("This post isn't in the Poster Maker anymore (it was deleted or moved).")
  const at = new Date(project.scheduled_at)
  const entry = postEntries(await loadPosterMakerPosts(startOfDay(at))).find((e) => e.poster.project.id === id)
  const { renderFullSize } = await import("@/lib/report/report-files")
  const canvas = await renderFullSize(design)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The post couldn't be drawn."))), "image/png"))
  const kind = entry?.kind === "dyk" ? "Did You Know" : "Engagement"
  const label = `${entry?.groupName ?? "Post"} ${kind}${entry ? ` ${entry.n}` : ""}`
  const name = `${format(at, "yyyy-MM-dd")} ${newsTimeLabel(format(at, "HH:mm")).replace(/\s+/g, "").replace(":", ".")} ${label}.png`.replace(/[\\/:*?"<>|]/g, "")
  let savedTo: string | null = null
  if (save && savedTrendRevision.get(id) !== project.revision) {
    savedTo = await saveDownload(blob, name)
    savedTrendRevision.set(id, project.revision)
  }
  return { id, revision: project.revision, name, type: "image/png" as const, base64: await base64Of(blob), savedTo, label }
}

/** A poster in its day's Daily Trend News (its number there), freshly read. */
async function trendEntryOf(id: string, days?: Map<string, Promise<TrendEntry[]>>): Promise<{ entry: TrendEntry; day: Date }> {
  const project = await getProject(id)
  if (!project.scheduled_at) throw new Error("This poster has no posting day.")
  const day = startOfDay(new Date(project.scheduled_at))
  const key = day.toISOString()
  let list = days?.get(key)
  if (!list) {
    list = loadTrendPosters(day).then(trendEntries)
    days?.set(key, list)
  }
  const entry = (await list).find((e) => e.poster.project.id === id)
  if (!entry) throw new Error("This poster isn't in the Daily Trend News (it has no headline yet, or it was deleted).")
  return { entry, day }
}

/** Posters whose PNG was saved in the download folder this session (id → revision): once per version. */
const savedTrendRevision = new Map<string, number>()

/** The poster at full size (as the floating report and the Poster Maker's Save PNG draw it). */
export async function extensionTrendImage({ id, save }: { id: string; save: boolean }) {
  let found: { entry: TrendEntry; day: Date }
  try {
    found = await trendEntryOf(id)
  } catch (e) {
    // A Did You Know or engagement post (1.53).
    return postImage(id, save).catch(() => {
      throw e
    })
  }
  const { entry, day } = found
  const { renderFullSize } = await import("@/lib/report/report-files")
  const canvas = await renderFullSize(entry.poster.design)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The poster couldn't be drawn."))), "image/png"))
  const revision = entry.poster.project.revision
  const name = `${trendFileBase(entry, day)}.png`.replace(/[\\/:*?"<>|]/g, "")
  let savedTo: string | null = null
  if (save && savedTrendRevision.get(id) !== revision) {
    savedTo = await saveDownload(blob, name)
    savedTrendRevision.set(id, revision)
  }
  return { id, revision, name, type: "image/png" as const, base64: await base64Of(blob), savedTo, label: entry.label }
}

/** The AI calls stop starting after this long (the bridge waits 110 s for an answer). */
const AI_BUDGET_MS = 60_000

/**
 * The floating report's Daily Trend News text of each poster (what its copy button copies). Without
 * details, the AI writes them first and they're saved to the poster (like the floating report).
 */
export async function extensionTrendTexts({ ids }: { ids: string[] }) {
  const started = Date.now()
  const days = new Map<string, Promise<TrendEntry[]>>()
  let written = 0
  const texts: { id: string; text: string; details: string; aiError?: string; error?: string }[] = []
  for (const id of ids) {
    let found: { entry: TrendEntry; day: Date }
    try {
      found = await trendEntryOf(id, days)
    } catch (e) {
      texts.push({ id, text: "", details: "", error: errorMessage(e) })
      continue
    }
    const { entry, day } = found
    let details = (entry.poster.project.topic ?? "").replace(/\s+/g, " ").trim()
    let aiError: string | undefined
    if (!details) {
      if (Date.now() - started > AI_BUDGET_MS) aiError = "Not written yet (out of time): ask again."
      else {
        try {
          const result = await writeTrendDetails({ name: entry.groupName, headline: entry.headline, subtext: entry.subtext, caption: entry.poster.project.caption ?? "" })
          details = result.details
          await saveTrendDetails(entry.poster, details)
          written++
        } catch (e) {
          aiError = errorMessage(e)
        }
      }
    }
    texts.push({ id, text: trendEntryText(entry, day, details), details, ...(aiError ? { aiError } : {}) })
  }
  return { texts, written }
}
