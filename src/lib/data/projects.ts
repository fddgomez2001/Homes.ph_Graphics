"use client"

import { invalidate, updateCachedLists } from "@/lib/cache"
import type { SlideDesign } from "@/lib/design/types"
import { SUPABASE_URL } from "@/lib/env"
import { getSupabase } from "@/lib/supabase/client"
import type { ProjectRow, ProjectStatus, SlideRow } from "@/lib/types"
import { DataError, toDataError } from "./errors"

const BASE_COLUMNS = "id,user_id,title,topic,caption,scheduled_at,status,archived_at,thumbnail,slide_count,revision,created_at,updated_at"

export interface ProjectFeatures {
  /** Trash + news articles (the 20261030 migration has been run). */
  trash: boolean
  news: boolean
  /** The posted date and time (the 20261030120000 migration has been run). */
  posted: boolean
  /** Teams, "Made by" and the Facebook pages checklist (the 20261031 migration has been run). */
  posting: boolean
}

const NO_FEATURES: ProjectFeatures = { trash: false, news: false, posted: false, posting: false }

let featuresPromise: Promise<ProjectFeatures> | null = null

/** Which optional columns exist. Without the newer migration the app keeps working (no Trash / News). */
export function projectFeatures(): Promise<ProjectFeatures> {
  if (!featuresPromise) {
    const has = async (cols: string) => {
      const { error } = await getSupabase().from("carousel_projects").select(cols).limit(1)
      if (!error) return true
      if (error.code === "42703" || /does not exist|could not find/i.test(error.message)) return false
      throw toDataError(error)
    }
    featuresPromise = Promise.all([has("deleted_at,kind"), has("posted_at"), has("posted_count")]).then(([trash, posted, posting]) => ({
      trash,
      news: trash,
      posted,
      posting,
    }))
    featuresPromise.catch(() => {
      featuresPromise = null
    })
  }
  return featuresPromise
}

function columnsFor(f: ProjectFeatures) {
  return `${BASE_COLUMNS}${f.trash ? ",deleted_at,kind" : ""}${f.posted ? ",posted_at" : ""}${f.posting ? ",created_by,created_by_name,posted_count,posted_by" : ""}`
}

async function columns() {
  return columnsFor(await projectFeatures().catch(() => NO_FEATURES))
}

export interface ProjectQuery {
  /** Inclusive lower bound on scheduled_at */
  from?: Date | string
  /** Exclusive upper bound on scheduled_at */
  to?: Date | string
  unscheduledOnly?: boolean
  statuses?: ProjectStatus[]
  search?: string
  archived?: "exclude" | "include" | "only"
  orderBy?: "scheduled_at" | "updated_at" | "created_at" | "deleted_at"
  ascending?: boolean
  limit?: number
  /** Default "carousel". */
  kind?: "carousel" | "news" | "all"
  /** Default "exclude": carousels in the Trash are hidden everywhere except the Trash. */
  trash?: "exclude" | "only"
}

/** Characters that would break PostgREST's or=() filter syntax or act as wildcards. */
function cleanSearch(term: string) {
  return term.replace(/[%_*,()"'\\:]/g, " ").replace(/\s+/g, " ").trim()
}

export async function listProjects(q: ProjectQuery = {}): Promise<ProjectRow[]> {
  const features = await projectFeatures().catch(() => NO_FEATURES)
  if (!features.trash && (q.trash === "only" || q.kind === "news")) return []
  let query = getSupabase().from("carousel_projects").select(columnsFor(features))
  if (features.trash) {
    query = q.trash === "only" ? query.not("deleted_at", "is", null) : query.is("deleted_at", null)
    if ((q.kind ?? "carousel") !== "all") query = query.eq("kind", q.kind ?? "carousel")
  }
  if (q.from) query = query.gte("scheduled_at", new Date(q.from).toISOString())
  if (q.to) query = query.lt("scheduled_at", new Date(q.to).toISOString())
  if (q.unscheduledOnly) query = query.is("scheduled_at", null)
  if (q.statuses?.length) query = query.in("status", q.statuses)
  const archived = q.archived ?? "exclude"
  if (archived === "exclude") query = query.is("archived_at", null)
  if (archived === "only") query = query.not("archived_at", "is", null)
  const term = q.search ? cleanSearch(q.search) : ""
  if (term) query = query.or(`title.ilike.*${term}*,caption.ilike.*${term}*,topic.ilike.*${term}*`)
  query = query.order(q.orderBy ?? "updated_at", { ascending: q.ascending ?? false, nullsFirst: false })
  query = query.limit(q.limit ?? 500)
  const { data, error } = await query
  if (error) throw toDataError(error)
  return (data ?? []) as unknown as ProjectRow[]
}

export async function getProject(id: string): Promise<ProjectRow> {
  const { data, error } = await getSupabase().from("carousel_projects").select(await columns()).eq("id", id).maybeSingle()
  if (error) throw toDataError(error)
  if (!data) throw new DataError("This carousel doesn't exist or you don't have access to it.", "not_found", 404)
  return data as unknown as ProjectRow
}

export async function getProjectSlides(projectId: string): Promise<SlideRow[]> {
  const { data, error } = await getSupabase()
    .from("carousel_slides")
    .select("*")
    .eq("project_id", projectId)
    .order("slide_order", { ascending: true })
  if (error) throw toDataError(error)
  return (data ?? []) as SlideRow[]
}

/** Slides of several projects at once (the Day Board), ordered per project. */
export async function listSlidesForProjects(projectIds: string[]): Promise<SlideRow[]> {
  if (!projectIds.length) return []
  const { data, error } = await getSupabase()
    .from("carousel_slides")
    .select("*")
    .in("project_id", projectIds)
    .order("slide_order", { ascending: true })
  if (error) throw toDataError(error)
  return (data ?? []) as SlideRow[]
}

export interface NewProjectInput {
  title: string
  topic?: string | null
  caption?: string
  scheduledAt: string | null
  status: ProjectStatus
}

/** Creates the project and its cover slide atomically. Returns the new project id. */
export async function createProject(input: NewProjectInput, coverDesign: SlideDesign): Promise<string> {
  const { data, error } = await getSupabase().rpc("create_carousel_project", {
    p_title: input.title,
    p_topic: input.topic ?? null,
    p_caption: input.caption ?? "",
    p_scheduled_at: input.scheduledAt,
    p_status: input.status,
    p_cover_design: coverDesign,
  })
  if (error) throw toDataError(error)
  changed()
  return data as string
}

/** Cached project lists refresh after any change. */
function changed() {
  invalidate("projects:")
}

export type ProjectPatch = Partial<Pick<ProjectRow, "title" | "topic" | "caption" | "scheduled_at" | "status" | "archived_at" | "deleted_at" | "kind" | "posted_at">>

export async function updateProject(id: string, patch: ProjectPatch): Promise<ProjectRow> {
  const { data, error } = await getSupabase().from("carousel_projects").update(patch).eq("id", id).select(await columns()).single()
  if (error) throw toDataError(error)
  changed()
  return data as unknown as ProjectRow
}

export async function duplicateProject(id: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("duplicate_carousel_project", { p_project_id: id })
  if (error) throw toDataError(error)
  changed()
  return data as string
}

/**
 * Marks a carousel as posted at the given time (Published). Without the posted_at
 * migration only the status changes.
 */
export async function markPosted(id: string, at: Date): Promise<ProjectRow> {
  const features = await projectFeatures().catch(() => NO_FEATURES)
  return updateProject(id, { status: "published", ...(features.posted ? { posted_at: at.toISOString() } : {}) })
}

/** Back to "not posted yet": Scheduled when it has a date, otherwise Draft (the posted time is cleared). */
export async function markNotPosted(project: Pick<ProjectRow, "id" | "scheduled_at">): Promise<ProjectRow> {
  return updateProject(project.id, { status: project.scheduled_at ? "scheduled" : "draft" })
}

/** Deletes a carousel and its slides for good. */
export async function deleteProject(id: string): Promise<void> {
  const { error } = await getSupabase().from("carousel_projects").delete().eq("id", id)
  if (error) throw toDataError(error)
  removeFromLists(id)
  changed()
}

/** Every cached list drops the carousel at once (calendar, unscheduled, home, Day Board…). */
function removeFromLists(id: string) {
  updateCachedLists<ProjectRow>("projects:", (rows) => rows.filter((p) => p.id !== id))
}

/**
 * Moves a carousel to the Trash (restorable). Without the Trash migration it is
 * deleted for good. Returns true when it went to the Trash.
 */
export async function trashProject(id: string): Promise<boolean> {
  const features = await projectFeatures().catch(() => NO_FEATURES)
  if (!features.trash) {
    await deleteProject(id)
    return false
  }
  const { error } = await getSupabase().from("carousel_projects").update({ deleted_at: new Date().toISOString() }).eq("id", id)
  if (error) throw toDataError(error)
  removeFromLists(id)
  changed()
  return true
}

export async function restoreProject(id: string): Promise<void> {
  const { error } = await getSupabase().from("carousel_projects").update({ deleted_at: null }).eq("id", id)
  if (error) throw toDataError(error)
  removeFromLists(id)
  changed()
}

/** Items stay in the Trash for this many days, then they're deleted for good. */
export const TRASH_DAYS = 30

export async function purgeOldTrash(): Promise<number> {
  const features = await projectFeatures().catch(() => NO_FEATURES)
  if (!features.trash) return 0
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString()
  const { data, error } = await getSupabase().from("carousel_projects").delete().lt("deleted_at", cutoff).select("id")
  if (error) throw toDataError(error)
  if (data?.length) changed()
  return data?.length ?? 0
}

export interface SaveSlidePayload {
  id: string
  slide_type: "cover" | "card"
  title: string | null
  subtitle: string | null
  description: string | null
  background_image_url: string | null
  background_public_id: string | null
  canvas_width: number
  canvas_height: number
  design_json: SlideDesign
}

/**
 * Atomic save of metadata + ordered slides. Throws ConflictError when another
 * save happened in between (the expected revision is stale).
 */
export async function saveProject(args: {
  projectId: string
  expectedRevision: number
  project: Record<string, unknown>
  slides: SaveSlidePayload[]
}): Promise<{ revision: number; updated_at: string }> {
  const { data, error } = await getSupabase().rpc("save_carousel_project", {
    p_project_id: args.projectId,
    p_expected_revision: args.expectedRevision,
    p_project: args.project,
    p_slides: args.slides,
  })
  if (error) throw toDataError(error)
  const row = (Array.isArray(data) ? data[0] : data) as { revision: number; updated_at: string } | undefined
  if (!row) throw new DataError("The save did not return a revision.")
  changed()
  return row
}

const SCHEMA_OK_KEY = "dcm-schema-ok"

/** "ok" when the tables exist, "missing" when the migration hasn't been run. Remembered once confirmed. */
export async function checkSchema(force = false): Promise<"ok" | "missing"> {
  try {
    if (!force && localStorage.getItem(SCHEMA_OK_KEY) === SUPABASE_URL) return "ok"
  } catch {
    // storage unavailable: check below
  }
  const { error } = await getSupabase().from("carousel_projects").select("id").limit(1)
  if (!error) {
    try {
      localStorage.setItem(SCHEMA_OK_KEY, SUPABASE_URL)
    } catch {
      // not remembered — checked again next time
    }
    return "ok"
  }
  const e = toDataError(error)
  if (e.code === "schema_missing") return "missing"
  throw e
}
