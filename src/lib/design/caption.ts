import type { SlideDesign, TextElement } from "./types"

/** Words that stay capitalized when turning Title Case into a sentence. */
const PROPER_NOUNS = new Set(
  [
    "Filipino", "Filipinos", "Filipina", "Philippines", "Philippine", "Pinoy", "Pinay", "Manila", "Metro", "Luzon", "Visayas",
    "Mindanao", "Cebu", "Davao", "Makati", "Taguig", "Pasig", "Quezon", "BGC", "Bonifacio", "Ortigas", "Alabang", "Iloilo",
    "Baguio", "Tagaytay", "Cordillera", "Christmas", "Homes.ph", "Facebook", "Instagram", "TikTok", "Pag-IBIG", "SSS", "GSIS",
  ].map((w) => w.toLowerCase()),
)

/** Multi-word names kept exactly as written. */
const PROPER_PHRASES = [
  "Bonifacio Global City", "Metro Manila", "Quezon City", "Makati City", "Pasig City", "Taguig City", "Cebu City",
  "Davao City", "Mandaluyong City", "Eastwood City", "Ortigas Center", "Rockwell Center", "Clark Freeport", "New Manila",
]

/** Private-use marker for protected phrases while words are lowercased. */
const MARK = "\uE000"

function keepCase(word: string) {
  const bare = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, "")
  if (PROPER_NOUNS.has(bare.toLowerCase())) return true
  // Acronyms (BGC, LRT) and words with digits (10M, 2026) keep their case.
  return (bare.length > 1 && bare === bare.toUpperCase() && /\p{L}/u.test(bare)) || /\d/.test(bare)
}

/** "6 Traditional Filipino Instruments" → "6 traditional Filipino instruments". */
export function toSentencePhrase(text: string): string {
  let clean = text.replace(/\s+/g, " ").trim().replace(/[.!?:;,]+$/, "")
  const kept: string[] = []
  for (const phrase of PROPER_PHRASES) {
    clean = clean.replace(new RegExp(phrase.replace(/ /g, "\\s+"), "gi"), () => {
      kept.push(phrase)
      return `${MARK}${kept.length - 1}${MARK}`
    })
  }
  return clean
    .split(" ")
    .map((word) => (word.includes(MARK) || keepCase(word) ? word : word.toLowerCase()))
    .join(" ")
    .replace(new RegExp(`${MARK}(\\d+)${MARK}`, "g"), (_, i: string) => kept[Number(i)])
}

function textOf(design: SlideDesign, ...roles: string[]) {
  for (const role of roles) {
    const el = design.elements.find((e): e is TextElement => e.type === "text" && e.role === role && e.visible && !!e.text.trim())
    if (el) return el.text
  }
  return ""
}

function list(items: string[]) {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")}${items.length > 2 ? "," : ""} and ${items.at(-1)}`
}

/** The plural noun a cover description is about: "6 Small Filipino Businesses That …" → "businesses". */
function subjectNoun(description: string) {
  const words = toSentencePhrase(description).split(" ")
  const stop = words.findIndex((w, i) => i > 0 && /^(with|that|which|who|for|in|to|behind|you|we|every|across|of|under)$/i.test(w))
  const head = (stop > 0 ? words.slice(0, stop) : words).filter((w) => /\p{L}/u.test(w))
  const noun = head.at(-1)
  return noun && /s$/i.test(noun) ? noun : null
}

/**
 * A first draft in the Homes.ph caption style, built only from the slide text:
 * "Discover <cover description>! From <card 1> and <card 2> to <card 3>, …, and <card N>, …"
 */
export function draftCaption(slides: { design: SlideDesign }[]): string {
  if (!slides.length) return ""
  const cover = slides[0].design
  const description = textOf(cover, "description")
  const headline = [textOf(cover, "headline", "title"), textOf(cover, "highlight", "subtitle")].filter(Boolean).join(" ")
  const subject = description || headline
  const cards = slides
    .slice(1)
    .map((s) => textOf(s.design, "title", "headline", "stat"))
    .filter(Boolean)
    .map(toSentencePhrase)

  const sentences: string[] = []
  if (subject) sentences.push(`Discover ${toSentencePhrase(subject)}!`)
  if (cards.length >= 2) {
    const noun = description ? subjectNoun(description) : null
    const ending = noun ? `swipe through to see what makes each of these ${noun} special.` : "swipe through to learn more about each one."
    const [first, second, ...rest] = cards
    const from = rest.length ? `From ${first} and ${second} to ${list(rest)}` : `From ${first} to ${second}`
    sentences.push(`${from}, ${ending}`)
  } else if (cards.length === 1) {
    sentences.push(`Swipe through to learn more about ${cards[0]}.`)
  }
  return sentences.join(" ")
}
