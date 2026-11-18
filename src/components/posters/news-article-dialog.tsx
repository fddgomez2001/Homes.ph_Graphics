"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, FileText, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { SourceLink } from "@/components/ai/source-links"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { articleForAi } from "@/lib/ai/article-extract"
import { posterAiLabel, readArticleLink, writeNewsArticle } from "@/lib/ai/client"
import { trendStoryText, type NewsArticleDraft, type TrendStory } from "@/lib/ai/trend-news"
import { ARTICLE_MAX } from "@/lib/ai/validate"
import { cn, errorMessage } from "@/lib/utils"

function CopyText({ text, what }: { text: string; what: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 text-muted-foreground"
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          toast.error(`Couldn't copy the ${what.toLowerCase()}`)
        }
      }}
      aria-label={`Copy the ${what.toLowerCase()}`}
    >
      {done ? <Check /> : <Copy />} {done ? "Copied" : "Copy"}
    </Button>
  )
}

function Part({ title, text, what, className, children }: { title: string; text: string; what: string; className?: string; children?: React.ReactNode }) {
  if (!text && !children) return null
  return (
    <section className={cn("rounded-lg border bg-card p-3", className)} aria-label={title}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        <CopyText text={text} what={what} />
      </div>
      {children ?? <p className="text-[13px] leading-relaxed whitespace-pre-line">{text}</p>}
    </section>
  )
}

/**
 * Trending news → Write article: the story's page is read (a Facebook post or a page that can't be read
 * gives the story as the search found it), then the AI writes a Facebook headline, a short and a detailed
 * article, the caption, carousel cards and an image prompt, only from the story's facts. The facts it
 * confirms are kept apart from its own reading. Nothing is posted: everything is copied by hand.
 */
export function NewsArticleDialog({ story, brandName, onOpenChange }: { story: TrendStory | null; brandName: string; onOpenChange: (open: boolean) => void }) {
  const [draft, setDraft] = useState<NewsArticleDraft | null>(null)
  const [busy, setBusy] = useState<"reading" | "writing" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fromSummary, setFromSummary] = useState(false)
  const article = useRef("")
  const running = useRef(0)

  const write = useCallback(
    async (s: TrendStory, again = false) => {
      const run = ++running.current
      setError(null)
      try {
        if (!again || !article.current) {
          setBusy("reading")
          let text = ""
          // Facebook asks for a login, so a post is written from what the search found.
          if (s.url && s.kind === "news") {
            try {
              text = articleForAi(await readArticleLink(s.url)).slice(0, ARTICLE_MAX)
            } catch {
              text = ""
            }
          }
          if (run !== running.current) return
          setFromSummary(!text)
          article.current = text || trendStoryText(s)
        }
        setBusy("writing")
        const source = [s.kind === "page" ? `Facebook post by ${s.from || "the Page"}` : s.kind === "facebook" ? "Public Facebook post" : s.site, s.dateText && `published ${s.dateText}`, s.url].filter(Boolean).join(" · ")
        const { fellBack, ...next } = await writeNewsArticle({ article: article.current, brand: brandName, source })
        if (run !== running.current) return
        setDraft(next)
        if (fellBack) toast.info("Your AI didn't answer, so the built-in Groq wrote it", { description: fellBack })
      } catch (e) {
        if (run === running.current) setError(errorMessage(e))
      } finally {
        if (run === running.current) setBusy(null)
      }
    },
    [brandName],
  )

  // A new story: start over and write it.
  useEffect(() => {
    if (!story) return
    article.current = ""
    const counter = running
    const timer = setTimeout(() => {
      setDraft(null)
      void write(story)
    }, 0)
    return () => {
      clearTimeout(timer)
      // A late answer for this story is ignored.
      counter.current++
    }
  }, [story, write])

  const caption = draft ? [draft.caption, draft.hashtags.join(" ")].filter(Boolean).join("\n\n") : ""
  const carousel = draft ? draft.carousel.map((c, i) => `${i + 1}. ${c.title}${c.text ? ` | ${c.text}` : ""}`).join("\n") : ""

  return (
    <Dialog open={!!story} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,56rem)] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-violet-600 dark:text-violet-300" /> Write an article from this story
          </DialogTitle>
          <DialogDescription>
            {story?.title}. AI writes only from the story&apos;s facts ({posterAiLabel()}). Check them on the source before posting: nothing is posted automatically.
          </DialogDescription>
        </DialogHeader>
        {story?.url && <SourceLink url={story.url} />}
        <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
          {busy && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" /> {busy === "reading" ? "Reading the story's page…" : "Writing the article…"}
            </p>
          )}
          {error && !busy && (
            <p role="alert" className="py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}
          {draft && !busy && (
            <div className="flex flex-col gap-2.5">
              {fromSummary && (
                <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  {story?.kind === "news"
                    ? "The page couldn't be read, so this was written from the story's summary only. Open the source and check every fact."
                    : "Facebook posts can't be read without logging in, so this was written from what the search found. Open the post and check every fact."}
                </p>
              )}
              <Part title="Facebook headline" text={draft.headline} what="Headline">
                <p className="text-base leading-snug font-semibold">{draft.headline}</p>
              </Part>
              <Part title="Short article" text={draft.short} what="Short article" />
              <Part title="Detailed article" text={draft.detailed} what="Detailed article" />
              <Part title="Facebook caption" text={caption} what="Caption" />
              <Part title="Carousel content" text={carousel} what="Carousel content">
                <ol className="flex flex-col gap-1 text-[13px]">
                  {draft.carousel.map((c, i) => (
                    <li key={i}>
                      <span className="font-semibold">
                        {i === 0 ? "Cover" : `Card ${i}`}: {c.title}
                      </span>
                      {c.text && <span className="text-muted-foreground"> {c.text}</span>}
                    </li>
                  ))}
                </ol>
              </Part>
              <Part title="Image prompt" text={draft.imagePrompt} what="Image prompt" />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Part title="Confirmed facts (from the source)" text={draft.facts.map((f) => `- ${f}`).join("\n")} what="Facts" className="border-emerald-500/30">
                  <ul className="flex list-disc flex-col gap-0.5 pl-4 text-[13px]">
                    {draft.facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                    {!draft.facts.length && <li className="list-none text-muted-foreground">None listed</li>}
                  </ul>
                </Part>
                <Part title="AI interpretation (not from the source)" text={draft.notes.map((f) => `- ${f}`).join("\n")} what="AI notes" className="border-amber-500/30">
                  <ul className="flex list-disc flex-col gap-0.5 pl-4 text-[13px] text-muted-foreground italic">
                    {draft.notes.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                    {!draft.notes.length && <li className="list-none">None</li>}
                  </ul>
                </Part>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => story && void write(story, true)} disabled={!story || !!busy}>
            {draft ? <RotateCcw /> : <Sparkles />} {draft ? "Write again" : "Write"}
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
