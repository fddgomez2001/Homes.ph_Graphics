import { Suspense } from "react"
import type { Metadata } from "next"
import { ReportFloat } from "@/components/report/report-float"

export const metadata: Metadata = { title: "Floating report" }

/** The floating report (its own small window, on top while writing the daily report). */
export default function ReportFloatPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-background" />}>
      <ReportFloat />
    </Suspense>
  )
}
