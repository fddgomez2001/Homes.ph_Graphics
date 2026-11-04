import { describe, expect, it } from "vitest"
import { carouselText } from "@/lib/ai/client"
import { cleanAnswer } from "@/lib/ai/groq"
import { parseAiRequest } from "@/lib/ai/validate"
import { buildCardDesign, buildCoverDesign, DEFAULT_TEMPLATE_CONTEXT } from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"

const withText = (design: SlideDesign, role: string, text: string): SlideDesign => ({
  ...design,
  elements: design.elements.map((e) => (e.type === "text" && e.role === role ? { ...e, text } : e)),
})

describe("AI: carousel outline", () => {
  it("collects the cover title + subtitle and every card's title, subtitle and description", () => {
    const cover = buildCoverDesign(DEFAULT_TEMPLATE_CONTEXT, { white: "Every Sound", yellow: "Carries A Story.", description: "6 Traditional Filipino Instruments" })
    const card = withText(withText(withText(buildCardDesign(), "title", "Kulintang"), "subtitle", "A Melody Of Many Gongs"), "description", "A row of\\n tuned gongs.")
    const text = carouselText(
      [
        { type: "cover", design: cover },
        { type: "card", design: card },
      ],
      "Old caption",
    )
    expect(text).toEqual({
      title: "Every Sound Carries A Story.",
      subtitle: "6 Traditional Filipino Instruments",
      cards: [{ title: "Kulintang", subtitle: "A Melody Of Many Gongs", description: "A row of\\n tuned gongs." }],
      caption: "Old caption",
    })
  })
})

describe("AI: only the three writing tasks are accepted", () => {
  const carousel = { title: "T", subtitle: "S", cards: [{ title: "A", subtitle: "", description: "D" }] }

  it("accepts the tasks with sensible limits", () => {
    expect(parseAiRequest({ task: "card-description", carousel, cardIndex: 0, minChars: 80, maxChars: 150 })).toMatchObject({ task: "card-description", cardIndex: 0, minChars: 80, maxChars: 150 })
    expect(parseAiRequest({ task: "cover-subtitle", carousel, maxChars: 999 })).toMatchObject({ task: "cover-subtitle", maxChars: 120 })
    expect(parseAiRequest({ task: "caption", carousel })).toMatchObject({ task: "caption" })
  })

  it("refuses anything else (no free-form prompts) and bad indexes", () => {
    expect(typeof parseAiRequest({ task: "chat", prompt: "write me a poem", carousel })).toBe("string")
    expect(typeof parseAiRequest({ task: "card-description", carousel, cardIndex: 5 })).toBe("string")
    expect(typeof parseAiRequest({ task: "caption" })).toBe("string")
    expect(typeof parseAiRequest(null)).toBe("string")
  })

  it("trims oversized input", () => {
    const big = { title: "x".repeat(5000), subtitle: "", cards: Array.from({ length: 80 }, () => ({ title: "c", subtitle: "", description: "d".repeat(9000) })) }
    const req = parseAiRequest({ task: "caption", carousel: big })
    if (typeof req === "string") throw new Error(req)
    expect(req.carousel.title.length).toBe(300)
    expect(req.carousel.cards.length).toBe(30)
    expect(req.carousel.cards[0].description.length).toBe(1500)
  })
})

describe("AI: answers are cleaned up", () => {
  it("removes labels, quotes, em dashes and hashtags", () => {
    expect(cleanAnswer('Subtitle: "6 Traditional Filipino Instruments."', "cover-subtitle")).toBe("6 Traditional Filipino Instruments")
    expect(cleanAnswer("Here is the description: A row of gongs — tuned by hand. #OPM", "card-description")).toBe("A row of gongs, tuned by hand.")
    expect(cleanAnswer("“Swipe to meet six instruments.”", "caption")).toBe("Swipe to meet six instruments.")
  })
})
