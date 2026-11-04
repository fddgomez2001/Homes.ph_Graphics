"use client"

import { useEffect } from "react"
import { renderThumbnail } from "@/lib/design/render"
import type { SlideDesign } from "@/lib/design/types"
import type { EditorStore } from "./store"

/** Keeps small slide-strip previews in sync with the designs (rendered one at a time, debounced). */
export function useSlideThumbnails(store: EditorStore) {
  useEffect(() => {
    const rendered = new Map<string, SlideDesign>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let disposed = false

    const pending = () => store.getState().slides.find((sl) => rendered.get(sl.id) !== sl.design)

    const run = async () => {
      if (running) return
      running = true
      try {
        for (let next = pending(); next && !disposed; next = pending()) {
          rendered.set(next.id, next.design)
          try {
            const url = await renderThumbnail(next.design, 220, 0.78)
            if (!disposed) store.getState().setThumbnail(next.id, url)
          } catch {
            // Previews are best effort.
          }
        }
      } finally {
        running = false
      }
    }

    const schedule = (delay = 450) => {
      clearTimeout(timer)
      timer = setTimeout(() => void run(), delay)
    }

    schedule(50)
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.slides !== prev.slides) schedule()
    })
    return () => {
      disposed = true
      unsubscribe()
      clearTimeout(timer)
    }
  }, [store])
}
