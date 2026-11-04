import { Suspense } from "react"
import type { Metadata } from "next"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme/theme"
import { IS_WEBSITE } from "@/lib/env"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{IS_WEBSITE ? "Homes.ph Carousels" : "Daily Carousel Maker"}</h1>
            <p className="text-sm text-muted-foreground">{IS_WEBSITE ? "Sign in to see the carousels ready to post" : "Homes.ph social media carousels"}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-xs">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
