import type { Metadata } from "next"
import { ContentBrowser } from "@/components/content/content-browser"

export const metadata: Metadata = { title: "Scheduled" }

export default function Page() {
  return <ContentBrowser title="Scheduled" fixedStatus="scheduled" />
}
