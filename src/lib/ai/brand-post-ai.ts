/**
 * Poster Maker → Did You Know and Engagement Posts (1.52): the AI writes a post's texts for its template, by the
 * team's instructions (public/ALL-BRAND-TEMPLATES/_Scripts & Instructions/homesph-post-templates-instructions.txt,
 * "Writing good content (for the AI)"), and its Facebook caption. No imports: shared by the app and the AI route.
 */

/** A post's field the AI fills, with how it reads on the template. */
export type BrandPostAiField = "kicker" | "title" | "subtitle" | "question" | "labels" | "options" | "facts" | "cta"

export interface BrandPostAiRequest {
  /** "FHI Global Property", "Homes.ph Cebu", "PicklePlay PH", "Bayanihan" */
  brand: string
  kind: "dyk" | "engagement"
  /** "Trivia Quiz", "3 Facts" */
  template: string
  /** The template's fields. */
  fields: BrandPostAiField[]
  /** What it's about ("" = the AI picks one for the brand). */
  topic: string
  /** Posts already made (titles), so the AI writes a new one. */
  avoid: string[]
}

export const BRAND_POST_RULES = `You write Facebook posts for real estate, community and sports brands in the Philippines and the UAE: "Did You Know?" facts and engagement posts (questions, trivia, this or that, then and now, guess the place). Each post is drawn on a fixed template, so every text must fit its place.

WRITING RULES (follow exactly):
- Titles: 30–70 characters. Questions end with "?".
- Highlight ONE key phrase per title with *stars* (a place, a year, a name), e.g. Remember the *Old TOPS*? Never more than one highlighted phrase per text. Never highlight a verb.
- Subtitles: one short line, under 45 characters.
- Kickers (the small pill): 1–3 words, e.g. TRIVIA TIME, THIS OR THAT, GUESS THE PLACE.
- Labels on photos: "A · Name", "B · Name" or "Then · 1990s", "Now · 2026"; under 22 characters each.
- Trivia answers: under 40 characters each, exactly three, only ONE correct.
- Facts: one sentence each, under 90 characters, with one *highlighted* phrase.
- Engagement posts always end with a clear ask in the subtitle or call to action ("Comment A or B below!", "Tell us in the comments!", "COMMENT YOUR GUESS!").
- Facts must be TRUE and well known; never invent numbers, dates or names. If unsure, choose another fact.
- Warm, positive, local. No emojis, no hashtags in the post texts, no quotes around them.
- The CAPTION: 2–4 short sentences that repeat the question or fact and invite comments, then a blank line and 3–6 hashtags (the brand's first). No emojis.`

const FIELD_LINES: Record<BrandPostAiField, string> = {
  kicker: "KICKER: <1–3 words>",
  title: "TITLE: <the title, one *highlighted* phrase>",
  subtitle: "SUBTITLE: <one short line>",
  question: "QUESTION: <the question, one *highlighted* phrase, ends with ?>",
  labels: "LABEL 1: <label of photo 1>\nLABEL 2: <label of photo 2>",
  options: "OPTION A: <answer>\nOPTION B: <answer>\nOPTION C: <answer>\nANSWER: <A, B or C, the correct one>",
  facts: "FACT 1: <fact>\nFACT 2: <fact>\nFACT 3: <fact>",
  cta: "CTA: <the call to action on the photo>",
}

/** What each template asks for (by its name). */
const TEMPLATE_HINTS: Record<string, string> = {
  "Did You Know": "One surprising, true fact (the SUBTITLE holds the fact, up to 3 lines, under 110 characters).",
  "3 Facts": "A title like 3 Things You Didn't Know About *Place*, and three short true facts.",
  "Memory Question": "A nostalgic “Remember when…?” question as the title.",
  Throwback: "An old place or throwback: the title names it, the subtitle says why it's missed.",
  "This or That": "A choice between two things (photo A and photo B); the subtitle is the ask (Comment A or B below!).",
  "Then & Now": "How a place changed: labels Then · <year> and Now · <year>; the subtitle asks how it changed.",
  "Trivia Quiz": "A trivia question (the title) with three answers, one correct.",
  "Guess the Place": "A clue about a place (the title), a hint (the subtitle) and the call to action.",
  "Question Card": "An open question people love to answer (in the card); the subtitle is the ask (Tell us in the comments!).",
}

export function brandPostPrompt(req: BrandPostAiRequest): string {
  const lines = [...new Set(req.fields)].map((f) => FIELD_LINES[f]).join("\n")
  const avoid = req.avoid.filter(Boolean).slice(0, 30)
  return `BRAND: ${req.brand}
POST: ${req.kind === "dyk" ? "Did You Know?" : "Engagement post"} on the "${req.template}" template. ${TEMPLATE_HINTS[req.template] ?? ""}
TOPIC: ${req.topic.trim() || `(pick a good one for ${req.brand}'s followers)`}
${avoid.length ? `ALREADY POSTED (write something different):\n${avoid.map((a) => `- ${a}`).join("\n")}\n` : ""}
Write the post. Reply in exactly this format, one line each, nothing else:
${lines}
CAPTION: <the caption, then a blank line, then the hashtags>`
}

export interface BrandPostAiResult {
  kicker?: string
  title?: string
  subtitle?: string
  question?: string
  labels?: string[]
  options?: string[]
  /** 0, 1 or 2: the correct answer (trivia). */
  answer?: number
  facts?: string[]
  cta?: string
  caption: string
}

const clean = (v: string) =>
  v
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\*\*/g, "*")
    .replace(/[ \t]+/g, " ")
    .trim()

/** Reads the AI's labeled lines (only the fields asked for are kept). */
export function parseBrandPost(text: string, fields: BrandPostAiField[]): BrandPostAiResult {
  const out: BrandPostAiResult = { caption: "" }
  const lines = text.replace(/\r/g, "").split("\n")
  const caption: string[] = []
  let inCaption = false
  const labels: string[] = []
  const options: string[] = []
  const facts: string[] = []
  for (const raw of lines) {
    const m = /^\s*(KICKER|TITLE|SUBTITLE|QUESTION|LABEL ([12])|OPTION ([ABC])|ANSWER|FACT ([123])|CTA|CAPTION)\s*:\s*(.*)$/i.exec(raw)
    if (!m) {
      if (inCaption) caption.push(raw)
      continue
    }
    inCaption = false
    const key = m[1].toUpperCase()
    const value = clean(m[5])
    if (key === "CAPTION") {
      inCaption = true
      caption.push(m[5])
    } else if (key === "KICKER") out.kicker = value.toUpperCase()
    else if (key === "TITLE") out.title = value
    else if (key === "SUBTITLE") out.subtitle = value
    else if (key === "QUESTION") out.question = value
    else if (key === "CTA") out.cta = value.toUpperCase()
    else if (key.startsWith("LABEL")) labels[Number(m[2]) - 1] = value
    else if (key.startsWith("OPTION")) options["ABC".indexOf(m[3].toUpperCase())] = value
    else if (key.startsWith("FACT")) facts[Number(m[4]) - 1] = value
    else if (key === "ANSWER") {
      const i = "ABC".indexOf(value.charAt(0).toUpperCase())
      if (i >= 0) out.answer = i
    }
  }
  if (labels.length) out.labels = [labels[0] ?? "", labels[1] ?? ""]
  if (options.length) out.options = [0, 1, 2].map((i) => options[i] ?? "")
  if (facts.length) out.facts = [0, 1, 2].map((i) => facts[i] ?? "")
  out.caption = caption
    .join("\n")
    .replace(/\*([^*]+)\*/g, "$1")
    // The hashtags after a blank line.
    .replace(/([^\n])\n(#)/, "$1\n\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  // Only what the template has.
  for (const f of ["kicker", "title", "subtitle", "question", "labels", "options", "facts", "cta"] as const) if (!fields.includes(f)) delete out[f]
  return out
}
