"use client"

import { useSyncExternalStore } from "react"
import type { FloatBridge } from "./float"
import type { Assignment } from "./pages"

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
  /** The welcome setup (1.35): no account and a work folder, or the team cloud. */
  setup?: {
    get: () => Promise<DesktopSetupStatus>
    save: (values: DesktopSetupChange) => Promise<DesktopSetupStatus>
    /** The assigned pages (1.50), also read by the Chrome extension. */
    setPages?: (pages: Assignment) => Promise<Assignment>
    /** Another window changed them. Returns the unsubscribe. */
    onPagesChanged?: (fn: (pages: Assignment) => void) => () => void
    chooseFolder: () => Promise<string | null>
    openFolder: () => Promise<void>
  }
  /** A copy of the AI and Tavily keys kept by the app (encrypted by Windows), restored when the page's storage is empty. */
  aiConfig?: {
    get: () => Promise<DesktopKeys | null>
    set: (value: DesktopKeys) => Promise<void>
  }
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
  /** Opens (or switches the day of) the always-on-top floating report ("yyyy-MM-dd", "" = today) (1.24). */
  openReportFloat?: (day: string) => Promise<void>
  /** Floating quick-edit window (added in 1.2). */
  float?: FloatBridge
  /** Download folder and Poster Maker folder (1.17). */
  folders?: {
    get: () => Promise<DesktopFolders>
    /** Opens the folder picker; null when cancelled. */
    choose: (kind: FolderKind) => Promise<DesktopFolders | null>
    /** Back to the default (Windows Downloads; posters: the download folder). */
    reset: (kind: FolderKind) => Promise<DesktopFolders>
    open: (kind: FolderKind) => Promise<void>
  }
  /** Saves a PNG into the Poster Maker folder (never overwrites). Returns the file's full path. */
  savePoster?: (fileName: string, bytes: Uint8Array) => Promise<string>
  /** Shows a file the Poster Maker (or the floating report) saved in File Explorer. */
  showFile?: (file: string) => Promise<void>
  /**
   * Floating report (1.25): saves an image into <report folder>\<section>\<brand>\ (D:\DAILY REPORT by default),
   * replacing the same file name. Returns the file's full path.
   */
  saveReportFile?: (section: ReportSection, brand: ReportFolderBrand | "", fileName: string, bytes: Uint8Array) => Promise<string>
  /** The Homes.ph Publisher Chrome extension (1.39): its requests are answered by the main window. */
  extension?: {
    onRequest: (callback: (request: ExtensionRequest) => void) => () => void
    reply: (id: string, ok: boolean, result: unknown) => Promise<void>
    ready: () => void
    status: () => Promise<ExtensionStatus>
    /** Copies the extension's files into Documents\Daily Carousel Maker\Chrome Extension and opens it. */
    openFolder: () => Promise<string>
    /** Disconnects every connected browser. */
    forget: () => Promise<void>
  }
}

export interface ExtensionRequest {
  id: string
  type: "news-post" | "news-status" | "carousel-day" | "carousel-images" | "carousel-posted" | "ads-day" | "ad-image" | "ad-posted" | "trends-day" | "trend-image" | "trend-texts"
  payload: Record<string, unknown>
}

export interface ExtensionStatus {
  /** The bridge's port (127.0.0.1), null when none was free. */
  port: number | null
  clients: { name: string; browser: string; origin: string; at: string; lastUsed?: string }[]
  folder: string
  copied: boolean
}

/** The person's own AI key and Tavily key, as the desktop app keeps a copy of them. */
export interface DesktopKeys {
  ai: { provider: string; key: string; model?: string } | null
  tavily: string | null
  /** Every saved AI key, one per service (1.35). */
  keys?: Record<string, { key: string; model?: string }>
  /** The keys that search but don't write: SerpApi and the Meta token (1.36). */
  search?: Partial<Record<"serpapi" | "meta", string>>
  /** The web search choice ("auto", "tavily", "perplexity", "groq", "gemini"). */
  engine?: string
}

/** The welcome setup's choices (desktop app). */
export interface DesktopSetupStatus {
  done: boolean
  /** "local": no account, the work is saved in `storage.folder`; "account": the team cloud. */
  mode: "local" | "account"
  storage: { kind: "local" | "cloudinary"; folder: string }
  defaultFolder: string
  cloudinary: { cloudName: string; hasApiKey: boolean; hasApiSecret: boolean }
  /** The assigned pages (1.50); null until the setup asked. */
  pages?: Assignment | null
}

export interface DesktopSetupChange {
  done?: boolean
  mode?: "local" | "account"
  storageKind?: "local" | "cloudinary"
  folder?: string
  cloudinary?: { cloudName?: string; apiKey?: string; apiSecret?: string }
}

export type FolderKind = "downloads" | "posters" | "report"
/** "New Article Posting", "Daily Trend News", "Carousel". */
export type ReportSection = "news" | "trends" | "carousel"
/** "Pickleplay", "FHI Global", "Homes.ph CARAGA", "Homes.ph Gensan". */
/** A report folder: a brand's, or a Homes.ph page's ("homes:Cebu" → "Homes.ph Cebu"). */
export type ReportFolderBrand = "pickleplay" | "fhi" | "caraga" | "gensan" | `homes:${string}`

export interface DesktopFolders {
  /** Where downloads go now. */
  downloads: string
  /** A folder was chosen (not Windows' Downloads). */
  downloadsChosen: boolean
  /** A chosen folder that can't be found right now (downloads go to Windows' Downloads meanwhile). */
  downloadsMissing: string
  /** Where the Poster Maker saves now. */
  posters: string
  postersChosen: boolean
  postersMissing: string
  /** Where the floating report saves its images (1.25; older apps don't say). */
  report?: string
  reportChosen?: boolean
  reportMissing?: string
  /** D:\DAILY REPORT, or DAILY REPORT in Downloads without a D: drive. */
  reportDefault?: string
  windowsDownloads: string
}

export function getDesktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { desktop?: DesktopBridge }).desktop ?? null
}

const noSubscribe = () => () => {}

/** The desktop bridge in a component: null on the server and in a browser, so the first render matches. */
export function useDesktop(): DesktopBridge | null {
  return useSyncExternalStore(noSubscribe, getDesktop, () => null)
}
