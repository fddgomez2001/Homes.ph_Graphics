"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { loadFont } from "@/lib/design/fonts"
import { textElement } from "@/lib/design/templates"
import { CANVAS_SIZE } from "@/lib/design/types"
import { importImageFiles, imageSourceFromHtml, pasteImageFromUrl } from "./image-import"
import type { EditorStore } from "./store"

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
}

function dialogOpen() {
  return !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"]')
}

/** Marker placed on the system clipboard when an element is copied, so Ctrl+V knows to paste it. */
let clipboardMarker: string | null = null
let markerWritten = false

/**
 * Keyboard shortcuts and clipboard paste for the editor:
 * Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y), Ctrl+C / Ctrl+X / Ctrl+V, Ctrl+D, Delete/Backspace,
 * Ctrl+S, arrow-key nudging, Enter to edit text, Esc to deselect.
 */
export function useEditorShortcuts(store: EditorStore) {
  useEffect(() => {
    const selectedElement = () => {
      const s = store.getState()
      const slide = s.slides.find((x) => x.id === s.currentSlideId) ?? s.slides[0]
      return slide.design.elements.find((e) => e.id === s.selectedId) ?? null
    }

    const copySelected = () => {
      const el = store.getState().copy()
      if (!el) return false
      clipboardMarker = `dcm-element:${el.id}:${Date.now()}`
      markerWritten = false
      navigator.clipboard
        ?.writeText(clipboardMarker)
        .then(() => (markerWritten = true))
        .catch(() => (markerWritten = false))
      return true
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const s = store.getState()
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === "s") {
        e.preventDefault()
        s.requestSave()
        return
      }
      if (isTypingTarget(e.target) || dialogOpen()) return

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault()
        s.undo()
        return
      }
      if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault()
        s.redo()
        return
      }

      const el = selectedElement()
      if (mod && key === "c") {
        if (copySelected()) e.preventDefault()
        return
      }
      if (mod && key === "x" && el) {
        e.preventDefault()
        if (el.locked) return void toast.info("Unlock this layer before cutting it.")
        copySelected()
        s.removeElement(el.id)
        return
      }
      if (mod && key === "d") {
        e.preventDefault()
        if (el) s.duplicateElement(el.id)
        return
      }
      if ((key === "delete" || key === "backspace") && el) {
        e.preventDefault()
        if (el.locked) return void toast.info("This layer is locked. Unlock it in the Layers panel to delete it.")
        s.removeElement(el.id)
        return
      }
      if (key === "escape") {
        if (s.cropId) s.setCrop(null)
        else s.select(null)
        return
      }
      if (key === "enter" && el?.type === "text" && !el.locked) {
        e.preventDefault()
        s.setEditingText(el.id)
        return
      }
      if (el && !el.locked && ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        const patch =
          key === "arrowleft" ? { x: el.x - d } : key === "arrowright" ? { x: el.x + d } : key === "arrowup" ? { y: el.y - d } : { y: el.y + d }
        s.updateElement(el.id, patch, { history: `nudge:${el.id}`, manualMove: "y" in patch })
      }
    }

    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target) || dialogOpen()) return
      const data = e.clipboardData
      if (!data) return
      const s = store.getState()
      const text = data.getData("text/plain")

      if (clipboardMarker && text === clipboardMarker) {
        e.preventDefault()
        s.paste()
        return
      }
      const files = Array.from(data.items)
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => !!f)
      if (files.length) {
        e.preventDefault()
        const named = files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `pasted-image-${Date.now()}-${i}.png`, { type: f.type })))
        void importImageFiles(store, named.slice(0, 1), { mode: "background", slideId: s.currentSlideId })
        return
      }
      // Our own copy whose marker couldn't be written to the system clipboard.
      if (s.clipboard && !markerWritten && !text) {
        e.preventDefault()
        s.paste()
        return
      }
      const html = data.getData("text/html")
      const imgSrc = imageSourceFromHtml(html)
      if (imgSrc && (!text.trim() || /^https?:\/\/\S+$/.test(text.trim()))) {
        // Some apps copy an image as a link only: fetch the image itself, then use it as the background.
        e.preventDefault()
        void pasteImageFromUrl(store, imgSrc, s.currentSlideId)
        return
      }
      if (text.trim()) {
        e.preventDefault()
        const el = textElement({
          name: "Pasted text",
          text: text.trim().slice(0, 2000),
          x: 127,
          y: 560,
          width: CANVAS_SIZE - 254,
          fontSize: 44,
          fontWeight: 500,
          lineHeight: 56,
          align: "center",
        })
        void loadFont(el.fontFamily, el.fontWeight, el.text).then(() => s.addElement(el))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("paste", onPaste)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("paste", onPaste)
    }
  }, [store])
}
