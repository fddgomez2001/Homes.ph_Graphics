"use client"

import { useMemo } from "react"
import Link from "next/link"
import { addDays, format, startOfDay } from "date-fns"
import { ArrowRight, CheckCircle2, ClipboardList, Frame, Images, Megaphone, Newspaper, Settings2, type LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { useProjectSlides } from "@/components/board/slide-renders"
import { useProjects } from "@/components/projects/use-projects"
import { useAssignment } from "@/lib/assignment"
import { newsHeadline } from "@/lib/data/news"
import { isPosterTemplate } from "@/lib/design/news-templates"
import { NEWS_HEADLINE_PLACEHOLDER } from "@/lib/design/templates"
import { newsLane, slotKeyOf } from "@/lib/news-lanes"
import { assignedPageIds } from "@/lib/pages"
import { cn } from "@/lib/utils"

const ACTIONS: { href: string; label: string; text: string; icon: LucideIcon }[] = [
  { href: "/news", label: "News Article", text: "Today's posts for your pages", icon: Newspaper },
  { href: "/posters", label: "Poster Maker", text: "Posters and Daily Trend News", icon: Frame },
  { href: "/ads", label: "Advertisement", text: "Ads, trivia and fun facts", icon: Megaphone },
  { href: "/report", label: "Daily Report", text: "What was posted today", icon: ClipboardList },
  { href: "/library", label: "Image Library", text: "Your photos", icon: Images },
  { href: "/settings#assigned-pages", label: "Assigned pages", text: "Change your pages", icon: Settings2 },
]

/**
 * Home for people who don't make the carousel (Settings → Assigned pages → Carousel off): today's work on each
 * assigned page at a glance, and buttons to the other pages.
 */
export function HomeDashboard() {
  const { assignment } = useAssignment()
  const pages = useMemo(() => assignedPageIds(assignment), [assignment])
  const today = startOfDay(new Date())
  const { projects, loading } = useProjects({ kind: "news", from: today.toISOString(), to: addDays(today, 1).toISOString(), orderBy: "scheduled_at", ascending: true, limit: 300 })
  const slides = useProjectSlides(projects)

  // Ready = a headline and a photo, in one of the page's posting times.
  const { ready, posters } = useMemo(() => {
    const ready = new Map<string, number>()
    let posters = 0
    for (const p of projects) {
      const design = slides.get(p.id)?.[0]?.design
      if (!design) continue
      if (isPosterTemplate(design.templateId)) {
        posters++
        continue
      }
      const key = slotKeyOf(design, p.scheduled_at)
      const headline = newsHeadline(design)
      const photo = design.elements.some((e) => e.type === "image" && e.role === "background" && e.src)
      if (!key || !photo || !headline.trim() || headline === NEWS_HEADLINE_PLACEHOLDER) continue
      const page = key.split("@")[0]
      ready.set(page, (ready.get(page) ?? 0) + 1)
    }
    return { ready, posters }
  }, [projects, slides])

  const lanes = pages.map(newsLane)
  const slotsTotal = lanes.reduce((n, l) => n + l.times.length, 0)
  const readyTotal = [...ready.values()].reduce((a, b) => a + b, 0)

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Home" description={`Your pages today · ${format(today, "EEEE, MMMM d")}`} />
      <div className="flex flex-col gap-8 px-4 py-6 lg:px-8">
        <section aria-label="Today at a glance" className="grid gap-3 sm:grid-cols-3">
          <Stat label="News posts ready today" value={loading ? "…" : `${readyTotal}/${slotsTotal}`} hint={slotsTotal ? `${Math.max(0, slotsTotal - readyTotal)} still to make` : "No News Article pages"} />
          <Stat label="Posters today" value={loading ? "…" : String(posters)} hint="Poster Maker and Daily Trend News" />
          <Stat label="Assigned pages" value={String(pages.length)} hint={pages.length ? lanes.map((l) => l.name.replace(/^Homes\.ph /, "")).slice(0, 4).join(", ") + (pages.length > 4 ? "…" : "") : "None yet"} />
        </section>

        <section aria-label="Quick actions">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Go to</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIONS.map(({ href, label, text, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{text}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {lanes.length > 0 && (
          <section aria-label="Your pages today">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Your pages today</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {lanes.map((lane) => {
                const done = ready.get(lane.id) ?? 0
                const total = lane.times.length
                const all = total > 0 && done >= total
                return (
                  <li key={lane.id}>
                    <Link href={`/news?page=${lane.id}`} className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{lane.name}</span>
                        {all && <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                      </span>
                      {total ? (
                        <>
                          <span className="text-2xl font-semibold tabular-nums">
                            {loading ? "…" : done}
                            <span className="text-sm font-normal text-muted-foreground">/{total} posts ready</span>
                          </span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <span className={cn("block h-full rounded-full", all ? "bg-emerald-500" : "bg-primary")} style={{ width: `${Math.min(100, (done / total) * 100)}%` }} />
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">No News Article template yet: posted from the dash.</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}
