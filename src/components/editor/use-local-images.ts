"use client"

import { useEffect } from "react"
import { imageEvents, registerOpenProject, usePendingImageSync } from "@/lib/image-sync"
import { localSrc, type UploadedImage } from "@/lib/local-images"
import type { EditorStore } from "./store"

/**
 * While a carousel is open: images that finish uploading in the background
 * (retries) replace their local copies in the slides, which then autosave.
 */
export function useLocalImages(store: EditorStore) {
  usePendingImageSync()
  useEffect(() => {
    const unregister = registerOpenProject(store.getState().project.id)
    const onUploaded = (e: Event) => {
      const { sha, ...stored } = (e as CustomEvent<UploadedImage>).detail
      const s = store.getState()
      s.resolveLocal(localSrc(sha), stored)
      for (const u of Object.values(s.uploads)) if (u.sha === sha && u.status === "local") s.setUpload(u.id, { status: "done", progress: 1 })
    }
    imageEvents.addEventListener("uploaded", onUploaded)
    return () => {
      unregister()
      imageEvents.removeEventListener("uploaded", onUploaded)
    }
  }, [store])
}
