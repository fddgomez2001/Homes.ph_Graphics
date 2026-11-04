import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app-shell/page-skeleton"
import { DayBoard } from "@/components/board/day-board"

export const metadata: Metadata = { title: "Day Board" }

export default function BoardPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Day Board" />}>
      <DayBoard />
    </Suspense>
  )
}
