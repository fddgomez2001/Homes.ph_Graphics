import "server-only"

import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { PostCheck } from "@/lib/data/posting"
import type { AssetRow, ProjectRow, SlideRow, TemplateRow, UserSettings } from "@/lib/types"
import { DEFAULT_POST_PAGES, type LocalProjectQuery, type LocalSaveArgs, LOCAL_USER_ID } from "./shared"
import { localFolder } from "./setup"

/**
 * The work saved on this computer (desktop app without an account): one JSON file per
 * carousel or news post (with its slides), the photo library, custom templates, settings, the
 * posting checklist and the person's name, in the folder chosen in the welcome setup. Photos are
 * files in images\. The same rules as the cloud database (revisions, Trash, posted time).
 */

export class LocalError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message)
  }
}

const now = () => new Date().toISOString()

// ---------- files ----------

function dir(...parts: string[]) {
  const d = path.join(/*turbopackIgnore: true*/ localFolder(), ...parts)
  fs.mkdirSync(d, { recursive: true })
  return d
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T
  } catch {
    return fallback
  }
}

/** Written to a temporary file first, so a crash never leaves half a file. */
function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value))
  fs.renameSync(tmp, file)
  ensureReadme()
}

let readmeFor = ""
function ensureReadme() {
  const root = localFolder()
  if (readmeFor === root) return
  readmeFor = root
  const file = path.join(/*turbopackIgnore: true*/ root, "README.txt")
  if (fs.existsSync(file)) return
  fs.writeFileSync(
    file,
    [
      "Daily Carousel Maker — your saved work",
      "",
      "This folder holds everything you make in the app on this computer:",
      "  projects\\   your carousels and news posts (one file each, with their slides)",
      "  images\\     the photos you added (when photos are saved on this computer)",
      "  library.json, templates.json, settings.json, posting.json, profile.json",
      "",
      "To back up your work, copy this whole folder. To move it, choose a new folder in",
      "Settings → Where your work is saved (the app moves it for you).",
      "Downloads and posters you export go to your Downloads folder (Settings → Downloads).",
      "",
    ].join("\r\n"),
  )
}

// ---------- projects (in memory, written through to disk) ----------

interface StoredProject {
  project: ProjectRow
  slides: SlideRow[]
}

let projects: Map<string, StoredProject> | null = null
let projectsRoot = ""

function all(): Map<string, StoredProject> {
  const root = localFolder()
  if (projects && projectsRoot === root) return projects
  const map = new Map<string, StoredProject>()
  const d = dir("projects")
  for (const name of fs.readdirSync(d)) {
    if (!name.endsWith(".json")) continue
    const stored = readJson<StoredProject | null>(path.join(/*turbopackIgnore: true*/ d, name), null)
    if (stored?.project?.id) map.set(stored.project.id, stored)
  }
  projects = map
  projectsRoot = root
  return map
}

function persist(stored: StoredProject) {
  all().set(stored.project.id, stored)
  writeJson(path.join(/*turbopackIgnore: true*/ dir("projects"), `${stored.project.id}.json`), stored)
}

function find(id: string): StoredProject {
  const stored = all().get(id)
  if (!stored) throw new LocalError("This carousel doesn't exist anymore.", 404, "not_found")
  return stored
}

/** The trigger rule: Published keeps (or gets) its posted time; any other status clears it. */
function withPostedAt(p: ProjectRow): ProjectRow {
  return { ...p, posted_at: p.status === "published" ? (p.posted_at ?? now()) : null }
}

const time = (v: string | null | undefined) => (v ? new Date(v).getTime() : NaN)

export function listProjects(q: LocalProjectQuery): ProjectRow[] {
  const term = (q.search ?? "").trim().toLowerCase()
  const from = q.from ? time(q.from) : NaN
  const to = q.to ? time(q.to) : NaN
  const archived = q.archived ?? "exclude"
  const rows = [...all().values()]
    .map((s) => s.project)
    .filter((p) => (q.trash === "only" ? !!p.deleted_at : !p.deleted_at))
    .filter((p) => (q.kind ?? "carousel") === "all" || (p.kind ?? "carousel") === (q.kind ?? "carousel"))
    .filter((p) => (Number.isNaN(from) ? true : time(p.scheduled_at) >= from))
    .filter((p) => (Number.isNaN(to) ? true : time(p.scheduled_at) < to))
    .filter((p) => (q.unscheduledOnly ? !p.scheduled_at : true))
    .filter((p) => (q.statuses?.length ? q.statuses.includes(p.status) : true))
    .filter((p) => (archived === "exclude" ? !p.archived_at : archived === "only" ? !!p.archived_at : true))
    .filter((p) => !term || [p.title, p.caption, p.topic].some((v) => (v ?? "").toLowerCase().includes(term)))
  const key = q.orderBy ?? "updated_at"
  const dirn = q.ascending ? 1 : -1
  rows.sort((a, b) => {
    const x = time(a[key])
    const y = time(b[key])
    // Nulls last, whichever the order.
    if (Number.isNaN(x) && Number.isNaN(y)) return 0
    if (Number.isNaN(x)) return 1
    if (Number.isNaN(y)) return -1
    return (x - y) * dirn
  })
  return rows.slice(0, q.limit ?? 500)
}

export const getProject = (id: string): ProjectRow => find(id).project

export function getSlides(projectIds: string[]): SlideRow[] {
  return projectIds.flatMap((id) => all().get(id)?.slides ?? []).sort((a, b) => a.slide_order - b.slide_order)
}

export function coverTemplates(projectIds: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of projectIds) {
    const cover = all().get(id)?.slides.find((s) => s.slide_order === 0)
    if (cover) out[id] = cover.design_json?.templateId ?? ""
  }
  return out
}

function newSlide(projectId: string, order: number, s: Partial<SlideRow>): SlideRow {
  const at = now()
  return {
    id: s.id ?? randomUUID(),
    project_id: projectId,
    slide_order: order,
    slide_type: order === 0 ? "cover" : "card",
    title: s.title ?? null,
    subtitle: s.subtitle ?? null,
    description: s.description ?? null,
    background_image_url: s.background_image_url ?? null,
    background_public_id: s.background_public_id ?? null,
    canvas_width: s.canvas_width ?? 1254,
    canvas_height: s.canvas_height ?? 1254,
    design_json: s.design_json ?? ({} as SlideRow["design_json"]),
    created_at: s.created_at ?? at,
    updated_at: at,
  }
}

const cleanTitle = (t: unknown) => (typeof t === "string" && t.trim() ? t.trim().slice(0, 300) : "Untitled carousel")
const cleanTopic = (t: unknown) => (typeof t === "string" && t.trim() ? t.trim().slice(0, 500) : null)

export function createProject(input: { title: string; topic?: string | null; caption?: string; scheduledAt: string | null; status: ProjectRow["status"] }, cover: SlideRow["design_json"]): string {
  const id = randomUUID()
  const at = now()
  const project = withPostedAt({
    id,
    user_id: LOCAL_USER_ID,
    title: cleanTitle(input.title),
    topic: cleanTopic(input.topic),
    caption: input.caption ?? "",
    scheduled_at: input.scheduledAt,
    status: input.status ?? "draft",
    archived_at: null,
    thumbnail: null,
    slide_count: 1,
    revision: 0,
    created_at: at,
    updated_at: at,
    deleted_at: null,
    kind: "carousel",
    posted_at: null,
    created_by: LOCAL_USER_ID,
    created_by_name: getProfile().name,
    posted_count: 0,
    posted_by: [],
  })
  persist({ project, slides: [newSlide(id, 0, { design_json: cover })] })
  return id
}

const PATCHABLE = ["title", "topic", "caption", "scheduled_at", "status", "archived_at", "deleted_at", "kind", "posted_at"] as const

export function updateProject(id: string, patch: Record<string, unknown>): ProjectRow {
  const stored = find(id)
  const next: ProjectRow = { ...stored.project }
  for (const key of PATCHABLE) if (key in patch) (next as unknown as Record<string, unknown>)[key] = patch[key]
  if ("title" in patch) next.title = cleanTitle(patch.title)
  if ("topic" in patch) next.topic = cleanTopic(patch.topic)
  next.updated_at = now()
  const project = withPostedAt(next)
  persist({ ...stored, project })
  return project
}

export function duplicateProject(id: string): string {
  const source = find(id)
  const copy = randomUUID()
  const at = now()
  const project: ProjectRow = {
    ...source.project,
    id: copy,
    title: `${source.project.title} (copy)`.slice(0, 300),
    status: "draft",
    posted_at: null,
    archived_at: null,
    deleted_at: null,
    revision: 0,
    created_at: at,
    updated_at: at,
    created_by_name: getProfile().name,
    posted_count: 0,
    posted_by: [],
  }
  persist({ project, slides: source.slides.map((s) => newSlide(copy, s.slide_order, { ...s, id: undefined, created_at: undefined })) })
  return copy
}

export function deleteProject(id: string) {
  all().delete(id)
  fs.rmSync(path.join(/*turbopackIgnore: true*/ dir("projects"), `${id}.json`), { force: true })
  writePosting(readPosting().filter((c) => c.project_id !== id))
}

export function purgeTrash(cutoff: string): number {
  const old = [...all().values()].filter((s) => s.project.deleted_at && s.project.deleted_at < cutoff)
  for (const s of old) deleteProject(s.project.id)
  return old.length
}

export function saveProject(args: LocalSaveArgs): { revision: number; updated_at: string } {
  const stored = all().get(args.projectId)
  if (!stored) throw new LocalError("Carousel not found", 404, "not_found")
  if (stored.project.revision !== args.expectedRevision) throw new LocalError("This carousel was changed somewhere else. Reload to get the latest version.", 409, "conflict")
  const slides = args.slides
  if (!Array.isArray(slides) || slides.length < 1 || slides.length > 100) throw new LocalError("A carousel needs between 1 and 100 slides.")
  if (slides.some((s, i) => s.slide_type !== (i === 0 ? "cover" : "card"))) throw new LocalError("The first slide must be the cover and all others must be cards.")
  const p = args.project
  const next: ProjectRow = { ...stored.project }
  if ("title" in p) next.title = cleanTitle(p.title)
  if ("topic" in p) next.topic = cleanTopic(p.topic)
  if ("caption" in p) next.caption = typeof p.caption === "string" ? p.caption : ""
  if ("scheduled_at" in p) next.scheduled_at = (p.scheduled_at as string | null) ?? null
  if ("status" in p) next.status = p.status as ProjectRow["status"]
  if ("thumbnail" in p) next.thumbnail = (p.thumbnail as string | null) ?? null
  next.revision += 1
  next.updated_at = now()
  next.slide_count = slides.length
  const before = new Map(stored.slides.map((s) => [s.id, s]))
  const saved = slides.map((s, i) => newSlide(args.projectId, i, { ...s, created_at: before.get(s.id)?.created_at }))
  const project = withPostedAt(next)
  persist({ project, slides: saved })
  return { revision: project.revision, updated_at: project.updated_at }
}

/** How many slides use each photo (by its id in the design or as the background). */
export function assetUsage(publicIds: string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(publicIds.map((id) => [id, 0]))
  for (const { slides } of all().values()) {
    for (const s of slides) {
      const json = JSON.stringify(s.design_json)
      for (const id of publicIds) if (s.background_public_id === id || json.includes(`"${id}"`)) out[id]++
    }
  }
  return out
}

// ---------- photo library ----------

const libraryFile = () => path.join(/*turbopackIgnore: true*/ localFolder(), "library.json")

export function listAssets(search?: string): AssetRow[] {
  const term = (search ?? "").trim().toLowerCase()
  return readJson<AssetRow[]>(libraryFile(), [])
    .filter((a) => !term || (a.original_filename ?? "").toLowerCase().includes(term))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 500)
}

export const findAssetBySha = (sha256: string) => readJson<AssetRow[]>(libraryFile(), []).find((a) => a.sha256 === sha256) ?? null

export function addAsset(asset: Omit<AssetRow, "id" | "user_id" | "created_at">): AssetRow {
  const row: AssetRow = { ...asset, id: randomUUID(), user_id: LOCAL_USER_ID, created_at: now() }
  writeJson(libraryFile(), [row, ...readJson<AssetRow[]>(libraryFile(), [])])
  return row
}

export function removeAsset(id: string): AssetRow | null {
  const rows = readJson<AssetRow[]>(libraryFile(), [])
  const row = rows.find((a) => a.id === id) ?? null
  if (row) writeJson(libraryFile(), rows.filter((a) => a.id !== id))
  return row
}

/** Photo files kept on this computer: images\<name>, served at /api/local/files/<name>. */
export const imagesDir = () => dir("images")
export const LOCAL_FILE_URL = "/api/local/files/"

// ---------- templates, settings, name ----------

const templatesFile = () => path.join(/*turbopackIgnore: true*/ localFolder(), "templates.json")

export const listTemplates = (): TemplateRow[] => readJson<TemplateRow[]>(templatesFile(), []).sort((a, b) => b.created_at.localeCompare(a.created_at))

export function createTemplate(input: { name: string; slide_type: TemplateRow["slide_type"]; design_json: TemplateRow["design_json"]; thumbnail: string | null }): TemplateRow {
  const at = now()
  const row: TemplateRow = { id: randomUUID(), name: input.name.trim().slice(0, 120) || "Template", slide_type: input.slide_type, design_json: input.design_json, thumbnail: input.thumbnail, created_at: at, updated_at: at }
  writeJson(templatesFile(), [row, ...readJson<TemplateRow[]>(templatesFile(), [])])
  return row
}

export function renameTemplate(id: string, name: string) {
  writeJson(
    templatesFile(),
    readJson<TemplateRow[]>(templatesFile(), []).map((t) => (t.id === id ? { ...t, name: name.trim().slice(0, 120) || t.name, updated_at: now() } : t)),
  )
}

export const deleteTemplate = (id: string) => writeJson(templatesFile(), readJson<TemplateRow[]>(templatesFile(), []).filter((t) => t.id !== id))

const settingsFile = () => path.join(/*turbopackIgnore: true*/ localFolder(), "settings.json")
export const getSettings = (): UserSettings => readJson<UserSettings>(settingsFile(), {})
export function saveSettings(settings: UserSettings): UserSettings {
  writeJson(settingsFile(), settings ?? {})
  return getSettings()
}

const profileFile = () => path.join(/*turbopackIgnore: true*/ localFolder(), "profile.json")
export const getProfile = (): { name: string } => ({ name: readJson<{ name?: string }>(profileFile(), {}).name?.trim() ?? "" })
export const setProfileName = (name: string) => writeJson(profileFile(), { name: name.trim().slice(0, 80) })

// ---------- posting checklist (the Homes.ph pages each carousel is posted on) ----------

const postingFile = () => path.join(/*turbopackIgnore: true*/ localFolder(), "posting.json")
const readPosting = (): PostCheck[] => readJson<{ checks?: PostCheck[] }>(postingFile(), {}).checks ?? []
const writePosting = (checks: PostCheck[]) => writeJson(postingFile(), { checks })

export const listPostChecks = (projectId: string): PostCheck[] =>
  readPosting()
    .filter((c) => c.project_id === projectId)
    .sort((a, b) => a.checked_at.localeCompare(b.checked_at))

/** Ticks or unticks a page; the carousel is Published once every page is ticked (like the database). */
export function setPostCheck(projectId: string, pageKey: string, checked: boolean) {
  if (!DEFAULT_POST_PAGES.some((p) => p.key === pageKey)) throw new LocalError("Unknown page.")
  const stored = find(projectId)
  const others = readPosting().filter((c) => !(c.project_id === projectId && c.page_key === pageKey))
  const had = readPosting().some((c) => c.project_id === projectId && c.page_key === pageKey)
  const checks = checked && !had ? [...others, { project_id: projectId, page_key: pageKey, checked_by: LOCAL_USER_ID, checked_by_name: getProfile().name, checked_at: now() }] : checked ? readPosting() : others
  writePosting(checks)
  const mine = checks.filter((c) => c.project_id === projectId).sort((a, b) => a.checked_at.localeCompare(b.checked_at))
  const total = DEFAULT_POST_PAGES.length
  const done = mine.length
  const names = [...new Set(mine.map((c) => c.checked_by_name).filter(Boolean))]
  const p = stored.project
  let status = p.status
  let postedAt = p.posted_at ?? null
  if (done >= total) {
    status = "published"
    postedAt = mine[mine.length - 1]?.checked_at ?? now()
  } else if (!checked && had && p.status === "published" && done === total - 1) {
    status = p.scheduled_at ? "scheduled" : "draft"
  }
  persist({ ...stored, project: withPostedAt({ ...p, posted_count: done, posted_by: names, status, posted_at: postedAt, updated_at: now() }) })
}
