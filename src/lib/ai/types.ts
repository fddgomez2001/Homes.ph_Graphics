/** Carousel text sent to the AI (no images, no styling: keeps requests small). */
export interface CarouselText {
  /** Cover title: Headline 1 + Headline 2. */
  title: string
  /** Cover subtitle. */
  subtitle: string
  cards: { title: string; subtitle: string; description: string }[]
  caption?: string
}

export type AiRequest =
  /** A shorter (or fuller) description for one card that fits 2–3 lines. */
  | { task: "card-description"; carousel: CarouselText; cardIndex: number; minChars: number; maxChars: number }
  /** One short line for the cover subtitle, summing up the cards. */
  | { task: "cover-subtitle"; carousel: CarouselText; maxChars: number }
  /** The Facebook post caption, from all slides. */
  | { task: "caption"; carousel: CarouselText }

export type AiTask = AiRequest["task"]

export interface AiResponse {
  text: string
}
