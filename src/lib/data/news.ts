"use client"

import { syncPendingImages } from "@/lib/image-sync"
import { checkImageFile } from "@/lib/image-validation"
import { addPending, localSrc, saveLocalImage } from "@/lib/local-images"
import { primeImage, loadImage } from "@/lib/design/image-cache"
import { getNewsTemplate } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { summarizeDesign } from "@/lib/design/templates"
import type { ImageElement, SlideDesign, TextElement } from "@/lib/design/types"
import { createProject, getProject, getProjectSlides, saveProject, updateProject } from "./projects"
import { DataError } from "./errors"

/** A photo for a news article (a copy saved on this computer, uploaded in the background). */
export interface NewsPhoto {
  src: string
  naturalWidth: number
  naturalHeight: number
  assetId?: string | null
  publicId?: string | null
  /** Set while the photo only exists on this computer. */
  sha?: string
  name?: string
}

const photoOf = (design: SlideDesign) => design.elements.find((e): e is ImageElement => e.type === "image" && e.role === "background")
const headlineOf = (design: SlideDesign) => design.elements.find((e): e is TextElement => e.type === "text" && e.role === "title")

/** The headline written on a news design. */
export function newsHeadline(design: SlideDesign): string {
  return headlineOf(design)?.text ?? ""
}

/** The photo is cover-fitted in the template's frame (move and zoom it in the editor). */
function withPhoto(design: SlideDesign, photo: NewsPhoto): SlideDesign {
  return {
    ...design,
    elements: design.elements.map((el) =>
      el.type === "image" && el.role === "background"
        ? {
            ...el,
            src: photo.src,
            naturalWidth: photo.naturalWidth,
            naturalHeight: photo.naturalHeight,
            assetId: photo.assetId ?? null,
            publicId: photo.publicId ?? null,
            zoom: 1,
            focusX: 0.5,
            focusY: 0.5,
            visible: true,
          }
        : el,
    ),
  }
}

function withHeadline(design: SlideDesign, headline: string): SlideDesign {
  return { ...design, elements: design.elements.map((el) => (el.type === "text" && el.role === "title" ? { ...el, text: headline } : el)) }
}

const titleOf = (headline: string) => headline.replace(/\s+/g, " ").trim().slice(0, 300) || "Untitled news article"

/**
 * Saves a pasted or dropped photo on this computer first (it shows at once and
 * survives restarts); it uploads to Cloudinary in the background.
 */
export async function storeNewsPhoto(file: File): Promise<NewsPhoto> {
  const problem = checkImageFile(file)
  if (problem) throw new DataError(problem)
  const name = file.name || "Pasted image"
  const url = URL.createObjectURL(file)
  let img: HTMLImageElement
  try {
    img = await loadImage(url)
  } catch {
    URL.revokeObjectURL(url)
    throw new DataError(`"${name}" could not be opened as an image.`)
  }
  const sha = await saveLocalImage(file, name)
  const src = localSrc(sha)
  primeImage(src, img)
  return { src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, sha, name }
}

/** Queues the local copy for upload; the saved article switches to the Cloudinary original. */
async function uploadLater(photo: NewsPhoto | undefined, projectId: string) {
  if (!photo?.sha) return
  await addPending(photo.sha, photo.name ?? "Pasted image", projectId).catch(() => {})
  void syncPendingImages().catch(() => {})
}

/** Creates a news article from a template (headline, optional photo, posting time). Returns its id. */
export async function createNewsArticle(input: {
  templateId: string
  headline: string
  scheduledAt: string | null
  caption?: string
  photo?: NewsPhoto
}): Promise<string> {
  const template = getNewsTemplate(input.templateId)
  if (!template) throw new DataError("Unknown news template.")
  const { prepareDesign } = await import("@/lib/design/prepare")
  let design = template.build({ headline: input.headline.trim() || undefined })
  if (input.photo) design = withPhoto(design, input.photo)
  const id = await createProject(
    { title: titleOf(input.headline), caption: input.caption?.trim() ?? "", scheduledAt: input.scheduledAt, status: input.scheduledAt ? "scheduled" : "draft" },
    await prepareDesign(design),
  )
  await updateProject(id, { kind: "news" })
  await uploadLater(input.photo, id)
  return id
}

/**
 * Changes a news article without opening the editor: its headline, photo, or
 * template (keeping the headline and photo). Saved like an editor save.
 */
export async function updateNewsArticle(projectId: string, change: { headline?: string; photo?: NewsPhoto; templateId?: string }): Promise<void> {
  const [project, rows] = await Promise.all([getProject(projectId), getProjectSlides(projectId)])
  const row = rows[0]
  if (!row) throw new DataError("This news article has no design.")
  let design = normalizeDesign(row.design_json)
  if (change.templateId && change.templateId !== design.templateId) {
    const template = getNewsTemplate(change.templateId)
    if (!template) throw new DataError("Unknown news template.")
    const photo = photoOf(design)
    const next = template.build({ headline: newsHeadline(design) })
    design = photo?.src ? withPhoto(next, { src: photo.src, naturalWidth: photo.naturalWidth, naturalHeight: photo.naturalHeight, assetId: photo.assetId, publicId: photo.publicId }) : next
  }
  if (change.headline !== undefined) design = withHeadline(design, change.headline)
  if (change.photo) design = withPhoto(design, change.photo)
  const { prepareDesign } = await import("@/lib/design/prepare")
  const prepared = await prepareDesign(design)
  await saveProject({
    projectId,
    expectedRevision: project.revision,
    project: { title: titleOf(newsHeadline(prepared)) },
    slides: [
      {
        id: row.id,
        slide_type: "cover",
        ...summarizeDesign(prepared),
        canvas_width: prepared.width,
        canvas_height: prepared.height,
        design_json: prepared,
      },
    ],
  })
  await uploadLater(change.photo, projectId)
}
