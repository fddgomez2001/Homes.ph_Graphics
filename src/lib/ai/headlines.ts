import { findPhrase } from "@/lib/design/konva-attrs"
import type { HeadlineOption, PosterCaption, PosterCopy, SubtextKind, SubtextOption } from "./types"

/** Hook words exactly as written in the headline, or "" when they aren't in it. */
function hookIn(headline: string, hook: string) {
  const at = hook ? findPhrase(headline, hook) : null
  return at ? Array.from(headline).slice(at.start, at.end).join("") : ""
}

/** Quotes, brackets, hashtags, emojis and a final period/exclamation mark off a headline or hook. */
function cleanPart(text: string) {
  return text
    .replace(/#\w+/g, "")
    .replace(/(?![©®™])\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu, "")
    .replace(/^[\s"'“”‘’[]+|[\s"'“”‘’\]]+$/g, "")
    .replace(/[.!]+$/, "")
    // Plain hyphens ("Fastest-Growing"), not the look-alike dashes some models write.
    .replace(/[‐‑]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * The AI's "headline | hook words" lines as choices. The hook words are kept exactly as
 * written in the headline (or dropped when they aren't in it); duplicates are skipped.
 */
export function parseHeadlineOptions(text: string): HeadlineOption[] {
  const seen = new Set<string>()
  const options: HeadlineOption[] = []
  for (const line of text.split(/\n+/)) {
    const bar = line.lastIndexOf("|")
    const headline = (bar >= 0 ? line.slice(0, bar) : line).replace(/\s+/g, " ").trim()
    const hook = bar >= 0 ? line.slice(bar + 1).replace(/\s+/g, " ").trim() : ""
    const key = headline.toLowerCase()
    if (headline.length < 10 || seen.has(key)) continue
    seen.add(key)
    options.push({ headline, highlight: hookIn(headline, hook) })
  }
  return options
}

/** A subtext longer than this loses its last (least important) parts, keeping at least two. */
export const SUBTEXT_MAX = 52

/**
 * "Nov 22, 2026 | Cebu City | ₱50,000 Prize": one line, " | " between parts, no placeholders,
 * and short: only the most important details (the date and place come first).
 */
export function cleanSubtext(text: string): string {
  const parts = text
    .replace(/[\r\n]+/g, " ")
    .split("|")
    .map((part) => cleanPart(part.replace(/\[[^\]]*\]/g, "")))
    .filter((part) => part && !/^(n\/?a|none|not (stated|given|available))$/i.test(part))
  while (parts.length > 2 && parts.join(" | ").length > SUBTEXT_MAX) parts.pop()
  return parts.join(" | ")
}

/** A key point, summary or quote longer than this is cut at a word (the poster wraps it onto two lines at most). */
export const SUBTEXT_LINE_MAX = 90

const NONE = /^(none|n\/?a|no subtext|not needed|-+)$/i
/** "[Key point] …" or "Key point: …". */
const MARKED_KIND = /^(?:\[\s*(details?|key\s*points?|summary|quote)\s*\]\s*[:\-–—]?|(details?|key\s*points?|summary|quote)\s*[:\-–—])\s*/i
/** "KEY POINT Prices up 8%", "Details Nov 22, 2026 | …" (models often drop the brackets). */
const BARE_KIND = /^(details?|key\s*points?|summary|quote)\s+(\S)/i
const LIST_ITEM = /^(?:\d+[.)]|[-*•])\s*/

/**
 * The kind label at the start of a subtext choice and the text after it. Without brackets or
 * a colon it only counts as a label when the text after it doesn't go on in lower case
 * ("Summary of a big year" is just text).
 */
function splitKind(item: string): { label: string | null; rest: string } {
  const marked = MARKED_KIND.exec(item)
  if (marked) return { label: marked[1] ?? marked[2], rest: item.slice(marked[0].length) }
  const bare = BARE_KIND.exec(item)
  if (bare && !/[a-z]/.test(bare[2])) return { label: bare[1], rest: item.slice(bare[0].length - bare[2].length) }
  return { label: null, rest: item }
}

/** A key point / summary / quote: one clean line, a quote in curly quotation marks, no ending period. */
function cleanLine(text: string, kind: SubtextKind): string {
  let line = text
    .replace(/[\r\n]+/g, " ")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/#\w+/g, "")
    .replace(/(?![©®™])\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu, "")
    .replace(/[‐‑]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
  if (NONE.test(line)) return ""
  if (kind === "quote") {
    line = line.replace(/^["'“”‘’]+/, "").replace(/["'“”‘’]+$/, "").trim().replace(/\.+$/, "")
    line = line ? `“${line}”` : ""
  }
  return line.length > SUBTEXT_LINE_MAX ? line.slice(0, SUBTEXT_LINE_MAX).replace(/\s+\S*$/, "") : line
}

function kindOf(label: string | undefined, text: string): SubtextKind {
  const k = (label ?? "").toLowerCase().replace(/[^a-z]/g, "")
  if (k.startsWith("detail")) return "details"
  if (k.startsWith("quote")) return "quote"
  if (k.startsWith("summar")) return "summary"
  if (k.startsWith("key")) return "key point"
  return text.includes("|") ? "details" : "key point"
}

/** "[Key point] Prices up 8% in a year" (or "Key point: …") as a subtext choice; null when it's empty. */
export function parseSubtextOption(line: string): SubtextOption | null {
  const { label, rest: raw } = splitKind(line.replace(LIST_ITEM, "").trim())
  const kind = kindOf(label ?? undefined, raw)
  const text = kind === "details" ? cleanSubtext(raw) : cleanLine(raw, kind)
  return text ? { text, kind } : null
}

const LABELS = [
  "BRAND",
  "POSTER CATEGORY",
  "RECOMMENDED HEADLINE",
  "HOOK WORDS",
  "ALTERNATIVE HEADLINES",
  "SUBTEXT OPTIONS",
  "SUBTEXT TYPE",
  "SUBTEXT",
  "REPORT DETAILS",
  "CAPTION",
  "HASHTAGS",
]
const labelOf = (line: string) => LABELS.find((label) => new RegExp(`^${label}\\s*:`, "i").test(line))

const EMOJI = /(?![©®™])\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu
/** Tags that only say "show this to more people" (they don't help anyone find the post). */
const SPAM_TAGS = new Set(["viral", "fyp", "foryou", "foryoupage", "trending", "explore", "explorepage", "followme", "likeforlike", "follow"])
/** Each brand's own hashtag, always first. */
const BRAND_TAGS: [RegExp, string][] = [
  [/rentsouq/i, "#Rentsouq"],
  [/fhi/i, "#FHIGlobal"],
  [/pickle\s*play/i, "#PicklePlayPH"],
  [/homes\.?\s*ph/i, "#HomesPH"],
]
const MAX_TAGS = 8

/** "#HomesPH #Cebu, real estate" → ["#HomesPH", "#Cebu", "#RealEstate"]: no spam tags, no repeats, the brand's own first. */
export function cleanHashtags(raw: string, brand: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  const marked = raw.match(/#[\p{L}\p{N}_]+/gu)
  // "#HomesPH #CebuCity"; without # marks, a list like "real estate, Cebu" → "RealEstate", "Cebu".
  const candidates = marked
    ? marked.map((t) => t.slice(1))
    : raw.split(/[,;\n]+/).map((part) =>
        part
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(""),
      )
  for (const candidate of candidates) {
    const tag = candidate.replace(/[^\p{L}\p{N}_]/gu, "")
    if (!tag || !/^\p{L}/u.test(tag) || tag.length > 40) continue
    const key = tag.toLowerCase()
    if (seen.has(key) || SPAM_TAGS.has(key)) continue
    seen.add(key)
    tags.push(`#${tag}`)
  }
  const own = BRAND_TAGS.find(([re]) => re.test(brand))?.[1]
  if (!own) return tags.slice(0, MAX_TAGS)
  // The brand's own tag first; another brand's own tag doesn't belong on this post.
  const others = new Set([...BRAND_TAGS.map(([, tag]) => tag.toLowerCase()), "#fhiglobalproperty"])
  return [own, ...tags.filter((t) => !others.has(t.toLowerCase()))].slice(0, MAX_TAGS)
}

/**
 * Caption lines as posted: no emojis, markdown, hashtags (they go at the end) or em dashes
 * (a tell-tale of AI writing), one short paragraph per line, separated by a blank line.
 */
export function cleanCaption(lines: string[]): { text: string; tags: string } {
  const tags: string[] = []
  const paragraphs = lines
    .map((line) =>
      line
        .replace(/\*\*|__|`/g, "")
        .replace(EMOJI, "")
        .replace(/#[\p{L}\p{N}_]+/gu, (tag) => {
          tags.push(tag)
          return ""
        })
        // A dash between clauses becomes a comma; a range ("Jan 22–Feb 1", "9 AM–5 PM") stays.
        .replace(/[ \t]*—[ \t]*|[ \t]+–[ \t]+/g, ", ")
        .replace(/[‐‑]/g, "-")
        .replace(/\s+([,.!?])/g, "$1")
        .replace(/,\s*,/g, ",")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^["“]+|["”]+$/g, "")
        .replace(/^[,\s]+|[,\s]+$/g, ""),
    )
    .filter((line) => line && !/^\[.*\]$/.test(line))
  return { text: paragraphs.join("\n\n"), tags: tags.join(" ") }
}

/** Longest report details kept (a poster's `topic` holds 500 characters). */
export const DETAILS_MAX = 480

/**
 * Report "Details" as pasted (Daily Trend News): one paragraph of at most 3 sentences, without a
 * "Details:" label, quotes around it, emojis, hashtags or em dashes.
 */
export function cleanTrendDetails(text: string): string {
  let t = text
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:report\s+)?details?\s*:\s*/i, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(EMOJI, "")
    .replace(/[ \t]*—[ \t]*|[ \t]+–[ \t]+/g, ", ")
    // Plain hyphens ("off-plan"), not the look-alike dashes some models write.
    .replace(/[‐‑]/g, "-")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim()
  // Sentences end at . ! ? followed by a space and a capital letter or number ("U.S. market" stays whole).
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/)
  if (sentences.length > 3) t = sentences.slice(0, 3).join(" ")
  if (t.length > DETAILS_MAX) t = `${t.slice(0, DETAILS_MAX - 1).replace(/\s+\S*$/, "")}…`
  return /^(none|n\/?a|-+)$/i.test(t) ? "" : t
}

/** The REPORT DETAILS: of an AI answer (it may go on over a few lines), "" when there's none. */
function detailsOf(lines: string[]): string {
  const from = lines.findIndex((l) => labelOf(l) === "REPORT DETAILS")
  if (from < 0) return ""
  const parts = [lines[from].slice(lines[from].indexOf(":") + 1).trim()]
  for (const line of lines.slice(from + 1)) {
    if (labelOf(line)) break
    parts.push(line)
  }
  return cleanTrendDetails(parts.join(" "))
}

/** The CAPTION: lines (up to the next label) and the HASHTAGS: of an AI answer, or null when there's no caption. */
export function parsePosterCaption(text: string, brand: string): PosterCaption | null {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const from = lines.findIndex((l) => labelOf(l) === "CAPTION")
  if (from < 0) return null
  const body: string[] = []
  const first = lines[from].slice(lines[from].indexOf(":") + 1).trim()
  if (first) body.push(first)
  for (const line of lines.slice(from + 1)) {
    if (labelOf(line)) break
    body.push(line)
  }
  const { text: caption, tags } = cleanCaption(body)
  if (caption.length < 20) return null
  const at = lines.findIndex((l) => labelOf(l) === "HASHTAGS")
  const tagLine = at >= 0 ? `${lines[at].slice(lines[at].indexOf(":") + 1)} ${!lines[at].slice(lines[at].indexOf(":") + 1).trim() && lines[at + 1] && !labelOf(lines[at + 1]) ? lines[at + 1] : ""}` : ""
  return { text: caption, hashtags: cleanHashtags(`${tagLine} ${tags}`, brand) }
}

/**
 * The AI's poster content (BRAND / POSTER CATEGORY / RECOMMENDED HEADLINE / HOOK WORDS /
 * ALTERNATIVE HEADLINES / SUBTEXT) as headline choices (the recommended one first) and
 * the one-line subtext. Answers in the older "headline | hook words" lines still work.
 */
export function parsePosterCopy(text: string, brand = ""): PosterCopy {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const valueOf = (label: string) => {
    const i = lines.findIndex((l) => labelOf(l) === label)
    if (i < 0) return ""
    const inline = lines[i].slice(lines[i].indexOf(":") + 1).trim()
    // The value may be on the next line ("SUBTEXT:\nNovember 22, 2026 | …").
    return inline || (lines[i + 1] && !labelOf(lines[i + 1]) ? lines[i + 1] : "")
  }
  const recommended = cleanPart(valueOf("RECOMMENDED HEADLINE"))
  if (!recommended) return { category: "", options: parseHeadlineOptions(text), subtext: "", subtexts: [], noSubtext: false, caption: null, details: "" }

  const options: HeadlineOption[] = [{ headline: recommended, highlight: hookIn(recommended, cleanPart(valueOf("HOOK WORDS"))) }]
  const from = lines.findIndex((l) => labelOf(l) === "ALTERNATIVE HEADLINES")
  if (from >= 0) {
    for (const line of lines.slice(from + 1)) {
      if (labelOf(line)) break
      const item = line.replace(/^(?:\d+[.)]|[-*•])\s*/, "")
      if (item === line && !/^\d/.test(line) && !/^[-*•]/.test(line)) continue
      const bar = item.lastIndexOf("|")
      const headline = cleanPart(bar >= 0 ? item.slice(0, bar) : item)
      if (headline.length < 6 || options.some((o) => o.headline.toLowerCase() === headline.toLowerCase())) continue
      options.push({ headline, highlight: hookIn(headline, bar >= 0 ? cleanPart(item.slice(bar + 1)) : "") })
    }
  }
  return {
    category: cleanPart(valueOf("POSTER CATEGORY")),
    options,
    ...subtextsOf(lines, valueOf("SUBTEXT"), valueOf("SUBTEXT TYPE")),
    caption: parsePosterCaption(text, brand),
    details: detailsOf(lines),
  }
}

const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()

/**
 * Only real quotes: a "quote" choice must be words someone says in the article (the article
 * has quotation marks and those exact words). Others are dropped; if the recommended one is
 * dropped, the next choice is recommended.
 */
export function keepRealQuotes(copy: PosterCopy, article: string): PosterCopy {
  const quoted = /["“”«»]/.test(article)
  const source = letters(article)
  const real = (o: SubtextOption) => o.kind !== "quote" || (quoted && source.includes(letters(o.text)))
  if (copy.subtexts.every(real)) return copy
  const subtexts = copy.subtexts.filter(real)
  const wasRecommended = !!copy.subtext && !real(copy.subtexts[0])
  if (!wasRecommended) return { ...copy, subtexts }
  return { ...copy, subtexts, subtext: subtexts[0]?.text ?? "" }
}

/** The subtext choices with the recommended one first, or none when the AI says the headline says it all. */
function subtextsOf(lines: string[], chosen: string, chosenType: string): Pick<PosterCopy, "subtext" | "subtexts" | "noSubtext"> {
  const subtexts: SubtextOption[] = []
  const from = lines.findIndex((l) => labelOf(l) === "SUBTEXT OPTIONS")
  if (from >= 0) {
    for (const line of lines.slice(from + 1)) {
      if (labelOf(line)) break
      if (!LIST_ITEM.test(line)) continue
      const option = parseSubtextOption(line)
      if (option && !subtexts.some((o) => o.text.toLowerCase() === option.text.toLowerCase())) subtexts.push(option)
    }
  }
  const pick = splitKind(chosen).rest.replace(/[.\s]+$/, "").trim()
  if (!pick || NONE.test(pick)) return { subtext: "", subtexts, noSubtext: !!pick }
  const best = parseSubtextOption(chosenType && !splitKind(chosen).label ? `[${chosenType}] ${chosen}` : chosen)
  if (!best) return { subtext: "", subtexts, noSubtext: false }
  // The recommended one first (usually one of the options, written again).
  const same = subtexts.findIndex((o) => o.text.toLowerCase() === best.text.toLowerCase())
  const recommended = same >= 0 ? subtexts.splice(same, 1)[0] : best
  return { subtext: recommended.text, subtexts: [recommended, ...subtexts], noSubtext: false }
}
