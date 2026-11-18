"use client"

/**
 * The editor's picture tools (1.53), all on this computer (nothing is uploaded to an AI service):
 * - removeBackground: the people cut out with their hair (MODNet, public/enhance/remove-bg-worker.js);
 * - removePlainBackground: logos and graphics on one plain color;
 * - autoLightColor: levels, a little more color and sharpness;
 * - the AI upscaler (Real-ESRGAN) is photo-enhance.ts's enhancePhoto.
 */
import { clearBackground } from "@/lib/ads/court-logo"

export class ToolCancelled extends Error {
  constructor() {
    super("Cancelled.")
  }
}

let worker: Worker | null = null
let nextId = 1

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker("/enhance/remove-bg-worker.js")
    worker.onerror = () => {
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

/** The people in a photo, cut out (PNG, the same size; see-through around them). */
export function removeBackground(photo: Blob, options: { onProgress?: (fraction: number, label: string) => void; signal?: AbortSignal } = {}): Promise<{ blob: Blob; width: number; height: number; ms: number }> {
  const w = getWorker()
  const id = nextId++
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener("message", onMessage)
      w.removeEventListener("error", onError)
      options.signal?.removeEventListener("abort", onAbort)
    }
    const onMessage = (event: MessageEvent) => {
      const msg = event.data
      if (!msg || msg.id !== id) return
      if (msg.type === "progress") return options.onProgress?.(msg.done / Math.max(1, msg.total), msg.label)
      cleanup()
      if (msg.type === "done") resolve({ blob: msg.blob, width: msg.width, height: msg.height, ms: msg.ms })
      else reject(msg.cancelled ? new ToolCancelled() : new Error(msg.message || "The background couldn't be removed."))
    }
    const onError = () => {
      cleanup()
      reject(new Error("The background remover couldn't start on this computer."))
    }
    const onAbort = () => w.postMessage({ type: "cancel", id })
    w.addEventListener("message", onMessage)
    w.addEventListener("error", onError)
    options.signal?.addEventListener("abort", onAbort)
    w.postMessage({ type: "remove", id, blob: photo })
  })
}

async function pixelsOf(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) }
}

const toBlob = (canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The picture couldn't be made."))), type, quality))

const hasSeeThrough = (px: Uint8ClampedArray) => {
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return true
  return false
}

/** A logo or graphic on one plain color: that color made see-through. Null when the background isn't plain. */
export async function removePlainBackground(picture: Blob): Promise<Blob | null> {
  const { canvas, ctx, data } = await pixelsOf(picture)
  if (!clearBackground(data.data, canvas.width, canvas.height)) return null
  ctx.putImageData(data, 0, 0)
  return toBlob(canvas, "image/png")
}

/**
 * Auto light & color: each color stretched to its full range (the darkest and lightest 0.5% left out), a little
 * more color, and a light sharpening. See-through pictures stay see-through.
 */
export async function autoLightColor(picture: Blob): Promise<Blob> {
  const { canvas, ctx, data } = await pixelsOf(picture)
  const px = data.data
  const n = canvas.width * canvas.height
  const lo = [0, 0, 0]
  const hi = [255, 255, 255]
  for (let c = 0; c < 3; c++) {
    const hist = new Uint32Array(256)
    let count = 0
    for (let i = 0; i < n; i++) {
      if (px[i * 4 + 3] < 128) continue
      hist[px[i * 4 + c]]++
      count++
    }
    const cut = count * 0.005
    let acc = 0
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) > cut) {
      lo[c] = v
      break
    }
    acc = 0
    for (let v = 255; v >= 0; v--) if ((acc += hist[v]) > cut) {
      hi[c] = v
      break
    }
  }
  // Never stretched too far (a dark night photo stays a night photo).
  const span = (c: number) => Math.max(hi[c] - lo[c], 160)
  const out = new Uint8ClampedArray(px)
  for (let i = 0; i < n; i++) {
    const k = i * 4
    const r = ((px[k] - lo[0]) * 255) / span(0)
    const g = ((px[k + 1] - lo[1]) * 255) / span(1)
    const b = ((px[k + 2] - lo[2]) * 255) / span(2)
    const grey = 0.299 * r + 0.587 * g + 0.114 * b
    const sat = 1.1
    out[k] = grey + (r - grey) * sat
    out[k + 1] = grey + (g - grey) * sat
    out[k + 2] = grey + (b - grey) * sat
  }
  // Light sharpening (unsharp mask, 3 × 3).
  const w = canvas.width
  const h = canvas.height
  const sharp = new Uint8ClampedArray(out)
  const amount = 0.35
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const k = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const blur = (out[k - 4 + c] + out[k + 4 + c] + out[k - w * 4 + c] + out[k + w * 4 + c] + 4 * out[k + c]) / 8
        sharp[k + c] = out[k + c] + (out[k + c] - blur) * amount * 2
      }
    }
  }
  data.data.set(sharp)
  ctx.putImageData(data, 0, 0)
  return hasSeeThrough(px) ? toBlob(canvas, "image/png") : toBlob(canvas, "image/jpeg", 0.95)
}
