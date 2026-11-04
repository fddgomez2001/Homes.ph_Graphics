import type { AiRequest, CarouselText } from "./types"

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback

function carouselFrom(v: unknown): CarouselText | null {
  if (!v || typeof v !== "object") return null
  const c = v as Record<string, unknown>
  const cards = (Array.isArray(c.cards) ? c.cards : []).slice(0, 30).map((card) => {
    const k = (card ?? {}) as Record<string, unknown>
    return { title: str(k.title, 300), subtitle: str(k.subtitle, 300), description: str(k.description, 1500) }
  })
  return { title: str(c.title, 300), subtitle: str(c.subtitle, 300), cards, caption: str(c.caption, 3000) }
}

/**
 * Accepts only the three writing tasks with bounded carousel text (the AI key
 * can't be used for anything else). Returns the request or a reason.
 */
export function parseAiRequest(body: unknown): AiRequest | string {
  if (!body || typeof body !== "object") return "Nothing to write about."
  const b = body as Record<string, unknown>
  const carousel = carouselFrom(b.carousel)
  if (!carousel) return "The carousel text is missing."
  if (b.task === "card-description") {
    const cardIndex = int(b.cardIndex, 0, 29, -1)
    if (cardIndex < 0 || cardIndex >= carousel.cards.length) return "That card doesn't exist."
    const minChars = int(b.minChars, 40, 300, 100)
    return { task: "card-description", carousel, cardIndex, minChars, maxChars: int(b.maxChars, minChars + 10, 400, 160) }
  }
  if (b.task === "cover-subtitle") return { task: "cover-subtitle", carousel, maxChars: int(b.maxChars, 20, 120, 60) }
  if (b.task === "caption") {
    if (!carousel.title && !carousel.cards.length) return "Add some text to the slides first."
    return { task: "caption", carousel }
  }
  return "Unknown writing task."
}
