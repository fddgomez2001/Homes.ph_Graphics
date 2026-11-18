import { describe, expect, it } from "vitest"
import { articleForAi, decodeEntities, extractArticle, isLink } from "@/lib/ai/article-extract"
import { parsePosterCopy } from "@/lib/ai/headlines"
import { chatModels, providersForKey, recommendModel } from "@/lib/ai/providers"
import { AI_HEADERS, AI_PROVIDERS } from "@/lib/ai/types"
import { parseAiProvider } from "@/lib/ai/validate"
import { nextPosterTime } from "@/components/posters/poster-shared"

const para = (n: number) => `This is paragraph number ${n} of the story, with enough words to count as real article text for the poster.`

describe("reading an article from a web page", () => {
  it("uses the article's structured data (JSON-LD) when the page has it", () => {
    const html = `<html><head>
      <title>PPA Asia Tour comes to Manila | Rappler</title>
      <meta property="og:site_name" content="Rappler">
      <meta property="og:title" content="PPA Asia Tour comes to Manila">
      <meta property="article:published_time" content="2026-11-06T08:00:00+08:00">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Rappler"},
        {"@type":"NewsArticle","headline":"PPA Asia Tour comes to Manila","datePublished":"2026-11-06T08:00:00+08:00",
         "articleBody":"MANILA &amp; PASIG \\u2014 The PPA Asia Tour will hold its January to February 2027 leg in Pasig City. ${"More details about the event and players. ".repeat(8)}"}]}</script>
      </head><body><nav>Home News Sports</nav><article><p>${para(1)}</p></article></body></html>`
    const a = extractArticle(html, "https://www.rappler.com/sports/ppa-asia-tour")
    expect(a.title).toBe("PPA Asia Tour comes to Manila")
    expect(a.site).toBe("Rappler")
    expect(a.published).toBe("2026-11-06T08:00:00+08:00")
    expect(a.text.startsWith("MANILA & PASIG — The PPA Asia Tour will hold its January to February 2027 leg")).toBe(true)
    expect(a.text).not.toContain("Home News Sports")
  })

  it("otherwise takes the paragraphs of the <article>, without menus, scripts and page furniture", () => {
    const html = `<html><head><title>Dubai Design Week opens - Gulf News</title><meta name="description" content="A short summary."></head><body>
      <header><p>${para(99)} (header)</p></header>
      <script>var tracking = "${para(98)}"</script>
      <article>
        <h1>Dubai Design Week opens</h1>
        <p>${para(1)}</p><p>Advertisement — ${para(97)}</p><p>${para(2)}</p>
        <h2>What to see this year</h2>
        <p>${para(3)} &#8220;Quoted&#8221; &amp; more.</p>
        <figure><figcaption>${para(96)} (caption)</figcaption></figure>
      </article>
      <aside><p>${para(95)} (related)</p></aside>
      <footer><p>All rights reserved. ${para(94)}</p></footer>
    </body></html>`
    const a = extractArticle(html, "https://gulfnews.com/uae/design-week")
    expect(a.title).toBe("Dubai Design Week opens")
    expect(a.site).toBe("gulfnews.com")
    expect(a.text.split("\n\n")).toEqual([para(1), para(2), "What to see this year", `${para(3)} “Quoted” & more.`])
  })

  it("uses the whole page when there's no <article>, and the description when the text is short", () => {
    const whole = extractArticle(`<html><body><div class="story"><p>${para(1)}</p><p>${para(2)}</p></div></body></html>`)
    expect(whole.text).toBe(`${para(1)}\n\n${para(2)}`)
    const short = extractArticle(`<html><head><meta property="og:description" content="Open play night at PicklePlay courts, Friday 7 PM."></head><body><p>Too short.</p></body></html>`)
    expect(short.text).toBe("Open play night at PicklePlay courts, Friday 7 PM.")
  })

  it("decodes entities and knows a pasted link", () => {
    expect(decodeEntities("A&amp;B &lt;3 &#8369;5,000 &#x2014; caf&eacute;")).toBe("A&B <3 ₱5,000 — café")
    expect(isLink("  https://www.inquirer.net/123/story  ")).toBe(true)
    expect(isLink("Read this: https://x.com/a")).toBe(false)
    expect(articleForAi({ title: "T", site: "Rappler", published: "2026-11-06T08:00:00+08:00", text: "Body" })).toBe("T\nSource: Rappler · Published: 2026-11-06\n\nBody")
  })
})

describe("AI key: just the key is enough", () => {
  it("tells the service from the key (other services never see it)", () => {
    expect(providersForKey("gsk_abc123")).toEqual(["groq"])
    expect(providersForKey("sk-ant-api03-xyz")).toEqual(["anthropic"])
    expect(providersForKey("AIzaSyD-example")).toEqual(["gemini"])
    expect(providersForKey("sk-or-v1-abc")).toEqual(["openrouter"])
    expect(providersForKey("xai-abc")).toEqual(["xai"])
    expect(providersForKey("sk-proj-abc")).toEqual(["openai"])
    expect(providersForKey("sk-0123456789abcdef")).toEqual(["openai", "deepseek"])
    expect(providersForKey("a".repeat(32))).toEqual(["mistral"])
    expect(providersForKey("some-unknown-key-format")).toEqual([])
  })

  it("picks a fast chat model the key has (newest version), never an embedding or speech model", () => {
    expect(recommendModel("openai", ["text-embedding-3-small", "whisper-1", "gpt-4o-mini", "gpt-5-mini", "gpt-5.1-mini", "dall-e-3"])).toBe("gpt-5.1-mini")
    expect(recommendModel("anthropic", ["claude-sonnet-5-5", "claude-haiku-4-5-20251001", "claude-haiku-5-5"])).toBe("claude-haiku-5-5")
    expect(recommendModel("gemini", ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "text-embedding-004", "gemini-2.5-pro"])).toBe("gemini-2.5-flash")
    expect(recommendModel("groq", ["whisper-large-v3", "llama-3.1-8b-instant", "openai/gpt-oss-120b"])).toBe("openai/gpt-oss-120b")
    expect(recommendModel("deepseek", ["deepseek-reasoner", "deepseek-chat"])).toBe("deepseek-chat")
    expect(recommendModel("mistral", ["mistral-embed", "mistral-large-latest", "mistral-small-latest"])).toBe("mistral-small-latest")
    expect(recommendModel("xai", ["grok-2-image", "grok-3", "grok-4-fast"])).toBe("grok-4-fast")
    expect(recommendModel("openrouter", ["meta-llama/llama-3.3-70b-instruct", "openrouter/auto"])).toBe("openrouter/auto")
    expect(recommendModel("openai", [])).toBeNull()
    expect(chatModels(["tts-1", "gpt-4o-realtime-preview", "omni-moderation-latest", "gpt-4o"])).toEqual(["gpt-4o"])
  })

  it("accepts every provider in the list, with or without a model", () => {
    expect(AI_PROVIDERS.map((p) => p.id)).toEqual(["groq", "openai", "anthropic", "gemini", "perplexity", "openrouter", "deepseek", "xai", "mistral"])
    expect(parseAiProvider(new Headers({ [AI_HEADERS.provider]: "openrouter", [AI_HEADERS.key]: "sk-or-v1-1234567890" }))).toEqual({ provider: "openrouter", key: "sk-or-v1-1234567890" })
    expect(parseAiProvider(new Headers({ [AI_HEADERS.provider]: "mistral", [AI_HEADERS.key]: "a".repeat(32), [AI_HEADERS.model]: "mistral-small-latest" }))).toMatchObject({ model: "mistral-small-latest" })
  })
})

describe("AI answers", () => {
  it("plain hyphens in headlines (models sometimes write look-alike dashes)", () => {
    expect(parsePosterCopy("RECOMMENDED HEADLINE: Fastest‑Growing Sport Reaches 24 Million\nHOOK WORDS: 24 Million").options[0]).toEqual({
      headline: "Fastest-Growing Sport Reaches 24 Million",
      highlight: "24 Million",
    })
  })
})

describe("Poster Maker: any posting time", () => {
  it("a new poster goes two hours after the day's last one (9 AM on an empty day)", () => {
    expect(nextPosterTime([])).toBe("09:00")
    expect(nextPosterTime(["09:00", "13:30", "11:00"])).toBe("15:30")
    expect(nextPosterTime(["22:45"])).toBe("23:30")
  })
})
