"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HardDrive, LogOut, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearCache } from "@/lib/cache"
import { isSupabaseConfigured } from "@/lib/env"
import { loginHref } from "@/lib/routes"
import { getSupabase } from "@/lib/supabase/client"
import { useLocalMode } from "@/lib/local/use-local-mode"

export function useCurrentUserEmail() {
  const [email, setEmail] = useState<string | null>(null)
  const router = useRouter()
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = getSupabase()
    // Local session read (no network); the server still verifies every request.
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user.email ?? null)
      if (event === "SIGNED_OUT") {
        void clearCache()
        router.replace(loginHref())
      }
    })
    return () => data.subscription.unsubscribe()
  }, [router])
  return email
}

export function useSignOut() {
  const router = useRouter()
  return async () => {
    await clearCache()
    await getSupabase().auth.signOut()
    router.replace(loginHref())
    router.refresh()
  }
}

export function UserMenu() {
  const local = useLocalMode()
  if (local) return <LocalUserMenu />
  return <AccountUserMenu />
}

/** No account (desktop app): the work is saved on this computer. */
function LocalUserMenu() {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <HardDrive className="size-4" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium text-foreground">No account</div>
          <div className="text-xs text-muted-foreground">Your work is saved on this computer</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings#work-folder">
            <HardDrive /> Where your work is saved
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountUserMenu() {
  const email = useCurrentUserEmail()
  const signOut = useSignOut()
  const initial = (email?.[0] ?? "?").toUpperCase()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal">
          <div className="text-xs text-muted-foreground">Signed in as</div>
          <div className="truncate text-sm font-medium text-foreground">{email ?? "…"}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
