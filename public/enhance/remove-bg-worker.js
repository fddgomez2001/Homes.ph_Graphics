/*
 * Background remover (editor, 1.53): cuts the people out of a photo, with their hair, by MODNet portrait matting
 * (Apache-2.0, see /models/modnet/LICENSE.txt) run by ONNX Runtime Web on this computer's processor (on some
 * graphics cards its WebGPU output is wrong, so the processor does it). Nothing is uploaded.
 *
 * Two passes: at 512 px it finds the people (the whole person, reliably), at up to 1024 px it draws the edge
 * finely (hair strands); the fine edge is kept where the people are, so nothing else is left behind.
 *
 * Messages in:  { type: "remove", id, blob } | { type: "cancel", id }
 * Messages out: { type: "progress", id, done, total, label } | { type: "done", id, blob, width, height, ms }
 *               | { type: "error", id, message, cancelled? }
 */
"use strict"
/* global ort */
self.importScripts("/ort/ort.webgpu.min.js")

const MODEL_URL = "/models/modnet/modnet.onnx"
/** Biggest photo worked on (long side); bigger ones are made this size first. */
const MAX_SIDE = 2600

let sessionPromise = null
const cancelled = new Set()

function session() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      ort.env.wasm.wasmPaths = new URL("/ort/", self.location.href).href
      ort.env.wasm.numThreads = 1
      const res = await fetch(MODEL_URL)
      if (!res.ok) throw new Error(`The background remover's model couldn't be loaded (${res.status}).`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" })
    })()
    sessionPromise.catch(() => {
      sessionPromise = null
    })
  }
  return sessionPromise
}

/** The model's matte (0–1) of `bitmap` with its shortest side `short` (multiple of 32), as a w × h grey canvas. */
async function matte(s, bitmap, short) {
  const W = bitmap.width
  const H = bitmap.height
  const k = short / Math.min(W, H)
  const iw = Math.max(32, Math.round((W * k) / 32) * 32)
  const ih = Math.max(32, Math.round((H * k) / 32) * 32)
  const c = new OffscreenCanvas(iw, ih)
  const g = c.getContext("2d")
  g.imageSmoothingQuality = "high"
  g.drawImage(bitmap, 0, 0, iw, ih)
  const px = g.getImageData(0, 0, iw, ih).data
  const plane = iw * ih
  const data = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    data[i] = px[i * 4] / 127.5 - 1
    data[plane + i] = px[i * 4 + 1] / 127.5 - 1
    data[2 * plane + i] = px[i * 4 + 2] / 127.5 - 1
  }
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", data, [1, 3, ih, iw]) })
  const a = out[s.outputNames[0]].data
  const img = new ImageData(iw, ih)
  for (let i = 0; i < plane; i++) {
    const v = Math.round(Math.max(0, Math.min(1, a[i])) * 255)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return c
}

/** A matte canvas at the photo's size, as 0–1 values. */
function upsample(canvas, W, H) {
  const c = new OffscreenCanvas(W, H)
  const g = c.getContext("2d")
  g.imageSmoothingQuality = "high"
  g.drawImage(canvas, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const out = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) out[i] = d[i * 4] / 255
  return out
}

/** Dilation of a 0/1 mask by r px (box window), via an integral image. */
function dilate(mask, w, h, r) {
  const I = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += mask[y * w + x]
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row
    }
  }
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h - 1, y + r)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      out[y * w + x] = I[(y1 + 1) * (w + 1) + x1 + 1] - I[y0 * (w + 1) + x1 + 1] - I[(y1 + 1) * (w + 1) + x0] + I[y0 * (w + 1) + x0] > 0 ? 1 : 0
    }
  }
  return out
}

const smooth = (v, lo, hi) => {
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

async function removeBackground(msg) {
  const { id } = msg
  const started = performance.now()
  const post = (done, label) => self.postMessage({ type: "progress", id, done, total: 4, label })
  post(0, "Loading the AI…")
  const s = await session()
  let bitmap = await createImageBitmap(msg.blob)
  if (Math.max(bitmap.width, bitmap.height) > MAX_SIDE) {
    const k = MAX_SIDE / Math.max(bitmap.width, bitmap.height)
    bitmap = await createImageBitmap(msg.blob, { resizeWidth: Math.round(bitmap.width * k), resizeHeight: Math.round(bitmap.height * k), resizeQuality: "high" })
  }
  const W = bitmap.width
  const H = bitmap.height
  if (cancelled.has(id)) throw Object.assign(new Error("cancelled"), { cancelled: true })
  post(1, "Finding the people…")
  const coarse = upsample(await matte(s, bitmap, 512), W, H)
  if (cancelled.has(id)) throw Object.assign(new Error("cancelled"), { cancelled: true })
  // The fine pass: up to 1024 px (never bigger than the photo itself).
  const fineShort = Math.min(1024, Math.floor(Math.min(W, H) / 32) * 32)
  let fine = null
  if (fineShort >= 640) {
    post(2, "Tracing the hair and edges…")
    fine = upsample(await matte(s, bitmap, fineShort), W, H)
  }
  if (cancelled.has(id)) throw Object.assign(new Error("cancelled"), { cancelled: true })
  post(3, "Cleaning up…")
  // Where the people are (with a margin for loose hair): the fine edge is kept only there.
  const near = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) near[i] = coarse[i] > 0.08 ? 1 : 0
  const where = dilate(near, W, H, Math.max(4, Math.round(Math.min(W, H) * 0.02)))
  const c = new OffscreenCanvas(W, H)
  const g = c.getContext("2d", { willReadFrequently: true })
  g.drawImage(bitmap, 0, 0)
  const img = g.getImageData(0, 0, W, H)
  const px = img.data
  for (let i = 0; i < W * H; i++) {
    let a
    if (fine) {
      // The fine matte, tightened (no haze around the hair), and the solid inside from the first pass.
      a = Math.max(smooth(fine[i], 0.2, 0.8), coarse[i] > 0.92 ? smooth(coarse[i], 0.92, 0.99) : 0)
      a *= where[i]
    } else {
      a = smooth(coarse[i], 0.12, 0.88)
    }
    px[i * 4 + 3] = Math.round(a * 255)
  }
  g.putImageData(img, 0, 0)
  const blob = await c.convertToBlob({ type: "image/png" })
  post(4, "Done")
  return { blob, width: W, height: H, ms: Math.round(performance.now() - started) }
}

self.onmessage = async (event) => {
  const msg = event.data || {}
  if (msg.type === "cancel") {
    cancelled.add(msg.id)
    return
  }
  if (msg.type !== "remove") return
  try {
    const r = await removeBackground(msg)
    self.postMessage({ type: "done", id: msg.id, ...r })
  } catch (e) {
    self.postMessage({ type: "error", id: msg.id, message: (e && e.message) || "The background couldn't be removed.", cancelled: !!(e && e.cancelled) || cancelled.has(msg.id) })
  } finally {
    cancelled.delete(msg.id)
  }
}
