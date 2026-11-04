import { BLUE_LOGO_SCALE, LOGO_BLUE_SRC, LOGO_LIGHT_THRESHOLD, LOGO_NATURAL, LOGO_WHITE_SRC } from "./constants"
import type { ImageElement } from "./types"

export type ResolvedLogo = "white" | "blue"

/** Image fields for showing the white or blue Homes.ph logo. */
export function logoSource(variant: ResolvedLogo) {
  return {
    src: variant === "blue" ? LOGO_BLUE_SRC : LOGO_WHITE_SRC,
    naturalWidth: LOGO_NATURAL[variant].width,
    naturalHeight: LOGO_NATURAL[variant].height,
    logoResolved: variant,
  }
}

/** True for the Homes.ph logo in automatic white/blue mode. */
export function isAutoLogo(el: ImageElement): boolean {
  return el.role === "logo" && el.logoVariant === "auto"
}

/**
 * The blue artwork is drawn at 65/72 × 63/70 of the slot, centered (the white PNG
 * carries that padding itself), so both versions show the mark at the same size.
 * Returns the box to draw into, relative to the element frame.
 */
export function logoDrawBox(el: Pick<ImageElement, "width" | "height" | "logoResolved" | "role">) {
  if (el.role !== "logo" || el.logoResolved !== "blue") return { x: 0, y: 0, width: el.width, height: el.height }
  const width = el.width * BLUE_LOGO_SCALE.x
  const height = el.height * BLUE_LOGO_SCALE.y
  return { x: (el.width - width) / 2, y: (el.height - height) / 2, width, height }
}

function srgbToLinear(channel: number) {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Mean relative luminance (0 = black, 1 = white) of RGBA pixels, transparent areas counted as white. */
export function meanLuminance(rgba: Uint8ClampedArray | Uint8Array): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3] / 255
    const r = rgba[i] * a + 255 * (1 - a)
    const g = rgba[i + 1] * a + 255 * (1 - a)
    const b = rgba[i + 2] * a + 255 * (1 - a)
    sum += 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
    count++
  }
  return count ? sum / count : 1
}

/** Light backgrounds get the blue logo, dark ones the white logo. */
export function logoForLuminance(luminance: number): ResolvedLogo {
  return luminance > LOGO_LIGHT_THRESHOLD ? "blue" : "white"
}
