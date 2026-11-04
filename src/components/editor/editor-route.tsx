"use client"

import { useParams, useSearchParams } from "next/navigation"
import { ExportProvider } from "@/components/export/export-provider"
import { EditorLoader } from "./editor-loader"

export function EditorRoute() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  return (
    <ExportProvider>
      <EditorLoader key={id} projectId={id} initialSlideId={search.get("slide")} addCard={search.get("add") === "card"} />
    </ExportProvider>
  )
}
