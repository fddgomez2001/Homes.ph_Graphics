import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies, headers } from "next/headers"
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env"
import { desktopMode, fromThisApp, isLocalMode } from "@/lib/local/setup"
import { LOCAL_USER_ID } from "@/lib/local/shared"

/** Server Supabase client bound to the request's auth cookies (Route Handlers only). */
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })
}

/**
 * Returns the verified user for this request, or null. In the desktop app without an account
 * ("saved on this computer"), the person at this computer, for requests from the app's own pages.
 * `duringSetup`: also during the welcome setup (the AI routes, so the person's own key can be
 * checked before anything else exists).
 */
export async function getRequestUser(options: { duringSetup?: boolean } = {}) {
  const supabase = await createServerSupabase()
  if (isLocalMode() || (options.duringSetup && desktopMode() === "setup")) {
    // No sign-in to check: only the app's own pages count as this computer's user.
    if (!fromThisApp(await headers())) return { supabase, user: null }
    return { supabase, user: { id: LOCAL_USER_ID, email: "", user_metadata: {} } as unknown as NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]> }
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { supabase, user: null }
  return { supabase, user: data.user }
}
