import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { describe, expect, it } from "vitest"
import { carryLayers, hasUserLayers, isCarrier, isTemplatePart, PART_NAMES, userLayers, withTemplateLayers } from "@/lib/brand-templates/layers"
import { buildBrandPost, switchPostTemplate, withPostFields } from "@/lib/brand-templates/posts"
import { applyNewsChange, newsHeadline } from "@/lib/data/news"
import { normalizeDesign } from "@/lib/design/normalize"
import { imageElement, textElement } from "@/lib/design/templates"
import type { SlideDesign } from "@/lib/design/types"

const names = (d: SlideDesign) => d.elements.filter((e) => !isCarrier(e)).map((e) => e.name)

describe("brand posts in the editor (1.53): the template's two layers and the layers added between them", () => {
  it("a new post has its texts / photo (the template's, not layers) and the two template layers", () => {
    const d = buildBrandPost("homes-news01-poster-news")
    expect(d.elements.filter(isCarrier).map((e) => e.name)).toEqual(["Photo", "Headline", "Subtext", "Photo Credit"])
    expect(names(d)).toEqual([PART_NAMES.back, PART_NAMES.front])
    expect(d.elements.filter(isTemplatePart).map((e) => e.type === "image" && e.templatePart)).toEqual(["back", "front"])
    expect(hasUserLayers(d)).toBe(false)
  })

  it("posts saved before 1.53 get them when read (their texts and photo marked as the template's)", () => {
    const old = buildBrandPost("fhi-eng04-poster-news")
    const before = { ...old, elements: old.elements.filter((e) => !isTemplatePart(e)).map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== "carrier"))) } as SlideDesign
    const back = normalizeDesign(JSON.parse(JSON.stringify(before)))
    expect(back.elements.filter(isCarrier).map((e) => e.name)).toEqual(["Photo", "Photo 2", "Headline"])
    expect(names(back)).toEqual([PART_NAMES.back, PART_NAMES.front])
    // Read again: nothing added twice.
    expect(withTemplateLayers(back).elements).toHaveLength(back.elements.length)
  })

  it("a cut-out between the layers, and a sticker over them, stay when the post's template, texts or photo change", () => {
    let d = buildBrandPost("homes-news01-poster-news")
    const person = imageElement({ name: "Person (cut out)", src: "https://x/person.png", naturalWidth: 800, naturalHeight: 1000, x: 100, y: 200, width: 640, height: 800 })
    const sticker = textElement({ name: "Sticker", text: "NEW!" })
    const els = [...d.elements]
    els.splice(els.findIndex((e) => e.name === PART_NAMES.front), 0, person)
    d = { ...d, elements: [...els, sticker] }
    expect(hasUserLayers(d)).toBe(true)
    expect(names(d)).toEqual([PART_NAMES.back, "Person (cut out)", PART_NAMES.front, "Sticker"])
    // Poster Maker changes: headline, photo, another template.
    d = applyNewsChange(d, { headline: "BINI in Manila", photo: { src: "https://x/bini.jpg", naturalWidth: 1600, naturalHeight: 2000 } })
    expect(newsHeadline(d)).toBe("BINI in Manila")
    expect(d.elements.find((e) => e.name === "Person (cut out)")?.type === "image" && (d.elements.find((e) => e.name === "Person (cut out)") as { src: string }).src).toBe("https://x/person.png")
    const t07 = applyNewsChange(d, { templateId: "homes-news07-poster-news" })
    expect(names(t07)).toEqual([PART_NAMES.back, "Person (cut out)", PART_NAMES.front, "Sticker"])
    expect(newsHeadline(t07)).toBe("BINI in Manila")
    // An older template (another size): the layers can't come along.
    expect(applyNewsChange(d, { templateId: "homes-portrait-poster-news" }).elements.some((e) => e.name === "Person (cut out)")).toBe(false)
  })

  it("Did You Know / engagement posts keep their layers through template changes and text edits; hiding a template layer is kept", () => {
    let d = buildBrandPost("pickleplay-eng01-poster-news")
    const logo = imageElement({ name: "Court logo", src: "https://x/logo.png", naturalWidth: 300, naturalHeight: 300 })
    d = { ...d, elements: [...d.elements, logo].map((e) => (e.type === "image" && e.templatePart === "front" ? { ...e, visible: false } : e)) }
    d = withPostFields(switchPostTemplate(d, "pickleplay-eng09-poster-news"), { question: "Your *best* shot?" })
    expect(names(d)).toEqual([PART_NAMES.back, PART_NAMES.front, "Court logo"])
    expect(d.elements.find((e) => e.type === "image" && e.templatePart === "front")?.visible).toBe(false)
    // Carried onto another post of the same size only.
    expect(userLayers(carryLayers(d, buildBrandPost("pickleplay-dyk02-poster-news")))).toHaveLength(1)
    expect(userLayers(carryLayers(d, buildBrandPost("pickleplay-news01-poster-news")))).toHaveLength(0)
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
