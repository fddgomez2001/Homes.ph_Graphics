import { NextResponse, connection } from "next/server"
import { groqConfigured } from "@/lib/ai/groq"
import { missingCloudinaryVars } from "@/lib/cloudinary/server"
import { isSupabaseConfigured } from "@/lib/env"

/** Which integrations are configured. Reports variable names only — never values. */
export async function GET() {
  await connection()
  const missingCloudinary = missingCloudinaryVars()
  return NextResponse.json({
    supabase: isSupabaseConfigured(),
    cloudinary: missingCloudinary.length === 0,
    missingCloudinary,
    ai: groqConfigured(),
  })
}
