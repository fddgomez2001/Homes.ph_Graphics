import { describe, expect, it } from "vitest"
import { promptKeywords } from "@/lib/ai/groq"
import { keywordQuery, PH_LISTING_SITES, trendQueries } from "@/lib/ai/tavily"
import { DEFAULT_TREND_KEYWORDS } from "@/lib/ai/trend-news"
import { parseAiRequest } from "@/lib/ai/validate"
import { posterBrandOf } from "@/components/posters/poster-shared"
import { applyNewsChange, newsHeadline } from "@/lib/data/news"
import { applyTextStack } from "@/lib/design/layout"
import {
  articleTemplatesFor,
  CARAGA_TIMES,
  getNewsTemplate,
  isDailyBrand,
  isPosterTemplate,
  NEWS_BRANDS,
  newsBrandOf,
  newsTimesFor,
  POSTER_TEMPLATE_IDS,
} from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import {
  buildBrandCard,
  buildBrandCover,
  buildCaragaPortraitNews,
  buildHomesPoster,
  buildPickleplayPortraitNews,
  carouselBrandOf,
  CAROUSEL_BRANDS,
  DEFAULT_TEMPLATE_CONTEXT,
} from "@/lib/design/templates"
import type { DesignElement, ImageElement, SlideDesign, TextElement } from "@/lib/design/types"
import { trendBrandName } from "@/lib/report/report-texts"

const byName = (d: SlideDesign, name: string) => d.elements.find((e) => e.name === name) as DesignElement
const SHADOW = { enabled: true, color: "rgba(0, 0, 0, 0.25)", blur: 6.5, offsetX: 0, offsetY: 4 }

describe("News Article: New Template (1126 × 1408) for Homes.ph CARAGA (Figma \"post\")", () => {
  const d = buildCaragaPortraitNews({ headline: "Radisson RED Cebu Makes Historic Debut" })

  it("is the CSS: Homes.ph blue, photo frame, white H, headline and footer group", () => {
    expect([d.width, d.height, d.background, d.templateId]).toEqual([1126, 1408, "#1428AE", "caraga-portrait-news"])
    expect(byName(d, "Photo Frame")).toMatchObject({ x: 50, y: 188, width: 1026, height: 785, cornerRadius: 30, fill: { type: "solid", color: "#D9D9D9" } })
    expect(byName(d, "Photo")).toMatchObject({ role: "background", x: 50, y: 188, width: 1026, height: 785, cornerRadius: 30, fit: "cover" })
    // left: calc(50% - 116px/2) = 505, top 37.
    expect(byName(d, "Homes.ph Logo")).toMatchObject({ src: "/brand/homes-ph-logo-white.png", x: 505, y: 37, width: 116, height: 114 })
    expect(byName(d, "Headline")).toMatchObject({
      text: "Radisson RED Cebu Makes Historic Debut",
      x: 50,
      y: 1018,
      width: 1026,
      fontFamily: "Outfit",
      fontSize: 65,
      fontWeight: 600,
      lineHeight: 90,
      letterSpacing: 0,
      align: "center",
      fill: "#FFFFFF",
      shadow: SHADOW,
    })
    // Group 484879 (868 × 34 at 129, 1346): icon, www.homes.ph at 173 / 1347, icon at 471, Facebook at 515 / 1350.
    expect(byName(d, "Website icon")).toMatchObject({ x: 129, y: 1346, width: 34, height: 34 })
    expect(byName(d, "Website")).toMatchObject({ text: "www.homes.ph", x: 173, y: 1347, fontSize: 35, fontWeight: 300, lineHeight: 25 })
    expect(byName(d, "Facebook icon")).toMatchObject({ x: 471, y: 1346, width: 34, height: 34 })
    expect(byName(d, "Facebook")).toMatchObject({ text: "facebook.com/homesphofficial", x: 515, y: 1350, fontSize: 35, fontWeight: 300, lineHeight: 25 })
  })

  it("three headline lines sit at y 1018 (Figma); shorter headlines stay centered there", () => {
    const three = applyTextStack(d, (el) => (el.role === "title" ? 270 : el.lineHeight))
    expect((byName(three, "Headline") as TextElement).y).toBe(1018)
    const two = applyTextStack(d, (el) => (el.role === "title" ? 180 : el.lineHeight))
    expect((byName(two, "Headline") as TextElement).y).toBe(1063)
  })

  it("survives saving and loading at 1126 × 1408", () => {
    const back = normalizeDesign(JSON.parse(JSON.stringify(d)))
    expect([back.width, back.height, back.templateId]).toEqual([1126, 1408, "caraga-portrait-news"])
    expect(newsBrandOf(back)).toBe("caraga")
  })
})

describe("News Article: New Template (1126 × 1408) for PicklePlay PH", () => {
  const d = buildPickleplayPortraitNews({ headline: "Pickleball Invasion 2026 Unveils 2.3M Pesos Prize Purse" })

  it("has the background art, photo, logo, white headline and footer from the design (no box behind the headline)", () => {
    expect([d.width, d.height, d.templateId]).toEqual([1126, 1408, "pickleplay-portrait-news"])
    expect(byName(d, "News Background")).toMatchObject({ src: "/brand/news/pickleplay-background-portrait.png", x: 0, y: 0, width: 1126, height: 1408 })
    // Mask group: left/right 4.44%, top 13.35%, bottom 30.89%.
    expect(byName(d, "Photo")).toMatchObject({ x: 50, y: 188, width: 1026, height: 785 })
    // The CSS "Group" (61, 1040, 1007 × 240, white, drop shadow) is the outlined headline itself, not a box.
    expect(d.elements.some((e) => e.name === "Headline Box")).toBe(false)
    // 44.85% / 44.94% / 2.49% / 89.35%: 115 × 115 at 505, 35, box-shadow 0 4px 4px rgba(0, 0, 0, 0.38).
    expect(byName(d, "PicklePlay Logo")).toMatchObject({ x: 505, y: 35, width: 115, height: 115, shadow: { color: "rgba(0, 0, 0, 0.38)", blur: 4, offsetY: 4 } })
    // The same headline as the Homes.ph New Template.
    expect(byName(d, "Headline")).toMatchObject({ x: 50, y: 1018, width: 1026, fontFamily: "Outfit", fontSize: 65, fontWeight: 600, lineHeight: 90, letterSpacing: 0, align: "center", fill: "#FFFFFF", shadow: SHADOW })
    // No box behind it; it sizes itself to its three lines (65 px in the design, up to 82 when short).
    expect((byName(d, "Headline") as TextElement).boxFit).toEqual({ maxHeight: 270, maxSize: 65, minSize: 34, lineHeightRatio: 90 / 65, letterSpacingEm: 0, growTo: 82 })
    expect((byName(d, "Website") as TextElement).text).toBe("www.pickleplay.ph")
    expect((byName(d, "Facebook") as TextElement).text).toBe("facebook.com/pickleplayofficial")
  })

  it("keeps the footer group centered without the website running into the Facebook icon", () => {
    const web = byName(d, "Website") as TextElement
    const fbIcon = byName(d, "Facebook icon") as ImageElement
    const fb = byName(d, "Facebook") as TextElement
    // Outfit 300 at 35 px: "www.pickleplay.ph" is 287.5 px, "facebook.com/pickleplayofficial" 489.3 px.
    expect(fbIcon.x - (web.x + 287.5)).toBeGreaterThanOrEqual(55)
    const left = (byName(d, "Website icon") as ImageElement).x
    const right = fb.x + 489.3
    expect(Math.abs((left + right) / 2 - 563)).toBeLessThan(2)
  })

  it("three headline lines sit at y 1018, like the Homes.ph New Template", () => {
    const three = applyTextStack(d, (el) => (el.role === "title" ? 270 : el.lineHeight))
    expect((byName(three, "Headline") as TextElement).y).toBe(1018)
  })

  it("posts made with the white box (1.33.0) lose it when opened; text and photo stay", () => {
    const boxed: SlideDesign = {
      ...d,
      elements: [
        ...d.elements.slice(0, 3),
        { ...d.elements[0], type: "shape", name: "Headline Box", role: "overlay", x: 61.1, y: 1040, width: 1007.4, height: 240.2, cornerRadius: 30, fill: { type: "solid", color: "#FFFFFF" } } as DesignElement,
        ...d.elements.slice(3).map((e) =>
          e.type === "text" && e.role === "title"
            ? ({ ...e, x: 95.1, y: 1058, width: 939.4, fontSize: 56, lineHeight: 68, letterSpacing: -0.56, fill: "#091B5C", shadow: { ...e.shadow, enabled: false }, boxFit: { maxHeight: 204, maxSize: 56, minSize: 36 } } as TextElement)
            : e,
        ),
      ],
      stack: { ...d.stack!, center: 1160.1, minTop: 1044, maxBottom: 1276.2 },
    }
    const back = normalizeDesign(JSON.parse(JSON.stringify(boxed)))
    expect(back.elements.some((e) => e.name === "Headline Box")).toBe(false)
    expect(byName(back, "Headline")).toMatchObject({ text: "Pickleball Invasion 2026 Unveils 2.3M Pesos Prize Purse", x: 50, y: 1018, width: 1026, fontSize: 65, lineHeight: 90, fill: "#FFFFFF", shadow: SHADOW })
    // The white box's own fit (204 px) goes; the design's three-line fit takes its place.
    expect((byName(back, "Headline") as TextElement).boxFit).toMatchObject({ maxHeight: 270, maxSize: 65, growTo: 82 })
    expect(back.stack).toMatchObject({ center: 1153, minTop: 985, maxBottom: 1336 })
    expect(back.elements).toHaveLength(d.elements.length)
  })
})

describe("New Template is the default, Old Template the second button", () => {
  it("lists New Template 1126x1408 first and Old Template 1408x1408 second", () => {
    for (const brand of ["pickleplay", "caraga", "gensan"] as const) {
      expect(articleTemplatesFor(brand).map((t) => `${t.name} ${t.width}x${t.height}`)).toEqual(["New Template 1126x1408", "Old Template 1408x1408"])
    }
  })

  it("switching templates keeps the headline and photo", () => {
    const photo = { src: "https://example.com/photo.jpg", naturalWidth: 1600, naturalHeight: 1000 }
    const old = applyNewsChange(getNewsTemplate("caraga-news")!.build({ headline: "Butuan Opens A New Park" }), { photo })
    const next = applyNewsChange(old, { templateId: "caraga-portrait-news" })
    expect([next.templateId, next.width, newsHeadline(next)]).toEqual(["caraga-portrait-news", 1126, "Butuan Opens A New Park"])
    expect(next.elements.find((e) => e.type === "image" && e.role === "background")).toMatchObject({ src: photo.src, x: 50, y: 188 })
  })
})

describe("Homes.ph Gensan", () => {
  it("is a daily brand on News Article and the Daily Report, with CARAGA's posting times", () => {
    expect(NEWS_BRANDS.find((b) => b.id === "gensan")).toEqual({ id: "gensan", name: "Homes.ph Gensan", site: "homes.ph" })
    expect(isDailyBrand("gensan")).toBe(true)
    expect(newsTimesFor("gensan")).toBe(CARAGA_TIMES)
    const d = getNewsTemplate("gensan-portrait-news")!.build({ headline: "GenSan Airport Expansion Begins" })
    expect([d.templateId, d.width, d.background]).toEqual(["gensan-portrait-news", 1126, "#1428AE"])
    expect(newsBrandOf(d)).toBe("gensan")
    expect(newsBrandOf(getNewsTemplate("gensan-news")!.build())).toBe("gensan")
  })

  it("has its own Poster Maker tab (the Homes.ph poster) and Daily Trend News name", () => {
    expect(POSTER_TEMPLATE_IDS.gensan).toBe("gensan-poster-news")
    const poster = buildHomesPoster({ headline: "GenSan Port Expansion" }, "gensan-poster-news")
    expect(isPosterTemplate(poster.templateId)).toBe(true)
    expect(newsBrandOf(poster)).toBe("gensan")
    expect(posterBrandOf(poster)).toBe("gensan")
    expect(posterBrandOf(buildHomesPoster())).toBe("homes")
    expect(trendBrandName("gensan")).toBe("Homes.ph Gensan")
    expect(trendBrandName("homes")).toBe("Homes.ph CARAGA")
    // Same Homes.ph design.
    expect(poster.elements.map((e) => e.name)).toEqual(buildHomesPoster().elements.map((e) => e.name))
  })

  it("is a carousel brand with the Homes.ph design", () => {
    expect(CAROUSEL_BRANDS.map((b) => b.id)).toContain("gensan")
    const cover = buildBrandCover("gensan", DEFAULT_TEMPLATE_CONTEXT)
    const card = buildBrandCard("gensan")
    expect([cover.templateId, card.templateId]).toEqual(["gensan-cover", "gensan-card"])
    expect(carouselBrandOf("gensan-cover")).toBe("gensan")
    expect(cover.elements.map((e) => e.name)).toEqual(buildBrandCover("homes", DEFAULT_TEMPLATE_CONTEXT).elements.map((e) => e.name))
  })

  it("has the team's six keyword lists, each keyword once, General Santos City only (1.47)", () => {
    const k = DEFAULT_TREND_KEYWORDS.gensan
    expect(k).toHaveLength(79)
    expect(new Set(k.map((x) => x.toLowerCase())).size).toBe(79)
    expect(k[0]).toBe("General Santos City Real Estate")
    for (const x of ["GenSan Economic Growth", "GenSan Commercial Properties", "GenSan Airport Development", "GenSan Real Estate Growth"]) {
      expect(k.filter((y) => y === x)).toHaveLength(1)
    }
    // The keywords for Koronadal, Polomolok, South Cotabato, Sarangani… were taken out.
    expect(k.filter((x) => /soccsksargen|cotabato|koronadal|sarangani|polomolok|lake sebu|t'?boli|tampakan|maitum/i.test(x))).toEqual([])
  })

  it("searches the whole Philippine web for General Santos news, homes.ph left out", () => {
    expect(keywordQuery("GenSan Airport Development", "gensan")).toBe("GenSan Airport Development news")
    // Another town gets "General Santos City" added (and the list never searches one: see trend-area tests).
    expect(keywordQuery("Koronadal City Properties", "gensan")).toBe("Koronadal City Properties General Santos City news")
    expect(keywordQuery("House and Lot Packages", "gensan")).toBe("House and Lot Packages General Santos City news")
    const req = { task: "trend-search" as const, brand: "gensan" as const, keywords: [...DEFAULT_TREND_KEYWORDS.gensan], day: "2026-11-09", days: 2, avoid: [] }
    const queries = trendQueries(req, () => 0.5)
    expect(queries).toHaveLength(5)
    expect(queries[0]).toMatchObject({ query: "General Santos City Real Estate news", topic: "general", country: "philippines", exclude: ["homes.ph", ...PH_LISTING_SITES] })
    expect(queries[0].exclude).toContain("rent.ph")
  })

  it("sends every keyword, and the prompt names the first one and 23 others", () => {
    const parsed = parseAiRequest({ task: "trend-search", brand: "gensan", keywords: DEFAULT_TREND_KEYWORDS.gensan, day: "2026-11-09", days: 2, avoid: [] })
    expect(typeof parsed).toBe("object")
    expect((parsed as { keywords: string[] }).keywords).toHaveLength(79)
    const some = promptKeywords([...DEFAULT_TREND_KEYWORDS.gensan], () => 0.3)
    expect(some).toHaveLength(24)
    expect(some[0]).toBe("General Santos City Real Estate")
    expect(new Set(some).size).toBe(24)
    expect(promptKeywords([...DEFAULT_TREND_KEYWORDS.homes])).toEqual(DEFAULT_TREND_KEYWORDS.homes)
  })
})

describe("FHI Global Property alternates its News Article templates by day", () => {
  it("Portrait on 2026-11-10 (the day it started), Wide the next day, and so on; other brands keep their first", async () => {
    const { defaultArticleTemplate } = await import("@/lib/design/news-templates")
    const day = (d: number) => new Date(2026, 10, d, 15, 0)
    expect([10, 11, 12, 13].map((d) => defaultArticleTemplate("fhi", day(d)).id)).toEqual(["fhi-portrait-news", "fhi-wide-news", "fhi-portrait-news", "fhi-wide-news"])
    expect(defaultArticleTemplate("fhi", day(9)).id).toBe("fhi-wide-news")
    expect(defaultArticleTemplate("fhi", new Date(2026, 11, 1)).id).toBe("fhi-wide-news")
    for (const brand of ["pickleplay", "caraga", "gensan"] as const) for (const d of [10, 11]) expect(defaultArticleTemplate(brand, day(d)).id).toBe(`${brand}-portrait-news`)
  })
})
