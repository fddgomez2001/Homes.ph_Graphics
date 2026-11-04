import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app-shell/page-skeleton"
import { DailyReportPage } from "@/components/report/daily-report-page"

export const metadata: Metadata = { title: "Daily Report" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton title="Daily Report" />}>
      <DailyReportPage />
    </Suspense>
  )
}
