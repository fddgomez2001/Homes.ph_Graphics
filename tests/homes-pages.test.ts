import { describe, expect, it } from "vitest"
import { brandForPage, isPagePoster, pageFromSlug, posterPageOf, inScope } from "@/components/posters/poster-shared"
import { placeRule, searchedPrompt, trendBrandLine, trendFocus } from "@/lib/ai/groq"
import {
  defaultTrendKeywords,
  homesPlace,
  homesPlaceKeywords,
  isCaragaPage,
  pageShortName,
  pageSlug,
  samePage,
  splitTerms,
  swapPlace,
  trendBrandOfPage,
  trendPlace,
  trendScope,
} from "@/lib/ai/homes-places"
import { keywordQuery, postQuery, requestPlace, trendPostQueries, trendQueries } from "@/lib/ai/tavily"
import { DEFAULT_TREND_KEYWORDS, placeIn } from "@/lib/ai/trend-news"
import { parseAiRequest } from "@/lib/ai/validate"
import { DEFAULT_HOMES_PAGES, getNewsTemplate } from "@/lib/design/news-templates"
import type { SlideDesign } from "@/lib/design/types"

const poster = (templateId: string, page?: string): SlideDesign => ({ ...getNewsTemplate(templateId)!.build(), ...(page ? { page } : {}) })

describe("Homes.ph pages as places (Poster Maker → Homes.ph page dropdown, Trending news)", () => {
  it("knows every page of the posting checklist, by any spelling of its name", () => {
    expect(DEFAULT_HOMES_PAGES).toHaveLength(17)
    for (const page of DEFAULT_HOMES_PAGES) expect(homesPlace(page).page.toLowerCase()).toBe(pageShortName(page).toLowerCase())
    expect(pageShortName("Homes.ph BGC Taguig")).toBe("BGC Taguig")
    expect(pageSlug("Homes.ph BGC Taguig")).toBe("bgc-taguig")
    expect(pageSlug("Homes.ph Main Page")).toBe("main-page")
    expect(samePage("Homes.ph Caraga", "Homes.ph CARAGA")).toBe(true)
    expect(samePage("Caraga", "Homes.ph Caraga")).toBe(true)
    expect(samePage("Homes.ph Cebu", "Homes.ph Caraga")).toBe(false)
    expect(isCaragaPage("Homes.ph CARAGA")).toBe(true)
    // A page the team adds later: its own name, in the Philippines.
    expect(homesPlace("Homes.ph Baguio")).toMatchObject({ page: "Baguio", keyword: "Baguio", search: "Baguio", region: "Baguio, Philippines" })
  })

  it("each page's default keywords are the Homes.ph keywords written for its place; CARAGA and Gensan keep the team's lists", () => {
    expect(defaultTrendKeywords("homes", "Homes.ph Caraga")).toEqual(DEFAULT_TREND_KEYWORDS.homes)
    expect(defaultTrendKeywords("homes", null)).toEqual(DEFAULT_TREND_KEYWORDS.homes)
    expect(defaultTrendKeywords("gensan", "Homes.ph Gensan")).toEqual(DEFAULT_TREND_KEYWORDS.gensan)
    const cebu = defaultTrendKeywords("homes", "Homes.ph Cebu")
    expect(cebu[0]).toBe("Cebu Real Estate")
    expect(cebu).toContain("Cebu House and Lot")
    expect(cebu.every((k) => k.startsWith("Cebu "))).toBe(true)
    expect(defaultTrendKeywords("homes", "Homes.ph CDO")[0]).toBe("Cagayan de Oro Real Estate")
    expect(defaultTrendKeywords("homes", "Homes.ph Main Page")[0]).toBe("Philippines Real Estate")
    expect(defaultTrendKeywords("homes", "Homes.ph BGC Taguig")[0]).toBe("BGC Taguig Real Estate")
    expect(homesPlaceKeywords(homesPlace("Leyte"))).toHaveLength(defaultTrendKeywords("homes", "Homes.ph Leyte").length)
    // Other brands are unchanged.
    expect(defaultTrendKeywords("fhi", "Homes.ph Cebu")).toEqual(DEFAULT_TREND_KEYWORDS.fhi)
  })

  it("each page keeps its own lists; CARAGA and Gensan keep the ones saved before (homes, gensan)", () => {
    expect(trendScope("homes", "Homes.ph Caraga")).toBe("homes")
    expect(trendScope("homes", null)).toBe("homes")
    expect(trendScope("gensan", "Homes.ph Gensan")).toBe("gensan")
    expect(trendScope("homes", "Homes.ph Gensan")).toBe("gensan")
    expect(trendScope("homes", "Homes.ph Cebu")).toBe("homes@cebu")
    expect(trendScope("homes", "Homes.ph BGC Taguig")).toBe("homes@bgc-taguig")
    expect(trendScope("pickleplay", "Homes.ph Cebu")).toBe("pickleplay")
    expect(trendPlace("homes", "Homes.ph Caraga")).toBeNull()
    expect(trendPlace("gensan", "Homes.ph Gensan")).toBeNull()
    expect(trendPlace("homes", "Homes.ph Cebu")?.keyword).toBe("Cebu")
    expect(trendBrandOfPage("Homes.ph Gensan")).toBe("gensan")
    expect(trendBrandOfPage("Homes.ph Davao")).toBe("homes")
  })

  it("a keyword copied to another page gets that page's place; one without a place stays as it is", () => {
    const caraga = homesPlace("Caraga")
    const cebu = homesPlace("Cebu")
    expect(swapPlace("Caraga Restaurants Opening Soon", caraga, cebu)).toBe("Cebu Restaurants Opening Soon")
    expect(swapPlace("New Restaurants in Caraga", caraga, cebu)).toBe("New Restaurants in Cebu")
    expect(swapPlace("caraga cafe opening soon", caraga, homesPlace("CDO"))).toBe("Cagayan de Oro cafe opening soon")
    expect(swapPlace("Pag-IBIG Housing Loan", caraga, cebu)).toBe("Pag-IBIG Housing Loan")
    expect(swapPlace("General Santos City Road Projects", homesPlace("Gensan"), cebu)).toBe("Cebu Road Projects")
    expect(swapPlace("GenSan Business News", homesPlace("Gensan"), homesPlace("BGC Taguig"))).toBe("BGC Taguig Business News")
    expect(swapPlace("CDO Food Hubs", homesPlace("CDO"), caraga)).toBe("Caraga Food Hubs")
  })

  it("adds many keywords at once: separated by commas, semicolons or new lines, any length, each once", () => {
    const pasted =
      "Caraga Restaurants Opening Soon, Caraga Restaurant Grand Opening, New Restaurants in Caraga, Caraga Newly Opened Restaurants, Caraga Restaurant Business News, Caraga Food Business Openings, Caraga Cafe Opening Soon, Caraga Coffee Shop Grand Opening, New Cafes in Caraga, Caraga Food Establishments, Caraga New Dining Spots, Caraga Restaurant Launch"
    const terms = splitTerms(pasted)
    expect(terms).toHaveLength(12)
    expect(terms[0]).toBe("Caraga Restaurants Opening Soon")
    expect(terms[11]).toBe("Caraga Restaurant Launch")
    expect(splitTerms("One\nTwo\r\n  Three ;Four|  one  ")).toEqual(["One", "Two", "Three", "Four"])
    expect(splitTerms("• Bulleted keyword\n- Dashed keyword")).toEqual(["Bulleted keyword", "Dashed keyword"])
    // No word limit (the old one cut keywords at 60 characters).
    const long = "Butuan City New Mixed-Use Township With Mall Hotel And Residential Towers Groundbreaking Ceremony"
    expect(splitTerms(long)).toEqual([long])
    expect(splitTerms(" , ;\n")).toEqual([])
  })

  it("a search request takes long keyword lists and the page's place (Homes.ph only)", () => {
    const long = "Butuan City New Mixed-Use Township With Mall Hotel And Residential Towers Groundbreaking Ceremony"
    const keywords = [long, ...Array.from({ length: 200 }, (_, i) => `Keyword ${i}`)]
    const req = parseAiRequest({ task: "trend-search", brand: "homes", keywords, day: "2026-11-10", days: 2, avoid: [], place: "Cebu" })
    expect(req).toMatchObject({ task: "trend-search", brand: "homes", place: "Cebu" })
    if (typeof req === "string" || req.task !== "trend-search") throw new Error(String(req))
    expect(req.keywords[0]).toBe(long)
    expect(req.keywords).toHaveLength(201)
    const fhi = parseAiRequest({ task: "trend-search", brand: "fhi", keywords: ["Dubai Real Estate"], day: "2026-11-10", days: 2, avoid: [], place: "Cebu" })
    expect(fhi).not.toHaveProperty("place")
  })
})

describe("Trending news searches a Homes.ph page's place", () => {
  const req = (place?: string, keywords = defaultTrendKeywords("homes", place ? `Homes.ph ${place}` : null)) => ({
    task: "trend-search" as const,
    brand: "homes" as const,
    keywords: [...keywords],
    developers: ["Camella Homes"],
    day: "2026-11-10",
    days: 2,
    avoid: [],
    ...(place ? { place } : {}),
  })

  it("adds the page's place to a keyword that doesn't name it (Caraga for Homes.ph CARAGA, as before)", () => {
    const cebu = homesPlace("Cebu")
    expect(keywordQuery("Cebu Real Estate", "homes", cebu)).toBe("Cebu Real Estate news")
    expect(keywordQuery("Mandaue Condo Launch", "homes", cebu)).toBe("Mandaue Condo Launch news")
    expect(keywordQuery("Restaurants Opening Soon", "homes", cebu)).toBe("Restaurants Opening Soon Cebu news")
    expect(keywordQuery("Restaurants Opening Soon", "homes")).toBe("Restaurants Opening Soon Caraga news")
    expect(keywordQuery("Townhouse Launch", "homes", homesPlace("CDO"))).toBe("Townhouse Launch Cagayan de Oro news")
    expect(postQuery("Cafe Grand Opening News", "homes", homesPlace("Bohol"))).toBe("Cafe Grand Opening Bohol")
    expect(requestPlace(req())).toBeNull()
    expect(requestPlace(req("Caraga"))).toBeNull()
    expect(requestPlace(req("Cebu"))?.page).toBe("Cebu")
  })

  it("the searches and the AI stay in the page's place", () => {
    const queries = trendQueries(req("Davao"), () => 0)
    expect(queries[0].query).toBe("Davao Real Estate news")
    expect(queries[1].query).toBe("Camella Homes Davao news")
    expect(queries.every((q) => /davao/i.test(q.query))).toBe(true)
    expect(trendPostQueries(req("Davao"), () => 0).map((q) => q.query)).toEqual(["Davao Real Estate", "Camella Homes Davao"])
    expect(trendBrandLine(req("Davao"))).toMatch(/^Homes\.ph Davao: .*Davao City and the Davao Region/)
    expect(trendFocus(req("Davao"))).toMatch(/Every story must be in Davao City and the Davao Region/)
    expect(searchedPrompt(req("Davao"), []).user).toMatch(/BRAND: Homes\.ph Davao/)
    // Homes.ph CARAGA stays as it was.
    expect(trendBrandLine(req())).toMatch(/^Homes\.ph CARAGA:/)
    expect(trendFocus(req())).toMatch(/Every story must be in Caraga/)
    // Restaurants and cafés are good news too.
    expect(trendBrandLine(req("Cebu"))).toMatch(/restaurants, cafés/)
  })

  it("the poster's AI names the page's place (not on the nationwide Main Page)", () => {
    expect(placeRule("Homes.ph Cebu")).toMatch(/PLACE: name where in Cebu City and Cebu province/)
    expect(placeRule("Homes.ph BGC Taguig")).toMatch(/Bonifacio Global City/)
    expect(placeRule("Homes.ph CARAGA")).toMatch(/where in Caraga/)
    expect(placeRule("Homes.ph Gensan")).toMatch(/General Santos/)
    expect(placeRule("Homes.ph Main Page")).toBe("")
    expect(placeRule("PicklePlay PH")).toBe("")
  })

  it("a story shows the page's place it names", () => {
    expect(placeIn("New mall opens in Mandaue City this week", "homes", homesPlace("Cebu"))).toBe("Mandaue")
    expect(placeIn("Butuan township launched", "homes")).toBe("Butuan")
    expect(placeIn("Butuan township launched", "homes", homesPlace("Cebu"))).toBe("")
  })
})

describe("Poster Maker → Homes.ph pages", () => {
  it("a poster's page: its own, Homes.ph CARAGA without one, Homes.ph Gensan for Gensan posters", () => {
    expect(posterPageOf(poster("homes-portrait-poster-news", "Homes.ph Cebu"))).toBe("Homes.ph Cebu")
    expect(posterPageOf(poster("homes-portrait-poster-news"))).toBe("Homes.ph Caraga")
    expect(posterPageOf(poster("gensan-portrait-poster-news"))).toBe("Homes.ph Gensan")
    expect(posterPageOf(poster("homes-poster-news", "Homes.ph Davao"))).toBe("Homes.ph Davao")
  })

  it("the page's board shows only its posters (Gensan's include the Gensan template; News Article posts never)", () => {
    expect(isPagePoster(poster("homes-portrait-poster-news", "Homes.ph Cebu"), "Homes.ph Cebu")).toBe(true)
    expect(isPagePoster(poster("homes-portrait-poster-news", "Homes.ph Cebu"), "Homes.ph Caraga")).toBe(false)
    expect(isPagePoster(poster("homes-portrait-poster-news"), "Homes.ph CARAGA")).toBe(true)
    expect(isPagePoster(poster("gensan-portrait-poster-news"), "Homes.ph Gensan")).toBe(true)
    expect(isPagePoster(poster("homes-portrait-poster-news", "Homes.ph Gensan"), "Homes.ph Gensan")).toBe(true)
    expect(isPagePoster(poster("pickleplay-portrait-poster-news"), "Homes.ph Caraga")).toBe(false)
    expect(isPagePoster(poster("caraga-portrait-news"), "Homes.ph Caraga")).toBe(false)
    expect(inScope(poster("fhi-portrait-poster-news"), { brand: "fhi", page: null })).toBe(true)
    expect(inScope(poster("homes-portrait-poster-news", "Homes.ph Cebu"), { brand: "homes", page: "Homes.ph Cebu" })).toBe(true)
  })

  it("a new poster's brand follows the page; the address names the page", () => {
    expect(brandForPage("Homes.ph Gensan")).toBe("gensan")
    expect(brandForPage("Homes.ph Cebu")).toBe("homes")
    expect(brandForPage("Homes.ph Caraga")).toBe("homes")
    expect(pageFromSlug("bgc-taguig", DEFAULT_HOMES_PAGES)).toBe("Homes.ph BGC Taguig")
    expect(pageFromSlug("caraga", ["Homes.ph Caraga"])).toBe("Homes.ph Caraga")
    expect(pageFromSlug("nowhere", DEFAULT_HOMES_PAGES)).toBeNull()
    expect(pageFromSlug(null, DEFAULT_HOMES_PAGES)).toBeNull()
  })
})
