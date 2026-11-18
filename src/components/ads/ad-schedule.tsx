"use client"

import { useEffect, useMemo, useState } from "react"
import { format, parse } from "date-fns"
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarPlus, Check, Loader2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loadTrendPosters } from "@/lib/data/report"
import { newsTimesFor } from "@/lib/design/news-templates"
import {
  AD_BRAND_NAME,
  AD_NEWS_BRAND,
  adTimeLabel,
  adTimeProblem,
  adTimeWarning,
  nearestAdTime,
  recommendAdTimes,
  type AdBrand,
  type AdTimeContext,
  type AdTimeProblem,
} from "@/lib/ads/schedule-time"
import { listAds, subscribeAds, type ScheduledAdSummary } from "@/lib/ads/scheduled"
import { trendEntries } from "@/lib/report/trend-news"
import { cn, errorMessage } from "@/lib/utils"

/** "2026-11-12" */
export const dayKeyOf = (d: Date) => format(d, "yyyy-MM-dd")
export const dayOfKey = (key: string) => parse(key, "yyyy-MM-dd", new Date())

const stampNow = () => format(new Date(), "yyyy-MM-dd HH:mm")

/** Today ("2026-11-12") and the minute now (810 = 1:30 PM): a new render only when the minute changes. */
export function useClock(): { today: string; minutes: number } {
  const [stamp, setStamp] = useState(stampNow)
  useEffect(() => {
    const timer = setInterval(() => setStamp(stampNow()), 15_000)
    return () => clearInterval(timer)
  }, [])
  const [today, hm] = stamp.split(" ")
  return { today, minutes: Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) }
}

/** The scheduled ads from `fromDay` to `toDay` (light rows, by day and time), fresh after any change; null while loading. */
export function useScheduledAds(fromDay: string, toDay: string): { ads: ScheduledAdSummary[] | null; error: string | null } {
  const key = `${fromDay}|${toDay}`
  const [data, setData] = useState<{ key: string; ads: ScheduledAdSummary[] } | null>(null)
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      listAds(fromDay, toDay).then(
        (ads) => {
          if (!live) return
          setData({ key, ads })
          setError(null)
        },
        (e) => {
          if (live) setError({ key, message: errorMessage(e) })
        },
      )
    void load()
    const off = subscribeAds(() => void load())
    return () => {
      live = false
      off()
    }
  }, [fromDay, toDay, key])
  return { ads: data?.key === key ? data.ads : null, error: error?.key === key ? error.message : null }
}

/** The Daily Trend News group of an Advertisement brand (Homes.ph ads: the Homes.ph CARAGA posters). */
const TREND_GROUP: Record<AdBrand, string> = { pickleplay: "pickleplay", fhi: "fhi", homes: "caraga", gensan: "gensan" }

/** The brand's Poster Maker trend posters on a day (for a warning only; none when they can't be read). */
function useBrandPosters(day: string, brand: AdBrand): { time: string; label: string }[] {
  const key = `${day}|${brand}`
  const [data, setData] = useState<{ key: string; posters: { time: string; label: string }[] } | null>(null)
  useEffect(() => {
    let live = true
    loadTrendPosters(dayOfKey(day))
      .then((posters) =>
        trendEntries(posters)
          .filter((e) => e.group === TREND_GROUP[brand] && e.poster.time)
          .map((e) => ({ time: e.poster.time, label: `${e.label} trend poster` })),
      )
      .catch(() => [])
      .then((posters) => {
        if (live) setData({ key, posters })
      })
    return () => {
      live = false
    }
  }, [day, brand, key])
  return data?.key === key ? data.posters : []
}

export interface AdTimeCheck {
  /** The time the ad would get: the one typed or picked, else the best one ("" when none is free). */
  time: string
  /** Best first. */
  recommended: string[]
  problem: AdTimeProblem | null
  warning: string | null
  /** The OK time nearest to a time that has a problem. */
  nearest: string | null
  /** The brand's other ads that day (not the one being edited). */
  others: ScheduledAdSummary[]
  posters: { time: string; label: string }[]
  loading: boolean
}

/**
 * The time rule for an ad on a day: the recommended times (best first), and what's wrong with the
 * time typed or picked (`typed`, null = take the best). `editing`: the ad being changed (not counted,
 * and its own day and time stay allowed).
 */
export function useAdTimeCheck({ brand, day, typed, editing }: { brand: AdBrand; day: string; typed: string | null; editing: Pick<ScheduledAdSummary, "id" | "day" | "time"> | null }): AdTimeCheck {
  const { today, minutes: nowMinutes } = useClock()
  const { ads } = useScheduledAds(day, day)
  const posters = useBrandPosters(day, brand)
  const editingId = editing?.id ?? null
  const others = useMemo(() => (ads ?? []).filter((a) => a.brand === brand && a.id !== editingId), [ads, brand, editingId])
  const ctx = useMemo<AdTimeContext>(
    () => ({ brand, ads: others.map((a) => ({ time: a.time, label: a.kindLabel })), posters, now: day === today ? nowMinutes : day < today ? 1440 : null }),
    [brand, others, posters, day, today, nowMinutes],
  )
  const recommended = useMemo(() => recommendAdTimes(ctx), [ctx])
  const time = typed ?? recommended[0] ?? ""
  // An ad being edited keeps its own day and time (they were checked when it was scheduled).
  const kept = !!editing && editing.day === day && editing.time === time
  const problem: AdTimeProblem | null = !time ? { reason: "invalid", message: "No free time left on this day: pick another day" } : kept ? null : adTimeProblem(time, ctx)
  return {
    time,
    recommended,
    problem,
    warning: time ? adTimeWarning(time, ctx) : null,
    nearest: problem && time ? nearestAdTime(time, ctx) : null,
    others,
    posters,
    loading: ads === null,
  }
}

/**
 * The Schedule card: the day and time (the best time picked by default), the recommended times,
 * why a time can't be used (and the nearest one that can), and Schedule, or Save changes / Cancel
 * while an ad is edited.
 */
export function AdScheduleCard({
  brand,
  day,
  check,
  onDay,
  onTime,
  editing,
  blocked,
  busy,
  onSchedule,
  onSave,
  onCancel,
}: {
  brand: AdBrand
  day: string
  check: AdTimeCheck
  onDay: (day: string) => void
  onTime: (time: string) => void
  editing: Pick<ScheduledAdSummary, "day" | "time"> | null
  /** Why it can't be scheduled yet (e.g. still the sample text). */
  blocked: string | null
  busy: boolean
  onSchedule: () => void
  onSave: () => void
  onCancel: () => void
}) {
  const { today } = useClock()
  const name = AD_BRAND_NAME[brand]
  const articles = newsTimesFor(AD_NEWS_BRAND[brand])
  const chips = [...check.recommended].sort((a, b) => a.localeCompare(b))
  const best = check.recommended[0]
  const taken = [
    ...articles.map((t) => ({ time: t.time, label: "article", tone: "article" as const })),
    ...check.others.map((a) => ({ time: a.time, label: `${a.kindLabel} ad`, tone: "ad" as const })),
    ...check.posters.map((p) => ({ time: p.time, label: "trend poster", tone: "poster" as const })),
  ].sort((a, b) => a.time.localeCompare(b.time))
  const canGo = !check.problem && !blocked && !busy && !!check.time
  const min = editing && editing.day < today ? editing.day : today

  return (
    <section className="mx-auto flex w-full max-w-[720px] flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Schedule">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="size-4" /> {editing ? "When it posts" : "Schedule"}
        </h2>
        <span className="text-xs text-muted-foreground">Keeps 1 hour from {name}&apos;s articles and other ads</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ad-day" className="text-xs">
            Day
          </Label>
          <Input id="ad-day" type="date" value={day} min={min} onChange={(e) => e.target.value && onDay(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ad-time" className="text-xs">
            Time
          </Label>
          <Input id="ad-time" type="time" step={300} value={check.time} onChange={(e) => e.target.value && onTime(e.target.value)} className="w-32" aria-invalid={!!check.problem} />
        </div>
        {check.loading && <Loader2 className="mb-2.5 size-4 animate-spin text-muted-foreground" aria-label="Checking the day" />}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Recommended</span>
        {chips.length ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Recommended times">
            {chips.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTime(t)}
                aria-pressed={check.time === t}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                  check.time === t ? "border-primary bg-primary text-primary-foreground" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300",
                )}
              >
                {adTimeLabel(t)}
                {t === best && <span className={cn("rounded-full px-1.5 text-[10px] font-bold uppercase", check.time === t ? "bg-white/20" : "bg-emerald-600 text-white")}>Best</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No free time left on this day. Pick another day.</p>
        )}
      </div>

      {check.problem ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{check.problem.message}.</span>
          {check.nearest && (
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onTime(check.nearest!)}>
              Use {adTimeLabel(check.nearest)}
            </Button>
          )}
        </div>
      ) : check.time ? (
        <p className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <Check className="mt-0.5 size-3.5 shrink-0" /> {adTimeLabel(check.time)} is at least 1 hour from {name}&apos;s articles{check.others.length ? " and its other ads" : ""} that day.
        </p>
      ) : null}
      {check.warning && !check.problem && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {check.warning}.
        </p>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Already on {day === today ? "today" : format(dayOfKey(day), "MMM d")}</span>
        <div className="flex flex-wrap gap-1" aria-label="Times already taken">
          {taken.map((t, i) => (
            <span
              key={`${t.time}-${t.label}-${i}`}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
                t.tone === "article" && "bg-muted text-muted-foreground",
                t.tone === "ad" && "bg-[#B6F23A]/30 text-[#091B5C] dark:bg-[#B6F23A]/15 dark:text-[#d6f88f]",
                t.tone === "poster" && "bg-violet-500/12 text-violet-800 dark:text-violet-300",
              )}
            >
              {adTimeLabel(t.time)} {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {editing ? (
          <>
            <Button type="button" onClick={onSave} disabled={!canGo}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />} Save changes
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              <X /> Cancel
            </Button>
          </>
        ) : (
          <Button type="button" onClick={onSchedule} disabled={!canGo} className="bg-[#B6F23A] text-[#091B5C] hover:bg-[#a6e02c]">
            {busy ? <Loader2 className="animate-spin" /> : <CalendarPlus />} Schedule{check.time && !check.problem ? ` for ${adTimeLabel(check.time)}` : ""}
          </Button>
        )}
        {blocked ? (
          <span className="text-xs text-muted-foreground">{blocked}</span>
        ) : (
          !editing &&
          check.time &&
          !check.problem && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarCheck className="size-3.5" /> {day === today ? "Today" : format(dayOfKey(day), "EEE, MMM d")} · shows on the calendar above
            </span>
          )
        )}
      </div>
    </section>
  )
}
