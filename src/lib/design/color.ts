export interface ParsedColor {
  /** #RRGGBB */
  hex: string
  /** 0–1 */
  alpha: number
}

/** Parses #RGB, #RRGGBB, #RRGGBBAA, rgb() and rgba(). Unknown input → opaque black. */
export function parseColor(input: string | null | undefined): ParsedColor {
  const value = (input ?? "").trim().toLowerCase()
  if (value === "transparent") return { hex: "#000000", alpha: 0 }
  const hex = value.match(/^#([0-9a-f]{3,8})$/)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("")
    if (h.length === 6) return { hex: `#${h}`.toUpperCase(), alpha: 1 }
    if (h.length === 8) return { hex: `#${h.slice(0, 6)}`.toUpperCase(), alpha: round(parseInt(h.slice(6), 16) / 255) }
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/)
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => clampByte(Number(n)))
    let alpha = 1
    if (rgb[4] != null) alpha = rgb[4].endsWith("%") ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4])
    return { hex: toHex(r, g, b), alpha: round(Math.min(1, Math.max(0, alpha))) }
  }
  return { hex: "#000000", alpha: 1 }
}

/** Builds a color string: #RRGGBB when opaque, rgba() otherwise. */
export function formatColor(hex: string, alpha: number): string {
  const parsed = parseColor(hex)
  const a = Math.min(1, Math.max(0, alpha))
  if (a >= 1) return parsed.hex
  const n = parseInt(parsed.hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${round(a)})`
}

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase()
}

function clampByte(n: number) {
  return Math.min(255, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)))
}

function round(n: number) {
  return Math.round(n * 1000) / 1000
}
