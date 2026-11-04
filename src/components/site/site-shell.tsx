"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { LogOut } from "lucide-react"
import { SetupGate } from "@/components/app-shell/setup-gate"
import { useCurrentUserEmail, useSignOut } from "@/components/app-shell/user-menu"
import { BrandMark } from "@/components/brand-mark"
import { ExportProvider } from "@/components/export/export-provider"
import { ThemeToggle } from "@/components/theme/theme"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { pruneCache } from "@/lib/cache"

/**
 * The posting website: carousels ready to post, no editor. Light and calm — a
 * header with the Homes.ph mark and the account menu, the page underneath.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const idle = (fn: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500))
    idle(() => {
      pruneCache()
      void import("@/lib/design/render").catch(() => {})
    })
  }, [])

  return (
    <ExportProvider>
      <div className="min-h-screen bg-[#F6F7FA] dark:bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <Link href="/site" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <BrandMark className="size-8" />
              <span className="leading-tight">
                <span className="block text-[15px] font-semibold tracking-tight">Homes.ph</span>
                <span className="block text-xs text-muted-foreground">Carousels ready to post</span>
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <SiteUserMenu />
            </div>
          </div>
        </header>
        <SetupGate>{children}</SetupGate>
      </div>
    </ExportProvider>
  )
}

function SiteUserMenu() {
  const email = useCurrentUserEmail()
  const signOut = useSignOut()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {(email?.[0] ?? "?").toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal">
          <div className="text-xs text-muted-foreground">Signed in as</div>
          <div className="truncate text-sm font-medium text-foreground">{email ?? "…"}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
