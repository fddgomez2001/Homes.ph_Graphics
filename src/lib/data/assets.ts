"use client"

import { invalidate } from "@/lib/cache"
import type { CloudinaryStatus, UploadTestResult } from "@/lib/cloudinary/types"
import { getSupabase } from "@/lib/supabase/client"
import type { AssetRow } from "@/lib/types"
import { DataError, toDataError } from "./errors"

export async function listAssets(search?: string): Promise<AssetRow[]> {
  let query = getSupabase().from("carousel_assets").select("*").order("created_at", { ascending: false }).limit(500)
  const term = search?.replace(/[%_*,()"'\\]/g, " ").trim()
  if (term) query = query.ilike("original_filename", `*${term}*`)
  const { data, error } = await query
  if (error) throw toDataError(error)
  return (data ?? []) as AssetRow[]
}

export class UploadError extends DataError {}

export interface UploadResult {
  asset: AssetRow
  duplicate: boolean
}

/**
 * Sends the original file (unmodified, full resolution) to the server, which
 * validates it and stores it in Cloudinary. Reports real upload progress.
 */
export function uploadAsset(file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/assets")
    xhr.responseType = "json"
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as { asset?: AssetRow; duplicate?: boolean; error?: string; code?: string }
      if (xhr.status >= 200 && xhr.status < 300 && body.asset) {
        invalidate("assets:")
        resolve({ asset: body.asset, duplicate: !!body.duplicate })
      } else {
        reject(new UploadError(body.error || `Upload failed (HTTP ${xhr.status})`, body.code, xhr.status))
      }
    }
    xhr.onerror = () => reject(new UploadError("Network error while uploading. Check your connection.", "network"))
    xhr.onabort = () => reject(new UploadError("Upload cancelled.", "aborted"))
    signal?.addEventListener("abort", () => xhr.abort())
    const form = new FormData()
    form.append("file", file, file.name || "pasted-image.png")
    xhr.send(form)
  })
}

export async function deleteAsset(id: string): Promise<void> {
  const res = await fetch(`/api/assets/${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new DataError(body.error || `Delete failed (HTTP ${res.status})`, undefined, res.status)
  }
  invalidate("assets:")
}

/** Number of slides referencing each public id (only the user's own slides are visible). */
export async function getAssetUsage(publicIds: string[]): Promise<Map<string, number>> {
  if (publicIds.length === 0) return new Map()
  const { data, error } = await getSupabase().rpc("carousel_asset_usage", { p_public_ids: publicIds })
  if (error) throw toDataError(error)
  return new Map(((data ?? []) as { public_id: string; slide_count: number }[]).map((r) => [r.public_id, Number(r.slide_count)]))
}

export interface IntegrationStatus {
  supabase: boolean
  cloudinary: boolean
  missingCloudinary: string[]
  /** AI suggestions are set up (GROQ_API_KEY). */
  ai?: boolean
}

let statusPromise: Promise<IntegrationStatus> | null = null

export function getIntegrationStatus(refresh = false): Promise<IntegrationStatus> {
  if (!statusPromise || refresh) {
    statusPromise = fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json() as Promise<IntegrationStatus>)
      .catch(() => {
        statusPromise = null
        return { supabase: true, cloudinary: false, missingCloudinary: [] }
      })
  }
  return statusPromise
}

/** Uploads a tiny test image with the configured key and deletes it again (Settings → Test upload). */
export async function testCloudinaryUpload(): Promise<UploadTestResult> {
  const res = await fetch("/api/cloudinary/test", { method: "POST" })
  const body = (await res.json().catch(() => ({}))) as UploadTestResult & { error?: string }
  if (!res.ok) throw new DataError(body.error || `HTTP ${res.status}`, undefined, res.status)
  return body
}

let cloudinaryStatus: Promise<CloudinaryStatus> | null = null
/** Every fresh check is announced, so all places that show the status stay in step. */
export const cloudinaryStatusEvents = new EventTarget()

/** Real Cloudinary check plus storage/credit usage (checked by the server; cached for 2 minutes there, cleared when an upload fails). */
export function getCloudinaryStatus(refresh = false): Promise<CloudinaryStatus> {
  if (!cloudinaryStatus || refresh) {
    cloudinaryStatus = fetch(`/api/cloudinary/usage${refresh ? "?refresh=1" : ""}`, { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new DataError(((await r.json().catch(() => ({}))) as { error?: string }).error || `HTTP ${r.status}`, undefined, r.status)
      const status = (await r.json()) as CloudinaryStatus
      cloudinaryStatusEvents.dispatchEvent(new CustomEvent<CloudinaryStatus>("status", { detail: status }))
      return status
    })
    cloudinaryStatus.catch(() => {
      cloudinaryStatus = null
    })
  }
  return cloudinaryStatus
}
