"use client"

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import { format } from "date-fns"
import { getIntegrationStatus, uploadAsset } from "@/lib/data/assets"
import { createProject, getProject, getProjectSlides, listProjects, saveProject, updateProject } from "@/lib/data/projects"
import { normalizeDesign } from "@/lib/design/normalize"
import { summarizeDesign } from "@/lib/design/templates"
import type { ImageElement, SlideDesign, SlideType } from "@/lib/design/types"
import { detectImageType } from "@/lib/image-validation"
import { addPending, getLocalFile, isLocalSrc, localBlobForUrl, localSrc, saveLocalImage, shaOfLocal } from "@/lib/local-images"
import { PROJECT_STATUSES, type ProjectRow, type ProjectStatus } from "@/lib/types"
import { slugify } from "@/lib/utils"

/**
 * Backups are ZIP files with a `backup.json` (carousels, captions, schedule
 * and every slide's full design) plus the original image files in `images/`.
 * Restoring adds the carousels as new ones (nothing is overwritten), uploads
 * the images again (identical files are reused) and points the slides at them.
 */

export const BACKUP_FORMAT = "homes-carousel-backup"
export const BACKUP_VERSION = 1
const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024
const MAX_PROJECTS = 1000

export interface BackupSlide {
  slide_type: SlideType
  design: SlideDesign
}

export interface BackupProject {
  title: string
  topic: string | null
  caption: string
  scheduled_at: string | null
  status: ProjectStatus
  archived_at: string | null
  slides: BackupSlide[]
}

export interface BackupImage {
  /** Path inside the ZIP. */
  file: string
  /** The address the slides used when the backup was made. */
  src: string
  name: string | null
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT
  version: number
  createdAt: string
  appVersion: string
  projects: BackupProject[]
  images: BackupImage[]
}

export interface BackupProgress {
  label: string
  done: number
  total: number
}

type Progress = (p: BackupProgress) => void

/** Image addresses the backup must carry (bundled brand files like /brand/... ship with the app). */
export function backupImageSources(designs: SlideDesign[]): string[] {
  const out = new Set<string>()
  for (const design of designs) {
    for (const el of design.elements) {
      if (el.type === "image" && el.src && !el.src.startsWith("/")) out.add(el.src)
    }
  }
  return [...out]
}

async function downloadImage(src: string): Promise<Uint8Array> {
  // Copies on this computer first: works offline and for images still waiting to upload.
  const local = isLocalSrc(src) ? (await getLocalFile(shaOfLocal(src)))?.blob : await localBlobForUrl(src).catch(() => undefined)
  if (local) return new Uint8Array(await local.arrayBuffer())
  if (isLocalSrc(src)) throw new Error("not on this computer")
  const viaBrowser = async () => {
    const res = await fetch(src, src.startsWith("http") ? { mode: "cors", credentials: "omit" } : undefined)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  try {
    return await viaBrowser()
  } catch (error) {
    if (!/^https?:/i.test(src)) throw error
    const res = await fetch("/api/fetch-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: src }) })
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || `HTTP ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }
}

/** Builds the backup ZIP for the given carousels. Missing images are reported, not fatal. */
export async function buildBackup(projects: BackupProject[], onProgress?: Progress): Promise<{ blob: Blob; missing: string[] }> {
  const sources = backupImageSources(projects.flatMap((p) => p.slides.map((s) => s.design)))
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}
  const images: BackupImage[] = []
  const missing: string[] = []
  for (let i = 0; i < sources.length; i++) {
    onProgress?.({ label: "Saving images", done: i, total: sources.length })
    const src = sources[i]
    try {
      const bytes = await downloadImage(src)
      const type = detectImageType(bytes)
      if (!type) throw new Error("not an image")
      const file = `images/${String(i + 1).padStart(4, "0")}.${type.format}`
      entries[file] = [bytes, { level: 0 }]
      const name = decodeURIComponent(src.split(/[?#]/)[0].split("/").pop() ?? "") || null
      images.push({ file, src, name: name && !src.startsWith("blob:") && !src.startsWith("data:") ? name.slice(0, 200) : null })
    } catch {
      missing.push(src)
    }
  }
  onProgress?.({ label: "Packing", done: sources.length, total: sources.length })
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: process.env.APP_VERSION ?? "dev",
    projects,
    images,
  }
  entries["backup.json"] = [strToU8(JSON.stringify(manifest, null, 1)), { level: 6 }]
  const zipped = zipSync(entries)
  return { blob: new Blob([zipped as BlobPart], { type: "application/zip" }), missing }
}

export function toBackupProject(row: Pick<ProjectRow, "title" | "topic" | "caption" | "scheduled_at" | "status" | "archived_at">, slides: BackupSlide[]): BackupProject {
  return {
    title: row.title,
    topic: row.topic,
    caption: row.caption,
    scheduled_at: row.scheduled_at,
    status: row.status,
    archived_at: row.archived_at,
    slides: slides.map((s) => ({ slide_type: s.slide_type, design: s.design })),
  }
}

/** Saved carousels (from the database) as backup entries. */
export async function loadBackupProjects(ids: string[] | "all", onProgress?: Progress): Promise<BackupProject[]> {
  const rows = ids === "all" ? await listProjects({ archived: "include", limit: MAX_PROJECTS }) : await Promise.all(ids.map((id) => getProject(id)))
  const out: BackupProject[] = []
  for (let i = 0; i < rows.length; i++) {
    onProgress?.({ label: "Reading carousels", done: i, total: rows.length })
    const slides = await getProjectSlides(rows[i].id)
    out.push(toBackupProject(rows[i], slides.map((s) => ({ slide_type: s.slide_type, design: normalizeDesign(s.design_json) }))))
  }
  return out
}

export function backupFileName(projects: BackupProject[]) {
  const date = format(new Date(), "yyyy-MM-dd")
  if (projects.length === 1) return `${date}-${slugify(projects[0].title)}-backup.zip`
  return `homes-carousels-backup-${date}.zip`
}

// ---------- restore ----------

export class BackupError extends Error {}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
const isoOrNull = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null)

/** Reads and checks a backup ZIP. Throws a friendly BackupError when it isn't one. */
export function readBackup(bytes: Uint8Array): { manifest: BackupManifest; files: Record<string, Uint8Array> } {
  if (bytes.length > MAX_BACKUP_BYTES) throw new BackupError("This backup is too large to open.")
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new BackupError("This file isn't a carousel backup (it couldn't be opened as a ZIP).")
  }
  const json = files["backup.json"]
  if (!json) throw new BackupError("This ZIP isn't a carousel backup (backup.json is missing).")
  let raw: Partial<BackupManifest>
  try {
    raw = JSON.parse(strFromU8(json)) as Partial<BackupManifest>
  } catch {
    throw new BackupError("The backup's backup.json is damaged.")
  }
  if (raw.format !== BACKUP_FORMAT) throw new BackupError("This ZIP isn't a carousel backup.")
  if (typeof raw.version !== "number" || raw.version > BACKUP_VERSION) {
    throw new BackupError("This backup was made by a newer version of the app. Update the app, then try again.")
  }
  const projects: BackupProject[] = (Array.isArray(raw.projects) ? raw.projects : []).slice(0, MAX_PROJECTS).flatMap((p) => {
    const slides = (Array.isArray(p?.slides) ? p.slides : [])
      .slice(0, 100)
      .filter((s) => s && typeof s.design === "object" && s.design)
      .map((s, i) => ({ slide_type: (i === 0 ? "cover" : "card") as SlideType, design: normalizeDesign(s.design) }))
    if (!slides.length) return []
    const status = (PROJECT_STATUSES as readonly string[]).includes(p.status) ? p.status : "draft"
    return [
      {
        title: str(p.title, 300).trim() || "Untitled carousel",
        topic: str(p.topic, 300) || null,
        caption: str(p.caption, 20000),
        scheduled_at: isoOrNull(p.scheduled_at),
        status,
        archived_at: isoOrNull(p.archived_at),
        slides,
      },
    ]
  })
  if (!projects.length) throw new BackupError("This backup doesn't contain any carousels.")
  const images = (Array.isArray(raw.images) ? raw.images : []).filter(
    (img): img is BackupImage => typeof img?.file === "string" && typeof img?.src === "string" && !!files[img.file],
  )
  return { manifest: { ...(raw as BackupManifest), projects, images }, files }
}

export interface RestoreResult {
  restored: number
  imagesUploaded: number
  /** Images that couldn't be stored again (their slides keep the original link when there is one). */
  imageProblems: string[]
  failed: { title: string; message: string }[]
}

function rewriteImages(design: SlideDesign, replacements: Map<string, Partial<ImageElement>>): SlideDesign {
  return {
    ...design,
    elements: design.elements.map((el) => {
      if (el.type !== "image") return el
      const patch = el.src ? replacements.get(el.src) : undefined
      return patch ? { ...el, ...patch, uploadId: null } : { ...el, uploadId: null }
    }),
  }
}

/** Restores every carousel in a backup (opened with readBackup) as a new carousel. */
export async function restoreBackup({ manifest, files }: ReturnType<typeof readBackup>, onProgress?: Progress): Promise<RestoreResult> {
  const result: RestoreResult = { restored: 0, imagesUploaded: 0, imageProblems: [], failed: [] }

  // 1. Images back into the library (Cloudinary dedupes identical files).
  const replacements = new Map<string, Partial<ImageElement>>()
  const status = manifest.images.length ? await getIntegrationStatus() : null
  for (let i = 0; i < manifest.images.length; i++) {
    onProgress?.({ label: "Restoring images", done: i, total: manifest.images.length })
    const image = manifest.images[i]
    const data = files[image.file]
    const type = detectImageType(data)
    const name = image.name || image.file.split("/").pop() || "image"
    try {
      if (!type) throw new Error("not a JPG, PNG or WebP image")
      if (!status?.cloudinary) throw new Error("image storage (Cloudinary) isn't set up")
      const { asset } = await uploadAsset(new File([data as BlobPart], name, { type: type.mime }))
      replacements.set(image.src, {
        src: asset.secure_url,
        assetId: asset.id,
        publicId: asset.cloudinary_public_id,
        ...(asset.width && asset.height ? { naturalWidth: asset.width, naturalHeight: asset.height } : {}),
      })
      result.imagesUploaded++
    } catch (error) {
      // Can't upload now: keep it on this computer; it uploads to Cloudinary later.
      try {
        const sha = await saveLocalImage(new Blob([data as BlobPart], { type: type?.mime ?? "image/png" }), name)
        await addPending(sha, name)
        replacements.set(image.src, { src: localSrc(sha), assetId: null, publicId: null })
        result.imageProblems.push(`${name}: saved on this computer, uploads to Cloudinary later (${(error as Error).message})`)
      } catch {
        result.imageProblems.push(`${name}: ${(error as Error).message}`)
        // Temporary addresses can't work after a restart; online links still can.
        if (!/^https?:/i.test(image.src)) replacements.set(image.src, { src: null })
      }
    }
  }

  // 2. Carousels, each as a brand-new one.
  const { renderThumbnail } = await import("@/lib/design/render")
  for (let i = 0; i < manifest.projects.length; i++) {
    onProgress?.({ label: "Restoring carousels", done: i, total: manifest.projects.length })
    const p = manifest.projects[i]
    try {
      const designs = p.slides.map((s) => rewriteImages(s.design, replacements))
      const id = await createProject(
        { title: p.title, topic: p.topic, caption: p.caption, scheduledAt: p.scheduled_at, status: p.status },
        designs[0],
      )
      const row = await getProject(id)
      const thumbnail = await renderThumbnail(designs[0], 360).catch(() => null)
      await saveProject({
        projectId: id,
        expectedRevision: row.revision,
        project: thumbnail ? { thumbnail } : {},
        // Fresh slide ids: the originals may still exist in this account.
        slides: designs.map((design, index) => ({
          id: crypto.randomUUID(),
          slide_type: index === 0 ? "cover" : "card",
          ...summarizeDesign(design),
          canvas_width: design.width,
          canvas_height: design.height,
          design_json: design,
        })),
      })
      if (p.archived_at) await updateProject(id, { archived_at: p.archived_at })
      // Images kept on this computer: this carousel is updated once they reach Cloudinary.
      for (const design of designs) {
        for (const el of design.elements) if (el.type === "image" && isLocalSrc(el.src)) await addPending(shaOfLocal(el.src), "", id)
      }
      result.restored++
    } catch (error) {
      result.failed.push({ title: p.title, message: (error as Error).message })
    }
  }
  onProgress?.({ label: "Done", done: manifest.projects.length, total: manifest.projects.length })
  return result
}
