import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"

/** Completes email confirmation, magic-link sign-in and PKCE code exchange. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const nextParam = url.searchParams.get("next")
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home"
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as EmailOtpType | null

  const supabase = await createServerSupabase()
  let errorText: string | null = url.searchParams.get("error_description")

  if (!errorText && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) errorText = error.message
  } else if (!errorText && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) errorText = error.message
  } else if (!errorText) {
    errorText = "This sign-in link is incomplete."
  }

  const target = new URL(errorText ? "/login" : next, url.origin)
  if (errorText) target.searchParams.set("error", `Sign-in link failed: ${errorText}. Request a new link.`)
  return NextResponse.redirect(target)
}
