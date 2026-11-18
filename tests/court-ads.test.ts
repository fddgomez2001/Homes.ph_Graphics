import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearBackground, opaqueBox } from "@/lib/ads/court-logo"
import { AD_KINDS, adFiles, adTemplates, courtLocation, hasLogo, isCourtKind, SAMPLE_CONTENT, splitHours, type AdManifest } from "@/lib/ads/render"
import { generate } from "@/lib/ai/groq"
import { COURT_LAUNCH_RULES, parsePickleballPost, pickleballPostPrompt, PLAYER_FEATURES } from "@/lib/ai/pickleball-posts"
import { parseAiRequest } from "@/lib/ai/validate"

const manifest = JSON.parse(readFileSync("public/ads/pickleplay/manifest.json", "utf8")) as AdManifest

describe("Advertisement → PicklePlay: Coming Soon and Now Open", () => {
  it("are two new post types with 3 and 4 templates", () => {
    expect(AD_KINDS.map((k) => k.short)).toEqual(["History", "Trivia", "Fun Facts", "Court Owners", "Coming Soon", "Now Open"])
    expect(adTemplates("comingsoon")).toEqual(["comingsoon-1", "comingsoon-2", "comingsoon-3"])
    expect(adTemplates("nowopen")).toEqual(["nowopen-1", "nowopen-2", "nowopen-3", "nowopen-4"])
    expect(adTemplates("courtowner")).toHaveLength(7)
    expect(isCourtKind("comingsoon") && isCourtKind("nowopen") && !isCourtKind("courtowner")).toBe(true)
  })

  it("every court template has the court logo's place, the photo and the text (built from the Figma SVGs)", () => {
    expect(manifest.pictures.courtLogo).toBe("court-logo.png")
    for (const id of [...adTemplates("comingsoon"), ...adTemplates("nowopen")]) {
      const steps = manifest.templates[id]
      expect(steps.filter((s) => s.type === "logo")).toHaveLength(1)
      expect(steps.some((s) => s.type === "photo")).toBe(true)
      expect(steps.filter((s) => s.type === "text")).toHaveLength(1)
      expect(hasLogo(manifest, id)).toBe(true)
      expect(adFiles(manifest, id)).toContain("court-logo.png")
    }
    // Coming Soon 1: the sample logo's place (Court-Logo-REPLACE-ME: 35.8% / 27.81%, 400 × 290).
    expect(manifest.templates["comingsoon-1"].find((s) => s.type === "logo")).toMatchObject({ cx: 704, cy: 536, w: 400, h: 290, angle: 0 })
    // Now Open 4: the logo turns 3° with its card; Now Open 3's has the white drop shadow.
    expect(manifest.templates["nowopen-4"].find((s) => s.type === "logo")).toMatchObject({ angle: 3 })
    expect(manifest.templates["nowopen-3"].find((s) => s.type === "logo")).toMatchObject({ shadow: { color: "#FFFFFF", blur: 4, dy: 4 } })
    expect(hasLogo(manifest, "history-1")).toBe(false)
  })

  it("keeps the court's name, barangay and city as fields of their own", () => {
    expect(SAMPLE_CONTENT.comingsoon).toMatchObject({ courtName: "Court Name", barangay: "Barangay", city: "City", headline: "Is coming to", highlight: "Pickleplay.ph" })
    expect(SAMPLE_CONTENT.nowopen).toMatchObject({ headline: "Now open!", highlight: "Book today!", headlineIn: "Now open in", spotlight: "Mandaue" })
    expect(courtLocation({ courtName: "X", barangay: "Brgy. Tacunan", city: "Davao City" })).toBe("Brgy. Tacunan, Davao City")
    expect(courtLocation({ courtName: "X", barangay: " ", city: "Davao City" })).toBe("Davao City")
    expect(splitHours("Open daily · 6:00 AM – 10:00 PM")).toEqual(["Open daily · ", "6:00 AM – 10:00 PM"])
    expect(splitHours("Weekends only")).toEqual(["Weekends only", ""])
  })
})

describe("AI for Coming Soon and Now Open", () => {
  it("accepts the court's details and an article", () => {
    const req = parseAiRequest({ task: "pickleball-post", kind: "nowopen", topic: "", avoid: [], article: "  Bouncy Kitchen opens   12 courts.\r\n\r\n\r\nCome play! ", court: { name: " Bouncy Kitchen ", barangay: "Brgy. Tacunan", city: "Davao City", hours: "Open daily · 6 AM – 10 PM" } })
    expect(req).toMatchObject({ kind: "nowopen", court: { name: "Bouncy Kitchen", barangay: "Brgy. Tacunan", city: "Davao City", hours: "Open daily · 6 AM – 10 PM" }, article: "Bouncy Kitchen opens 12 courts.\n\nCome play!" })
    expect(parseAiRequest({ task: "pickleball-post", kind: "comingsoon", topic: "", avoid: [] })).toMatchObject({ court: { name: "", barangay: "", city: "", hours: "" } })
    expect(parseAiRequest({ task: "pickleball-post", kind: "trivia", topic: "", avoid: [], article: "x" })).not.toHaveProperty("article")
  })

  it("tells the AI the court as typed, what players get on PicklePlay and the article", () => {
    const p = pickleballPostPrompt({ kind: "nowopen", topic: "grand opening", avoid: ["Book today"], article: "Bouncy Kitchen opens 12 indoor courts.", court: { name: "Bouncy Kitchen", barangay: "", city: "Davao City", hours: "" } })
    expect(p).toContain("- Name: Bouncy Kitchen")
    expect(p).toContain("- Barangay: (not given)")
    expect(p).toContain("- Hours: (not given)")
    expect(p).toContain(PLAYER_FEATURES[1])
    expect(p).toContain('ARTICLE (about this court; the only other facts):\n"""\nBouncy Kitchen opens 12 indoor courts.')
    expect(p).toContain("ANGLE: grand opening")
    expect(p).toContain("HEADLINE IN:")
    expect(pickleballPostPrompt({ kind: "comingsoon", topic: "", avoid: [] })).not.toContain("- Hours:")
    expect(COURT_LAUNCH_RULES).toMatch(/never invent them/)
  })

  it("reads a Coming Soon answer (the COURT lines only when given)", () => {
    const post = parsePickleballPost(
      "comingsoon",
      `TOPIC: Soon on PicklePlay
TAG: Coming soon
KICKER: Get ready
CHIP: New court
HEADLINE: Soon on
HIGHLIGHT: Pickleplay.ph
DETAIL: Reserve your first rally online soon!
CTA: Be first on court. Stay tuned!
COURT NAME: none
BARANGAY: (none)
CITY: Davao City
FACEBOOK CAPTION: A new court is coming to PicklePlay!
#PicklePlayPH #ComingSoon`,
      "01",
    )
    expect(post.content).toMatchObject({ kind: "comingsoon", tag: "Coming soon", kicker: "Get ready", headline: "Soon on", highlight: "Pickleplay.ph", courtName: "", barangay: "", city: "Davao City" })
    expect(post.topic).toBe("Soon on PicklePlay")
    expect(post.facebookCaption).toContain("#PicklePlayPH")
  })

  it("reads a Now Open answer, filling the lines it left out", () => {
    const post = parsePickleballPost(
      "nowopen",
      `TOPIC: Open now
HEADLINE: We're open!
HIGHLIGHT: Play today!
PERK: Grab a slot in a few taps
CTA: Bring your crew for the first rally!
HOURS: none
CITY: Davao
FACEBOOK CAPTION: Now open on PicklePlay!`,
      "01",
    )
    expect(post.content).toMatchObject({ kind: "nowopen", headline: "We’re open!", headlineIn: "We’re open in", spotlight: "Davao", tag: "Grand opening", audience: "New court now open", logoTab: "New court", hours: "" })
  })

  describe("writing (Groq, no web search)", () => {
    let calls: { url: string; body: Record<string, unknown> }[]
    beforeEach(() => {
      calls = []
      vi.stubEnv("GROQ_API_KEY", "gsk_test")
      vi.stubEnv("GROQ_MODEL", "")
      vi.stubEnv("TAVILY_API_KEY", "tvly-app-key-0123456789")
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL, init?: RequestInit) => {
          calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) })
          return new Response(JSON.stringify({ choices: [{ message: { content: "TOPIC: x\nHEADLINE: Soon on\nHIGHLIGHT: Pickleplay.ph\nDETAIL: d\nCTA: c" } }] }), { status: 200 })
        }),
      )
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })

    it("uses the court-launch rules and never searches the web (no facts to check)", async () => {
      const out = await generate({ task: "pickleball-post", kind: "comingsoon", topic: "grand launch", avoid: [], court: { name: "Bouncy Kitchen", barangay: "", city: "", hours: "" } })
      expect(calls.some((c) => c.url.includes("tavily"))).toBe(false)
      const messages = JSON.stringify(calls[0].body.messages)
      expect(messages).toContain("announcing a pickleball court that is coming soon")
      expect(messages).toContain("Name: Bouncy Kitchen")
      expect(out.sources).toBeUndefined()
    })
  })
})

describe("Court logo: a plain background made transparent", () => {
  /** A w × h picture: `bg` everywhere, `fg` in the middle square. */
  const picture = (w: number, h: number, bg: number[], fg: number[]) => {
    const px = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const inside = x >= w / 4 && x < (3 * w) / 4 && y >= h / 4 && y < (3 * h) / 4
        px.set(inside ? fg : bg, (y * w + x) * 4)
      }
    return px
  }

  it("clears a white background around the logo and keeps the logo", () => {
    const px = picture(40, 20, [255, 255, 255, 255], [200, 20, 30, 255])
    expect(clearBackground(px, 40, 20)).toBe(true)
    expect(px[3]).toBe(0)
    expect(px[(10 * 40 + 20) * 4 + 3]).toBe(255)
    expect(opaqueBox(px, 40, 20)).toEqual({ x: 10, y: 5, w: 20, h: 10 })
  })

  it("leaves a transparent PNG and a busy photo alone", () => {
    expect(clearBackground(picture(20, 20, [0, 0, 0, 0], [10, 100, 10, 255]), 20, 20)).toBe(false)
    const busy = new Uint8ClampedArray(20 * 20 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256))
    expect(clearBackground(busy, 20, 20)).toBe(false)
  })
})
