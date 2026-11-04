"use client"

import { lineCount, DESCRIPTION_LINES } from "@/lib/design/content-rules"
import { coverTitle } from "@/lib/design/cover-title"
import type { MeasureText } from "@/lib/design/layout"
import type { ElementRole, SlideDesign, SlideType, TextElement } from "@/lib/design/types"
import type { AiRequest, AiResponse, CarouselText } from "./types"

interface SlideLike {
  type: SlideType
  design: SlideDesign
}

function textOf(design: SlideDesign, ...roles: ElementRole[]) {
  for (const role of roles) {
    const el = design.elements.find((e): e is TextElement => e.type === "text" && e.role === role && e.visible && !!e.text.trim())
    if (el) return el.text.replace(/\s+/g, " ").trim()
  }
  return ""
}

/** Just the words of the carousel (cover first), for the AI. */
export function carouselText(slides: SlideLike[], caption = ""): CarouselText {
  const [cover, ...cards] = slides
  return {
    title: cover ? coverTitle(cover.design) : "",
    subtitle: cover ? textOf(cover.design, "description", "subtitle") : "",
    cards: cards.map((s) => ({ title: textOf(s.design, "title", "stat"), subtitle: textOf(s.design, "subtitle", "label"), description: textOf(s.design, "description") })),
    caption,
  }
}

export async function aiWrite(req: AiRequest): Promise<string> {
  const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) })
  const body = (await res.json().catch(() => ({}))) as Partial<AiResponse> & { error?: string }
  if (!res.ok || !body.text) throw new Error(body.error || `The AI request failed (${res.status}).`)
  return body.text
}

/**
 * A card description that fits 2–3 lines of the card. The length target comes
 * from the text box (width and font size); one stricter retry if it's still too long.
 */
export async function suggestCardDescription(slides: SlideLike[], slideIndex: number, el: TextElement, measure: MeasureText): Promise<string> {
  const perLine = Math.max(20, el.width / (el.fontSize * 0.5))
  const base = { task: "card-description" as const, carousel: carouselText(slides), cardIndex: slideIndex - 1 }
  let maxChars = Math.round(perLine * 2.6)
  const minChars = Math.round(perLine * 1.3)
  let text = await aiWrite({ ...base, minChars, maxChars })
  if (lineCount({ ...el, text }, measure) > DESCRIPTION_LINES.max) {
    maxChars = Math.round(maxChars * 0.8)
    text = await aiWrite({ ...base, minChars: Math.min(minChars, maxChars - 20), maxChars })
  }
  return text
}

/** A short one-line cover subtitle from the title, the current subtitle and every card. */
export async function suggestCoverSubtitle(slides: SlideLike[]): Promise<string> {
  const carousel = carouselText(slides)
  let text = await aiWrite({ task: "cover-subtitle", carousel, maxChars: 60 })
  if (text.length > 70) text = await aiWrite({ task: "cover-subtitle", carousel, maxChars: 48 })
  return text
}

/** A short, hook-first post caption from every slide's text. */
export function suggestCaption(slides: SlideLike[], caption: string): Promise<string> {
  return aiWrite({ task: "caption", carousel: carouselText(slides, caption) })
}
