/** Cloudinary account status shown in Settings (no credentials, ever). */
export interface CloudinaryUsage {
  plan: string | null
  lastUpdated: string | null
  storageBytes: number
  /** Only on plans with a fixed storage quota. */
  storageLimitBytes: number | null
  bandwidthBytes: number
  /** Monthly credits (1 credit ≈ 1 GB storage, 1 GB bandwidth or 1,000 transformations). */
  credits: { used: number; limit: number; usedPercent: number } | null
  images: number | null
}

/** Originals this app stored (from the app's own records, so no extra Cloudinary permission is needed). */
export interface AppStorage {
  bytes: number
  images: number
}

export type CloudinaryStatus =
  | { configured: false; missing: string[] }
  | { configured: true; ok: true; cloudName: string; usage: CloudinaryUsage; app: AppStorage | null }
  | {
      configured: true
      ok: false
      /**
       * permission: the key works but may not read account usage (uploads can still work);
       * credentials: wrong cloud name, key or secret; unreachable: no answer from Cloudinary.
       */
      reason: "permission" | "credentials" | "unreachable"
      cloudName: string
      error: string
      hint: string
      app: AppStorage | null
    }

/** Result of Settings → Test upload: a tiny image is uploaded, then deleted again. */
export interface UploadTestResult {
  upload: { ok: boolean; error?: string }
  remove?: { ok: boolean; error?: string }
}
