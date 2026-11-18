"use client"

import { useEffect, useRef, useState, type ClipboardEvent } from "react"
import Link from "next/link"
import { AlertTriangle, Check, ClipboardPaste, Copy, Eraser, FileText, Globe, Link2, Loader2, MessageSquareText, RefreshCw, Sparkles, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { articleForAi, isLink } from "@/lib/ai/article-extract"
import { posterAiLabel, readArticleLink, suggestPosterCaption, suggestPosterCopy, type LinkedArticle } from "@/lib/ai/client"
import { captionForPost, type HeadlineOption, type PosterCaption, type PosterCopy, type SubtextKind } from "@/lib/ai/types"
import { ARTICLE_MAX } from "@/lib/ai/validate"
import { findPhrase } from "@/lib/design/konva-attrs"
import { cn, errorMessage } from "@/lib/utils"
import { captionFor, loadArticleMemory, saveArticleMemory } from "./article-memory"
import { trendScope } from "@/lib/ai/homes-places"
import { TrendNewsPanel } from "./trend-news-panel"
import { trendStoryText, type TrendStory } from "@/lib/ai/trend-news"
import type { TrendBrand } from "@/lib/ai/types"
import { SourceLink } from "@/components/ai/source-links"
import { useCreateCarousel } from "@/components/projects/create-carousel-dialog"

/** A pasted article this long is read right away (no need to click the button). */
const AUTO_RUN_CHARS = 200

/**
 * "Write from article": paste the whole article (or its link: the website is read on the
 * server and the article taken from it) and the AI reads it: it picks the poster
 * category, writes three headlines (the recommended one first, each with its hook words)
 * and subtext choices of different kinds: the key details ("Date | Location"), the article's
 * key point, a summary or a quote. It recommends one, or no subtext when the headline says
 * it all. It also writes the Facebook caption with hashtags. The recommended headline,
 * subtext and caption go on the poster at once; the others are a click away.
 * The article and the results stay (closing the dialog, another poster, restarting the
 * app) until the next "Write".
 * Uses the key from Settings → Poster Maker AI, or the built-in Groq.
 */
export function ArticleHeadlineDialog({
  open,
  onOpenChange,
  brand,
  page = null,
  allPages = [],
  day,
  brandName,
  accent,
  subtextColor,
  allowSubtext,
  current,
  onApplyHeadline,
  onApplySubtext,
  onApplyCaption,
  onApplyDetails,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The poster's brand (its trending-news keywords) and day (yyyy-MM-dd: how new the news must be). */
  brand: TrendBrand
  /** Homes.ph posters: the Facebook page (its own trending-news keywords and place). */
  page?: string | null
  /** Every Homes.ph page (new keywords can go to all of them). */
  allPages?: string[]
  day: string
  /** "PicklePlay PH", "Homes.ph BGC Taguig": tells the AI who the poster is for. */
  brandName: string
  accent: string
  subtextColor: string
  /** false on event posters (they show the location and time instead of a subtext). */
  allowSubtext: boolean
  onApplyHeadline: (option: HeadlineOption) => void
  /** `on` false: keep the text but show no subtext (headline-only poster). */
  onApplySubtext: (subtext: string, on: boolean) => void
  /** What's on the poster now (the choices show "On the poster"). */
  current: { headline: string; subtext: string; subtextOn: boolean; caption: string }
  /** The caption as posted (text, blank line, hashtags). */
  onApplyCaption: (caption: string) => void
  /** The daily report details (Daily Trend News), written with the rest. */
  onApplyDetails?: (details: string) => void
}) {
  // This brand's (or Homes.ph page's) last article and results, kept until its next "Write".
  const scope = trendScope(brand, page)
  const [memory] = useState(() => loadArticleMemory(scope))
  const [mode, setMode] = useState<"paste" | "link" | "trend">(memory.mode)
  const openCreate = useCreateCarousel()
  const [article, setArticle] = useState(memory.article)
  const [link, setLink] = useState(memory.link)
  /** The article read from the link. */
  const [source, setSource] = useState<LinkedArticle | null>(memory.source)
  const [reading, setReading] = useState(false)
  const [copy, setCopy] = useState<PosterCopy | null>(memory.copy)
  const [busy, setBusy] = useState(false)
  const [captionBusy, setCaptionBusy] = useState(false)
  const [fellBack, setFellBack] = useState<string | null>(memory.fellBack)
  /** Who the results were written for. */
  const [writtenFor, setWrittenFor] = useState(memory.brand)
  const running = useRef(false)

  useEffect(() => {
    saveArticleMemory(scope, { mode, article, link, source, copy, fellBack, brand: writtenFor })
  }, [scope, mode, article, link, source, copy, fellBack, writtenFor])

  const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase()
  const usedHeadline = copy?.options.find((o) => same(o.headline, current.headline))?.headline ?? null
  const usedSubtext = current.subtextOn && current.subtext.trim() ? current.subtext : ""
  const caption = copy?.caption ? captionFor(copy.caption, brandName) : null
  const captionUsed = !!caption && same(captionForPost(caption), current.caption)
  // Which AI answers (read while open: Settings may have changed it; nothing renders while closed).
  const using = open ? posterAiLabel() : ""

  const text = article.trim()
  const tooShort = text.length < 60

  const write = async (source = text) => {
    if (running.current || source.length < 60) return
    running.current = true
    setBusy(true)
    try {
      const { fellBack: fell, ...result } = await suggestPosterCopy(source, brandName)
      setCopy(result)
      setFellBack(fell ?? null)
      setWrittenFor(brandName)
      // Load the recommended headline, the subtext and the caption on the poster right away.
      const best = result.options[0]
      onApplyHeadline(best)
      const withSubtext = allowSubtext && !!result.subtext
      if (withSubtext) onApplySubtext(result.subtext, true)
      // Headline only; the best choice stays in the subtext box (switched off) in case it's wanted.
      else if (allowSubtext && result.noSubtext) onApplySubtext(result.subtexts[0]?.text ?? "", false)
      if (result.caption) onApplyCaption(captionForPost(captionFor(result.caption, brandName)))
      if (result.details) onApplyDetails?.(result.details)
      toast.success(withSubtext ? "Headline, subtext and caption loaded" : "Headline and caption loaded", {
        description: withSubtext
          ? result.subtext
          : allowSubtext && result.noSubtext
            ? "AI suggests no subtext: the headline says it all."
            : best.highlight
              ? `Highlighted: ${best.highlight}`
              : undefined,
      })
    } catch (e) {
      toast.error("Couldn't write the poster text", { description: errorMessage(e) })
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  /** A new caption from the same article (the headline and subtext stay). */
  const rewriteCaption = async () => {
    if (captionBusy || text.length < 60) return
    setCaptionBusy(true)
    try {
      const { fellBack: fell, ...next } = await suggestPosterCaption(text, brandName, current.headline)
      setCopy((c) => (c ? { ...c, caption: next } : c))
      if (fell) setFellBack(fell)
      onApplyCaption(captionForPost(captionFor(next, brandName)))
      toast.success("New caption loaded")
    } catch (e) {
      toast.error("Couldn't write the caption", { description: errorMessage(e) })
    } finally {
      setCaptionBusy(false)
    }
  }

  /** Start over: no article, no results. */
  const clear = () => {
    setArticle("")
    setLink("")
    setSource(null)
    setCopy(null)
    setFellBack(null)
    setWrittenFor("")
  }

  /** Reads the article from a website, then writes the poster text from it. */
  const readLink = async (value = link) => {
    const url = value.trim()
    if (!url || reading || running.current) return
    setMode("link")
    setLink(url)
    setReading(true)
    try {
      const found = await readArticleLink(url)
      setSource(found)
      const forAi = articleForAi(found).slice(0, ARTICLE_MAX)
      setArticle(forAi)
      setReading(false)
      await write(forAi)
    } catch (e) {
      setSource(null)
      toast.error("Couldn't read that page", { description: errorMessage(e) })
    } finally {
      setReading(false)
    }
  }

  /**
   * Trending news → Use this news: its article is read from the website and the poster written from
   * it. A page that can't be read gives the story as the search found it (the summary).
   */
  const pickStory = async (story: TrendStory) => {
    if (reading || running.current) return
    setLink(story.url)
    setMode("link")
    setReading(true)
    let text = ""
    try {
      // A Facebook post can't be read without logging in: it's written from what the search found.
      if (!story.url || (story.kind && story.kind !== "news")) throw new Error("No article page")
      const found = await readArticleLink(story.url)
      setSource(found)
      text = articleForAi(found).slice(0, ARTICLE_MAX)
    } catch {
      setSource(null)
      text = trendStoryText(story)
      setMode("paste")
      if (story.kind && story.kind !== "news") toast.info("Written from the Facebook post as the search found it", { description: "Open the post and check the facts before posting." })
      else toast.info("Couldn't read the whole article", { description: "The poster is written from the story's summary: check the facts on its page." })
    } finally {
      setReading(false)
    }
    setArticle(text)
    await write(text)
  }

  const takeArticle = (value: string) => {
    // Just a link: read the article from the website.
    if (isLink(value)) return void readLink(value)
    const next = value.slice(0, ARTICLE_MAX)
    setArticle(next)
    // The last results stay until the new ones are written.
    if (next.trim().length >= AUTO_RUN_CHARS) void write(next.trim())
  }

  const pasteArticle = async () => {
    try {
      const pasted = await navigator.clipboard.readText()
      if (!pasted.trim()) return void toast.info("The clipboard has no text. Copy the article first.")
      takeArticle(pasted)
    } catch {
      toast.info("Click the box and press Ctrl+V to paste the article.")
    }
  }

  // Pasting the article into the box reads it at once. With the last article still there
  // (and its results), a whole new article (or all of it selected) replaces it.
  const onPasteIntoBox = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text")
    const box = e.currentTarget
    const allSelected = box.selectionStart === 0 && box.selectionEnd === box.value.length
    const newArticle = !article.trim() || allSelected || (!!copy && (pasted.trim().length >= AUTO_RUN_CHARS || isLink(pasted)))
    if (!pasted.trim() || !newArticle) return
    e.preventDefault()
    takeArticle(pasted)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,56rem)] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600 dark:text-violet-300" /> Headline, subtext &amp; caption from an article
          </DialogTitle>
          <DialogDescription>
            Paste the whole article or its link, or pick the day&apos;s trending news. AI reads it and loads the recommended headline
            {allowSubtext ? ", subtext (key details, the main point, a summary or a quote, or none when the headline says it all)" : ""} and the
            Facebook caption on the poster, with more choices below. They stay here until you write new ones.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1 rounded-lg border bg-card p-1" role="tablist" aria-label="Where the article comes from">
          {(
            [
              { id: "paste", label: "Paste the article", icon: FileText },
              { id: "link", label: "From a link", icon: Globe },
              { id: "trend", label: "Trending news", icon: TrendingUp },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                mode === m.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <m.icon className="size-3.5" /> {m.label}
            </button>
          ))}
        </div>

        {mode === "trend" && (
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            <TrendNewsPanel
              key={trendScope(brand, page)}
              brand={brand}
              brandName={brandName}
              page={page}
              allPages={allPages}
              day={day}
              disabled={busy || reading}
              onUse={(story) => void pickStory(story)}
              onCarousel={(story) => {
                // The carousel starts from the story's article (a Facebook post: what the search found).
                onOpenChange(false)
                openCreate({ brand, article: story.kind === "news" && story.url ? { link: story.url } : { text: trendStoryText(story) } })
              }}
            />
          </div>
        )}

        {mode === "link" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="poster-article-url" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Article link
            </label>
            <div className="flex gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="poster-article-url"
                  type="url"
                  inputMode="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text").trim()
                    if (!isLink(pasted)) return
                    e.preventDefault()
                    void readLink(pasted)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void readLink()
                    }
                  }}
                  placeholder="https://… the article's web address (it's read as soon as you paste)"
                  className="bg-card pl-8"
                />
              </div>
              <Button type="button" variant="outline" onClick={() => void readLink()} disabled={!link.trim() || reading || busy || (!!source && link.trim() === source.url && !!copy)}>
                {reading ? <Loader2 className="animate-spin" /> : <Globe />} Read article
              </Button>
            </div>
            {source ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground" role="status">
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Read <span className="font-medium text-foreground">{source.title || "the article"}</span>
                {source.site && <span>· {source.site}</span>}
                {source.published && <span>· {source.published.slice(0, 10)}</span>}
                <span>· {source.text.length.toLocaleString()} characters</span>
              </p>
            ) : null}
            {source ? (
              <SourceLink url={source.url} />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                News sites, blogs and announcement pages work. If a page needs a sign-in or loads its text later, copy the article and paste it instead.
              </p>
            )}
          </div>
        )}

        <div className={cn("flex min-h-0 flex-col gap-1.5", mode !== "paste" && "hidden")}>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="poster-article" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Article
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground tabular-nums">{text ? `${text.length.toLocaleString()} characters` : ""}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void pasteArticle()} disabled={busy}>
                <ClipboardPaste /> Paste
              </Button>
            </div>
          </div>
          <Textarea
            id="poster-article"
            value={article}
            onPaste={onPasteIntoBox}
            onChange={(e) => setArticle(e.target.value.slice(0, ARTICLE_MAX))}
            placeholder="Paste the whole article, announcement or event details here (it's read as soon as you paste)"
            className={cn("resize-y bg-card text-[13px] leading-relaxed", copy ? "max-h-28 min-h-20" : "max-h-[38dvh] min-h-40")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            type="button"
            onClick={() => void (mode === "link" && !source ? readLink() : write())}
            disabled={busy || reading || (mode === "link" ? !link.trim() && !source : tooShort)}
            className={cn("bg-violet-600 text-white hover:bg-violet-600/90", mode === "trend" && !busy && !reading && "hidden")}
          >
            {busy || reading ? <Loader2 className="animate-spin" /> : copy ? <RefreshCw /> : <Sparkles />}
            {reading ? "Reading the website…" : busy ? "Writing…" : copy ? "Write new ones" : allowSubtext ? "Write headline & subtext" : "Write headlines"}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            For {brandName} · AI: {using} ·{" "}
            <Link href="/settings#poster-ai" className="underline underline-offset-2 hover:text-foreground" onClick={() => onOpenChange(false)}>
              change
            </Link>
          </span>
          {(article || link || copy) && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-7" onClick={clear} disabled={busy || reading} title="Start over with another article">
              <Eraser /> Clear
            </Button>
          )}
        </div>

        {copy && writtenFor && writtenFor !== brandName && (
          <p className="text-xs text-muted-foreground" role="status">
            These were written for <span className="font-medium text-foreground">{writtenFor}</span>. Use them here, or click Write new ones for {brandName}.
          </p>
        )}

        {fellBack && (
          <p className="flex gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="status">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>Your own AI key didn&apos;t work, so the built-in Groq wrote these. {fellBack}</span>
          </p>
        )}

        {copy && (
          <div className="-mx-1 flex min-h-0 flex-col gap-3 overflow-y-auto px-1 pb-1">
            {copy.category && (
              <p className="text-xs text-muted-foreground">
                Poster category: <span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-medium text-violet-700 dark:text-violet-300">{copy.category}</span>
              </p>
            )}
            <ul className="flex flex-col gap-2" aria-label="Headline choices">
              {copy.options.map((option, i) => {
                const used = usedHeadline === option.headline
                return (
                  <li key={option.headline}>
                    <button
                      type="button"
                      onClick={() => onApplyHeadline(option)}
                      aria-pressed={used}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-primary/60 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-primary",
                        used && "border-primary ring-1 ring-primary",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                          {i === 0 ? "Recommended headline" : `Alternative ${i}`}
                        </span>
                        <HeadlinePreview option={option} accent={accent} />
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {option.headline.length} characters{option.highlight ? ` · highlight: ${option.highlight}` : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
                          used ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground opacity-90 group-hover:opacity-100",
                        )}
                      >
                        {used ? (
                          <>
                            <Check className="size-3.5" /> On the poster
                          </>
                        ) : (
                          "Use this"
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {allowSubtext && <SubtextChoices copy={copy} used={usedSubtext} color={subtextColor} onUse={onApplySubtext} />}

            <CaptionChoice
              caption={caption}
              used={captionUsed}
              busy={captionBusy}
              canRewrite={text.length >= 60}
              onUse={() => caption && onApplyCaption(captionForPost(caption))}
              onRewrite={() => void rewriteCaption()}
            />
          </div>
        )}

        {copy && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

const KIND_LABEL: Record<SubtextKind, string> = { details: "Details", "key point": "Key point", summary: "Summary", quote: "Quote" }

/** The Facebook caption: the text and its hashtags as posted, Use this / Copy / Write another. */
function CaptionChoice({
  caption,
  used,
  busy,
  canRewrite,
  onUse,
  onRewrite,
}: {
  caption: PosterCaption | null
  used: boolean
  busy: boolean
  canRewrite: boolean
  onUse: () => void
  onRewrite: () => void
}) {
  const copyText = async () => {
    if (!caption) return
    try {
      await navigator.clipboard.writeText(captionForPost(caption))
      toast.success("Caption copied", { description: "Paste it in the Facebook post." })
    } catch {
      toast.error("Couldn't copy the caption")
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" role="group" aria-label="Facebook caption">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          <MessageSquareText className="size-3.5" /> Facebook caption
        </span>
        <span className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onRewrite} disabled={busy || !canRewrite}>
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Write another
          </Button>
          {caption && (
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => void copyText()}>
              <Copy /> Copy
            </Button>
          )}
          {caption &&
            (used ? (
              <span className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white">
                <Check className="size-3.5" /> On the poster
              </span>
            ) : (
              <Button type="button" size="sm" className="h-7" onClick={onUse}>
                Use this
              </Button>
            ))}
        </span>
      </div>
      {caption ? (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-[13px] leading-relaxed">
          <p className="whitespace-pre-line">{caption.text}</p>
          {caption.hashtags.length > 0 && <p className="mt-2 font-medium text-primary">{caption.hashtags.join(" ")}</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">{caption.text.length} characters · no emojis · facts from the article only</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No caption yet. Click Write another to write one from this article.</p>
      )}
    </div>
  )
}

/**
 * The subtext choices (the recommended one first) and "No subtext". When AI recommends none,
 * it says so and the choices are still there.
 */
function SubtextChoices({ copy, used, color, onUse }: { copy: PosterCopy; used: string | null; color: string; onUse: (text: string, on: boolean) => void }) {
  const none = used === ""
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" role="group" aria-label="Subtext choices">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Subtext</span>
        {copy.noSubtext && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">AI suggests none</span>}
      </div>
      {copy.noSubtext && (
        <p className="text-xs text-muted-foreground">The headline already says it all, so AI recommends a headline-only poster. You can still add one of these.</p>
      )}
      {!copy.subtexts.length && !copy.noSubtext && <p className="text-xs text-muted-foreground">AI didn&apos;t find anything to add under the headline.</p>}
      <ul className="flex flex-col gap-1.5">
        {copy.subtexts.map((option, i) => {
          const on = used === option.text
          return (
            <li key={option.text}>
              <button
                type="button"
                onClick={() => onUse(option.text, true)}
                aria-pressed={on}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors outline-none hover:border-primary/60 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-primary",
                  on && "border-primary ring-1 ring-primary",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {KIND_LABEL[option.kind]}
                    {i === 0 && !copy.noSubtext && <span className="rounded bg-primary/10 px-1 text-primary normal-case">recommended</span>}
                  </span>
                  <span
                    className="block rounded bg-[#0D1969] px-3 py-1.5 text-center font-['League_Spartan',sans-serif] text-[14px] leading-tight font-semibold uppercase"
                    style={{ color }}
                  >
                    {option.text}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    on ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground opacity-90 group-hover:opacity-100",
                  )}
                >
                  {on ? (
                    <>
                      <Check className="size-3.5" /> On the poster
                    </>
                  ) : (
                    "Use this"
                  )}
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => onUse(copy.subtexts[0]?.text ?? "", false)}
            aria-pressed={none}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-md border border-dashed p-2 text-left text-xs transition-colors outline-none hover:border-primary/60 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-primary",
              none && "border-solid border-primary ring-1 ring-primary",
            )}
          >
            <span>
              <span className="font-medium">No subtext</span>
              <span className="block text-muted-foreground">Headline only: it gets the whole space.</span>
            </span>
            {none ? (
              <span className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 font-medium text-white">
                <Check className="size-3.5" /> On the poster
              </span>
            ) : (
              <span className="rounded-md border px-2.5 py-1.5 font-medium">Use this</span>
            )}
          </button>
        </li>
      </ul>
    </div>
  )
}

/** The headline in capitals on the poster's navy, with the hook words in the brand color. */
function HeadlinePreview({ option, accent }: { option: HeadlineOption; accent: string }) {
  const chars = Array.from(option.headline)
  const at = option.highlight ? findPhrase(option.headline, option.highlight) : null
  const parts = at
    ? [chars.slice(0, at.start).join(""), chars.slice(at.start, at.end).join(""), chars.slice(at.end).join("")]
    : [option.headline, "", ""]
  return (
    <span className="block rounded-md bg-[#0D1969] px-3 py-2 font-['League_Spartan',sans-serif] text-[15px] leading-tight font-bold tracking-tight text-white uppercase">
      {parts[0]}
      {parts[1] && <span style={{ color: accent }}>{parts[1]}</span>}
      {parts[2]}
    </span>
  )
}
