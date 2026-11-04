"use client"

import { useEffect } from "react"
import { useTheme } from "@/components/theme/theme"
import { invalidateProjects } from "@/components/projects/use-projects"
import { isNativeApp } from "@/lib/native"

/** Android's Back: close an open dialog, then the carousel, then go to the first tab, then leave the app. */
function onBack(canGoBack: boolean, minimize: () => void) {
  const dialog = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-popper-content-wrapper]')
  if (dialog) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    return
  }
  const query = new URLSearchParams(window.location.search)
  if (query.has("id")) {
    if (canGoBack) window.history.back()
    else {
      query.delete("id")
      window.history.replaceState(null, "", query.size ? `/?${query}` : "/")
    }
    return
  }
  if (query.get("tab")) {
    query.delete("tab")
    window.history.replaceState(null, "", query.size ? `/?${query}` : "/")
    return
  }
  minimize()
}

/**
 * The phone around the page: status and navigation bar colors that follow the
 * theme, the Back button, the launch screen, and fresh lists when coming back.
 */
export function useNativeShell(ready: boolean) {
  const theme = useTheme()

  useEffect(() => {
    if (!isNativeApp()) return
    void import("@capacitor/core").then(({ SystemBars, SystemBarsStyle }) =>
      SystemBars.setStyle({ style: theme === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {}),
    )
  }, [theme])

  useEffect(() => {
    if (!ready || !isNativeApp()) return
    void import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}))
  }, [ready])

  useEffect(() => {
    if (!isNativeApp()) return
    let cleanup = () => {}
    let cancelled = false
    void import("@capacitor/app").then(async ({ App }) => {
      const back = await App.addListener("backButton", ({ canGoBack }) => onBack(canGoBack, () => void App.minimizeApp()))
      // Back from the background: show what changed meanwhile (cached lists refresh in place).
      const resume = await App.addListener("resume", () => invalidateProjects())
      cleanup = () => {
        void back.remove()
        void resume.remove()
      }
      if (cancelled) cleanup()
    })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [])
}
