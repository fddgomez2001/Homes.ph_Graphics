import { Suspense } from "react"
import type { Metadata } from "next"
import { ChecklistWindow } from "@/components/posting/checklist-window"

export const metadata: Metadata = { title: "Posting checklist" }

/** The floating posting checklist (its own small window, on top while posting). */
export default function ChecklistPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-background" />}>
      <ChecklistWindow />
    </Suspense>
  )
}
