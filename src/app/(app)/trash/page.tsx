import type { Metadata } from "next"
import { TrashBrowser } from "@/components/trash/trash-browser"

export const metadata: Metadata = { title: "Trash" }

export default function Page() {
  return <TrashBrowser />
}
