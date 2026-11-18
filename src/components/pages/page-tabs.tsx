"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Settings2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { pageName, pageTabs, parsePageId, tabOfPage, type PageId } from "@/lib/pages"
import { cn } from "@/lib/utils"

/**
 * The assigned pages as a navigation bar (News Article, Poster Maker, Advertisement): one Homes.ph tab (a dropdown
 * of the Homes.ph pages when there are several, the page's own name when there's one), then each site.
 */
export function PageTabs({
  pages,
  value,
  onChange,
  label = "Pages",
  dot,
  className,
}: {
  pages: readonly PageId[]
  value: PageId
  onChange: (page: PageId) => void
  label?: string
  /** A small colored dot or count per page (e.g. how many posts are ready). */
  dot?: (page: PageId) => React.ReactNode
  className?: string
}) {
  const tabs = pageTabs(pages)
  const active = tabOfPage(value)
  // The Homes.ph page last shown, for clicking the Homes.ph tab again from a site.
  const [lastHomes, setLastHomes] = useState<PageId | null>(value.startsWith("homes:") ? value : null)
  if (value.startsWith("homes:") && value !== lastHomes) setLastHomes(value)

  if (!tabs.length) return null
  return (
    <nav aria-label={label} className={cn("flex flex-wrap gap-1 rounded-xl border bg-card p-1", className)}>
      {tabs.map((tab) => {
        const on = tab.id === active
        const base = cn(
          "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
          on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
        if (tab.id === "homes" && tab.pages.length > 1) {
          const shown = value.startsWith("homes:") ? value : (lastHomes ?? tab.pages[0])
          return (
            <DropdownMenu key="homes">
              <DropdownMenuTrigger className={base} aria-current={on ? "page" : undefined} aria-label={`Homes.ph pages: ${pageName(shown)}`}>
                <span className="truncate">
                  Homes.ph <span className={cn("font-semibold", !on && "text-foreground")}>· {parsePageId(shown)?.page.short}</span>
                </span>
                {dot?.(shown)}
                <ChevronDown className="size-4 shrink-0 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[60vh] min-w-56 overflow-y-auto">
                <DropdownMenuLabel>Homes.ph pages</DropdownMenuLabel>
                {tab.pages.map((p) => (
                  <DropdownMenuItem key={p} onSelect={() => onChange(p)} className="justify-between gap-3">
                    <span className="flex items-center gap-2">
                      {p === value ? <Check className="size-4 text-primary" /> : <span className="size-4" />}
                      {pageName(p)}
                    </span>
                    {dot?.(p)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
        return (
          <button key={tab.id} type="button" className={base} aria-current={on ? "page" : undefined} onClick={() => onChange(tab.pages[0])}>
            <span className="truncate">{tab.label}</span>
            {dot?.(tab.pages[0])}
          </button>
        )
      })}
    </nav>
  )
}

/** Shown when no page is assigned (or none that this screen has). */
export function NoPagesAssigned({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Settings2 className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">No pages for {what}</p>
        <p className="text-sm text-muted-foreground">None of your assigned pages has {what}. Change your pages in Settings → Assigned pages.</p>
      </div>
      <Link href="/settings#assigned-pages" className="text-sm font-medium text-primary hover:underline">
        Open Assigned pages
      </Link>
    </div>
  )
}

/** The page shown: the one asked for (when assigned), else the first assigned page. */
export function pickPage(pages: readonly PageId[], wanted: string | null | undefined): PageId | null {
  if (wanted && pages.includes(wanted as PageId)) return wanted as PageId
  return pages[0] ?? null
}
