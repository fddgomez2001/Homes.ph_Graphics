"use client"

import { useEffect, useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getDesktop } from "@/lib/desktop"
import { THEME_KEY } from "@/lib/theme-script"
import { cn } from "@/lib/utils"

export type Theme = "dark" | "light"

const listeners = new Set<() => void>()

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  // Switch every color at once (no element fading on its own transition).
  root.setAttribute("data-theme-switching", "")
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute("data-theme-switching")))
  void getDesktop()?.setTheme?.(theme).catch(() => {})
  listeners.forEach((listener) => listener())
}

/** Saves the choice on this device and applies it to every open window. */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // storage blocked: still switch for this page
  }
  applyTheme(theme)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another window (the desktop app's floating editor, another tab) switched.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) applyTheme(e.newValue === "light" ? "light" : "dark")
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "dark")
}

/** Keeps windows in step and tells the desktop app (title bar, window background). */
export function ThemeSync() {
  const theme = useTheme()
  useEffect(() => {
    void getDesktop()?.setTheme?.(theme).catch(() => {})
  }, [theme])
  return null
}

/** Sun / moon button: one click between dark and light mode. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme()
  const next: Theme = theme === "dark" ? "light" : "dark"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-muted-foreground hover:text-foreground", className)}
          onClick={() => setTheme(next)}
          aria-label={next === "light" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{next === "light" ? "Light mode" : "Dark mode"}</TooltipContent>
    </Tooltip>
  )
}
