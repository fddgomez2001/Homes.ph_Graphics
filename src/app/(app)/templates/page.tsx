import type { Metadata } from "next"
import { TemplatesBrowser } from "@/components/templates/templates-browser"

export const metadata: Metadata = { title: "Templates" }

export default function TemplatesPage() {
  return <TemplatesBrowser />
}
