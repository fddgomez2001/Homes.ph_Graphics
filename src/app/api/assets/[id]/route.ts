import { NextResponse } from "next/server"
import { CloudinaryError, destroyAsset, getCloudinaryConfig } from "@/lib/cloudinary/server"
import { getRequestUser } from "@/lib/supabase/server"

/**
 * Deliberately deletes a library asset: removes the original from Cloudinary and
 * the library row. RLS guarantees a user can only find (and so delete) their own assets.
 * Removing an image from a slide never calls this.
 */
export async function DELETE(_request: Request, context: RouteContext<"/api/assets/[id]">) {
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid asset id." }, { status: 400 })

  const { supabase, user } = await getRequestUser()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  const { data: asset, error } = await supabase
    .from("carousel_assets")
    .select("id, cloudinary_public_id")
    .eq("id", id)
    .maybeSingle<{ id: string; cloudinary_public_id: string }>()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!asset) return NextResponse.json({ error: "Image not found." }, { status: 404 })

  const config = getCloudinaryConfig()
  if (!config) {
    return NextResponse.json(
      { error: "Cloudinary isn't configured, so the original can't be deleted right now." },
      { status: 503 },
    )
  }
  try {
    await destroyAsset(config, asset.cloudinary_public_id)
  } catch (e) {
    const message = e instanceof CloudinaryError ? e.message : "Could not reach Cloudinary."
    return NextResponse.json({ error: `Cloudinary delete failed: ${message}` }, { status: 502 })
  }

  const del = await supabase.from("carousel_assets").delete().eq("id", asset.id)
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
