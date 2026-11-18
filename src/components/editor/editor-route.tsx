"use client"

import { useParams, useSearchParams } from "next/navigation"
import { ExportProvider } from "@/components/export/export-provider"
import { EditorLoader } from "./editor-loader"

export function EditorRoute() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  // ?look=rentsouq: the Rentsouq.ae version of an FHI poster (from the Poster Maker's Rentsouq.ae tab).
  const look = search.get("look") === "rentsouq" ? "rentsouq" : null
  return (
    <ExportProvider>
      <EditorLoader key={`${id}|${look ?? ""}`} projectId={id} look={look} initialSlideId={search.get("slide")} addCard={search.get("add") === "card"} />
    </ExportProvider>
  )
}
