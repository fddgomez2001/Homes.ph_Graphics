"use client"

import { getDesktop } from "@/lib/desktop"

/**
 * Opens the posting checklist in its own small window: always on top in the
 * desktop app (so it stays visible while posting on Facebook), a popup in a browser.
 */
export function openChecklistWindow(projectId: string) {
  const desktop = getDesktop()
  if (desktop?.openChecklist) {
    void desktop.openChecklist(projectId).catch(() => {})
    return
  }
  window.open(`/checklist?id=${encodeURIComponent(projectId)}`, "dcm-checklist", "popup=yes,width=420,height=820")
}
