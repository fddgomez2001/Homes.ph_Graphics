import { isBrandPostTemplate } from "@/lib/brand-templates/catalog"
import { describe, expect, it } from "vitest"
import { applyNewsChange, newsCredit, newsEvent, newsHeadline, newsHighlight } from "@/lib/data/news"
import { applyBoxFit } from "@/lib/design/box-fit"
import { applyTextStack, type MeasureText } from "@/lib/design/layout"
import { EVENT_POSTER_TEMPLATE_IDS, isEventPosterTemplate, isPosterTemplate, newsBrandOf, newsTemplatesFor } from "@/lib/design/news-templates"
import { normalizeDesign } from "@/lib/design/normalize"
import { buildPickleplayEventPoster, buildPickleplayPoster, EVENT_SAMPLE } from "@/lib/design/templates"
import type { ImageElement, ShapeElement, SlideDesign, TextElement } from "@/lib/design/types"

const HEADLINE = "PicklePlay Open 2026 serves up its biggest draw yet"
const byName = <T,>(d: SlideDesign, name: string) => d.elements.find((e) => e.name === name) as T
const line = (d: SlideDesign, name: "Event Location" | "Event Date & Time") => byName<TextElement>(d, name)

/** Rough text layout: 0.5 em per character, words wrap at the width; one line for one-line (auto-fit) text. */
const fakeMeasure: MeasureText = (el) => {
  if (el.autoFit) return el.lineHeight
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
const laidOut = (d: SlideDesign) => applyTextStack(applyBoxFit(d, fakeMeasure), fakeMeasure)

describe("PicklePlay Event Poster (location, date and time under the headline)", () => {
  const d = buildPickleplayEventPoster({ headline: HEADLINE, location: "PicklePlay Courts, BGC Taguig", when: "November 22, 2026 · 8:00 AM" })

  it("is the PicklePlay poster as is: backdrop, card with the gradient border, logo, ball, footer, credit", () => {
    const poster = buildPickleplayPoster()
    // (The event poster has LOCATION and DATE & TIME instead of the subtext line.)
    const names = (x: SlideDesign) => x.elements.map((e) => e.name).filter((n) => !n.startsWith("Event ") && n !== "Subtext")
    expect(names(d)).toEqual(names(poster))
    expect(byName<ShapeElement>(d, "Photo Border").stroke?.gradient?.angle).toBe(181.68)
    expect(byName<ImageElement>(d, "Pickleball")).toMatchObject({ x: 1020, y: 1067, width: 234, height: 187 })
    expect(byName<TextElement>(d, "Facebook").text).toBe("facebook.com/pickleplayofficial")
    expect([d.width, d.height]).toEqual([1254, 1254])
  })

  it("keeps the headline style; two lines at 68 px, smaller when longer", () => {
    expect(byName<TextElement>(d, "Headline")).toMatchObject({
      text: HEADLINE,
      fontFamily: "League Spartan",
      fontWeight: 700,
      fontSize: 68,
      lineHeight: 68,
      align: "center",
      textCase: "upper",
      highlight: { fill: "#AFD137" },
      boxFit: { maxHeight: 150, maxSize: 68 },
    })
  })

  it("LOCATION and DATE & TIME lines: Poppins 600, 28 / 38, centered, the label in lime, one line each", () => {
    for (const [name, text, label] of [
      ["Event Location", "LOCATION: PicklePlay Courts, BGC Taguig", "LOCATION:"],
      ["Event Date & Time", "DATE & TIME: November 22, 2026 · 8:00 AM", "DATE & TIME:"],
    ] as const) {
      expect(line(d, name)).toMatchObject({
        text,
        visible: true,
        fontFamily: "Poppins",
        fontWeight: 600,
        fontSize: 28,
        lineHeight: 38,
        align: "center",
        fill: "#FFFFFF",
        textCase: "upper",
        x: 227,
        width: 800,
        highlight: { phrases: [label], fill: "#AFD137" },
        autoFit: { maxWidth: 800, maxSize: 28 },
      })
    }
    // Headline, then the location, then the time, under it in that order.
    const order = d.elements.map((e) => e.name)
    expect(order.indexOf("Headline")).toBeLessThan(order.indexOf("Event Location"))
    expect(order.indexOf("Event Location")).toBeLessThan(order.indexOf("Event Date & Time"))
  })

  it("the block sits between the photo credit and the footer", () => {
    const placed = laidOut(d)
    const head = byName<TextElement>(placed, "Headline")
    const loc = line(placed, "Event Location")
    const when = line(placed, "Event Date & Time")
    expect(head.y).toBeGreaterThanOrEqual(920)
    expect(loc.y).toBe(head.y + fakeMeasure(head) + 20)
    expect(when.y).toBe(loc.y + 38 + 6)
    expect(when.y + 38).toBeLessThanOrEqual(1190)
    // A long headline shrinks instead of pushing the details into the footer.
    const long = laidOut(
      applyNewsChange(d, { headline: "More than 600 players from Luzon, Visayas and Mindanao battle it out at the PicklePlay Open 2026 in BGC" }),
    )
    expect(byName<TextElement>(long, "Headline").fontSize).toBeLessThan(68)
    expect(line(long, "Event Date & Time").y + 38).toBeLessThanOrEqual(1190)
    expect(byName<TextElement>(long, "Headline").y).toBeGreaterThanOrEqual(920)
  })

  it("is PicklePlay's event poster template", () => {
    expect(d.templateId).toBe("pickleplay-event-poster-news")
    expect(EVENT_POSTER_TEMPLATE_IDS.pickleplay).toBe(d.templateId)
    expect(isPosterTemplate(d.templateId)).toBe(true)
    expect(isEventPosterTemplate(d.templateId)).toBe(true)
    expect(isEventPosterTemplate("pickleplay-poster-news")).toBe(false)
    expect(newsBrandOf(d)).toBe("pickleplay")
    expect(newsTemplatesFor("pickleplay").map((t) => t.id).filter((id) => !isBrandPostTemplate(id))).toEqual([
      "pickleplay-portrait-news",
      "pickleplay-news",
      "pickleplay-portrait-poster-news",
      "pickleplay-portrait-event-poster-news",
      "pickleplay-poster-news",
      "pickleplay-event-poster-news",
    ])
  })
})

describe("event details (Poster Maker)", () => {
  it("are read back from the poster, without the labels", () => {
    const d = applyNewsChange(buildPickleplayEventPoster(), { event: { location: "  PicklePlay Courts,   BGC ", when: "Nov 22 · 8 AM" } })
    expect(newsEvent(d)).toEqual({ location: "PicklePlay Courts, BGC", when: "Nov 22 · 8 AM" })
    expect(newsEvent(normalizeDesign(JSON.parse(JSON.stringify(d))))).toEqual({ location: "PicklePlay Courts, BGC", when: "Nov 22 · 8 AM" })
    expect(line(normalizeDesign(JSON.parse(JSON.stringify(d))), "Event Location").autoFit?.maxWidth).toBe(800)
  })

  it("an empty one hides its line; with neither, the sample shows", () => {
    const onlyPlace = applyNewsChange(buildPickleplayEventPoster(), { event: { location: "BGC", when: "" } })
    expect(line(onlyPlace, "Event Location")).toMatchObject({ text: "LOCATION: BGC", visible: true })
    expect(line(onlyPlace, "Event Date & Time").visible).toBe(false)
    expect(newsEvent(onlyPlace)).toEqual({ location: "BGC", when: "" })
    const none = applyNewsChange(onlyPlace, { event: { location: "", when: " " } })
    expect(line(none, "Event Location")).toMatchObject({ text: `LOCATION: ${EVENT_SAMPLE.location}`, visible: true })
    expect(line(none, "Event Date & Time")).toMatchObject({ text: `DATE & TIME: ${EVENT_SAMPLE.when}`, visible: true })
    expect(newsEvent(none)).toEqual({ location: "", when: "" })
    // Only the time: its line follows the headline with the full gap.
    const onlyTime = laidOut(applyNewsChange(buildPickleplayEventPoster({ headline: "Open play night" }), { event: { location: "", when: "Fri 7 PM" } }))
    const head = byName<TextElement>(onlyTime, "Headline")
    expect(line(onlyTime, "Event Date & Time").y).toBe(head.y + fakeMeasure(head) + 20)
  })

  it("other posters have no event details and ignore them", () => {
    const d = applyNewsChange(buildPickleplayPoster(), { event: { location: "BGC", when: "Nov 22" } })
    expect(newsEvent(d)).toBeNull()
    expect(d.elements.some((e) => e.name.startsWith("Event "))).toBe(false)
  })

  it("switching News ↔ Event keeps the photo, headline, highlight and credit", () => {
    const photo = { src: "https://example.com/p.jpg", naturalWidth: 1600, naturalHeight: 900 }
    const news = applyNewsChange(buildPickleplayPoster(), { photo, headline: HEADLINE, highlight: ["PicklePlay Open 2026"], credit: { enabled: true, name: "Frank Gomez" } })
    const event = applyNewsChange(news, { templateId: "pickleplay-event-poster-news", event: { location: "BGC", when: "Nov 22" } })
    expect(event.templateId).toBe("pickleplay-event-poster-news")
    expect(event.elements.filter((e) => e.type === "image" && e.role === "background").map((e) => (e as ImageElement).src)).toEqual([photo.src, photo.src])
    expect(newsHeadline(event)).toBe(HEADLINE)
    expect(newsHighlight(event)).toEqual(["PicklePlay Open 2026"])
    expect(newsCredit(event)).toEqual({ enabled: true, name: "Frank Gomez" })
    expect(newsEvent(event)).toEqual({ location: "BGC", when: "Nov 22" })
    // Another template that also has event lines keeps them; back to News drops them.
    expect(newsEvent(applyNewsChange(event, { templateId: "pickleplay-event-poster-news" }))).toEqual({ location: "BGC", when: "Nov 22" })
    const back = applyNewsChange(event, { templateId: "pickleplay-poster-news" })
    expect(newsEvent(back)).toBeNull()
    expect(newsHeadline(back)).toBe(HEADLINE)
  })
})
