"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { ExportProvider } from "@/components/export/export-provider"
import { CreateCarouselProvider } from "@/components/projects/create-carousel-dialog"
import { Button } from "@/components/ui/button"
import { pruneCache } from "@/lib/cache"
import { usePendingImageSync } from "@/lib/image-sync"
import { SetupGate } from "./setup-gate"
import { Sidebar } from "./sidebar"

const ShellContext = createContext<{ openNav: () => void }>({ openNav: () => {} })

export function useShell() {
  return useContext(ShellContext)
}

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)

  usePendingImageSync()

  // When the app is idle: warm up the editor and the renderer, and tidy the device cache.
  useEffect(() => {
    const idle = (fn: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500))
    idle(() => {
      pruneCache()
      void import("@/components/editor/editor").catch(() => {})
      void import("@/lib/design/render").catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navOpen])

  return (
    <ShellContext.Provider value={{ openNav: () => setNavOpen(true) }}>
      <ExportProvider>
        <CreateCarouselProvider>
          <div className="flex min-h-screen">
            <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-card lg:block">
              <Sidebar />
            </aside>
            {navOpen && (
              <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
                <div className="absolute inset-0 bg-black/20" onClick={() => setNavOpen(false)} />
                <aside className="absolute inset-y-0 left-0 w-64 border-r bg-card shadow-lg">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-4 right-3"
                    onClick={() => setNavOpen(false)}
                    aria-label="Close navigation"
                  >
                    <X />
                  </Button>
                  <Sidebar onNavigate={() => setNavOpen(false)} />
                </aside>
              </div>
            )}
            <main className="flex min-w-0 flex-1 flex-col">
              <SetupGate>{children}</SetupGate>
            </main>
          </div>
        </CreateCarouselProvider>
      </ExportProvider>
    </ShellContext.Provider>
  )
}
