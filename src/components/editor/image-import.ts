"use client"

import { toast } from "sonner"
import { getIntegrationStatus, uploadAsset } from "@/lib/data/assets"
import { CANVAS_SIZE, type ImageElement, type SlideDesign } from "@/lib/design/types"
import { loadImage, primeImage } from "@/lib/design/image-cache"
import { backgroundImage, imageElement } from "@/lib/design/templates"
import { checkImageFile } from "@/lib/image-validation"
import { announceUploaded, uploadingNow } from "@/lib/image-sync"
import { addPending, localSrc, markUploaded, recordUploadFailure, saveLocalImage } from "@/lib/local-images"
import type { AssetRow } from "@/lib/types"
import { shortId } from "@/lib/utils"
import type { EditorStore } from "./store"

export const ASSET_DRAG_TYPE = "application/x-dcm-asset"

/** Where an imported image goes. */
export type ImportTarget =
  | { mode: "background"; slideId: string }
  | { mode: "object"; slideId: string; at?: { x: number; y: number } }
  | { mode: "replace"; slideId: string; elementId: string }

export interface ImageSource {
  src: string
  naturalWidth: number
  naturalHeight: number
  assetId?: string | null
  publicId?: string | null
  uploadId?: string | null
  name?: string
}

/** Fired after uploads so open image libraries refresh. */
export const libraryEvents = new EventTarget()

export function slideBackground(design: SlideDesign): ImageElement | undefined {
  return design.elements.find((e): e is ImageElement => e.type === "image" && e.role === "background")
}

export function hasEmptyBackground(design: SlideDesign) {
  const bg = slideBackground(design)
  return !bg || !bg.src
}

/** Default target when the user didn't point at anything: fill an empty background slot, else add on top. */
export function defaultTarget(store: EditorStore): ImportTarget {
  const s = store.getState()
  const slide = s.slides.find((x) => x.id === s.currentSlideId) ?? s.slides[0]
  return hasEmptyBackground(slide.design) ? { mode: "background", slideId: slide.id } : { mode: "object", slideId: slide.id }
}

/** Puts an image into a slide. Returns the element id. */
export function placeImage(store: EditorStore, image: ImageSource, target: ImportTarget): string {
  const state = store.getState()
  const slide = state.slides.find((s) => s.id === target.slideId)
  if (!slide) return ""
  const sourceFields = {
    src: image.src,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    assetId: image.assetId ?? null,
    publicId: image.publicId ?? null,
    uploadId: image.uploadId ?? null,
  }

  if (target.mode === "replace") {
    // Replacing the Homes.ph logo with another image makes it a custom logo (no auto color).
    const isLogo = slide.design.elements.some((e) => e.id === target.elementId && e.role === "logo")
    const logoFields = isLogo ? { logoVariant: null, logoResolved: null } : {}
    state.updateElement(target.elementId, { ...sourceFields, ...logoFields, zoom: 1, focusX: 0.5, focusY: 0.5 }, { history: null })
    state.select(target.elementId)
    return target.elementId
  }

  if (target.mode === "background") {
    const bg = slideBackground(slide.design)
    if (bg) {
      state.updateElement(bg.id, { ...sourceFields, zoom: 1, focusX: 0.5, focusY: 0.5, visible: true }, { history: null })
      if (state.currentSlideId !== slide.id) state.setCurrentSlide(slide.id)
      return bg.id
    }
    const el = { ...backgroundImage(), ...sourceFields }
    state.addElement(el, { slideId: slide.id, index: 0, select: false })
    return el.id
  }

  // New image object: natural size, but no larger than 60% of the canvas (never upscaled).
  const canvasW = slide.design.width || CANVAS_SIZE
  const canvasH = slide.design.height || canvasW
  const maxSide = Math.min(canvasW, canvasH) * 0.6
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const center = target.at ?? { x: canvasW / 2, y: canvasH / 2 }
  const el = imageElement({
    name: image.name ? image.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "Image" : "Image",
    ...sourceFields,
    width,
    height,
    x: Math.round(Math.min(canvasW - width / 2, Math.max(-width / 2, center.x - width / 2))),
    y: Math.round(Math.min(canvasH - height / 2, Math.max(-height / 2, center.y - height / 2))),
    fit: "cover",
  })
  state.addElement(el, { slideId: slide.id })
  return el.id
}

/**
 * Imports local files. Each original is first saved on this computer and shown
 * right away (the slide points at the local copy, so it survives restarts and
 * failed uploads), then uploaded untouched to Cloudinary; the slide switches
 * to the Cloudinary original when that finishes.
 */
export async function importImageFiles(store: EditorStore, files: File[], target: ImportTarget): Promise<void> {
  const valid: File[] = []
  for (const file of files) {
    const problem = checkImageFile(file)
    if (problem) toast.error(problem)
    else valid.push(file)
  }
  for (let i = 0; i < valid.length; i++) {
    const file = valid[i]
    // Extra files from a multi-drop are added as objects, cascading slightly.
    const t: ImportTarget =
      i === 0
        ? target
        : { mode: "object", slideId: target.slideId, at: { x: CANVAS_SIZE / 2 + i * 40, y: CANVAS_SIZE / 2 + i * 40 } }
    await importOne(store, file, t)
  }
}

async function importOne(store: EditorStore, file: File, target: ImportTarget) {
  const name = file.name || "Pasted image"
  let img: HTMLImageElement
  const objectUrl = URL.createObjectURL(file)
  try {
    img = await loadImage(objectUrl)
  } catch {
    URL.revokeObjectURL(objectUrl)
    toast.error(`"${name}" could not be opened as an image.`)
    return
  }

  // 1. Saved on this computer first.
  let src = objectUrl
  let sha: string | null = null
  try {
    sha = await saveLocalImage(file, name)
    src = localSrc(sha)
    primeImage(src, img)
    await addPending(sha, name, store.getState().project.id)
  } catch {
    // This computer's image storage is unavailable: keep the temporary copy until the upload finishes.
  }
  const uploadId = shortId()
  placeImage(store, { src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, uploadId, name }, target)

  // 2. Then uploaded to Cloudinary.
  const keptLocally = (reason: string) => {
    store.getState().setUpload(uploadId, { name, status: sha ? "local" : "error", error: reason, sha: sha ?? undefined })
    if (sha) {
      toast.warning("Image saved on this computer", {
        id: "image-saved-locally",
        description: `${reason} It stays in your slide and uploads to Cloudinary automatically as soon as it can.`,
      })
    } else {
      toast.error("Upload failed", { description: reason })
    }
  }
  const status = await getIntegrationStatus()
  if (!status.cloudinary) {
    keptLocally(`Cloudinary isn't set up (missing ${status.missingCloudinary.join(", ") || "settings"}).`)
    return
  }

  if (sha) uploadingNow.add(sha)
  store.getState().setUpload(uploadId, { name, progress: 0, status: "uploading" })
  try {
    const { asset, duplicate } = await uploadAsset(file, (fraction) =>
      store.getState().setUpload(uploadId, { progress: fraction, status: fraction >= 1 ? "processing" : "uploading" }),
    )
    const stored = {
      src: asset.secure_url,
      assetId: asset.id,
      publicId: asset.cloudinary_public_id,
      naturalWidth: asset.width ?? img.naturalWidth,
      naturalHeight: asset.height ?? img.naturalHeight,
    }
    // The local copy and the Cloudinary original are the same bytes: reuse the decoded bitmap.
    primeImage(asset.secure_url, img)
    if (sha) {
      await markUploaded({ sha, ...stored }).catch(() => {})
      announceUploaded({ sha, ...stored })
    }
    store.getState().resolveUpload(uploadId, stored)
    store.getState().setUpload(uploadId, { progress: 1, status: "done" })
    libraryEvents.dispatchEvent(new Event("changed"))
    if (duplicate) toast.info("This image was already in your library, so the existing original was reused.")
    // Nothing references the temporary URL any more (history was rewritten too).
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
  } catch (error) {
    const message = (error as Error).message
    if (sha) await recordUploadFailure(sha, message).catch(() => {})
    keptLocally(`Upload to Cloudinary failed: ${message}`)
  } finally {
    if (sha) uploadingNow.delete(sha)
  }
}

/** Uses an image that's already in the library (its stored original). */
export async function placeAsset(store: EditorStore, asset: Pick<AssetRow, "id" | "secure_url" | "cloudinary_public_id" | "width" | "height" | "original_filename">, target: ImportTarget) {
  let w = asset.width ?? 0
  let h = asset.height ?? 0
  if (!w || !h) {
    try {
      const img = await loadImage(asset.secure_url)
      w = img.naturalWidth
      h = img.naturalHeight
    } catch {
      toast.error("That image could not be loaded.")
      return
    }
  }
  placeImage(
    store,
    {
      src: asset.secure_url,
      naturalWidth: w,
      naturalHeight: h,
      assetId: asset.id,
      publicId: asset.cloudinary_public_id,
      name: asset.original_filename ?? undefined,
    },
    target,
  )
}

/** First <img src> in copied HTML (e.g. "Copy image" in some browsers / apps). */
export function imageSourceFromHtml(html: string): string | null {
  if (!html || !/<img\s/i.test(html)) return null
  const doc = new DOMParser().parseFromString(html, "text/html")
  const src = doc.querySelector("img")?.getAttribute("src")?.trim()
  return src && /^(https?:|data:image\/)/i.test(src) ? src : null
}

/** Downloads an image from a link (directly, or through the app server when the site blocks it). */
export async function fetchImageFile(src: string): Promise<File> {
  const toFile = (blob: Blob) => {
    const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png"
    return new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type || "image/png" })
  }
  if (src.startsWith("data:")) return toFile(await (await fetch(src)).blob())
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" })
    const blob = await res.blob()
    if (res.ok && blob.type.startsWith("image/")) return toFile(blob)
  } catch {
    // blocked by the website (CORS) — use the server below
  }
  const res = await fetch("/api/fetch-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: src }) })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || "Couldn't download that image.")
  }
  return toFile(await res.blob())
}

export async function pasteImageFromUrl(store: EditorStore, src: string, slideId: string) {
  const id = toast.loading("Getting the copied image…")
  try {
    const file = await fetchImageFile(src)
    toast.dismiss(id)
    await importImageFiles(store, [file], { mode: "background", slideId })
  } catch (error) {
    toast.error("Couldn't paste that image", {
      id,
      description: `${(error as Error).message} Tip: in Figma use "Copy as PNG" (Ctrl+Shift+C).`,
    })
  }
}

export function readAssetDrag(dataTransfer: DataTransfer): AssetRow | null {
  const raw = dataTransfer.getData(ASSET_DRAG_TYPE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AssetRow
  } catch {
    return null
  }
}

export function filesFromDataTransfer(dataTransfer: DataTransfer): File[] {
  return Array.from(dataTransfer.files ?? []).filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(f.name))
}
