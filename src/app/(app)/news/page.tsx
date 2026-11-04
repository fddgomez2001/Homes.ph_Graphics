import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app-shell/page-skeleton"
import { NewsBrowser } from "@/components/news/news-browser"

export const metadata: Metadata = { title: "News Article" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton title="News Article" />}>
      <NewsBrowser />
    </Suspense>
  )
}
