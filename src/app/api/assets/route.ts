import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { CloudinaryError, forgetStatus, getCloudinaryConfig, missingCloudinaryVars, uploadOriginal } from "@/lib/cloudinary/server"
import { MAX_UPLOAD_BYTES } from "@/lib/design/constants"
import { detectImageType } from "@/lib/image-validation"
import { getRequestUser } from "@/lib/supabase/server"
import type { AssetRow } from "@/lib/types"

const MULTIPART_OVERHEAD = 256 * 1024

/**
 * Uploads an original image to Cloudinary and records it in the user's library.
 * - Requires a signed-in user (verified with Supabase Auth).
 * - Validates size and the real file type (magic bytes), not the client's claim.
 * - Deduplicates by SHA-256: re-uploading the same file returns the existing asset.
 * - Never transforms or downsizes the original.
 */
export async function POST(request: Request) {
  const { supabase, user } = await getRequestUser()
  if (!user) return error(401, "Please sign in again.")

  const config = getCloudinaryConfig()
  if (!config) {
    return error(
      503,
      `Image uploads aren't set up yet. Add ${missingCloudinaryVars().join(", ")} to .env.local and restart the app.`,
      "cloudinary_not_configured",
    )
  }

  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD) {
    return error(413, `Images can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return error(400, "The upload was incomplete. Please try again.")
  }
  const file = form.get("file")
  if (!(file instanceof File)) return error(400, "No image was attached.")
  if (file.size === 0) return error(400, "The image file is empty.")
  if (file.size > MAX_UPLOAD_BYTES) return error(413, `Images can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detected = detectImageType(bytes)
  if (!detected) return error(415, "Only JPG, PNG and WebP images are supported.")

  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const filename = sanitizeFilename(file.name) || `image.${detected.format}`

  const existing = await supabase.from("carousel_assets").select("*").eq("sha256", sha256).maybeSingle<AssetRow>()
  if (existing.error) return databaseError(existing.error)
  if (existing.data) return NextResponse.json({ asset: existing.data, duplicate: true })

  let uploaded
  try {
    uploaded = await uploadOriginal(
      config,
      { bytes, filename, mime: detected.mime },
      `${config.folder}/${user.id}/${sha256.slice(0, 40)}`,
    )
  } catch (e) {
    forgetStatus()
    const message = e instanceof CloudinaryError ? e.message : "Could not reach Cloudinary."
    return error(502, `Upload to Cloudinary failed: ${message}`)
  }

  const insert = await supabase
    .from("carousel_assets")
    .insert({
      cloudinary_public_id: uploaded.public_id,
      secure_url: uploaded.secure_url,
      original_filename: filename,
      format: uploaded.format,
      width: uploaded.width,
      height: uploaded.height,
      bytes: uploaded.bytes,
      sha256,
    })
    .select("*")
    .single<AssetRow>()

  if (insert.error) {
    // Same file uploaded twice at the same time: return the row that won.
    if (insert.error.code === "23505") {
      const again = await supabase.from("carousel_assets").select("*").eq("sha256", sha256).maybeSingle<AssetRow>()
      if (again.data) return NextResponse.json({ asset: again.data, duplicate: true })
    }
    return databaseError(insert.error)
  }
  return NextResponse.json({ asset: insert.data, duplicate: false }, { status: 201 })
}

function sanitizeFilename(name: string) {
  return name.replace(/[\\/\u0000-\u001f]/g, "").trim().slice(0, 200)
}

function error(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status })
}

function databaseError(e: { code?: string; message: string }) {
  if (e.code === "PGRST205" || e.code === "42P01") {
    return error(503, "The database tables are missing. Run the Supabase migration first (see README).", "schema_missing")
  }
  return error(500, `Database error: ${e.message}`)
}
