import type { Metadata } from "next"
import { ContentBrowser } from "@/components/content/content-browser"

export const metadata: Metadata = { title: "Drafts" }

export default function Page() {
  return <ContentBrowser title="Drafts" fixedStatus="draft" />
}
