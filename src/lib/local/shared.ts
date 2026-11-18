import type { PostPage } from "@/lib/data/posting"
import type { ProjectStatus, SlideRow } from "@/lib/types"

/**
 * Shared by the app and its local server: the "saved on this computer" mode of the desktop app
 * (no account). The browser side reads the mode from the `dcm-mode` cookie the app's server sets.
 */

/** The person on this computer (there's no account). */
export const LOCAL_USER_ID = "00000000-0000-4000-8000-00000000c0de"

export const MODE_COOKIE = "dcm-mode"

/** "local" | "account" | "setup" in the desktop app (from its cookie); null on the website. */
export function cookieMode(): "local" | "account" | "setup" | null {
  if (typeof document === "undefined") return null
  const m = /(?:^|;\s*)dcm-mode=(local|account|setup)(?:;|$)/.exec(document.cookie)
  return (m?.[1] as "local" | "account" | "setup" | undefined) ?? null
}

/** The work is saved on this computer, not in the cloud database (desktop app, no account). */
export const isLocalMode = () => cookieMode() === "local"

/** The Homes.ph pages of the posting checklist (the same list as the database's). */
export const DEFAULT_POST_PAGES: PostPage[] = [
  ["main", "Homes.ph Main Page", "Main Page"],
  ["ozamiz", "Homes.ph Ozamiz", "Ozamiz"],
  ["dumaguete", "Homes.ph Dumaguete", "Dumaguete"],
  ["bgc-taguig", "Homes.ph BGC Taguig", "BGC Taguig"],
  ["cebu", "Homes.ph Cebu", "Cebu"],
  ["pampanga", "Homes.ph Pampanga", "Pampanga"],
  ["cavite", "Homes.ph Cavite", "Cavite"],
  ["iloilo", "Homes.ph Iloilo", "Iloilo"],
  ["bacolod", "Homes.ph Bacolod", "Bacolod"],
  ["davao", "Homes.ph Davao", "Davao"],
  ["palawan", "Homes.ph Palawan", "Palawan"],
  ["bohol", "Homes.ph Bohol", "Bohol"],
  ["makati", "Homes.ph Makati", "Makati"],
  ["cdo", "Homes.ph CDO", "CDO"],
  ["gensan", "Homes.ph Gensan", "Gensan"],
  ["caraga", "Homes.ph Caraga", "Caraga"],
  ["leyte", "Homes.ph Leyte", "Leyte"],
].map(([key, name, short_name], i) => ({ key, name, short_name, sort: i + 1 }))

export interface LocalProjectQuery {
  from?: string
  to?: string
  unscheduledOnly?: boolean
  statuses?: ProjectStatus[]
  search?: string
  archived?: "exclude" | "include" | "only"
  orderBy?: "scheduled_at" | "updated_at" | "created_at" | "deleted_at"
  ascending?: boolean
  limit?: number
  kind?: "carousel" | "news" | "all"
  trash?: "exclude" | "only"
}

export interface LocalSaveArgs {
  projectId: string
  expectedRevision: number
  project: Record<string, unknown>
  slides: (Partial<SlideRow> & Pick<SlideRow, "id" | "slide_type">)[]
}
