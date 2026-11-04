import { format } from "date-fns"
import { buildCaragaNews, buildFhiPortraitNews, buildFhiWideNews, buildPickleplayNews } from "./templates"
import type { SlideDesign } from "./types"

export type NewsBrand = "pickleplay" | "fhi" | "caraga"

export interface NewsTemplate {
  id: string
  brand: NewsBrand
  name: string
  /** "1152 × 1408" */
  size: string
  width: number
  height: number
  build: (content?: { headline?: string }) => SlideDesign
}

/** Every news article template, by brand. Ids end in "-news" (that marks a news design). */
export const NEWS_TEMPLATES: NewsTemplate[] = [
  { id: "pickleplay-news", brand: "pickleplay", name: "PicklePlay PH", size: "1408 × 1408", width: 1408, height: 1408, build: buildPickleplayNews },
  { id: "fhi-portrait-news", brand: "fhi", name: "Template 1 · Portrait", size: "1152 × 1408", width: 1152, height: 1408, build: buildFhiPortraitNews },
  { id: "fhi-wide-news", brand: "fhi", name: "Template 2 · Wide", size: "1742 × 1436", width: 1742, height: 1436, build: buildFhiWideNews },
  { id: "caraga-news", brand: "caraga", name: "Homes.ph CARAGA", size: "1408 × 1408", width: 1408, height: 1408, build: buildCaragaNews },
]

export const NEWS_BRANDS: { id: NewsBrand; name: string; site: string }[] = [
  { id: "pickleplay", name: "PicklePlay PH", site: "pickleplay.ph" },
  { id: "fhi", name: "FHI Global Property", site: "fhiglobal.ae" },
  { id: "caraga", name: "Homes.ph CARAGA", site: "homes.ph" },
]

export interface NewsTime {
  /** "13:30" (local time) */
  time: string
  /** "1:30 PM" */
  label: string
}

/** The daily posting times of PicklePlay PH and FHI Global Property (local time). */
export const NEWS_TIMES: readonly NewsTime[] = [
  { time: "09:00", label: "9 AM" },
  { time: "11:00", label: "11 AM" },
  { time: "15:00", label: "3 PM" },
  { time: "19:00", label: "7 PM" },
  { time: "22:00", label: "10 PM" },
]

/** Homes.ph CARAGA posts on its own schedule. */
export const CARAGA_TIMES: readonly NewsTime[] = [
  { time: "11:00", label: "11 AM" },
  { time: "13:30", label: "1:30 PM" },
  { time: "18:00", label: "6 PM" },
  { time: "20:00", label: "8 PM" },
  { time: "22:00", label: "10 PM" },
]

export function newsTimesFor(brand: NewsBrand): readonly NewsTime[] {
  return brand === "caraga" ? CARAGA_TIMES : NEWS_TIMES
}

/** "9 AM", "1:30 PM": a posting time's label (any brand), or the time written out. */
export function newsTimeLabel(time: string): string {
  return [...NEWS_TIMES, ...CARAGA_TIMES].find((t) => t.time === time)?.label ?? format(new Date(`2000-01-01T${time}:00`), time.endsWith(":00") ? "h a" : "h:mm a")
}

/** "2026-11-01 1.30PM Homes.ph CARAGA.png" (no ":" — Windows doesn't allow it in file names). */
export function newsFileName(day: Date, time: NewsTime, brandName: string) {
  return `${format(day, "yyyy-MM-dd")} ${time.label.replace(/\s+/g, "").replace(":", ".")} ${brandName}.png`
}

export function getNewsTemplate(id: string | null | undefined): NewsTemplate | undefined {
  return NEWS_TEMPLATES.find((t) => t.id === id)
}

export function newsTemplatesFor(brand: NewsBrand): NewsTemplate[] {
  return NEWS_TEMPLATES.filter((t) => t.brand === brand)
}

/** The brand of a news design (PicklePlay for older articles without a known template). */
export function newsBrandOf(design: Pick<SlideDesign, "templateId"> | null | undefined): NewsBrand {
  return getNewsTemplate(design?.templateId)?.brand ?? "pickleplay"
}
