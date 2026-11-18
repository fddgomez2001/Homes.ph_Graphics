import "server-only"

import { homesPlace } from "./homes-places"
import { COURT_LAUNCH_RULES, COURT_OWNER_RULES, PICKLEBALL_POST_RULES, pickleballPostPrompt } from "./pickleball-posts"
import { BRAND_POST_RULES, brandPostPrompt } from "./brand-post-ai"
import { callProvider, ProviderError } from "./providers"
import { readPagePosts } from "./meta-pages"
import { cachedSearch } from "./search-cache"
import {
  inWindow,
  isFacebookUrl,
  mergeResults,
  postsInWindow,
  requestPlace,
  researchQueries,
  resultSources,
  resultsBlock,
  tavilySearch,
  TavilyError,
  searchableKeywords,
  trendPostQueries,
  trendSearchPlan,
  type TavilyQuery,
  type TavilyResult,
} from "./tavily"
import { trendArea } from "./trend-area"
import { parseTrendStories } from "./trend-news"
import { BRAND_LOOKS, extraLooks, LOOK_KIND, lookAbout, requestLooks, wantsRealEstate } from "./trend-looks"
import { geminiResearch, perplexitySearch, SearchFailed, serpSearch } from "./web-search"
import {
  PAGE_ENGINES,
  SEARCH_ENGINE_ORDER,
  type AiProviderConfig,
  type AiRequest,
  type AiSearchInfo,
  type AiSource,
  type CarouselBrandId,
  type CarouselText,
  type SearchEngineId,
  type TrendBrand,
} from "./types"

/**
 * Writing suggestions with Groq (server-only: the API key never reaches the browser).
 * Prompts are short and fixed per task, answers are capped, and the reasoning
 * models run at low effort, so each suggestion costs a fraction of a cent.
 */

/** Overridable for proxies or local testing. */
const api = () => `${(process.env.GROQ_API_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/+$/, "")}/chat/completions`
/** Most accurate first; the next ones are used only if a model is unavailable. */
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    /** The user's own key or model failed (the built-in Groq can still be tried). */
    readonly own = false,
  ) {
    super(message)
  }
}

/** Where the person sets up their own AI (the desktop app has no built-in key). */
const SET_UP_AI = "Set up your own AI in Settings → AI (Groq is free: console.groq.com/keys)."

export function groqConfigured() {
  return !!process.env.GROQ_API_KEY?.trim()
}

/** The editor's carousel writing (card description, cover subtitle, caption) for the carousel's brand. */
function carouselCopyRules(brand: CarouselBrandId = "homes") {
  const info = CAROUSEL_BRAND_INFO[brand]
  return `You write copy for ${info.name} for its Facebook posts. ${info.about} Each post is a set of designed images (a cover and cards) uploaded as photos in one Facebook post.
Rules:
- Use only facts, names, places, numbers and prices found in the input. Never invent or guess details.
- Clear, natural English for ${info.readers}. Polished and accurate, never hypey.
- No hashtags, em dashes or quotation marks around the answer. No emojis unless the task asks for them.
- Avoid filler and AI-sounding phrases such as "dive into", "unlock", "elevate", "discover the magic", "nestled", "a testament to", "whether you're", "look no further", "in today's".
- Reply with the requested text only, nothing else.`
}

/** Poster Maker tasks: news posters for three brands, not only Homes.ph. */
const POSTER_RULES = `You write headlines for news posters posted on Facebook by three brands: PicklePlay PH (pickleball in the Philippines), FHI Global Property (Dubai and UAE real estate) and Homes.ph (Philippine real estate, places and lifestyle).
Rules:
- Use only facts, names, places and numbers found in the input. Never invent, exaggerate or guess details.
- Clear, natural English for Filipino readers. Accurate and specific, never clickbait or misleading.
- No hashtags, emojis, em dashes, or quotation marks around the answer.
- Reply in the requested format only, nothing else.`

/**
 * Poster Maker → Write from article: the user's "Poster Headline & Subtext Generator" brief
 * (roles, categories A–P, brand tones, rules), plus the hook words for the highlight.
 */
const POSTER_COPY_RULES = `ROLE
You are an AI Poster Content Assistant for three brands: FHI Global Property, PicklePlay.ph and Homes.ph. You analyze pasted articles, announcements, news, event details or promotional content and write a professional, catchy poster headline and a short subtext (or decide the poster needs none), ready for social media posters.

ANALYZE THE ARTICLE
Identify the main subject, the event or announcement category, important dates, the location or venue, promotions, prices, achievements and other key details, and the most important information for the poster. Decide the poster category yourself.

HEADLINES
Write the headline suggestions asked for and choose the strongest as the Recommended Headline. Each alternative takes a different angle.
- Catchy, engaging and professional; concise and suitable for a poster.
- Highlight the most important news, event, promotion or announcement.
- 3 to 7 words, punchy, with an active verb. Title Case, no period. No unnecessary words. Never exaggerate, mislead or add information that is not in the article.
- Start with the place when it helps ("Caraga Startups Eye Commercial Growth").
- The headline is printed in big capital letters, about 26 characters per line on two lines, so keep it under about 60 characters (longer ones are printed smaller).
For each headline also pick its HOOK WORDS: 2 to 4 consecutive words copied exactly from that headline, shown in the brand's accent color while the rest is white. Pick the most important part (the event or project name, a striking number, the key result), not the place name alone.

SUBTEXT
The subtext is the smaller line under the headline, in the brand color. It is SHORT (at most 10 words; no paragraphs, bullets or line breaks) and must add something the headline does not already say: never repeat the headline's words. Choose the kind that helps THIS poster most:
- DETAILS: for events, tournaments, games, court or restaurant openings, launches, promos, listings, seminars, expos, open houses and anything people attend, visit or act on. The key details, usually two parts (the date and the place); a third only when it is short and essential (a prize, a price, a promo). At most 45 characters. Short month names are fine (Jan 22, 2027; Jan–Feb 2027). Leave out generic words that repeat the headline (Events, Tournament, Announcement). Good: "Jan–Feb 2027 | Pasig, Manila" or "Nov 22, 2026 | Cebu City | ₱50,000 Prize". Too long: "January–February 2027 | Pasig, Manila | PPA Tour Asia Events".
- KEY POINT: for news, results, market updates, achievements, studies, tips and announcements: the article's most important fact or takeaway that the headline leaves out (a number, a result, what changes for the reader). At most 60 characters. Good: "Prices Up 8% In A Year As Supply Tightens" or "Filipino Pair Wins Gold In Mixed Doubles".
- SUMMARY: the article's main message in one short line, when no single fact stands out. At most 60 characters.
- QUOTE: a short, striking line (under 15 words) a named PERSON says in the article (shown there in quotation marks), copied word for word. At most 60 characters. Only when the article quotes someone; never a sentence of the article itself.
- NONE: no subtext when the headline already says everything (greetings, simple statements, or a headline that already has the date and place), so a subtext would only repeat it.
Write 3 SUBTEXT OPTIONS of different kinds (fewer only when the article has nothing for a kind; always at least one, even when you recommend NONE), then give the best one as SUBTEXT, copied exactly, or NONE.
Which to recommend: for events, tournaments, openings, launches, promos, seminars and open houses recommend DETAILS (people need the date and place), unless the headline already has them. For news, results and market updates recommend the KEY POINT (or a QUOTE when it says more). Recommend NONE only when nothing important is left to add.
For DETAILS, the default format is Date | Location | Promos / Key Details. Replace the fields according to the category (the examples show the fields; keep yours shorter when needed):
A. Concerts & music events: Event Date | Venue / Location | Artist / Ticket Information (December 15, 2026 | Cebu City | Featuring [Artist Name])
B. Restaurant grand opening: Opening Date | Restaurant Location | Opening Promos (November 20, 2026 | Mandaue City | 20% Off Opening Promo)
C. Restaurant promotions: Promo Date / Validity | Restaurant Location | Promo Details (November 10–30, 2026 | Cebu City | Buy 1 Get 1 Free)
D. Pickleball tournaments: Tournament Date | Venue / Location | Prize Pool / Registration (November 22, 2026 | Cebu City | ₱50,000 Prize Pool)
E. Pickleball court opening: Opening Date | Court Location | Opening Promo (November 25, 2026 | Lapu-Lapu City | Free Court Booking for Opening Day)
F. Pickleball community events / open play: Event Date | Venue | Schedule / Skill Level (November 18, 2026 | Cebu Pickleball Center | 6 PM–9 PM • All Skill Levels)
G. Pickleball news: Published Date | Location / Tournament | Key News Detail (November 6, 2026 | Asian Pickleball Championship | Philippines Claims Gold)
H. Real estate property for sale: Property Location | Property Type / Price | Key Property Feature (Cebu City | House & Lot • ₱5.8M | 3 Bedrooms • 2 Bathrooms)
I. Real estate property for rent: Property Location | Monthly Rental Price | Property Details (Makati City | ₱35,000 / Month | Fully Furnished 2-Bedroom Condo)
J. Property launch / new development: Launch Date | Project Location | Starting Price / Project Details (November 25, 2026 | Dubai, UAE | Luxury Residences Starting at AED 1.2M)
K. Property investment opportunity: Country / Location | Property / Investment Type | Price / Key Opportunity (Singapore | Residential Property | Starting at SGD 850K). Only show ROI, rental yield or returns when the article states them.
L. Real estate seminars / expo: Event Date | Event Venue | Registration / Event Details (November 28, 2026 | Cebu City | Free Registration)
M. Real estate news: Published Date | Location / Market | Key News Detail (November 6, 2026 | Philippine Real Estate Market | New Housing Development Announced)
N. Property open house / viewing: Viewing Date | Property Location | Viewing Schedule (November 20, 2026 | Mandaue City | 9 AM–5 PM • Walk-ins Welcome)
O. Awards / recognition: Award Date / Year | Awarding Organization | Achievement (2026 | International Property Awards | Best Residential Development)
P. Holiday greetings: Holiday Date | Holiday Name | Greeting (December 25, 2026 | Christmas Day | Season of Joy and Celebration)

BRANDS
- FHI Global Property (and Rentsouq.ae): Dubai and UAE real estate, property investment, developments, launches, real estate events and expos, business partnerships, property news. A professional Dubai/UAE real estate voice for investors, buyers, renters and OFWs in the UAE: elegant, premium, investment-focused. Keep the currencies used in the article (PHP, USD, AED, SGD…).
- PicklePlay.ph: pickleball tournaments, court openings, open play, events, player achievements, pickleball news, training clinics, court promotions, community activities. Energetic, sporty and welcoming to beginners and the pickleball community.
- Homes.ph: Philippine real estate, listings, property launches, housing and mortgage news, developer partnerships, and local news of its pages' places (openings, festivals, tourism, city projects, helpful information). Local, hopeful, community- and property-minded: connect the news to growth, living and investing in the area. Modern, trustworthy, accessible.

RULES
1. Never invent dates, locations, prices, promos, venues, artists, project names or other details.
2. Use only information explicitly stated in the article.
3. For event posters, use the actual event date, not the article's publication date.
4. For news posters, use the publication date if the article gives it.
5. For promotions, use the validity period if given.
6. If a field is unavailable, leave it out instead of inventing a value (the subtext then has fewer parts).
7. Keep the subtext to one short line: no line breaks, no ending period.
8. In DETAILS use only the 2 most relevant fields (3 only when all are short).
9. Never more than 45 characters for DETAILS, 60 for the other kinds: long subtexts clutter the poster.
10. Write dates as Month Day, Year (short month names are fine).
11. Keep the subtext balanced and easy to read.
12. No hashtags or emojis in the headline or subtext.
13. If the article has several events or properties, focus on the main one.
14. Never confuse the publication date with the event date.
15. No promotional claims unless the article states them.
Reply in the requested format only, with no other text and no markdown.`

/**
 * The poster's Facebook caption (also fine for Instagram and LinkedIn): a hook, the key
 * facts, a warm closing line and hashtags. No emojis, plain human English, only facts from
 * the article, always positive.
 */
const POSTER_CAPTION_RULES = `FACEBOOK CAPTION
The caption people read under the poster on Facebook (it also works on Instagram and LinkedIn). It must be true to the article, short but informative, and positive.
- First line: a hook that makes people stop scrolling, built on the most interesting TRUE fact in the article (a number, a result, a date, a first, what changes for people) or a short, natural question. No clickbait and no exaggeration.
- Paragraph 1 (the hook and 1 or 2 short sentences): what happened, where and when, and who, in plain friendly English. Only facts from the article.
- Paragraph 2 (one line): what's next, or why it matters to people in that place (something to look forward to, or a soft invitation like "Save the date" when it fits). Never ask people to like, share, tag friends or comment, and never "link in bio".
- Length: 300 to 400 characters before the hashtags, 3 or 4 short lines in all, one idea per line.
- Tone: warm, positive and hopeful, in the brand's voice. When the news is difficult, focus on the helpful or hopeful side without hiding or changing the facts.
- Sound like a real person from the brand's team, not like AI: plain everyday English, contractions (it's, we're, you'll), short and varied sentences. Avoid these AI-sounding words: exciting news, get ready, don't miss out, game-changer, delve, unlock, elevate, seamless, vibrant, bustling, nestled, testament, look no further, whether you're, in today's world, embark, journey, dive in. No em dashes.
- No emojis, no words in ALL CAPS, no markdown, no quotation marks around the caption.
- Reliable, never fake news: never invent facts, numbers, quotes, prices, dates, names or places, and never present a plan or rumor as a done deal. If the article gives its source (a "Source:" line, or a news outlet it is from), end with "Source: [name]" on its own line.
- HASHTAGS: 6 to 8 relevant hashtags on one line, to help people find the post: the brand's own first (#HomesPH, #PicklePlayPH, #FHIGlobal or #Rentsouq), then the place when there is one (#ButuanCity #Caraga), then the topic (#CaragaStartups, #Pickleball, #RealEstatePH…). CamelCase, letters and numbers only. No generic tags like #viral, #fyp, #trending or #foryou.`

/** Writing only the caption again ("Rewrite caption"). */
const POSTER_CAPTION_SYSTEM = `ROLE
You write Facebook captions for social media posters of three brands: FHI Global Property (international real estate; elegant, premium, investment-focused), PicklePlay.ph (pickleball; sporty, energetic, community) and Homes.ph (Philippine real estate; modern, trustworthy, accessible). You read the article the poster is about and write its caption.

${POSTER_CAPTION_RULES}

Reply in the requested format only, with no other text and no markdown.`

const POSTER_CAPTION_FORMAT = `CAPTION:
[hook line]
[1 or 2 lines: what happened, where and when]
[one line: what's next, or why it matters to people there]
[Source: name, only when the article gives one]
HASHTAGS: #Brand #Place #Topic …`

/**
 * The "Details" line of a poster in the team's daily report (Daily Trend News): what the news is
 * about and why it was picked as the day's trend. Factual, short, positive.
 */
const TREND_DETAILS_RULES = `REPORT DETAILS (the team's daily report, under "Daily Trend News")
2 or 3 sentences, 180 to 420 characters in all, that tell the team what this trend is about and why it was picked.
- First: what the story is and its key fact (the development, event or number), in plain words, from the article only.
- Last sentence: why it's timely for this page's audience, starting "It's timely for …" (home buyers, investors, renters, residents of the place, players, the pickleball community…).
- Plain, professional and positive English, like a social media specialist writing their daily report. Past or present tense, no "I".
- Never invent facts, numbers, names, dates or places. No emojis, hashtags, quotation marks, em dashes or markdown.
- Don't start with "This article", "The article", "This poster" or "Details:".
Example (headline "Dubai Rental Market Shifts to Buying"): Easing rents and a growing supply of new homes are pushing more Dubai tenants to buy instead of rent. It's timely for buyers and investors watching where the UAE property market is heading.
Example (Homes.ph CARAGA): DOST-PCIEERD gathered Caraga's startup incubators in Butuan City for the 10th TBI Summit and shifted its focus to helping startups scale commercially. It's timely for Caraga residents interested in local innovation, jobs and the region's economic growth.`

const REPORT_SYSTEM = `ROLE
You help a social media team write their daily accomplishment report for three brands: FHI Global Property (international real estate), PicklePlay.ph (pickleball) and Homes.ph (Philippine real estate). You write clear, factual, positive report lines in plain professional English.
Reply with the requested text only, with no label, no quotation marks around it and no markdown.`

const POSTER_COPY_FORMAT = `BRAND: [brand name]
POSTER CATEGORY: [the category you identified]
RECOMMENDED HEADLINE: [best headline]
HOOK WORDS: [2–5 consecutive words copied exactly from the recommended headline]
ALTERNATIVE HEADLINES:
1. [another headline] | [its hook words]
2. [another headline] | [its hook words]
(one numbered line per alternative asked for)
SUBTEXT OPTIONS:
1. [Details] [Date] | [Location] | [Promo / Key Details]
2. [Key point] [the most important fact the headline leaves out]
3. [Quote] "[a short line from the article]" (or [Summary] …)
SUBTEXT: [the best option copied exactly, or NONE]
REPORT DETAILS: [2 or 3 sentences: what the story is, its key fact, and "It's timely for …" this page's audience]
${POSTER_CAPTION_FORMAT}`

/** How much of a pasted article goes into the prompt (the opening carries the news). */
const ARTICLE_PROMPT_CHARS = 12_000

const clip = (text: string, max: number) => {
  const t = text.replace(/\s+/g, " ").trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Compact outline of the carousel (keeps prompts small). */
function outline(c: CarouselText, descriptionChars: number) {
  const lines = [`Title: ${clip(c.title, 200) || "(none)"}`, `Subtitle: ${clip(c.subtitle, 200) || "(none)"}`, `Cards (${c.cards.length}):`]
  c.cards.forEach((card, i) => {
    const parts = [clip(card.title, 120), clip(card.subtitle, 120)].filter(Boolean).join(" | ")
    const desc = clip(card.description, descriptionChars)
    lines.push(`${i + 1}. ${parts || "(untitled)"}${desc ? `: ${desc}` : ""}`)
  })
  return lines.join("\n")
}

export function prompt(req: AiRequest): { system: string; user: string; maxTokens: number; temperature?: number } {
  const p = taskPrompt(req)
  const system =
    req.task === "article-headline"
      ? `${POSTER_COPY_RULES}\n\n${POSTER_CAPTION_RULES}\n\n${TREND_DETAILS_RULES}`
      : req.task === "poster-caption"
        ? POSTER_CAPTION_SYSTEM
        : req.task === "trend-details"
          ? `${REPORT_SYSTEM}\n\n${TREND_DETAILS_RULES}`
          : req.task === "carousel-from-article"
            ? carouselDraftRules(req.brand)
            : req.task === "carousel-research"
              ? researchRules(req.brand)
              : req.task === "trend-search"
                ? trendSearchRules(false, lookScope(req).wide, lookScope(req).helpful)
              : req.task === "news-article"
                ? NEWS_ARTICLE_RULES
              : req.task === "carousel-topics"
                ? topicRules(req.brand)
            : req.task === "headline-highlight"
              ? POSTER_RULES
              : req.task === "brand-post"
                ? BRAND_POST_RULES
              : req.task === "pickleball-post"
                ? req.kind === "courtowner"
                  ? COURT_OWNER_RULES
                  : req.kind === "comingsoon" || req.kind === "nowopen"
                    ? COURT_LAUNCH_RULES
                    : PICKLEBALL_POST_RULES
              : carouselCopyRules("carousel" in req ? req.carousel.brand : undefined)
  return { system, ...p }
}

function taskPrompt(req: AiRequest): { user: string; maxTokens: number; temperature?: number } {
  if (req.task === "brand-post") {
    // A new post each time.
    return { maxTokens: 900, temperature: 0.8, user: brandPostPrompt(req) }
  }
  if (req.task === "pickleball-post") {
    // A new fact each time; the facts come from the bank (the rules forbid others).
    return { maxTokens: 1400, temperature: 0.7, user: pickleballPostPrompt(req) }
  }
  if (req.task === "poster-caption") {
    const article = req.article.length > ARTICLE_PROMPT_CHARS ? `${req.article.slice(0, ARTICLE_PROMPT_CHARS)}…` : req.article
    return {
      maxTokens: 900,
      // "Rewrite caption" gives a new take each time.
      temperature: 0.8,
      user: `BRAND: ${req.brand}
POSTER HEADLINE: ${req.headline || "(none yet)"}

ARTICLE:
"""
${article}
"""

${placeRule(req.brand)}Write the Facebook caption for this poster, with its hashtags.
Reply in exactly this format:
${POSTER_CAPTION_FORMAT}`,
    }
  }
  if (req.task === "trend-details") {
    const article = req.article.length > ARTICLE_PROMPT_CHARS ? `${req.article.slice(0, ARTICLE_PROMPT_CHARS)}…` : req.article
    const source = article
      ? `ARTICLE:
"""
${article}
"""`
      : `POST CAPTION (written from the article; the only facts you have):
"""
${clip(req.caption, 1500) || "(none)"}
"""`
    return {
      maxTokens: 700,
      // "Write again" gives a new take.
      temperature: 0.7,
      user: `BRAND: ${req.brand}
POSTER HEADLINE: ${req.headline}
POSTER SUBTEXT: ${req.subtext || "(none)"}

${source}

${placeRule(req.brand)}Write the REPORT DETAILS for this Daily Trend News poster: 2 or 3 sentences, 180 to 420 characters, the last one saying why it's timely for this page's audience.${article ? "" : " Use only the facts in the headline, subtext and caption."}
Reply with the details only.`,
    }
  }
  if (req.task === "carousel-research") {
    return {
      maxTokens: 4000,
      temperature: 0.3,
      user: `TOPIC: ${req.topic}
CARDS: ${req.cards}
AVOID (already featured in earlier ${CAROUSEL_BRAND_INFO[req.brand ?? "homes"].name} carousels; never pick these): ${req.avoid.length ? req.avoid.join("; ") : "(none)"}

Search the web for this topic, open the best sources, and pick ${req.cards} items for the cards (fewer only if the sources don't support ${req.cards}).
Reply in exactly this format:
${RESEARCH_FORMAT}`,
    }
  }
  if (req.task === "trend-search") {
    return { maxTokens: 3500, temperature: 0.3, user: trendBrowseUser(req, req.posts === "always" ? "also" : "none", []) }
  }
  if (req.task === "news-article") {
    const article = req.article.length > ARTICLE_PROMPT_CHARS ? `${req.article.slice(0, ARTICLE_PROMPT_CHARS)}…` : req.article
    return {
      maxTokens: 2800,
      temperature: 0.5,
      user: `BRAND: ${req.brand}
SOURCE: ${req.source || "(not given)"}

THE STORY (the only facts you have):
"""
${article}
"""

${placeRule(req.brand)}Write the content for this story.
Reply in exactly this format:
${NEWS_ARTICLE_FORMAT}`,
    }
  }
  if (req.task === "carousel-topics") {
    return {
      maxTokens: 1500,
      // Fresh ideas each time.
      temperature: 0.9,
      user: `MONTH: ${req.month}
TOPICS ALREADY DONE (don't suggest these or anything too close): ${req.avoid.length ? req.avoid.join("; ") : "(none)"}

Suggest ${req.count} carousel topics for ${req.month}.
Reply in exactly this format, one per line:
1. [topic, written like a web search] | [why it fits now, at most 12 words]`,
    }
  }
  if (req.task === "carousel-from-article") {
    const article = req.article.length > ARTICLE_PROMPT_CHARS ? `${req.article.slice(0, ARTICLE_PROMPT_CHARS)}…` : req.article
    return {
      maxTokens: 3200,
      // Lively headlines; "Write again" gives a new take.
      temperature: 0.7,
      user: `ARTICLE:
"""
${article}
"""

Make a ${CAROUSEL_BRAND_INFO[req.brand ?? "homes"].name} carousel from this article with ${req.cards} content cards (fewer only if the article doesn't have ${req.cards} items to show): the cover's Headline 1, Headline 2 and subtitle, every card's title, subtitle and description, and the Facebook caption.
Reply in exactly this format:
${CAROUSEL_DRAFT_FORMAT}`,
    }
  }
  if (req.task === "article-headline") {
    const article = req.article.length > ARTICLE_PROMPT_CHARS ? `${req.article.slice(0, ARTICLE_PROMPT_CHARS)}…` : req.article
    return {
      maxTokens: 2900,
      // Livelier, and "Write new ones" gives new takes.
      temperature: 0.7,
      user: `BRAND: ${req.brand}

ARTICLE:
"""
${article}
"""

${placeRule(req.brand)}Write the poster content for this article: ${Math.max(1, req.count)} headlines (the recommended one and ${Math.max(0, req.count - 1)} alternatives), 3 subtext options of different kinds, the best subtext (or NONE when the headline says it all), the report details, and the Facebook caption with its hashtags.
Reply in exactly this format:
${POSTER_COPY_FORMAT}`,
    }
  }
  if (req.task === "headline-highlight") {
    return {
      maxTokens: 400,
      temperature: 0.3,
      user: `Headline: ${clip(req.headline, 400)}

This headline goes on a Facebook news poster. A few of its words will be shown in a bright accent color to hook readers.
Pick those words: 2 to 5 consecutive words copied exactly from the headline. Choose the most eye-catching part, usually the event or place name, a striking number, or the key result (for "More than 600 cyclists take on Pampanga's dirt roads at Gravelton Clark 2026" that is "Gravelton Clark 2026").
Reply with those words only.`,
    }
  }
  const c = req.carousel
  if (req.task === "card-description") {
    const card = c.cards[req.cardIndex]
    return {
      maxTokens: 700,
      user: `Carousel: ${clip(c.title, 200)}${c.subtitle ? ` (${clip(c.subtitle, 200)})` : ""}
Card ${req.cardIndex + 1} of ${c.cards.length}
Card title: ${clip(card.title, 160) || "(none)"}
Card subtitle: ${clip(card.subtitle, 160) || "(none)"}
Current description: ${clip(card.description, 900) || "(empty)"}

Write the description for this card in ${req.minChars}-${req.maxChars} characters, one or two sentences.
Base it on the current description: keep its most useful facts and make it informative.
Do not repeat the card title, the card subtitle or the carousel title.`,
    }
  }
  if (req.task === "cover-subtitle") {
    return {
      maxTokens: 500,
      user: `${outline(c, 140)}

Write the cover subtitle: one line, at most ${req.maxChars} characters, Title Case, no period at the end.
It must tell readers exactly what the cards cover. When the cards are a list (places, units, tips, items), start with their number, like "6 Condos In Bonifacio Global City Under ₱10M".
If the current subtitle is accurate, keep its idea but make it shorter or clearer. Do not repeat the words of the title.`,
    }
  }
  const count = c.cards.length
  const number = count >= 2 ? ` Use the number in the cover title or subtitle if there is one, otherwise ${count}.` : ""
  return {
    maxTokens: 1000,
    // A little livelier than the other tasks; "Try again" gives a different take.
    temperature: 0.7,
    user: `${outline(c, 220)}
Current caption: ${clip(c.caption ?? "", 600) || "(none)"}

Write the caption for this Facebook post. You may reuse facts and ideas from the current caption, but follow this layout.
${captionLayout(number)}`,
  }
}

/**
 * The Homes.ph carousel caption's layout (Facebook shows the slides as a photo grid): a "Discover N …!"
 * hook, the items, a genuine question; 3 to 5 emojis. `number` says which number to use.
 */
function captionLayout(number: string) {
  return `Facebook shows the images as a photo grid inside the post, not as slides. Never mention swiping, slides, a carousel or cards.

Layout: exactly three short paragraphs separated by one blank line, 250 to 450 characters in total.
1. The hook: one sentence under 110 characters that ends with "!" and one or two emojis (Facebook hides everything after about 125 characters behind "See more"). Start with "Discover", then the number of items and what they are.${number} Example: "Discover 6 Filipino restaurants where history lives on! 🍽️✨"
2. One or two sentences, at most 260 characters: name every item from the cards in order, and add a detail for only one or two of them. The pattern "From A and B to C, D and E, ..." works well. End it with one emoji.
3. One short, genuine question about the topic that people will want to answer in the comments, such as "Which one would you visit first?", followed by one emoji. Never ask people to like, share, tag friends or type a word: Facebook shows that kind of engagement bait to fewer people.

Emojis: 3 to 5 in total, chosen to fit the topic (for example 🏡 homes, 🏙️ condos and city living, ☕ coffee, 🍽️ food, 🎄 Christmas, 🎁 gifts, 🌴 travel, ✨ highlights, 💬 for the question). Put them only at the end of a sentence; never start a paragraph with one, never use one in place of a word, and never use flag emojis.

Make it lively and inviting, like a popular Facebook page, while staying accurate and natural.

Example of the team's style:
Discover 6 Filipino restaurants where history lives on! 🍽️✨

From Toho Panciteria Antigua and The Aristocrat to Casa Roces, every meal carries a little taste of the past and memories worth sharing. 🍜

Which of these have you tried? 💬`
}

/**
 * Create New Carousel → from an article: a Homes.ph carousel (cover, cards, caption) written only
 * from the article, in the style of the team's carousels.
 */
function carouselDraftRules(brand: CarouselBrandId = "homes") {
  return `ROLE
You turn an article into a ${CAROUSEL_BRAND_INFO[brand].name} Facebook carousel: a cover and content cards, uploaded as photos in one Facebook post. ${CAROUSEL_BRAND_INFO[brand].about}

ACCURACY (most important)
- Use only facts, names, places, numbers, prices and dates found in the article. Never invent, guess, round up or exaggerate them.
- Every card is one item the article really talks about, with its real name spelled exactly as in the article.
- If the article has fewer items than the cards asked for, write only as many cards as the article supports. Never pad with made-up items.

COVER
- HEADLINE 1 (white) and HEADLINE 2 (gold) read together as one short, catchy phrase that makes people stop scrolling and fits the topic. Title Case. Each line at most 22 characters. Headline 2 ends with a period.
  The style of the team's covers: "Lights, Land," + "And Endless Views." · "What's On Your Plate" + "Depends On What's Growing." · "From Their Fields" + "To Our Tables." · "Older Than" + "Our Stories." · "Exceptional Stays," + "Right Here At Home."
- SUBTITLE: one line, Title Case, at most 60 characters, no period: the number of cards and exactly what they are, like "6 Philippine Lighthouses With Views Worth The Journey" or "6 Newest Michelin Key Hotels In The Philippines".

CARDS (in the article's order)
- TITLE: the item's name (a place, property, hotel, dish, event…), at most 28 characters. Shorten only by dropping words, never by inventing.
- SUBTITLE: where it is, or its key detail ("Binondo, Manila", "Batanes", "Opens December 2026"), at most 40 characters. Empty only when the article gives nothing.
- DESCRIPTION: 1 or 2 sentences, 90 to 150 characters, so it fills 2 to 3 lines on the card: the most interesting true fact about this item, written to hook the reader. Don't repeat the title or subtitle.

CAPTION (the Facebook caption under the photos)
${captionLayout("")}

STYLE
- Clear, natural English for ${CAROUSEL_BRAND_INFO[brand].readers}; ${CAROUSEL_BRAND_INFO[brand].tone}, never hypey or clickbait.
- No hashtags, em dashes or markdown. No emojis except in the caption.
- Avoid AI-sounding phrases such as "dive into", "unlock", "elevate", "discover the magic", "nestled", "a testament to", "whether you're", "look no further", "in today's".
Reply in the requested format only, with no other text.`
}

const CAROUSEL_DRAFT_FORMAT = `HEADLINE 1: [white line]
HEADLINE 2: [gold line, ends with a period]
SUBTITLE: [number + what the cards are]
CARDS:
1. [card title] | [card subtitle] | [card description]
2. [card title] | [card subtitle] | [card description]
…
CAPTION:
[hook paragraph]

[items paragraph]

[question paragraph]`

/** Who each carousel brand is, for the AI (the writing, research and topic ideas follow it). */
const CAROUSEL_BRAND_INFO: Record<CarouselBrandId, { name: string; about: string; area: string; readers: string; tone: string }> = {
  homes: {
    name: "Homes.ph",
    about: "Homes.ph is a Philippine real estate and lifestyle brand; its carousels show places, homes, hotels, food, travel spots, events or tips in the Philippines.",
    area: "the Philippines",
    readers: "Filipino readers",
    tone: "warm and inviting",
  },
  gensan: {
    name: "Homes.ph Gensan",
    about:
      "Homes.ph Gensan is the Homes.ph page for General Santos City (GenSan) and the SOCCSKSARGEN region (South Cotabato, Koronadal, Polomolok, T'boli, Lake Sebu, Sarangani, Sultan Kudarat); its carousels show homes, real estate, places, food, travel spots, events, business and growth in General Santos City and SOCCSKSARGEN.",
    area: "General Santos City and the SOCCSKSARGEN region of Mindanao (South Cotabato, Sarangani, Sultan Kudarat), Philippines",
    readers: "Filipino readers, especially in General Santos City and SOCCSKSARGEN",
    tone: "warm and inviting",
  },
  fhi: {
    name: "FHI Global Property",
    about: "FHI Global Property is an international real estate brand focused on Dubai and the UAE (elegant, premium, investment-focused); its carousels show properties, developments, communities, landmarks, lifestyle and investment tips in Dubai.",
    area: "Dubai and the UAE",
    readers: "property buyers and investors (many of them Filipino)",
    tone: "elegant, confident and premium",
  },
  pickleplay: {
    name: "PicklePlay",
    about: "PicklePlay.ph is the pickleball community brand in the Philippines (sporty, energetic, friendly); its carousels show courts, clubs, tournaments, players, gear and tips for pickleball in the Philippines.",
    area: "the Philippines (pickleball)",
    readers: "Filipino pickleball players and fans",
    tone: "sporty, upbeat and friendly",
  },
}

/** Create New Carousel → search a topic: research the places for the cards on the web, with sources. */
function researchRules(brand: CarouselBrandId = "homes", searched = false) {
  const info = CAROUSEL_BRAND_INFO[brand]
  const page = searched ? "search result" : "page you opened"
  return `ROLE
You research a topic for a ${info.name} Facebook carousel ${searched ? "from web search results" : "on the web"} and pick the places (or items) for its cards, with true facts from the sources ${searched ? "you are given" : "you open"}. ${info.about}

RULES
- ${
    searched
      ? "The web search is already done: use only the SEARCH RESULTS you are given (each has its URL and text). Prefer recent lists from reputable travel, food and news sites, official pages and guides."
      : "Search the web first, then open the best sources: recent lists from reputable travel, food and news sites, official pages and guides."
  } When the topic names a year, prefer sources from that year or the year before.
- Pick real places in ${info.area} that your sources name. Never invent names, facts, prices, awards or dates: every fact must come from a ${page}.
- Stay inside the area the topic names: for "Cebu City", only places in Cebu City; for a region, only places in that region. LOCATION is the place's real town or city as the source gives it.
- If the topic asks for a number per group (for example "top 2 resorts in Luzon, Visayas and Mindanao"), ${searched ? "use the results for" : "search"} each group separately, give exactly that number for each group, in the topic's group order, and start LOCATION with the group ("Visayas · Panglao, Bohol"). Check the group of every place: Luzon includes Metro Manila, Palawan, Mindoro, Batanes and Bicol; Visayas includes Boracay (Aklan), Cebu, Bohol, Iloilo, Negros, Siquijor, Leyte and Samar; Mindanao includes Davao, Samal, Siargao, Camiguin, Cagayan de Oro, Bukidnon and Zamboanga.
- No repeats: every item once, and none from the AVOID list (they were featured in earlier carousels).
- FACTS: 1 or 2 short sentences in your own words with the most interesting true details (what it's known for, a signature dish or feature, an award, the opening year).${
    searched ? " Only details the TEXT of the cited result states: when a result only lists names (a directory or booking site), prefer a result that describes the place; never add details the text doesn't give." : ""
  }
- SOURCE: the exact URL of the ${page} you took the facts from. Every item needs one: leave out an item you can't source.
Reply in the requested format only, with no markdown and no citation marks.`
}

const RESEARCH_FORMAT = `TOPIC: [the topic as a short title]
ITEMS:
1. [name] | [location] | [facts] | [source URL]
2. [name] | [location] | [facts] | [source URL]
…
SOURCES:
- [page title] | [URL]`

/** Poster Maker → Trending news: who each brand is, for the search. */
const TREND_BRANDS: Record<TrendBrand, string> = {
  pickleplay: "PicklePlay.ph: pickleball in the Philippines (players, tournaments, courts, clubs, community, business and equipment)",
  fhi: "FHI Global Property: Dubai and UAE real estate and business (Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Umm Al Quwain, Fujairah; property market, investment, launches, partner developers, awards, mega projects, economy)",
  homes: "Homes.ph CARAGA: real estate, housing, business and growth in the Caraga region of Mindanao, Philippines (Butuan, Agusan del Norte, Agusan del Sur, Surigao del Norte, Surigao del Sur, Siargao, Dinagat Islands)",
  gensan: "Homes.ph Gensan: real estate, housing, infrastructure, new businesses, events, tourism and growth in General Santos City (GenSan), Mindanao, Philippines: the city itself only (its barangays such as Dadiangas, Lagao, Labangal, Calumpang, Apopong), not Koronadal, Polomolok, Tupi, the rest of South Cotabato or Sarangani",
}

/** What comes first in each brand's trending news (the team's priorities). */
const TREND_FOCUS: Record<TrendBrand, string> = {
  pickleplay: "",
  fhi: "positive news of the PARTNER DEVELOPERS anywhere in the UAE (Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Umm Al Quwain, Fujairah, Dubai South, Studio City): new projects and launches, sold-out phases, handovers, awards and rankings, record sales, partnerships. Then other positive UAE property and business news.",
  homes:
    "the number-one real estate trend in the Caraga region: a new, proposed or just-launched project or property (subdivision, condominium, township, mall, hotel, business hub), above all one by a PARTNER DEVELOPER. Then other positive Caraga real estate, infrastructure and business news. Every story must be in Caraga, and its headline and facts must name the place (the city or province, e.g. Butuan City, Surigao del Norte, Siargao, Agusan del Sur).",
  gensan:
    "the number-one real estate trend in General Santos City: a new, proposed or just-launched project or property (subdivision, condominium, township, mall, hotel, business hub), above all one by a PARTNER DEVELOPER. Then other positive General Santos City real estate, infrastructure and business news. Every story must be in General Santos City itself (not Koronadal, Polomolok, South Cotabato or Sarangani), and its headline and facts must name it (General Santos City, GenSan, or a GenSan barangay).",
}

/** Who the brand is, for the trending-news prompt: a Homes.ph page's own place ("Homes.ph Cebu: … in Cebu City and Cebu province"). */
export function trendBrandLine(req: Extract<AiRequest, { task: "trend-search" }>): string {
  const place = requestPlace(req)
  if (!place) return TREND_BRANDS[req.brand]
  return `Homes.ph ${place.page}: real estate, housing, infrastructure, new businesses (restaurants, cafés, shops, hotels), tourism and growth in ${place.region}, Philippines`
}

/** What comes first: the brand's priority, or a Homes.ph page's (the Homes.ph CARAGA priority in its place). */
function trendFocusText(req: Extract<AiRequest, { task: "trend-search" }>): string {
  const place = requestPlace(req)
  if (!place) return TREND_FOCUS[req.brand]
  const where = place.page === "Main Page" ? "the Philippines" : place.region
  return `the number-one real estate trend in ${where}: a new, proposed or just-launched project or property (subdivision, condominium, township, mall, hotel, business hub), above all one by a PARTNER DEVELOPER. Then other positive real estate, infrastructure, business (new restaurants, cafés, shops), tourism and community news there. Every story must be in ${where}, and its headline and facts must name the place (the city or province, e.g. ${place.names.slice(0, 4).join(", ")}).`
}

/** The partner developers and the brand's top priority, for the trending-news prompt ("" for none, or when real estate is turned off in "Look for"). */
export function trendFocus(req: Extract<AiRequest, { task: "trend-search" }>): string {
  if (!wantsRealEstate(req.brand, requestLooks(req.brand, req.look))) return ""
  const lines: string[] = []
  if (req.developers?.length) lines.push(`PARTNER DEVELOPERS (their positive news comes first): ${req.developers.join("; ")}`)
  const focus = trendFocusText(req)
  if (focus) lines.push(`TOP PRIORITY: ${focus}`)
  return lines.map((l) => `${l}\n`).join("")
}

/**
 * Homes.ph posters always say where (the team's rule): the place goes in the headline, or in the
 * subtext when the headline can't fit it. "" for other brands and the nationwide Homes.ph Main Page.
 * `brand` is who the poster is for: "Homes.ph CARAGA", "Homes.ph Gensan", "Homes.ph BGC Taguig".
 */
export function placeRule(brand: string): string {
  const page = /^homes\.?ph\s+(.+)$/i.exec(brand.replace(/\s+/g, " ").trim())?.[1] ?? ""
  const other = page && !/caraga|gensan|general santos|main page/i.test(page) ? homesPlace(page) : null
  const where = /caraga/i.test(brand)
    ? "where in Caraga it is (the city or province the article gives, e.g. Butuan City, Surigao, Siargao, Agusan), or \"Caraga\""
    : /gensan|general santos/i.test(brand)
      ? "General Santos City (as the article gives it: General Santos City, GenSan, or the barangay)"
      : other
        ? `where in ${other.region} it is (as the article gives it, e.g. ${other.names.slice(0, 3).join(", ")}), or "${other.keyword}"`
        : ""
  return where
    ? `PLACE: name ${where} in the headline (or in the subtext when the headline can't fit it), and in the report details and caption. Use the article's place: never put a story in a place the article doesn't say.\n`
    : ""
}

/**
 * The keywords written in a trending-news prompt: all of a short list, or the first one and 23
 * others picked at random from a long one (Homes.ph Gensan has 99), so the prompt stays small.
 */
export function promptKeywords(keywords: string[], random: () => number = Math.random): string[] {
  if (keywords.length <= 24) return keywords
  const rest = keywords.slice(1)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return [keywords[0], ...rest.slice(0, 23)]
}

/** What a trending-news request looks for: kinds besides real estate ("wide"), and helpful information. */
export function lookScope(req: Extract<AiRequest, { task: "trend-search" }>): { wide: boolean; helpful: boolean } {
  const looks = requestLooks(req.brand, req.look)
  return { wide: extraLooks(looks).length > 0, helpful: !!looks?.includes("helpful") }
}

/** The "LOOK FOR" lines of a trending-news prompt ("" without kinds): each kind with what it covers. */
export function lookForText(req: Extract<AiRequest, { task: "trend-search" }>): string {
  const looks = requestLooks(req.brand, req.look)
  if (!looks || !extraLooks(looks).length) return ""
  const kinds = looks.filter((l) => BRAND_LOOKS[req.brand].includes(l))
  return `LOOK FOR (besides the keywords: positive or useful news in the brand's place):\n${kinds.map((l) => `- ${LOOK_KIND[l]}: ${lookAbout(l, req.brand)}`).join("\n")}\n`
}

/** The STORIES format, with each story's kind at the end when the request looks for kinds. */
function trendFormat(req: Extract<AiRequest, { task: "trend-search" }>): string {
  const looks = requestLooks(req.brand, req.look)
  if (!looks || !extraLooks(looks).length) return TREND_SEARCH_FORMAT
  const kinds = looks.map((l) => LOOK_KIND[l])
  const list = kinds.length > 1 ? `${kinds.slice(0, -1).join(", ")} or ${kinds[kinds.length - 1]}` : kinds[0]
  return `STORIES:
1. [the story's headline, with its place added if missing] | [publication date YYYY-MM-DD] | [the story's URL] | [${STORY_SUMMARY}] | [${STORY_HOOK}] | kind: [${list}] | ${STORY_TAGS}
2. …`
}

/**
 * The KEYWORDS line: the brand's topics. A keyword is what it means, not words a story must contain
 * (the team's rule, 1.47): a developer's name is that developer's news, "Events" is any event there.
 */
function keywordsLine(req: Extract<AiRequest, { task: "trend-search" }>): string {
  return `KEYWORDS (topics, read with common sense: a story fits a keyword when it's about what the keyword means, even without its words. A company or developer's name means that company's news; "Events" means any event or festival; "New Business Openings" means any new shop, restaurant, café, branch or business opening; "Infrastructure Projects" means roads, bridges, buildings and other public works): ${promptKeywords(req.keywords).join("; ")}`
}

/** Where the stories must be (1.47): the page's own place, and examples of places that aren't it. "" when not checked (FHI, the Main Page). */
export function areaLine(req: Extract<AiRequest, { task: "trend-search" }>): string {
  const area = trendArea(req.brand, requestPlace(req))
  if (!area) return ""
  if (req.brand === "pickleplay")
    return "PLACE (only here): pickleball in the Philippines, or Filipino players and teams anywhere. Leave out pickleball news from other countries (US tours and leagues, clubs and courts abroad) unless a Filipino player, a Philippine team or an event in the Philippines is in it.\n"
  const inside = area.inside.slice(0, 8).join(", ")
  const others = area.outside.filter((n) => n.length > 3 && !/^(NCR|CDO|BGC)$/.test(n)).slice(0, 400)
  const near = req.brand === "gensan" ? ["Koronadal", "Polomolok", "South Cotabato", "Sarangani", "Davao", "Cotabato City"] : req.brand === "homes" && !requestPlace(req) ? ["Davao", "Cagayan de Oro", "Bukidnon", "Misamis Oriental", "General Santos City"] : others.slice(0, 5)
  return `PLACE (only here): ${area.label} (${inside}). Leave out news from anywhere else (for example ${near.join(", ")}), even when it fits a keyword; a story must say it happens in ${area.label}.\n`
}

/**
 * Poster Maker → Trending news: the newest positive stories about the brand's keywords, with their
 * dates and sources. `wide`: the "Look for" kinds too (openings, festivals, tourism, city projects);
 * `helpful`: useful information counts, not only good news (a new rule, a schedule, an advisory).
 */
function trendSearchRules(searched = false, wide = false, helpful = false) {
  const tone = helpful
    ? "- Positive or useful news: good news (growth, openings, launches, festivals and events, wins, records, achievements) and informative news people can use (a new rule, a schedule, a program, an advisory, a price or market update), told in a helpful, neutral way. Leave out accidents, deaths, crime, disasters and their victims, scams, scandals, disputes, lawsuits, politics and elections, gossip, and anything that would upset or scare the audience."
    : `- Only positive or hopeful news: growth, openings, launches, wins, records, investments, partnerships, events, ${wide ? "festivals, " : ""}achievements. Leave out accidents, deaths, crime, scams, scandals, disputes, lawsuits, losses, closures, price drops, politics and anything negative.`
  const places = "the BRAND line says where: pickleball in the Philippines; Dubai and the UAE; the Caraga region; General Santos City itself; or the Homes.ph page's city or province"
  const about = wide
    ? `- The story must be in the brand's place (${places}) and about one of the KEYWORDS' topics, a PARTNER DEVELOPER or one of the LOOK FOR kinds (it doesn't have to use the keyword's words).`
    : `- The story must be about one of the KEYWORDS' topics (or a PARTNER DEVELOPER), in the brand's place (${places}); it doesn't have to use the keyword's words.`
  const order = wide
    ? "- Order the stories: the TOP PRIORITY ones first when there is one (a partner developer's news before the rest), then the most trending and engaging. Give a mix of the LOOK FOR kinds when the results allow (for example a real estate story, a new opening and an event), so the team has choices."
    : "- Order the stories: the TOP PRIORITY ones first (a partner developer's news before the rest), then the most trending."
  return `ROLE
You find the day's trending news for a brand's "Daily Trend News" poster on Facebook. ${searched ? "You are given news search results and pick" : "You search the web, open the stories and pick"} the ones people are talking about.

RULES
- ${
    searched
      ? "The web search is already done with the brand's KEYWORDS: choose only from the SEARCH RESULTS you are given (each has its URL, publication date and text). Never add a story that isn't in them."
      : "Search the web with the brand's KEYWORDS (several searches; add the month and year so you get the newest news)."
  }
- Only stories that happened, were announced or were published in the NEWS PUBLISHED window, or an upcoming event, opening or deadline announced in it (give its day as "event:"). Never older news, and never an old story shared again. ${searched ? "Use each result's PUBLISHED date; leave out a story without a date or that is older." : "Read the publication date on the page; leave out a story whose date you can't find or that is older."}
- The story must name its place (the city, municipality or province) and be in the PLACE given (when there is one): news from another city or province is left out, even when it fits a keyword. Leave out a story that is only "nationwide" unless it clearly affects the brand's place. When you can't confirm the date or the place, leave the story out.
${tone}
${about}
${order}
- Make each story hook the reader and inform: who, what, where (name the place) and the key numbers.
- Hottest first: stories covered by several outlets or pages, from official sources, with big numbers, firsts or many people involved. Rate each one "trending:" 1 to 100 (how much people are talking about it and how useful it is to this page's followers) and "post:" Post immediately (it happens today or tomorrow, or it's breaking), Post today (fresh news of the day) or Good this week (it stays useful for days).${wide ? "\n- Engaging: news people want to read, share or act on (something to visit, try, join, apply for or know about)." : ""}
- Different stories only, and none of the ALREADY POSTED headlines.
- Real stories from real news sites or official pages, each with its own real, working link; never invent links, titles, dates, names, numbers, quotes or facts.
- Each story is a news article or an official announcement: never a listings or for-sale page, a sponsored listing, an opinion piece, showbiz gossip, a directory, a category, archive or search page.
- Never election or partisan content (candidates, campaign events, party announcements), a personal post, a rumor page, a "share this" chain post, a competitor's listing promotion, or a link to a homepage instead of the story itself. Never an event that ended more than 2 days ago. When sources disagree on a fact and you can't tell which is right, leave the story out. When several sources cover a story, use the official or most established one's link.
- Give every story that qualifies, up to 8 (the team picks from them; the newest first when they're equally good). If nothing qualifies, reply with the line "STORIES:" only: never pad the list with weak, old or out-of-place stories.
- PUBLIC FACEBOOK POSTS (a result's TYPE says so, or a facebook.com page): use one only when an official or trustworthy Page posted it (the developer, the city or province, a government office, the club or organizer, a news outlet) and it announces positive news (an opening, launch, groundbreaking, event, win, award, turnover, partnership). Never a for-sale or for-rent listing, an ad for one unit, a personal post, a rumor or a share without facts. Official Pages are the city or provincial government and its offices (PIA, DTI, DOST, DPWH, the tourism office), developers, malls, businesses, event organizers, schools, local news and radio. Use the post's own URL. Its date is the PUBLISHED date or the date the post shows; when there's neither, leave the date empty. Write the headline from what the post says and name the Page in the summary ("Camella Caraga posted…"); never add facts.
Reply in the requested format only, with no markdown and no citation marks.`
}

/** Trending news with an engine that browses (Groq, Gemini): the search, with public Facebook posts too ("also"), instead ("only") or not. */
export function trendBrowseUser(req: Extract<AiRequest, { task: "trend-search" }>, posts: "also" | "only" | "none", pagePosts: TavilyResult[]): string {
  const end = new Date(`${req.day}T12:00:00Z`)
  const start = new Date(end.getTime() - (req.days - 1) * 86_400_000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
  const window = req.days === 1 ? `on ${iso(end)} (${longDate(end)}) only` : `from ${iso(start)} to ${iso(end)} (${longDate(start)} to ${longDate(end)})`
  const { wide } = lookScope(req)
  const monthYear = end.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  const alsoPosts = posts === "also" ? " Also search public Facebook posts of official Pages (site:facebook.com with the keywords)." : ""
  const task =
    posts === "only"
      ? `No news article was found for these days. Search PUBLIC FACEBOOK POSTS instead: search engines index some public posts of official Pages, so search with site:facebook.com and the keywords (and the partner developers), published ${window}. Find up to 5 different positive posts from official or trustworthy Pages.`
      : wide
        ? `Search the web for the newest news in the brand's place about these keywords and the LOOK FOR kinds, published ${window}. Run several searches: the keywords, and the kinds with the place and "${monthYear}" (for example festivals, events, grand openings).${alsoPosts} Find up to 8 different stories, a mix of kinds when you can.`
        : `Search the web for the newest positive news about these keywords, published ${window}. Run several searches with the keywords plus the month and year.${alsoPosts} Find up to 8 different stories.`
  const pages = pagePosts.length ? `\nPOSTS FROM THE BRAND'S FACEBOOK PAGES (read from the Pages; you may pick these too):\n${resultsBlock(pagePosts, 4000)}\n` : ""
  return `BRAND: ${trendBrandLine(req)}
NEWS PUBLISHED: ${window}
${keywordsLine(req)}
${areaLine(req)}${lookForText(req)}${trendFocus(req)}ALREADY POSTED (don't pick these stories again): ${req.avoid.length ? req.avoid.join("; ") : "(none)"}
${pages}
${task}
Reply in exactly this format:
${trendFormat(req)}`
}

/** Trending news → Write article: one story as ready-to-post content, its facts kept apart from the AI's reading. */
const NEWS_ARTICLE_RULES = `ROLE
You turn one news story into ready-to-post content for a brand's Facebook page.

RULES
- Use only the facts in THE STORY. Never invent quotes, numbers, names, dates, prices or events. When the story doesn't say something, leave it out.
- Original wording: never copy whole sentences or paragraphs from the story; names, titles and figures are fine.
- Quote someone only when the story quotes them, word for word, and say who said it.
- Positive, clear and factual. No clickbait, no emojis.
- Name the place and the date as the story gives them.
- CONFIRMED FACTS lists only facts the story states. AI NOTES lists your own reading (why it matters, what it may mean for the brand's followers), written as interpretation ("This may…", "For buyers, this could…").
- The image prompt describes a realistic photo or illustration that fits the story, with no real person's face, no logos and no text in the picture, and without inventing a building or product the story doesn't describe.
Reply in the requested format only, with no markdown.`

const NEWS_ARTICLE_FORMAT = `HEADLINE: [a Facebook headline, at most 12 words]
SHORT ARTICLE:
[60 to 100 words: what happened, where, when, the key number]
DETAILED ARTICLE:
[3 to 5 short paragraphs, 220 to 380 words in all]
CAPTION:
[2 or 3 short paragraphs for the Facebook post, no emojis]
HASHTAGS: [5 to 8 hashtags, the brand's own first]
CAROUSEL:
1. [cover title] | [cover line]
2. [card title] | [one or two sentences]
[5 to 7 numbered lines in all]
IMAGE PROMPT: [one paragraph]
CONFIRMED FACTS:
- [a fact the story states]
AI NOTES:
- [your interpretation, written as such]`

/** A story's summary and hook, and its labeled parts (each on the story's own line, after the hook). */
const STORY_SUMMARY = "2 to 4 sentences in your own words with the key facts: who, what, where, when, the key numbers, and why it matters to people there"
const STORY_HOOK = "why it fits this page's followers, at most 14 words"
const STORY_TAGS = "place: [city or municipality, province] | source: [who published it, e.g. PIA Caraga, City Government of Butuan (Facebook)] | event: [the event's or deadline's day YYYY-MM-DD, or empty] | trending: [1-100] | post: [Post immediately, Post today or Good this week]"

const TREND_SEARCH_FORMAT = `STORIES:
1. [the story's headline, with its place added if missing] | [publication date YYYY-MM-DD] | [the story's URL] | [${STORY_SUMMARY}] | [${STORY_HOOK}] | ${STORY_TAGS}
2. …`

/** Create New Carousel → suggested topics: timely, specific, not done before (in the brand's world). */
function topicRules(brand: CarouselBrandId = "homes") {
  const info = CAROUSEL_BRAND_INFO[brand]
  const seasons =
    brand === "fhi"
      ? "Dubai is hot from about May to September and pleasant from about October to April (events, expos, shopping festivals)."
      : "The Philippines has a wet season (about June to November) and a dry, hot season (about December to May): never write about autumn, fall foliage, snow or winter."
  return `ROLE
You suggest topics for ${info.name} Facebook carousels. ${info.about} Each carousel is a cover and 5 to 7 cards.
The team's past carousels: "Lights, Land, And Endless Views." (6 Philippine lighthouses with views worth the journey), "What's On Your Plate Depends On What's Growing." (6 restaurants that let the season decide the menu), "Older Than Our Stories." (6 giant trees in the Philippines to protect), "Exceptional Stays, Right Here At Home." (6 newest Michelin Key hotels in the Philippines).

RULES
- About ${info.area}, for ${info.name}'s followers.
- Timely for the month: its season and weather, holidays, school breaks, festivals and local events of that time of year. ${seasons}
- Specific: a clear list people can search the web for, with a place or theme.
- A mix of angles that fit the brand.
- Different from the topics already done, and from each other.
- Real and safe to post: no rumors, no politics, nothing negative.
Reply in the requested format only, with no other text.`
}

/**
 * Trending news / Search a topic when Tavily did the searching: the same rules and format, with the
 * search results in the message instead of browsing. Kept within Groq's free 8,000 tokens a minute.
 */
export function searchedPrompt(req: Extract<AiRequest, { task: "carousel-research" | "trend-search" }>, results: TavilyResult[], postsOnly = false) {
  if (req.task === "trend-search") {
    const end = new Date(`${req.day}T12:00:00Z`)
    const start = new Date(end.getTime() - (req.days - 1) * 86_400_000)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const window = req.days === 1 ? `on ${iso(end)} only` : `from ${iso(start)} to ${iso(end)}`
    const { wide, helpful } = lookScope(req)
    const pick = wide
      ? `Pick every ${postsOnly ? "post" : "story"} (up to 8, all different) from these SEARCH RESULTS published ${window}${postsOnly ? " (or without a date shown)" : ""}, ${helpful ? "positive or useful" : "positive"}, in the PLACE and about a keyword's topic, a partner developer or a LOOK FOR kind (a mix of kinds when you can).`
      : `Pick every ${postsOnly ? "post" : "story"} (up to 8, all different) from these SEARCH RESULTS published ${window}${postsOnly ? " (or without a date shown)" : ""}, positive, in the PLACE and about a keyword's topic.`
    return {
      system: trendSearchRules(true, wide, helpful),
      // Up to 8 stories, each with a fuller summary and its place, source, event day, trending rate and timing.
      maxTokens: 3400,
      temperature: 0.3,
      user: `BRAND: ${trendBrandLine(req)}
NEWS PUBLISHED: ${window}
${keywordsLine(req)}
${areaLine(req)}${lookForText(req)}${trendFocus(req)}ALREADY POSTED (don't pick these stories again): ${req.avoid.length ? req.avoid.join("; ") : "(none)"}

${
        postsOnly
          ? "SEARCH RESULTS (no news article was found for these days: these are public Facebook posts, found by a search engine or read from the brand's Pages):"
          : "SEARCH RESULTS (news found by a web search; some may be public Facebook posts):"
      }
${resultsBlock(results, 10_000)}

${pick} Use each one's own URL and PUBLISHED date (empty when it has none). If none fits, reply with the line "STORIES:" only.
Reply in exactly this format:
${trendFormat(req)}`,
    }
  }
  return {
    system: researchRules(req.brand, true),
    maxTokens: 2200,
    temperature: 0.2,
    user: `TOPIC: ${req.topic}
CARDS: ${req.cards}
AVOID (already featured in earlier ${CAROUSEL_BRAND_INFO[req.brand ?? "homes"].name} carousels; never pick these): ${req.avoid.length ? req.avoid.join("; ") : "(none)"}

SEARCH RESULTS (pages found by a web search for this topic):
${resultsBlock(results, 12_000)}

Pick ${req.cards} items for the cards from these SEARCH RESULTS (fewer only if they don't support ${req.cards}).
Reply in exactly this format:
${RESEARCH_FORMAT}`,
  }
}

/** Nothing back from Tavily in this long: it's down or stuck, and Groq's web search takes over. */
export const SEARCH_TIMEOUT_MS = 20_000
/** Once one search has answered, the others get this much longer (one slow search held up the rest). */
export const SLOW_SEARCH_GRACE_MS = 4_500

/**
 * Runs the searches together and waits for all of them, except that once one has answered, the
 * others get `SLOW_SEARCH_GRACE_MS` more: Tavily's searches usually take 1–5 seconds, but one
 * sometimes takes 8 or more. Returns every outcome and the searches stopped for being slow.
 */
export async function searchAll<Q, R>(
  queries: Q[],
  run: (q: Q, signal: AbortSignal) => Promise<R>,
  timeoutMs = SEARCH_TIMEOUT_MS,
  graceMs = SLOW_SEARCH_GRACE_MS,
): Promise<{ settled: PromiseSettledResult<R>[]; cutShort: Q[] }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let grace: ReturnType<typeof setTimeout> | undefined
  let graceOver = false
  const cut = new Set<number>()
  try {
    const settled = await Promise.allSettled(
      queries.map((q, i) =>
        run(q, controller.signal).then(
          (r) => {
            grace ??= setTimeout(() => {
              graceOver = true
              controller.abort()
            }, graceMs)
            return r
          },
          (e: unknown) => {
            if (graceOver) cut.add(i)
            throw e
          },
        ),
      ),
    )
    return { settled, cutShort: queries.filter((_, i) => cut.has(i)) }
  } finally {
    clearTimeout(timeout)
    clearTimeout(grace)
  }
}

/** A search engine that returns pages (Tavily, SerpApi, Perplexity): one search → results and what it cost. */
type PageSearch = (q: TavilyQuery, signal: AbortSignal) => Promise<{ results: TavilyResult[]; credits: number }>

/** An engine that can search now, with its key (the person's own, or the app's). */
type Engine = { id: SearchEngineId; key: string; model?: string; own: boolean }

/** Read before the engines search: posts from the Facebook Pages the person listed (their Meta token). */
interface TrendExtras {
  pagePosts: TavilyResult[]
  meta?: AiSearchInfo["meta"]
}

/** Tavily's searches, with its errors as SearchFailed (so another engine can take over). */
const tavilyPages =
  (key: string): PageSearch =>
  async (q, signal) => {
    try {
      return await tavilySearch(key, q, signal)
    } catch (e) {
      throw e instanceof TavilyError ? new SearchFailed(e.message, e.status, "tavily") : e
    }
  }

const ENGINE_NAMES: Record<SearchEngineId, string> = { tavily: "Tavily", serpapi: "Google (SerpApi)", perplexity: "Perplexity", groq: "Groq", gemini: "Gemini" }

/** The engine's searches (Tavily, SerpApi or Perplexity), through the 30-minute cache. */
function pageSearch(engine: Engine): PageSearch {
  const run: PageSearch = engine.id === "tavily" ? tavilyPages(engine.key) : engine.id === "serpapi" ? (q, signal) => serpSearch(engine.key, q, signal) : (q, signal) => perplexitySearch(engine.key, q, signal)
  return (q, signal) => cachedSearch(engine.id, engine.key, q, signal, run)
}

/** Runs the searches; throws the first failure when none worked. Returns the results lists and the credits used. */
async function runSearches(queries: TavilyQuery[], engine: SearchEngineId, search: PageSearch): Promise<{ lists: TavilyResult[][]; credits: number }> {
  const { settled, cutShort } = await searchAll(queries, (q, signal) => search(q, signal))
  const done = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []))
  if (!done.length) {
    const failed = settled.find((s): s is PromiseRejectedResult => s.status === "rejected")
    throw failed?.reason instanceof SearchFailed ? failed.reason : new SearchFailed(`The ${ENGINE_NAMES[engine]} search failed.`, 502, engine)
  }
  // A search stopped for being slow was still charged (Tavily: 2 credits for an advanced one).
  const credits = done.reduce((n, d) => n + d.credits, 0) + cutShort.reduce((n, q) => n + (engine === "tavily" && q.depth === "advanced" ? 2 : 1), 0)
  return { lists: done.map((d) => d.results), credits }
}

/** Every page once (the first copy kept), in the order given. */
function uniquePages(results: TavilyResult[]): TavilyResult[] {
  const key = (url: string) => url.replace(/^https?:\/\/(www\.|m\.|web\.)?/i, "").replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase()
  const seen = new Set<string>()
  return results.filter((r) => !seen.has(key(r.url)) && (seen.add(key(r.url)), true))
}

/** The AI's answer names at least one story with its link ("no links available" otherwise). */
export function hasLinkedStory(text: string, sources: AiSource[]): boolean {
  return parseTrendStories(text, sources).some((s) => !!s.url)
}

/**
 * Trending news → public Facebook posts: 2 searches limited to facebook.com (the main keyword and a
 * partner developer), with the engine best at it (Google through SerpApi first). Never fails the
 * trending search: a failure is noted in `info.posts`.
 */
async function findPosts(req: Extract<AiRequest, { task: "trend-search" }>, engine: Engine | null, info: AiSearchInfo, why: "always" | "no-news"): Promise<TavilyResult[]> {
  if (!engine) return []
  try {
    const { lists, credits } = await runSearches(trendPostQueries(req), engine.id, pageSearch(engine))
    const posts = postsInWindow(
      mergeResults(
        lists.map((l) => l.filter((r) => isFacebookUrl(r.url)).map((r) => ({ ...r, kind: "facebook" as const }))),
        12,
      ),
      req.day,
      req.days,
    )
    info.posts = { why, engine: engine.id, found: posts.length, credits }
    return posts
  } catch (e) {
    info.posts = { why, engine: engine.id, found: 0, error: e instanceof Error ? e.message : "The Facebook post search failed." }
    return []
  }
}

/** Who searches Facebook posts: SerpApi (Google's index has the most public posts), else the engine at work, else another page engine. */
function postsEngine(all: Engine[], current: Engine): Engine | null {
  return all.find((e) => e.id === "serpapi") ?? (PAGE_ENGINES.includes(current.id) ? current : null) ?? all.find((e) => PAGE_ENGINES.includes(e.id)) ?? null
}

/**
 * Trending news / Search a topic with Tavily, SerpApi or Perplexity: the engine searches (3 news
 * searches, or 1–3 topic searches), then the user's own AI or the built-in Groq picks and writes from
 * the results. Trending news also takes the Facebook Pages' posts and, when no news with a link was
 * found (or always, when asked), public Facebook posts.
 */
async function researchWithPages(
  req: Extract<AiRequest, { task: "carousel-research" | "trend-search" }>,
  own: AiProviderConfig | null | undefined,
  engine: Engine,
  all: Engine[] = [engine],
  extras: TrendExtras = { pagePosts: [] },
): Promise<{ text: string; model?: string; sources: AiSource[]; search: AiSearchInfo }> {
  const plan = req.task === "trend-search" ? trendSearchPlan(req) : { queries: researchQueries(req), keywords: 0 }
  const { lists, credits } = await runSearches(plan.queries, engine.id, pageSearch(engine))
  let results = mergeResults(lists, req.task === "trend-search" ? 26 : 14)
  const info: AiSearchInfo = { engine: engine.id, credits }
  if (req.task === "trend-search") {
    info.queries = plan.queries.map((q) => q.query)
    info.keywordsUsed = plan.keywords
    const searchable = new Set(searchableKeywords(req))
    const skipped = req.keywords.filter((k) => !searchable.has(k.replace(/\s+/g, " ").trim()))
    if (skipped.length) info.skipped = skipped.slice(0, 20)
  }
  if (req.task !== "trend-search") {
    if (!results.length) throw new AiError("The web search found nothing for this topic. Try a broader or clearer topic.", 404)
    const { text, model } = await writeAnswer(req.task, searchedPrompt(req, results), own)
    return { text, model, sources: resultSources(results), search: info }
  }
  results = inWindow(results, req.day, req.days)
  if (extras.meta) info.meta = extras.meta
  const mode = req.posts ?? "fallback"
  const posts = mode === "always" ? await findPosts(req, postsEngine(all, engine), info, "always") : []
  let pool = uniquePages([...results, ...posts, ...extras.pagePosts])
  let text = "STORIES:"
  let model: string | undefined
  if (pool.length) ({ text, model } = await writeAnswer(req.task, searchedPrompt(req, pool), own))
  // No news with a link: public Facebook posts are searched, and the AI picks from them.
  if (mode === "fallback" && !hasLinkedStory(text, resultSources(pool))) {
    const found = await findPosts(req, postsEngine(all, engine), info, "no-news")
    if (found.length) {
      const fallback = uniquePages([...found, ...extras.pagePosts])
      ;({ text, model } = await writeAnswer(req.task, searchedPrompt(req, fallback, true), own))
      pool = uniquePages([...pool, ...found])
    }
  }
  return { text, model, sources: resultSources(pool), search: info }
}

/** The pages Groq's web search found and opened (search results, then the opened pages). */
export function sourcesFrom(executed: unknown): AiSource[] {
  const found: AiSource[] = []
  const add = (title: string, url: string) => {
    const u = url.trim().replace(/[)\].,;]+$/, "")
    if (!/^https?:\/\//i.test(u) || /^https?:\/\/(www\.)?exa\.ai\//i.test(u) || found.some((s) => s.url === u)) return
    let host = ""
    try {
      host = new URL(u).hostname
    } catch {
      return
    }
    found.push({ title: title.replace(/\s+/g, " ").trim().slice(0, 200) || host, url: u.slice(0, 500) })
  }
  for (const tool of Array.isArray(executed) ? executed : []) {
    const t = (tool ?? {}) as { type?: string; output?: unknown; search_results?: { results?: { title?: string; url?: string }[] } }
    for (const r of t.search_results?.results ?? []) if (typeof r?.url === "string") add(r.title ?? "", r.url)
    if (t.type === "browser.open" && typeof t.output === "string") {
      // "L1: URL:\nL2: https://…\nL3: Page title"
      const lines = t.output.split(/\n/).map((l) => l.replace(/^L\d+:\s?/, "").trim())
      const at = lines.findIndex((l) => /^https?:\/\//i.test(l))
      if (at >= 0) add(lines.slice(at + 1).find((l) => l && !l.startsWith("#")) ?? "", lines[at])
    }
  }
  return found.slice(0, 40)
}

/**
 * Create New Carousel → search a topic, with Groq's built-in web search (the user's own Groq key
 * when one is saved, otherwise the app's). Returns the AI's notes and the pages it really used.
 */
async function researchWithGroq(
  req: Extract<AiRequest, { task: "carousel-research" | "trend-search" }>,
  key: string,
  ownKey: boolean,
  p: { system: string; user: string; maxTokens: number; temperature?: number } = prompt(req),
): Promise<{ text: string; sources: AiSource[] }> {
  const { system, user, maxTokens, temperature = 0.3 } = p
  const signal = AbortSignal.timeout(100_000)
  let lastError = "The search didn't answer."
  // Only these Groq models have the built-in browser search.
  const models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
  const limited: { at: number; wait: number }[] = []
  let waited = false
  let lastStatus = 502
  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    let res: Response
    let body: { choices?: { message?: { content?: string; executed_tools?: unknown } }[]; error?: { message?: string } }
    try {
      res = await fetch(api(), {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          tools: [{ type: "browser_search" }],
          tool_choice: "required",
          // Low effort keeps the browsing short (and the free limit happy).
          reasoning_effort: "low",
          temperature,
          max_completion_tokens: maxTokens,
        }),
        signal,
      })
      body = await res.json().catch(() => ({}))
    } catch {
      throw new AiError(signal.aborted ? "The web search took too long. Please try again, or try a shorter topic." : "Couldn't reach the AI service. Check your connection.", 504)
    }
    const message = body.error?.message ?? ""
    if (res.status === 401) throw new AiError("The Groq API key was rejected.", 502, ownKey)
    if (res.status === 429) {
      // Each model has its own limit: the other one may still search now, so it's tried before
      // any waiting; when both are limited, a short wait is waited out once.
      const wait = Number(res.headers.get("retry-after")) || 0
      limited.push({ at: i, wait })
      lastError = `Groq's free limit is used up for now (each web search uses a lot of it). Wait ${wait > 0 ? (wait > 90 ? `about ${Math.ceil(wait / 60)} minutes` : `about ${Math.ceil(wait)} seconds`) : "about a minute"}, then search again.`
      lastStatus = 429
      const next = soonestRetry(limited, i, models.length, waited, 25)
      if (next) {
        waited = true
        await new Promise((r) => setTimeout(r, next.wait * 1000 + 300))
        i = next.at - 1
      }
      continue
    }
    if (res.status === 413 || /too large|tokens per minute|context length/i.test(message)) {
      lastError = "The search results were too long for Groq's free limit. Try a narrower topic or fewer cards."
      continue
    }
    if (res.status === 404 || ((res.status === 400 || res.status === 403) && /model|tool|browser/i.test(message))) {
      lastError = message || `Web search isn't available on ${model}.`
      continue
    }
    if (!res.ok) throw new AiError(message || `The AI service answered ${res.status}.`, 502)
    const reply = body.choices?.[0]?.message
    const text = cleanAnswer(reply?.content ?? "", req.task)
    if (text) return { text, sources: sourcesFrom(reply?.executed_tools) }
    lastError = "The search came back empty. Please try again."
  }
  throw new AiError(lastError, lastStatus)
}

/** Removes wrappers models sometimes add ("Subtitle:", quotes, hashtags…). */
export function cleanAnswer(text: string, task: AiRequest["task"]): string {
  if (task === "news-article") {
    // Labeled sections with paragraphs: blank lines between paragraphs stay; markdown goes.
    return text
      .replace(/```[a-z]*/gi, "")
      .split(/\n/)
      .map((line) => line.replace(/\*\*|__|`/g, "").replace(/^\s*#+\s+/, "").replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
  if (task === "carousel-research" || task === "carousel-topics" || task === "trend-search") {
    // Labeled lines; the browser's citation marks (【2†L31-L35】) and markdown go.
    return text
      .replace(/【[^】]*】/g, "")
      .replace(/```[a-z]*/gi, "")
      .split(/\n/)
      .map((line) => line.replace(/\*\*|__|`/g, "").replace(/^\s*#+\s+/, "").replace(/[ \t]+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
  }
  if (task === "article-headline" || task === "poster-caption" || task === "carousel-from-article" || task === "pickleball-post" || task === "brand-post") {
    // Labeled lines (BRAND:, RECOMMENDED HEADLINE:, SUBTEXT:, CAPTION: …); the Poster Maker reads the fields.
    return text
      .replace(/```[a-z]*/gi, "")
      .split(/\n/)
      // Markdown headings ("## POSTER CATEGORY:") go; a line of hashtags ("#HomesPH #BGC") stays.
      .map((line) => line.replace(/\*\*|__|`/g, "").replace(/^\s*#+\s+/, "").trim())
      .filter(Boolean)
      .join("\n")
  }
  let t = text.trim()
  t = t.replace(/^(here(?:'s| is)[^:]*:|subtitle:|caption:|description:|hook(?: words)?:|(?:report )?details?:)\s*/i, "")
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
  t = t.replace(/[ \t]*[—–][ \t]*/g, ", ").replace(/,[ \t]*,/g, ",")
  // Plain hyphens ("one-bedroom") and "₱6.2M" instead of "₱6.2 M".
  t = t.replace(/[‐‑]/g, "-").replace(/(₱\s?\d[\d,.]*)\s+([MK])\b/g, "$1$2")
  if (task === "caption") {
    // Paragraphs separated by one blank line; a "swipe" line makes no sense on Facebook, where the photos show as a grid.
    t = t
      .split(/\n\s*\n/)
      .map((p) =>
        p
          .split(/(?<=[.!?])\s+/)
          .filter((sentence) => !/\bswip(e|es|ing)\b/i.test(sentence))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join("\n\n")
  } else {
    // Text that goes on the slides themselves: no hashtags or emojis (© ® ™ stay).
    t = t
      .replace(/#\w+/g, "")
      .replace(/(?![©®™])\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu, "")
      .replace(/\s+/g, " ")
  }
  if (task === "cover-subtitle" || task === "headline-highlight") t = t.replace(/[.。!]+$/, "")
  return t.trim()
}

/**
 * After a model's free limit was hit (429): once every model has been tried, the one that frees up
 * soonest (within `maxWait` seconds) is waited for and asked again, once. Null: try the next model
 * right away (or give up when every model is limited for longer).
 */
export function soonestRetry(limited: { at: number; wait: number }[], at: number, models: number, waited: boolean, maxWait: number): { at: number; wait: number } | null {
  if (waited || at < models - 1) return null
  const short = limited.filter((l) => l.wait > 0 && l.wait <= maxWait)
  return short.length ? short.reduce((a, b) => (b.wait < a.wait ? b : a)) : null
}

async function callGroq(model: string, system: string, user: string, maxTokens: number, temperature: number, signal: AbortSignal) {
  const res = await fetch(api(), {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY!.trim()}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_completion_tokens: maxTokens,
      // Short thinking keeps the cost and wait low; the answers are short.
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
    }),
    signal,
  })
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[]
    error?: { message?: string; code?: string }
  }
  return { res, body }
}

/**
 * Writes the answer with the user's own key when one is given (Poster Maker tasks),
 * otherwise with the app's Groq key.
 */
export async function generate(
  req: AiRequest,
  own?: AiProviderConfig | null,
  search?: SearchSetup | string | null,
): Promise<{ text: string; model?: string; sources?: AiSource[]; search?: AiSearchInfo }> {
  // (A plain string is the user's Tavily key, as before.)
  const setup: SearchSetup = typeof search === "string" ? { engine: "auto", tavily: search } : (search ?? { engine: "auto" })
  if (req.task === "carousel-research" || req.task === "trend-search") return researchTheWeb(req, own, setup)
  if (req.task === "pickleball-post") return writePickleballPost(req, own, setup)
  return writeAnswer(req.task, prompt(req), own)
}

/**
 * The person's web search choice (Settings → AI → Web search) and the saved keys that can search.
 * Each key is used for this one request only.
 */
export interface SearchSetup {
  engine: SearchEngineId | "auto"
  tavily?: string | null
  serpapi?: string | null
  perplexity?: string | null
  groq?: string | null
  gemini?: string | null
  /** Trending news → Facebook Pages: the person's Meta access token (not an engine). */
  meta?: string | null
}

/** The engines that can search now, the chosen one first (then Tavily, SerpApi, Perplexity, Groq, Gemini). */
export function searchEngines(setup: SearchSetup, own?: AiProviderConfig | null): Engine[] {
  const keys: Record<SearchEngineId, { key: string; model?: string; own: boolean } | null> = {
    tavily: setup.tavily?.trim() ? { key: setup.tavily.trim(), own: true } : process.env.TAVILY_API_KEY?.trim() ? { key: process.env.TAVILY_API_KEY.trim(), own: false } : null,
    serpapi: setup.serpapi?.trim() ? { key: setup.serpapi.trim(), own: true } : process.env.SERPAPI_API_KEY?.trim() ? { key: process.env.SERPAPI_API_KEY.trim(), own: false } : null,
    perplexity: setup.perplexity?.trim() ? { key: setup.perplexity.trim(), own: true } : own?.provider === "perplexity" ? { key: own.key, own: true } : null,
    groq: setup.groq?.trim()
      ? { key: setup.groq.trim(), own: true }
      : own?.provider === "groq"
        ? { key: own.key, own: true }
        : process.env.GROQ_API_KEY?.trim()
          ? { key: process.env.GROQ_API_KEY.trim(), own: false }
          : null,
    gemini: own?.provider === "gemini" ? { key: own.key, model: own.model, own: true } : setup.gemini?.trim() ? { key: setup.gemini.trim(), own: true } : null,
  }
  const order = setup.engine === "auto" ? [...SEARCH_ENGINE_ORDER] : [setup.engine, ...SEARCH_ENGINE_ORDER.filter((e) => e !== setup.engine)]
  return order.flatMap((id) => {
    const k = keys[id]
    return k ? [{ id, ...k }] : []
  })
}

/**
 * Trending news / Search a topic: the chosen engine searches; when it can't (bad key, no credits,
 * down), the next engine with a key does, and the answer says why (`search.note`).
 */
async function researchTheWeb(
  req: Extract<AiRequest, { task: "carousel-research" | "trend-search" }>,
  own: AiProviderConfig | null | undefined,
  setup: SearchSetup,
): Promise<{ text: string; model?: string; sources?: AiSource[]; search?: AiSearchInfo }> {
  const engines = searchEngines(setup, own)
  if (!engines.length) {
    throw new AiError(`Searching the web needs a web search key: Tavily, SerpApi (Google), Perplexity, Groq or Gemini. Add one in Settings → AI (Tavily and Groq are free).`, 503, !!own)
  }
  const extras = req.task === "trend-search" ? await pagesFor(req, setup) : { pagePosts: [] }
  const notes: string[] = []
  let status = 502
  const started = Date.now()
  for (const engine of engines) {
    try {
      const answer = await researchWith(req, own, engine, engines, extras)
      // The server's log (the desktop app's logs\server.log): what searched and how long it took; never keys or results.
      console.info(
        `[search] ${req.task} engine=${engine.id}${notes.length ? ` after=${notes.length}` : ""} sources=${answer.sources.length}${answer.search.posts ? ` posts=${answer.search.posts.found}(${answer.search.posts.why})` : ""}${answer.search.meta ? ` pages=${answer.search.meta.posts}` : ""} ${Date.now() - started}ms`,
      )
      return notes.length ? { ...answer, search: { ...answer.search, note: notes.join(" ") } } : answer
    } catch (e) {
      if (!(e instanceof SearchFailed)) throw e
      notes.push(e.message)
      status = e.status === 429 ? 429 : 502
    }
  }
  throw new AiError(notes.length > 1 ? `No web search worked: ${notes.join(" ")}` : notes[0], status, !!own)
}

/**
 * Trending news → Facebook Pages: the posts of the Pages the person listed, read with their Meta token
 * (whatever engine searches). Pages it may not read are listed in `meta.errors`.
 */
async function pagesFor(req: Extract<AiRequest, { task: "trend-search" }>, setup: SearchSetup): Promise<TrendExtras> {
  const token = setup.meta?.trim() || process.env.META_ACCESS_TOKEN?.trim() || ""
  if (!token || !req.pages?.length) return { pagePosts: [] }
  const { results, errors, read } = await readPagePosts(token, req.pages, req.day, req.days, AbortSignal.timeout(15_000))
  const pagePosts = results.filter((r) => !r.published || (r.published >= addDaysIso(req.day, -req.days) && r.published <= req.day))
  return { pagePosts, meta: { pages: read, posts: pagePosts.length, errors } }
}

const addDaysIso = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** Groq or Gemini browse the web and write the answer in one go. */
async function browse(
  req: Extract<AiRequest, { task: "carousel-research" | "trend-search" }>,
  engine: Engine,
  p: { system: string; user: string; maxTokens: number; temperature?: number },
): Promise<{ text: string; model?: string; sources: AiSource[] }> {
  if (engine.id === "groq") {
    try {
      return await researchWithGroq(req, engine.key, engine.own, p)
    } catch (e) {
      throw e instanceof AiError ? new SearchFailed(`Groq's web search: ${e.message}`, e.status, "groq") : e
    }
  }
  const found = await geminiResearch(engine.key, engine.model, p, AbortSignal.timeout(100_000))
  const text = cleanAnswer(found.text, req.task)
  if (!text) throw new SearchFailed("Gemini's search came back empty.", 502, "gemini")
  return { text, model: found.model, sources: found.sources }
}

/** One engine's search (its failures as SearchFailed; the writing AI's own errors pass through). */
async function researchWith(
  req: Extract<AiRequest, { task: "carousel-research" | "trend-search" }>,
  own: AiProviderConfig | null | undefined,
  engine: Engine,
  all: Engine[] = [engine],
  extras: TrendExtras = { pagePosts: [] },
): Promise<{ text: string; model?: string; sources: AiSource[]; search: AiSearchInfo }> {
  if (PAGE_ENGINES.includes(engine.id)) return researchWithPages(req, own, engine, all, extras)
  if (req.task !== "trend-search") return { ...(await browse(req, engine, prompt(req))), search: { engine: engine.id } }
  // Trending news with Groq or Gemini: Facebook Pages' posts go in the prompt; public posts are searched too when asked.
  const mode = req.posts ?? "fallback"
  const base = prompt(req)
  const info: AiSearchInfo = { engine: engine.id, ...(extras.meta ? { meta: extras.meta } : {}) }
  const answer = await browse(req, engine, { ...base, user: trendBrowseUser(req, mode === "always" ? "also" : "none", extras.pagePosts) })
  let { text, model, sources } = answer
  sources = [...sources, ...resultSources(extras.pagePosts)]
  if (mode === "always") info.posts = { why: "always", engine: engine.id, found: parseTrendStories(text, sources).filter((s) => isFacebookUrl(s.url)).length }
  if (mode === "fallback" && !hasLinkedStory(text, sources)) {
    const pages = postsEngine(all, engine)
    if (pages) {
      // A page engine is at hand (SerpApi, Tavily, Perplexity): it searches the posts and the writing AI picks.
      const found = await findPosts(req, pages, info, "no-news")
      if (found.length) {
        const pool = uniquePages([...found, ...extras.pagePosts])
        ;({ text, model } = await writeAnswer(req.task, searchedPrompt(req, pool, true), own))
        sources = [...sources, ...resultSources(found)]
      }
    } else {
      try {
        const again = await browse(req, engine, { ...base, user: trendBrowseUser(req, "only", extras.pagePosts) })
        text = again.text
        model = again.model ?? model
        sources = [...again.sources, ...resultSources(extras.pagePosts)]
        info.posts = { why: "no-news", engine: engine.id, found: parseTrendStories(text, sources).filter((s) => isFacebookUrl(s.url)).length }
      } catch (e) {
        info.posts = { why: "no-news", engine: engine.id, found: 0, error: e instanceof Error ? e.message : "The Facebook post search failed." }
      }
    }
  }
  return { text, model, sources, search: info }
}

/**
 * Advertisement → PicklePlay poster text. A typed topic is looked up on the web first (one Tavily
 * search, 1 credit, when there's a key) so the facts come from real pages; without one, the fact bank.
 */
/**
 * Advertisement → PicklePlay post. A typed topic is searched first (its pages are SOURCES for the AI);
 * otherwise, after a History / Trivia / Fun Fact is written, its topic is looked up so the post comes
 * with links to check the fact. Either way the pages come back as `sources` (1 Tavily credit).
 */
async function writePickleballPost(req: Extract<AiRequest, { task: "pickleball-post" }>, own: AiProviderConfig | null | undefined, setup: SearchSetup) {
  // The first engine that returns pages (Tavily, SerpApi or Perplexity, the chosen one first).
  const engine = searchEngines(setup, own).find((e) => PAGE_ENGINES.includes(e.id))
  const search = async (query: string, max: number): Promise<TavilyResult[]> => {
    if (!engine) return []
    const q: TavilyQuery = { query: query.slice(0, 300), topic: "general", depth: "basic", maxResults: max }
    try {
      const signal = AbortSignal.timeout(10_000)
      return (engine.id === "perplexity" ? await perplexitySearch(engine.key, q, signal) : engine.id === "serpapi" ? await serpSearch(engine.key, q, signal) : await tavilySearch(engine.key, q, signal)).results
    } catch {
      // No search (no credits, offline): the fact bank alone, without links.
      return []
    }
  }
  let results = req.topic && req.kind !== "comingsoon" && req.kind !== "nowopen" ? await search(`pickleball ${req.topic}`, 6) : []
  const answer = await writeAnswer(req.task, { ...prompt(req), user: pickleballPostPrompt(req, results.length ? resultsBlock(results, 5000) : "") }, own)
  // Court Owners, Coming Soon and Now Open have no pickleball fact to check.
  if (!results.length && req.kind !== "courtowner" && req.kind !== "comingsoon" && req.kind !== "nowopen") {
    const topic = /^\s*TOPIC:\s*(.+)$/im.exec(answer.text)?.[1]?.replace(/[*_]/g, "").trim()
    if (topic) results = await search(`pickleball ${topic}`, 5)
  }
  return results.length && engine ? { ...answer, sources: resultSources(results), search: { engine: engine.id, credits: 1 } } : answer
}

/** Writes one answer: with the user's own key when given (Poster Maker tasks), else the built-in Groq models in turn. */
async function writeAnswer(
  task: AiRequest["task"],
  p: { system: string; user: string; maxTokens: number; temperature?: number },
  own?: AiProviderConfig | null,
): Promise<{ text: string; model?: string }> {
  const { system, user, maxTokens, temperature = 0.5 } = p
  if (own) {
    let raw: { text: string; model: string }
    try {
      raw = await callProvider(own, { system, user, maxTokens, temperature, signal: AbortSignal.timeout(45_000) })
    } catch (e) {
      throw new AiError(e instanceof Error ? e.message : "The AI didn't answer.", e instanceof ProviderError ? e.status : 502, true)
    }
    const text = cleanAnswer(raw.text, task)
    if (!text) throw new AiError("The AI returned an empty answer. Please try again.", 502, true)
    return { text, model: raw.model }
  }
  if (!groqConfigured()) throw new AiError(`This app uses AI, but no AI is set up yet. ${SET_UP_AI}`, 503)
  const models = [process.env.GROQ_MODEL?.trim(), ...MODELS].filter((m, i, all): m is string => !!m && all.indexOf(m) === i)
  const signal = AbortSignal.timeout(55_000)
  let lastError = "The AI didn't answer."
  const blocked: string[] = []
  const limited: { at: number; wait: number }[] = []
  let waited = false
  let lastStatus = 502
  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    let call
    try {
      call = await callGroq(model, system, user, maxTokens, temperature, signal)
    } catch {
      throw new AiError(signal.aborted ? "The AI took too long. Please try again." : "Couldn't reach the AI service. Check your connection.", 504)
    }
    const { res, body } = call
    if (res.status === 401) throw new AiError("The Groq API key was rejected. Check GROQ_API_KEY.", 502)
    if (res.status === 429) {
      // Each Groq model has its own limit: the next one answers right away, so it's tried before
      // any waiting (searching again within a minute used to wait up to 20 seconds here).
      const wait = Number(res.headers.get("retry-after")) || 0
      limited.push({ at: i, wait })
      lastError = `The AI limit was reached (a web search uses a lot of it). Please try again in ${wait > 0 ? `about ${Math.ceil(wait / 60) > 1 ? `${Math.ceil(wait / 60)} minutes` : `${Math.ceil(wait)} seconds`}` : "a minute"}.`
      lastStatus = 429
      const next = soonestRetry(limited, i, models.length, waited, 20)
      if (next) {
        waited = true
        await new Promise((r) => setTimeout(r, next.wait * 1000 + 300))
        i = next.at - 1
      }
      continue
    }
    // Model removed, not available or blocked for this account: try the next one.
    if (res.status === 404 || ((res.status === 400 || res.status === 403) && /model/i.test(body.error?.message ?? ""))) {
      if (/blocked/i.test(body.error?.message ?? "")) blocked.push(model)
      lastError = body.error?.message ?? `Model ${model} isn't available.`
      continue
    }
    if (!res.ok) throw new AiError(body.error?.message || `The AI service answered ${res.status}.`, 502)
    const text = cleanAnswer(body.choices?.[0]?.message?.content ?? "", task)
    if (text) return { text }
    lastError = "The AI returned an empty answer. Please try again."
  }
  if (lastStatus === 429) throw new AiError(lastError, 429)
  if (blocked.length === models.length) {
    throw new AiError(
      `Your Groq account blocks these AI models (${blocked.join(", ")}). Turn one on at console.groq.com → Settings → Limits (openai/gpt-oss-120b is recommended), then try again.`,
      503,
    )
  }
  throw new AiError(lastError, 502)
}
