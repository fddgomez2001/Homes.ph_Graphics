"use client"

import { useEffect, useState } from "react"
import { getLocalFile, getUploaded, isLocalSrc, localBlobForUrl, rememberRemoteImage, shaOfLocal } from "@/lib/local-images"

/**
 * Decoded full-resolution images, shared by the editor canvas, thumbnails and
 * the exporter. Images are always the original bytes — never a thumbnail or
 * preview variant. Copies saved on this computer are used first; a cloud
 * image is downloaded once and then kept on this computer.
 */
const pending = new Map<string, Promise<HTMLImageElement>>()
const ready = new Map<string, HTMLImageElement>()

export function getLoadedImage(src: string | null | undefined): HTMLImageElement | undefined {
  return src ? ready.get(src) : undefined
}

function decode(url: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Remote images must be CORS-enabled so the canvas can still be exported.
    if (crossOrigin) img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("decode"))
    img.src = url
  })
}

const fromBlob = (blob: Blob) => decode(URL.createObjectURL(blob), false)

async function load(src: string): Promise<HTMLImageElement> {
  if (isLocalSrc(src)) {
    const sha = shaOfLocal(src)
    const file = await getLocalFile(sha).catch(() => undefined)
    if (file) return fromBlob(file.blob)
    // Already uploaded (and the local copy was cleared): use the cloud original.
    const uploaded = await getUploaded(sha).catch(() => undefined)
    if (uploaded) return load(uploaded.src)
    throw new Error("This image was added on another computer and hasn't finished uploading to Cloudinary yet.")
  }
  if (src.startsWith("blob:")) {
    return decode(src, false).catch(() => {
      throw new Error("This image was never saved (its upload did not finish). Paste or drop it again.")
    })
  }
  if (/^https?:/i.test(src)) {
    const local = await localBlobForUrl(src).catch(() => undefined)
    if (local) return fromBlob(local)
    // Download the original once and keep it on this computer.
    try {
      const res = await fetch(src, { mode: "cors", credentials: "omit" })
      const blob = res.ok ? await res.blob() : null
      if (blob?.type.startsWith("image/")) {
        void rememberRemoteImage(src, blob).catch(() => {})
        return fromBlob(blob)
      }
    } catch {
      // not downloadable as a file: load it directly below
    }
    return decode(src, true).catch(() => {
      throw new Error(`Could not load image: ${src}`)
    })
  }
  return decode(src, false).catch(() => {
    throw new Error(`Could not load image: ${src}`)
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = ready.get(src)
  if (cached) return Promise.resolve(cached)
  const inflight = pending.get(src)
  if (inflight) return inflight
  const promise = load(src).then(
    (img) => {
      ready.set(src, img)
      pending.delete(src)
      return img
    },
    (error) => {
      pending.delete(src)
      throw error
    },
  )
  pending.set(src, promise)
  return promise
}

/** Seeds the cache with an already-decoded image under a new URL (e.g. after upload). */
export function primeImage(src: string, img: HTMLImageElement) {
  ready.set(src, img)
}

export type ImageStatus = "idle" | "loading" | "loaded" | "error"

export function useCanvasImage(src: string | null | undefined): { image: HTMLImageElement | undefined; status: ImageStatus } {
  const [state, setState] = useState<{ src: string | null | undefined; image?: HTMLImageElement; status: ImageStatus }>(() => {
    const image = getLoadedImage(src)
    return { src, image, status: !src ? "idle" : image ? "loaded" : "loading" }
  })

  useEffect(() => {
    if (!src || getLoadedImage(src)) return
    let cancelled = false
    loadImage(src).then(
      (image) => !cancelled && setState({ src, image, status: "loaded" }),
      () => !cancelled && setState({ src, status: "error" }),
    )
    return () => {
      cancelled = true
    }
  }, [src])

  // Derive synchronously when src changed, so a cached image never flashes.
  if (state.src !== src) {
    const image = getLoadedImage(src)
    return { image, status: !src ? "idle" : image ? "loaded" : "loading" }
  }
  return { image: state.image, status: state.status }
}
