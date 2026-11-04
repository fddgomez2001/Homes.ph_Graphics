"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { cssFontStack } from "@/lib/design/fonts"
import type { TextElement } from "@/lib/design/types"
import { useEditorStore } from "../store"

/**
 * In-place text editing: a textarea styled like the canvas text sits exactly over
 * it while editing. Changes go to the store live, so auto-arrange follows along.
 */
export function TextEditOverlay({ el, scale }: { el: TextElement; scale: number }) {
  const store = useEditorStore()
  const ref = useRef<HTMLTextAreaElement>(null)
  const pad = el.background.enabled ? el.background.padding : 0

  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.focus()
    ta.select()
  }, [el.id])

  useLayoutEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = "0px"
    ta.style.height = `${ta.scrollHeight}px`
  })

  const finish = () => {
    const s = store.getState()
    if (s.editingTextId !== el.id) return
    s.setEditingText(null)
    const current = s.slides.flatMap((sl) => sl.design.elements).find((e) => e.id === el.id)
    // An emptied, unnamed text box is removed (undo brings it back).
    if (current?.type === "text" && !current.text.trim() && !current.role) s.removeElement(el.id)
  }

  return (
    <textarea
      ref={ref}
      value={el.text}
      aria-label={`Edit ${el.name}`}
      spellCheck
      onChange={(e) => store.getState().updateElement(el.id, { text: e.target.value }, { history: `text:${el.id}` })}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault()
          finish()
        }
      }}
      className="absolute z-20 m-0 resize-none overflow-hidden border-0 outline-2 outline-offset-2 outline-[#F97316] outline-dashed"
      style={{
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        padding: pad * scale,
        transform: `rotate(${el.rotation}deg)`,
        transformOrigin: "top left",
        fontFamily: cssFontStack(el.fontFamily),
        fontWeight: el.fontWeight,
        fontSize: el.fontSize * scale,
        lineHeight: `${el.lineHeight * scale}px`,
        letterSpacing: el.letterSpacing * scale,
        textAlign: el.align,
        color: el.fillGradient?.stops[1]?.color ?? el.fill,
        opacity: el.opacity,
        background: el.background.enabled ? el.background.color : "transparent",
        borderRadius: el.background.enabled ? el.background.radius * scale : 0,
        textShadow: el.shadow.enabled
          ? `${el.shadow.offsetX * scale}px ${el.shadow.offsetY * scale}px ${el.shadow.blur * scale}px ${el.shadow.color}`
          : undefined,
        caretColor: "#F97316",
        textTransform: el.textCase === "upper" ? "uppercase" : undefined,
        whiteSpace: el.autoFit ? "pre" : "pre-wrap",
        overflowWrap: "break-word",
      }}
    />
  )
}
