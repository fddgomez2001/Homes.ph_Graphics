/*
 * Photo enhancer (Poster Maker): makes a small, blurry or pixelated photo sharp and 4x bigger
 * with Real-ESRGAN General x4v3 (BSD-3, see /models/real-esrgan/LICENSE.txt), run by
 * ONNX Runtime Web: on the graphics card (WebGPU) when the PC has it, else on the processor.
 * Runs in this worker so the app never freezes; everything stays on the computer.
 *
 * Messages in:  { type: "enhance", id, blob, maxInput?, maxOutput?, quality? } | { type: "cancel", id } | { type: "warmup", id }
 * Messages out: { type: "progress", id, done, total, backend } | { type: "done", id, blob, width, height, backend, ms, from }
 *               | { type: "ready", id, backend } | { type: "error", id, message, cancelled? }
 */
"use strict"
/* global ort */
self.importScripts("/ort/ort.webgpu.min.js")

const MODEL_URL = "/models/real-esrgan/real_esrgan_general_x4v3.onnx"
const DATA_URL = "/models/real-esrgan/real_esrgan_general_x4v3.data"
/** The weights file's name as written inside the model. */
const DATA_NAME = "real_esrgan_general_x4v3.data"
/** The model takes 128 x 128 pieces and gives back 512 x 512. */
const TILE = 128
const SCALE = 4
/** Each piece overlaps its neighbours by this much (in source pixels), so no seams show. */
const PAD = 12
const CORE = TILE - 2 * PAD

let loading = null
const cancelled = new Set()

async function bytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`The enhancer's model couldn't be loaded (${res.status}).`)
  return new Uint8Array(await res.arrayBuffer())
}

let files = null
async function create(backend) {
  if (!files) files = Promise.all([bytes(MODEL_URL), bytes(DATA_URL)])
  const [model, data] = await files
  const session = await ort.InferenceSession.create(model.slice(), {
    executionProviders: [backend],
    externalData: [{ path: DATA_NAME, data: data.slice() }],
    graphOptimizationLevel: "all",
  })
  return { session, backend }
}

/** The model, on the graphics card if possible. */
function load(forceCpu) {
  if (loading && !forceCpu) return loading
  loading = (async () => {
    ort.env.wasm.wasmPaths = new URL("/ort/", self.location.href).href
    ort.env.wasm.numThreads = 1
    if (!forceCpu && self.navigator.gpu) {
      try {
        const adapter = await self.navigator.gpu.requestAdapter()
        if (adapter) return await create("webgpu")
      } catch {
        // No usable graphics card: the processor does it.
      }
    }
    return create("wasm")
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

async function upscale({ session, backend }, pixels, iw, ih, id) {
  const ow = iw * SCALE
  const oh = ih * SCALE
  const out = new ImageData(ow, oh)
  const od = out.data
  const cols = Math.ceil(iw / CORE)
  const rows = Math.ceil(ih / CORE)
  const total = cols * rows
  const plane = TILE * TILE
  const OT = TILE * SCALE
  const oplane = OT * OT
  const input = new Float32Array(3 * plane)
  const inName = session.inputNames[0]
  const outName = session.outputNames[0]
  let done = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cancelled.has(id)) throw Object.assign(new Error("Cancelled"), { cancelled: true })
      const cx = c * CORE
      const cy = r * CORE
      const cw = Math.min(CORE, iw - cx)
      const ch = Math.min(CORE, ih - cy)
      // The piece with its overlap; past the photo's edge the edge pixels repeat.
      for (let ty = 0; ty < TILE; ty++) {
        const row = clamp(cy - PAD + ty, 0, ih - 1) * iw
        for (let tx = 0; tx < TILE; tx++) {
          const p = (row + clamp(cx - PAD + tx, 0, iw - 1)) * 4
          const t = ty * TILE + tx
          input[t] = pixels[p] / 255
          input[plane + t] = pixels[p + 1] / 255
          input[2 * plane + t] = pixels[p + 2] / 255
        }
      }
      const result = await session.run({ [inName]: new ort.Tensor("float32", input, [1, 3, TILE, TILE]) })
      const tensor = result[outName]
      const o = tensor.data
      // Keep only the piece's own part (without the overlap).
      for (let y = 0; y < ch * SCALE; y++) {
        const q0 = (PAD * SCALE + y) * OT + PAD * SCALE
        let d = ((cy * SCALE + y) * ow + cx * SCALE) * 4
        for (let x = 0; x < cw * SCALE; x++, d += 4) {
          const q = q0 + x
          od[d] = o[q] * 255
          od[d + 1] = o[oplane + q] * 255
          od[d + 2] = o[2 * oplane + q] * 255
          od[d + 3] = 255
        }
      }
      if (typeof tensor.dispose === "function") tensor.dispose()
      done++
      self.postMessage({ type: "progress", id, done, total, backend })
    }
  }
  return out
}

async function enhance(msg) {
  const { id, blob } = msg
  const maxInput = msg.maxInput || 600
  const maxOutput = msg.maxOutput || 2400
  const quality = msg.quality || 0.92
  const started = performance.now()
  const bitmap = await createImageBitmap(blob)
  const from = { width: bitmap.width, height: bitmap.height }
  // Big photos are brought down first (the model makes them 4x bigger again).
  const s = Math.min(1, maxInput / Math.max(from.width, from.height))
  const iw = Math.max(1, Math.round(from.width * s))
  const ih = Math.max(1, Math.round(from.height * s))
  const source = new OffscreenCanvas(iw, ih)
  const sctx = source.getContext("2d", { willReadFrequently: true })
  sctx.fillStyle = "#ffffff"
  sctx.fillRect(0, 0, iw, ih)
  sctx.imageSmoothingQuality = "high"
  sctx.drawImage(bitmap, 0, 0, iw, ih)
  bitmap.close()
  const pixels = sctx.getImageData(0, 0, iw, ih).data

  let model = await load(false)
  let image
  try {
    image = await upscale(model, pixels, iw, ih, id)
  } catch (e) {
    if (e && e.cancelled) throw e
    if (model.backend !== "webgpu") throw e
    // The graphics card couldn't do it: the processor can.
    model = await load(true)
    image = await upscale(model, pixels, iw, ih, id)
  }

  let canvas = new OffscreenCanvas(image.width, image.height)
  canvas.getContext("2d").putImageData(image, 0, 0)
  const f = Math.min(1, maxOutput / Math.max(image.width, image.height))
  if (f < 1) {
    const small = new OffscreenCanvas(Math.round(image.width * f), Math.round(image.height * f))
    const ctx = small.getContext("2d")
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(canvas, 0, 0, small.width, small.height)
    canvas = small
  }
  const out = await canvas.convertToBlob({ type: "image/jpeg", quality })
  return { blob: out, width: canvas.width, height: canvas.height, backend: model.backend, ms: Math.round(performance.now() - started), from }
}

self.onmessage = async (event) => {
  const msg = event.data || {}
  if (msg.type === "cancel") {
    cancelled.add(msg.id)
    return
  }
  try {
    if (msg.type === "warmup") {
      const { backend } = await load(false)
      self.postMessage({ type: "ready", id: msg.id, backend })
    } else if (msg.type === "enhance") {
      const result = await enhance(msg)
      self.postMessage({ type: "done", id: msg.id, ...result })
    }
  } catch (e) {
    self.postMessage({ type: "error", id: msg.id, message: (e && e.message) || String(e), cancelled: !!(e && e.cancelled) })
  } finally {
    cancelled.delete(msg.id)
  }
}
