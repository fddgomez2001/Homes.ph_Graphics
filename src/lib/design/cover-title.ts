import type { SlideDesign, TextElement } from "./types"

/** The carousel title is Headline 1 + Headline 2 (e.g. "Every Sound Carries A Story."). */
export function mergeTitle(line1: string, line2: string): string {
  return [line1, line2]
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
}

/** Title derived from a cover design (a news article uses its headline), or "" when there's no headline text. */
export function coverTitle(design: SlideDesign): string {
  const text = (role: string) =>
    design.elements.find((e): e is TextElement => e.type === "text" && e.role === role && e.visible)?.text ?? ""
  const title = mergeTitle(text("headline"), text("highlight")) || (design.templateId?.endsWith("-news") ? mergeTitle(text("title"), "") : "")
  return title.slice(0, 300)
}
