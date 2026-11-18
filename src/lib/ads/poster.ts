"use client"

import { AD_BASE, AD_MANIFEST, AD_SIZE, adFiles, drawAd, ensureAdFonts, type AdContent, type AdManifest, type AdTemplateId } from "./render"

/**
 * Draws an Advertisement poster on a canvas: the Advertisement page's previews and its Download PNG,
 * and a scheduled ad from its saved record (for the Chrome extension), so both give the same pixels.
 */

/** The logo's size (1 = fits its place) and offset (in widths / heights of its place). */
export interface LogoAdjust {
  scale: number
  dx: number
  dy: number
}
export const NO_ADJUST: LogoAdjust = { scale: 1, dx: 0, dy: 0 }

/** The court logo drawn on a template: the court's own (or the sample) and its size and offset there. */
export interface LogoLook {
  image: HTMLImageElement | null
  adjust?: Partial<Record<AdTemplateId, LogoAdjust>>
}

/** The templates' files, loaded once. */
const images = new Map<string, Promise<HTMLImageElement | null>>()
function loadTemplateImage(src: string) {
  let p = images.get(src)
  if (!p) {
    p = loadPicture(src)
    images.set(src, p)
  }
  return p
}

/** A picture (a file or a data URL), not kept in memory afterwards; null when it can't be read. */
export function loadPicture(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

let manifestPromise: Promise<AdManifest> | null = null
export function loadAdManifest(): Promise<AdManifest> {
  manifestPromise ??= fetch(AD_MANIFEST).then((r) => {
    if (!r.ok) throw new Error("The templates didn't load.")
    return r.json() as Promise<AdManifest>
  })
  manifestPromise.catch(() => {
    manifestPromise = null
  })
  return manifestPromise
}

/** Draws the poster on a canvas of any size (the poster itself is 1408 × 1408). */
export async function paintAd(canvas: HTMLCanvasElement, id: AdTemplateId, content: AdContent, photo: HTMLImageElement | null, logo?: LogoLook | null) {
  const [manifest] = await Promise.all([loadAdManifest(), ensureAdFonts()])
  const files = new Map<string, HTMLImageElement | null>()
  await Promise.all(adFiles(manifest, id).map(async (src) => files.set(src, await loadTemplateImage(AD_BASE + src))))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Can't draw here.")
  const scale = canvas.width / AD_SIZE
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  const adjust = logo?.adjust?.[id] ?? NO_ADJUST
  const result = drawAd(ctx, id, content, { manifest, image: (src) => files.get(src) ?? null, photo, logo: { image: logo?.image ?? null, ...adjust } })
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return result
}

/** The full-size poster (1408 × 1408) as a PNG: the Download PNG button's file. */
export async function adPosterBlob(id: AdTemplateId, content: AdContent, photo: HTMLImageElement | null, logo?: LogoLook | null): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = AD_SIZE
  await paintAd(canvas, id, content, photo, logo)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the picture."))), "image/png"))
}

/** What a saved ad needs to be drawn again exactly. */
export interface AdLook {
  template: AdTemplateId
  content: AdContent
  /** The user's background photo (data URL), else the template's. */
  photo: string | null
  /** The court's logo as shown (data URL), else the template's sample. */
  logo: string | null
  logoAdjust?: Partial<Record<AdTemplateId, LogoAdjust>> | null
}

async function lookPictures(look: AdLook): Promise<{ photo: HTMLImageElement | null; logo: LogoLook }> {
  const [photo, logo] = await Promise.all([loadPicture(look.photo), loadPicture(look.logo)])
  if (look.photo && !photo) throw new Error("The ad's background photo couldn't be read.")
  if (look.logo && !logo) throw new Error("The ad's court logo couldn't be read.")
  return { photo, logo: { image: logo, adjust: look.logoAdjust ?? undefined } }
}

/** A saved ad at full size (1408 × 1408 PNG), the same pixels as Download PNG. */
export async function adLookBlob(look: AdLook): Promise<Blob> {
  const { photo, logo } = await lookPictures(look)
  return adPosterBlob(look.template, look.content, photo, logo)
}

/** A small JPEG of the ad (240 px) for lists. */
export async function adLookThumb(look: AdLook, size = 240): Promise<string> {
  const { photo, logo } = await lookPictures(look)
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  await paintAd(canvas, look.template, look.content, photo, logo)
  // JPEG has no transparency: on white.
  const flat = document.createElement("canvas")
  flat.width = flat.height = size
  const ctx = flat.getContext("2d")!
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(canvas, 0, 0)
  return flat.toDataURL("image/jpeg", 0.8)
}
