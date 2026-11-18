import type { Metadata } from "next"
import { WelcomeWizard } from "./welcome-wizard"

export const metadata: Metadata = { title: "Welcome" }

/** The desktop app's first start: welcome, the person's own AI, and where the work is saved. */
export default function WelcomePage() {
  return <WelcomeWizard />
}
