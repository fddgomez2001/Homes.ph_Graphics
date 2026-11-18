import { describe, expect, it } from "vitest"
import { buildHistory, featuredBefore, locationIssue, parseResearch, parseTopicIdeas, researchNotes, sameName, similarTopic, topicWords } from "@/lib/ai/carousel-research"
import { cleanAnswer, prompt, sourcesFrom } from "@/lib/ai/groq"
import { POSTER_AI_TASKS } from "@/lib/ai/types"
import { parseAiRequest } from "@/lib/ai/validate"

// What Groq's browser search hands back (shape from a real call).
const EXECUTED = [
  {
    type: "browser_search",
    output: "…",
    search_results: {
      results: [
        { title: "10 Must-Try Filipino Restaurants in Cebu", url: "https://www.spot.ph/eatdrink/10-must-try-filipino-restaurants-in-cebu", content: "", score: 0 },
        { title: "Best Filipino Restaurants in Cebu", url: "https://proudlyfilipino.com/26977/top-and-best-filipino-restaurants-in-cebu-philippines/", content: "", score: 0 },
        { title: "2024 top Filipino restaurants - Exa Places", url: "https://exa.ai/library/places?q=4c3e", content: "", score: 0 },
      ],
    },
  },
  { type: "browser.open", output: "L0: \nL1: URL:\nL2: https://www.sunstar.com.ph/cebu/best-of-cebu-2024\nL3: Best of Cebu 2024 awardees\nL4: …", search_results: null },
  { type: "browser.open", output: "L0: \nL1: URL:\nL2: https://www.spot.ph/eatdrink/10-must-try-filipino-restaurants-in-cebu\nL3: 10 Must-Try Filipino Restaurants in Cebu", search_results: null },
]

describe("Create New Carousel → search a topic (Groq web search)", () => {
  it("the pages the search really found and opened (no Groq search pages, no repeats)", () => {
    expect(sourcesFrom(EXECUTED)).toEqual([
      { title: "10 Must-Try Filipino Restaurants in Cebu", url: "https://www.spot.ph/eatdrink/10-must-try-filipino-restaurants-in-cebu" },
      { title: "Best Filipino Restaurants in Cebu", url: "https://proudlyfilipino.com/26977/top-and-best-filipino-restaurants-in-cebu-philippines/" },
      { title: "Best of Cebu 2024 awardees", url: "https://www.sunstar.com.ph/cebu/best-of-cebu-2024" },
    ])
    expect(sourcesFrom(undefined)).toEqual([])
  })

  it("reads the places; a source the search didn't find isn't confirmed; repeats go", () => {
    const answer = cleanAnswer(
      `**TOPIC:** Top Filipino Restaurants In Cebu City 2026
ITEMS:
1. Café Laguna | Ayala Center Cebu, Cebu City | Opened in 1991, known for kare-kare with bagoong 【2†L94-L100】 | https://proudlyfilipino.com/26977/top-and-best-filipino-restaurants-in-cebu-philippines/
2. STK Ta Bai | A. Climaco St., Cebu City | Famous for grilled tuna panga | https://www.spot.ph/eatdrink/10-must-try-filipino-restaurants-in-cebu
3. Made Up Grill | Cebu City | A place no page mentions | https://random-blog.example/made-up
4. Cafe Laguna | Cebu City | Same place again | https://proudlyfilipino.com/x
SOURCES:
- Best Filipino Restaurants in Cebu | https://proudlyfilipino.com/26977/`,
      "carousel-research",
    )
    const r = parseResearch(answer, sourcesFrom(EXECUTED))
    expect(r.topic).toBe("Top Filipino Restaurants In Cebu City 2026")
    expect(r.items.map((i) => [i.name, i.site, i.verified])).toEqual([
      ["Café Laguna", "proudlyfilipino.com", true],
      ["STK Ta Bai", "spot.ph", true],
      ["Made Up Grill", "random-blog.example", false],
    ])
    // Citation marks are gone from the facts.
    expect(r.items[0].facts).toBe("Opened in 1991, known for kare-kare with bagoong")
    expect(r.sources).toHaveLength(3)
  })

  it("the picked places become the facts the carousel is written from", () => {
    const notes = researchNotes("Top Filipino Restaurants In Cebu City 2026", [
      { name: "Café Laguna", location: "Cebu City", facts: "Opened in 1991.", url: "https://proudlyfilipino.com/x", site: "proudlyfilipino.com", verified: true },
    ])
    expect(notes).toBe(
      "Top Filipino Restaurants In Cebu City 2026\n\nPlaces found on the web for this topic (use only these facts, in this order):\n\n1. Café Laguna, Cebu City. Opened in 1991. (Source: proudlyfilipino.com)",
    )
  })

  it("the AI requests: the topic, the cards, the places to avoid; topic ideas for the month", () => {
    const req = parseAiRequest({ task: "carousel-research", topic: "  Top 2 resorts in Mindanao, Visayas and Luzon ", cards: 6, avoid: ["Rico's Lechon", "", "Rico's Lechon", 7] })
    if (typeof req === "string") throw new Error(req)
    expect(req).toEqual({ task: "carousel-research", topic: "Top 2 resorts in Mindanao, Visayas and Luzon", cards: 6, avoid: ["Rico's Lechon"], brand: "homes" })
    const p = prompt(req)
    expect(p.system).toMatch(/give exactly that number for each group/)
    expect(p.system).toMatch(/Stay inside the area the topic names/)
    expect(p.system).toMatch(/none from the AVOID list/)
    expect(p.user).toContain("AVOID (already featured in earlier Homes.ph carousels; never pick these): Rico's Lechon")
    expect(p.user).toContain("1. [name] | [location] | [facts] | [source URL]")
    expect(parseAiRequest({ task: "carousel-research", topic: "x" })).toBe("Type the topic first.")
    const ideas = parseAiRequest({ task: "carousel-topics", month: "November 2026", avoid: ["Lights, Land, And Endless Views."] })
    if (typeof ideas === "string") throw new Error(ideas)
    expect(ideas).toMatchObject({ count: 6, month: "November 2026" })
    expect(prompt(ideas).user).toContain("TOPICS ALREADY DONE (don't suggest these or anything too close): Lights, Land, And Endless Views.")
    expect(prompt(ideas).system).toMatch(/Timely for the month/)
    expect(POSTER_AI_TASKS).toEqual(expect.arrayContaining(["carousel-research", "carousel-topics"]))
  })

  it("reads the topic ideas", () => {
    expect(
      parseTopicIdeas(`1. **Top Christmas Villages In Luzon To Visit In December 2026** | Holiday lights draw families on weekends
2. Top Simbang Gabi Churches In Cebu | Nine dawn masses start Dec 16
3. Top Christmas Villages In Luzon To Visit In December 2026 | repeat
Not a list line`),
    ).toEqual([
      { topic: "Top Christmas Villages In Luzon To Visit In December 2026", why: "Holiday lights draw families on weekends" },
      { topic: "Top Simbang Gabi Churches In Cebu", why: "Nine dawn masses start Dec 16" },
    ])
  })
})

describe("no repeated topics or places", () => {
  const history = buildHistory(
    [
      { id: "a", title: "Lights, Land, And Endless Views.", scheduled_at: "2026-11-07T15:00:00.000Z" },
      { id: "b", title: "Cebu's Flavor Trail", scheduled_at: "2026-10-30T15:00:00.000Z" },
    ],
    [
      { project_id: "a", slide_order: 0, title: "Lights, Land,", description: "6 Philippine Lighthouses With Views Worth The Journey" },
      { project_id: "a", slide_order: 1, title: "Cape Bojeador Lighthouse", description: "First lit in 1892." },
      { project_id: "a", slide_order: 2, title: "Card Title", description: "sample" },
      { project_id: "b", slide_order: 0, title: "Cebu's Flavor Trail", description: "5 Cebu Food Spots Locals Keep Going Back To" },
      { project_id: "b", slide_order: 1, title: "Rico’s Lechon", description: "Spicy lechon." },
    ],
  )

  it("history: the topics (title + cover subtitle) and the places (card titles, not the sample text)", () => {
    expect(history.topics.map((t) => t.subtitle)).toEqual(["6 Philippine Lighthouses With Views Worth The Journey", "5 Cebu Food Spots Locals Keep Going Back To"])
    expect(history.places.map((p) => p.name)).toEqual(["Cape Bojeador Lighthouse", "Rico’s Lechon"])
  })

  it("a topic close to one already done is spotted (restaurants = food)", () => {
    expect(similarTopic("Top Restaurants in Cebu City 2026 specific to Filipino Cuisine", history.topics)?.title).toBe("Cebu's Flavor Trail")
    expect(similarTopic("Most scenic lighthouses in the Philippines", history.topics)?.title).toBe("Lights, Land, And Endless Views.")
    expect(similarTopic("Top 2 resorts in Mindanao, Visayas and Luzon", history.topics)).toBeNull()
    // The same theme somewhere else isn't a repeat.
    expect(similarTopic("Top Filipino restaurants in Davao City", history.topics)).toBeNull()
    expect([...topicWords("Top Restaurants in Cebu City 2026")]).toEqual(["food", "cebu"])
  })

  it("a place featured before is spotted (curly or straight apostrophes, a longer or shorter name)", () => {
    expect(featuredBefore("Rico's Lechon", history.places)?.carousel).toBe("Cebu's Flavor Trail")
    expect(featuredBefore("Cape Bojeador", history.places)?.carousel).toBe("Lights, Land, And Endless Views.")
    expect(featuredBefore("Café Laguna", history.places)).toBeNull()
    // One shared word isn't a match ("Laguna" the province vs "Cafe Laguna").
    expect(sameName("Laguna", "Cafe Laguna")).toBe(false)
    expect(sameName("The Aristocrat Restaurant", "Aristocrat")).toBe(true)
  })
})

describe("locations to check", () => {
  it("a place in the wrong island group, or a location that mixes regions", () => {
    expect(locationIssue("Luzon · Boracay, Aklan")).toBe("Boracay is in Visayas, not Luzon")
    expect(locationIssue("Mindanao · Siargao Island, Surigao del Norte")).toBeNull()
    expect(locationIssue("Visayas · Panglao, Bohol")).toBeNull()
    expect(locationIssue("Luzon · El Nido, Palawan")).toBeNull()
    expect(locationIssue("Panglao Island, Palawan")).toBe("The location mixes Panglao and Palawan (different regions)")
    // "Cagayan de Oro" is one place (Mindanao), not "Oro".
    expect(locationIssue("Mindanao · Cagayan de Oro")).toBeNull()
    expect(locationIssue("Ayala Center Cebu, Cebu City")).toBeNull()
    expect(locationIssue("")).toBeNull()
  })
})
