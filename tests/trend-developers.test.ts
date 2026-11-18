import { describe, expect, it } from "vitest"
import { placeRule, searchedPrompt, trendFocus } from "@/lib/ai/groq"
import { developerQuery, keywordQuery, trendQueries } from "@/lib/ai/tavily"
import { DEFAULT_TREND_DEVELOPERS, DEFAULT_TREND_KEYWORDS, partnerIn } from "@/lib/ai/trend-news"
import { parseAiRequest } from "@/lib/ai/validate"

const FHI = [...DEFAULT_TREND_DEVELOPERS.fhi]
const HOMES = [...DEFAULT_TREND_DEVELOPERS.homes]
const trend = (brand: "fhi" | "homes" | "gensan" | "pickleplay", developers?: string[]) => ({
  task: "trend-search" as const,
  brand,
  keywords: [...DEFAULT_TREND_KEYWORDS[brand]],
  ...(developers ? { developers } : {}),
  day: "2026-11-09",
  days: 2,
  avoid: [],
})

describe("Partner developers (the team's lists)", () => {
  it("has FHI's 34 developers and Homes.ph's 48 (CARAGA and Gensan), each once, plain spelling", () => {
    expect(FHI).toHaveLength(34)
    expect(HOMES).toHaveLength(48)
    expect(DEFAULT_TREND_DEVELOPERS.gensan).toEqual(DEFAULT_TREND_DEVELOPERS.homes)
    expect(DEFAULT_TREND_DEVELOPERS.pickleplay).toEqual([])
    for (const list of [FHI, HOMES]) expect(new Set(list.map((d) => d.toLowerCase())).size).toBe(list.length)
    // "Albathа" came with a Cyrillic а.
    expect(FHI).toContain("Albatha Real Estate")
    expect([...FHI, ...HOMES].every((d) => /^[\x20-\x7E]+$/.test(d))).toBe(true)
    expect(FHI).toEqual(expect.arrayContaining(["Emaar Properties", "Damac Properties", "Sobha Realty", "Expo City Dubai"]))
    expect(HOMES).toEqual(expect.arrayContaining(["Camella Homes", "SMDC", "Bria Homes Inc.", "Widia Properties and Development Corporation"]))
  })

  it("FHI keywords add the developers' cities", () => {
    const k = DEFAULT_TREND_KEYWORDS.fhi
    for (const city of ["Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Umm Al Quwain", "Fujairah", "Dubai South", "Studio City"]) expect(k.some((x) => x.includes(city))).toBe(true)
    expect(k[0]).toBe("Dubai Real Estate")
    expect(new Set(k.map((x) => x.toLowerCase())).size).toBe(k.length)
    // A UAE city already names the place: no "Dubai" added.
    expect(keywordQuery("Sharjah Real Estate", "fhi")).toBe("Sharjah Real Estate news")
    expect(keywordQuery("Fujairah Real Estate", "fhi")).toBe("Fujairah Real Estate news")
  })

  it("finds a partner developer in a story by its full or short name", () => {
    expect(partnerIn("Emaar unveils new waterfront towers in Dubai Creek Harbour", FHI)).toBe("Emaar Properties")
    expect(partnerIn("Sobha Realty wins Developer of the Year", FHI)).toBe("Sobha Realty")
    expect(partnerIn("Binghatti launches its tallest tower", FHI)).toBe("Binghatti Developers")
    expect(partnerIn("Filinvest breaks ground on Butuan township", HOMES)).toBe("Filinvest Land Inc.")
    expect(partnerIn("Camella opens model houses in General Santos City", HOMES)).toBe("Camella Homes")
    expect(partnerIn("SMDC tops off its newest Mindanao tower", HOMES)).toBe("SMDC")
    expect(partnerIn("Sta. Lucia unveils a new subdivision in Surigao", HOMES)).toBe("Sta. Lucia Land Inc.")
    expect(partnerIn("Bria Homes turns over 300 units in Koronadal", HOMES)).toBe("Bria Homes Inc.")
    // Common words alone aren't developers.
    expect(partnerIn("Federal government funds a new bridge in Butuan", HOMES)).toBe("")
    expect(partnerIn("Grand opening of the GenSan public market", HOMES)).toBe("")
    expect(partnerIn("A new aqua park opens in Sharjah", FHI)).toBe("")
    expect(partnerIn("Federal Land launches a township", HOMES)).toBe("Federal Land")
  })
})

describe("Trending news searches a partner developer each time", () => {
  it("first keyword, one developer, then the next keywords in turn (5 searches, 1.47)", () => {
    const fhi = trendQueries(trend("fhi", FHI), () => 0).map((q) => q.query)
    expect(fhi).toHaveLength(5)
    expect(fhi[0]).toBe("Dubai Real Estate news")
    expect(fhi[1]).toBe("Acube Developments UAE news")
    // The other keywords in the order sent (the panel sends them starting where the last search stopped).
    expect(fhi[2]).toBe("Dubai Property Market news")
    const caraga = trendQueries(trend("homes", HOMES), () => 0.999).map((q) => q.query)
    expect(caraga[1]).toBe("Widia Properties and Development Corporation Caraga news")
    expect(developerQuery("Camella Homes", "gensan")).toBe("Camella Homes General Santos news")
    expect(developerQuery("Expo City Dubai", "fhi")).toBe("Expo City Dubai news")
    // No developers: the main keyword and the next ones.
    expect(trendQueries(trend("pickleplay"), () => 0)).toHaveLength(5)
  })

  it("sends the developers, and the prompt puts their news first", () => {
    const parsed = parseAiRequest({ ...trend("homes", HOMES) }) as ReturnType<typeof trend>
    expect(parsed.developers).toHaveLength(48)
    expect((parseAiRequest({ ...trend("pickleplay") }) as ReturnType<typeof trend>).developers).toBeUndefined()
    const focus = trendFocus(parsed as never)
    expect(focus).toContain("PARTNER DEVELOPERS (their positive news comes first): 8990 Holdings Inc.; Aboitizland")
    expect(focus).toContain("TOP PRIORITY: the number-one real estate trend in the Caraga region")
    expect(focus).toContain("name the place")
    // Homes.ph Gensan is General Santos City only (1.47).
    expect(trendFocus(trend("gensan", HOMES) as never)).toContain("General Santos City itself (not Koronadal, Polomolok, South Cotabato or Sarangani)")
    expect(trendFocus(trend("fhi", FHI) as never)).toContain("awards")
    expect(trendFocus(trend("pickleplay") as never)).toBe("")
    const prompt = searchedPrompt(trend("fhi", FHI) as never, [])
    expect(prompt.user).toContain("PARTNER DEVELOPERS")
    expect(prompt.user).toContain("Emaar Properties")
    expect(prompt.system).toContain("a partner developer's news before the rest")
  })
})

describe("Homes.ph CARAGA and Gensan posters name the place", () => {
  it("adds the place rule for CARAGA and Gensan only", () => {
    expect(placeRule("Homes.ph CARAGA")).toMatch(/^PLACE: name where in Caraga/)
    expect(placeRule("Homes.ph Gensan")).toContain("General Santos City (as the article gives it: General Santos City, GenSan, or the barangay)")
    expect(placeRule("FHI Global")).toBe("")
    expect(placeRule("PicklePlay PH")).toBe("")
  })
})
