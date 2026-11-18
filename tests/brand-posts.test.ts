import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { brandPostId, brandPostKindOf, brandPostTemplate, isBrandPostTemplate, templatesOf, templateThumb, templateSrc } from "@/lib/brand-templates/catalog"
import { TEMPLATE_FONTS, TEMPLATE_MANIFEST } from "@/lib/brand-templates/manifest"
import { buildBrandPost, creditLine, engagementFillOf, isBrandPostDesign, markPhrases, posterFillOf, switchPostTemplate, withNamedPhoto, withPostFields } from "@/lib/brand-templates/posts"
import { applyNewsChange, newsCredit, newsHeadline, newsHighlight, newsPhotoFrame, newsSubtextLook, newsSubtextState, newsTag } from "@/lib/data/news"
import { getNewsTemplate, isNewsPosterTemplate, isPosterTemplate, newsBrandName, newsBrandOf, posterKindOf } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import type { ImageElement, SlideDesign } from "@/lib/design/types"

const PUBLIC = path.join(__dirname, "..", "public")
const PHOTO = { src: "https://res.cloudinary.com/x/image/upload/v1/bini.jpg", naturalWidth: 1600, naturalHeight: 2000 }
const photo = (d: SlideDesign, name = "Photo") => d.elements.find((e): e is ImageElement => e.type === "image" && e.name === name)

describe("brand post templates (1.52): the team's SVG templates for FHI Global, Homes.ph, PicklePlay and Bayanihan", () => {
  it("every brand has 11 posters, 2 Did You Know and 7 engagement posts, with their files, fonts and gallery pictures", () => {
    expect([templatesOf("news").length, templatesOf("dyk").length, templatesOf("engagement").length]).toEqual([11, 2, 7])
    for (const brand of ["homes", "gensan", "fhi", "pickleplay", "bayanihan"] as const) {
      for (const kind of ["news", "dyk", "engagement"] as const) {
        for (const t of templatesOf(kind)) {
          const id = brandPostId(brand, kind, t.num)
          const tpl = brandPostTemplate(id)!
          expect(tpl).toMatchObject({ brand, kind })
          // Gensan (a Homes.ph page) uses the Homes.ph files.
          expect(tpl.file.startsWith(brand === "gensan" ? "homes/" : `${brand}/`)).toBe(true)
          expect(fs.existsSync(path.join(PUBLIC, templateSrc(tpl.file)))).toBe(true)
          expect(fs.existsSync(path.join(PUBLIC, templateThumb(tpl.file)))).toBe(true)
          expect([tpl.info.width, tpl.info.height]).toEqual(kind === "news" ? [1080, 1350] : [1126, 1408])
          // In the news template list: a Poster Maker post, apart from News Article; drawn by its template.
          expect(getNewsTemplate(id)?.brand).toBe(brand)
          expect(isPosterTemplate(id) && posterKindOf(id) === kind && brandPostKindOf(id) === kind).toBe(true)
          expect(isNewsPosterTemplate(id)).toBe(kind === "news")
          expect(isBrandPostDesign(buildBrandPost(id))).toBe(true)
        }
      }
    }
    expect(Object.keys(TEMPLATE_MANIFEST)).toHaveLength(80)
    for (const f of TEMPLATE_FONTS) expect(fs.existsSync(path.join(PUBLIC, "brand", "templates", "fonts", f.file))).toBe(true)
    // The older posters are still Poster posts.
    expect(posterKindOf("homes-portrait-poster-news")).toBe("news")
    expect(isBrandPostTemplate("homes-d3-poster-news")).toBe(false)
    expect(newsBrandName("bayanihan")).toBe("Bayanihan")
    // The SVGs need no internet: no Google Fonts import left.
    expect(fs.readFileSync(path.join(PUBLIC, templateSrc("homes/news-01-classic-left")), "utf8")).not.toContain("@import")
  })

  it("a news poster keeps its headline, highlighted words, subtext, gold words, credit and photo like every poster", () => {
    let d = buildBrandPost("homes-news01-poster-news")
    d = applyNewsChange(d, {
      photo: PHOTO,
      headline: "BINI wins Favorite Global Music Star",
      highlight: ["Global Music Star"],
      subtext: "At the Kids' Choice Awards 2026\nheld in Los Angeles",
      subtextHook: "Kids' Choice Awards 2026",
      credit: { enabled: true, name: "Nickelodeon" },
      page: "Homes.ph Cebu",
    })
    expect([newsHeadline(d), newsHighlight(d)]).toEqual(["BINI wins Favorite Global Music Star", ["Global Music Star"]])
    expect(newsSubtextState(d)).toEqual({ text: "At the Kids' Choice Awards 2026\nheld in Los Angeles", on: true })
    expect(newsSubtextLook(d)).toEqual({ style: "classic", hook: "Kids' Choice Awards 2026" })
    expect(newsCredit(d)).toEqual({ enabled: true, name: "Nickelodeon" })
    expect(newsPhotoFrame(d)).toMatchObject({ src: PHOTO.src, box: { x: 0, y: 0, width: 1080, height: 1350 } })
    expect(newsBrandOf(d)).toBe("homes")
    // What the template gets (the instructions' markup: *highlight*, \n, _underline_).
    expect(posterFillOf(d, "data:x")).toEqual({
      photo: { href: "data:x", naturalWidth: 1600, naturalHeight: 2000, zoom: 1, focusX: 0.5, focusY: 0.5 },
      headline: "BINI wins Favorite *Global Music Star*",
      subtext: "At the *Kids' Choice Awards 2026*\nheld in Los Angeles",
      credit: "PHOTO: Nickelodeon",
      tag: "",
    })
    // Turned off: kept, not drawn.
    expect(posterFillOf(applyNewsChange(d, { subtextOn: false }), null).subtext).toBe("")
    expect(newsSubtextState(applyNewsChange(d, { subtextOn: false }))?.text).toContain("Los Angeles")
  })

  it("template 07's tag, 11's source line and the framed photo", () => {
    let d = applyNewsChange(buildBrandPost("fhi-news07-poster-news"), { headline: "Dubai opens a new metro line" })
    expect(newsTag(d)).toBe("TRENDING NOW")
    d = applyNewsChange(d, { tag: "Breaking" })
    expect(posterFillOf(d, null).tag).toBe("Breaking")
    // Through a template without a tag and back: kept.
    d = applyNewsChange(applyNewsChange(d, { templateId: "fhi-news01-poster-news" }), { templateId: "fhi-news07-poster-news" })
    expect(newsTag(d)).toBe("Breaking")
    expect(newsTag(applyNewsChange(d, { templateId: "fhi-news01-poster-news" }))).toBeNull()
    // 11: the source, underlined.
    const t11 = brandPostTemplate("homes-news11-poster-news")!
    expect(creditLine(t11, "Manila Bulletin")).toBe("SOURCE: _Manila Bulletin_")
    expect(creditLine(t11, "Source: FB Page / _Rappler_")).toBe("Source: FB Page / _Rappler_")
    expect(buildBrandPost("homes-news11-poster-news").elements.some((e) => e.name === "Subtext")).toBe(false)
    // 03: the whole photo shows (it can zoom out over its blurred copy).
    const framed = applyNewsChange(buildBrandPost("homes-news03-poster-news"), { photo: { ...PHOTO, naturalWidth: 2000, naturalHeight: 1000 } })
    expect(photo(framed)).toMatchObject({ x: 48, y: 186, width: 984, height: 744, blurFill: true })
    expect(photo(framed)!.zoom).toBeLessThan(1)
  })

  it("switching between the older templates and the new ones keeps what was written and the photo", () => {
    let d = applyNewsChange(getNewsTemplate("homes-portrait-poster-news")!.build(), { photo: PHOTO, headline: "SB19 at the ASEAN Closing", highlight: ["SB19"], subtext: "November 12, 2026" })
    d = applyNewsChange(d, { templateId: "homes-news02-poster-news" })
    expect(isBrandPostDesign(d)).toBe(true)
    expect([newsHeadline(d), newsHighlight(d), newsSubtextState(d)?.text, photo(d)?.src]).toEqual(["SB19 at the ASEAN Closing", ["SB19"], "November 12, 2026", PHOTO.src])
    const back = applyNewsChange(d, { templateId: "homes-d4-poster-news" })
    expect(isBrandPostDesign(back)).toBe(false)
    expect(back.brandPost).toBeUndefined()
    expect(newsHeadline(back)).toBe("SB19 at the ASEAN Closing")
  })

  it("highlighting: phrases marked where they first appear; text marked by hand is kept", () => {
    expect(markPhrases("Remember the Old TOPS?", ["old tops"])).toBe("Remember the *Old TOPS*?")
    expect(markPhrases("A and B and A", ["A", "and B"])).toBe("*A* *and B* and A")
    expect(markPhrases("Cebu *Then* and Now", ["Cebu"])).toBe("Cebu *Then* and Now")
    expect(markPhrases("Nothing", ["missing"])).toBe("Nothing")
  })

  it("Did You Know and engagement posts start from the template's sample texts; their texts, photos and crop focus", () => {
    let d = buildBrandPost("bayanihan-eng04-poster-news")
    expect(d.brandPost?.fields).toMatchObject({ kicker: "THIS OR THAT", title: "Which is your go-to *Filipino dessert*?", labels: ["A · HALO-HALO", "B · LECHE FLAN"] })
    expect(newsHeadline(d)).toBe("Which is your go-to Filipino dessert?")
    d = withPostFields(d, { title: "Which *Pinoy breakfast* wins?", focus: ["top", "center"] })
    d = withNamedPhoto(withNamedPhoto(d, "Photo", PHOTO), "Photo 2", { ...PHOTO, src: "https://x/2.jpg" })
    expect(newsHeadline(d)).toBe("Which Pinoy breakfast wins?")
    const fill = engagementFillOf(d, ["data:1", "data:2"])
    expect(fill.photos.map((p) => p?.href)).toEqual(["data:1", "data:2"])
    expect(fill.focus).toEqual(["top", "center"])
    // Another template: texts and both photos stay; a field it lacks comes from its sample.
    const quiz = switchPostTemplate(d, "bayanihan-eng06-poster-news")
    expect(quiz.brandPost?.fields).toMatchObject({ title: "Which *Pinoy breakfast* wins?", options: ["Purple yam", "Taro", "Sweet potato"] })
    expect(photo(quiz)?.src).toBe(PHOTO.src)
    // Empty answers are left out (the photo grows).
    expect(engagementFillOf(withPostFields(quiz, { options: ["Tapsilog", "", "Longsilog"] }), []).options).toEqual(["Tapsilog", "Longsilog"])
    // Untouched sample texts follow the template (a new post clicked through the gallery).
    const fresh = switchPostTemplate(buildBrandPost("fhi-eng01-poster-news"), "fhi-eng04-poster-news")
    expect(fresh.brandPost?.fields).toEqual(buildBrandPost("fhi-eng04-poster-news").brandPost?.fields)
    expect(switchPostTemplate(fresh, "fhi-eng09-poster-news").brandPost?.fields).toEqual(buildBrandPost("fhi-eng09-poster-news").brandPost?.fields)
    // A 3-facts post has no photo.
    expect(buildBrandPost("homes-dyk08-poster-news").elements.some((e) => e.type === "image" && e.carrier)).toBe(false)
  })

  it("saved and read back: the template and texts stay; anything else is dropped", () => {
    const d = withPostFields(buildBrandPost("pickleplay-dyk08-poster-news"), { facts: ["One", "Two"] })
    const back = normalizeDesign(JSON.parse(JSON.stringify(d)))
    expect(back.brandPost).toEqual({ template: "pickleplay/dyk-08-did-you-know-facts", fields: d.brandPost!.fields })
    expect(back.width).toBe(1126)
    const news = normalizeDesign(JSON.parse(JSON.stringify(buildBrandPost("homes-news01-poster-news"))))
    expect([news.width, news.height, isBrandPostDesign(news)]).toEqual([1080, 1350, true])
    expect(normalizeDesign({ ...d, brandPost: { template: "../../etc", fields: {} } }).brandPost).toBeUndefined()
    expect(normalizeDesign({ ...d, brandPost: { template: "homes/x", fields: { title: 5, facts: ["a", 2, "c", "d"] } } }).brandPost).toEqual({ template: "homes/x", fields: { facts: ["a", "", "c"] } })
  })
})
