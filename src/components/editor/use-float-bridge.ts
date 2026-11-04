"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { getFloatBridge, setFloatMode, useFloatMode, type FloatState } from "@/lib/float"
import { buildCardDesign, slideLabel } from "@/lib/design/templates"
import { importImageFiles, pasteImageFromUrl } from "./image-import"
import { saveStatusOf, type EditorState, type EditorStore } from "./store"

function toFloatState(s: EditorState): FloatState {
  return {
    projectId: s.project.id,
    title: s.project.title,
    caption: s.project.caption,
    currentSlideId: s.currentSlideId,
    saveStatus: saveStatusOf(s),
    slides: s.slides.map((slide, index) => ({
      id: slide.id,
      type: slide.type,
      label: index === 0 ? "Cover" : slideLabel(slide.design, `Card ${index}`),
      design: slide.design,
    })),
  }
}

/**
 * Connects the editor to the floating quick-edit window while float mode is on:
 * publishes the slides whenever they change and applies edits sent back.
 */
export function useFloatBridge(store: EditorStore) {
  const on = useFloatMode()

  useEffect(() => {
    const bridge = getFloatBridge()
    if (!bridge || !on) return
    void bridge.enable()

    let timer: ReturnType<typeof setTimeout> | null = null
    const publish = () => {
      timer = null
      bridge.publish(toFloatState(store.getState()))
    }
    publish()
    const unsubscribe = store.subscribe((s, prev) => {
      if (
        s.slides === prev.slides &&
        s.currentSlideId === prev.currentSlideId &&
        s.project === prev.project &&
        saveStatusOf(s) === saveStatusOf(prev)
      ) {
        return
      }
      if (!timer) timer = setTimeout(publish, 50)
    })

    const off = bridge.onCommand((command) => {
      const s = store.getState()
      switch (command.type) {
        case "set-text":
          if (typeof command.text === "string") s.updateElement(command.elementId, { text: command.text.slice(0, 5000) }, { history: `text:${command.elementId}` })
          break
        case "set-caption":
          if (typeof command.text === "string") s.setMeta({ caption: command.text.slice(0, 20000) })
          break
        case "select-slide":
          s.setCurrentSlide(command.slideId)
          break
        case "add-card": {
          // A new Homes.ph content card right after the slide shown in the float; the editor switches to it.
          const id = s.addSlide(buildCardDesign(), { afterId: command.afterSlideId })
          store.getState().setCurrentSlide(id)
          break
        }
        case "paste-image": {
          const file = new File([command.bytes], command.name || `pasted-image-${Date.now()}.png`, { type: command.mime })
          void importImageFiles(store, [file], { mode: "background", slideId: command.slideId })
          break
        }
        case "paste-image-url":
          void pasteImageFromUrl(store, command.url, command.slideId)
          break
        case "closed":
          setFloatMode(false)
          toast.info("Floating editor turned off", { description: "Turn it back on with the Float button in the editor." })
          break
      }
    })

    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
      off()
      void bridge.disable()
    }
  }, [on, store])
}
