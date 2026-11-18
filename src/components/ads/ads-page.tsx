"use client"

import { useMemo, useState } from "react"
import { Megaphone } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/app-shell/page-header"
import { NoPagesAssigned, PageTabs, pickPage } from "@/components/pages/page-tabs"
import { useAssignment } from "@/lib/assignment"
import { assignedPageIds, pageName, type PageId } from "@/lib/pages"
import type { AdBrand } from "@/lib/ads/schedule-time"
import type { ScheduledAdSummary } from "@/lib/ads/scheduled"
import { AdsCalendar } from "./ads-calendar"
import { PicklePlayAds } from "./pickleplay-ads"

/** An assigned page's advertisements: PicklePlay, FHI, Homes.ph Gensan, any other Homes.ph page (Homes.ph's), or none yet. */
function adBrandOf(page: PageId): AdBrand | null {
  if (page === "site:pickleplay") return "pickleplay"
  if (page === "site:fhi") return "fhi"
  if (page === "homes:gensan") return "gensan"
  return page.startsWith("homes:") ? "homes" : null
}

const ACCENT: Record<AdBrand, string> = { fhi: "#F8C563", pickleplay: "#AFD137", homes: "#F4AA1D", gensan: "#F4AA1D" }

/** ?brand= from before 1.50 → its page. */
const PAGE_OF_BRAND: Record<string, PageId> = { pickleplay: "site:pickleplay", fhi: "site:fhi", gensan: "homes:gensan", homes: "homes:caraga" }

/**
 * Advertisement: posts made from the pages' own templates (PicklePlay PH first), for the assigned pages. A
 * navigation bar picks the page: one Homes.ph tab (a dropdown when several Homes.ph pages are assigned), then each site.
 */
export function AdsPage() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { assignment } = useAssignment()
  const pages = useMemo(() => assignedPageIds(assignment), [assignment])
  const wanted = params.get("page") ?? PAGE_OF_BRAND[params.get("brand") ?? ""] ?? (pages.includes("site:pickleplay") ? "site:pickleplay" : null)
  const page = pickPage(pages, wanted)
  const brand: AdBrand | null = page ? adBrandOf(page) : null
  const pick = (p: PageId) => router.replace(`${pathname}?page=${p}`, { scroll: false })
  const name = page ? pageName(page) : ""
  const accent = brand ? ACCENT[brand] : "#94A3B8"
  // The calendar's Edit opens the ad in its brand's editor.
  const [editRequest, setEditRequest] = useState<{ id: string; at: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const edit = (ad: ScheduledAdSummary) => {
    if (ad.brand !== brand) {
      const to = pages.find((p) => adBrandOf(p) === ad.brand)
      if (to) pick(to)
    }
    setEditRequest({ id: ad.id, at: Date.now() })
  }
  const editingChanged = (id: string | null) => {
    setEditingId(id)
    if (!id) setEditRequest(null)
  }
  /** Another page's tab closes the PicklePlay editor (an ad being edited there is left as it was saved). */
  const chooseTab = (p: PageId) => {
    if (adBrandOf(p) !== "pickleplay") editingChanged(null)
    pick(p)
  }

  return (
    <>
      <PageHeader
        title="Advertisement"
        description="Posts from your pages' templates, written with AI: PicklePlay PH History, Trivia, Fun Facts (Did You Know?), Court Owners ads, and Coming Soon / Now Open posts for courts (1408 × 1408). Schedule them at a time clear of the News Article postings."
      />
      <div className="flex flex-col gap-5 p-4 lg:p-6">
        {!page ? (
          <NoPagesAssigned what="Advertisement" />
        ) : (
          <>
            <PageTabs pages={pages} value={page} onChange={chooseTab} label="Assigned pages" />
            <AdsCalendar editingId={editingId} onEdit={edit} />
          </>
        )}

        {!page ? null : brand === "pickleplay" ? (
          <PicklePlayAds editRequest={editRequest} onEditing={editingChanged} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full" style={{ background: `${accent}33` }}>
              <Megaphone className="size-6" style={{ color: accent }} />
            </span>
            <h2 className="text-base font-semibold">{name} advertisements are coming soon</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              This space is ready for {name}&apos;s templates.{pages.includes("site:pickleplay") ? " For now, make PicklePlay PH History, Trivia and Fun Fact posts." : ""}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
