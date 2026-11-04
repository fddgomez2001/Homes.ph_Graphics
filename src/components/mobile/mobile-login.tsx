"use client"

import { Suspense } from "react"
import { LoginForm } from "@/app/login/login-form"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme/theme"

/** Sign in with the same account as the Carousel Maker (email and password). */
export function MobileLogin({ error }: { error: string | null }) {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col bg-background px-5">
      <div className="flex justify-end pt-2">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16 duration-300 animate-in fade-in-0 slide-in-from-bottom-2">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-14" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Homes.ph Carousels</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Sign in with your Carousel Maker account</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          {/* The form reads the error from the address; keyed so a new one shows. */}
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm key={error ?? ""} />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
