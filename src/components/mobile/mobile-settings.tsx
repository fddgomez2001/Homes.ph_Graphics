"use client"

import { useState } from "react"
import { Images, Loader2, LogOut, Moon, Sun, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useCurrentUserEmail, useSignOut } from "@/components/app-shell/user-menu"
import { BrandMark } from "@/components/brand-mark"
import { TeamSection } from "@/components/settings/team-section"
import { setTheme, useTheme } from "@/components/theme/theme"
import { Button } from "@/components/ui/button"
import { clearCache } from "@/lib/cache"
import { cn } from "@/lib/utils"

/** Account, appearance, team and this phone's saved data. */
export function MobileSettings() {
  const email = useCurrentUserEmail()
  const signOut = useSignOut()
  const theme = useTheme()
  const [busy, setBusy] = useState<"out" | "clear" | null>(null)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-5 pb-8">
      <section className="flex items-center gap-3 rounded-xl border bg-card p-4" aria-label="Account">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
          {(email?.[0] ?? "?").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-[15px] font-medium">{email ?? "…"}</p>
        </div>
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() => {
            setBusy("out")
            void signOut().finally(() => setBusy(null))
          }}
        >
          {busy === "out" ? <Loader2 className="animate-spin" /> : <LogOut />} Sign out
        </Button>
      </section>

      <section className="rounded-xl border bg-card p-4" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="font-semibold">
          Appearance
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Theme">
          {(
            [
              ["dark", "Dark", Moon],
              ["light", "Light", Sun],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              onClick={() => setTheme(id)}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
                theme === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </section>

      <TeamSection />

      <section className="rounded-xl border bg-card p-4" aria-labelledby="saving-heading">
        <h2 id="saving-heading" className="flex items-center gap-2 font-semibold">
          <Images className="size-4" /> Saved images
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Slides, news posts and reports are saved in <span className="font-medium text-foreground">Pictures/Homes.ph</span>: open Photos or Gallery →
          Albums → Homes.ph, or pick them straight from Facebook. Carousel slides are numbered in order, 1 is the cover.
        </p>
        <Button
          variant="outline"
          className="mt-3"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("clear")
            await clearCache().catch(() => {})
            setBusy(null)
            toast.success("Cleared", { description: "Carousels load fresh from the cloud next time." })
          }}
        >
          {busy === "clear" ? <Loader2 className="animate-spin" /> : <Trash2 />} Clear data saved on this phone
        </Button>
      </section>

      <footer className="flex flex-col items-center gap-2 py-4 text-center text-xs text-muted-foreground">
        <BrandMark className="size-8 opacity-80" />
        <p>
          Homes.ph Carousels {process.env.APP_VERSION ? `v${process.env.APP_VERSION}` : ""}
          <br />
          Carousels and news posts are created in the Daily Carousel Maker on the computer.
        </p>
      </footer>
    </div>
  )
}
