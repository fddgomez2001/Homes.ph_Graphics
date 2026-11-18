import { describe, expect, it } from "vitest"
import { cleanTrendDetails, parsePosterCopy } from "@/lib/ai/headlines"
import { cleanAnswer, prompt } from "@/lib/ai/groq"
import { POSTER_AI_TASKS } from "@/lib/ai/types"
import { parseAiRequest } from "@/lib/ai/validate"
import {
  articleLink,
  articleSlug,
  boldSans,
  bracketTime,
  clockLabel,
  postingDetails,
  postingLine,
  postingTitle,
  trendBrandName,
  trendHeadline,
  trendLabel,
  trendText,
  trendTitle,
  CAROUSEL_DETAILS,
  CAROUSEL_TITLE_LINE,
  carouselUpdateText,
  pageShortName,
} from "@/lib/report/report-texts"
import { collageLayout, REPORT_FILE_MAX } from "@/lib/report/report-files"
import { DEFAULT_HOMES_PAGES, HOMES_POSTER_PAGE, newsPostLabel, pageDisplayName } from "@/lib/design/news-templates"

describe("News Article Posting lines", () => {
  it("the headline becomes the article's link on the brand's website", () => {
    expect(articleSlug("USA Pickleball Revokes CPX Hyper+ Certification Over Performance Drift")).toBe(
      "usa-pickleball-revokes-cpx-hyper-certification-over-performance-drift",
    )
    expect(articleSlug("A Fresh Start for Public Service: Trinidad Welcomes Its New Barangay Hall")).toBe(
      "a-fresh-start-for-public-service-trinidad-welcomes-its-new-barangay-hall",
    )
    expect(articleLink("fhi", "Dubai Records Eighty Six Luxury Property Deals In Third Quarter")).toBe(
      "https://fhiglobal.ae/news/dubai-records-eighty-six-luxury-property-deals-in-third-quarter",
    )
    // Accents, apostrophes, amounts, dashes and extra spaces.
    expect(articleSlug("  Parañaque's ₱50,000 Prize — Jan 22–Feb 1 / Q&A  ")).toBe("paranaques-50000-prize-jan-22-feb-1-qa")
  })

  it("a posting time copies as “[𝟵 𝗔𝗠] - Headline”, a blank line and the bold “Article Link:”", () => {
    // Exactly as in the team's report.
    expect(postingLine("pickleplay", "09:00", "Professional Pickleball Partners Acquires Professor Pickleball To Expand Equipment And Accessories Portfolio")).toBe(
      "[𝟵 𝗔𝗠] - Professional Pickleball Partners Acquires Professor Pickleball To Expand Equipment And Accessories Portfolio\n\n𝗔𝗿𝘁𝗶𝗰𝗹𝗲 𝗟𝗶𝗻𝗸: https://www.pickleplay.ph/news/professional-pickleball-partners-acquires-professor-pickleball-to-expand-equipment-and-accessories-portfolio",
    )
    expect(postingLine("caraga", "13:30", "A Fresh Start for Public Service: Trinidad Welcomes Its New Barangay Hall")).toBe(
      `[${boldSans("1:30 PM")}] - A Fresh Start for Public Service: Trinidad Welcomes Its New Barangay Hall\n\n${boldSans("Article Link")}: https://homes.ph/news/a-fresh-start-for-public-service-trinidad-welcomes-its-new-barangay-hall`,
    )
    // A headline typed on two lines is one line in the report.
    expect(postingLine("fhi", "22:00", "Dubai Records Eighty Six\nLuxury Property Deals")).toBe(
      `[${boldSans("10 PM")}] - Dubai Records Eighty Six Luxury Property Deals\n\n${boldSans("Article Link")}: https://fhiglobal.ae/news/dubai-records-eighty-six-luxury-property-deals`,
    )
    expect([bracketTime("11:00"), bracketTime("18:00"), clockLabel("09:00"), clockLabel("13:30")]).toEqual(["11 AM", "6 PM", "9:00 AM", "1:30 PM"])
  })

  it("the logo and the Details box copy each brand's title and details (plain text)", () => {
    expect(postingTitle("pickleplay")).toBe("Daily Social Media Posting – Pickleplay.ph")
    expect(postingTitle("fhi")).toBe("Daily Social Media Posting – FHI Global")
    expect(postingTitle("caraga")).toBe("Daily Social Media Posting – Homes.ph CARAGA")
    expect(postingDetails("pickleplay")).toBe("Posted and scheduled daily articles on the Pickleplay.ph social media page at 9:00 AM, 11:00 AM, 3:00 PM, 7:00 PM, and 10:00 PM.")
    expect(postingDetails("fhi")).toBe("Posted and scheduled daily articles on the FHI Global social media page at 9:00 AM, 11:00 AM, 3:00 PM, 7:00 PM, and 10:00 PM.")
    expect(postingDetails("caraga")).toBe("Posted and scheduled daily articles on the Homes.ph CARAGA social media page at 11:00 AM, 1:30 PM, 6:00 PM, 8:00 PM, and 10:00 PM.")
  })
})

describe("Daily Trend News entries", () => {
  it("bold title with the day, the headline in bold (subtext as is), bold “Details:”", () => {
    expect(boldSans("FHI Global 1")).toBe("\u{1D5D9}\u{1D5DB}\u{1D5DC} \u{1D5DA}\u{1D5F9}\u{1D5FC}\u{1D5EF}\u{1D5EE}\u{1D5F9} \u{1D7ED}")
    expect(trendTitle("FHI Global", 1, new Date(2026, 10, 6))).toBe("𝗙𝗛𝗜 𝗚𝗹𝗼𝗯𝗮𝗹 - 𝗗𝗮𝗶𝗹𝘆 𝗧𝗿𝗲𝗻𝗱 𝗡𝗲𝘄𝘀 𝟭 [11/6/2026]")
    expect(trendTitle("Pickleplay.ph", 2)).toBe(`${boldSans("Pickleplay")}.${boldSans("ph - Daily Trend News 2")}`)
    expect(trendLabel("Pickleplay.ph", 1)).toBe("Pickleplay.ph DTN 1")
    const details =
      "Dubai’s rental market is cooling as rents ease and inventory expands, prompting buyers to step in, with Q3 residential sales hitting about Dh72.6 billion across 34,000 transactions. This shift signals a timely opportunity for investors and home-buyers watching the Dubai property market for long-term value."
    // Exactly as in the team's report.
    expect(
      trendText({
        name: "FHI Global",
        n: 1,
        day: new Date(2026, 10, 6),
        headline: "Dubai Rental Market Shifts to Buying",
        subtext: "Rents easing and inventory expanding drive buyers",
        details,
      }),
    ).toBe(
      `𝗙𝗛𝗜 𝗚𝗹𝗼𝗯𝗮𝗹 - 𝗗𝗮𝗶𝗹𝘆 𝗧𝗿𝗲𝗻𝗱 𝗡𝗲𝘄𝘀 𝟭 [11/6/2026]\n\n𝗗𝘂𝗯𝗮𝗶 𝗥𝗲𝗻𝘁𝗮𝗹 𝗠𝗮𝗿𝗸𝗲𝘁 𝗦𝗵𝗶𝗳𝘁𝘀 𝘁𝗼 𝗕𝘂𝘆𝗶𝗻𝗴  (Rents easing and inventory expanding drive buyers)\n\n𝗗𝗲𝘁𝗮𝗶𝗹𝘀: ${details}`,
    )
    // No subtext, no details yet.
    expect(trendText({ name: "Homes.ph CARAGA", n: 2, day: new Date(2026, 10, 7), headline: "Butuan Gets A New Park" })).toBe(
      `${boldSans("Homes.ph CARAGA - Daily Trend News 2")} [11/7/2026]\n\n${boldSans("Butuan Gets A New Park")}`,
    )
    expect(trendHeadline("Cebu Open", "(Nov 22 | Cebu)")).toBe("Cebu Open (Nov 22 | Cebu)")
  })

  it("Homes.ph posters are Homes.ph CARAGA (whatever page they were saved with)", () => {
    expect(trendBrandName("pickleplay")).toBe("Pickleplay.ph")
    expect(trendBrandName("fhi")).toBe("FHI Global")
    expect(trendBrandName("homes")).toBe("Homes.ph CARAGA")
    expect(HOMES_POSTER_PAGE).toBe("Homes.ph Caraga")
    expect(newsPostLabel("homes", HOMES_POSTER_PAGE)).toBe("Homes.ph CARAGA")
    expect(newsPostLabel("homes", "Homes.ph BGC Taguig")).toBe("Homes.ph BGC Taguig")
    expect(pageDisplayName("Homes.ph Caraga")).toBe("Homes.ph CARAGA")
  })

  it("details from the AI: at most 3 sentences, no label, quotes, emojis, hashtags or em dashes", () => {
    expect(cleanTrendDetails('Details: "Easing rents — and more homes — push Dubai tenants to buy 🏠. Supply grew this year. It\'s timely for U.S. and UAE investors. A fourth one. #Dubai"')).toBe(
      "Easing rents, and more homes, push Dubai tenants to buy. Supply grew this year. It's timely for U.S. and UAE investors.",
    )
    expect(cleanTrendDetails("Off‑plan sales made up 61% of deals.")).toBe("Off-plan sales made up 61% of deals.")
    expect(cleanTrendDetails("NONE")).toBe("")
    expect(cleanTrendDetails("x ".repeat(400)).length).toBeLessThanOrEqual(480)
  })

  it("Write from article writes them with the rest", () => {
    const copy = parsePosterCopy(
      `RECOMMENDED HEADLINE: Dubai Rental Market Shifts to Buying
HOOK WORDS: Shifts to Buying
SUBTEXT: [Key point] Rents easing and inventory expanding drive buyers
REPORT DETAILS: Easing rents and a growing supply of homes are pushing more Dubai tenants to buy.
It's a timely trend for buyers and investors watching the UAE market.
CAPTION:
More Dubai tenants are becoming owners this year, as rents ease and new homes arrive.
HASHTAGS: #Dubai #RealEstate`,
      "FHI Global Property",
    )
    expect(copy.details).toBe("Easing rents and a growing supply of homes are pushing more Dubai tenants to buy. It's a timely trend for buyers and investors watching the UAE market.")
    expect(copy.caption?.text).toBe("More Dubai tenants are becoming owners this year, as rents ease and new homes arrive.")
    expect(parsePosterCopy("RECOMMENDED HEADLINE: Big News For Cebu Buyers").details).toBe("")
  })

  it("the AI request: from the article, or from the poster's own words", () => {
    const withArticle = parseAiRequest({
      task: "trend-details",
      article: "DUBAI — Rents are easing across Dubai as thousands of new homes are handed over this year, analysts said.",
      brand: "FHI Global",
      headline: " Dubai Rental Market\nShifts to Buying ",
      subtext: "Rents easing",
      caption: "",
    })
    if (typeof withArticle === "string") throw new Error(withArticle)
    expect(withArticle).toMatchObject({ task: "trend-details", headline: "Dubai Rental Market Shifts to Buying", subtext: "Rents easing" })
    const p = prompt(withArticle)
    expect(p.system).toMatch(/REPORT DETAILS/)
    expect(p.system).toMatch(/Never invent facts/)
    expect(p.user).toContain("ARTICLE:")
    const fromCaption = parseAiRequest({ task: "trend-details", article: "short", brand: "Pickleplay.ph", headline: "Cebu Open Draws 400 Players", caption: "Over 400 players are coming to Cebu." })
    if (typeof fromCaption === "string") throw new Error(fromCaption)
    expect(fromCaption).toMatchObject({ article: "" })
    expect(prompt(fromCaption).user).toContain("POST CAPTION")
    expect(parseAiRequest({ task: "trend-details", headline: "  " })).toBe("Type the headline first.")
    expect(cleanAnswer("Report details: Rents are easing.", "trend-details")).toBe("Rents are easing.")
    // Your own AI key (Settings → Poster Maker AI) works for them too.
    expect(POSTER_AI_TASKS).toEqual(expect.arrayContaining(["trend-details", "carousel-from-article"]))
  })
})

describe("the day's carousel", () => {
  const title = "Lights, Land, And Endless Views."

  it("the Homes.ph logo copies the title line, Details the carousel details (plain text)", () => {
    expect(CAROUSEL_TITLE_LINE).toBe("Daily Carousel Content Creation and Scheduling – Homes.ph Social Media Pages")
    expect(CAROUSEL_DETAILS).toBe("Created and scheduled daily carousel content for all Homes.ph social media pages, with posts set to publish every day at 11:00 PM.")
  })

  it("the schedule line: bold heading, day/month and time, the title in bold, every page ✅", () => {
    const pages = DEFAULT_HOMES_PAGES.map((name) => ({ name }))
    // Exactly as in the team's report.
    expect(carouselUpdateText({ title, at: new Date(2026, 10, 7, 23, 0), pages })).toBe(
      "𝗖𝗮𝗿𝗼𝘂𝘀𝗲𝗹 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 𝗦𝗰𝗵𝗲𝗱𝘂𝗹𝗲𝗱:\n7/11/2026 | 11 PM\n\n𝗟𝗶𝗴𝗵𝘁𝘀, 𝗟𝗮𝗻𝗱, 𝗔𝗻𝗱 𝗘𝗻𝗱𝗹𝗲𝘀𝘀 𝗩𝗶𝗲𝘄𝘀.\n\nHomes.ph Main Page ✅ | Ozamiz ✅ | Dumaguete ✅ | BGC Taguig ✅ | Cebu ✅ | Pampanga ✅ | Cavite ✅ | Iloilo ✅ | Bacolod ✅ | Davao ✅ | Palawan ✅ | Bohol ✅ | Makati ✅ | CDO ✅ | Gensan ✅ | Caraga ✅ | Leyte ✅ |",
    )
    // Pages not posted yet show ⏳ (the line is only copied once all are posted).
    expect(carouselUpdateText({ title: "X", at: new Date(2026, 10, 6, 21, 30), pages: [{ name: "Homes.ph Cebu", short_name: "Cebu", done: true }, { name: "Homes.ph Leyte", done: false }] })).toBe(
      `${boldSans("Carousel Successfully Scheduled")}:\n6/11/2026 | 9:30 PM\n\n${boldSans("X")}\n\nCebu ✅ | Leyte ⏳ |`,
    )
    expect(pageShortName({ name: "Homes.ph Main Page", short_name: "Main Page" })).toBe("Homes.ph Main Page")
  })
})

describe("saved pictures", () => {
  it("stay under 4.5 MB", () => {
    expect(REPORT_FILE_MAX).toBeLessThan(4.5 * 1000 * 1000)
  })

  it("the carousel as one picture: rows of up to 4, the last row centered", () => {
    const six = collageLayout(6, 960)
    expect([six.width, six.height]).toEqual([56 * 2 + 3 * 960 + 2 * 28, 56 * 2 + 2 * 960 + 28])
    expect(six.cells.map((c) => [c.x, c.y])).toEqual([
      [56, 56],
      [56 + 988, 56],
      [56 + 2 * 988, 56],
      [56, 56 + 988],
      [56 + 988, 56 + 988],
      [56 + 2 * 988, 56 + 988],
    ])
    const five = collageLayout(5, 960)
    // 3 on top, 2 under them in the middle.
    expect(five.cells.slice(3).map((c) => c.x)).toEqual([56 + 494, 56 + 494 + 988])
    expect(collageLayout(4, 960).cells.every((c) => c.y === 56)).toBe(true)
  })
})
