import { describe, expect, it } from "vitest"
import { prompt } from "@/lib/ai/groq"
import { DEFAULT_TREND_KEYWORDS, negativeIn, newsAnchor, parseTrendStories, POST_TIMING_TEXT, postTiming, relevanceScore, similarHeadline, storyAgeDays, storyDate, timingOf, trendStoryText } from "@/lib/ai/trend-news"
import { POSTER_AI_TASKS } from "@/lib/ai/types"
import { parseAiRequest } from "@/lib/ai/validate"

const FOUND = [
  { title: "Dubai property sales hit record", url: "https://gulfnews.com/business/property/dubai-sales-record" },
  { title: "Emaar launches new tower", url: "https://www.khaleejtimes.com/business/realty/emaar-tower" },
]

describe("Trending news: each story's place, source, event day, trending rate and timing (1.45)", () => {
  const LINE =
    "1. Butuan Hosts 10th TBI Summit For Caraga Startups | 2026-11-13 | https://pia.gov.ph/caraga/tbi-summit | DOST-PCIEERD gathered incubators in Butuan City. It shifts its focus to commercial scaling. | Local innovation and jobs for Caraga | kind: Event | place: Butuan City, Agusan del Norte | source: PIA Caraga | event: 2026-11-15 | trending: 85 | post: Post immediately"
  const found = [{ title: "TBI Summit", url: "https://pia.gov.ph/caraga/tbi-summit" }]

  it("reads the labeled parts, in any order, and leaves the summary and hook as they are", () => {
    const [s] = parseTrendStories(`STORIES:\n${LINE}`, found)
    expect(s).toMatchObject({ title: "Butuan Hosts 10th TBI Summit For Caraga Startups", look: "events", where: "Butuan City, Agusan del Norte", sourceName: "PIA Caraga", eventDate: "2026-11-15", trending: 85, timing: "now", verified: true })
    expect(s.summary).toBe("DOST-PCIEERD gathered incubators in Butuan City. It shifts its focus to commercial scaling.")
    expect(s.why).toBe("Local innovation and jobs for Caraga")
    const [t] = parseTrendStories("1. A Story About Butuan Growth | 2026-11-13 | https://pia.gov.ph/caraga/tbi-summit | Summary here. | Hook | post: Good this week | trending: [1-100] | event: empty | place: [city] | source: none", found)
    expect(t).toMatchObject({ timing: "week", why: "Hook" })
    expect(t.trending).toBeUndefined()
    expect(t.eventDate).toBeUndefined()
    expect(t.where).toBeUndefined()
    expect(t.sourceName).toBeUndefined()
    // An answer without labels (before 1.45) reads as before; a headline may start with "Event:".
    const [old] = parseTrendStories("1. Event: Butuan Fair Opens This Week | 2026-11-13 | https://pia.gov.ph/caraga/tbi-summit | A fair opens. | Many visitors | Event", found)
    expect(old).toMatchObject({ title: "Event: Butuan Fair Opens This Week", look: "events", why: "Many visitors" })
    expect(trendStoryText(s)).toContain("Source: PIA Caraga (pia.gov.ph) · Published: 2026-11-13 · Place: Butuan City, Agusan del Norte · Event date: 2026-11-15")
  })

  it("when to post: the dates beat the AI's word", () => {
    const day = new Date(2026, 10, 14)
    const at = (d: string) => storyDate(d)
    expect(timingOf("Post immediately")).toBe("now")
    expect(timingOf("post today")).toBe("today")
    expect(timingOf("Good this week")).toBe("week")
    expect(timingOf("later")).toBeNull()
    // An event today or tomorrow goes out now; one that has passed is only good this week.
    expect(postTiming({ date: at("2026-11-12"), eventDate: "2026-11-15", timing: "week" }, day)).toBe("now")
    expect(postTiming({ date: at("2026-11-14"), eventDate: "2026-11-12", timing: "now" }, day)).toBe("week")
    // An event later on: the AI's word.
    expect(postTiming({ date: at("2026-11-14"), eventDate: "2026-11-28", timing: "today" }, day)).toBe("today")
    // News two days old isn't "today" any more; fresh news without a word from the AI is.
    expect(postTiming({ date: at("2026-11-12"), timing: "now" }, day)).toBe("week")
    expect(postTiming({ date: at("2026-11-14") }, day)).toBe("today")
    expect(postTiming({ date: null }, day)).toBe("week")
    expect(POST_TIMING_TEXT.now).toBe("Post immediately")
  })

  it("the AI's rate moves the relevance a little", () => {
    const base = { age: 0, days: 3, check: "trusted" as const, partner: false, keywords: 1, place: true, negative: false, repeat: false, trending: true }
    const plain = relevanceScore(base)
    expect(relevanceScore({ ...base, hot: 100 })).toBe(plain + 4)
    expect(relevanceScore({ ...base, hot: 10 })).toBe(plain - 3)
    expect(relevanceScore({ ...base, hot: 50 })).toBe(plain)
  })

  it("the search asks for them, up to 8 stories (1.47) and never pads", () => {
    const req = parseAiRequest({ task: "trend-search", brand: "homes", keywords: ["Caraga Real Estate"], day: "2026-11-14", days: 3, avoid: [] })
    if (typeof req === "string") throw new Error(req)
    const p = prompt(req)
    for (const tag of ["place: [", "source: [", "event: [", "trending: [1-100]", "post: [Post immediately, Post today or Good this week]"]) expect(p.user).toContain(tag)
    expect(p.user).toContain("Find up to 8 different stories")
    // Caraga's news only.
    expect(p.user).toContain("PLACE (only here): the Caraga region")
    expect(p.system).toMatch(/an upcoming event, opening or deadline announced in it/)
    expect(p.system).toMatch(/only "nationwide" unless it clearly affects the brand's place/)
    expect(p.system).toMatch(/never pad the list/)
    expect(p.system).toMatch(/never invent links/)
  })

  it("the writer: 3 to 7 word headlines, 3 alternatives, a 10-word subtext, a 300 to 400 character caption, a 2 or 3 sentence report", () => {
    const req = parseAiRequest({ task: "article-headline", article: "Butuan City hosted the 10th TBI Summit on November 13, 2026, gathering Caraga startup incubators. ".repeat(3), brand: "Homes.ph CARAGA", count: 4 })
    if (typeof req === "string") throw new Error(req)
    const p = prompt(req)
    expect(p.system).toMatch(/3 to 7 words, punchy, with an active verb/)
    expect(p.system).toMatch(/2 to 4 consecutive words/)
    expect(p.system).toMatch(/not the place name alone/)
    expect(p.system).toMatch(/at most 10 words/)
    expect(p.system).toMatch(/300 to 400 characters before the hashtags/)
    expect(p.system).toMatch(/6 to 8 relevant hashtags/)
    expect(p.system).toMatch(/starting "It's timely for …"/)
    expect(p.user).toContain("the recommended one and 3 alternatives")
    expect(p.user).toContain("3 subtext options of different kinds")
  })
})

describe("Poster Maker → Trending news", () => {
  it("the team's keywords are the defaults (20 per brand)", () => {
    expect(DEFAULT_TREND_KEYWORDS.pickleplay).toHaveLength(20)
    expect(DEFAULT_TREND_KEYWORDS.pickleplay[0]).toBe("Pickleball Philippines")
    expect(DEFAULT_TREND_KEYWORDS.fhi).toContain("Dubai Off-Plan Properties")
    expect(DEFAULT_TREND_KEYWORDS.homes).toContain("Siargao Property Investment")
  })

  it("the search request: brand, keywords, the day and how many days back", () => {
    const req = parseAiRequest({ task: "trend-search", brand: "fhi", keywords: ["Dubai Real Estate", "", "Dubai Real Estate", "Dubai Mega Projects"], day: "2026-11-08", days: 2, avoid: ["Dubai Rental Market Shifts to Buying"] })
    if (typeof req === "string") throw new Error(req)
    expect(req).toEqual({ task: "trend-search", brand: "fhi", keywords: ["Dubai Real Estate", "Dubai Mega Projects"], day: "2026-11-08", days: 2, avoid: ["Dubai Rental Market Shifts to Buying"], posts: "fallback" })
    const p = prompt(req)
    expect(p.user).toContain("NEWS PUBLISHED: from 2026-11-07 to 2026-11-08 (November 7, 2026 to November 8, 2026)")
    expect(p.user).toContain("KEYWORDS (topics, read with common sense")
    expect(p.user).toContain("): Dubai Real Estate; Dubai Mega Projects")
    // FHI isn't kept to one place's list (no PLACE line).
    expect(p.user).not.toContain("PLACE (only here)")
    expect(p.user).toContain("ALREADY POSTED (don't pick these stories again): Dubai Rental Market Shifts to Buying")
    expect(p.user).toContain("Dubai and UAE real estate and business")
    expect(p.system).toMatch(/Never older news/)
    expect(p.system).toMatch(/Only positive or hopeful news/)
    expect(prompt({ task: "trend-search", brand: "fhi", keywords: ["Dubai Real Estate"], day: "2026-11-08", days: 1, avoid: [] }).user).toContain("NEWS PUBLISHED: on 2026-11-08 (November 8, 2026) only")
    expect(parseAiRequest({ task: "trend-search", brand: "x", keywords: ["a"], day: "2026-11-08" })).toBe("Unknown brand.")
    expect(parseAiRequest({ task: "trend-search", brand: "homes", keywords: [], day: "2026-11-08" })).toBe("Add at least one keyword.")
    expect(parseAiRequest({ task: "trend-search", brand: "homes", keywords: ["Caraga"], day: "Nov 8" })).toBe("Pick the day first.")
    expect(POSTER_AI_TASKS).toContain("trend-search")
  })

  it("reads the stories with their dates and sources (a page the search didn't open isn't confirmed)", () => {
    const stories = parseTrendStories(
      `STORIES:
1. **Dubai property sales hit a record AED 72.6 billion in Q3** | 2026-11-08 | https://gulfnews.com/business/property/dubai-sales-record | Sales rose across 34,000 deals. 【1†L3-L9】 | Record numbers and wide coverage
2. Emaar launches new waterfront tower | November 7, 2026 | https://www.khaleejtimes.com/business/realty/emaar-tower | A new tower on Dubai Creek. | Big launch
3. Made-up story | 2026-11-08 | https://nowhere.example/x | Not real. | none
4. Dubai property sales hit a record AED 72.6 billion | 2026-11-08 | https://gulfnews.com/x | Same story again. | repeat`,
      FOUND,
    )
    expect(stories.map((s) => [s.title, s.dateText, s.site, s.verified])).toEqual([
      ["Dubai property sales hit a record AED 72.6 billion in Q3", "2026-11-08", "gulfnews.com", true],
      ["Emaar launches new waterfront tower", "November 7, 2026", "khaleejtimes.com", true],
      ["Made-up story", "2026-11-08", "nowhere.example", false],
    ])
    expect(stories[0].summary).toBe("Sales rose across 34,000 deals.")
    expect(stories[0].why).toBe("Record numbers and wide coverage")
    expect(stories[1].date?.getDate()).toBe(7)
  })

  it("how new: the poster's day (never later than today); the story's age in days", () => {
    const today = new Date(2026, 10, 8, 15, 0)
    expect(newsAnchor(new Date(2026, 10, 12), today).getDate()).toBe(8)
    expect(newsAnchor(new Date(2026, 10, 5), today).getDate()).toBe(5)
    const day = new Date(2026, 10, 8)
    expect(storyAgeDays({ date: storyDate("2026-11-08") }, day)).toBe(0)
    expect(storyAgeDays({ date: storyDate("Nov 6, 2026") }, day)).toBe(2)
    expect(storyAgeDays({ date: storyDate("not a date") }, day)).toBeNull()
  })

  it("flags news that may not be positive, and stories already posted", () => {
    expect(negativeIn("Dubai sales hit a record")).toBe("")
    expect(negativeIn("Fire hits Butuan market")).toBe("Fire")
    expect(negativeIn("Pickleball club closure in Pasig")).toBe("closure")
    expect(similarHeadline("Dubai Rental Market Shifts to Buying", "Dubai rental market shifts as tenants turn to buying")).toBe(true)
    expect(similarHeadline("Dubai Rental Market Shifts to Buying", "Emaar launches new waterfront tower")).toBe(false)
  })

  it("a page that can't be read: the poster is written from the story as found", () => {
    expect(trendStoryText({ title: "Emaar launches new tower", dateText: "2026-11-07", date: null, url: "", site: "khaleejtimes.com", verified: true, summary: "A new tower on Dubai Creek.", why: "", kind: "news" })).toBe(
      "Emaar launches new tower\nSource: khaleejtimes.com · Published: 2026-11-07\n\nA new tower on Dubai Creek.",
    )
  })
})
