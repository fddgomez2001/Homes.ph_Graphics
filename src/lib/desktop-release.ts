import "server-only"

import { get, issueSignedToken, list, presignUrl } from "@vercel/blob"

/**
 * The Windows installer on the website (/graphicdesktopapp). `npm run desktop:publish`
 * uploads each new installer to a PRIVATE Vercel Blob store (the installer carries the
 * team's Cloudinary and Groq keys, so it must never be public); signed-in people get a
 * download link that works for 15 minutes.
 */

const PREFIX = "desktop/"
// "Homes.ph-SocMedSystem-Setup-1.50.0.exe" (1.50 on); "Daily-Carousel-Maker-Setup-…" before.
const FILE = /^desktop\/(?:Daily-Carousel-Maker|Homes\.ph-SocMedSystem)-Setup-(\d+)\.(\d+)\.(\d+)\.exe$/

export interface DesktopRelease {
  version: string
  pathname: string
  size: number
  uploadedAt: string
  /** "What's new" text published with it, or "". */
  notes: string
}

type Env = Record<string, string | undefined>

/** BLOB_<name>, or <PREFIX>_<name> when the store was connected with its own prefix. */
function blobEnv(env: Env, name: string): string | undefined {
  const standard = env[`BLOB_${name}`]?.trim()
  if (standard) return standard
  const pattern = new RegExp(`^BLOB\\w*_${name}$`)
  for (const [key, value] of Object.entries(env)) if (pattern.test(key) && value?.trim()) return value.trim()
  return undefined
}

/**
 * How the server reaches the private Blob store. A read-write token
 * (BLOB_READ_WRITE_TOKEN) works anywhere; a store connected the new way only gives
 * the project its id (BLOB_STORE_ID) and Vercel signs the calls itself (OIDC).
 */
export function blobCredentials(env: Env = process.env): { token: string } | { storeId: string } | null {
  const token = blobEnv(env, "READ_WRITE_TOKEN")
  if (token) return { token }
  const storeId = blobEnv(env, "STORE_ID")
  return storeId ? { storeId } : null
}

/** The website can offer the installer (a Blob store is connected to the project). */
export function desktopDownloadsConfigured(): boolean {
  return blobCredentials() !== null
}

const auth = () => blobCredentials() ?? {}

const versionParts = (pathname: string) => (FILE.exec(pathname)?.slice(1, 4) ?? []).map(Number)

function newer(a: string, b: string) {
  const [x, y] = [versionParts(a), versionParts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]
  return 0
}

async function readNotes(pathname: string): Promise<string> {
  try {
    const result = await get(pathname.replace(/\.exe$/, ".txt"), { access: "private", ...auth() })
    if (!result?.stream) return ""
    return (await new Response(result.stream).text()).slice(0, 4000)
  } catch {
    return ""
  }
}

/** Every published installer, newest first. */
export async function listDesktopReleases(): Promise<Omit<DesktopRelease, "notes">[]> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000, ...auth() })
  return blobs
    .filter((b) => FILE.test(b.pathname))
    .sort((a, b) => newer(a.pathname, b.pathname))
    .map((b) => ({ version: versionParts(b.pathname).join("."), pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt).toISOString() }))
}

export async function latestDesktopRelease(): Promise<DesktopRelease | null> {
  const [latest] = await listDesktopReleases()
  return latest ? { ...latest, notes: await readNotes(latest.pathname) } : null
}

/** A download link for one installer that works for 15 minutes. */
export async function desktopDownloadUrl(pathname: string): Promise<string> {
  const validUntil = Date.now() + 15 * 60_000
  const token = await issueSignedToken({ pathname, operations: ["get"], validUntil, ...auth() })
  const { presignedUrl } = await presignUrl(token, { operation: "get", pathname, access: "private", validUntil })
  return presignedUrl
}
