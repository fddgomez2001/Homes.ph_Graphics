import { NextResponse } from "next/server"
import { MAX_UPLOAD_BYTES } from "@/lib/design/constants"
import { RemoteImageError, downloadRemoteImage } from "@/lib/remote-image"
import { getRequestUser } from "@/lib/supabase/server"

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
const recent = new Map<string, number[]>()

/**
 * Downloads an image the user copied as a link (when the website blocks the
 * browser from reading it). Signed-in users only, rate limited, public
 * internet only — see downloadRemoteImage for the guards. Nothing is stored:
 * the bytes go back to the editor, which uploads them like any pasted file.
 */
export async function POST(request: Request) {
  const { user } = await getRequestUser()
  if (!user) return error(401, "Please sign in again.")

  const now = Date.now()
  const hits = (recent.get(user.id) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= MAX_PER_WINDOW) return error(429, "Too many pasted links in a minute. Please wait a moment.")
  hits.push(now)
  recent.set(user.id, hits)

  let url = ""
  try {
    const body = (await request.json()) as { url?: unknown }
    url = typeof body.url === "string" ? body.url.trim() : ""
  } catch {
    // handled below
  }
  if (!url || url.length > 4096) return error(400, "No image link was sent.")

  try {
    const { bytes, type } = await downloadRemoteImage(url, { maxBytes: MAX_UPLOAD_BYTES })
    return new Response(bytes as BodyInit, {
      headers: { "content-type": type.mime, "cache-control": "no-store", "x-content-type-options": "nosniff" },
    })
  } catch (e) {
    if (e instanceof RemoteImageError) return error(e.status, e.message)
    return error(502, "Couldn't download that image.")
  }
}

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}
