import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app-shell/page-skeleton"
import { AdsPage } from "@/components/ads/ads-page"

export const metadata: Metadata = { title: "Advertisement" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton title="Advertisement" />}>
      <AdsPage />
    </Suspense>
  )
}
