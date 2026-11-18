"use client"

import { Building2, Globe, LayoutGrid } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { HOMES_PAGE_LIST, SITE_PAGE_LIST, type Assignment, type HomesPageKey, type SitePageKey } from "@/lib/pages"
import { cn } from "@/lib/utils"

/**
 * Picks the pages a person is assigned: the Homes.ph pages, the site pages, and the carousel (a switch, off when
 * they don't make the carousel). Used by the first-run setup and Settings → Assigned pages.
 */
export function AssignedPagesPicker({ value, onChange, disabled }: { value: Assignment; onChange: (next: Assignment) => void; disabled?: boolean }) {
  const toggleHomes = (key: HomesPageKey) =>
    onChange({ ...value, homes: value.homes.includes(key) ? value.homes.filter((k) => k !== key) : HOMES_PAGE_LIST.filter((p) => p.key === key || value.homes.includes(p.key)).map((p) => p.key) })
  const toggleSite = (key: SitePageKey) =>
    onChange({ ...value, sites: value.sites.includes(key) ? value.sites.filter((k) => k !== key) : SITE_PAGE_LIST.filter((p) => p.key === key || value.sites.includes(p.key)).map((p) => p.key) })
  const allHomes = value.homes.length === HOMES_PAGE_LIST.length

  return (
    <div className="flex flex-col gap-5">
      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <legend className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-primary" /> Homes.ph Pages
            <span className="text-xs font-normal text-muted-foreground">
              {value.homes.length} of {HOMES_PAGE_LIST.length}
            </span>
          </legend>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => onChange({ ...value, homes: allHomes ? [] : HOMES_PAGE_LIST.map((p) => p.key) })}
          >
            {allHomes ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4" role="group" aria-label="Homes.ph Pages">
          {HOMES_PAGE_LIST.map((p) => (
            <PageBox key={p.key} label={p.short} title={p.name} checked={value.homes.includes(p.key)} onToggle={() => toggleHomes(p.key)} />
          ))}
        </div>
      </fieldset>

      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="size-4 text-primary" /> Site Pages
          <span className="text-xs font-normal text-muted-foreground">
            {value.sites.length} of {SITE_PAGE_LIST.length}
          </span>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-label="Site Pages">
          {SITE_PAGE_LIST.map((p) => (
            <PageBox key={p.key} label={p.name} checked={value.sites.includes(p.key)} onToggle={() => toggleSite(p.key)} />
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-4 rounded-lg border bg-background/40 p-3">
        <div className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <LayoutGrid className="size-4" />
          </span>
          <div>
            <label htmlFor="assigned-carousel" className="text-sm font-medium">
              Carousel
            </label>
            <p className="text-xs text-muted-foreground">
              Turn on if you make the daily carousel for the Homes.ph pages. Off: Home shows your pages, and Calendar and Day Board are hidden.
            </p>
          </div>
        </div>
        <Switch id="assigned-carousel" checked={value.carousel} onCheckedChange={(carousel) => onChange({ ...value, carousel })} disabled={disabled} />
      </div>
    </div>
  )
}

function PageBox({ label, title, checked, onToggle }: { label: string; title?: string; checked: boolean; onToggle: () => void }) {
  return (
    <label
      title={title}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-60",
        checked ? "border-primary/60 bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={onToggle} />
      <span className="truncate">{label}</span>
    </label>
  )
}
