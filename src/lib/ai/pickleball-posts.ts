import type { AdContent, AdKind } from "@/lib/ads/render"

/**
 * Advertisement → PicklePlay: what the AI writes for a Pickleball History, Trivia or Fun Fact
 * poster. One answer fills all four templates of a kind; the lengths below are the templates'
 * own sample texts, so the text fits each design (longer text shrinks to stay in its box).
 */

export const PICKLEBALL_POST_RULES = `You write the text of Facebook posters for PicklePlay Philippines, a pickleball community and court-booking app: Pickleball History, Pickleball Trivia and Pickleball Fun Facts.

Rules:
- Facts only from the FACT BANK (and the SOURCES, when given). Don't add numbers, names, dates, places or quotes that aren't there: AI memory gets pickleball facts wrong. Explanations may only restate or simply explain those facts.
- Be creative with the words, never with the facts. Write like a witty sports social-media copywriter: punchy hooks, vivid verbs, a playful twist, light wordplay or a pickleball pun when it fits. Flavor and fun are welcome; new facts (numbers, names, dates, records, claims) are not.
- Fresh wording every time: don't reuse the examples' sentences; vary how lines start.
- Each poster is one fact, fun and friendly for Filipino players of every level, in plain English (no slang that needs explaining).
- Keep every line within its length: the poster's boxes are fixed. Count characters.
- No markdown, emojis or hashtags in the poster lines (hashtags only at the end of the Facebook caption).
- Reply in exactly the format asked, every line filled.`

/** Court Owners: ads inviting court owners to list their courts on PicklePlay. */
export const COURT_OWNER_RULES = `You write Facebook ads for PicklePlay Philippines, a pickleball community and court-booking app, inviting pickleball court owners in the Philippines to list their courts on PicklePlay.

Rules:
- Benefits only from PICKLEPLAY FOR COURT OWNERS: don't add features, speeds or details that aren't listed (like brackets, "instantly" or "one tap"). Never promise numbers, prices, discounts, "free", earnings or results that aren't there.
- Be creative and persuasive: a bold, confident headline with a punch, benefit-first lines, vivid verbs, a playful twist. One clear idea per ad. Fresh wording every time: don't reuse the example's sentences.
- Friendly, professional and plain English for Filipino court owners (no slang that needs explaining).
- Keep every line within its length: the poster's boxes are fixed. Count characters.
- No markdown, emojis or hashtags in the poster lines (hashtags only at the end of the Facebook caption).
- Reply in exactly the format asked, every line filled.`

/** Court Coming Soon / Court Now Open: a court's own announcement on PicklePlay. */
export const COURT_LAUNCH_RULES = `You write Facebook posters for PicklePlay Philippines (pickleplay.ph), a pickleball community and court-booking app, announcing a pickleball court that is coming soon to PicklePlay or is now open and bookable on PicklePlay.

Rules:
- The court's name, barangay, city and hours come only from COURT and the ARTICLE (when given): never invent them. Don't add prices, dates, number of courts, amenities, promos or awards that the ARTICLE doesn't say. About PicklePlay, use only PICKLEPLAY FOR PLAYERS.
- Be creative and hooky: short punchy lines, vivid verbs, excitement, a playful twist or a pickleball pun when it fits. Fresh wording every time: don't reuse the example's lines.
- Friendly, plain English for Filipino players of every level (no slang that needs explaining).
- Keep every line within its length: the poster's boxes are fixed. Count characters.
- No markdown, emojis or hashtags in the poster lines (hashtags only at the end of the Facebook caption).
- Reply in exactly the format asked, every line filled (the COURT lines may say "none").`

/** What players can do on PicklePlay (for Coming Soon / Now Open posts). */
export const PLAYER_FEATURES: readonly string[] = [
  "Find pickleball courts near you on PicklePlay.",
  "Book court time online at pickleplay.ph.",
  "See a court's schedule and open slots.",
  "Join open-play sessions.",
]

const COURT_LINES = `COURT NAME: [only when COURT has no name: the court's name from the ARTICLE, else "none"]
BARANGAY: [only when COURT has no barangay: from the ARTICLE, else "none"]
CITY: [only when COURT has no city: from the ARTICLE, else "none"]`

const COMINGSOON_FORMAT = `TOPIC: [2–5 words naming the post's angle, for our list of posts already made]
TAG: [2 words, up to 14 characters, like "Coming soon"]
KICKER: [2–3 words, up to 16 characters, like "You're invited"]
CHIP: [1–2 words, up to 12 characters, like "New court"]
HEADLINE: [2–4 words before the highlight, up to 14 characters, like "Is coming to"]
HIGHLIGHT: [what finishes the headline in the green block, up to 14 characters, usually "Pickleplay.ph"]
DETAIL: [one line about booking on PicklePlay or the opening, 28–44 characters]
CTA: [a short call to action, 20–34 characters]
${COURT_LINES}
FACEBOOK CAPTION: [3–4 short, exciting sentences: the court (its name and place) is coming soon to PicklePlay, what players can look forward to (only what the ARTICLE says), and to follow PicklePlay to book at pickleplay.ph when it opens; then 3–5 hashtags such as #PicklePlayPH #ComingSoon #PickleballPhilippines and one for the city on the last line]`

const COMINGSOON_GUIDE = `Write one PicklePlay "court coming soon" poster. HEADLINE + HIGHLIGHT read as one line (like "Is coming to" + "Pickleplay.ph", "Soon on" + "Pickleplay.ph", "Get ready," + "Pickleplay.ph"): the court is coming to the app.
Example (don't copy it):
TOPIC: Coming to PicklePlay
TAG: Coming soon
KICKER: You're invited
CHIP: New court
HEADLINE: Is coming to
HIGHLIGHT: Pickleplay.ph
DETAIL: Book your games online — launching soon!
CTA: Be the first to play. Stay tuned!`

const NOWOPEN_FORMAT = `TOPIC: [2–5 words naming the post's angle, for our list of posts already made]
TAG: [2 words, up to 16 characters, like "Grand opening"]
AUDIENCE: [3–4 words, up to 22 characters, like "New court now open"]
LOGO TAB: [1–2 words, up to 12 characters, like "New court"]
HEADLINE: [2 words, up to 12 characters, ending with "!", like "Now open!" (one template puts its last word in the green block)]
HIGHLIGHT: [2 words, up to 12 characters, ending with "!", like "Book today!"]
HEADLINE IN: [2–3 words ending with "in" or "at", up to 12 characters, like "Now open in"]
SPOTLIGHT: [the court's city or area in 1 word, up to 10 characters, from COURT or the ARTICLE]
PERK: [what booking on PicklePlay gives players, 24–36 characters, like "Book your slot in just a few taps"]
CTA: [a call to action, 30–44 characters, like "Grab your squad and book your first game!"]
HOURS: [only when COURT has no hours: from the ARTICLE, like "Open daily · 6:00 AM – 10:00 PM", else "none"]
${COURT_LINES}
FACEBOOK CAPTION: [3–4 short, exciting sentences: the court (its name and place) is now open on PicklePlay, what players get (only what the ARTICLE says), and to book a game at pickleplay.ph; then 3–5 hashtags such as #PicklePlayPH #NowOpen #PickleballPhilippines and one for the city on the last line]`

const NOWOPEN_GUIDE = `Write one PicklePlay "court now open" poster: the court is open and bookable on PicklePlay.
Example (don't copy it):
TOPIC: Grand opening, book now
TAG: Grand opening
AUDIENCE: New court now open
LOGO TAB: New court
HEADLINE: Now open!
HIGHLIGHT: Book today!
HEADLINE IN: Now open in
SPOTLIGHT: Mandaue
PERK: Book your slot in just a few taps
CTA: Grab your squad and book your first game!`

/** What PicklePlay does for court owners (the templates' own copy and the app's court-owner screens). */
export const COURT_OWNER_FEATURES: readonly string[] = [
  "List your courts on PicklePlay so players near you can find them.",
  "Players book court time online, so you take court bookings online.",
  "Promote your open-play sessions and open-play schedule.",
  "Set your own court pricing.",
  "Manage your court schedule.",
  "See your bookings, revenue and transactions in one place.",
  "Host and manage tournaments.",
  "Invite managers to help run your courts.",
  "Set your venue's rules and policies.",
  "Check players in with the booking scanner.",
  "Court owners get verified on PicklePlay.",
  "Sign up at pickleplay.ph.",
]

const COURT_OWNER_FORMAT = `TOPIC: [2–5 words naming the ad's angle, for our list of ads already made]
HEADLINE: [1–3 words before the highlight, up to 12 characters]
HIGHLIGHT: [the punch that finishes the headline, 1–2 words, up to 10 characters, ending with ! when it fits]
DETAIL 1: [a benefit starting with a verb, 18–30 characters]
DETAIL 2: [another benefit starting with a verb, 18–30 characters]
DETAIL 3: [another benefit starting with a verb, 18–32 characters]
FEATURE 1: [2 words, up to 16 characters]
FEATURE 2: [2 words, up to 16 characters]
FEATURE 3: [2 words, up to 16 characters]
FACEBOOK CAPTION: [3–4 short, persuasive sentences for court owners: a scroll-stopping hook, the benefits, and a call to list their courts on PicklePlay at pickleplay.ph; then 3–5 hashtags such as #PicklePlayPH #CourtOwners #PickleballPhilippines on the last line]`

const COURT_OWNER_GUIDE = `Write one PicklePlay ad for court owners. HEADLINE + HIGHLIGHT read as one bold line, the HIGHLIGHT is the punch (like "Fill your" + "courts!", "Get booked" + "online!", "More players," + "more games!").
The three DETAILS are three different benefits; the three FEATURES say the same benefits in 2 words each.
Example (don't copy it):
TOPIC: Fill your courts
HEADLINE: Fill your
HIGHLIGHT: courts!
DETAIL 1: Reach more players near you
DETAIL 2: Take court bookings online
DETAIL 3: Promote your open-play schedule
FEATURE 1: More players
FEATURE 2: Online bookings
FEATURE 3: Open-play promos`

/**
 * Checked pickleball facts (USA Pickleball's official history and rulebook, SFIA reports). The AI
 * writes from these instead of from memory, which invents dates, places and champions.
 */
export const PICKLEBALL_FACTS: readonly string[] = [
  "1965: Pickleball was invented in the summer of 1965 on Bainbridge Island, Washington (near Seattle), by Joel Pritchard, Bill Bell and Barney McCallum, to cure their families' summer boredom.",
  "1965: The first game used ping-pong paddles and a perforated plastic ball on an old badminton court; they lowered the net from badminton height to 36 inches when they found the ball bounced well on asphalt.",
  "1965: Joan Pritchard (Joel's wife) said the game's mix of borrowed gear reminded her of the \"pickle boat\" in crew rowing, a boat crewed with leftover oarsmen; that is where the name came from.",
  "Name story: A family dog named Pickles is often linked to the name, but the Pritchards said the dog came after the game was named (the pickle-boat story).",
  "1965: Barney McCallum shaped the first real pickleball paddles from plywood in his garage.",
  "1967: The first permanent pickleball court was built in the backyard of Bob O'Brian, Joel Pritchard's neighbor and friend, on Bainbridge Island.",
  "1972: A corporation (Pickle-Ball, Inc.) was formed to protect the creation of the new sport.",
  "1975: The National Observer published an article about pickleball, followed in 1976 by an article in Tennis magazine.",
  "1976: The first known pickleball tournament was held in the spring of 1976 at the South Center Athletic Club in Tukwila, Washington; many players were college tennis players.",
  "1984: The USAPA (United States Amateur Pickleball Association) was organized to grow the sport nationally, and the first official pickleball rulebook was published in March 1984.",
  "1984: Arlen Paranto, an industrial engineer at Boeing, made the first composite pickleball paddle, using the fiberglass and honeycomb panels airplanes use.",
  "1990: Pickleball was being played in all 50 US states.",
  "1999: The first pickleball website, Pickleball Stuff, went online.",
  "2005: The USA Pickleball Association was reorganized as a non-profit organization.",
  "2009: The first USAPA National Tournament was held in Buckeye, Arizona, in November 2009, with about 400 players.",
  "2016: The first US Open Pickleball Championships were held in Naples, Florida.",
  "2018: The PPA Tour (Professional Pickleball Association) was founded; Major League Pickleball, a team league, followed in 2021.",
  "2020: The USA Pickleball Association rebranded as USA Pickleball.",
  "2022: Pickleball was named the official state sport of Washington, where it was invented.",
  "Joel Pritchard, one of pickleball's inventors, later served as a US Congressman (1973–1985) and as Lieutenant Governor of Washington (1989–1997).",
  "Growth: The SFIA (Sports & Fitness Industry Association) named pickleball the fastest-growing sport in America three years in a row (2021, 2022 and 2023).",
  "Growth: About 13.6 million Americans played pickleball in 2023, according to the SFIA.",
  "Court: A pickleball court is 20 feet wide and 44 feet long, the same size as a doubles badminton court.",
  "Court: About four pickleball courts fit on one tennis court.",
  "Court: All court lines are 2 inches wide.",
  "Net: The net is 36 inches high at the sidelines and 34 inches high at the center.",
  "Kitchen: The non-volley zone, called the kitchen, reaches 7 feet from the net on each side; you can't volley (hit the ball in the air) while standing in it or touching its line.",
  "Kitchen: You may step into the kitchen any time to play a ball that has bounced; only volleys are not allowed there.",
  "Serve: The serve is hit underhand and diagonally, crosscourt, and must land past the kitchen line; a serve that lands on the kitchen line is a fault.",
  "Serve: Since 2021, the drop serve is allowed: the server drops the ball and hits it after it bounces.",
  "Serve: Since 2021, there are no lets on the serve: a serve that touches the net and lands in the right box stays in play.",
  "Two-bounce rule: The ball must bounce once on each side (after the serve and after the return) before anyone may volley.",
  "Scoring: Games are usually played to 11 points, and you must win by 2; in traditional scoring only the serving side can score.",
  "Scoring: In doubles the score is called with three numbers: the serving team's score, the receiving team's score and the server number (1 or 2); a game starts at 0-0-2.",
  "Scoring: Major League Pickleball uses rally scoring, where a point is scored on every rally.",
  "Ball: Outdoor balls usually have about 40 smaller holes, indoor balls about 26 bigger holes; smaller holes help outdoor balls cut through the wind.",
  "Ball: An official ball is 2.87 to 2.97 inches across and weighs 0.78 to 0.935 ounces.",
  "Ball: An official ball must bounce 30 to 34 inches high when dropped from 78 inches onto a granite surface.",
  "Paddle: A paddle's length plus width can't be more than 24 inches, and the length can't be more than 17 inches; there is no weight limit.",
  "Paddle: The first paddles were wooden (plywood); today most are made of graphite, carbon fiber or fiberglass.",
  "Shots: A dink is a soft shot that drops into the opponent's kitchen.",
  "Shots: The Erne is a volley hit from beside the kitchen, outside the court, by jumping or stepping around it; it is named after player Erne Perry.",
  "Shots: An around-the-post (ATP) shot is legal: the ball doesn't have to go over the net if it goes around the net post and lands in.",
  "Players: Pickleball can be played as singles or doubles; doubles is the most popular way to play.",
  "Players: Anna Leigh Waters turned pro at 12 years old (in 2019) and became the world's No. 1 women's player as a teenager.",
  "Players: Ben Johns is one of the most successful pro players, with many singles, doubles and mixed doubles titles.",
]

/**
 * The bank in a new order each time (so the AI doesn't always pick the same facts). Every kind
 * uses every fact: a fun fact's star may be a word, a history post's focus a name.
 */
export function shuffledFacts(random: () => number = Math.random): string[] {
  const out = [...PICKLEBALL_FACTS]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const FUNFACT_FORMAT = `TOPIC: [2–5 words naming the fact, for our list of posted facts]
LEAD: [the catchy words before the big one, 18–28 characters]
BIG: [the star of the fact, shown huge: a number (1–4 characters; may use ~ or %) or one short word (up to 7 letters)]
WORD: [one punchy word after it, 3–8 characters, ending with !]
BODY: [2 short, lively sentences explaining the fact, 90–115 characters]
LEFT LABEL: [one word, up to 8 characters]
LEFT VALUE: [a number or a short word, up to 5 characters]
LEFT TEXT: [2 words, up to 14 characters]
RIGHT LABEL: [one word, up to 8 characters]
RIGHT VALUE: [a number or a short word, up to 5 characters]
RIGHT TEXT: [2 words, up to 14 characters]
NOTE: [one witty takeaway sentence, 40–58 characters]
CAPTION: [a short, catchy label of the fact with " · ", up to 24 characters]
FACEBOOK CAPTION: [2–3 short, lively sentences: a scroll-stopping hook, the fact, and a question that invites comments; then 3–5 hashtags such as #PicklePlayPH #Pickleball #PickleballPhilippines on the last line]`

const FUNFACT_GUIDE = `Write one PICKLEBALL FUN FACT built around one star, shown huge: a number (a count, size, distance, speed, age, year or percent) or one short word (a name, a nickname, a shot, a part of the court). Vary it: not always a number.
LEAD + BIG + WORD read as one catchy line, like "An outdoor ball proudly has" + "40" + "holes!" or "The softest weapon on court?" + "DINK" + "shot!".
LEFT and RIGHT are a two-sided comparison about the same fact (RIGHT is the side the fact is about), like Indoor ~26 bigger holes vs Outdoor ~40 smaller holes, or Smash Fast hard and loud vs Dink Soft slow and sneaky.
Example with a number:
TOPIC: Outdoor ball holes
LEAD: An outdoor ball proudly has
BIG: 40
WORD: holes!
BODY: Indoor balls usually have about 26 bigger holes. Outdoor balls use around 40 smaller ones to slice through the wind.
LEFT LABEL: Indoor
LEFT VALUE: ~26
LEFT TEXT: bigger holes
RIGHT LABEL: Outdoor
RIGHT VALUE: ~40
RIGHT TEXT: smaller holes
NOTE: Smaller holes, less wind drama. Ball science!
CAPTION: Outdoor ball · 40 holes
Example with a word:
TOPIC: The dink shot
LEAD: The softest weapon on court?
BIG: DINK
WORD: shot!
BODY: A dink is a soft shot that drops into the opponent's kitchen. Small swing, big headache for the other side.
LEFT LABEL: Smash
LEFT VALUE: Fast
LEFT TEXT: hard and loud
RIGHT LABEL: Dink
RIGHT VALUE: Soft
RIGHT TEXT: slow and sneaky
NOTE: Sometimes the quietest shot wins the point.
CAPTION: Dink · soft but sneaky`

const HISTORY_FORMAT = `TOPIC: [2–5 words naming the story, for our list of posted facts]
FOCUS: [the story's key word, shown huge on the poster: a year, a name, a thing or a part of the game; 1–10 characters, 1 word if you can]
HEADLINE: [one catchy, natural sentence that uses the FOCUS word once, 30–42 characters]
SHORT HEADLINE: [the same idea without the FOCUS word, 20–34 characters, ending with a period]
BODY: [where, who and how, 2 short sentences, 110–140 characters (count them)]
START TITLE: [2–3 words naming what BODY tells, up to 18 characters]
STORY TAG: [a short label for the story with " · ", like a year and place or a name and what it is, up to 28 characters]
SIDE TITLE: [a short question or title for one more related fact, up to 20 characters]
SIDE BODY: [that related fact, also from the FACT BANK, 1–2 sentences, 100–125 characters]
BADGE: [2 words about the FOCUS, up to 11 characters]
FACEBOOK CAPTION: [2–3 short, lively sentences: a scroll-stopping hook, the story, and a question that invites comments; then 3–5 hashtags such as #PicklePlayPH #Pickleball #PickleballHistory on the last line]`

const HISTORY_GUIDE = `Write one PICKLEBALL HISTORY post: the story behind a moment, a person, a name, a thing or a part of the game (how it was invented, where the name came from, the first paddles, the first court, the first tournament, a shot and who it is named after, the rules, the sport's growth…).
The FOCUS is the post's key word, shown huge: a year only when the story is about a moment; otherwise a name ("Erne"), a thing ("Plywood") or a part of the game ("Kitchen"). Vary it: not always a year.
Example with a year:
TOPIC: Pickleball invented
FOCUS: 1965
HEADLINE: Pickleball was born in a backyard in 1965.
SHORT HEADLINE: Pickleball was born in a backyard.
BODY: On Bainbridge Island, Washington, three dads, Joel Pritchard, Bill Bell and Barney McCallum, invented the game to cure their kids' summer boredom.
START TITLE: Where it started
STORY TAG: 1965 · Bainbridge Island, WA
SIDE TITLE: Why "pickleball"?
SIDE BODY: Joan Pritchard said the mix of borrowed gear reminded her of the "pickle boat" in rowing, a crew of leftover oarsmen.
BADGE: Est. 1965
Example with a name:
TOPIC: Erne shot name
FOCUS: Erne
HEADLINE: A famous shot is named after Erne.
SHORT HEADLINE: A shot named after a player.
BODY: The Erne is a volley hit from beside the kitchen, outside the court, by jumping or stepping around it. It carries the name of player Erne Perry.
START TITLE: The shot
STORY TAG: Erne · Named after a player
SIDE TITLE: Another famous shot?
SIDE BODY: The dink is a soft shot that drops into the opponent's kitchen, and it is one of the most used shots in the game.
BADGE: The Erne`

const TRIVIA_FORMAT = `TOPIC: [2–5 words naming the question, for our list of posted facts]
QUESTION: [the question, playful and clear, 28–40 characters, with its 1 or 2 key words in [square brackets]]
LONG QUESTION: [the same question with a little context first, 60–88 characters, with 1 or 2 key phrases (1–3 words each) in [square brackets]]
SHORT QUESTION: [the same question in 3–4 words, up to 22 characters, with 1 key word in [square brackets]]
ANSWER: [the answer, 1 word or 2 short words, up to 10 characters, ending with !]
EXPLANATION: [why, 2 short sentences, 80–100 characters]
A: [choice, up to 14 characters]
B: [choice, up to 14 characters]
C: [choice, up to 14 characters]
D: [choice, up to 14 characters]
CORRECT: [the letter of the right choice]
FACEBOOK CAPTION: [2–3 short, lively sentences: a scroll-stopping hook, the question, and an invitation to tag a friend; then 3–5 hashtags such as #PicklePlayPH #Pickleball #PickleballTrivia on the last line]`

const TRIVIA_GUIDE = `Write one PICKLEBALL TRIVIA question with one short, certain answer.
The four choices: one is the answer (without the !), the other three believable but wrong. Put the right one at a random letter (not always C).
Example:
TOPIC: First paddles material
QUESTION: What were the first [paddles] made of?
LONG QUESTION: Before graphite and carbon fiber, what were the [very first] [pickleball paddles] made of?
SHORT QUESTION: First [paddles] made of?
ANSWER: Wood!
EXPLANATION: Barney McCallum shaped the first real paddles from plywood. Today, most are graphite or carbon fiber.
A: Aluminum
B: Plastic
C: Wood
D: Graphite
CORRECT: C`

const GUIDES: Record<AdKind, { guide: string; format: string }> = {
  courtowner: { guide: COURT_OWNER_GUIDE, format: COURT_OWNER_FORMAT },
  comingsoon: { guide: COMINGSOON_GUIDE, format: COMINGSOON_FORMAT },
  nowopen: { guide: NOWOPEN_GUIDE, format: NOWOPEN_FORMAT },
  funfact: { guide: FUNFACT_GUIDE, format: FUNFACT_FORMAT },
  history: { guide: HISTORY_GUIDE, format: HISTORY_FORMAT },
  trivia: { guide: TRIVIA_GUIDE, format: TRIVIA_FORMAT },
}

/** The topic's own words ("the kitchen" → kitchen), for finding its facts. */
const topicWords = (topic: string) =>
  topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !["the", "and", "for", "with", "about", "pickleball", "pickle", "ball", "what", "who", "how", "why", "its", "first"].includes(w))
    // "paddles" finds "paddle", "rules" finds "rule".
    .map((w) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w))

/** The bank's facts about the topic (by its words), the ones whose label names it first ("Kitchen: …"). */
export function factsAbout(topic: string, facts: readonly string[]): string[] {
  const words = topicWords(topic)
  if (!words.length) return []
  const score = (f: string) => {
    const label = f.slice(0, Math.max(0, f.indexOf(":"))).toLowerCase()
    const text = f.toLowerCase()
    return words.reduce((n, w) => n + (label.includes(w) ? 3 : text.includes(w) ? 1 : 0), 0)
  }
  return facts
    .map((f) => ({ f, n: score(f) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n)
    .map((x) => x.f)
}

/**
 * The user message for one poster. `sources`: web search results about the topic (when the
 * user typed one), the only facts besides the bank. A typed topic's facts come first, in their
 * own list, so the post is about it.
 */
export function pickleballPostPrompt(
  req: { kind: AdKind; topic: string; avoid: string[]; article?: string; court?: { name: string; barangay: string; city: string; hours: string } },
  sources = "",
  random: () => number = Math.random,
): string {
  const g = GUIDES[req.kind]
  if (req.kind === "comingsoon" || req.kind === "nowopen") {
    const c = req.court ?? { name: "", barangay: "", city: "", hours: "" }
    const v = (t: string) => t.trim() || "(not given)"
    return `${g.guide}

COURT (as typed; keep exactly):
- Name: ${v(c.name)}
- Barangay: ${v(c.barangay)}
- City: ${v(c.city)}${req.kind === "nowopen" ? `\n- Hours: ${v(c.hours)}` : ""}

PICKLEPLAY FOR PLAYERS:
${PLAYER_FEATURES.map((f) => `- ${f}`).join("\n")}
${req.article ? `\nARTICLE (about this court; the only other facts):\n"""\n${req.article.slice(0, 6000)}\n"""\n` : ""}${req.topic ? `\nANGLE: ${req.topic}\n` : ""}
POSTS ALREADY MADE (use different wording): ${req.avoid.length ? req.avoid.join("; ") : "(none)"}

Reply in exactly this format:
${g.format}`
  }
  if (req.kind === "courtowner") {
    return `${g.guide}

PICKLEPLAY FOR COURT OWNERS:
${COURT_OWNER_FEATURES.map((f) => `- ${f}`).join("\n")}

${req.topic ? `ANGLE: ${req.topic} (build the ad around this, using only the benefits above).` : "ANGLE: pick a fresh angle from the benefits above."}
ADS ALREADY MADE (use a different angle and wording): ${req.avoid.length ? req.avoid.join("; ") : "(none)"}

Reply in exactly this format:
${g.format}`
  }
  const facts = shuffledFacts(random)
  const onTopic = req.topic ? factsAbout(req.topic, facts) : []
  const rest = facts.filter((f) => !onTopic.includes(f))
  const about = req.topic
    ? `THE POST MUST BE ABOUT: ${req.topic}. Use the FACTS ABOUT THE TOPIC${sources ? " and the SOURCES" : ""}${onTopic.length ? "" : " (or the closest fact in the FACT BANK)"}; never a fact about something else.`
    : "ABOUT: pick the first fact in the FACT BANK that suits this poster and isn't already posted."
  return `${g.guide}

${about}
${onTopic.length ? `\nFACTS ABOUT THE TOPIC:\n${onTopic.map((f) => `- ${f}`).join("\n")}\n` : ""}${sources ? `\nSOURCES (web search results for the topic):\n${sources}\n` : ""}
FACT BANK${onTopic.length ? " (other facts, for the second card)" : ""}:
${rest.map((f) => `- ${f}`).join("\n")}

ALREADY POSTED (don't repeat these facts): ${req.avoid.length ? req.avoid.join("; ") : "(none)"}

Reply in exactly this format:
${g.format}`
}

// ---------------------------------------------------------------------------------------------
// Reading the answer
// ---------------------------------------------------------------------------------------------

const LABELS = [
  "TOPIC",
  "LEAD",
  "BIG",
  "WORD",
  "BODY",
  "LEFT LABEL",
  "LEFT VALUE",
  "LEFT TEXT",
  "RIGHT LABEL",
  "RIGHT VALUE",
  "RIGHT TEXT",
  "NOTE",
  "CAPTION",
  "FOCUS",
  "YEAR",
  "HEADLINE",
  "SHORT HEADLINE",
  "START TITLE",
  "STORY TAG",
  "PLACE",
  "SIDE TITLE",
  "SIDE BODY",
  "BADGE",
  "QUESTION",
  "LONG QUESTION",
  "SHORT QUESTION",
  "ANSWER",
  "EXPLANATION",
  "A",
  "B",
  "C",
  "D",
  "CORRECT",
  "HIGHLIGHT",
  "DETAIL 1",
  "DETAIL 2",
  "DETAIL 3",
  "FEATURE 1",
  "FEATURE 2",
  "FEATURE 3",
  "TAG",
  "KICKER",
  "CHIP",
  "DETAIL",
  "CTA",
  "AUDIENCE",
  "LOGO TAB",
  "HEADLINE IN",
  "SPOTLIGHT",
  "PERK",
  "HOURS",
  "COURT NAME",
  "BARANGAY",
  "CITY",
  "FACEBOOK CAPTION",
] as const
type Label = (typeof LABELS)[number]

/** "LABEL: value" lines; the Facebook caption keeps its own lines (hashtags on the last). */
export function readFields(text: string): Partial<Record<Label, string>> {
  const out: Partial<Record<Label, string>> = {}
  // Longest labels first ("SHORT HEADLINE" before "HEADLINE", "LEFT LABEL" before "A").
  const sorted = [...LABELS].sort((a, b) => b.length - a.length)
  let current: Label | null = null
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/^[\s>*•-]+/, "").replace(/\*\*/g, "")
    const label = sorted.find((l) => new RegExp(`^${l.replace(/ /g, "\\s+")}\\s*[:：]`, "i").test(line))
    if (label) {
      current = label
      out[label] = line.slice(line.indexOf(line.match(/[:：]/)![0]) + 1).trim()
      continue
    }
    // Only the Facebook caption runs over several lines.
    if (current === "FACEBOOK CAPTION" && line.trim()) out[current] = `${out[current] ?? ""}\n${line.trim()}`.trim()
  }
  return out
}

/** Cleans a poster line: one line, no wrapping quotes or trailing spaces. */
const clean = (v: string | undefined, max: number) => {
  let t = (v ?? "").replace(/\s+/g, " ").trim()
  // A whole line in quotes loses them ("Why “pickleball”?" keeps its own).
  const wrapped = /^["“'](.+)["”']$/.exec(t)
  if (wrapped && !/["“”]/.test(wrapped[1])) t = wrapped[1].trim()
  if (t.length > max) {
    // Too long: end at the last whole sentence that fits (the poster shrinks long text anyway),
    // else at a word.
    const sentences = t.slice(0, max + 1).match(/^.*[.!?](?=\s|$)/)?.[0] ?? ""
    const cut = t.slice(0, max + 1).replace(/\s+\S*$/, "")
    t = sentences.length >= max * 0.5 ? sentences : cut.length >= max * 0.6 ? cut : t.slice(0, max)
  }
  return t.trim()
}

/** Curly quotes and apostrophes, like the templates. */
const typeset = (t: string) =>
  t
    // Non-breaking and other special hyphens (the poster fonts may not have them) and spaces.
    .replace(/[\u2010\u2011\u2012]/g, "-")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/(^|[\s([{])"(?=\S)/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(\w)'(\w)/g, "$1’$2")
    .replace(/(^|[\s([{])'(?=\S)/g, "$1‘")
    .replace(/'/g, "’")

const line = (v: string | undefined, max: number) => typeset(clean(v, max))

/** A COURT line the AI may leave out ("none", "n/a", "(not given)" …): empty then. */
const given = (v: string | undefined, max: number) => {
  const t = line(v, max)
  return /^[(\[]?\s*(none|n\/?a|not given|unknown|empty|leave empty|-+)\s*[)\]]?\.?$/i.test(t) ? "" : t
}

const STOPWORDS = new Set(
  "what which when where who whom whose why how were was is are the a an of in on at to for from with by and or did does do first very most many much make made named called known used played built held hit set this that these those your their".split(" "),
)

/** A question without [brackets]: its key word gets the green box (a name first, else the longest word). */
function ensureBracket(q: string) {
  if (!q || q.includes("[")) return q
  const words = (q.match(/[A-Za-z’'-]{3,}/g) ?? []).filter((w) => !STOPWORDS.has(w.toLowerCase()))
  const name = words.find((w) => /^[A-Z]/.test(w) && !q.startsWith(w))
  const key = name ?? [...words].sort((a, b) => b.length - a.length)[0]
  return key ? q.replace(new RegExp(`\\b${key}\\b`), `[${key}]`) : q
}

/** At most two [bracketed] parts, each closed; none when the AI forgot them. */
function brackets(q: string) {
  let open = false
  let count = 0
  let out = ""
  for (const ch of q) {
    if (ch === "[") {
      if (open || count >= 2) continue
      open = true
      count++
    } else if (ch === "]") {
      if (!open) continue
      open = false
    }
    out += ch
  }
  return open ? `${out}]` : out
}

export interface PickleballPost {
  content: AdContent
  /** For the "already posted" list. */
  topic: string
  facebookCaption: string
}

export class PickleballPostError extends Error {}

/** The AI's answer as poster content; throws when key lines are missing. */
export function parsePickleballPost(kind: AdKind, text: string, number: string): PickleballPost {
  const f = readFields(text)
  const need = (labels: Label[]) => {
    const missing = labels.filter((l) => !f[l]?.trim())
    if (missing.length) throw new PickleballPostError(`The AI's answer was missing ${missing.map((m) => m.toLowerCase()).join(", ")}. Please try again.`)
  }
  const topic = clean(f.TOPIC, 80) || clean(f.HEADLINE ?? f.QUESTION ?? f.LEAD, 80)
  const facebookCaption = typeset((f["FACEBOOK CAPTION"] ?? "").trim())

  if (kind === "funfact") {
    need(["LEAD", "BIG", "WORD", "BODY"])
    return {
      topic,
      facebookCaption,
      content: {
        kind,
        number,
        lead: line(f.LEAD, 40),
        big: clean(f.BIG, 9),
        word: line(f.WORD, 12),
        body: line(f.BODY, 150),
        leftLabel: line(f["LEFT LABEL"], 12),
        leftValue: clean(f["LEFT VALUE"], 7),
        leftText: line(f["LEFT TEXT"], 18),
        rightLabel: line(f["RIGHT LABEL"], 12),
        rightValue: clean(f["RIGHT VALUE"], 7),
        rightText: line(f["RIGHT TEXT"], 18),
        note: line(f.NOTE, 75),
        caption: line(f.CAPTION, 32),
      },
    }
  }

  if (kind === "courtowner") {
    need(["HEADLINE", "HIGHLIGHT", "DETAIL 1", "DETAIL 2", "DETAIL 3"])
    // Features: the AI's 2-word ones, else the benefits' first words.
    const short = (v: string | undefined, detail: string | undefined) => line(v, 22) || line(detail, 60).split(" ").slice(0, 3).join(" ")
    return {
      topic: topic || clean(`${f.HEADLINE} ${f.HIGHLIGHT}`, 80),
      facebookCaption,
      content: {
        kind,
        headline: line(f.HEADLINE, 22),
        highlight: line(f.HIGHLIGHT, 18),
        detail1: line(f["DETAIL 1"], 44),
        detail2: line(f["DETAIL 2"], 44),
        detail3: line(f["DETAIL 3"], 46),
        feature1: short(f["FEATURE 1"], f["DETAIL 1"]),
        feature2: short(f["FEATURE 2"], f["DETAIL 2"]),
        feature3: short(f["FEATURE 3"], f["DETAIL 3"]),
      },
    }
  }

  if (kind === "comingsoon" || kind === "nowopen") {
    // The court's details: the AI's (from the article) only when it gave some; the app keeps what was typed.
    const court = { courtName: given(f["COURT NAME"], 40), barangay: given(f.BARANGAY, 30), city: given(f.CITY, 30) }
    if (kind === "comingsoon") {
      need(["HEADLINE", "HIGHLIGHT", "DETAIL", "CTA"])
      return {
        topic: topic || clean(`${f.HEADLINE} ${f.HIGHLIGHT}`, 80),
        facebookCaption,
        content: {
          kind,
          tag: line(f.TAG, 18) || "Coming soon",
          kicker: line(f.KICKER, 20) || "You’re invited",
          chip: line(f.CHIP, 16) || "New court",
          headline: line(f.HEADLINE, 20),
          highlight: line(f.HIGHLIGHT, 18),
          detail: line(f.DETAIL, 56),
          cta: line(f.CTA, 44),
          ...court,
        },
      }
    }
    need(["HEADLINE", "HIGHLIGHT", "PERK"])
    const headline = line(f.HEADLINE, 16)
    return {
      topic: topic || clean(`${f.HEADLINE} ${f.HIGHLIGHT}`, 80),
      facebookCaption,
      content: {
        kind,
        tag: line(f.TAG, 20) || "Grand opening",
        audience: line(f.AUDIENCE, 26) || "New court now open",
        logoTab: line(f["LOGO TAB"], 16) || "New court",
        headline,
        highlight: line(f.HIGHLIGHT, 16),
        headlineIn: line(f["HEADLINE IN"], 16) || `${headline.replace(/[!.]+$/, "")} in`,
        spotlight: line(f.SPOTLIGHT, 14) || court.city,
        hours: given(f.HOURS, 44),
        perk: line(f.PERK, 46),
        cta: line(f.CTA, 56),
        ...court,
      },
    }
  }

  if (kind === "history") {
    need(["HEADLINE", "BODY", "SIDE BODY"])
    const headline = line(f.HEADLINE, 60)
    // The focus word (an older answer may give a YEAR instead), else the headline's year.
    const focus = line(f.FOCUS ?? f.YEAR, 16) || (headline.match(/\b(1[89]\d\d|20\d\d)\b/)?.[0] ?? "")
    const escaped = focus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const short =
      line(f["SHORT HEADLINE"], 48) ||
      (focus ? headline.replace(new RegExp(`\\s*(in|since|by|after)?\\s*${escaped}\\b`, "i"), "").replace(/\s+([.!])$/, "$1") : headline)
    const place = line(f.PLACE, 32)
    return {
      topic,
      facebookCaption,
      content: {
        kind,
        focus,
        headline,
        shortHeadline: short,
        body: line(f.BODY, 230),
        startTitle: line(f["START TITLE"], 24) || "Where it started",
        storyTag: line(f["STORY TAG"], 36) || [focus, place].filter(Boolean).join(" · "),
        sideTitle: line(f["SIDE TITLE"], 26) || "Did you know?",
        sideBody: line(f["SIDE BODY"], 200),
        badge: line(f.BADGE, 14) || (/^\d{4}$/.test(focus) ? `Est. ${focus}` : focus),
      },
    }
  }

  if (kind !== "trivia") throw new PickleballPostError("Unknown post type.")
  need(["QUESTION", "ANSWER", "EXPLANATION"])
  const answer = line(f.ANSWER, 14)
  const choices = (["A", "B", "C", "D"] as const).map((l) => line(f[l], 20))
  const plain = (s: string) => s.replace(/[!.]+$/, "").trim().toLowerCase()
  let correct = "ABCD".indexOf((f.CORRECT ?? "").trim().charAt(0).toUpperCase())
  // The letter disagrees with the choices (or is missing): the choice that is the answer.
  const matching = choices.findIndex((c) => c && plain(c) === plain(answer))
  if (matching >= 0) correct = matching
  if (correct < 0) correct = 0
  if (!choices[correct]) choices[correct] = answer.replace(/!+$/, "")
  const question = ensureBracket(brackets(line(f.QUESTION, 56)))
  return {
    topic,
    facebookCaption,
    content: {
      kind,
      number,
      question,
      longQuestion: ensureBracket(brackets(line(f["LONG QUESTION"], 110))) || question,
      shortQuestion: ensureBracket(brackets(line(f["SHORT QUESTION"], 30))) || question,
      answer,
      explanation: line(f.EXPLANATION, 130),
      choices: choices.map((c, i) => c || `Choice ${"ABCD"[i]}`) as [string, string, string, string],
      correct,
    },
  }
}
