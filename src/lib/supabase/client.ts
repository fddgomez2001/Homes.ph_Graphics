"use client"

import { createBrowserClient } from "@supabase/ssr"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { IS_MOBILE_APP, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env"

let client: SupabaseClient | null = null

/** Browser Supabase client. Uses the publishable key; data access is enforced by RLS. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      )
    }
    // The phone app has no server to read cookies: it keeps the session in its own storage.
    client = IS_MOBILE_APP
      ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
      : createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  }
  return client
}
