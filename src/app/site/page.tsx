import { Suspense } from "react"
import type { Metadata } from "next"
import { SiteHome, SiteHomeSkeleton } from "@/components/site/site-home"

export const metadata: Metadata = { title: "Ready to post" }

export default function Page() {
  return (
    <Suspense fallback={<SiteHomeSkeleton />}>
      <SiteHome />
    </Suspense>
  )
}
