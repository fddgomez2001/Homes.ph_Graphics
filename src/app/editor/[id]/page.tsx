import { Suspense } from "react"
import type { Metadata } from "next"
import { EditorSkeleton } from "@/components/editor/editor-loader"
import { EditorRoute } from "@/components/editor/editor-route"

export const metadata: Metadata = { title: "Editor" }

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorRoute />
    </Suspense>
  )
}
