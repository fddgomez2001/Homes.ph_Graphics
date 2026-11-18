import { describe, expect, it } from "vitest"
import { eventIn, isHomepageLink, pickScore, pickStories, rejectReason, sourceTier, type PickCandidate } from "@/lib/ai/story-pick"
import type { TrendStory } from "@/lib/ai/trend-news"

const DAY = new Date(2026, 10, 14)
const ctx = { brand: "homes" as const, day: DAY, posted: [] as string[] }

function story(extra: Partial<TrendStory> = {}): TrendStory {
  return {
    title: "Butuan Opens New Public Market",
    dateText: "2026-11-13",
    date: new Date(2026, 10, 13),
    url: "https://www.sunstar.com.ph/butuan/new-public-market",
    site: "sunstar.com.ph",
    verified: true,
    summary: "The city government opened the new public market in Butuan City.",
    why: "",
    kind: "news",
    ...extra,
  }
}

function cand(extra: Partial<PickCandidate> = {}, s: Partial<TrendStory> = {}): PickCandidate {
  return { story: story(s), age: 1, fresh: true, negative: "", repeat: "", partner: "", matched: [], place: "Butuan City", check: "trusted", ...extra }
}

describe("Trending news → the story picker (1.46)", () => {
  it("step 1: rejects before anything else, with the reason", () => {
    expect(rejectReason(cand(), ctx)).toBe("")
    expect(rejectReason(cand({}, { url: "" }), ctx)).toBe("No source link")
    expect(rejectReason(cand({}, { verified: false }), ctx)).toMatch(/wasn't one of the pages/)
    expect(rejectReason(cand({}, { url: "https://www.sunstar.com.ph/" }), ctx)).toMatch(/homepage/)
    expect(rejectReason(cand({ fresh: false, age: 9 }), ctx)).toBe("Published outside the days picked")
    expect(rejectReason(cand({ fresh: false, age: null }), ctx)).toMatch(/date isn't shown/)
    // Older news that announces something still to come stays; an event long past doesn't.
    expect(rejectReason(cand({ fresh: false, age: 9 }, { eventDate: "2026-11-20" }), ctx)).toBe("")
    expect(rejectReason(cand({}, { eventDate: "2026-11-12" }), ctx)).toBe("")
    expect(rejectReason(cand({}, { eventDate: "2026-11-10" }), ctx)).toMatch(/more than 2 days before/)
    expect(rejectReason(cand({ place: "" }), ctx)).toMatch(/No place named/)
    expect(rejectReason(cand({ place: "" }), { ...ctx, brand: "pickleplay" })).toBe("")
    expect(rejectReason(cand({ negative: "fire" }), ctx)).toMatch(/negative or sensitive \(“fire”\)/)
    expect(rejectReason(cand({}, { title: "Mayor Files Candidacy For Re-election In Butuan" }), ctx)).toMatch(/Election or partisan/)
    expect(rejectReason(cand({}, { summary: "House and lot for sale in Butuan City, PM me for details." }), ctx)).toMatch(/ad or a listing/)
    expect(rejectReason(cand({ repeat: "Butuan Opens Market" }), ctx)).toMatch(/already posted/)
  })

  it("a homepage or a section isn't the story; a Facebook post link is", () => {
    expect(isHomepageLink("https://pia.gov.ph")).toBe(true)
    expect(isHomepageLink("https://pia.gov.ph/news/")).toBe(true)
    expect(isHomepageLink("https://pia.gov.ph/caraga/tbi-summit")).toBe(false)
    expect(isHomepageLink("https://www.facebook.com/PIACaraga")).toBe(true)
    expect(isHomepageLink("https://www.facebook.com/PIACaraga/posts/pfbid02abc")).toBe(false)
    expect(isHomepageLink("https://www.facebook.com/permalink.php?story_fbid=1&id=2")).toBe(false)
    expect(isHomepageLink("not a link")).toBe(true)
  })

  it("step 2: source tiers", () => {
    expect(sourceTier(cand({ check: "official" }, { site: "butuan.gov.ph" }))).toBe(1)
    expect(sourceTier(cand({ check: "found" }, { site: "pia.gov.ph" }))).toBe(1)
    expect(sourceTier(cand({ check: "trusted" }))).toBe(2)
    expect(sourceTier(cand({ check: "found" }, { site: "caraganews.example" }))).toBe(3)
    // Facebook: an official office's Page or a partner developer's own is Tier 1; the team's Pages Tier 2; others Tier 3.
    expect(sourceTier(cand({ check: "post" }, { kind: "facebook", sourceName: "City Government of Butuan (Facebook)" }))).toBe(1)
    expect(sourceTier(cand({ check: "post", partner: "Camella Homes" }, { kind: "facebook", sourceName: "Camella Caraga" }))).toBe(1)
    expect(sourceTier(cand({ check: "page" }, { kind: "page", from: "Homes.ph CARAGA" }))).toBe(2)
    expect(sourceTier(cand({ check: "post" }, { kind: "facebook", sourceName: "Butuan Updates" }))).toBe(3)
  })

  it("step 3: the score follows the team's parts and never passes their limits", () => {
    const plain = pickScore(cand(), ctx)
    expect(plain).toMatchObject({ partner: 0, timing: 10, buzz: 1 })
    const full = pickScore(
      cand(
        { age: 0, partner: "Camella Homes", matched: ["Caraga Real Estate", "Butuan House and Lot", "Caraga Housing"] },
        { look: "events", trending: 95, eventDate: "2026-11-15", image: "https://x.example/p.jpg", summary: "Register free at the venue from 9 AM." },
      ),
      ctx,
    )
    expect(full).toEqual({ total: 100, fit: 25, partner: 20, timing: 15, useful: 15, match: 10, poster: 10, buzz: 5 })
    expect(eventIn({ eventDate: "2026-11-15" }, DAY)).toBe(1)
    expect(eventIn({ eventDate: "2026-11-10" }, DAY)).toBe(-4)
    expect(eventIn({}, DAY)).toBeNull()
  })

  it("steps 4 and 5: the pick, up to 3 backups, Tier 3 last, and the tie-breakers", () => {
    const official = cand({ check: "official" }, { title: "DPWH Finishes Butuan Bypass Road", url: "https://dpwh.gov.ph/news/butuan-bypass", site: "dpwh.gov.ph", image: "https://x.example/d.jpg" })
    const outlet = cand({ matched: ["Caraga Business News"] }, { title: "Surigao Port Expansion Starts This Month", url: "https://www.sunstar.com.ph/surigao/port" })
    const local = cand({ check: "found", matched: ["Caraga Real Estate", "Caraga Property"] }, { title: "New Mall Rises In Bayugan City", url: "https://caraganews.example/bayugan-mall", site: "caraganews.example", look: "openings", trending: 90, image: "https://x.example/a.jpg" })
    const old = cand({ fresh: false, age: 12 }, { title: "Old Story About Butuan", url: "https://www.sunstar.com.ph/butuan/old" })
    const r = pickStories([local, outlet, old, official], ctx)
    // The outlet scores 2 more (a keyword against a photo), but within 5 points the Tier 1 source wins; Tier 3 comes last though it scores most.
    expect(pickScore(local, ctx).total).toBeGreaterThan(pickScore(outlet, ctx).total)
    expect(r.pick?.c).toBe(official)
    expect(r.pick?.tier).toBe(1)
    expect(r.backups.map((b) => b.c)).toEqual([outlet, local])
    expect(r.rejected.map((x) => [x.c, x.reason])).toEqual([[old, "Published outside the days picked"]])
    expect(r.pick?.why).toMatch(/official source/)
    expect(r.pick?.notes).toEqual([])
    expect(r.backups[0].notes).toEqual(["No photo came with it: you'll need one for the poster."])

    // A partner developer's story in the place beats a Tier 1 source when the scores are close… and when they aren't, it wins on score.
    const partner = cand({ partner: "Camella Homes" }, { title: "Camella Launches New Phase In Butuan City", url: "https://www.sunstar.com.ph/butuan/camella" })
    expect(pickStories([official, partner], ctx).pick?.c).toBe(partner)

    // Only a Tier 3 story qualifies: it's picked, and the notes say so.
    const only = pickStories([local, old], ctx)
    expect(only.pick?.c).toBe(local)
    expect(only.pick?.notes[0]).toMatch(/No official or established source/)

    // A place not covered lately settles an otherwise equal pair.
    const butuan = cand({}, { title: "Butuan Opens New Park", url: "https://www.sunstar.com.ph/butuan/park", summary: "A new park opened in Butuan City." })
    const siargao = cand({ place: "Siargao" }, { title: "Siargao Opens New Park", url: "https://www.sunstar.com.ph/siargao/park", summary: "A new park opened in Siargao." })
    expect(pickStories([butuan, siargao], { ...ctx, posted: ["Butuan City Hosts Summit", "Butuan Road Opens"] }).pick?.c).toBe(siargao)

    // At most 3 backups.
    const many = Array.from({ length: 6 }, (_, i) => cand({}, { title: `Story ${i} In Butuan`, url: `https://www.sunstar.com.ph/butuan/${i}` }))
    expect(pickStories(many, ctx).backups).toHaveLength(3)
  })

  it("never picks a weak story: no pick, and what was missing", () => {
    const old = cand({ fresh: false, age: 12 })
    const sad = cand({ negative: "accident" }, { url: "https://www.sunstar.com.ph/butuan/x" })
    const r = pickStories([old, { ...old, story: story({ url: "https://www.sunstar.com.ph/butuan/y" }) }, sad], ctx)
    expect(r.pick).toBeNull()
    expect(r.backups).toEqual([])
    expect(r.notes).toBe("No story is good enough to post: published outside the days picked (2); may be negative or sensitive (1). Try more days or other keywords.")
    expect(pickStories([], ctx)).toMatchObject({ pick: null, notes: "" })
  })
})
