"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Database, LogOut, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { clearCache } from "@/lib/cache"
import { DataError } from "@/lib/data/errors"
import { checkSchema } from "@/lib/data/projects"
import { isSupabaseConfigured } from "@/lib/env"
import { loginHref } from "@/lib/routes"
import { getSupabase } from "@/lib/supabase/client"
import { errorMessage } from "@/lib/utils"

type SetupState = "checking" | "ok" | "env" | "schema" | { error: string; email?: string }

/** Back to the sign-in page (then here again). */
function useSignInAgain() {
  const router = useRouter()
  return async (reason: string) => {
    await clearCache().catch(() => {})
    await getSupabase()
      .auth.signOut({ scope: "local" })
      .catch(() => {})
    const next = `${window.location.pathname}${window.location.search}`
    router.replace(loginHref({ next, error: reason }))
  }
}

let cachedOk = false

/**
 * Shows clear setup instructions instead of empty screens when Supabase is not
 * configured or the migration hasn't been run yet. Renders the app optimistically.
 */
export function SetupGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SetupState>(() => (cachedOk ? "ok" : !isSupabaseConfigured() ? "env" : "checking"))
  const signInAgain = useSignInAgain()

  useEffect(() => {
    if (cachedOk || !isSupabaseConfigured()) return
    checkSchema()
      .then((result) => {
        cachedOk = result === "ok"
        setState(result === "ok" ? "ok" : "schema")
      })
      .catch(async (e) => {
        // "Permission denied" almost always means the sign-in is missing or expired
        // (the database then sees an anonymous visitor): sign in again.
        if (e instanceof DataError && e.code === "forbidden") {
          const { data } = await getSupabase()
            .auth.getUser()
            .catch(() => ({ data: { user: null } }))
          if (!data.user) return signInAgain("Your sign-in has expired. Please sign in again.")
          return setState({
            error: "You're signed in, but the database refused access. Run the SQL migrations in Supabase again (README → Supabase setup; they're safe to re-run), then reload.",
            email: data.user.email ?? undefined,
          })
        }
        setState({ error: errorMessage(e) })
      })
    // runs once on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === "ok" || state === "checking") return <>{children}</>

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">
          {state === "schema" ? <Database className="size-5" /> : <AlertTriangle className="size-5" />}
        </span>
        <h2 className="text-lg font-semibold">
          {state === "env" ? "Connect Supabase" : state === "schema" ? "Set up the database" : "Can't reach the database"}
        </h2>
      </div>
      {state === "env" && (
        <p className="text-sm text-muted-foreground">
          Add <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then
          restart <code>npm run dev</code>.
        </p>
      )}
      {state === "schema" && (
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Open your Supabase project → SQL Editor → New query.</li>
          <li>
            Paste the contents of{" "}
            <code className="rounded bg-muted px-1">supabase/migrations/20261029000000_daily_carousel_maker.sql</code> and
            click Run.
          </li>
          <li>Come back here and reload.</li>
        </ol>
      )}
      {typeof state === "object" && <p className="text-sm text-destructive">{state.error}</p>}
      {typeof state === "object" && state.email && <p className="text-sm text-muted-foreground">Signed in as {state.email}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw /> Reload
        </Button>
        {typeof state === "object" && (
          <Button variant="outline" onClick={() => void signInAgain("Signed out. Sign in again to continue.")}>
            <LogOut /> Sign in again
          </Button>
        )}
      </div>
    </div>
  )
}
