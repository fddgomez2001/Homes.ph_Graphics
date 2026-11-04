import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env"

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

/** Returns the verified user for this request, or null. */
export async function getRequestUser() {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { supabase, user: null }
  return { supabase, user: data.user }
}
