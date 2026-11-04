import type { Metadata } from "next"
import { ContentBrowser } from "@/components/content/content-browser"

export const metadata: Metadata = { title: "Published" }

export default function Page() {
  return <ContentBrowser title="Published" fixedStatus="published" />
}
