import { describe, expect, it } from "vitest"
import { cleanCaption, cleanHashtags, parsePosterCaption, parsePosterCopy } from "@/lib/ai/headlines"
import { prompt } from "@/lib/ai/groq"
import { captionForPost } from "@/lib/ai/types"
import { parseAiRequest } from "@/lib/ai/validate"
import { applyNewsChange, newsSubtextLook } from "@/lib/data/news"
import { applyBoxFit, applyHug } from "@/lib/design/box-fit"
import { applyTextStack, type MeasureText } from "@/lib/design/layout"
import { normalizeDesign } from "@/lib/design/normalize"
import { autoSubtextHook, buildHomesPoster, buildPickleplayPoster } from "@/lib/design/templates"
import type { SlideDesign, TextElement } from "@/lib/design/types"

const ARTICLE = "PASIG CITY — The PPA Tour Asia will hold its first Philippine stop at the Pasig City Sports Center from January 22 to February 1, 2027."

describe("Facebook caption (AI)", () => {
  it("asks for a hook, the key facts, a warm close and hashtags: no emojis, human English, only facts", () => {
    const req = parseAiRequest({ task: "poster-caption", article: ARTICLE, brand: "PicklePlay PH", headline: "Pro Pickleball Comes To Pasig" })
    if (typeof req === "string") throw new Error(req)
    expect(req).toMatchObject({ task: "poster-caption", brand: "PicklePlay PH", headline: "Pro Pickleball Comes To Pasig" })
    const p = prompt(req)
    expect(p.system).toMatch(/First line: a hook/)
    expect(p.system).toMatch(/No emojis/)
    expect(p.system).toMatch(/never invent facts/)
    expect(p.system).toMatch(/Avoid these AI-sounding words/)
    expect(p.system).toMatch(/warm, positive and hopeful/)
    expect(p.user).toContain("POSTER HEADLINE: Pro Pickleball Comes To Pasig")
    expect(p.user).toContain("CAPTION:")
    expect(p.user).toContain("HASHTAGS:")
    // The poster content asks for it too (one request writes everything).
    const all = parseAiRequest({ task: "article-headline", article: ARTICLE, brand: "PicklePlay PH", count: 3 })
    if (typeof all === "string") throw new Error(all)
    expect(prompt(all).system).toMatch(/FACEBOOK CAPTION/)
    expect(prompt(all).user).toMatch(/CAPTION:\n\[hook line\]/)
    expect(typeof parseAiRequest({ task: "poster-caption", article: "Too short.", brand: "x", headline: "" })).toBe("string")
  })

  it("reads the caption and hashtags; no emojis, markdown or em dashes; ranges and the source line stay", () => {
    const answer = `SUBTEXT: Jan 22–Feb 1, 2027 | Pasig City
CAPTION:
**Over 400 players** from 15 countries are coming to Pasig 🏓 next year.
The PPA Tour Asia makes its first Philippine stop at the Pasig City Sports Center — Jan 22–Feb 1, 2027. #PPA
See you courtside!
Source: Rappler
HASHTAGS: #Pickleball #PasigCity #viral #fyp #HomesPH #Pickleball`
    const caption = parsePosterCaption(answer, "PicklePlay PH")!
    expect(caption.text).toBe(
      "Over 400 players from 15 countries are coming to Pasig next year.\n\nThe PPA Tour Asia makes its first Philippine stop at the Pasig City Sports Center, Jan 22–Feb 1, 2027.\n\nSee you courtside!\n\nSource: Rappler",
    )
    // The brand's own tag first; spam tags, repeats and another brand's tag are left out.
    expect(caption.hashtags).toEqual(["#PicklePlayPH", "#Pickleball", "#PasigCity", "#PPA"])
    expect(captionForPost(caption).endsWith("\n\n#PicklePlayPH #Pickleball #PasigCity #PPA")).toBe(true)
    // It comes with the poster content.
    expect(parsePosterCopy(`RECOMMENDED HEADLINE: Pro Pickleball Comes To Pasig\n${answer}`, "PicklePlay PH").caption).toEqual(caption)
    expect(parsePosterCaption("CAPTION:\nToo short.", "Homes.ph")).toBeNull()
  })

  it("hashtags: from a plain list too, at most 8, the brand's own swapped in for another brand's poster", () => {
    expect(cleanHashtags("real estate, Cebu City; condo living", "Homes.ph BGC Taguig")).toEqual(["#HomesPH", "#RealEstate", "#CebuCity", "#CondoLiving"])
    expect(cleanHashtags("#PicklePlayPH #Pickleball #Pasig", "Homes.ph Main Page")).toEqual(["#HomesPH", "#Pickleball", "#Pasig"])
    expect(cleanHashtags("#a1 #b #c #d #e #f #g #h #i #j #2026", "FHI Global Property")).toHaveLength(8)
    expect(cleanHashtags("#a1 #b", "FHI Global Property")[0]).toBe("#FHIGlobal")
    // The older tag isn't kept beside the new one; Rentsouq.ae has its own.
    expect(cleanHashtags("#FHIGlobalProperty #Dubai", "FHI Global Property")).toEqual(["#FHIGlobal", "#Dubai"])
    expect(cleanHashtags("#Dubai", "Rentsouq.ae")[0]).toBe("#Rentsouq")
  })

  it("cleanCaption keeps paragraphs apart and drops placeholders", () => {
    expect(cleanCaption(["[hook line]", "  Big news   for Cebu buyers .", "#Cebu #Homes", "“Quoted whole caption”"])).toEqual({
      text: "Big news for Cebu buyers.\n\nQuoted whole caption",
      tags: "#Cebu #Homes",
    })
  })
})

/** 0.5 em per character, words wrap at the width (padding counts in the height and narrows the line). */
const fakeMeasure: MeasureText = (el) => {
  const pad = el.background.enabled ? el.background.padding : 0
  const perLine = Math.max(1, Math.floor((el.width - 2 * pad) / (el.fontSize * 0.5)))
  let lines = 1
  let used = 0
  for (const word of el.text.split(/\s+/).filter(Boolean)) {
    const need = used ? used + 1 + word.length : word.length
    if (need > perLine && used) {
      lines += 1
      used = word.length
    } else used = need
  }
  return lines * el.lineHeight + 2 * pad
}
const fakeWidest = (el: TextElement) => {
  const pad = el.background.enabled ? el.background.padding : 0
  const perLine = Math.max(1, Math.floor((el.width - 2 * pad) / (el.fontSize * 0.5)))
  return Math.min(el.text.length, perLine) * el.fontSize * 0.5
}
const laidOut = (d: SlideDesign) => applyTextStack(applyHug(applyBoxFit(d, fakeMeasure), fakeWidest), fakeMeasure)
const subtextOf = (d: SlideDesign) => d.elements.find((e) => e.name === "Subtext") as TextElement
const headlineOf = (d: SlideDesign) => d.elements.find((e) => e.name === "Headline") as TextElement

describe("subtext styles", () => {
  const base = () => applyNewsChange(buildPickleplayPoster(), { headline: "Cebu Open 2026 Serves Up A Big Prize", subtext: "Nov 22, 2026 | ₱50,000 Prize Pool" })

  it("classic: the brand color, 600, sized 30–44 (as before)", () => {
    const d = laidOut(applyNewsChange(base(), { subtextStyle: "classic" }))
    expect(subtextOf(d)).toMatchObject({ fill: "#AED038", fontWeight: 600, highlight: null, hug: null })
    expect(subtextOf(d).background.enabled).toBe(false)
    expect(d.subtextStyle ?? null).toBeNull()
  })

  it("big: bolder and bigger than classic, still under the headline", () => {
    const classic = laidOut(applyNewsChange(base(), { subtextStyle: "classic" }))
    const big = laidOut(applyNewsChange(base(), { subtextStyle: "big" }))
    expect(subtextOf(big).fontWeight).toBe(700)
    expect(subtextOf(big).fontSize).toBeGreaterThan(subtextOf(classic).fontSize)
    expect(subtextOf(big).fontSize).toBeLessThanOrEqual(headlineOf(big).fontSize * 0.75)
    expect(headlineOf(big).y + fakeMeasure(headlineOf(big))).toBeLessThanOrEqual(subtextOf(big).y)
  })

  it("highlight: white, with the most interesting words in the brand color (picked, or chosen)", () => {
    const auto = applyNewsChange(base(), { subtextStyle: "highlight" })
    expect(subtextOf(auto)).toMatchObject({ fill: "#FFFFFF", highlight: { phrases: ["₱50,000"], fill: "#AED038" } })
    expect(newsSubtextLook(auto)).toEqual({ style: "highlight", hook: "" })
    const chosen = applyNewsChange(auto, { subtextHook: "Nov 22, 2026" })
    expect(subtextOf(chosen).highlight?.phrases).toEqual(["Nov 22, 2026"])
    expect(newsSubtextLook(chosen)).toEqual({ style: "highlight", hook: "Nov 22, 2026" })
    // Typing a new subtext: the automatic pick follows the text.
    expect(subtextOf(applyNewsChange(auto, { subtext: "Prices up 8% in a year", subtextStyle: "highlight", subtextHook: "" })).highlight?.phrases).toEqual(["8%"])
  })

  it("banner: dark words on a brand-colored band that hugs them; the words stay on Figma's line", () => {
    const d = laidOut(applyNewsChange(base(), { subtextStyle: "banner" }))
    const sub = subtextOf(d)
    expect(sub).toMatchObject({ fill: "#0A2CAA", background: { enabled: true, color: "#AED038", padding: 12, radius: 12 } })
    expect(sub.shadow.enabled).toBe(false)
    // Narrower than the 1003 px line, centered on it.
    expect(sub.width).toBeLessThan(1003)
    expect(sub.x + sub.width / 2).toBeCloseTo(124 + 1003 / 2, 0)
    // The band ends 12 px under the words' line (1157 + 12).
    expect(Math.abs(sub.y + fakeMeasure(sub) - 1169)).toBeLessThanOrEqual(0.5)
    expect(headlineOf(d).y + fakeMeasure(headlineOf(d))).toBeLessThanOrEqual(sub.y - 12 + 0.5)
  })

  it("survives saving, and switching brands (in the new brand's colors)", () => {
    const d = applyNewsChange(base(), { subtextStyle: "banner" })
    const back = normalizeDesign(JSON.parse(JSON.stringify(d)))
    expect(back.subtextStyle).toBe("banner")
    expect(subtextOf(back).hug).toEqual({ centerX: 625.5, maxWidth: 1003 })
    const homes = applyNewsChange(back, { templateId: "homes-poster-news" })
    expect(homes.subtextStyle).toBe("banner")
    expect(subtextOf(homes)).toMatchObject({ fill: "#0D1969", background: { enabled: true, color: "#F4AA1D" } })
    const highlight = applyNewsChange(applyNewsChange(buildHomesPoster(), { subtext: "Sep 5 | ₱1,500 tickets" }), { subtextStyle: "highlight", subtextHook: "Sep 5" })
    const fhi = applyNewsChange(highlight, { templateId: "fhi-poster-news" })
    expect(subtextOf(fhi).highlight).toEqual({ phrases: ["Sep 5"], fill: "#F8C563" })
  })

  it("picks the interesting words: an amount, a percentage, a count, else the first part", () => {
    expect(autoSubtextHook("Tickets from ₱1,500, on sale Aug 1")).toBe("₱1,500")
    expect(autoSubtextHook("Starting at AED 1.2M in Dubai")).toBe("AED 1.2M")
    expect(autoSubtextHook("Prices up 8% in a year")).toBe("8%")
    expect(autoSubtextHook("Over 400 players from 15 countries")).toBe("400 players")
    expect(autoSubtextHook("Sep 5, 2026 | SM Seaside City Cebu")).toBe("Sep 5, 2026")
    expect(autoSubtextHook("“Music is how we say thank you”")).toBe("Music is")
    expect(autoSubtextHook("")).toBe("")
  })
})
