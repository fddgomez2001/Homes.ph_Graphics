import { format } from "date-fns"
import { DEFAULT_PUBLISH_TIME } from "@/lib/dates"
import { newsPostLabel, type DailyBrand, type NewsBrand } from "@/lib/design/news-templates"
import { isPageLane, laneTimesOf, type ReportBrand } from "@/lib/news-lanes"
import { pageName } from "@/lib/pages"

/**
 * The texts the floating report copies for the team's daily report: the News Article posting
 * lines (title, details, one line per posting time with the article's link), the Daily Trend
 * News entries (posters) and the day's carousel. Plain text with Unicode bold where the report
 * wants bold, ready to paste anywhere.
 */

/** How each daily brand is named in the report, and where its articles are on its website. */
export const REPORT_BRANDS: Record<DailyBrand, { name: string; newsUrl: string }> = {
  pickleplay: { name: "Pickleplay.ph", newsUrl: "https://www.pickleplay.ph/news/" },
  fhi: { name: "FHI Global", newsUrl: "https://fhiglobal.ae/news/" },
  caraga: { name: "Homes.ph CARAGA", newsUrl: "https://homes.ph/news/" },
  gensan: { name: "Homes.ph Gensan", newsUrl: "https://homes.ph/news/" },
}

/**
 * Bold letters that stay bold wherever the text is pasted (Facebook, Messenger, Docs): the
 * Unicode "mathematical sans-serif bold" A–Z, a–z and 0–9. Other characters stay as they are.
 */
export function boldSans(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const c = ch.codePointAt(0)!
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + c - 65)
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + c - 97)
      if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + c - 48)
      return ch
    })
    .join("")
}

/**
 * The article's address on the website: "USA Pickleball Revokes CPX Hyper+ Certification" →
 * "usa-pickleball-revokes-cpx-hyper-certification". Accents become plain letters, spaces and
 * dashes become "-", other marks (: + ' , & …) are dropped.
 */
export function articleSlug(headline: string): string {
  return headline
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s_./\\|–—-]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/** A report row's name and news address (another Homes.ph page: "Homes.ph Cebu", on homes.ph). */
export function reportBrandInfo(brand: ReportBrand): { name: string; newsUrl: string } {
  return isPageLane(brand) ? { name: pageName(brand), newsUrl: REPORT_BRANDS.caraga.newsUrl } : REPORT_BRANDS[brand]
}

export function articleLink(brand: ReportBrand, headline: string): string {
  return `${reportBrandInfo(brand).newsUrl}${articleSlug(headline)}`
}

/** "9:00 AM", "1:30 PM" ("13:30" in). */
export function clockLabel(time: string): string {
  return format(new Date(`2000-01-01T${time}:00`), "h:mm a")
}

/** "9 AM", "1:30 PM": the time in the posting line's brackets. */
export function bracketTime(time: string): string {
  return format(new Date(`2000-01-01T${time}:00`), time.endsWith(":00") ? "h a" : "h:mm a")
}

/** "a, b, and c" (two: "a and b"). */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`
}

/** "Daily Social Media Posting – Pickleplay.ph" (the brand's logo copies it). */
export function postingTitle(brand: ReportBrand): string {
  return `Daily Social Media Posting – ${reportBrandInfo(brand).name}`
}

/** "Posted and scheduled daily articles on the Pickleplay.ph social media page at 9:00 AM, …, and 10:00 PM." (plain text) */
export function postingDetails(brand: ReportBrand): string {
  const times = listOf(laneTimesOf(brand).map((t) => clockLabel(t.time)))
  return `Posted and scheduled daily articles on the ${reportBrandInfo(brand).name} social media page at ${times}.`
}

/** On one line with single spaces ("" for nothing). */
const oneLine = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim()

/**
 * A posting time's line: "[𝟵 𝗔𝗠] - USA Pickleball Revokes …", a blank line, then
 * "𝗔𝗿𝘁𝗶𝗰𝗹𝗲 𝗟𝗶𝗻𝗸: https://www.pickleplay.ph/news/usa-pickleball-revokes-…".
 */
export function postingLine(brand: ReportBrand, time: string, headline: string): string {
  const h = oneLine(headline)
  return `[${boldSans(bracketTime(time))}] - ${h}\n\n${boldSans("Article Link")}: ${articleLink(brand, h)}`
}

// ---------- Daily Trend News (Poster Maker posters) ----------

/** Homes.ph posters without a page are for Homes.ph CARAGA. */
export const HOMES_TREND_NAME = "Homes.ph CARAGA"

/**
 * The name of a poster's brand in the report: "Pickleplay.ph", "FHI Global", "Homes.ph CARAGA",
 * "Homes.ph Gensan", or the Homes.ph page it's for ("Homes.ph Cebu").
 */
export function trendBrandName(brand: NewsBrand, page?: string | null): string {
  if (brand === "pickleplay") return REPORT_BRANDS.pickleplay.name
  if (brand === "fhi") return REPORT_BRANDS.fhi.name
  if (brand === "gensan") return REPORT_BRANDS.gensan.name
  return page?.trim() ? newsPostLabel("homes", page) : HOMES_TREND_NAME
}

/** "FHI Global DTN 1" (the button). */
export function trendLabel(name: string, n: number): string {
  return `${name} DTN ${n}`
}

/** "11/6/2026" */
export const reportDate = (day: Date) => format(day, "M/d/yyyy")

/** "𝗙𝗛𝗜 𝗚𝗹𝗼𝗯𝗮𝗹 - 𝗗𝗮𝗶𝗹𝘆 𝗧𝗿𝗲𝗻𝗱 𝗡𝗲𝘄𝘀 𝟭 [11/6/2026]" */
export function trendTitle(name: string, n: number, day?: Date | null): string {
  return `${boldSans(`${name} - Daily Trend News ${n}`)}${day ? ` [${reportDate(day)}]` : ""}`
}

/** "Headline (Subtext)", or just the headline (as shown in the floating report). */
export function trendHeadline(headline: string, subtext = ""): string {
  const h = oneLine(headline)
  const s = oneLine(subtext).replace(/^\(+|\)+$/g, "")
  return s ? `${h} (${s})` : h
}

/**
 * The whole Daily Trend News entry, as pasted in the report: the bold title with the day, the
 * headline in bold with the subtext after it, and "𝗗𝗲𝘁𝗮𝗶𝗹𝘀:".
 */
export function trendText(entry: { name: string; n: number; day?: Date | null; headline: string; subtext?: string; details?: string }): string {
  const details = oneLine(entry.details)
  const h = boldSans(oneLine(entry.headline))
  const s = oneLine(entry.subtext).replace(/^\(+|\)+$/g, "")
  return [trendTitle(entry.name, entry.n, entry.day), s ? `${h}  (${s})` : h, ...(details ? [`${boldSans("Details")}: ${details}`] : [])].join("\n\n")
}

// ---------- the day's carousel ----------

/** The Homes.ph logo on the Carousel tab copies this. */
export const CAROUSEL_TITLE_LINE = "Daily Carousel Content Creation and Scheduling – Homes.ph Social Media Pages"

/** The Carousel tab's Details box (plain text). */
export const CAROUSEL_DETAILS = `Created and scheduled daily carousel content for all Homes.ph social media pages, with posts set to publish every day at ${clockLabel(DEFAULT_PUBLISH_TIME)}.`

/** "Homes.ph Main Page", then the short names: "Ozamiz", "BGC Taguig"… */
export function pageShortName(page: { name: string; short_name?: string | null }): string {
  if (/\bmain\s*page\b/i.test(page.name)) return oneLine(page.name)
  return oneLine(page.short_name) || oneLine(page.name).replace(/^homes\.?ph\s+/i, "")
}

/**
 * The carousel's schedule line for the report: the bold heading, the day and time (day/month,
 * as the team writes it), the carousel's title (Headline 1 and 2) in bold and every page with ✅.
 * A page not posted yet shows ⏳ (the line is only copied once every page is posted).
 */
export function carouselUpdateText(input: { title: string; at: Date | null; pages: { name: string; short_name?: string | null; done?: boolean }[] }): string {
  const when = input.at ? `${format(input.at, "d/M/yyyy")} | ${format(input.at, input.at.getMinutes() ? "h:mm a" : "h a")}` : ""
  const pages = input.pages.map((p) => `${pageShortName(p)} ${p.done === false ? "⏳" : "✅"}`).join(" | ")
  return `${boldSans("Carousel Successfully Scheduled")}:\n${when}\n\n${boldSans(oneLine(input.title))}\n\n${pages} |`
}
