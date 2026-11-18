import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app-shell/page-skeleton"
import { PosterMaker } from "@/components/posters/poster-maker"

export const metadata: Metadata = { title: "Poster Maker" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton title="Poster Maker" />}>
      <PosterMaker />
    </Suspense>
  )
}
