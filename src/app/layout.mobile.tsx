import type { Metadata, Viewport } from "next"
import RootLayout from "./layout"

export const metadata: Metadata = {
  title: "Homes.ph Carousels",
  description: "Homes.ph carousels and news posts ready to post.",
}

// Edge to edge: the page pads itself for the status and navigation bars (pt-safe / pb-safe).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1c" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
}

export default RootLayout
