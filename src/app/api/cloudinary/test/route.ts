import { NextResponse } from "next/server"
import { CloudinaryError, destroyAsset, forgetStatus, getCloudinaryConfig, uploadOriginal } from "@/lib/cloudinary/server"
import type { UploadTestResult } from "@/lib/cloudinary/types"
import { getRequestUser } from "@/lib/supabase/server"

/** A 1 × 1 transparent PNG. */
const TINY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
)

const recent = new Map<string, number[]>()

/**
 * Settings → Test upload: proves the configured key may upload (and delete) by
 * storing a tiny image in the user's folder and removing it again.
 * Signed-in users only, at most 5 tests a minute.
 */
export async function POST() {
  const { user } = await getRequestUser()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  const config = getCloudinaryConfig()
  if (!config) return NextResponse.json({ error: "Cloudinary isn't set up yet." }, { status: 503 })

  const now = Date.now()
  const hits = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= 5) return NextResponse.json({ error: "Please wait a minute before testing again." }, { status: 429 })
  recent.set(user.id, [...hits, now])

  const message = (e: unknown) => (e instanceof CloudinaryError ? e.message : "Could not reach Cloudinary.")
  const publicId = `${config.folder}/${user.id}/_connection-test-${now}`
  const result: UploadTestResult = { upload: { ok: true } }
  try {
    await uploadOriginal(config, { bytes: TINY_PNG, filename: "connection-test.png", mime: "image/png" }, publicId)
  } catch (e) {
    forgetStatus()
    result.upload = { ok: false, error: message(e) }
    return NextResponse.json(result)
  }
  try {
    await destroyAsset(config, publicId)
    result.remove = { ok: true }
  } catch (e) {
    result.remove = { ok: false, error: message(e) }
  }
  return NextResponse.json(result)
}
