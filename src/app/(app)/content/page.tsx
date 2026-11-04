import type { Metadata } from "next"
import { ContentBrowser } from "@/components/content/content-browser"

export const metadata: Metadata = { title: "All Content" }

export default function Page() {
  return <ContentBrowser title="All Content" />
}
