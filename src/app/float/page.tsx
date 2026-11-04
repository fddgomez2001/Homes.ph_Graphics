import type { Metadata } from "next"
import { FloatEditor } from "@/components/float/float-editor"

export const metadata: Metadata = { title: "Quick edit" }

/** Content of the Windows app's floating quick-edit window. */
export default function FloatPage() {
  return <FloatEditor />
}
