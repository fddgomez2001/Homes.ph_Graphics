"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns"
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, Loader2, PencilLine, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { AD_BRAND_NAME, adTimeLabel, toMinutes } from "@/lib/ads/schedule-time"
import { adStatus, deleteAd, type ScheduledAdSummary } from "@/lib/ads/scheduled"
import { cn, errorMessage } from "@/lib/utils"
import { dayKeyOf, dayOfKey, useClock, useScheduledAds } from "./ad-schedule"

const OPEN_KEY = "dcm-ads-calendar-open"
const noSubscribe = () => () => {}
function storedOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0"
  } catch {
    return true
  }
}

/**
 * The Advertisement calendar: a month with each day's number of scheduled ads (a green mark when
 * every one is on Facebook), and the chosen day's ads by time with their status, Edit and Delete.
 */
export function AdsCalendar({ editingId, onEdit }: { editingId: string | null; onEdit: (ad: ScheduledAdSummary) => void }) {
  const { today, minutes } = useClock()
  const [picked, setPicked] = useState<string | null>(null)
  const day = picked ?? today
  const [month, setMonth] = useState<Date | null>(null)
  const cursor = month ?? startOfMonth(dayOfKey(day))
  const days = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(endOfMonth(cursor)) })
  const { ads } = useScheduledAds(dayKeyOf(days[0]), dayKeyOf(days[days.length - 1]))
  const { ads: dayAds, error } = useScheduledAds(day, day)
  const { ads: todayAds } = useScheduledAds(today, today)
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledAdSummary[]>()
    for (const a of ads ?? []) map.set(a.day, [...(map.get(a.day) ?? []), a])
    return map
  }, [ads])
  const stored = useSyncExternalStore(noSubscribe, storedOpen, () => true)
  const [openState, setOpenState] = useState<boolean | null>(null)
  const open = openState ?? stored
  const toggle = () => {
    setOpenState(!open)
    try {
      localStorage.setItem(OPEN_KEY, open ? "0" : "1")
    } catch {
      // remembered until the page closes
    }
  }

  const pick = (key: string) => {
    setPicked(key === today ? null : key)
    if (!isSameMonth(dayOfKey(key), cursor)) setMonth(startOfMonth(dayOfKey(key)))
  }
  const todayCount = todayAds?.length ?? 0
  const todayDone = (todayAds ?? []).filter((a) => adStatus(a).done).length

  return (
    <section className="rounded-xl border bg-card" aria-label="Advertisement calendar">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <CalendarDays className="size-4 text-primary" />
        <span className="text-sm font-semibold">Advertisement calendar</span>
        <span className="text-xs text-muted-foreground">
          · Today: {todayCount ? `${todayCount} ad${todayCount === 1 ? "" : "s"}, ${todayDone} on Facebook` : "no ads scheduled"}
        </span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid gap-4 border-t p-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="select-none">
            <div className="mb-2 flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Previous month" onClick={() => setMonth(addMonths(cursor, -1))}>
                <ChevronLeft />
              </Button>
              <span className="flex-1 text-center text-sm font-semibold" aria-live="polite">
                {format(cursor, "MMMM yyyy")}
              </span>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Next month" onClick={() => setMonth(addMonths(cursor, 1))}>
                <ChevronRight />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={day === today && isSameMonth(cursor, dayOfKey(today))}
                onClick={() => {
                  setPicked(null)
                  setMonth(null)
                }}
              >
                Today
              </Button>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {days.slice(0, 7).map((d) => (
                <div key={d.toISOString()} className="py-1">
                  {format(d, "EEEEEE")}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Choose a day">
              {days.map((d) => {
                const key = dayKeyOf(d)
                const list = byDay.get(key) ?? []
                const done = list.length > 0 && list.every((a) => adStatus(a).done)
                const selected = key === day
                const isToday = key === today
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    aria-selected={selected}
                    aria-label={`${format(d, "EEEE, MMMM d")}${list.length ? `: ${list.length} ad${list.length === 1 ? "" : "s"}${done ? ", all on Facebook" : ""}` : ""}`}
                    onClick={() => pick(key)}
                    className={cn(
                      "relative flex h-14 flex-col items-center justify-start gap-0.5 rounded-lg border pt-1 text-sm tabular-nums transition-colors",
                      isSameMonth(d, cursor) ? "border-transparent hover:bg-muted" : "border-transparent text-muted-foreground/50 hover:bg-muted/50",
                      isToday && !selected && "border-primary/50 font-semibold text-primary",
                      selected && "border-primary bg-primary/10 font-semibold",
                    )}
                  >
                    <span className={cn("flex size-6 items-center justify-center rounded-full", isToday && "bg-primary text-primary-foreground")}>{format(d, "d")}</span>
                    {list.length > 0 && (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 rounded-full px-1.5 text-[10px] leading-4 font-bold",
                          done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-[#B6F23A]/40 text-[#091B5C] dark:bg-[#B6F23A]/20 dark:text-[#d6f88f]",
                        )}
                      >
                        {done && <Check className="size-2.5" strokeWidth={3} />}
                        {list.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <DayAds day={day} today={today} nowMinutes={minutes} ads={dayAds} error={error} editingId={editingId} onEdit={onEdit} />
        </div>
      )}
    </section>
  )
}

function DayAds({
  day,
  today,
  nowMinutes,
  ads,
  error,
  editingId,
  onEdit,
}: {
  day: string
  today: string
  nowMinutes: number
  ads: ScheduledAdSummary[] | null
  error: string | null
  editingId: string | null
  onEdit: (ad: ScheduledAdSummary) => void
}) {
  const confirm = useConfirm()
  const date = dayOfKey(day)
  const done = (ads ?? []).filter((a) => adStatus(a).done).length
  const passed = (a: ScheduledAdSummary) => day < today || (day === today && (toMinutes(a.time) ?? 0) <= nowMinutes)

  const remove = async (ad: ScheduledAdSummary) => {
    const status = adStatus(ad)
    const ok = await confirm({
      title: `Delete the ${adTimeLabel(ad.time)} ${ad.kindLabel} ad?`,
      description: status.done
        ? `It's already ${ad.facebook === "posted" ? "posted" : "scheduled"} on Facebook: deleting it here doesn't remove the Facebook post.`
        : "It's removed from the calendar and the Chrome extension won't post it.",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteAd(ad.id)
      toast.success(`Deleted the ${adTimeLabel(ad.time)} ${ad.kindLabel} ad`)
    } catch (e) {
      toast.error("Couldn't delete the ad", { description: errorMessage(e) })
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {day === today ? "Today" : format(date, "EEEE")} <span className="font-normal text-muted-foreground">· {format(date, "MMMM d, yyyy")}</span>
        </h3>
        {ads && ads.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {done}/{ads.length} on Facebook
          </span>
        )}
      </div>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {!ads ? (
        !error && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        )
      ) : ads.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No advertisements on this day. Make one below and press <span className="font-medium text-foreground">Schedule</span>.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {ads.map((ad) => {
            const status = adStatus(ad)
            const editing = ad.id === editingId
            return (
              <li key={ad.id} className={cn("flex items-center gap-3 rounded-xl border bg-background/60 p-2", editing && "border-primary ring-2 ring-primary/25")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ad.thumb} alt="" className="size-14 shrink-0 rounded-md border object-cover" draggable={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold tabular-nums">{adTimeLabel(ad.time)}</span>
                    <span className="rounded bg-muted px-1.5 text-[11px] font-medium">
                      {AD_BRAND_NAME[ad.brand]} {ad.kindLabel}
                    </span>
                    {editing && <span className="text-[11px] font-medium text-primary">Editing</span>}
                  </div>
                  <p className="truncate text-sm" title={ad.title}>
                    {ad.title}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                    {ad.facebook === "posted" ? (
                      <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                        <Check className="size-3" strokeWidth={3} /> Posted
                      </span>
                    ) : ad.facebook === "scheduled" ? (
                      <span className="flex items-center gap-1 font-medium text-sky-700 dark:text-sky-400">
                        <Send className="size-3" /> Scheduled on Facebook
                      </span>
                    ) : (
                      <span className={cn("flex items-center gap-1 font-medium", passed(ad) ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                        <CircleDashed className="size-3" /> To post{passed(ad) ? " · its time has passed" : ""}
                      </span>
                    )}
                    {status.changedSince && <span className="text-amber-700 dark:text-amber-400">Changed after it went to Facebook</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => onEdit(ad)}
                    disabled={ad.brand !== "pickleplay"}
                    title={ad.brand === "pickleplay" ? "Open it in the editor below" : "Only PicklePlay PH ads can be edited for now"}
                  >
                    <PencilLine /> Edit
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Delete the ${adTimeLabel(ad.time)} ${ad.kindLabel} ad`} onClick={() => void remove(ad)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
