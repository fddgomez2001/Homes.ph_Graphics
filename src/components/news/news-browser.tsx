"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format, isToday, isValid, parse, startOfDay } from "date-fns"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ClipboardList, Database, Loader2, Newspaper, Plus } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app-shell/page-header"
import { LivePreview } from "@/components/projects/live-preview"
import { ProjectActionsMenu } from "@/components/projects/project-actions-menu"
import { ProjectThumb } from "@/components/projects/project-thumb"
import { StatusBadge } from "@/components/projects/status-badge"
import { useProjectActions, type ProjectActions } from "@/components/projects/use-project-actions"
import { useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { MiniCalendar } from "@/components/ui/mini-calendar"
import { Textarea } from "@/components/ui/textarea"
import { createNewsArticle } from "@/lib/data/news"
import { projectFeatures } from "@/lib/data/projects"
import { combineDateTime, toDateInput } from "@/lib/dates"
import { NEWS_BRANDS, newsTemplatesFor, newsTimesFor, type NewsBrand } from "@/lib/design/news-templates"
import { useDebouncedValue } from "@/lib/hooks"
import type { ProjectChange } from "@/components/projects/use-project-actions"
import { cn, errorMessage } from "@/lib/utils"
import { NewsBoard } from "./news-board"

type View = "daily" | "all"

/**
 * News Article: single news graphics for PicklePlay PH (1408 × 1408) and FHI
 * Global Property (1152 × 1408 or 1742 × 1436), each exported at its full size.
 * "Daily posts" is the day's five posting times per brand; "All articles" lists
 * everything.
 */
export function NewsBrowser() {
  const router = useRouter()
  const params = useSearchParams()
  const view: View = params.get("view") === "all" ? "all" : "daily"
  const dayParam = params.get("day")
  const parsed = dayParam ? parse(dayParam, "yyyy-MM-dd", new Date()) : null
  const day = parsed && isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date())
  const [search, setSearch] = useState("")
  const [supported, setSupported] = useState<boolean | null>(null)
  const [creating, setCreating] = useState(false)
  // The ⋯ menu's changes refresh every news list.
  const { apply } = useProjects(null)
  const { actions, dialogs } = useProjectActions(apply as (change: ProjectChange) => void)

  useEffect(() => {
    let cancelled = false
    projectFeatures().then(
      (f) => !cancelled && setSupported(f.news),
      () => !cancelled && setSupported(null),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const go = (next: { view?: View; day?: Date }) => {
    const v = next.view ?? view
    const d = next.day ?? day
    const query = new URLSearchParams()
    if (v === "all") query.set("view", "all")
    if (v === "daily" && !isToday(d)) query.set("day", format(d, "yyyy-MM-dd"))
    router.replace(`/news${query.size ? `?${query}` : ""}`, { scroll: false })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="News Article"
        description="PicklePlay PH, FHI Global Property and Homes.ph CARAGA news graphics, exported at full size"
        {...(view === "all" ? { search, onSearchChange: setSearch, searchPlaceholder: "Search news…" } : {})}
      >
        <Button variant="outline" asChild>
          <Link href={`/report?day=${format(day, "yyyy-MM-dd")}`}>
            <ClipboardList /> Generate report
          </Link>
        </Button>
        <Button onClick={() => setCreating(true)} disabled={supported === false}>
          <Plus /> New news article
        </Button>
      </PageHeader>
      <div className="flex-1 px-4 py-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Show" className="inline-flex rounded-lg border bg-card p-1 shadow-xs">
            {(
              [
                ["daily", "Daily posts"],
                ["all", "All articles"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => go({ view: id })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "daily" && (
            <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-xs">
              <Button variant="ghost" size="icon-sm" aria-label="Previous day" onClick={() => go({ day: addDays(day, -1) })}>
                <ChevronLeft />
              </Button>
              <span className="min-w-44 text-center text-[15px] font-semibold" aria-live="polite">
                {format(day, "EEEE, MMMM d")}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Next day" onClick={() => go({ day: addDays(day, 1) })}>
                <ChevronRight />
              </Button>
            </div>
          )}
          {view === "daily" && !isToday(day) && (
            <Button variant="outline" size="sm" onClick={() => go({ day: new Date() })}>
              Today
            </Button>
          )}
        </div>

        {supported === false ? (
          <div className="flex max-w-3xl gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Database className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Turn on News Articles</p>
              <p className="mt-1">
                Run <code className="rounded bg-card/70 px-1">supabase/migrations/20261030000000_trash_and_news.sql</code> in the Supabase SQL Editor, then reload.
              </p>
            </div>
          </div>
        ) : view === "daily" ? (
          <NewsBoard day={day} actions={actions} />
        ) : (
          <NewsList search={search} actions={actions} onCreate={() => setCreating(true)} />
        )}
      </div>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-[min(68rem,calc(100vw-2rem))]">
          {creating && <CreateNewsForm initialDay={view === "daily" ? day : startOfDay(new Date())} onDone={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>
      {dialogs}
    </div>
  )
}

function NewsList({ search, actions, onCreate }: { search: string; actions: ProjectActions; onCreate: () => void }) {
  const router = useRouter()
  const term = useDebouncedValue(search.trim())
  const { projects, loading, error } = useProjects({ kind: "news", search: term || undefined, orderBy: "scheduled_at", ascending: false })
  if (error) return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
  if (loading)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading news articles…
      </p>
    )
  if (projects.length === 0)
    return (
      <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-3 text-center">
        <Newspaper className="size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{term ? "No news articles match your search" : "No news articles yet"}</h2>
        {!term && (
          <Button onClick={onCreate}>
            <Plus /> Create a news article
          </Button>
        )}
      </div>
    )
  return (
    <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-label="News articles">
      {projects.map((p) => (
        <li key={p.id} className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push(`/editor/${p.id}`)}
            aria-label={`Open ${p.title}`}
            className="rounded-xl ring-primary transition-shadow hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
          >
            <ProjectThumb src={p.thumbnail} title={p.title} className="rounded-xl shadow-md" />
          </button>
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm leading-snug font-semibold">{p.title}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{p.scheduled_at ? format(new Date(p.scheduled_at), "MMM d · h:mm a") : "Not scheduled"}</span>
                <StatusBadge status={p.status} className="text-[10px]" />
              </div>
            </div>
            <ProjectActionsMenu project={p} actions={actions} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function CreateNewsForm({ initialDay, onDone }: { initialDay: Date; onDone: () => void }) {
  const router = useRouter()
  const [brand, setBrand] = useState<NewsBrand>("pickleplay")
  const templates = newsTemplatesFor(brand)
  const [templateId, setTemplateId] = useState(templates[0].id)
  const template = templates.find((t) => t.id === templateId) ?? templates[0]
  const [headline, setHeadline] = useState("")
  const [caption, setCaption] = useState("")
  const [day, setDay] = useState<Date>(initialDay)
  const times = newsTimesFor(brand)
  const [chosenTime, setTime] = useState<string>(times[0].time)
  // Each brand posts at its own times (Homes.ph CARAGA: 11 AM, 1:30 PM…).
  const time = times.some((t) => t.time === chosenTime) ? chosenTime : times[0].time
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const typed = !!headline.trim()
  const design = useMemo(() => {
    if (!typed) return null
    const choices = newsTemplatesFor(brand)
    return (choices.find((t) => t.id === templateId) ?? choices[0]).build({ headline: headline.trim() })
  }, [typed, headline, templateId, brand])

  const submit = async () => {
    setSubmitted(true)
    if (!typed) return
    setBusy(true)
    try {
      const id = await createNewsArticle({ templateId: template.id, headline, caption, scheduledAt: combineDateTime(toDateInput(day), time) })
      onDone()
      router.push(`/editor/${id}`)
    } catch (e) {
      toast.error("Could not create the news article", { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
    )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      noValidate
      className="flex flex-col"
    >
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-semibold tracking-tight">New news article</DialogTitle>
        <DialogDescription>
          {NEWS_BRANDS.find((b) => b.id === brand)?.name} · {template.size} px. Add the photo in the editor (paste, drop or upload).
        </DialogDescription>
      </DialogHeader>
      <div className={cn("grid gap-6 px-6 py-5", typed ? "md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]" : "")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Brand</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Brand">
              {NEWS_BRANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={brand === b.id}
                  onClick={() => {
                    setBrand(b.id)
                    setTemplateId(newsTemplatesFor(b.id)[0].id)
                  }}
                  className={chip(brand === b.id)}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          {templates.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Template</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Template">
                {templates.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={t.id === template.id} onClick={() => setTemplateId(t.id)} className={chip(t.id === template.id)}>
                    {t.name} <span className="opacity-70">· {t.size}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="news-headline">Headline</Label>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
            <Textarea
              id="news-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Type the news headline"
              aria-invalid={submitted && !typed}
              className="bg-card text-[15px]"
            />
            {submitted && !typed && <p className="text-[13px] text-destructive">Type the headline first.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Posting day and time</Label>
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-fit rounded-lg border p-3">
                <MiniCalendar value={day} onChange={setDay} />
              </div>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Posting time">
                {times.map((t) => (
                  <button key={t.time} type="button" role="radio" aria-checked={time === t.time} onClick={() => setTime(t.time)} className={chip(time === t.time)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="news-caption">Caption</Label>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <Textarea id="news-caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Facebook caption" className="bg-card text-[15px]" />
          </div>
        </div>
        {typed && design && <LivePreview design={design} label="News article preview" />}
      </div>
      <DialogFooter className="mx-0 mb-0 border-t bg-slate-50/80 px-6 py-4 dark:bg-white/[0.03]">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Create news article
        </Button>
      </DialogFooter>
    </form>
  )
}
