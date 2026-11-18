import { describe, expect, it } from "vitest"
import { BRAND_POST_RULES, brandPostPrompt, parseBrandPost } from "@/lib/ai/brand-post-ai"
import { parseAiRequest } from "@/lib/ai/validate"

describe("Did You Know / engagement posts written with AI (1.52)", () => {
  it("asks for the template's fields only, by the team's writing rules", () => {
    const p = brandPostPrompt({ brand: "Homes.ph Cebu", kind: "engagement", template: "Trivia Quiz", fields: ["kicker", "title", "options"], topic: "Cebu history", avoid: ["Who founded Cebu?"] })
    expect(p).toContain("BRAND: Homes.ph Cebu")
    expect(p).toContain("TOPIC: Cebu history")
    expect(p).toContain("- Who founded Cebu?")
    expect(p).toContain("OPTION C:")
    expect(p).not.toContain("FACT 1:")
    expect(BRAND_POST_RULES).toMatch(/30–70 characters/)
    expect(BRAND_POST_RULES).toMatch(/ONE key phrase/)
  })

  it("reads the reply: fields, the trivia answer and the caption with its hashtags", () => {
    const r = parseBrandPost(
      `KICKER: trivia time
TITLE: Who is known as the **Father of Philippine Journalism**?
OPTION A: Jose Rizal
OPTION B: Marcelo H. del Pilar
OPTION C: Graciano Lopez Jaena
ANSWER: B
SUBTITLE: not asked for
CAPTION: Do you know the answer? Comment A, B or C!
#HomesPH #Cebu`,
      ["kicker", "title", "options"],
    )
    expect(r).toEqual({
      kicker: "TRIVIA TIME",
      title: "Who is known as the *Father of Philippine Journalism*?",
      options: ["Jose Rizal", "Marcelo H. del Pilar", "Graciano Lopez Jaena"],
      answer: 1,
      caption: "Do you know the answer? Comment A, B or C!\n\n#HomesPH #Cebu",
    })
    expect(parseBrandPost("FACT 1: One\nFACT 3: Three\nTITLE: 3 Things", ["title", "facts"]).facts).toEqual(["One", "", "Three"])
  })

  it("the request is checked", () => {
    expect(parseAiRequest({ task: "brand-post", kind: "dyk", fields: ["title", "facts", "nope"], brand: "PicklePlay PH", template: "3 Facts", topic: "x", avoid: [] })).toMatchObject({
      task: "brand-post",
      kind: "dyk",
      fields: ["title", "facts"],
    })
    expect(typeof parseAiRequest({ task: "brand-post", kind: "news", fields: ["title"] })).toBe("string")
    expect(typeof parseAiRequest({ task: "brand-post", kind: "dyk", fields: [] })).toBe("string")
  })
})
