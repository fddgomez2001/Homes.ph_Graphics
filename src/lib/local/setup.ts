import "server-only"

import fs from "node:fs"
import path from "node:path"

/**
 * The desktop app's first-run setup (written by the Windows app in its data folder as setup.json):
 *   - "local": no account; the work is saved in a folder on this computer;
 *   - "account": signed in to the team cloud (Supabase), like before;
 *   - not done yet: the welcome setup shows first.
 * Photos go to that folder, or to the person's own Cloudinary when they chose it.
 */
export interface DesktopSetup {
  done: boolean
  mode: "local" | "account"
  storage: { kind: "local" | "cloudinary"; folder: string }
}

let cache: { file: string; mtime: number; setup: DesktopSetup | null } | null = null

/** The setup, or null outside the desktop app (the website) or before the app wrote it. */
export function readDesktopSetup(): DesktopSetup | null {
  const dir = process.env.DCM_USER_DIR
  if (!dir) return null
  const file = path.join(/*turbopackIgnore: true*/ dir, "setup.json")
  try {
    const mtime = fs.statSync(file).mtimeMs
    if (cache && cache.file === file && cache.mtime === mtime) return cache.setup
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<DesktopSetup> & { storage?: Partial<DesktopSetup["storage"]> }
    const folder = typeof raw.storage?.folder === "string" && path.isAbsolute(raw.storage.folder) ? raw.storage.folder : ""
    const setup: DesktopSetup = {
      done: raw.done === true,
      mode: raw.mode === "account" ? "account" : "local",
      storage: { kind: raw.storage?.kind === "cloudinary" ? "cloudinary" : "local", folder },
    }
    cache = { file, mtime, setup }
    return setup
  } catch {
    return null
  }
}

/** "local" | "account" | "setup" in the desktop app; null on the website. */
export function desktopMode(): "local" | "account" | "setup" | null {
  if (!process.env.DCM_USER_DIR) return null
  const setup = readDesktopSetup()
  if (!setup) return "setup"
  return setup.done ? setup.mode : "setup"
}

/** The work is saved on this computer (no account). */
export function isLocalMode(): boolean {
  const setup = readDesktopSetup()
  return !!setup && setup.done && setup.mode === "local" && !!setup.storage.folder
}

/** Where this computer's work is saved (local mode). */
export function localFolder(): string {
  const folder = readDesktopSetup()?.storage.folder
  if (!folder) throw new Error("The app's folder isn't set up yet. Open the welcome setup again (Settings → Run the welcome setup).")
  return folder
}

/**
 * Without an account nothing signs the requests, so only the app's own pages may use the local server:
 * not a website open in a browser (another origin) and not a domain pointed at this computer (another host).
 */
export function fromThisApp(headers: Headers): boolean {
  const host = headers.get("host") ?? ""
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/i.test(host)) return false
  const origin = headers.get("origin")
  if (origin && origin.toLowerCase() !== `http://${host}`.toLowerCase()) return false
  const site = headers.get("sec-fetch-site")
  return !site || site === "same-origin" || site === "none"
}

/** Photos go to the person's own Cloudinary (local mode, when they chose it). */
export const photosInCloudinary = () => readDesktopSetup()?.storage.kind === "cloudinary"
