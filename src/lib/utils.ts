export { cn } from "cn"

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

export function slugify(input: string, fallback = "carousel"): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || fallback
}

/** Short random id for design elements (unique within a slide). */
export function shortId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("")
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (!error) return fallback
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message || fallback
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback
  }
  return fallback
}
