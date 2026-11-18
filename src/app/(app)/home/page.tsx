import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app-shell/page-skeleton"
import { HomeSwitch } from "@/components/home/home-switch"

export const metadata: Metadata = { title: "Home" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton title="Home" />}>
      <HomeSwitch />
    </Suspense>
  )
}
