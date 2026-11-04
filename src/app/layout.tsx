import type { Metadata } from "next"
import { ConfirmProvider } from "@/components/confirm-dialog"
import { ThemeSync } from "@/components/theme/theme"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

// Self-hosted fonts. These exact families are also used on the canvas, so the
// editor preview and the exported PNG/JPEG use identical typefaces.
import "@fontsource/inter/300.css"
import "@fontsource/inter/400.css"
import "@fontsource/inter/500.css"
import "@fontsource/inter/600.css"
import "@fontsource/inter/700.css"
import "@fontsource/inter/800.css"
import "@fontsource/inter/900.css"
import "@fontsource/outfit/300.css"
import "@fontsource/outfit/400.css"
import "@fontsource/outfit/500.css"
import "@fontsource/outfit/600.css"
import "@fontsource/outfit/700.css"
import "@fontsource/outfit/800.css"
import "@fontsource/outfit/900.css"
import "@fontsource/plus-jakarta-sans/300.css"
import "@fontsource/plus-jakarta-sans/400.css"
import "@fontsource/plus-jakarta-sans/500.css"
import "@fontsource/plus-jakarta-sans/600.css"
import "@fontsource/plus-jakarta-sans/700.css"
import "@fontsource/plus-jakarta-sans/800.css"
import { IS_MOBILE_APP } from "@/lib/env"
import { THEME_SCRIPT } from "@/lib/theme-script"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Daily Carousel Maker · Homes.ph",
    template: "%s · Daily Carousel Maker",
  },
  description: "Plan, design and export Homes.ph social media carousels.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Dark by default; the head script switches to light before the first paint when that was chosen.
    <html lang="en" className="dark h-full antialiased" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeSync />
        <TooltipProvider delayDuration={300}>
          <ConfirmProvider>{children}</ConfirmProvider>
        </TooltipProvider>
        {/* The phone app: above its bottom tab bar. */}
        <Toaster
          position={IS_MOBILE_APP ? "bottom-center" : "bottom-right"}
          offset={IS_MOBILE_APP ? { bottom: "calc(4.75rem + var(--safe-bottom))" } : undefined}
          mobileOffset={IS_MOBILE_APP ? { bottom: "calc(4.75rem + var(--safe-bottom))" } : undefined}
          richColors
          closeButton={!IS_MOBILE_APP}
        />
      </body>
    </html>
  )
}
