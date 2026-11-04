import { IS_MOBILE_APP } from "@/lib/env"

/**
 * The sign-in screen, optionally with where to go next and why. The phone app
 * is a single page that shows sign-in itself whenever nobody is signed in.
 */
export function loginHref({ next, error }: { next?: string; error?: string } = {}) {
  const query = new URLSearchParams()
  if (next && !IS_MOBILE_APP) query.set("next", next)
  if (error) query.set("error", error)
  const base = IS_MOBILE_APP ? "/" : "/login"
  return query.size ? `${base}?${query}` : base
}

/** Where to land after signing in. */
export const HOME_PATH = IS_MOBILE_APP ? "/" : "/home"
