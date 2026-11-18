/**
 * Advertisement → Coming Soon / Now Open: the court's own logo, made like the templates' sample
 * logo: a transparent PNG with no empty margins, so it fills the logo's place. A plain background
 * (white, or any one color around the edges) can be made transparent.
 */

/** Longest side kept (the logo is at most ~430 px on the poster). */
const MAX_SIDE = 1000

/** A picture file as a PNG data URL, at most `MAX_SIDE` on its long side (the original, kept to redo the cut-out). */
export async function logoOriginal(file: Blob): Promise<string> {
  const img = await loadBlob(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/png")
}

function loadBlob(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return loadUrl(url, "That file isn't a picture the app can read.").finally(() => URL.revokeObjectURL(url))
}

function loadUrl(src: string, error = "The logo didn't load."): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error(error))
    i.src = src
  })
}

/** The logo ready for the poster: background made transparent (when asked and plain) and margins trimmed. */
export async function prepareLogo(originalDataUrl: string, removeBackground: boolean): Promise<{ dataUrl: string; removed: boolean }> {
  const img = await loadUrl(originalDataUrl)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, w, h)
  const removed = removeBackground ? clearBackground(data.data, w, h) : false
  if (removed) ctx.putImageData(data, 0, 0)
  // Trim the empty (transparent) margins.
  const box = opaqueBox(removed ? data.data : ctx.getImageData(0, 0, w, h).data, w, h)
  if (!box) return { dataUrl: canvas.toDataURL("image/png"), removed }
  const pad = Math.round(Math.max(box.w, box.h) * 0.02)
  const x = Math.max(0, box.x - pad)
  const y = Math.max(0, box.y - pad)
  const cw = Math.min(w - x, box.w + pad * 2)
  const ch = Math.min(h - y, box.h + pad * 2)
  const out = document.createElement("canvas")
  out.width = cw
  out.height = ch
  out.getContext("2d")!.drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch)
  return { dataUrl: out.toDataURL("image/png"), removed }
}

/**
 * Makes a plain background transparent: when most edge pixels are one color, every pixel of that
 * color connected to the edge goes (soft at the borders). Returns whether it did.
 */
export function clearBackground(px: Uint8ClampedArray, w: number, h: number): boolean {
  const edge: number[] = []
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1)
  // Already transparent around the edges: nothing to do.
  const clear = edge.filter((i) => px[i * 4 + 3] < 20).length
  if (clear > edge.length * 0.5) return false
  const bg = medianColor(px, edge)
  const near = edge.filter((i) => dist(px, i, bg) < 40).length
  if (near < edge.length * 0.6) return false
  const HARD = 38
  const SOFT = 70
  const seen = new Uint8Array(w * h)
  const queue: number[] = []
  for (const i of edge) {
    if (seen[i] || dist(px, i, bg) >= SOFT) continue
    seen[i] = 1
    queue.push(i)
  }
  while (queue.length) {
    const i = queue.pop()!
    const d = dist(px, i, bg)
    // Close to the background: gone; a little further: see-through, the edge stays soft.
    px[i * 4 + 3] = d < HARD ? 0 : Math.min(px[i * 4 + 3], Math.round((255 * (d - HARD)) / (SOFT - HARD)))
    if (d >= HARD) continue
    const x = i % w
    const y = (i - x) / w
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j >= 0 && !seen[j] && dist(px, j, bg) < SOFT) {
        seen[j] = 1
        queue.push(j)
      }
    }
  }
  return true
}

function medianColor(px: Uint8ClampedArray, idx: number[]): [number, number, number] {
  const ch = (o: number) => {
    const v = idx.map((i) => px[i * 4 + o]).sort((a, b) => a - b)
    return v[v.length >> 1]
  }
  return [ch(0), ch(1), ch(2)]
}

const dist = (px: Uint8ClampedArray, i: number, [r, g, b]: [number, number, number]) => Math.hypot(px[i * 4] - r, px[i * 4 + 1] - g, px[i * 4 + 2] - b)

/** The box of the pixels that show (alpha over 12), or null when none do. */
export function opaqueBox(px: Uint8ClampedArray, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
