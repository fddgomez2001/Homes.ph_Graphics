"use client"

import { Capacitor, registerPlugin } from "@capacitor/core"
import { errorMessage } from "@/lib/utils"

/** The Android app's own plugin (android/app/src/main/java/…/GalleryPlugin.java). */
interface GalleryPlugin {
  save(options: { folder: string; name: string; data: string; mimeType: string }): Promise<{ uri: string }>
}

const Gallery = registerPlugin<GalleryPlugin>("Gallery")

export interface NativeFile {
  name: string
  blob: Blob
}

/** Running inside the installed phone app (not a browser). */
export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "")
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the image"))
    reader.readAsDataURL(blob)
  })
}

function download(files: NativeFile[]) {
  for (const file of files) {
    const url = URL.createObjectURL(file.blob)
    const a = Object.assign(document.createElement("a"), { href: url, download: file.name, rel: "noopener" })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

/**
 * Saves images to the phone's gallery, in Pictures/Homes.ph/<folder>, so they
 * can be picked straight from Facebook. Returns the album shown to the user.
 */
export async function saveToGallery(files: NativeFile[], folder?: string): Promise<string> {
  const album = ["Homes.ph", folder].filter(Boolean).join("/")
  if (!isNativeApp()) {
    download(files)
    return "Downloads"
  }
  for (const file of files) {
    await Gallery.save({ folder: album, name: file.name, data: await toBase64(file.blob), mimeType: file.blob.type || "image/png" })
  }
  return `Pictures/${album}`
}

/** Opens the share sheet (Facebook, Messenger, Drive…) with the images. */
export async function shareFiles(files: NativeFile[], title: string): Promise<void> {
  if (!isNativeApp()) {
    const shared = files.map((f) => new File([f.blob], f.name, { type: f.blob.type || "image/png" }))
    if (navigator.canShare?.({ files: shared })) {
      await navigator.share({ files: shared, title }).catch((e) => {
        if ((e as Error).name !== "AbortError") throw e
      })
    } else download(files)
    return
  }
  const { Directory, Filesystem } = await import("@capacitor/filesystem")
  const { Share } = await import("@capacitor/share")
  // Only the latest share is kept in the app's cache.
  await Filesystem.rmdir({ path: "share", directory: Directory.Cache, recursive: true }).catch(() => {})
  const uris: string[] = []
  for (const file of files) {
    const { uri } = await Filesystem.writeFile({ path: `share/${file.name}`, data: await toBase64(file.blob), directory: Directory.Cache, recursive: true })
    uris.push(uri)
  }
  try {
    await Share.share({ title, dialogTitle: title, files: uris })
  } catch (e) {
    if (!/cancel/i.test(errorMessage(e))) throw e
  }
}

/** Copies text, with the phone's clipboard inside the app. */
export async function copyText(text: string): Promise<void> {
  if (isNativeApp()) {
    const { Clipboard } = await import("@capacitor/clipboard")
    await Clipboard.write({ string: text })
    return
  }
  await navigator.clipboard.writeText(text)
}
