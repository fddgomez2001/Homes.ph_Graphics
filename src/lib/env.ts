// Public (browser-safe) configuration. Next.js inlines NEXT_PUBLIC_* at build time,
// so each variable must be referenced literally.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)
}

/**
 * SITE_MODE=website deploys only the posting website (/site): carousels ready to
 * post, no editor. Read on the server (proxy, config, metadata); not a secret.
 */
export const IS_WEBSITE = process.env.SITE_MODE === "website"

/** Built into the Android app (npm run build:mobile): one static page, no server routes. */
export const IS_MOBILE_APP = process.env.NEXT_PUBLIC_MOBILE_APP === "1"
