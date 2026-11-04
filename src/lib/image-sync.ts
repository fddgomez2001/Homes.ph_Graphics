"use client"

import { useEffect } from "react"
import { getIntegrationStatus, uploadAsset } from "@/lib/data/assets"
import { getProject, getProjectSlides, saveProject } from "@/lib/data/projects"
import { normalizeDesign } from "@/lib/design/normalize"
import { summarizeDesign } from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"
import {
  getLocalFile,
  getUploaded,
  isLocalSrc,
  listPending,
  markUploaded,
  recordUploadFailure,
  shaOfLocal,
  type UploadedImage,
} from "@/lib/local-images"

/**
 * Uploads images that are saved on this computer but not in Cloudinary yet
 * (added offline, or while Cloudinary wasn't set up or failed), then points
 * the saved carousels at the Cloudinary originals.
 */

/** "uploaded" events (detail: UploadedImage) let an open editor swap its slides over. */
export const imageEvents = new EventTarget()

/** Carousels open in an editor update themselves; the background sync leaves them alone. */
const openProjects = new Set<string>()
/** Images the editor is uploading right now (never uploaded twice at once). */
export const uploadingNow = new Set<string>()

export function registerOpenProject(id: string) {
  openProjects.add(id)
  return () => {
    openProjects.delete(id)
  }
}

export function announceUploaded(image: UploadedImage) {
  imageEvents.dispatchEvent(new CustomEvent<UploadedImage>("uploaded", { detail: image }))
}

/** Replaces "local:" images that have finished uploading. Returns the same object when nothing changed. */
export async function relinkDesign(design: SlideDesign): Promise<SlideDesign> {
  let changed = false
  const elements = await Promise.all(
    design.elements.map(async (el) => {
      if (el.type !== "image" || !isLocalSrc(el.src)) return el
      const up = await getUploaded(shaOfLocal(el.src)).catch(() => undefined)
      if (!up) return el
      changed = true
      return {
        ...el,
        src: up.src,
        assetId: up.assetId,
        publicId: up.publicId,
        naturalWidth: up.naturalWidth ?? el.naturalWidth,
        naturalHeight: up.naturalHeight ?? el.naturalHeight,
        uploadId: null,
      }
    }),
  )
  return changed ? { ...design, elements } : design
}

async function relinkProject(projectId: string) {
  const [row, slides] = await Promise.all([getProject(projectId), getProjectSlides(projectId)])
  const normalized = slides.map((s) => normalizeDesign(s.design_json))
  const designs = await Promise.all(normalized.map(relinkDesign))
  if (designs.every((d, i) => d === normalized[i])) return
  await saveProject({
    projectId,
    expectedRevision: row.revision,
    project: {},
    slides: slides.map((s, i) => ({
      id: s.id,
      slide_type: s.slide_type,
      ...summarizeDesign(designs[i]),
      canvas_width: designs[i].width,
      canvas_height: designs[i].height,
      design_json: designs[i],
    })),
  })
}

export interface SyncResult {
  uploaded: number
  remaining: number
  error?: string
}

let running: Promise<SyncResult> | null = null

/** `fresh`: wait for a run already in progress, then start a new one (e.g. right after fixing Cloudinary). */
export async function syncPendingImages({ fresh = false }: { fresh?: boolean } = {}): Promise<SyncResult> {
  if (fresh && running) await running.catch(() => {})
  if (!running) {
    running = (async (): Promise<SyncResult> => {
      const pending = (await listPending().catch(() => [])).filter((p) => !uploadingNow.has(p.sha))
      if (!pending.length) return { uploaded: 0, remaining: 0 }
      const status = await getIntegrationStatus(true)
      if (!status.cloudinary) return { uploaded: 0, remaining: pending.length, error: "Cloudinary isn't set up yet." }
      let uploaded = 0
      for (const p of pending) {
        const file = await getLocalFile(p.sha).catch(() => undefined)
        if (!file) continue
        uploadingNow.add(p.sha)
        try {
          const { asset } = await uploadAsset(new File([file.blob], p.name || file.name, { type: file.type }))
          const image: UploadedImage = {
            sha: p.sha,
            src: asset.secure_url,
            assetId: asset.id,
            publicId: asset.cloudinary_public_id,
            naturalWidth: asset.width ?? undefined,
            naturalHeight: asset.height ?? undefined,
          }
          await markUploaded(image)
          announceUploaded(image)
          uploaded++
          for (const projectId of p.projectIds) {
            if (!openProjects.has(projectId)) await relinkProject(projectId).catch(() => {})
          }
        } catch (error) {
          const message = (error as Error).message
          await recordUploadFailure(p.sha, message).catch(() => {})
          // The same problem (e.g. wrong cloud name) would hit every image: try again later.
          return { uploaded, remaining: pending.length - uploaded, error: message }
        } finally {
          uploadingNow.delete(p.sha)
        }
      }
      return { uploaded, remaining: pending.length - uploaded }
    })().finally(() => {
      running = null
    })
  }
  return running
}

/** Keeps retrying waiting uploads: on start, when back online, and every two minutes. */
export function usePendingImageSync() {
  useEffect(() => {
    const run = () => void syncPendingImages().catch(() => {})
    const first = setTimeout(run, 2500)
    const timer = setInterval(run, 120_000)
    window.addEventListener("online", run)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      window.removeEventListener("online", run)
    }
  }, [])
}
