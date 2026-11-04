import { Suspense } from "react"
import type { Metadata } from "next"
import { CalendarView } from "@/components/calendar/calendar-view"
import { PageSkeleton } from "@/components/app-shell/page-skeleton"

export const metadata: Metadata = { title: "Calendar" }

export default function CalendarPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Calendar" />}>
      <CalendarView />
    </Suspense>
  )
}
