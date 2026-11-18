import { NextResponse, connection } from "next/server"
import { groqConfigured } from "@/lib/ai/groq"
import { missingCloudinaryVars } from "@/lib/cloudinary/server"
import { isSupabaseConfigured } from "@/lib/env"
import { isLocalMode, photosInCloudinary } from "@/lib/local/setup"

/** Which integrations are configured. Reports variable names only — never values. */
export async function GET() {
  await connection()
  const missingCloudinary = missingCloudinaryVars()
  const local = isLocalMode()
  return NextResponse.json({
    supabase: isSupabaseConfigured(),
    // On this computer, photos are saved in the app's folder unless the person chose Cloudinary.
    cloudinary: local ? !photosInCloudinary() || missingCloudinary.length === 0 : missingCloudinary.length === 0,
    missingCloudinary: local && !photosInCloudinary() ? [] : missingCloudinary,
    ai: groqConfigured(),
    ...(local ? { local: true, localPhotos: !photosInCloudinary() } : {}),
  })
}
