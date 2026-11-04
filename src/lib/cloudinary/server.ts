import "server-only"

import { createHash } from "node:crypto"
import type { CloudinaryUsage } from "./types"

/**
 * Minimal signed Cloudinary client. Runs only on the server: the API key and
 * secret never reach the browser (no NEXT_PUBLIC_ prefix, never returned in responses).
 */

export interface CloudinaryConfig {
  apiBase: string
  cloudName: string
  apiKey: string
  apiSecret: string
  uploadPreset?: string
  folder: string
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()
  if (!cloudName || !apiKey || !apiSecret) return null
  return {
    // Overridable for proxies or local testing; defaults to Cloudinary's API.
    apiBase: (process.env.CLOUDINARY_API_BASE_URL?.trim() || "https://api.cloudinary.com").replace(/\/+$/, ""),
    cloudName,
    apiKey,
    apiSecret,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET?.trim() || undefined,
    folder: (process.env.CLOUDINARY_FOLDER?.trim() || "homes-ph-carousel").replace(/^\/+|\/+$/g, ""),
  }
}

export function missingCloudinaryVars(): string[] {
  return ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter((k) => !process.env[k]?.trim())
}

/** Cloudinary request signature: sorted `key=value` pairs joined by `&`, plus the secret, SHA-1. */
export function signParams(params: Record<string, string | number | boolean | undefined>, apiSecret: string): string {
  const payload = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")
  return createHash("sha1").update(payload + apiSecret).digest("hex")
}

export interface CloudinaryUploadResult {
  public_id: string
  version: number
  width: number
  height: number
  format: string
  bytes: number
  secure_url: string
  original_filename?: string
  existing?: boolean
}

export class CloudinaryError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** Uploads the original bytes unchanged (no transformation, no re-encoding). */
export async function uploadOriginal(
  config: CloudinaryConfig,
  file: { bytes: Uint8Array; filename: string; mime: string },
  publicId: string,
): Promise<CloudinaryUploadResult> {
  const params = {
    public_id: publicId,
    overwrite: "false",
    allowed_formats: "jpg,png,webp",
    timestamp: Math.floor(Date.now() / 1000),
    upload_preset: config.uploadPreset,
  }
  const form = new FormData()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") form.append(key, String(value))
  }
  form.append("api_key", config.apiKey)
  form.append("signature", signParams(params, config.apiSecret))
  form.append("file", new Blob([file.bytes as BlobPart], { type: file.mime }), file.filename)

  const res = await fetch(`${config.apiBase}/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
    method: "POST",
    body: form,
  })
  const json = (await res.json().catch(() => ({}))) as CloudinaryUploadResult & { error?: { message?: string } }
  if (!res.ok || json.error) {
    throw new CloudinaryError(json.error?.message || `Cloudinary upload failed (HTTP ${res.status})`, res.status)
  }
  return json
}

/** Permanently deletes an image from Cloudinary. "not found" counts as already deleted. */
export async function destroyAsset(config: CloudinaryConfig, publicId: string): Promise<void> {
  const params = { public_id: publicId, invalidate: "true", timestamp: Math.floor(Date.now() / 1000) }
  const form = new FormData()
  for (const [key, value] of Object.entries(params)) form.append(key, String(value))
  form.append("api_key", config.apiKey)
  form.append("signature", signParams(params, config.apiSecret))
  const res = await fetch(`${config.apiBase}/v1_1/${encodeURIComponent(config.cloudName)}/image/destroy`, {
    method: "POST",
    body: form,
  })
  const json = (await res.json().catch(() => ({}))) as { result?: string; error?: { message?: string } }
  if (!res.ok || json.error || (json.result !== "ok" && json.result !== "not found")) {
    throw new CloudinaryError(json.error?.message || `Cloudinary delete failed (${json.result ?? res.status})`, res.status)
  }
}


/** Account usage from Cloudinary's Admin API. Also proves the cloud name, key and secret work together. */
export async function getUsage(config: CloudinaryConfig): Promise<CloudinaryUsage> {
  const res = await fetch(`${config.apiBase}/v1_1/${encodeURIComponent(config.cloudName)}/usage`, {
    headers: { authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  })
  type Metric = { usage?: number; limit?: number; used_percent?: number }
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string }
    plan?: string
    last_updated?: string
    storage?: Metric
    bandwidth?: Metric
    credits?: Metric
    resources?: number
    objects?: Metric
  }
  if (!res.ok || json.error) throw new CloudinaryError(json.error?.message || `Cloudinary answered ${res.status}`, res.status)
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
  const credits = json.credits && num(json.credits.limit) > 0 ? json.credits : null
  return {
    plan: json.plan ?? null,
    lastUpdated: json.last_updated ?? null,
    storageBytes: num(json.storage?.usage),
    storageLimitBytes: num(json.storage?.limit) > 0 ? num(json.storage?.limit) : null,
    bandwidthBytes: num(json.bandwidth?.usage),
    credits: credits
      ? { used: num(credits.usage), limit: num(credits.limit), usedPercent: num(credits.used_percent) || (num(credits.usage) / num(credits.limit)) * 100 }
      : null,
    images: typeof json.resources === "number" ? json.resources : typeof json.objects?.usage === "number" ? json.objects.usage : null,
  }
}

/** Last connection check, so Settings doesn't call the Admin API on every visit. */
let statusCache: { key: string; at: number; value: unknown } | null = null
const STATUS_CACHE_MS = 2 * 60_000

export function cachedStatus<T>(key: string): T | undefined {
  return statusCache && statusCache.key === key && Date.now() - statusCache.at < STATUS_CACHE_MS ? (statusCache.value as T) : undefined
}

export function rememberStatus(key: string, value: unknown) {
  statusCache = { key, at: Date.now(), value }
}

/** A failed upload means the last "connected" result can't be trusted any more. */
export function forgetStatus() {
  statusCache = null
}
