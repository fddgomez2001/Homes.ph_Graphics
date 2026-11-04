import { addDays, differenceInCalendarDays, format, isValid, parse, startOfDay } from "date-fns"

/** New carousels go out at 11:00 PM unless another time is chosen. */
export const DEFAULT_PUBLISH_TIME = "23:00"

export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  return isValid(d) ? format(d, "yyyy-MM-dd") : ""
}

export function toTimeInput(date: Date | string | null | undefined): string {
  if (!date) return DEFAULT_PUBLISH_TIME
  const d = typeof date === "string" ? new Date(date) : date
  return isValid(d) ? format(d, "HH:mm") : DEFAULT_PUBLISH_TIME
}

/** Local date ("yyyy-MM-dd") + time ("HH:mm") → ISO timestamp, or null. */
export function combineDateTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr) return null
  const d = parse(`${dateStr} ${timeStr || DEFAULT_PUBLISH_TIME}`, "yyyy-MM-dd HH:mm", new Date())
  return isValid(d) ? d.toISOString() : null
}

/** Moves a timestamp to another day, keeping its local time of day. */
export function moveToDay(current: string | null, day: Date): string {
  const time = toTimeInput(current)
  return combineDateTime(format(day, "yyyy-MM-dd"), time)!
}

/**
 * One carousel a day: the first day from `from` that has no carousel yet and
 * whose publish time hasn't passed (Oct 30 – Nov 3 taken → Nov 4).
 */
export function nextFreeDay(scheduled: (string | null | undefined)[], from = new Date(), time = DEFAULT_PUBLISH_TIME): Date {
  const taken = new Set(scheduled.filter((iso): iso is string => !!iso).map((iso) => format(new Date(iso), "yyyy-MM-dd")))
  let day = startOfDay(from)
  for (let i = 0; i < 3660; i++, day = addDays(day, 1)) {
    const key = format(day, "yyyy-MM-dd")
    const at = combineDateTime(key, time)
    if (!taken.has(key) && at && new Date(at) > from) return day
  }
  return startOfDay(from)
}

export type MadeTiming = { kind: "early"; days: number } | { kind: "on-the-day" } | { kind: "late" }

/** Made ahead of its posting day, on the day itself, or after its posting time. */
export function madeTiming(createdAt: string | null | undefined, scheduledAt: string | null | undefined): MadeTiming | null {
  if (!createdAt || !scheduledAt) return null
  const made = new Date(createdAt)
  const due = new Date(scheduledAt)
  if (!isValid(made) || !isValid(due)) return null
  if (made > due) return { kind: "late" }
  const days = differenceInCalendarDays(due, made)
  return days > 0 ? { kind: "early", days } : { kind: "on-the-day" }
}

export function madeTimingLabel(timing: MadeTiming): string {
  if (timing.kind === "late") return "Made late"
  if (timing.kind === "on-the-day") return "Made on the day"
  return `Made early · ${timing.days} day${timing.days === 1 ? "" : "s"} ahead`
}

/** "Fri, Oct 30 · 9:12 AM" for a posted time (empty when unknown). */
export function formatPosted(value: string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  return isValid(d) ? format(d, "EEE, MMM d · h:mm a") : ""
}

export function formatSchedule(value: string | null): string {
  if (!value) return "No date"
  const d = new Date(value)
  return isValid(d) ? format(d, "EEE, MMM d · h:mm a") : "No date"
}
