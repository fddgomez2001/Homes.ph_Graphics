"use client"

import type { CarouselDraftCard } from "@/lib/ai/carousel-draft"
import { DESCRIPTION_LINES, lineCount } from "@/lib/design/content-rules"
import { buildCardDesign, summarizeDesign, type CarouselBrand } from "@/lib/design/templates"
import type { SlideDesign, TextElement } from "@/lib/design/types"
import { getProject, getProjectSlides, saveProject, type SaveSlidePayload } from "@/lib/data/projects"

/**
 * Create New Carousel → from an article: the content cards the AI wrote become Homes.ph cards
 * (title, subtitle, description; the photo is added in the editor) saved with the new carousel.
 */

/** A content card of the carousel's brand with this card's words (an empty subtitle gives the no-subtitle layout). */
export function cardDesign(card: CarouselDraftCard, brand: CarouselBrand = "homes"): SlideDesign {
  const design = buildCardDesign(brand)
  const text: Record<string, string> = { title: card.title, subtitle: card.subtitle, description: card.description }
  return {
    ...design,
    elements: design.elements.map((el) => (el.type === "text" && el.role && el.role in text ? ({ ...el, text: text[el.role] } as TextElement) : el)),
  }
}

const descriptionOf = (design: SlideDesign) => design.elements.find((e): e is TextElement => e.type === "text" && e.role === "description")

/**
 * Descriptions longer than the card's 3 lines (measured with the real font) are written again
 * shorter by the AI; the others stay as they are. Returns the cards and how many were shortened.
 */
export async function fitCardDescriptions(cover: SlideDesign, cards: CarouselDraftCard[], brand: CarouselBrand = "homes"): Promise<{ cards: CarouselDraftCard[]; shortened: number }> {
  const [{ ensureFonts }, { measureTextHeight }, { suggestCardDescription }] = await Promise.all([
    import("@/lib/design/fonts"),
    import("@/lib/design/measure"),
    import("@/lib/ai/client"),
  ])
  const designs = cards.map((card) => cardDesign(card, brand))
  await ensureFonts(designs)
  const slides = [{ type: "cover" as const, design: cover }, ...designs.map((design) => ({ type: "card" as const, design }))]
  const next = [...cards]
  let shortened = 0
  for (const [i, design] of designs.entries()) {
    const el = descriptionOf(design)
    if (!el || lineCount(el, measureTextHeight) <= DESCRIPTION_LINES.max) continue
    try {
      const text = await suggestCardDescription(slides, i + 1, el, measureTextHeight)
      if (text.trim()) {
        next[i] = { ...next[i], description: text.trim() }
        shortened++
      }
    } catch {
      // kept as written: the editor shows it's long
    }
  }
  return { cards: next, shortened }
}

/** Adds the cards (after the cover) to a carousel that was just created. */
export async function saveCarouselCards(projectId: string, cards: CarouselDraftCard[], brand: CarouselBrand = "homes"): Promise<void> {
  if (!cards.length) return
  const [{ prepareDesign }, project, rows] = await Promise.all([import("@/lib/design/prepare"), getProject(projectId), getProjectSlides(projectId)])
  const cover = rows[0]
  if (!cover) throw new Error("The new carousel has no cover.")
  const slide = (id: string, type: "cover" | "card", design: SlideDesign): SaveSlidePayload => ({
    id,
    slide_type: type,
    ...summarizeDesign(design),
    canvas_width: design.width,
    canvas_height: design.height,
    design_json: design,
  })
  const prepared = await Promise.all(cards.map((card) => prepareDesign(cardDesign(card, brand))))
  await saveProject({
    projectId,
    expectedRevision: project.revision,
    project: {},
    slides: [
      { ...slide(cover.id, "cover", cover.design_json), background_image_url: cover.background_image_url, background_public_id: cover.background_public_id },
      ...prepared.map((design) => slide(crypto.randomUUID(), "card", design)),
    ],
  })
}
