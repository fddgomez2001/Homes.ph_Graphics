import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { describe, expect, it } from "vitest"
import { carryLayers, hasUserLayers, isCarrier, isPhotoLayer, isTemplatePart, layerName, partElement, templateLayerIds, userLayers, withTemplateLayers } from "@/lib/brand-templates/layers"
import { FILTER_PRESETS, filterCss, NO_FILTER, normalizeFilter } from "@/lib/design/filters"
import { buildBrandPost, switchPostTemplate, withPostFields } from "@/lib/brand-templates/posts"
import { applyNewsChange, newsHeadline, newsPhotoFilter } from "@/lib/data/news"
import { normalizeDesign } from "@/lib/design/normalize"
import { imageElement, textElement } from "@/lib/design/templates"
import type { DesignElement, SlideDesign } from "@/lib/design/types"

const names = (d: SlideDesign) => d.elements.filter((e) => !isCarrier(e)).map((e) => e.name)
const partOf = (e: DesignElement) => (isTemplatePart(e) ? e.templatePart : null)
const parts = (d: SlideDesign) => d.elements.filter(isTemplatePart).map((e) => e.templatePart)
const order = (d: SlideDesign) => d.elements.filter((e) => !isCarrier(e)).map((e) => partOf(e) ?? e.name)

describe("brand posts in the editor (1.54): every layer of the template's SVG, and the layers added between them", () => {
  it("a new post has its texts / photo (the template's, not layers) and the template's layers as in its file", () => {
    const d = buildBrandPost("homes-news01-poster-news")
    expect(d.elements.filter(isCarrier).map((e) => e.name)).toEqual(["Photo", "Headline", "Subtext", "Photo Credit"])
    expect(parts(d)).toEqual(["layer-background", "layer-photo", "layer-overlay", "brand-logo", "photo-credit", "text-block", "footer"])
    expect(names(d)).toEqual(["Background (gradient)", "Photo (with its top fade)", "Dark fade (for the text)", "Logo", "Photo credit", "Headline & subtext", "Footer (website, Facebook)"])
    expect(parts(buildBrandPost("bayanihan-news03-poster-news"))).toEqual(["layer-background", "frame-accents", "photo-frame", "frame-border", "decor", "brand-logo", "photo-credit", "text-block", "footer"])
    expect(parts(buildBrandPost("pickleplay-eng04-poster-news"))).toEqual(["layer-background", "photo-background", "layer-tint", "decor-ball", "brand-logo", "photo-area", "content", "footer"])
    expect(isPhotoLayer("layer-photo") && isPhotoLayer("photo-area") && !isPhotoLayer("text-block")).toBe(true)
    expect(layerName("decor-ball")).toBe("Pickleball")
    expect(hasUserLayers(d)).toBe(false)
    for (const id of ["fhi-dyk08-poster-news", "bayanihan-eng09-poster-news", "gensan-news06-poster-news"]) expect(parts(buildBrandPost(id)).length).toBeGreaterThanOrEqual(5)
  })

  it("posts saved before get them when read: 1.52 (none) and 1.53 (two: back / front, the layers between them kept between)", () => {
    const old = buildBrandPost("fhi-eng04-poster-news")
    const before = { ...old, elements: old.elements.filter((e) => !isTemplatePart(e)).map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== "carrier"))) } as SlideDesign
    const back = normalizeDesign(JSON.parse(JSON.stringify(before)))
    expect(back.elements.filter(isCarrier).map((e) => e.name)).toEqual(["Photo", "Photo 2", "Headline"])
    expect(parts(back)).toEqual(templateLayerIds(back))
    expect(withTemplateLayers(back).elements).toHaveLength(back.elements.length)
    // 1.53: carriers, back, a cut-out, front (hidden), a sticker.
    const n = buildBrandPost("homes-news07-poster-news")
    const carriers = n.elements.filter(isCarrier)
    const person = imageElement({ name: "Person", src: "https://x/p.png", naturalWidth: 10, naturalHeight: 10 })
    const sticker = textElement({ name: "Sticker", text: "NEW" })
    const v153 = { ...n, elements: [...carriers, partElement("back", 1080, 1350), person, { ...partElement("front", 1080, 1350), visible: false }, sticker] } as SlideDesign
    const up = normalizeDesign(JSON.parse(JSON.stringify(v153)))
    expect(order(up)).toEqual(["layer-background", "layer-photo", "layer-overlay", "Person", "brand-logo", "photo-credit", "text-block", "footer", "Sticker"])
    expect(up.elements.filter((e) => ["brand-logo", "text-block", "footer"].includes(partOf(e) ?? "")).every((e) => !e.visible)).toBe(true)
    expect(up.elements.find((e) => partOf(e) === "layer-photo")?.visible).toBe(true)
  })

  it("a cut-out over the photo (under the headline) and a sticker on top stay through the post's changes, over the same layers on another template", () => {
    let d = buildBrandPost("homes-news01-poster-news")
    const person = imageElement({ name: "Person (cut out)", src: "https://x/person.png", naturalWidth: 800, naturalHeight: 1000, x: 100, y: 200, width: 640, height: 800 })
    const sticker = textElement({ name: "Sticker", text: "NEW!" })
    const els = [...d.elements]
    els.splice(els.findIndex((e) => partOf(e) === "layer-overlay") + 1, 0, person)
    d = { ...d, elements: [...els, sticker] }
    expect(hasUserLayers(d)).toBe(true)
    d = applyNewsChange(d, { headline: "BINI in Manila", photo: { src: "https://x/bini.jpg", naturalWidth: 1600, naturalHeight: 2000 } })
    expect(newsHeadline(d)).toBe("BINI in Manila")
    const t06 = applyNewsChange(d, { templateId: "homes-news06-poster-news" })
    expect(order(t06)).toEqual(["layer-background", "layer-photo", "layer-overlay", "Person (cut out)", "brand-logo", "photo-credit", "text-card", "text-block", "footer", "Sticker"])
    // Split (no dark fade): over the nearest layer below it that the template has (the photo).
    const t05 = applyNewsChange(d, { templateId: "homes-news05-poster-news" })
    expect(order(t05)).toEqual(["layer-background", "layer-split-background", "layer-photo", "Person (cut out)", "brand-logo", "photo-credit", "text-block", "footer", "Sticker"])
    expect(applyNewsChange(d, { templateId: "homes-portrait-poster-news" }).elements.some((e) => e.name === "Person (cut out)")).toBe(false)
  })

  it("Did You Know / engagement posts keep their layers and hidden template layers through template changes", () => {
    let d = buildBrandPost("pickleplay-eng01-poster-news")
    const logo = imageElement({ name: "Court logo", src: "https://x/logo.png", naturalWidth: 300, naturalHeight: 300 })
    d = { ...d, elements: [...d.elements, logo].map((e) => (partOf(e) === "decor-ball" ? { ...e, visible: false } : e)) }
    d = withPostFields(switchPostTemplate(d, "pickleplay-eng09-poster-news"), { question: "Your *best* shot?" })
    expect(order(d).at(-1)).toBe("Court logo")
    expect(d.elements.find((e) => partOf(e) === "decor-ball")?.visible).toBe(false)
    expect(userLayers(carryLayers(d, buildBrandPost("pickleplay-dyk02-poster-news")))).toHaveLength(1)
    expect(userLayers(carryLayers(d, buildBrandPost("pickleplay-news01-poster-news")))).toHaveLength(0)
  })
})

describe("picture filters (1.54)", () => {
  it("presets and sliders as CSS; nothing changed = no filter; kept with the design and through template changes", () => {
    expect(filterCss(NO_FILTER)).toBe("")
    expect(normalizeFilter(NO_FILTER)).toBeNull()
    const bw = { ...FILTER_PRESETS.find((p) => p.id === "bw")!.values, preset: "bw" }
    expect(filterCss(bw)).toBe("contrast(1.120) grayscale(1.000)")
    expect(filterCss({ ...NO_FILTER, warmth: 0.5 })).toBe("sepia(0.200)")
    expect(filterCss({ ...NO_FILTER, warmth: -0.5 })).toContain("hue-rotate(-7.0deg)")
    expect(normalizeFilter({ brightness: 9, blur: -3, preset: "nope" })).toEqual({ ...NO_FILTER, brightness: 2 })
    let d = buildBrandPost("homes-news01-poster-news")
    d = applyNewsChange(d, { photo: { src: "https://x/a.jpg", naturalWidth: 10, naturalHeight: 10 }, photoFilter: bw })
    expect(newsPhotoFilter(d)?.preset).toBe("bw")
    const back = normalizeDesign(JSON.parse(JSON.stringify(d)))
    expect(newsPhotoFilter(back)).toEqual(bw)
    expect(newsPhotoFilter(applyNewsChange(back, { templateId: "homes-news09-poster-news" }))?.preset).toBe("bw")
    expect(newsPhotoFilter(applyNewsChange(back, { photoFilter: null }))).toBeNull()
  })
})

// ---------- the extension: Start Your Day's question ----------

type HPType = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
function loadHP(): HPType {
  const context: Record<string, unknown> = { URL, Date, setTimeout, clearTimeout, atob, btoa, Blob }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "chrome-extension", "shared.js"), "utf8"), context)
  return context.HP as HPType
}
const HP = loadHP()

describe("Homes.ph Publisher 1.2.1: who posts the News Articles today, Ads only with PicklePlay, the Trending lists", () => {
  const assignment = { homes: ["gensan"], sites: ["pickleplay", "fhi"], carousel: true }
  const today = HP.ymd(new Date())

  it("not answered yet: every task; answered No: only the other tasks (no News Article posting); Yes: all again", () => {
    const ids = (s: HPType) => HP.addTasks(s).map((t: { id: string }) => t.id)
    const unasked = HP.withDefaults(null, assignment, null)
    expect(HP.dutyAsked(unasked)).toBe(false)
    expect(ids(unasked)).toEqual(["pickleplay", "fhi", "gensan", "carousel", "ads", "quotes"])
    const no = HP.withDefaults(null, assignment, { day: today, news: false })
    expect(HP.newsOff(no) && HP.dutyAsked(no)).toBe(true)
    expect(ids(no)).toEqual(["carousel", "ads", "quotes"])
    expect(HP.reportTasks(no).map((t: { id: string }) => t.id)).toEqual(["carousel", "ads", "quotes", "trending"])
    expect(ids(HP.withDefaults(null, assignment, { day: today, news: true }))).toEqual(ids(unasked))
    // Yesterday's answer doesn't count today.
    expect(HP.dutyAsked(HP.withDefaults(null, assignment, { day: "2020-01-01", news: false }))).toBe(false)
  })

  it("no PicklePlay assigned: no Ads task and no Ads tab", () => {
    const s = HP.withDefaults(null, { homes: ["cebu"], sites: ["fhi"], carousel: false }, null)
    expect(HP.addTasks(s).map((t: { id: string }) => t.id)).toEqual(["fhi", "cebu", "quotes"])
    expect(HP.adPagesOf(s)).toHaveLength(0)
    expect(HP.adPagesOf(HP.withDefaults(null, assignment, null))).toHaveLength(1)
  })

  it("names a post by its list: DTN (poster), DYK (Did You Know), ENG (engagement)", () => {
    expect([HP.postTag({ n: 2 }), HP.postTag({ kind: "dyk", n: 1 }), HP.postTag({ kind: "engagement", n: 3 })]).toEqual(["DTN 2", "DYK 1", "ENG 3"])
  })
})
