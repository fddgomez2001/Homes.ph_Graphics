import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app-shell/page-skeleton"
import { HomeGallery } from "@/components/home/home-gallery"

export const metadata: Metadata = { title: "Home" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton title="Home" />}>
      <HomeGallery />
    </Suspense>
  )
}
