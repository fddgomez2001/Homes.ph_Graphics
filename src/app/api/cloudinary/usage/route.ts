import { NextResponse } from "next/server"
import { cachedStatus, CloudinaryError, getCloudinaryConfig, getUsage, missingCloudinaryVars, rememberStatus } from "@/lib/cloudinary/server"
import type { AppStorage, CloudinaryStatus } from "@/lib/cloudinary/types"
import { getRequestUser } from "@/lib/supabase/server"

type WithoutApp<T> = T extends unknown ? Omit<T, "app"> : never
/** The Cloudinary half of the answer (cached; the app's own numbers are per user). */
type CloudPart = WithoutApp<Extract<CloudinaryStatus, { configured: true }>>

/**
 * Checks the Cloudinary connection for real (signed-in users only) and returns
 * the account's storage and credit usage, plus what this app stored. Never
 * returns the key or secret.
 */
export async function GET(request: Request) {
  const { supabase, user } = await getRequestUser()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  const config = getCloudinaryConfig()
  if (!config) return NextResponse.json({ configured: false, missing: missingCloudinaryVars() } satisfies CloudinaryStatus)

  // What this app stored, from its own records (works whatever the key may read).
  let app: AppStorage | null = null
  const assets = await supabase.from("carousel_assets").select("bytes")
  if (!assets.error) app = { images: assets.data.length, bytes: assets.data.reduce((n, a) => n + (Number(a.bytes) || 0), 0) }

  const key = `${config.cloudName}:${config.apiKey}`
  const refresh = new URL(request.url).searchParams.has("refresh")
  let cloud = refresh ? undefined : cachedStatus<CloudPart>(key)
  if (!cloud) {
    try {
      cloud = { configured: true, ok: true, cloudName: config.cloudName, usage: await getUsage(config) }
    } catch (e) {
      const status = e instanceof CloudinaryError ? e.status : 0
      const message = e instanceof Error ? e.message : "Could not reach Cloudinary."
      if (status === 403 || /missing permissions|forbidden/i.test(message)) {
        cloud = {
          configured: true,
          ok: false,
          reason: "permission",
          cloudName: config.cloudName,
          error: message,
          hint: "This API key is valid, but Cloudinary doesn't allow it to read the account's usage report, so the exact plan totals can't be shown. Uploads use a different permission: click Test upload to check them. To show the totals, give this API key read access in Cloudinary (Settings → Role Management), then click Check.",
        }
      } else if (status) {
        const looksLikeDisplayName = /[^a-z0-9_-]/.test(config.cloudName)
        cloud = {
          configured: true,
          ok: false,
          reason: "credentials",
          cloudName: config.cloudName,
          error: message,
          hint: `Check the cloud name: open Cloudinary → Settings → API Keys and copy the "Cloud name" shown at the top exactly (lowercase, no spaces or dots), not your account's display name.${looksLikeDisplayName ? ` "${config.cloudName}" has characters a cloud name can't have.` : ""} Also check that the API key and secret belong to that cloud.`,
        }
      } else {
        cloud = {
          configured: true,
          ok: false,
          reason: "unreachable",
          cloudName: config.cloudName,
          error: "Could not reach Cloudinary.",
          hint: "Check your internet connection, then click Check.",
        }
      }
    }
    rememberStatus(key, cloud)
  }
  return NextResponse.json({ ...cloud, app } as CloudinaryStatus)
}
