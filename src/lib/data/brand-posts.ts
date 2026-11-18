"use client"

/**
 * Saving Did You Know and engagement posts (1.52, Poster Maker): like posters, each is a news post at its posting
 * time with one slide, its design drawn by its SVG template (lib/brand-templates). Photos are kept on this computer
 * first and uploaded in the background (the saved post then points at the uploaded copy).
 */
import { syncPendingImages } from "@/lib/image-sync"
import { addPending } from "@/lib/local-images"
import { postTitleOf } from "@/lib/brand-templates/posts"
import { carryLayers } from "@/lib/brand-templates/layers"
import { normalizeDesign } from "@/lib/design/normalize"
import { summarizeDesign } from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"
import { DataError } from "./errors"
import type { NewsPhoto } from "./news"
import { createProject, getProject, getProjectSlides, saveProject, updateProject } from "./projects"

const titleOf = (design: SlideDesign) => postTitleOf(design.brandPost?.fields ?? {}).slice(0, 300) || "Untitled post"

/** Photos saved on this computer only: uploaded later, then the post follows them. */
async function uploadLater(photos: (NewsPhoto | null | undefined)[], projectId: string) {
  const local = photos.filter((p): p is NewsPhoto => !!p?.sha)
  if (!local.length) return
  for (const p of local) await addPending(p.sha!, p.name ?? "Post photo", projectId).catch(() => {})
  void syncPendingImages().catch(() => {})
}

/** A new post (its design as made in the Poster Maker). Returns its id. */
export async function createBrandPost(input: { design: SlideDesign; scheduledAt: string | null; caption?: string; photos?: (NewsPhoto | null)[] }): Promise<string> {
  if (!input.design.brandPost) throw new DataError("This post has no template.")
  const id = await createProject(
    { title: titleOf(input.design), caption: input.caption?.trim() ?? "", topic: null, scheduledAt: input.scheduledAt, status: input.scheduledAt ? "scheduled" : "draft" },
    input.design,
  )
  await updateProject(id, { kind: "news" })
  await uploadLater(input.photos ?? [], id)
  return id
}

/** Saves a post's design (and caption) over the saved one. */
export async function saveBrandPost(projectId: string, design: SlideDesign, extra: { caption?: string; photos?: (NewsPhoto | null)[] } = {}): Promise<void> {
  const [project, rows] = await Promise.all([getProject(projectId), getProjectSlides(projectId)])
  const row = rows[0]
  if (!row) throw new DataError("This post has no design.")
  // The layers are changed in the editor only (1.53): the saved ones stay, whatever this form last read.
  design = carryLayers(normalizeDesign(row.design_json), design)
  await saveProject({
    projectId,
    expectedRevision: project.revision,
    project: { title: titleOf(design), ...(extra.caption !== undefined ? { caption: extra.caption } : {}) },
    slides: [{ id: row.id, slide_type: "cover", ...summarizeDesign(design), canvas_width: design.width, canvas_height: design.height, design_json: design }],
  })
  await uploadLater(extra.photos ?? [], projectId)
}
