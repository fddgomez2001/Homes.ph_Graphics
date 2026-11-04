"use client"

import { useEffect } from "react"
import { isAutoLogo, logoSource } from "@/lib/design/logo"
import { resolveAutoLogos } from "@/lib/design/render"
import type { SlideDesign } from "@/lib/design/types"
import type { EditorStore } from "./store"

/**
 * Keeps every "auto" Homes.ph logo showing the right color (blue on light photos,
 * white on dark ones) as photos, overlays and positions change. Uses the exact same
 * measurement as the exporter, and never adds undo steps.
 */
export function useAutoLogo(store: EditorStore) {
  useEffect(() => {
    const checked = new Map<string, SlideDesign>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let disposed = false

    const hasAutoLogo = (design: SlideDesign) => design.elements.some((el) => el.type === "image" && el.visible && isAutoLogo(el))
    const pending = () => store.getState().slides.find((sl) => checked.get(sl.id) !== sl.design && hasAutoLogo(sl.design))

    const run = async () => {
      if (running) return
      running = true
      try {
        for (let next = pending(); next && !disposed; next = pending()) {
          checked.set(next.id, next.design)
          const variants = await resolveAutoLogos(next.design).catch(() => new Map<string, "white" | "blue">())
          if (disposed) return
          const current = store.getState().slides.find((s) => s.id === next.id)
          for (const [id, variant] of variants) {
            const el = current?.design.elements.find((e) => e.id === id)
            if (el?.type === "image" && isAutoLogo(el) && el.logoResolved !== variant) {
              store.getState().updateElement(id, logoSource(variant), { history: false })
            }
          }
        }
      } finally {
        running = false
      }
    }

    const schedule = (delay = 300) => {
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
