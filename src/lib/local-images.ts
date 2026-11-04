"use client"

/**
 * Images saved on this computer (IndexedDB, inside the app's data folder).
 *
 * Every image you add is stored here first, then uploaded to Cloudinary.
 * Until the upload succeeds, slides point at the local copy with a
 * "local:<sha256>" address, which works after restarts and offline. Cloud
 * images are also kept here after their first download, so they open
 * instantly. Only the person's own images are stored, on their own device.
 */

const DB_NAME = "dcm-images"
const STORES = ["files", "links", "pending", "uploaded"] as const
type StoreName = (typeof STORES)[number]

export const LOCAL_PREFIX = "local:"

export interface LocalFile {
  sha: string
  blob: Blob
  name: string
  type: string
  savedAt: number
}

/** An image saved here that still has to reach Cloudinary. */
export interface PendingUpload {
  sha: string
  name: string
  /** Carousels that use it (their saved slides are re-linked after the upload). */
  projectIds: string[]
  createdAt: number
  attempts: number
  lastError?: string
}

/** Where a local image ended up in Cloudinary. */
export interface UploadedImage {
  sha: string
  src: string
  assetId: string
  publicId: string
  naturalWidth?: number
  naturalHeight?: number
}

export const isLocalSrc = (src: string | null | undefined): src is `local:${string}` => !!src && src.startsWith(LOCAL_PREFIX)
export const localSrc = (sha: string) => `${LOCAL_PREFIX}${sha}`
export const shaOfLocal = (src: string) => src.slice(LOCAL_PREFIX.length)

let dbPromise: Promise<IDBDatabase | null> | null = null

function db(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
          for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name)
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    // Ask the browser not to clear these files when disk space runs low.
    void navigator.storage?.persist?.().catch(() => false)
  }
  return dbPromise
}

function run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        if (!d) return reject(new Error("This computer's image storage isn't available."))
        try {
          const req = op(d.transaction(store, mode).objectStore(store))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error ?? new Error("Image storage error"))
        } catch (error) {
          reject(error)
        }
      }),
  )
}

const get = <T>(store: StoreName, key: string) => run<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>)
const put = (store: StoreName, key: string, value: unknown) => run(store, "readwrite", (s) => s.put(value, key))
const del = (store: StoreName, key: string) => run(store, "readwrite", (s) => s.delete(key))
const all = <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>).then((r) => r ?? [])

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

/** Saves the original bytes on this computer. Returns their SHA-256 (identical files are stored once). */
export async function saveLocalImage(blob: Blob, name: string): Promise<string> {
  const sha = await sha256Hex(blob)
  if (!(await get<LocalFile>("files", sha))) {
    await put("files", sha, { sha, blob, name: name.slice(0, 200), type: blob.type || "image/png", savedAt: Date.now() } satisfies LocalFile)
  }
  return sha
}

export function getLocalFile(sha: string): Promise<LocalFile | undefined> {
  return get<LocalFile>("files", sha)
}

/** Remembers that a Cloudinary address has these bytes on this computer. */
export function linkUrl(url: string, sha: string) {
  return put("links", url, sha)
}

export async function localBlobForUrl(url: string): Promise<Blob | undefined> {
  const sha = await get<string>("links", url)
  return sha ? (await getLocalFile(sha))?.blob : undefined
}

/** Keeps a downloaded Cloudinary image on this computer. */
export async function rememberRemoteImage(url: string, blob: Blob) {
  const sha = await saveLocalImage(blob, decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() ?? "image"))
  await linkUrl(url, sha)
}

export async function addPending(sha: string, name: string, projectId?: string) {
  const existing = await get<PendingUpload>("pending", sha)
  const projectIds = [...new Set([...(existing?.projectIds ?? []), ...(projectId ? [projectId] : [])])]
  await put("pending", sha, {
    sha,
    name: name || existing?.name || "image",
    projectIds,
    createdAt: existing?.createdAt ?? Date.now(),
    attempts: existing?.attempts ?? 0,
    lastError: existing?.lastError,
  } satisfies PendingUpload)
}

export async function recordUploadFailure(sha: string, message: string) {
  const existing = await get<PendingUpload>("pending", sha)
  if (existing) await put("pending", sha, { ...existing, attempts: existing.attempts + 1, lastError: message.slice(0, 300) })
}

export function listPending(): Promise<PendingUpload[]> {
  return all<PendingUpload>("pending")
}

/** The upload finished: remember where it went and stop retrying. */
export async function markUploaded(image: UploadedImage) {
  await put("uploaded", image.sha, image)
  await linkUrl(image.src, image.sha)
  await del("pending", image.sha)
}

export function getUploaded(sha: string): Promise<UploadedImage | undefined> {
  return get<UploadedImage>("uploaded", sha)
}

/** An image deleted from the library is removed from this computer too (unless it still has to upload). */
export async function forgetUrl(url: string) {
  const sha = await get<string>("links", url)
  await del("links", url)
  if (!sha || (await get<PendingUpload>("pending", sha))) return
  await del("files", sha)
}

export interface LocalImageStats {
  files: number
  bytes: number
  pending: number
}

export async function localImageStats(): Promise<LocalImageStats> {
  const [files, pending] = await Promise.all([all<LocalFile>("files"), listPending()])
  return { files: files.length, bytes: files.reduce((n, f) => n + (f.blob?.size ?? 0), 0), pending: pending.length }
}

/** Frees space: removes local copies of images that are safely in Cloudinary. Images still waiting to upload stay. */
export async function clearUploadedCopies(): Promise<number> {
  const pending = new Set((await listPending()).map((p) => p.sha))
  const d = await db()
  if (!d) return 0
  let removed = 0
  await new Promise<void>((resolve) => {
    const tx = d.transaction(["files", "links"], "readwrite")
    const files = tx.objectStore("files")
    const links = tx.objectStore("links")
    files.openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result
      if (!cursor) return
      if (!pending.has(String(cursor.key))) {
        cursor.delete()
        removed++
      }
      cursor.continue()
    }
    links.openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result
      if (!cursor) return
      if (!pending.has(String(cursor.value))) cursor.delete()
      cursor.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  return removed
}
