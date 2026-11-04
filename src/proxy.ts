import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { IS_WEBSITE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env"

const PUBLIC_PATHS = ["/login", "/auth"]
/** The website deployment (SITE_MODE=website) serves only these. */
const WEBSITE_PATHS = ["/site", "/checklist", ...PUBLIC_PATHS]
const HOME = IS_WEBSITE ? "/site" : "/home"

const under = (pathname: string, paths: string[]) => paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
/**
 * This project's session cookie ("sb-<project ref>-auth-token", split into .0, .1… when large).
 * A cookie left by another Supabase project on the same address is not a sign-in here.
 */
const PROJECT_REF = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split(".")[0] : ""
const isAuthCookie = (name: string) => name === `sb-${PROJECT_REF}-auth-token` || name.startsWith(`sb-${PROJECT_REF}-auth-token.`)

/**
 * Sends signed-out visitors to /login. Optimistic and instant: it only looks
 * for the Supabase session cookie (no network call on every page). Security
 * does not depend on it — every data read/write is enforced by Row Level
 * Security, Route Handlers verify the user themselves, and the browser client
 * refreshes or clears the session (which signs out to /login).
 * Only /login verifies the session, to send signed-in users on to the app.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  // The website has no editor: everything else leads to the carousels.
  if (IS_WEBSITE && !under(pathname, WEBSITE_PATHS)) {
    const url = request.nextUrl.clone()
    url.pathname = "/site"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Without configuration the pages render a setup screen instead.
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return NextResponse.next({ request })

  const isPublic = under(pathname, PUBLIC_PATHS)

  if (!isPublic) {
    const hasSession = request.cookies.getAll().some((c) => isAuthCookie(c.name) && c.value.length > 0)
    if (hasSession) return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  if (pathname !== "/login") return NextResponse.next({ request })

  let response = NextResponse.next({ request })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value)
      },
    },
  })
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) return response

  const url = request.nextUrl.clone()
  url.pathname = HOME
  url.search = ""
  const redirect = NextResponse.redirect(url)
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}

export const config = {
  // Skip static assets and API routes (Route Handlers authenticate on their own,
  // and skipping them avoids the proxy's request-body buffering limit on uploads).
  matcher: [
    "/((?!_next/static|_next/image|api/|brand/|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
}
