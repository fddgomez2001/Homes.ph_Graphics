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
