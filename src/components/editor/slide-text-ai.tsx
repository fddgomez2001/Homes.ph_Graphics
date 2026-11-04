"use client"

import { AiSuggestion } from "@/components/ai/ai-suggestion"
import { suggestCardDescription, suggestCoverSubtitle } from "@/lib/ai/client"
import { descriptionStatus } from "@/lib/design/content-rules"
import type { TextElement } from "@/lib/design/types"
import { DescriptionHint } from "./description-hint"
import { useEditor, useEditorStore } from "./store"

/**
 * AI help for the slide text that needs it most: the card description (when
 * it doesn't fit 2–3 lines) and the cover subtitle.
 */
export function SlideTextAi({ el }: { el: TextElement }) {
  const store = useEditorStore()
  const index = useEditor((s) => s.slides.findIndex((x) => x.id === s.currentSlideId))
  const templateId = useEditor((s) => s.slides.find((x) => x.id === s.currentSlideId)?.design.templateId)
  const measure = useEditor((s) => s.measure)
  const use = (text: string) => store.getState().updateElement(el.id, { text }, { history: `ai:${el.id}` })
  // Always the latest text of this element when the request is made.
  const current = () => (store.getState().slides[index]?.design.elements.find((e) => e.id === el.id) as TextElement | undefined) ?? el

  if (index > 0 && el.role === "description" && templateId === "homes-card") {
    const { lines } = descriptionStatus(el, measure)
    const off = lines > 3 || lines < 2
    return (
      <AiSuggestion
        key={el.id}
        label={lines > 3 ? "Shorten with AI" : lines < 2 ? "Write it with AI" : "Rewrite with AI"}
        emphasis={off}
        request={() => suggestCardDescription(store.getState().slides, index, current(), measure)}
        onUse={use}
        note={(text) => <DescriptionHint el={{ ...el, text }} measure={measure} />}
      />
    )
  }
  if (index === 0 && el.role === "description") {
    return (
      <AiSuggestion
        key={el.id}
        label={el.text.trim() ? "Improve subtitle with AI" : "Write subtitle with AI"}
        request={() => suggestCoverSubtitle(store.getState().slides)}
        onUse={use}
        note={(text) => <p className="text-[11px] text-muted-foreground">{text.length} characters · reads all the cards</p>}
      />
    )
  }
  return null
}
