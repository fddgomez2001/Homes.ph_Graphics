import type { Metadata } from "next"
import { LibraryBrowser } from "@/components/library/library-browser"

export const metadata: Metadata = { title: "Image Library" }

export default function LibraryPage() {
  return <LibraryBrowser />
}
