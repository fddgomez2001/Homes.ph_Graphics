import { Suspense } from "react"
import { MobileApp, Splash } from "@/components/mobile/mobile-app"

/** The Android app is this one page (see next.config.ts, MOBILE_BUILD). */
export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <MobileApp />
    </Suspense>
  )
}
