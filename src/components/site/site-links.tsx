"use client"

import { createContext, useContext } from "react"

/** Where the posting screens link to: the website's pages, or the phone app's views. */
export interface SiteLinks {
  home: string
  carousel: (id: string) => string
  show: (show: string) => string
  /** The phone app: saves to the gallery and shares instead of ZIPs; its header has the back button. */
  app: boolean
}

export const WEBSITE_LINKS: SiteLinks = {
  home: "/site",
  carousel: (id) => `/site/${id}`,
  show: (show) => (show === "to-post" ? "/site" : `/site?show=${show}`),
  app: false,
}

const SiteLinksContext = createContext<SiteLinks>(WEBSITE_LINKS)

export const SiteLinksProvider = SiteLinksContext.Provider

export function useSiteLinks() {
  return useContext(SiteLinksContext)
}
