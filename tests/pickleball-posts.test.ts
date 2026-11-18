import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { markedWords, markFocus, numberLabel, SAMPLE_CONTENT } from "@/lib/ads/render"
import { generate } from "@/lib/ai/groq"
import { COURT_OWNER_RULES, factsAbout, PICKLEBALL_FACTS, parsePickleballPost, pickleballPostPrompt, readFields, shuffledFacts } from "@/lib/ai/pickleball-posts"
import { POSTER_AI_TASKS } from "@/lib/ai/types"
import { parseAiRequest } from "@/lib/ai/validate"

const FUNFACT = `TOPIC: Kitchen zone length
LEAD: The kitchen zone reaches
BIG: 7
WORD: feet!
BODY: It extends 7 feet from the net on each side. Players cannot volley while standing in this area.
LEFT LABEL: Tennis
LEFT VALUE: 0
LEFT TEXT: no zone
RIGHT LABEL: Pickleball
RIGHT VALUE: 7
RIGHT TEXT: foot zone
NOTE: The 7-foot kitchen stops volleys and adds strategy.
CAPTION: Kitchen zone · 7 feet
FACEBOOK CAPTION: Ever wondered why you can't smash from the kitchen? It reaches 7 feet from the net!
What's your best kitchen tip?
#PicklePlayPH #Pickleball`

const HISTORY = `**TOPIC:** First tournament
YEAR: 1976
HEADLINE: The first tournament was held in 1976.
BODY: In spring 1976, the South Center Athletic Club in Tukwila, Washington hosted the first known pickleball tournament.
PLACE: Tukwila, WA
SIDE TITLE: Who played?
SIDE BODY: Many of the players were college tennis players who brought a competitive spirit to the new sport.
FACEBOOK CAPTION: Do you know when the first tournament was? #PicklePlayPH`

const TRIVIA = `TOPIC: Erne shot
QUESTION: Who is the Erne shot named after?
LONG QUESTION: This volley from beside the kitchen is named after which [player]?
SHORT QUESTION: Who is [Erne]?
ANSWER: Erne Perry!
EXPLANATION: The Erne is named after player Erne Perry. It is a volley hit from beside the kitchen.
A: Ben Johns
B: Erne Perry
C: Bill Bell
D: Joel Pritchard
CORRECT: D`

describe("PicklePlay posts: reading the AI's answer", () => {
  it("reads labeled lines; the Facebook caption keeps its lines", () => {
    const f = readFields(FUNFACT)
    expect(f.LEAD).toBe("The kitchen zone reaches")
    expect(f["LEFT LABEL"]).toBe("Tennis")
    expect(f["FACEBOOK CAPTION"]).toBe("Ever wondered why you can't smash from the kitchen? It reaches 7 feet from the net!\nWhat's your best kitchen tip?\n#PicklePlayPH #Pickleball")
  })

  it("a fun fact fills every field, with curly apostrophes like the templates", () => {
    const post = parsePickleballPost("funfact", FUNFACT, "02")
    expect(post.topic).toBe("Kitchen zone length")
    expect(post.content).toMatchObject({ kind: "funfact", number: "02", lead: "The kitchen zone reaches", big: "7", word: "feet!", rightLabel: "Pickleball", caption: "Kitchen zone · 7 feet" })
    expect(post.facebookCaption).toContain("can’t smash")
  })

  it("history: missing lines are filled from the others (an older YEAR/PLACE answer too)", () => {
    const post = parsePickleballPost("history", HISTORY, "01")
    expect(post.topic).toBe("First tournament")
    expect(post.content).toMatchObject({
      kind: "history",
      focus: "1976",
      headline: "The first tournament was held in 1976.",
      shortHeadline: "The first tournament was held.",
      badge: "Est. 1976",
      startTitle: "Where it started",
      storyTag: "1976 · Tukwila, WA",
    })
  })

  it("history: the focus can be a word (a name, a thing, a part of the game)", () => {
    const post = parsePickleballPost(
      "history",
      `TOPIC: Kitchen name
FOCUS: Kitchen
HEADLINE: The no-volley zone is called the kitchen.
SHORT HEADLINE: The zone with a homey nickname.
BODY: The non-volley zone reaches 7 feet from the net on each side, and players call it the kitchen.
STORY TAG: Kitchen · The non-volley zone
SIDE TITLE: Can you step in?
SIDE BODY: You may step into the kitchen any time to play a ball that has bounced; only volleys are not allowed there.`,
      "01",
    )
    expect(post.content).toMatchObject({ focus: "Kitchen", shortHeadline: "The zone with a homey nickname.", storyTag: "Kitchen · The non-volley zone", badge: "Kitchen" })
    expect(markFocus("The no-volley zone is called the kitchen.", "Kitchen", true)).toBe("The no-volley zone is called the {kitchen.}")
    expect(markFocus("Pickleball was born in a backyard in 1965.", "1965", false)).toBe("Pickleball was born in a backyard in {1965}.")
  })

  it("trivia: the right choice is the one that is the answer; a question without [brackets] gets one", () => {
    const post = parsePickleballPost("trivia", TRIVIA, "07")
    if (post.content.kind !== "trivia") throw new Error("not trivia")
    expect(post.content.correct).toBe(1)
    expect(post.content.choices).toEqual(["Ben Johns", "Erne Perry", "Bill Bell", "Joel Pritchard"])
    expect(post.content.question).toBe("Who is the [Erne] shot named after?")
    expect(post.content.shortQuestion).toBe("Who is [Erne]?")
  })

  it("too-long text ends at a whole sentence; special hyphens become plain ones", () => {
    const long = `In the summer of 1965, Joel Pritchard, Bill Bell and Barney McCallum created the game on Bainbridge Island, Washington. They used ping‑pong paddles and a perforated plastic ball on an old badminton court with the net lowered.`
    const post = parsePickleballPost("history", `FOCUS: 1965\nHEADLINE: Pickleball was born in 1965.\nBODY: ${long} ${long}\nSIDE BODY: The 7‑foot kitchen came with the first rules.`, "01")
    if (post.content.kind !== "history") throw new Error("not history")
    expect(post.content.body).toMatch(/\.$/)
    expect(post.content.body.length).toBeLessThanOrEqual(230)
    expect(post.content.body).toContain("ping-pong")
    expect(post.content.sideBody).toBe("The 7-foot kitchen came with the first rules.")
  })

  it("says what's missing when the answer is incomplete", () => {
    expect(() => parsePickleballPost("trivia", "QUESTION: What?\nANSWER: Yes!", "01")).toThrow(/missing explanation/)
    expect(() => parsePickleballPost("funfact", "LEAD: x", "01")).toThrow(/missing big, word, body/)
  })
})

describe("PicklePlay posts: the prompt", () => {
  it("gives the whole fact bank, the facts already made and the format", () => {
    const p = pickleballPostPrompt({ kind: "history", topic: "", avoid: ["Pickleball invented"] }, "", () => 0.5)
    expect(p).toContain("FACT BANK:")
    expect(p).toContain("ALREADY POSTED (don't repeat these facts): Pickleball invented")
    expect(p).toContain("SHORT HEADLINE:")
    expect(p).toContain("FOCUS:")
    expect(shuffledFacts()).toHaveLength(PICKLEBALL_FACTS.length)
    expect(shuffledFacts()).toHaveLength(PICKLEBALL_FACTS.length)
    expect(shuffledFacts()).toHaveLength(PICKLEBALL_FACTS.length)
  })

  it("a typed topic: its facts first (the post must be about it), then the web results", () => {
    const p = pickleballPostPrompt({ kind: "trivia", topic: "the Erne", avoid: [] }, "[1] Erne shot\nURL: https://x.test")
    expect(p).toContain("THE POST MUST BE ABOUT: the Erne. Use the FACTS ABOUT THE TOPIC and the SOURCES")
    expect(p).toMatch(/FACTS ABOUT THE TOPIC:\n- Shots: The Erne is a volley/)
    expect(p).toContain("SOURCES (web search results for the topic):\n[1] Erne shot")
    // "the kitchen" finds both kitchen facts; "paddles" finds the paddle facts.
    expect(factsAbout("the kitchen", PICKLEBALL_FACTS).slice(0, 2).every((f) => f.startsWith("Kitchen:"))).toBe(true)
    expect(factsAbout("first paddles", PICKLEBALL_FACTS).every((f) => /paddle/i.test(f))).toBe(true)
  })

  it("the bank has the corrected facts (not the ones AI memory gets wrong)", () => {
    const bank = PICKLEBALL_FACTS.join("\n")
    expect(bank).toMatch(/1976: The first known pickleball tournament .* Tukwila, Washington/)
    expect(bank).toMatch(/2016: The first US Open Pickleball Championships were held in Naples, Florida/)
  })
})

describe("PicklePlay Court Owners ads", () => {
  const AD = `TOPIC: Get booked online
HEADLINE: Get booked
HIGHLIGHT: online!
DETAIL 1: Let players book court time online
DETAIL 2: Promote your open-play schedule
DETAIL 3: See bookings and revenue in one place
FEATURE 1: Online booking
FEATURE 2: Open-play promos
FACEBOOK CAPTION: Your courts deserve full schedules. List them on PicklePlay at pickleplay.ph.
#PicklePlayPH #CourtOwners`

  it("reads the ad; a missing feature comes from its benefit", () => {
    const post = parsePickleballPost("courtowner", AD, "01")
    expect(post.topic).toBe("Get booked online")
    expect(post.content).toEqual({
      kind: "courtowner",
      headline: "Get booked",
      highlight: "online!",
      detail1: "Let players book court time online",
      detail2: "Promote your open-play schedule",
      detail3: "See bookings and revenue in one place",
      feature1: "Online booking",
      feature2: "Open-play promos",
      feature3: "See bookings and",
    })
    expect(() => parsePickleballPost("courtowner", "HEADLINE: Fill your", "01")).toThrow(/missing highlight, detail 1, detail 2, detail 3/)
  })

  it("the prompt lists what PicklePlay does for court owners (not the pickleball fact bank)", () => {
    const p = pickleballPostPrompt({ kind: "courtowner", topic: "tournaments", avoid: ["Fill your courts"] })
    expect(p).toContain("PICKLEPLAY FOR COURT OWNERS:")
    expect(p).toContain("- Host and manage tournaments.")
    expect(p).toContain("ANGLE: tournaments")
    expect(p).toContain("ADS ALREADY MADE (use a different angle and wording): Fill your courts")
    expect(p).not.toContain("FACT BANK")
    expect(COURT_OWNER_RULES).toMatch(/Never promise numbers, prices, discounts, "free"/)
  })
})

describe("PicklePlay posts: request checks", () => {
  it("accepts the three kinds with a topic and the facts already made", () => {
    expect(parseAiRequest({ task: "pickleball-post", kind: "funfact", topic: "  the   ball ", avoid: ["Net height", "Net height", ""] })).toEqual({
      task: "pickleball-post",
      kind: "funfact",
      topic: "the ball",
      avoid: ["Net height"],
    })
    expect(parseAiRequest({ task: "pickleball-post", kind: "poem" })).toBe("Choose History, Trivia, Fun Facts, Court Owners, Coming Soon or Now Open.")
    expect(parseAiRequest({ task: "pickleball-post", kind: "courtowner", topic: "", avoid: [] })).toMatchObject({ kind: "courtowner" })
    expect(POSTER_AI_TASKS).toContain("pickleball-post")
  })
})

describe("PicklePlay posters: text marks", () => {
  it("[groups] stay separate boxes; {accent} words keep their punctuation apart", () => {
    const words = markedWords("what were the [very first] [pickleball paddles] made of?")
    const boxes = words.filter((w) => w.segs.every((s) => s.mark === "box"))
    expect(boxes.map((w) => [w.segs[0].text, w.group])).toEqual([
      ["very", 1],
      ["first", 1],
      ["pickleball", 2],
      ["paddles", 2],
    ])
    expect(markedWords("in {1965}.")[1].segs).toEqual([
      { text: "1965", mark: "accent" },
      { text: ".", mark: null },
    ])
  })

  it("poster numbers have two digits", () => {
    expect(numberLabel("7")).toBe("07")
    expect(numberLabel("#12")).toBe("12")
    expect(numberLabel("")).toBe("01")
    expect(SAMPLE_CONTENT.trivia.choices[SAMPLE_CONTENT.trivia.correct]).toBe("Wood")
  })
})

describe("PicklePlay posts: writing (Groq, with a web search for a typed topic)", () => {
  let calls: { url: string; body: Record<string, unknown> }[]
  let tavilyFails = false
  beforeEach(() => {
    calls = []
    tavilyFails = false
    vi.stubEnv("GROQ_API_KEY", "gsk_test")
    vi.stubEnv("GROQ_MODEL", "")
    vi.stubEnv("TAVILY_API_KEY", "tvly-app-key-0123456789")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
        calls.push({ url, body })
        if (url.includes("tavily")) {
          if (tavilyFails) return new Response(JSON.stringify({ detail: { error: "limit" } }), { status: 432 })
          return new Response(JSON.stringify({ results: [{ title: "The Erne shot", url: "https://pickleball.test/erne", content: "The Erne is named after Erne Perry." }], usage: { credits: 1 } }), { status: 200 })
        }
        return new Response(JSON.stringify({ choices: [{ message: { content: TRIVIA } }] }), { status: 200 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("no topic: written from the fact bank, then its topic is looked up for links to check the fact", async () => {
    const out = await generate({ task: "pickleball-post", kind: "trivia", topic: "", avoid: [] })
    // The AI writes first (no search before it)…
    expect(calls[0].url).not.toContain("tavily")
    expect(JSON.stringify(calls[0].body.messages)).toContain("FACT BANK")
    expect(JSON.stringify(calls[0].body.messages)).not.toContain("SOURCES (web")
    expect(out.text).toContain("QUESTION:")
    // …then one basic search for its TOPIC gives the source links (1 credit).
    const tavily = calls.filter((c) => c.url.includes("tavily"))
    expect(tavily).toHaveLength(1)
    expect(tavily[0].body).toMatchObject({ query: "pickleball Erne shot", search_depth: "basic" })
    expect(out.sources).toEqual([{ title: "The Erne shot", url: "https://pickleball.test/erne" }])
    expect(out.search).toEqual({ engine: "tavily", credits: 1 })
  })

  it("a topic: one basic Tavily search (1 credit), its pages go to the AI and come back as sources", async () => {
    const out = await generate({ task: "pickleball-post", kind: "trivia", topic: "the Erne", avoid: [] })
    const tavily = calls.filter((c) => c.url.includes("tavily"))
    expect(tavily).toHaveLength(1)
    expect(tavily[0].body).toMatchObject({ query: "pickleball the Erne", search_depth: "basic" })
    expect(JSON.stringify(calls.find((c) => c.url.includes("groq"))?.body.messages)).toContain("pickleball.test/erne")
    expect(out.sources).toEqual([{ title: "The Erne shot", url: "https://pickleball.test/erne" }])
  })

  it("court owner ads: no fact to check, no search", async () => {
    const out = await generate({ task: "pickleball-post", kind: "courtowner", topic: "", avoid: [] })
    expect(calls.some((c) => c.url.includes("tavily"))).toBe(false)
    expect(out.sources).toBeUndefined()
  })

  it("the search fails: still writes, from the fact bank", async () => {
    tavilyFails = true
    const out = await generate({ task: "pickleball-post", kind: "trivia", topic: "the Erne", avoid: [] })
    expect(out.text).toContain("ANSWER:")
    expect(out.sources).toBeUndefined()
    expect(JSON.stringify(calls.find((c) => c.url.includes("groq"))?.body.messages)).not.toContain("SOURCES (web")
  })
})
