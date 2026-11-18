import { describe, expect, it } from "vitest"
import { keepRealQuotes, parsePosterCopy, parseSubtextOption } from "@/lib/ai/headlines"
import { applyNewsChange, newsPhotoFrame, newsSubtextState } from "@/lib/data/news"
import { fitZoom, frameLayout } from "@/lib/design/geometry"
import { imageDrawAttrs } from "@/lib/design/konva-attrs"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildFhiPoster, buildHomesPoster, buildPickleplayPoster } from "@/lib/design/templates"
import type { ImageElement, SlideDesign, TextElement } from "@/lib/design/types"
import { canEnhancePhoto, photoNeedsEnhance } from "@/lib/photo-enhance"

const byName = <T,>(d: SlideDesign, name: string) => d.elements.find((e) => e.name === name) as T

describe("AI subtext: details, a key point, a summary or a quote, or none", () => {
  const answer = (subtext: string) => `BRAND: PicklePlay.ph
POSTER CATEGORY: Pickleball News
RECOMMENDED HEADLINE: Philippines Wins Asian Pickleball Gold
HOOK WORDS: Asian Pickleball Gold
ALTERNATIVE HEADLINES:
1. PH Pair Strikes Gold In Mixed Doubles | Strikes Gold
2. Gold For The Philippines At The Asian Championship | Gold
SUBTEXT OPTIONS:
1. [Key point] Pair Beat Japan In Three Close Sets.
2. [Details] Nov 6, 2026 | Asian Pickleball Championship
3. [Quote] "We played for every Filipino"
${subtext}`

  it("reads the choices with their kinds, the recommended one first", () => {
    const copy = parsePosterCopy(answer("SUBTEXT: [Key point] Pair Beat Japan In Three Close Sets"))
    expect(copy.noSubtext).toBe(false)
    expect(copy.subtext).toBe("Pair Beat Japan In Three Close Sets")
    expect(copy.subtexts).toEqual([
      { text: "Pair Beat Japan In Three Close Sets", kind: "key point" },
      { text: "Nov 6, 2026 | Asian Pickleball Championship", kind: "details" },
      { text: "“We played for every Filipino”", kind: "quote" },
    ])
  })

  it("the chosen one can be any of them, written with or without its label", () => {
    const copy = parsePosterCopy(answer("SUBTEXT: Nov 6, 2026 | Asian Pickleball Championship"))
    expect(copy.subtexts[0]).toEqual({ text: "Nov 6, 2026 | Asian Pickleball Championship", kind: "details" })
    expect(copy.subtexts).toHaveLength(3)
  })

  it("reads labels written without brackets, as Groq writes them", () => {
    const copy = parsePosterCopy(`RECOMMENDED HEADLINE: BGC Condo Prices Up 8% In Q3 2026
HOOK WORDS: Up 8%
SUBTEXT OPTIONS:
1. DETAILS Nov 2026 | Bonifacio Global City
2. KEY POINT Prices reached ₱320,000 per sqm in Q3 2026
3. QUOTE "Buyers are moving fast because few new towers will be finished before 2028."
SUBTEXT: Prices reached ₱320,000 per sqm in Q3 2026`)
    expect(copy.subtexts).toEqual([
      { text: "Prices reached ₱320,000 per sqm in Q3 2026", kind: "key point" },
      { text: "Nov 2026 | Bonifacio Global City", kind: "details" },
      { text: "“Buyers are moving fast because few new towers will be finished before 2028”", kind: "quote" },
    ])
    expect(parsePosterCopy("RECOMMENDED HEADLINE: Cebu Open 2026 Is Here\nSUBTEXT: Details Nov 22, 2026 | Cebu Pickleball Center").subtext).toBe("Nov 22, 2026 | Cebu Pickleball Center")
    expect(parseSubtextOption("2. Key point Over 300 players from across the Philippines")).toEqual({ text: "Over 300 players from across the Philippines", kind: "key point" })
  })

  it("keeps only real quotes (words someone says in the article)", () => {
    const copy = parsePosterCopy(answer('SUBTEXT: [Quote] "We played for every Filipino"'))
    expect(copy.subtext).toBe("“We played for every Filipino”")
    // The article quotes the player: kept.
    expect(keepRealQuotes(copy, `MANILA — "We played for every Filipino," said the pair after the final.`)).toEqual(copy)
    // No such words, or no quotes at all in the article: dropped, the next choice is recommended.
    for (const article of ["MANILA — The pair won the final in three sets.", "MANILA — We played for every Filipino, the pair wrote online."]) {
      const kept = keepRealQuotes(copy, article)
      expect(kept.subtexts.map((o) => o.kind)).toEqual(["key point", "details"])
      expect(kept.subtext).toBe("Pair Beat Japan In Three Close Sets")
    }
  })

  it("NONE: the AI recommends a headline-only poster (the choices are still there)", () => {
    for (const none of ["SUBTEXT: NONE", "SUBTEXT: None.", "SUBTEXT: N/A", "SUBTEXT:\nNONE"]) {
      const copy = parsePosterCopy(answer(none))
      expect(copy).toMatchObject({ subtext: "", noSubtext: true })
      expect(copy.subtexts.map((o) => o.kind)).toEqual(["key point", "details", "quote"])
    }
  })

  it("cleans each kind: details keep only the key parts, quotes get quotation marks, long lines are cut at a word", () => {
    expect(parseSubtextOption("2. [Details] January–February 2027 | Pasig, Manila | PPA Tour Asia Events")).toEqual({ text: "January–February 2027 | Pasig, Manila", kind: "details" })
    expect(parseSubtextOption("- Quote: ‘Pickleball is for everyone.’")).toEqual({ text: "“Pickleball is for everyone”", kind: "quote" })
    expect(parseSubtextOption("[Summary] Summary judgment due in March #news 🏓")).toEqual({ text: "Summary judgment due in March", kind: "summary" })
    // A plain line: "|" means details, anything else a key point; a bare word at the start is just text.
    expect(parseSubtextOption("Summary of a big year for PH pickleball")).toEqual({ text: "Summary of a big year for PH pickleball", kind: "key point" })
    const long = parseSubtextOption(`[Key point] ${"Prices climb across Metro Manila ".repeat(5)}`)!
    expect(long.text.length).toBeLessThanOrEqual(90)
    expect(long.text.endsWith(" ")).toBe(false)
    expect(parseSubtextOption("[Details] N/A")).toBeNull()
  })
})

describe("poster photo: zoom out over a blurred copy", () => {
  const frame = { w: 1003, h: 661 }

  it("at 100% it covers the frame like before; zoomed out it is smaller and placed by the focus", () => {
    const cover = frameLayout(1600, 900, frame.w, frame.h, 1, 0.5, 0.5)
    expect(cover.covers).toBe(true)
    expect(cover.dest).toEqual({ x: 0, y: 0, width: frame.w, height: frame.h })
    const out = frameLayout(1600, 900, frame.w, frame.h, 0.5, 0, 1)
    expect(out.covers).toBe(false)
    expect(out.image.x).toBeCloseTo(0, 5) // left edge
    expect(out.image.y + out.image.height).toBeCloseTo(frame.h, 5) // bottom edge
    expect(out.crop).toMatchObject({ x: 0, y: 0, width: 1600, height: 900 }) // the whole photo shows
  })

  it("fit zoom shows the whole photo: a tall photo in the wide card", () => {
    const z = fitZoom(900, 1600, frame.w, frame.h)
    const fit = frameLayout(900, 1600, frame.w, frame.h, z)
    expect(fit.image.height).toBeCloseTo(frame.h, 5)
    expect(fit.image.width).toBeLessThan(frame.w)
    expect(fitZoom(1600, 900, 1600, 900)).toBe(1)
  })

  it("posters' card photo can zoom out (down to 20%); other photos can't, and the faded background never does", () => {
    const photo = { src: "https://example.com/p.jpg", naturalWidth: 900, naturalHeight: 1600 }
    for (const build of [buildFhiPoster, buildPickleplayPoster, buildHomesPoster]) {
      const d = applyNewsChange(applyNewsChange(build(), { photo }), { photoFrame: { zoom: 0.4, focusX: 0.5, focusY: 0.5 } })
      expect(newsPhotoFrame(d)).toMatchObject({ zoom: 0.4, blurFill: true, naturalWidth: 900, naturalHeight: 1600 })
      expect(newsPhotoFrame(applyNewsChange(d, { photoFrame: { zoom: 0.01, focusX: 0.5, focusY: 0.5 } }))?.zoom).toBe(0.2)
      expect(newsPhotoFrame(normalizeDesign(JSON.parse(JSON.stringify(d))))?.zoom).toBe(0.4)
    }
    const fhi = buildFhiPoster()
    expect(byName<ImageElement>(fhi, "Poster Background").blurFill).toBeUndefined()
    // A plain photo (not blur-fill) is still at least 100%.
    const plain = normalizeDesign({ ...fhi, elements: fhi.elements.map((e) => (e.name === "Photo" ? { ...e, blurFill: false, zoom: 0.4 } : e)) })
    expect(byName<ImageElement>(plain, "Photo").zoom).toBe(1)
  })

  it("is drawn only where the photo is (its blurred copy fills the rest)", () => {
    const el = { ...byName<ImageElement>(buildHomesPoster(), "Photo"), src: "x", naturalWidth: 900, naturalHeight: 1600, zoom: 0.5, focusX: 0.5, focusY: 0.5 }
    // A tall photo at 50%: narrower than the card (blurred copy left and right), still cropped top and bottom.
    const draw = imageDrawAttrs(el, { naturalWidth: 900, naturalHeight: 1600 })
    expect(draw.width).toBeLessThan(el.width)
    expect(draw.x).toBeCloseTo((el.width - draw.width) / 2, 5)
    expect(draw.height).toBe(el.height)
    expect(draw.crop.width).toBeCloseTo(900, 6)
    expect(draw.crop.height).toBeLessThan(1600)
  })
})

describe("posters made before 1.22 are upgraded once", () => {
  /** A 1.21 poster: one-line subtext (autoFit), photo without the blur fill. */
  const old = (d: SlideDesign): SlideDesign => ({
    ...d,
    version: 6,
    elements: d.elements.map((e) => {
      if (e.name === "Photo" && e.type === "image") return { ...e, blurFill: undefined }
      if (e.name === "Subtext" && e.type === "text") return { ...e, boxFit: null, autoFit: { maxWidth: 1003, maxSize: 30, lineHeightRatio: 1, letterSpacingEm: 0 } }
      return e
    }),
  })

  it("the subtext sizes itself and the photo can zoom out, the same way every load", () => {
    const withText = applyNewsChange(buildPickleplayPoster({ headline: "Cebu Open 2026 Serves Up A Big Prize" }), { subtext: "Nov 22, 2026 | Cebu City" })
    const saved = JSON.stringify(old(withText))
    const d = normalizeDesign(JSON.parse(saved))
    expect(byName<ImageElement>(d, "Photo").blurFill).toBe(true)
    const sub = byName<TextElement>(d, "Subtext")
    expect(sub.autoFit).toBeFalsy()
    expect(sub.boxFit).toMatchObject({ maxSize: 30, growTo: 44, maxRatioOf: { ratio: 0.5 } })
    expect(newsSubtextState(d)).toEqual({ text: "Nov 22, 2026 | Cebu City", on: true })
    expect(byName<TextElement>(d, "Headline").boxFit).toMatchObject({ maxHeight: 221, shareWith: { id: sub.id, gap: 7.5 } })
    expect(normalizeDesign(JSON.parse(saved))).toEqual(d)
  })
})

describe("photo enhancing: which photos", () => {
  it("a photo the poster would enlarge is enhanced; a big one is sharp enough", () => {
    // The card is 1003 × 661.
    expect(photoNeedsEnhance(400, 266, 1003, 661)).toBe(true)
    expect(photoNeedsEnhance(960, 640, 1003, 661)).toBe(false) // only ~4% enlarged
    expect(photoNeedsEnhance(2048, 1365, 1003, 661)).toBe(false)
    expect(canEnhancePhoto(1200, 800)).toBe(true)
    expect(canEnhancePhoto(2048, 1365)).toBe(false)
    expect(canEnhancePhoto(0, 0)).toBe(false)
  })
})
