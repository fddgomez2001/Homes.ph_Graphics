import { isBrandPostTemplate } from "@/lib/brand-templates/catalog"
import { describe, expect, it } from "vitest"
import { cleanSubtext, parseHeadlineOptions, parsePosterCopy } from "@/lib/ai/headlines"
import { cleanAnswer, prompt } from "@/lib/ai/groq"
import { AI_HEADERS, POSTER_AI_TASKS } from "@/lib/ai/types"
import { parseAiProvider, parseAiRequest } from "@/lib/ai/validate"
import { applyNewsChange, newsCredit, newsHeadline, newsHighlight, newsPage } from "@/lib/data/news"
import { applyBoxFit, fitBoxSize } from "@/lib/design/box-fit"
import { shapeAttrs } from "@/lib/design/konva-attrs"
import type { MeasureText } from "@/lib/design/layout"
import {
  DEFAULT_HOMES_PAGES,
  isDailyBrand,
  isPosterTemplate,
  NEWS_BRANDS,
  newsBrandOf,
  newsFileName,
  newsPostLabel,
  newsTemplatesFor,
  POSTER_TEMPLATE_IDS,
} from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildHomesPoster, buildPickleplayPoster } from "@/lib/design/templates"
import type { ImageElement, ShapeElement, SlideDesign, TextElement } from "@/lib/design/types"

const HEADLINE = "More than 600 cyclists take on Pampanga’s dirt roads at Gravelton Clark 2026"
const byName = <T,>(d: SlideDesign, name: string) => d.elements.find((e) => e.name === name) as T
const headlineOf = (d: SlideDesign) => byName<TextElement>(d, "Headline")

/**
 * A rough stand-in for Konva's text layout: League Spartan bold caps average about
 * 0.5 em (the Figma sample headline is three lines in the 1006 px box),
 * words wrap at the element's width, height = lines × line height.
 */
const fakeMeasure: MeasureText = (el) => {
  const perLine = Math.max(1, Math.floor(el.width / (el.fontSize * 0.5)))
  let lines = 1
  let used = 0
  for (const word of el.text.split(/\s+/).filter(Boolean)) {
    const need = used ? used + 1 + word.length : word.length
    if (need > perLine && used) {
      lines += 1
      used = word.length
    } else used = need
  }
  return lines * el.lineHeight
}

describe("Homes.ph poster (Figma Pickleplay Poster, Homes.ph version)", () => {
  const d = buildHomesPoster({ headline: HEADLINE })

  it("navy base, photo at 50%, the Homes.ph blue gradient at 70%", () => {
    expect(byName<ShapeElement>(d, "Base").fill).toEqual({ type: "solid", color: "#2D59A8" })
    expect(byName<ShapeElement>(d, "Brand Gradient")).toMatchObject({
      opacity: 0.7,
      fill: {
        type: "linear",
        angle: 180.51,
        stops: [
          { offset: 0, color: "#1428AE" },
          { offset: 0.1932, color: "#1428AE" },
          { offset: 0.9249, color: "#0D1969" },
          { offset: 1, color: "#0D1969" },
        ],
      },
    })
  })

  it("the white H (left/right 45.3%, 115 tall at y 35), the card with a 6 px #F4AA1D border", () => {
    expect(byName<ImageElement>(d, "Homes.ph Logo")).toMatchObject({ x: 568.06, y: 35, width: 117.88, height: 115, src: "/brand/homes-ph-logo-white.png", fit: "contain" })
    expect(byName<ShapeElement>(d, "Photo Card")).toMatchObject({ x: 125, y: 229, width: 1003, height: 661, fill: { type: "solid", color: "#FFFFFF" }, shadow: { blur: 50, offsetY: 20 } })
    expect(byName<ShapeElement>(d, "Photo Border")).toMatchObject({ x: 128, y: 232, width: 997, height: 655, stroke: { color: "#F4AA1D", width: 6 } })
    expect(byName<ShapeElement>(d, "Photo Border").stroke?.gradient).toBeUndefined()
  })

  it("the homes.ph footer and the photo credit", () => {
    expect(byName<TextElement>(d, "Website")).toMatchObject({ text: "www.homes.ph", x: 338, y: 1195, fontFamily: "Inter", fontSize: 24, lineHeight: 34 })
    expect(byName<TextElement>(d, "Facebook")).toMatchObject({ text: "facebook.com/homesphofficial", x: 577, y: 1196, fontFamily: "Poppins", fontSize: 24, lineHeight: 30 })
    expect(byName<ImageElement>(d, "Website icon")).toMatchObject({ x: 309.99, y: 1200.96, width: 24, height: 24 })
    expect(byName<ImageElement>(d, "Facebook icon")).toMatchObject({ x: 545.99, y: 1199.2, width: 24, height: 24 })
    expect(byName<TextElement>(d, "Photo Credit")).toMatchObject({ y: 890, align: "right", visible: false })
  })

  it("is a poster of the Homes.ph brand, which isn't a daily brand", () => {
    expect(newsBrandOf(d)).toBe("homes")
    expect(isPosterTemplate(d.templateId)).toBe(true)
    expect(POSTER_TEMPLATE_IDS.homes).toBe("homes-poster-news")
    // 1.50: the other Homes.ph pages' News Article templates (the Homes.ph design), then the posters.
    // (1.52: the brand post templates come last: tests/brand-posts.test.ts.)
    expect(newsTemplatesFor("homes").map((t) => t.id).filter((id) => !isBrandPostTemplate(id))).toEqual([
      "homes-portrait-news",
      "homes-news",
      "homes-portrait-poster-news",
      "homes-poster-news",
      // 1.51: the poster designs 1–10.
      ...Array.from({ length: 10 }, (_, i) => `homes-d${i + 1}-poster-news`),
    ])
    expect(isDailyBrand("homes")).toBe(false)
    expect(NEWS_BRANDS.map((b) => b.id)).toEqual(["pickleplay", "fhi", "caraga", "gensan"])
  })
})

describe("Homes.ph page of a poster", () => {
  it("lists the 17 Homes.ph pages of the posting checklist", () => {
    expect(DEFAULT_HOMES_PAGES).toHaveLength(17)
    expect(DEFAULT_HOMES_PAGES.slice(0, 5)).toEqual(["Homes.ph Main Page", "Homes.ph Ozamiz", "Homes.ph Dumaguete", "Homes.ph BGC Taguig", "Homes.ph Cebu"])
  })

  it("names files and lists without repeating Homes.ph", () => {
    expect(newsPostLabel("homes", "Homes.ph BGC Taguig")).toBe("Homes.ph BGC Taguig")
    expect(newsPostLabel("homes", "BGC Taguig")).toBe("Homes.ph BGC Taguig")
    expect(newsPostLabel("homes", "")).toBe("Homes.ph")
    expect(newsPostLabel("pickleplay")).toBe("PicklePlay PH")
    expect(newsFileName(new Date("2026-11-05T00:00:00"), { time: "09:00", label: "9 AM" }, newsPostLabel("homes", "Homes.ph Cebu"))).toBe("2026-11-05 9AM Homes.ph Cebu.png")
  })

  it("is saved on the design, survives loading, and stays only on Homes.ph", () => {
    const withPage = applyNewsChange(buildHomesPoster(), { headline: HEADLINE, page: "  Homes.ph   BGC Taguig " })
    expect(newsPage(withPage)).toBe("Homes.ph BGC Taguig")
    expect(newsPage(normalizeDesign(JSON.parse(JSON.stringify(withPage))))).toBe("Homes.ph BGC Taguig")
    // FHI and PicklePlay posters have no page; back on Homes.ph the page is given again.
    const pp = applyNewsChange(withPage, { templateId: "pickleplay-poster-news" })
    expect(newsPage(pp)).toBe("")
    expect(newsHeadline(pp)).toBe(HEADLINE)
    expect(newsPage(applyNewsChange(withPage, { page: null }))).toBe("")
  })

  it("switching to Homes.ph keeps the photo, headline, highlight and credit", () => {
    const photo = { src: "https://example.com/p.jpg", naturalWidth: 1600, naturalHeight: 900 }
    const pp = applyNewsChange(buildPickleplayPoster(), { photo, headline: HEADLINE, highlight: ["Gravelton Clark 2026"], credit: { enabled: true, name: "Frank Gomez" } })
    const homes = applyNewsChange(pp, { templateId: "homes-poster-news", page: "Homes.ph Cebu" })
    expect(homes.templateId).toBe("homes-poster-news")
    expect(homes.elements.filter((e) => e.type === "image" && e.role === "background").map((e) => (e as ImageElement).src)).toEqual([photo.src, photo.src])
    expect(newsHighlight(homes)).toEqual(["Gravelton Clark 2026"])
    expect(headlineOf(homes).highlight?.fill).toBe("#F4AA1D")
    expect(newsCredit(homes)).toEqual({ enabled: true, name: "Frank Gomez" })
    expect(newsPage(homes)).toBe("Homes.ph Cebu")
  })
})

describe("poster headline fits its box (shrinks when long, grows when short)", () => {
  const sized = (text: string) => ({ ...headlineOf(buildPickleplayPoster()), text: text.toUpperCase() })
  const linesOf = (text: string, size: number) => fakeMeasure({ ...sized(text), fontSize: size, lineHeight: size }) / size

  it("a headline that fits at 68 px grows while it keeps its lines and fits the box", () => {
    // Three lines at 68 (204 px): it may grow to 77 (3 × 77 = 231), never onto a 4th line.
    const size = fitBoxSize(sized(HEADLINE), fakeMeasure)
    expect(size).toBeGreaterThanOrEqual(68)
    expect(size).toBeLessThanOrEqual(77)
    expect(linesOf(HEADLINE, size)).toBe(linesOf(HEADLINE, 68))
    // A short one grows up to 100 px.
    expect(fitBoxSize(sized("Short headline"), fakeMeasure)).toBe(100)
  })

  it("a short headline grows into the space instead of leaving a word alone on a line", () => {
    // "MANILA HOSTS PPA ASIA TOUR 2027": 2 lines at 68 px; it grows, still on 2 lines.
    const text = "Manila hosts PPA Asia Tour 2027"
    const size = fitBoxSize(sized(text), fakeMeasure)
    expect(size).toBeGreaterThan(68)
    expect(size).toBeLessThanOrEqual(100)
    expect(linesOf(text, size)).toBe(linesOf(text, 68))
    expect(linesOf(text, size + 1) > linesOf(text, 68) || size === 100 || (size + 1) * linesOf(text, size + 1) > 231).toBe(true)
    // Without growTo it stays at 68.
    const fixed = { ...sized(text), boxFit: { ...sized(text).boxFit!, growTo: undefined } }
    expect(fitBoxSize(fixed, fakeMeasure)).toBe(68)
  })

  it("shrinks long headlines until they fit, never below 24 px", () => {
    const long = `${HEADLINE} as riders from Luzon, Visayas and Mindanao race across sugarcane fields and river crossings`
    const size = fitBoxSize(sized(long), fakeMeasure)
    expect(size).toBeLessThan(68)
    expect(size).toBeGreaterThanOrEqual(24)
    const fitted = applyBoxFit({ ...buildPickleplayPoster(), elements: [{ ...sized(long) }] }, fakeMeasure)
    const el = fitted.elements[0] as TextElement
    expect(el.fontSize).toBe(size)
    // Line height stays 100%.
    expect(el.lineHeight).toBe(size)
    expect(fakeMeasure(el)).toBeLessThanOrEqual(231)
    // The largest size that fits: one px more doesn't.
    expect(fakeMeasure({ ...el, fontSize: size + 1, lineHeight: size + 1 })).toBeGreaterThan(231)
    expect(fitBoxSize(sized("word ".repeat(400)), fakeMeasure)).toBe(24)
  })

  it("leaves designs without a box fit alone", () => {
    const d = buildPickleplayPoster()
    const plain = { ...d, elements: d.elements.map((e) => (e.type === "text" ? { ...e, boxFit: null } : e)) }
    expect(applyBoxFit(plain, fakeMeasure)).toBe(plain)
  })

  it("survives saving and loading", () => {
    const back = normalizeDesign(JSON.parse(JSON.stringify(buildPickleplayPoster())))
    expect(headlineOf(back).boxFit).toEqual({ maxHeight: 231, maxSize: 68, minSize: 24, lineHeightRatio: 1, letterSpacingEm: 0, growTo: 100 })
  })
})

describe("posters made before 1.17 are upgraded once", () => {
  /** A 1.16 PicklePlay poster: no gradient border, the stand-in ball, a headline without the box fit. */
  const old = () => {
    const d = buildPickleplayPoster({ headline: HEADLINE })
    return {
      ...d,
      version: 3,
      elements: d.elements
        .filter((e) => e.name !== "Photo Border")
        .map((e) =>
          e.name === "Pickleball"
            ? { ...e, x: 1049, y: 1090, width: 205, height: 164, opacity: 0.5, naturalWidth: 410, naturalHeight: 328 }
            : e.type === "text" && e.role === "title"
              ? { ...e, boxFit: undefined }
              : e,
        ),
    }
  }

  it("PicklePlay: gradient border over the photo, the Figma ball, the headline box fit", () => {
    const saved = JSON.stringify(old())
    const d = normalizeDesign(JSON.parse(saved))
    const border = byName<ShapeElement>(d, "Photo Border")
    expect(border.stroke?.gradient?.angle).toBe(181.68)
    expect(d.elements.indexOf(border)).toBe(d.elements.findIndex((e) => e.name === "Photo") + 1)
    expect(byName<ImageElement>(d, "Pickleball")).toMatchObject({ x: 1020, y: 1067, width: 234, height: 187, opacity: 1, naturalWidth: 234 })
    expect(headlineOf(d).boxFit?.maxHeight).toBe(231)
    // Same result every load (ids come from the design).
    expect(normalizeDesign(JSON.parse(saved))).toEqual(d)
    // Already upgraded: nothing is added twice.
    expect(normalizeDesign(JSON.parse(JSON.stringify(d))).elements.filter((e) => e.name === "Photo Border")).toHaveLength(1)
  })

  it("a headline box fit turned off after the upgrade stays off", () => {
    const d = normalizeDesign(JSON.parse(JSON.stringify(old())))
    const off = { ...d, elements: d.elements.map((e) => (e.type === "text" && e.role === "title" ? { ...e, boxFit: null } : e)) }
    expect(headlineOf(normalizeDesign(JSON.parse(JSON.stringify(off)))).boxFit).toBeUndefined()
  })
})

describe("gradient border drawing", () => {
  it("strokes with the gradient across the shape's own box", () => {
    const attrs = shapeAttrs(byName<ShapeElement>(buildPickleplayPoster(), "Photo Border")) as Record<string, unknown>
    expect(attrs).toMatchObject({ strokeEnabled: true, strokeWidth: 6 })
    expect(attrs.strokeLinearGradientColorStops).toEqual([0, "#AFD137", 0.2006, "#AFD137", 0.9164, "#0A2CAA", 1, "#0A2CAA"])
    // 181.68°: almost straight down, starting near the top of the 997 × 655 box.
    const start = attrs.strokeLinearGradientStartPoint as { x: number; y: number }
    const end = attrs.strokeLinearGradientEndPoint as { x: number; y: number }
    expect(start.y).toBeLessThan(0)
    expect(end.y).toBeGreaterThan(655)
  })

  it("a solid border has no gradient (and clears an old one)", () => {
    const attrs = shapeAttrs(byName<ShapeElement>(buildHomesPoster(), "Photo Border"))
    expect(attrs).toMatchObject({ stroke: "#F4AA1D", strokeWidth: 6, strokeLinearGradientColorStops: undefined })
  })
})

describe("AI: headline from an article", () => {
  const article = `${HEADLINE}. Riders from all over the country joined the second edition of the gravel race in Clark, Pampanga, on Sunday.`

  it("accepts a pasted article with sensible limits", () => {
    expect(parseAiRequest({ task: "article-headline", article: `  ${article}\r\n\r\n\r\n  More  text. `, brand: "PicklePlay PH", count: 9 })).toEqual({
      task: "article-headline",
      article: `${article}\n\n More text.`,
      brand: "PicklePlay PH",
      count: 5,
    })
    expect(parseAiRequest({ task: "article-headline", article })).toMatchObject({ brand: "Homes.ph", count: 3 })
    expect(typeof parseAiRequest({ task: "article-headline", article: "Too short." })).toBe("string")
    const huge = parseAiRequest({ task: "article-headline", article: "word ".repeat(20_000) })
    expect(typeof huge !== "string" && huge.task === "article-headline" && huge.article.length).toBeLessThanOrEqual(30_000)
  })

  it("asks for the poster category, three headlines with hook words and subtext choices of different kinds (the user's brief)", () => {
    const req = parseAiRequest({ task: "article-headline", article, brand: "PicklePlay PH", count: 3 })
    if (typeof req === "string") throw new Error(req)
    const p = prompt(req)
    // The brief: brands, categories A–P, the subtext kinds (or none), rules.
    expect(p.system).toMatch(/FHI Global Property, PicklePlay\.ph and Homes\.ph/)
    expect(p.system).toMatch(/D\. Pickleball tournaments: Tournament Date \| Venue \/ Location \| Prize Pool \/ Registration/)
    expect(p.system).toMatch(/P\. Holiday greetings/)
    expect(p.system).toMatch(/- DETAILS: for events, tournaments/)
    expect(p.system).toMatch(/- KEY POINT: for news, results/)
    expect(p.system).toMatch(/- SUMMARY: /)
    expect(p.system).toMatch(/- QUOTE: a short, striking line/)
    expect(p.system).toMatch(/- NONE: no subtext when the headline already says everything/)
    expect(p.system).toMatch(/Never invent dates, locations, prices/)
    expect(p.system).toMatch(/Never confuse the publication date with the event date/)
    expect(p.user).toContain("BRAND: PicklePlay PH")
    expect(p.user).toContain(article)
    for (const label of ["POSTER CATEGORY:", "RECOMMENDED HEADLINE:", "HOOK WORDS:", "ALTERNATIVE HEADLINES:", "SUBTEXT OPTIONS:", "SUBTEXT:"]) expect(p.user).toContain(label)
    expect(p.user).toMatch(/SUBTEXT: \[the best option copied exactly, or NONE\]/)
  })

  it("cleans markdown off the answer and keeps the labeled lines", () => {
    const raw = "```\n**BRAND:** PicklePlay.ph\n\n## POSTER CATEGORY: Pickleball Tournaments\nSUBTEXT: November 22, 2026 | Cebu City | 6 PM–9 PM • All Levels\n```"
    expect(cleanAnswer(raw, "article-headline").split("\n")).toEqual([
      "BRAND: PicklePlay.ph",
      "POSTER CATEGORY: Pickleball Tournaments",
      // En dashes and bullets stay in the subtext.
      "SUBTEXT: November 22, 2026 | Cebu City | 6 PM–9 PM • All Levels",
    ])
  })

  it("reads the recommended headline (first), the alternatives, the hook words, the category and the subtext", () => {
    const answer = `BRAND: PicklePlay.ph
POSTER CATEGORY: Pickleball Tournaments
RECOMMENDED HEADLINE: "Cebu Open 2026 Serves Up A ₱50,000 Prize Pool."
HOOK WORDS: cebu open 2026
ALTERNATIVE HEADLINES:
1. Top Players Battle For ₱50,000 At Cebu Open 2026 | ₱50,000
2. Cebu Open 2026 Opens Registration For All Levels 🏓 | not in it
3. Cebu Open 2026 Serves Up A ₱50,000 Prize Pool | duplicate
SUBTEXT: November 22, 2026 | [Venue] | Cebu City | ₱50,000 Prize Pool #pickleball`
    expect(parsePosterCopy(answer)).toEqual({
      category: "Pickleball Tournaments",
      options: [
        { headline: "Cebu Open 2026 Serves Up A ₱50,000 Prize Pool", highlight: "Cebu Open 2026" },
        { headline: "Top Players Battle For ₱50,000 At Cebu Open 2026", highlight: "₱50,000" },
        { headline: "Cebu Open 2026 Opens Registration For All Levels", highlight: "" },
      ],
      // Placeholders the AI couldn't fill are dropped; hashtags too.
      subtext: "November 22, 2026 | Cebu City | ₱50,000 Prize Pool",
      subtexts: [{ text: "November 22, 2026 | Cebu City | ₱50,000 Prize Pool", kind: "details" }],
      noSubtext: false,
      caption: null,
      details: "",
    })
  })

  it("takes values written on the next line, and answers without a subtext", () => {
    const copy = parsePosterCopy("POSTER CATEGORY:\nReal Estate News\nRECOMMENDED HEADLINE:\nBGC Condo Prices Climb 8% In 2026\nHOOK WORDS: 8%\nSUBTEXT:")
    expect(copy).toEqual({
      category: "Real Estate News",
      options: [{ headline: "BGC Condo Prices Climb 8% In 2026", highlight: "8%" }],
      subtext: "",
      subtexts: [],
      noSubtext: false,
      caption: null,
      details: "",
    })
    expect(cleanSubtext("N/A | Makati City |  ₱35,000 / Month ")).toBe("Makati City | ₱35,000 / Month")
    // Only the most important details: a long subtext loses its last parts (keeping date and place).
    expect(cleanSubtext("January–February 2027 | Pasig, Manila | PPA Tour Asia Events")).toBe("January–February 2027 | Pasig, Manila")
    expect(cleanSubtext("November 22, 2026 | Cebu City | ₱50,000 Prize Pool")).toBe("November 22, 2026 | Cebu City | ₱50,000 Prize Pool")
  })

  it("still reads the older 'headline | hook words' lines", () => {
    expect(
      parseHeadlineOptions(`More than 600 cyclists race at Gravelton Clark 2026 | gravelton clark 2026
More than 600 cyclists race at Gravelton Clark 2026 | duplicate
Pampanga's dirt roads test 600 cyclists | not in the headline
A headline without hook words`),
    ).toEqual([
      { headline: "More than 600 cyclists race at Gravelton Clark 2026", highlight: "Gravelton Clark 2026" },
      { headline: "Pampanga's dirt roads test 600 cyclists", highlight: "" },
      { headline: "A headline without hook words", highlight: "" },
    ])
    expect(parsePosterCopy("Cebu Open 2026 begins | Cebu Open 2026").options).toEqual([{ headline: "Cebu Open 2026 begins", highlight: "Cebu Open 2026" }])
  })
})

describe("AI: your own key (Poster Maker)", () => {
  const headers = (h: Record<string, string>) => new Headers(h)

  it("is only for the Poster Maker tasks", () => {
    expect(POSTER_AI_TASKS).toEqual(["article-headline", "headline-highlight", "poster-caption", "trend-details", "carousel-from-article", "carousel-research", "carousel-topics", "trend-search", "pickleball-post", "news-article", "brand-post"])
  })

  it("reads the provider, key and model from the request headers", () => {
    expect(parseAiProvider(headers({}))).toBeNull()
    expect(parseAiProvider(headers({ [AI_HEADERS.provider]: "openai", [AI_HEADERS.key]: "sk-test-1234567890" }))).toEqual({ provider: "openai", key: "sk-test-1234567890" })
    expect(parseAiProvider(headers({ [AI_HEADERS.provider]: "anthropic", [AI_HEADERS.key]: "sk-ant-1234567890", [AI_HEADERS.model]: "claude-sonnet-5-5" }))).toEqual({
      provider: "anthropic",
      key: "sk-ant-1234567890",
      model: "claude-sonnet-5-5",
    })
  })

  it("refuses unknown providers, odd keys and odd model names", () => {
    expect(typeof parseAiProvider(headers({ [AI_HEADERS.provider]: "evil", [AI_HEADERS.key]: "sk-test-1234567890" }))).toBe("string")
    expect(typeof parseAiProvider(headers({ [AI_HEADERS.provider]: "groq", [AI_HEADERS.key]: "short" }))).toBe("string")
    expect(typeof parseAiProvider(headers({ [AI_HEADERS.provider]: "groq", [AI_HEADERS.key]: "gsk_1234567890", [AI_HEADERS.model]: "a model; drop" }))).toBe("string")
    expect(typeof parseAiProvider(headers({ [AI_HEADERS.key]: "gsk_1234567890" }))).toBe("string")
  })
})
