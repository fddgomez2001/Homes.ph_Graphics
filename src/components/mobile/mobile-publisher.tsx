"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ExternalLink, Loader2, LogIn, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { publisherAvailable, startPublisher, watchPublisher, type Publisher, type PublisherTabs } from "@/lib/publisher/host"
import { errorMessage } from "@/lib/utils"

/** The sites the Publisher works on: signed in to once, inside the app. */
const SITES = [
  { name: "dash.homes.ph", hint: "the posts boards", url: "https://dash.homes.ph/" },
  { name: "homes.ph", hint: "Facebook Autopost", url: "https://homes.ph/dashboard/admin/facebook-autopost" },
  { name: "dtr.homes.ph", hint: "My Tasks", url: "https://dtr.homes.ph/m/tasks" },
  { name: "Messenger", hint: "the report chat", url: "https://www.messenger.com/" },
]

/**
 * The panel is the extension's own (same tabs, same buttons, same order); on a phone it fills the screen,
 * its text and buttons are bigger, and the list scrolls with the page instead of inside a small box.
 */
const PHONE_CSS = `
  .hp-phone { background: #fff; color-scheme: light; }
  .hp-phone .hp-panel { width: 100%; max-width: none; border: 0; border-radius: 0; box-shadow: none; zoom: 1.16; }
  .hp-phone .hp-body { max-height: none; overflow: visible; padding-bottom: 14px; }
  .hp-phone .hp-icon { width: 40px; height: 40px; font-size: 19px; }
  .hp-phone .hp-tabs { overflow-x: auto; scrollbar-width: none; }
  .hp-phone .hp-tab { padding: 10px 8px 11px; white-space: nowrap; }
  .hp-phone .hp-day { min-width: 38px; height: 34px; }
  .hp-phone .hp-pill, .hp-phone .hp-rpill { min-height: 32px; box-sizing: border-box; }
  .hp-phone .hp-btn, .hp-phone .hp-gbtn { min-height: 34px; padding: 6px 12px; box-sizing: border-box; justify-content: center; }
  .hp-phone .hp-past button { min-height: 28px; padding: 4px 10px; box-sizing: border-box; }
  .hp-phone .hp-mark { width: 30px; height: 30px; }
  .hp-phone .hp-start { padding: 14px 12px; }
  .hp-phone .hp-logo, .hp-phone .hp-car-logo { width: 44px; height: 44px; }
  .hp-phone input, .hp-phone textarea, .hp-phone select { font-size: 14px; }
  .hp-phone .hp-foot { padding-bottom: 14px; }
  .hp-phone button, .hp-phone a, .hp-phone label { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
`

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "page"
  } catch {
    return "page"
  }
}

/**
 * The phone app's Publisher tab: everything the Homes.ph Publisher Chrome extension does (Posting, Trending,
 * Ads, Quotes, Reports), with the same steps. The pages it works on open inside the app, over this tab.
 */
export function MobilePublisher() {
  const root = useRef<HTMLDivElement>(null)
  const [publisher, setPublisher] = useState<Publisher | null>(null)
  const [error, setError] = useState("")
  const [pages, setPages] = useState<PublisherTabs>({ tabs: [], shown: -1 })
  const [options, setOptions] = useState(false)
  const native = publisherAvailable()

  useEffect(() => {
    let gone = false
    let panel: { destroy(): void } | null = null
    startPublisher()
      .then((p) => {
        if (gone || !root.current) return
        setPublisher(p)
        let css = document.getElementById("hp-phone-css")
        if (!css) {
          css = Object.assign(document.createElement("style"), { id: "hp-phone-css" })
          document.head.appendChild(css)
        }
        css.textContent = p.HP.PANEL_CSS + PHONE_CSS
        panel = p.HP.mountPanel(root.current, {})
      })
      .catch((e) => !gone && setError(errorMessage(e)))
    const off = watchPublisher({ tabs: setPages, options: () => setOptions(true) })
    return () => {
      gone = true
      off()
      panel?.destroy()
    }
  }, [])

  const open = pages.tabs.filter((t) => t.tabId !== pages.shown)

  return (
    <div className="mx-auto w-full max-w-2xl pb-6">
      {!native && (
        <p className="flex items-start gap-2 border-b bg-amber-500/15 px-4 py-2.5 text-[13px] text-amber-900 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> The Publisher opens its pages inside the phone app only. Here you can look at the panel.
        </p>
      )}
      {open.length > 0 && publisher && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-primary/8 px-4 py-2.5">
          <span className="text-[13px] font-medium text-muted-foreground">Open {open.length === 1 ? "page" : "pages"}:</span>
          {open.map((t) => (
            <Button key={t.tabId} size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => void publisher.show(t.tabId)}>
              <ExternalLink className="size-4" /> {hostOf(t.url)}
            </Button>
          ))}
        </div>
      )}

      {error ? (
        <p role="alert" className="m-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          The Publisher didn’t start: {error}
        </p>
      ) : (
        !publisher && (
          <p role="status" className="flex items-center gap-3 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Starting the Publisher…
          </p>
        )
      )}
      {/* The extension's panel draws itself in here. */}
      <div ref={root} className="hp-phone" />

      {publisher && (
        <details className="mx-4 mt-4 rounded-xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-[15px] font-medium select-none">
            <LogIn className="size-4.5 text-muted-foreground" /> Sign in to the sites
          </summary>
          <div className="border-t px-4 py-3">
            <p className="mb-3 text-[13px] leading-snug text-muted-foreground">
              Sign in once to each site, here in the app. The Publisher then works on them like the Chrome extension does: you check, and you tap Schedule Post.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SITES.map((site) => (
                <Button key={site.url} variant="outline" className="h-auto min-h-12 flex-col items-start gap-0 px-3 py-2 text-left" disabled={!native} onClick={() => void publisher.open(site.url)}>
                  <span className="text-[14px] font-semibold">{site.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{site.hint}</span>
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-snug text-muted-foreground">
              The pages look like on a computer (pinch to zoom). Advertisements stay on the computer they were made on, so the Ads tab is empty on the phone.
            </p>
          </div>
        </details>
      )}

      {options && <OptionsSheet onClose={() => setOptions(false)} />}
    </div>
  )
}

/** The extension's Options page (brands, boards, how it works), over the tab. */
function OptionsSheet({ onClose }: { onClose: () => void }) {
  // Android's Back closes it (the app sends Escape to an open dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label="Publisher options" data-state="open" className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="pt-safe border-b border-border/70 bg-card">
        <div className="flex h-14 items-center gap-1 px-2">
          <Button variant="ghost" className="h-10 gap-1.5 px-2.5 text-[15px]" onClick={onClose}>
            <ArrowLeft className="size-5" /> Publisher
          </Button>
        </div>
      </header>
      <iframe title="Publisher options" src="/publisher/options.html" className="pb-safe min-h-0 w-full flex-1 border-0 bg-white" />
    </div>
  )
}
