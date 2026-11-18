import type { Metadata } from "next"
import { SiteShell } from "@/components/site/site-shell"

export const metadata: Metadata = {
  title: "Download the Windows app",
  description: "The newest Homes.ph Graphics desktop app (Homes.ph SocMedSystem) for Windows.",
}

export default function DesktopAppLayout({ children }: LayoutProps<"/graphicdesktopapp">) {
  return <SiteShell subtitle="Windows desktop app">{children}</SiteShell>
}
