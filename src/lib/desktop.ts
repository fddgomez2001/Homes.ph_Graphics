"use client"

import type { FloatBridge } from "./float"

/** Bridge exposed by the Windows desktop app (electron/preload.cjs). Absent in a normal browser. */
export interface DesktopConfigStatus {
  cloudName: string
  hasApiKey: boolean
  hasApiSecret: boolean
  /** A Groq key for AI suggestions is saved (the key itself never leaves the main process). */
  hasGroqKey?: boolean
  configPath: string
}

export interface DesktopBridge {
  isDesktop: true
  version: string
  getConfig: () => Promise<DesktopConfigStatus>
  /** Saves Cloudinary settings, restarts the local server and reloads the window. Empty fields are left unchanged. */
  saveConfig: (values: { cloudName?: string; apiKey?: string; apiSecret?: string; groqKey?: string }) => Promise<void>
  openDataFolder: () => Promise<void>
  /** The next `count` downloads go into Downloads\<name> (1.7: "separate files" exports). */
  exportFolder?: (name: string, count: number) => Promise<void>
  /** Matches the window (title bar, background) to the app's theme (1.9). */
  setTheme?: (theme: "dark" | "light") => Promise<void>
  /** Opens (or switches) the always-on-top posting checklist window (1.10). */
  openChecklist?: (projectId: string) => Promise<void>
  /** Floating quick-edit window (added in 1.2). */
  float?: FloatBridge
}

export function getDesktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { desktop?: DesktopBridge }).desktop ?? null
}
