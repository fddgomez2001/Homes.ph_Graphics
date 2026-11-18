import { describe, expect, it } from "vitest"
import { cleanSlideText, parseCarouselDraft } from "@/lib/ai/carousel-draft"
import { cleanAnswer, prompt } from "@/lib/ai/groq"
import { POSTER_AI_TASKS } from "@/lib/ai/types"
import { CAROUSEL_CARDS, parseAiRequest } from "@/lib/ai/validate"
import { cardDesign } from "@/lib/carousel-from-article"
import { planPriorityInsert } from "@/lib/dates"
import type { TextElement } from "@/lib/design/types"

const ARTICLE = `Six lighthouses in the Philippines are worth the trip for their views alone, from Batanes in the north to Bohol in the south. The Cape Bojeador Lighthouse in Burgos, Ilocos Norte, was first lit in 1892 and still guides ships today.`

const ANSWER = `**HEADLINE 1:** "Lights, Land,"
HEADLINE 2: And Endless Views.
SUBTITLE: 6 Philippine Lighthouses With Views Worth The Journey.
CARDS:
1. Cape Bojeador Lighthouse | Burgos, Ilocos Norte | First lit in 1892, it still guides ships along the northern coast — and the sunset view is unbeatable. 🌅
2. TITLE: Basco Lighthouse | SUBTITLE: Batanes | DESCRIPTION: Perched on Naidi Hills, it looks over rolling green slopes and the open sea.
3. Cape Bojeador Lighthouse | Ilocos Norte | A repeat that should be dropped.
4. [Cape Engaño Lighthouse] | (none) | Built in 1892 on Palaui Island, it rewards the climb with sweeping views of the coast.
CAPTION:
Discover 6 Philippine lighthouses with views worth the journey! 🌊✨
From Cape Bojeador and Basco to Cape Engaño, each one stands over a coastline you'll want to see. Swipe to see them all. 🗺️ #Travel
Which lighthouse would you visit first? 💬`

describe("Create New Carousel → from an article (AI)", () => {
  it("reads the cover, the cards and the caption", () => {
    const draft = parseCarouselDraft(cleanAnswer(ANSWER, "carousel-from-article"), 6)!
    expect(draft.line1).toBe("Lights, Land,")
    expect(draft.line2).toBe("And Endless Views.")
    // No period at the end of the subtitle.
    expect(draft.subtitle).toBe("6 Philippine Lighthouses With Views Worth The Journey")
    // Repeats are left out; labels, brackets, emojis and em dashes go.
    expect(draft.cards).toEqual([
      {
        title: "Cape Bojeador Lighthouse",
        subtitle: "Burgos, Ilocos Norte",
        description: "First lit in 1892, it still guides ships along the northern coast, and the sunset view is unbeatable.",
      },
      { title: "Basco Lighthouse", subtitle: "Batanes", description: "Perched on Naidi Hills, it looks over rolling green slopes and the open sea." },
      { title: "Cape Engaño Lighthouse", subtitle: "", description: "Built in 1892 on Palaui Island, it rewards the climb with sweeping views of the coast." },
    ])
    // The caption keeps its emojis and paragraphs; no hashtags, no "swipe" (Facebook shows the photos as a grid).
    expect(draft.caption).toBe(
      "Discover 6 Philippine lighthouses with views worth the journey! 🌊✨\n\nFrom Cape Bojeador and Basco to Cape Engaño, each one stands over a coastline you'll want to see. 🗺️\n\nWhich lighthouse would you visit first? 💬",
    )
  })

  it("at most the cards asked for; nothing usable gives null", () => {
    expect(parseCarouselDraft(ANSWER, 2)?.cards).toHaveLength(2)
    expect(parseCarouselDraft("HEADLINE 1: Something\nCARDS:\n", 6)).toBeNull()
    expect(parseCarouselDraft("CARDS:\n1. A Place | Somewhere | Nice.", 6)).toBeNull()
    expect(cleanSlideText("A very long card title that goes on and on beyond the limit", 28)).toBe("A very long card title that")
    expect(cleanSlideText("N/A", 40)).toBe("")
  })

  it("the AI request: the article and how many cards (2 to 10)", () => {
    const req = parseAiRequest({ task: "carousel-from-article", article: ARTICLE, cards: 25 })
    if (typeof req === "string") throw new Error(req)
    expect(req).toMatchObject({ task: "carousel-from-article", cards: CAROUSEL_CARDS.max })
    expect(parseAiRequest({ task: "carousel-from-article", article: ARTICLE })).toMatchObject({ cards: 6 })
    expect(parseAiRequest({ task: "carousel-from-article", article: "Too short.", cards: 6 })).toBe("Paste the whole article first (at least a few sentences).")
    const p = prompt({ task: "carousel-from-article", article: ARTICLE, cards: 6 })
    // Accurate first: only the article's facts, never padded with made-up items.
    expect(p.system).toMatch(/Use only facts, names, places, numbers, prices and dates found in the article/)
    expect(p.system).toMatch(/write only as many cards as the article supports/)
    expect(p.system).toMatch(/"Lights, Land," \+ "And Endless Views\."/)
    expect(p.system).toMatch(/90 to 150 characters, so it fills 2 to 3 lines/)
    expect(p.system).toMatch(/Start with "Discover"/)
    expect(p.user).toContain("with 6 content cards")
    expect(p.user).toContain("1. [card title] | [card subtitle] | [card description]")
    // Your own AI key works for it too.
    expect(POSTER_AI_TASKS).toContain("carousel-from-article")
  })

  it("the carousel caption task still asks for the same layout", () => {
    const req = parseAiRequest({ task: "caption", carousel: { title: "Lights, Land, And Endless Views.", subtitle: "", cards: [{ title: "Basco Lighthouse", subtitle: "", description: "" }, { title: "Cape Bojeador", subtitle: "", description: "" }] } })
    if (typeof req === "string") throw new Error(req)
    const user = prompt(req).user
    expect(user).toContain("Write the caption for this Facebook post. You may reuse facts and ideas from the current caption, but follow this layout.\nFacebook shows the images as a photo grid")
    expect(user).toContain("Use the number in the cover title or subtitle if there is one, otherwise 2.")
  })

  it("each card gets its words (an empty subtitle keeps the no-subtitle layout)", () => {
    const design = cardDesign({ title: "Basco Lighthouse", subtitle: "", description: "Perched on Naidi Hills." })
    const text = (role: string) => (design.elements.find((e) => e.type === "text" && e.role === role) as TextElement).text
    expect([design.templateId, text("title"), text("subtitle"), text("description")]).toEqual(["homes-card", "Basco Lighthouse", "", "Perched on Naidi Hills."])
  })
})

describe("Create New Carousel → Priority", () => {
  const at = (d: number, h = 23) => new Date(2026, 10, d, h, 0).toISOString()
  const c = (id: string, d: number, status = "scheduled") => ({ id, title: id, scheduled_at: at(d), status })

  it("the carousels from that day move one day later, up to the first free day", () => {
    const carousels = [c("A", 9), c("B", 10), c("C", 11), c("D", 13)]
    const moves = planPriorityInsert(carousels, new Date(2026, 10, 9))
    expect(moves.map((m) => [m.id, new Date(m.to).getDate()])).toEqual([
      ["A", 10],
      ["B", 11],
      ["C", 12],
    ])
    // D (Nov 13) stays: Nov 12 was free.
    expect(moves.every((m) => new Date(m.to).getHours() === 23)).toBe(true)
  })

  it("a free day moves nothing; posted carousels never move", () => {
    expect(planPriorityInsert([c("A", 9), c("B", 11)], new Date(2026, 10, 10))).toEqual([])
    expect(planPriorityInsert([c("A", 9, "published")], new Date(2026, 10, 9))).toEqual([])
    // Two on the same day both move.
    expect(planPriorityInsert([c("A", 9), c("A2", 9)], new Date(2026, 10, 9)).map((m) => m.id)).toEqual(["A", "A2"])
  })
})
