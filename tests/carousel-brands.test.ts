import { describe, expect, it } from "vitest"
import { carouselText } from "@/lib/ai/client"
import { prompt } from "@/lib/ai/groq"
import { parseAiRequest } from "@/lib/ai/validate"
import { cardDesign } from "@/lib/carousel-from-article"
import {
  BUILT_IN_TEMPLATES,
  buildCardDesign,
  buildCoverDesign,
  CAROUSEL_BRANDS,
  carouselBrandOf,
  carouselBrandOfSlides,
  DEFAULT_TEMPLATE_CONTEXT,
  getBuiltInTemplate,
  isCarouselBrand,
  isCarouselCover,
  isContentCard,
  rebrandDesign,
  summarizeDesign,
  type CarouselBrand,
} from "@/lib/design/templates"
import type { ImageElement, SlideDesign, TextElement } from "@/lib/design/types"

const ctx = DEFAULT_TEMPLATE_CONTEXT
const BRANDS: CarouselBrand[] = ["homes", "gensan", "fhi", "pickleplay"]
const text = (d: SlideDesign, role: string) => d.elements.find((e): e is TextElement => e.type === "text" && e.role === role)
const image = (d: SlideDesign, name: string) => d.elements.find((e): e is ImageElement => e.type === "image" && e.name === name)
const texts = (d: SlideDesign) => d.elements.filter((e): e is TextElement => e.type === "text").map((e) => e.text)

describe("Carousel brands: FHI Global Property and PicklePlay templates in the Homes.ph layout", () => {
  it("lists Homes.ph first (the default) with each brand's palette", () => {
    expect(CAROUSEL_BRANDS.map((b) => b.id)).toEqual(BRANDS)
    expect(CAROUSEL_BRANDS.find((b) => b.id === "fhi")).toMatchObject({ name: "FHI Global Property", accent: "#F8C563", dark: "#001F3F" })
    expect(CAROUSEL_BRANDS.find((b) => b.id === "pickleplay")).toMatchObject({ name: "PicklePlay", accent: "#AFD137", dark: "#0A2CAA" })
    expect(isCarouselBrand("fhi")).toBe(true)
    expect(isCarouselBrand("homes.ph")).toBe(false)
    expect(isCarouselBrand(null)).toBe(false)
  })

  it("has a cover and a card template for every brand", () => {
    for (const id of ["homes-cover", "homes-card", "fhi-cover", "fhi-card", "pickleplay-cover", "pickleplay-card"]) expect(getBuiltInTemplate(id)).toBeTruthy()
    expect(BUILT_IN_TEMPLATES.filter((t) => t.brand === "fhi").map((t) => t.slideType)).toEqual(["cover", "card"])
    expect(BUILT_IN_TEMPLATES.filter((t) => t.brand === "pickleplay").map((t) => t.slideType)).toEqual(["cover", "card"])
  })

  it("defaults to Homes.ph: the Homes.ph cover and card are unchanged", () => {
    expect(buildCoverDesign(ctx).templateId).toBe("homes-cover")
    expect(buildCardDesign().templateId).toBe("homes-card")
    expect(image(buildCoverDesign(ctx), "Top Right Swoosh")!.src).not.toContain("/brand/carousel/")
  })

  it("keeps the same layout: same element names, positions and title stack in every brand", () => {
    const homes = buildCoverDesign(ctx, { white: "Lights, Land,", yellow: "And Endless Views.", description: "6 lighthouses" })
    for (const brand of ["fhi", "pickleplay"] as const) {
      const cover = buildCoverDesign(ctx, { white: "Lights, Land,", yellow: "And Endless Views.", description: "6 lighthouses" }, brand)
      expect(cover.templateId).toBe(`${brand}-cover`)
      for (const role of ["headline", "highlight", "description"]) {
        const a = text(homes, role)!
        const b = text(cover, role)!
        expect([b.x, b.y, b.width, b.fontSize, b.fontWeight, b.text]).toEqual([a.x, a.y, a.width, a.fontSize, a.fontWeight, a.text])
      }
      expect(cover.stack?.items).toHaveLength(3)
      expect(cover.titleFit?.headlineIds).toHaveLength(2)
      const card = buildCardDesign(brand)
      expect(card.templateId).toBe(`${brand}-card`)
      expect(["title", "subtitle", "description"].map((r) => text(card, r)!.y)).toEqual(["title", "subtitle", "description"].map((r) => text(buildCardDesign(), r)!.y))
    }
  })

  it("recolors the swoosh, the headline gradient, the subtitle and the background for each brand", () => {
    const fhi = buildCoverDesign(ctx, undefined, "fhi")
    const pp = buildCoverDesign(ctx, undefined, "pickleplay")
    expect(image(fhi, "Top Right Swoosh")!.src).toBe("/brand/carousel/fhi-top-right-swoosh.png")
    expect(image(fhi, "Top Left Swoosh")!.src).toBe("/brand/carousel/fhi-top-left-swoosh.png")
    expect(image(pp, "Top Right Swoosh")!.src).toBe("/brand/carousel/pickleplay-top-right-swoosh.png")
    expect(text(fhi, "highlight")!.fill).toBe("#F8C563")
    expect(text(pp, "highlight")!.fill).toBe("#AFD137")
    expect(fhi.background).toBe("#001F3F")
    expect(pp.background).toBe("#0A2CAA")
    expect(text(buildCardDesign("fhi"), "subtitle")!.fill).toBe("#F3E3B5")
    expect(text(buildCardDesign("pickleplay"), "subtitle")!.fill).toBe("#E3F3A6")
  })

  it("uses the brand's logo and footer (not the Homes.ph ones)", () => {
    const fhi = buildCoverDesign(ctx, undefined, "fhi")
    const pp = buildCoverDesign(ctx, undefined, "pickleplay")
    expect(texts(fhi)).toEqual(expect.arrayContaining(["www.fhiglobal.ae", "facebook.com/fhiglobal"]))
    expect(texts(pp)).toEqual(expect.arrayContaining(["www.pickleplay.ph", "facebook.com/pickleplayofficial"]))
    expect(texts(fhi).join(" ")).not.toContain("homes.ph")
    // The brand logos are fixed artwork (role icon): a template switch never takes them for a custom logo.
    for (const d of [fhi, pp, buildCardDesign("fhi"), buildCardDesign("pickleplay")]) {
      expect(d.elements.some((e) => e.type === "image" && e.role === "logo")).toBe(false)
      expect(d.elements.some((e) => e.type === "image" && e.role === "icon" && /fhi|pickleplay/i.test(e.src ?? ""))).toBe(true)
    }
  })

  it("tells the brand of a template, a card and a whole carousel", () => {
    expect(carouselBrandOf("fhi-card")).toBe("fhi")
    expect(carouselBrandOf("pickleplay-cover")).toBe("pickleplay")
    expect(carouselBrandOf("homes-card")).toBe("homes")
    expect(carouselBrandOf(undefined)).toBe("homes")
    expect(carouselBrandOf("text-card")).toBe("homes")
    expect(isContentCard("pickleplay-card")).toBe(true)
    expect(isContentCard("homes-cover")).toBe(false)
    expect(isCarouselCover("fhi-cover")).toBe(true)
    expect(carouselBrandOfSlides([buildCoverDesign(ctx, undefined, "fhi"), buildCardDesign("fhi")])).toBe("fhi")
    expect(carouselBrandOfSlides([{ templateId: "text-card" }, buildCardDesign("pickleplay")])).toBe("pickleplay")
    expect(carouselBrandOfSlides([])).toBe("homes")
  })
})

describe("Carousel brands: Edit carousel → apply a brand to all slides", () => {
  const homesCover = () => {
    const d = buildCoverDesign(ctx, { white: "Older Than", yellow: "Our Stories.", description: "6 giant trees to protect" })
    return {
      ...d,
      elements: d.elements.map((e) =>
        e.type === "image" && e.role === "background" ? ({ ...e, src: "https://res.cloudinary.com/x/tree.jpg", zoom: 1.4, focusX: 0.3 } as ImageElement) : e,
      ),
    }
  }

  it("moves a cover's words and photo into the brand's template", () => {
    const next = rebrandDesign(homesCover(), "pickleplay", ctx)
    expect(next.templateId).toBe("pickleplay-cover")
    expect(text(next, "headline")!.text).toBe("Older Than")
    expect(text(next, "highlight")!.text).toBe("Our Stories.")
    expect(text(next, "highlight")!.fill).toBe("#AFD137")
    expect(text(next, "description")!.text).toBe("6 giant trees to protect")
    const photo = next.elements.find((e): e is ImageElement => e.type === "image" && e.role === "background")!
    expect([photo.src, photo.zoom, photo.focusX]).toEqual(["https://res.cloudinary.com/x/tree.jpg", 1.4, 0.3])
    expect(summarizeDesign(next).title).toBe("Older Than")
  })

  it("moves a card's title, subtitle and description, and goes back to Homes.ph", () => {
    const card = cardDesign({ title: "Balete Tree", subtitle: "Lazi, Siquijor", description: "Over 400 years old, with a spring at its roots." }, "homes")
    const fhi = rebrandDesign(card, "fhi", ctx)
    expect(fhi.templateId).toBe("fhi-card")
    expect([text(fhi, "title")!.text, text(fhi, "subtitle")!.text, text(fhi, "description")!.text]).toEqual([
      "Balete Tree",
      "Lazi, Siquijor",
      "Over 400 years old, with a spring at its roots.",
    ])
    const back = rebrandDesign(fhi, "homes", ctx)
    expect(back.templateId).toBe("homes-card")
    expect(text(back, "subtitle")!.text).toBe("Lazi, Siquijor")
    expect(text(back, "subtitle")!.fill).toBe(text(buildCardDesign(), "subtitle")!.fill)
  })

  it("keeps what the user added on top and leaves other slides alone", () => {
    const cover = homesCover()
    const sticker: ImageElement = { ...(image(cover, "Top Right Swoosh") as ImageElement), id: "sticker1", name: "Sticker", role: undefined, src: "/sticker.png", locked: false }
    const next = rebrandDesign({ ...cover, elements: [...cover.elements, sticker] }, "fhi", ctx)
    expect(next.elements.at(-1)).toMatchObject({ name: "Sticker", src: "/sticker.png" })
    const textCard = getBuiltInTemplate("text-card")!.build(ctx)
    expect(rebrandDesign(textCard, "fhi", ctx)).toBe(textCard)
    const already = buildCardDesign("fhi")
    expect(rebrandDesign(already, "fhi", ctx)).toBe(already)
  })
})

describe("Carousel brands: the AI writes for the carousel's brand", () => {
  const ARTICLE = "Dubai Marina has new waterfront residences. ".repeat(12)

  it("accepts the brand and defaults to Homes.ph", () => {
    expect(parseAiRequest({ task: "carousel-from-article", article: ARTICLE, cards: 5, brand: "fhi" })).toMatchObject({ brand: "fhi" })
    expect(parseAiRequest({ task: "carousel-from-article", article: ARTICLE, cards: 5 })).toMatchObject({ brand: "homes" })
    expect(parseAiRequest({ task: "carousel-topics", month: "November 2026", count: 6, avoid: [], brand: "nope" })).toMatchObject({ brand: "homes" })
    expect(parseAiRequest({ task: "carousel-research", topic: "Best pickleball courts in Cebu", cards: 6, avoid: [], brand: "pickleplay" })).toMatchObject({ brand: "pickleplay" })
  })

  it("puts the brand in the instructions", () => {
    const homes = prompt({ task: "carousel-from-article", article: ARTICLE, cards: 5 }).system
    const fhi = prompt({ task: "carousel-from-article", article: ARTICLE, cards: 5, brand: "fhi" }).system
    const pp = prompt({ task: "carousel-research", topic: "Best pickleball courts in Cebu", cards: 6, avoid: [], brand: "pickleplay" }).system
    expect(homes).toContain("Homes.ph Facebook carousel")
    expect(fhi).toContain("FHI Global Property Facebook carousel")
    expect(fhi).toContain("Dubai")
    expect(pp).toContain("PicklePlay")
    expect(pp).toContain("pickleball")
    const topicsFhi = prompt({ task: "carousel-topics", month: "November 2026", count: 6, avoid: [], brand: "fhi" }).system
    expect(topicsFhi).toContain("Dubai is hot")
    expect(prompt({ task: "carousel-topics", month: "November 2026", count: 6, avoid: [] }).system).toContain("wet season")
  })

  it("the editor's AI (caption, cover subtitle, card description) follows the carousel's brand", () => {
    const slides = [{ type: "cover" as const, design: buildCoverDesign(ctx, { white: "Serve, Rally,", yellow: "And Dink All Day." }, "pickleplay") }, { type: "card" as const, design: buildCardDesign("pickleplay") }]
    const text = carouselText(slides)
    expect(text.brand).toBe("pickleplay")
    const req = parseAiRequest({ task: "caption", carousel: text })
    if (typeof req === "string") throw new Error(req)
    expect(prompt(req).system).toContain("You write copy for PicklePlay")
    expect(prompt(req).system).toContain("pickleball")
    const homes = parseAiRequest({ task: "cover-subtitle", carousel: { ...text, brand: undefined }, maxChars: 60 })
    if (typeof homes === "string") throw new Error(homes)
    expect(prompt(homes).system).toContain("You write copy for Homes.ph")
    expect(prompt({ task: "carousel-research", topic: "Dubai Marina towers", cards: 6, avoid: [], brand: "fhi" }).user).toContain("earlier FHI Global Property carousels")
  })
})
