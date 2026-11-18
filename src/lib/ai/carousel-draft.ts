/**
 * Create New Carousel → from an article: the AI's answer (HEADLINE 1 / HEADLINE 2 / SUBTITLE /
 * CARDS / CAPTION) as the cover lines, the content cards and the caption.
 */

export interface CarouselDraftCard {
  title: string
  subtitle: string
  description: string
}

export interface CarouselDraft {
  /** Headline line 1 (white). */
  line1: string
  /** Headline line 2 (gold). */
  line2: string
  subtitle: string
  /** The Facebook caption: three short paragraphs with a few emojis. */
  caption: string
  cards: CarouselDraftCard[]
}

const LABELS = ["HEADLINE 1", "HEADLINE 2", "SUBTITLE", "CARDS", "CAPTION"]
const labelOf = (line: string) => LABELS.find((label) => new RegExp(`^${label.replace(" ", "\\s*")}\\s*:`, "i").test(line))
const after = (line: string) => line.slice(line.indexOf(":") + 1).trim()

const EMOJI = /(?![©®™])\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu

/** Slide text: one line, no markdown, emojis, hashtags, brackets or quotes around it, no em dashes. */
export function cleanSlideText(text: string, max: number): string {
  let t = text
    .replace(/\*\*|__|`/g, "")
    .replace(EMOJI, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[ \t]*—[ \t]*|[ \t]+–[ \t]+/g, ", ")
    .replace(/[‐‑]/g, "-")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    // Quotes around it ("And Endless Views." or "And Endless Views".) and [brackets] go.
    .replace(/^["“”]+/, "")
    .replace(/["“”]+(?=[.!?]?$)/, "")
    .replace(/^\[(.*)\]$/, "$1")
    .trim()
  if (/^(none|n\/?a|-+|\(none\))$/i.test(t)) return ""
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:]$/, "")
  return t
}

/** "1. Title | Subtitle | Description" (or with TITLE: / SUBTITLE: / DESCRIPTION: labels). */
function parseCard(line: string): CarouselDraftCard | null {
  const item = line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "")
  const parts = item.split(/\s+\|\s+|\s*\|\s*/)
  const [rawTitle = "", rawSubtitle = "", ...rest] = parts
  const unlabel = (t: string, label: string) => t.replace(new RegExp(`^\\s*${label}\\s*:\\s*`, "i"), "")
  const title = cleanSlideText(unlabel(rawTitle, "(?:card\\s+)?title"), 60)
  if (!title || title.length < 2) return null
  return {
    title,
    subtitle: cleanSlideText(unlabel(rawSubtitle, "(?:card\\s+)?subtitle"), 60),
    description: cleanSlideText(unlabel(rest.join(" | "), "(?:card\\s+)?description"), 240),
  }
}

/** The caption's paragraphs: no hashtags or markdown, no line about swiping (the photos show as a grid). */
function cleanCaption(lines: string[]): string {
  return lines
    .map((line) =>
      line
        .replace(/\*\*|__|`/g, "")
        .replace(/#[\p{L}\p{N}_]+/gu, "")
        .replace(/[ \t]*—[ \t]*/g, ", ")
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !/\bswip(e|es|ing)\b/i.test(sentence))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^["“]+|["”]+$/g, ""),
    )
    .filter((line) => line && !/^\[.*\]$/.test(line))
    .join("\n\n")
}

/**
 * The AI's carousel: null when it has no headline or no card. At most `maxCards` cards
 * (repeats are left out).
 */
export function parseCarouselDraft(text: string, maxCards = 10): CarouselDraft | null {
  const lines = text
    .split(/\n/)
    // Markdown bold and headings off ("**HEADLINE 1:**", "## CARDS:").
    .map((l) => l.replace(/\*\*|__/g, "").replace(/^\s*#+\s+/, "").trim())
    .filter(Boolean)
  const valueOf = (label: string) => {
    const i = lines.findIndex((l) => labelOf(l) === label)
    if (i < 0) return ""
    return after(lines[i]) || (lines[i + 1] && !labelOf(lines[i + 1]) ? lines[i + 1] : "")
  }
  const blockOf = (label: string) => {
    const i = lines.findIndex((l) => labelOf(l) === label)
    if (i < 0) return []
    const block = after(lines[i]) ? [after(lines[i])] : []
    for (const line of lines.slice(i + 1)) {
      if (labelOf(line)) break
      block.push(line)
    }
    return block
  }
  const line1 = cleanSlideText(valueOf("HEADLINE 1"), 80)
  const cards: CarouselDraftCard[] = []
  for (const line of blockOf("CARDS")) {
    const card = parseCard(line)
    if (card && !cards.some((c) => c.title.toLowerCase() === card.title.toLowerCase())) cards.push(card)
  }
  if (!line1 || !cards.length) return null
  return {
    line1,
    line2: cleanSlideText(valueOf("HEADLINE 2"), 80),
    subtitle: cleanSlideText(valueOf("SUBTITLE"), 120).replace(/\.$/, ""),
    caption: cleanCaption(blockOf("CAPTION")),
    cards: cards.slice(0, Math.max(1, maxCards)),
  }
}
