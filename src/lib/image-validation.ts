import { ACCEPTED_IMAGE_EXTENSIONS, ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/design/constants"

export interface DetectedImage {
  mime: "image/png" | "image/jpeg" | "image/webp"
  format: "png" | "jpg" | "webp"
}

/** Identifies PNG, JPEG and WebP by their magic bytes (never trusts the file name or MIME header). */
export function detectImageType(bytes: Uint8Array): DetectedImage | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) {
    return { mime: "image/png", format: "png" }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", format: "jpg" }
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", format: "webp" }
  }
  return null
}

/** The picture's width and height from its header (PNG, JPEG, WebP), or null when it can't be read. */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const be16 = (i: number) => (bytes[i] << 8) | bytes[i + 1]
  const be32 = (i: number) => ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0
  const le16 = (i: number) => bytes[i] | (bytes[i + 1] << 8)
  const le24 = (i: number) => bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16)
  const type = detectImageType(bytes)
  if (!type) return null
  if (type.format === "png" && bytes.length >= 24) return { width: be32(16), height: be32(20) }
  if (type.format === "jpg") {
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++
        continue
      }
      const marker = bytes[i + 1]
      // Start of frame (not DHT, JPG or DAC): its height and width.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: be16(i + 7), height: be16(i + 5) }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
        i += marker === 0xff ? 1 : 2
        continue
      }
      i += 2 + be16(i + 2)
    }
    return null
  }
  if (type.format === "webp" && bytes.length >= 30) {
    const chunk = ascii(bytes, 12, 16)
    if (chunk === "VP8 ") return { width: le16(26) & 0x3fff, height: le16(28) & 0x3fff }
    if (chunk === "VP8L") {
      const b = bytes.subarray(21, 25)
      return { width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) }
    }
    if (chunk === "VP8X") return { width: 1 + le24(24), height: 1 + le24(27) }
  }
  return null
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end))
}

/** Quick client-side check before uploading. The server re-validates the actual bytes. */
export function checkImageFile(file: { name: string; type: string; size: number }): string | null {
  const name = file.name.toLowerCase()
  const typeOk = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
  const extOk = ACCEPTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
  if (!typeOk && !extOk) return `"${file.name}" isn't a supported image. Use JPG, PNG or WebP.`
  if (file.size === 0) return `"${file.name}" is empty.`
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
  }
  return null
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || ACCEPTED_IMAGE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
}
