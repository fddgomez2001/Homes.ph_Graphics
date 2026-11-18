"use client"

/**
 * Photo enhancer for the Poster Maker: a small, blurry or pixelated photo comes back sharp
 * and 4x bigger (AI super-resolution, Real-ESRGAN General x4v3). It runs in a worker
 * (public/enhance/photo-enhance-worker.js) on this computer's graphics card, or its
 * processor when there's no WebGPU; nothing is uploaded.
 */

export interface EnhancedPhoto {
  /** JPEG, at most 2400 px on its long side. */
  blob: Blob
  width: number
  height: number
  /** "webgpu" = graphics card, "wasm" = processor. */
  backend: "webgpu" | "wasm"
  ms: number
  from: { width: number; height: number }
}

export class EnhanceCancelled extends Error {
  constructor() {
    super("Enhancing was cancelled.")
  }
}

/** A photo smaller than this (long side, px) can be enhanced; bigger ones are sharp enough already. */
export const ENHANCE_MAX_SIDE = 1400
/** Enhanced automatically when the poster would enlarge it more than this. */
const AUTO_ENHANCE_SCALE = 1.1

const AUTO_KEY = "dcm-poster-auto-enhance"

let worker: Worker | null = null
let nextId = 1

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker("/enhance/photo-enhance-worker.js")
    worker.onerror = () => {
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

/** The photo is small for its frame: the poster would enlarge it (and it would look soft or pixelated). */
export function photoNeedsEnhance(naturalWidth: number, naturalHeight: number, frameWidth: number, frameHeight: number): boolean {
  if (!naturalWidth || !naturalHeight) return false
  return Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight) > AUTO_ENHANCE_SCALE && canEnhancePhoto(naturalWidth, naturalHeight)
}

export function canEnhancePhoto(naturalWidth: number, naturalHeight: number): boolean {
  return naturalWidth > 0 && naturalHeight > 0 && Math.max(naturalWidth, naturalHeight) <= ENHANCE_MAX_SIDE
}

/** Enhance small photos automatically when they're added (on unless turned off). */
export function getAutoEnhance(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "off"
  } catch {
    return true
  }
}

const AUTO_EVENT = "dcm-auto-enhance"

export function setAutoEnhance(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "on" : "off")
  } catch {
    // not remembered (private mode)
  }
  window.dispatchEvent(new Event(AUTO_EVENT))
}

/** For useSyncExternalStore: the switch changed (here or in another window). */
export function subscribeAutoEnhance(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === AUTO_KEY && onChange()
  window.addEventListener(AUTO_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(AUTO_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/**
 * Enhances a photo. `onProgress` gets 0–1 while it works; aborting the signal stops it
 * (rejects with EnhanceCancelled).
 */
export function enhancePhoto(photo: Blob, options: { onProgress?: (fraction: number, backend: string) => void; signal?: AbortSignal } = {}): Promise<EnhancedPhoto> {
  const w = getWorker()
  const id = nextId++
  return new Promise<EnhancedPhoto>((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener("message", onMessage)
      w.removeEventListener("error", onError)
      options.signal?.removeEventListener("abort", onAbort)
    }
    const onMessage = (event: MessageEvent) => {
      const msg = event.data
      if (!msg || msg.id !== id) return
      if (msg.type === "progress") return options.onProgress?.(msg.done / Math.max(1, msg.total), msg.backend)
      cleanup()
      if (msg.type === "done") resolve({ blob: msg.blob, width: msg.width, height: msg.height, backend: msg.backend, ms: msg.ms, from: msg.from })
      else reject(msg.cancelled ? new EnhanceCancelled() : new Error(msg.message || "The photo couldn't be enhanced."))
    }
    const onError = () => {
      cleanup()
      reject(new Error("The photo enhancer couldn't start on this computer."))
    }
    const onAbort = () => w.postMessage({ type: "cancel", id })
    w.addEventListener("message", onMessage)
    w.addEventListener("error", onError)
    options.signal?.addEventListener("abort", onAbort)
    w.postMessage({ type: "enhance", id, blob: photo })
  })
}

/** The bytes of an image that's already loaded (e.g. a saved poster's photo), as PNG. */
export async function imageToBlob(image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("The photo couldn't be read.")
  ctx.drawImage(image, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The photo couldn't be read."))), "image/png"))
}
