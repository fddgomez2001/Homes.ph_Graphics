import "server-only"

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { CloudinaryError, destroyAsset, forgetStatus, getCloudinaryConfig, missingCloudinaryVars, uploadOriginal } from "@/lib/cloudinary/server"
import { MAX_UPLOAD_BYTES } from "@/lib/design/constants"
import { detectImageType, imageDimensions } from "@/lib/image-validation"
import { photosInCloudinary } from "./setup"
import { LOCAL_USER_ID } from "./shared"
import { addAsset, findAssetBySha, imagesDir, LOCAL_FILE_URL, removeAsset } from "./store"

const error = (status: number, message: string, code?: string) => NextResponse.json({ error: message, code }, { status })

/**
 * Saves an uploaded photo for the desktop app without an account: in the app's folder
 * (images\), or in the person's own Cloudinary when they chose it in the welcome setup. Same
 * checks as the cloud upload (size, real file type, the same file only once).
 */
export async function localUpload(request: Request) {
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
  const filename = file.name.replace(/[\\/\u0000-\u001f]/g, "").trim().slice(0, 200) || `image.${detected.format}`

  try {
    const existing = findAssetBySha(sha256)
    if (existing) return NextResponse.json({ asset: existing, duplicate: true })

    if (photosInCloudinary()) {
      const config = getCloudinaryConfig()
      if (!config) return error(503, `Your Cloudinary isn't connected yet (${missingCloudinaryVars().join(", ")}). Settings → Where your work is saved.`, "cloudinary_not_configured")
      let uploaded
      try {
        uploaded = await uploadOriginal(config, { bytes, filename, mime: detected.mime }, `${config.folder}/${LOCAL_USER_ID}/${sha256.slice(0, 40)}`)
      } catch (e) {
        forgetStatus()
        return error(502, `Upload to Cloudinary failed: ${e instanceof CloudinaryError ? e.message : "Could not reach Cloudinary."}`)
      }
      const asset = addAsset({ cloudinary_public_id: uploaded.public_id, secure_url: uploaded.secure_url, original_filename: filename, format: uploaded.format, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, sha256 })
      return NextResponse.json({ asset, duplicate: false }, { status: 201 })
    }

    // On this computer: images\<hash>.<ext>, served by the app at /api/local/files/<name>.
    const name = `${sha256.slice(0, 40)}.${detected.format}`
    fs.writeFileSync(path.join(/*turbopackIgnore: true*/ imagesDir(), name), bytes)
    const size = imageDimensions(bytes)
    const asset = addAsset({
      cloudinary_public_id: `local/${sha256.slice(0, 40)}`,
      secure_url: `${LOCAL_FILE_URL}${name}`,
      original_filename: filename,
      format: detected.format,
      width: size?.width ?? null,
      height: size?.height ?? null,
      bytes: bytes.length,
      sha256,
    })
    return NextResponse.json({ asset, duplicate: false }, { status: 201 })
  } catch (e) {
    return error(500, `Couldn't save the photo: ${e instanceof Error ? e.message : "unknown error"}`)
  }
}

/** Deletes a photo from the library (and its file, or its Cloudinary copy). */
export async function localDelete(id: string) {
  try {
    const asset = removeAsset(id)
    if (!asset) return error(404, "Image not found.")
    if (asset.cloudinary_public_id.startsWith("local/")) {
      const name = asset.secure_url.slice(LOCAL_FILE_URL.length)
      if (/^[A-Za-z0-9._-]+$/.test(name)) fs.rmSync(path.join(/*turbopackIgnore: true*/ imagesDir(), name), { force: true })
    } else {
      const config = getCloudinaryConfig()
      if (config) await destroyAsset(config, asset.cloudinary_public_id).catch(() => {})
    }
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "Couldn't delete the photo.")
  }
}
