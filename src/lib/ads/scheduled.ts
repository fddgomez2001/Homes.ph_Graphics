"use client"

import type { LogoAdjust } from "./poster"
import type { AdContent, AdKind, AdTemplateId } from "./render"
import { adKindLabel, adTitle, type AdBrand } from "./schedule-time"

/**
 * Scheduled advertisements, saved on this computer (IndexedDB: photos and logos are too big for
 * localStorage). Each ad keeps what's needed to draw it again exactly (template, words, photo, court
 * logo and its size/offset), its Facebook caption, its day and time, and a small picture for lists.
 * Every change to the design, caption or time gives it a new revision; the Chrome extension reads
 * the latest version and says when it was scheduled or posted on Facebook.
 *
 * Two stores: "ads" (light: the lists and the calendar read only these) and "media" (the photo and
 * the logo, read only to draw or edit one ad).
 */

export interface ScheduledAdLogo {
  original: string
  shown: string
  clearBackground: boolean
}

export type AdFacebook = "scheduled" | "posted"

/** A scheduled ad without its photo and logo (lists, the calendar, the extension's day list). */
export interface ScheduledAdSummary {
  id: string
  brand: AdBrand
  kind: AdKind
  /** "History", "Trivia", "Fun Facts", "Court Owners", "Coming Soon", "Now Open" */
  kindLabel: string
  template: AdTemplateId
  content: AdContent
  /** The Facebook caption. */
  caption: string
  /** The court logo's size and offset per template (Coming Soon / Now Open). */
  logoAdjust: Partial<Record<AdTemplateId, LogoAdjust>> | null
  /** "2026-11-12" */
  day: string
  /** "13:00" */
  time: string
  /** The ad's main words, one line. */
  title: string
  /** A 240 px JPEG data URL of the ad. */
  thumb: string
  /** +1 on every change to the design, caption or time. */
  revision: number
  createdAt: number
  updatedAt: number
  /** When the extension said it was scheduled or posted on Facebook. */
  postedAt: number | null
  facebook: AdFacebook | null
  /** The revision that went to Facebook. */
  postedRevision: number | null
  /** The revision last saved in the download folder for the extension (once per revision). */
  savedRevision: number | null
  hasPhoto: boolean
  hasLogo: boolean
}

/** A scheduled ad with its photo and court logo. */
export interface ScheduledAd extends ScheduledAdSummary {
  /** The background photo (JPEG data URL), null = the template's. */
  photo: string | null
  /** The court logo, null = the template's sample. */
  logo: ScheduledAdLogo | null
}

/** What the editor sends to schedule (or save) an ad. */
export interface AdDraft {
  brand: AdBrand
  kind: AdKind
  template: AdTemplateId
  content: AdContent
  caption: string
  photo: string | null
  logo: ScheduledAdLogo | null
  logoAdjust: Partial<Record<AdTemplateId, LogoAdjust>> | null
  day: string
  time: string
}

interface MediaRow {
  id: string
  photo: string | null
  logo: ScheduledAdLogo | null
}

const DB_NAME = "dcm-ads"
const ADS = "ads"
const MEDIA = "media"
const DAY_INDEX = "day"

let dbPromise: Promise<IDBDatabase | null> | null = null

function db(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
          const d = req.result
          if (!d.objectStoreNames.contains(ADS)) d.createObjectStore(ADS, { keyPath: "id" }).createIndex(DAY_INDEX, "day")
          if (!d.objectStoreNames.contains(MEDIA)) d.createObjectStore(MEDIA, { keyPath: "id" })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    // Ask the browser not to clear them when disk space runs low.
    void navigator.storage?.persist?.().catch(() => false)
  }
  return dbPromise
}

const NO_STORAGE = "This computer's storage for advertisements isn't available. Restart the app and try again."

/** Runs `work` in one transaction and resolves when it's written. */
async function transact<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  const d = await db()
  if (!d) throw new Error(NO_STORAGE)
  const tx = d.transaction(stores, mode)
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Couldn't save the advertisement."))
    tx.onabort = () => reject(tx.error ?? new Error("Couldn't save the advertisement (storage full?)."))
  })
  let result: T
  try {
    result = await work(tx)
  } catch (e) {
    done.catch(() => {})
    try {
      tx.abort()
    } catch {
      // already finished
    }
    throw e
  }
  await done
  return result
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Advertisement storage error"))
  })
}

// ---------- changes: the calendar, the editor and other windows hear about them ----------

const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null

function channelOf(): BroadcastChannel | null {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("dcm-ads")
    channel.onmessage = () => listeners.forEach((l) => l())
  }
  return channel
}

function changed() {
  listeners.forEach((l) => l())
  try {
    channelOf()?.postMessage("changed")
  } catch {
    // only this window
  }
}

/** Calls `listener` after any scheduled ad is added, changed or deleted (here or in another window). */
export function subscribeAds(listener: () => void): () => void {
  channelOf()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ---------- reading ----------

const byTime = (a: ScheduledAdSummary, b: ScheduledAdSummary) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt

/** The ads from `fromDay` to `toDay` ("yyyy-MM-dd", both included), by day and time. */
export async function listAds(fromDay: string, toDay: string): Promise<ScheduledAdSummary[]> {
  const rows = await transact([ADS], "readonly", (tx) => request(tx.objectStore(ADS).index(DAY_INDEX).getAll(IDBKeyRange.bound(fromDay, toDay))) as Promise<ScheduledAdSummary[]>)
  return rows.sort((a, b) => a.day.localeCompare(b.day) || byTime(a, b))
}

/** The ads of a day, by time. */
export function listAdsOfDay(day: string): Promise<ScheduledAdSummary[]> {
  return listAds(day, day)
}

/** One ad with its photo and logo (null when it was deleted). */
export async function getAd(id: string): Promise<ScheduledAd | null> {
  return transact([ADS, MEDIA], "readonly", async (tx) => {
    const [row, media] = await Promise.all([
      request(tx.objectStore(ADS).get(id)) as Promise<ScheduledAdSummary | undefined>,
      request(tx.objectStore(MEDIA).get(id)) as Promise<MediaRow | undefined>,
    ])
    return row ? { ...row, photo: media?.photo ?? null, logo: media?.logo ?? null } : null
  })
}

// ---------- writing ----------

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** A small picture of the draft (drawn now). */
async function thumbOf(draft: AdDraft): Promise<string> {
  const { adLookThumb } = await import("./poster")
  return adLookThumb({ template: draft.template, content: draft.content, photo: draft.photo, logo: draft.logo?.shown ?? null, logoAdjust: draft.logoAdjust })
}

function summaryOf(draft: AdDraft, base: Pick<ScheduledAdSummary, "id" | "revision" | "createdAt" | "postedAt" | "facebook" | "postedRevision" | "savedRevision">, thumb: string): ScheduledAdSummary {
  return {
    ...base,
    brand: draft.brand,
    kind: draft.kind,
    kindLabel: adKindLabel(draft.kind),
    template: draft.template,
    content: draft.content,
    caption: draft.caption,
    logoAdjust: draft.logoAdjust,
    day: draft.day,
    time: draft.time,
    title: adTitle(draft.content),
    thumb,
    updatedAt: Date.now(),
    hasPhoto: !!draft.photo,
    hasLogo: !!draft.logo,
  }
}

async function write(summary: ScheduledAdSummary, media: MediaRow | null) {
  await transact([ADS, MEDIA], "readwrite", (tx) => {
    tx.objectStore(ADS).put(summary)
    if (media) tx.objectStore(MEDIA).put(media)
  })
}

/** Schedules a new ad. */
export async function createAd(draft: AdDraft): Promise<ScheduledAd> {
  const thumb = await thumbOf(draft)
  const now = Date.now()
  const summary = summaryOf(draft, { id: newId(), revision: 1, createdAt: now, postedAt: null, facebook: null, postedRevision: null, savedRevision: null }, thumb)
  await write(summary, { id: summary.id, photo: draft.photo, logo: draft.logo })
  changed()
  return { ...summary, photo: draft.photo, logo: draft.logo }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Whether the draft changes the ad's design, caption, day or time. */
export function draftChanges(ad: ScheduledAd, draft: AdDraft): boolean {
  return (
    ad.brand !== draft.brand ||
    ad.kind !== draft.kind ||
    ad.template !== draft.template ||
    ad.caption !== draft.caption ||
    ad.day !== draft.day ||
    ad.time !== draft.time ||
    ad.photo !== draft.photo ||
    (ad.logo?.shown ?? null) !== (draft.logo?.shown ?? null) ||
    !same(ad.content, draft.content) ||
    !same(ad.logoAdjust?.[draft.template], draft.logoAdjust?.[draft.template])
  )
}

/** Saves an edited ad: a new revision and a new picture when anything changed. */
export async function updateAd(id: string, draft: AdDraft): Promise<{ ad: ScheduledAd; changed: boolean }> {
  const ad = await getAd(id)
  if (!ad) throw new Error("This advertisement was deleted.")
  if (!draftChanges(ad, draft)) return { ad, changed: false }
  const thumb = await thumbOf(draft)
  const summary = summaryOf(draft, { id, revision: ad.revision + 1, createdAt: ad.createdAt, postedAt: ad.postedAt, facebook: ad.facebook, postedRevision: ad.postedRevision, savedRevision: ad.savedRevision }, thumb)
  await write(summary, { id, photo: draft.photo, logo: draft.logo })
  changed()
  return { ad: { ...summary, photo: draft.photo, logo: draft.logo }, changed: true }
}

export async function deleteAd(id: string): Promise<void> {
  await transact([ADS, MEDIA], "readwrite", (tx) => {
    tx.objectStore(ADS).delete(id)
    tx.objectStore(MEDIA).delete(id)
  })
  changed()
}

/** Changes a few fields of an ad without a new revision (its Facebook state, the saved revision). */
async function patchAd(id: string, patch: (ad: ScheduledAdSummary) => Partial<ScheduledAdSummary>): Promise<ScheduledAdSummary> {
  const next = await transact([ADS], "readwrite", async (tx) => {
    const store = tx.objectStore(ADS)
    const ad = (await request(store.get(id))) as ScheduledAdSummary | undefined
    if (!ad) return null
    const row = { ...ad, ...patch(ad) }
    store.put(row)
    return row
  })
  if (!next) throw new Error("This advertisement isn't in Homes.ph SocMedSystem anymore (it was deleted).")
  changed()
  return next
}

/** The extension scheduled (or posted) the ad on Facebook: this revision is on Facebook now. */
export function markAdPosted(id: string, facebook: AdFacebook): Promise<ScheduledAdSummary> {
  return patchAd(id, (ad) => ({ facebook, postedAt: Date.now(), postedRevision: ad.revision }))
}

/** Back to "To post" (undo a posted mark). */
export function markAdNotPosted(id: string): Promise<ScheduledAdSummary> {
  return patchAd(id, () => ({ facebook: null, postedAt: null, postedRevision: null }))
}

/** This revision's PNG was saved in the download folder. */
export function markAdSaved(id: string, revision: number): Promise<ScheduledAdSummary> {
  return patchAd(id, () => ({ savedRevision: revision }))
}

/** "Posted", "Scheduled on Facebook", "To post", and whether it changed after it went to Facebook. */
export function adStatus(ad: Pick<ScheduledAdSummary, "facebook" | "revision" | "postedRevision">): { done: boolean; label: string; changedSince: boolean } {
  const changedSince = !!ad.facebook && ad.postedRevision != null && ad.revision > ad.postedRevision
  if (ad.facebook === "posted") return { done: true, label: "Posted", changedSince }
  if (ad.facebook === "scheduled") return { done: true, label: "Scheduled on Facebook", changedSince }
  return { done: false, label: "To post", changedSince: false }
}
