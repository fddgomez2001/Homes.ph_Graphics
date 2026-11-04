import type { Metadata } from "next"
import { SiteShell } from "@/components/site/site-shell"

export const metadata: Metadata = {
  title: { default: "Homes.ph Carousels", template: "%s · Homes.ph Carousels" },
  description: "Homes.ph carousels ready to post: slides, captions and downloads.",
}

export default function SiteLayout({ children }: LayoutProps<"/site">) {
  return <SiteShell>{children}</SiteShell>
}
