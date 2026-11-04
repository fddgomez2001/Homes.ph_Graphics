import { Suspense } from "react"
import type { Metadata } from "next"
import { SiteCarousel, SiteCarouselSkeleton } from "@/components/site/site-carousel"

export const metadata: Metadata = { title: "Carousel" }

export default function Page() {
  return (
    <Suspense fallback={<SiteCarouselSkeleton />}>
      <SiteCarousel />
    </Suspense>
  )
}
