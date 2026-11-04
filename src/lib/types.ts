import type { SlideDesign, SlideType } from "@/lib/design/types"

export type ProjectStatus = "draft" | "scheduled" | "published"

export const PROJECT_STATUSES: ProjectStatus[] = ["draft", "scheduled", "published"]

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
}

export interface ProjectRow {
  id: string
  user_id: string
  title: string
  topic: string | null
  caption: string
  scheduled_at: string | null
  status: ProjectStatus
  archived_at: string | null
  thumbnail: string | null
  slide_count: number
  revision: number
  created_at: string
  updated_at: string
  /** Set while the carousel is in the Trash (needs the 20261030 migration). */
  deleted_at?: string | null
  /** "news" = a single 1408 × 1408 news article graphic (needs the 20261030 migration). */
  kind?: ProjectKind
  /** When it was posted (set with status Published; needs the 20261030120000 migration). */
  posted_at?: string | null
  /** Who made it (needs the 20261031 team migration). */
  created_by?: string | null
  created_by_name?: string
  /** Facebook pages ticked on the posting checklist, and who ticked them (in order). */
  posted_count?: number
  posted_by?: string[]
}

export type ProjectKind = "carousel" | "news"

export interface SlideRow {
  id: string
  project_id: string
  slide_order: number
  slide_type: SlideType
  title: string | null
  subtitle: string | null
  description: string | null
  background_image_url: string | null
  background_public_id: string | null
  canvas_width: number
  canvas_height: number
  design_json: SlideDesign
  created_at: string
  updated_at: string
}

export interface AssetRow {
  id: string
  user_id: string
  cloudinary_public_id: string
  secure_url: string
  original_filename: string | null
  format: string | null
  width: number | null
  height: number | null
  bytes: number | null
  sha256: string
  created_at: string
}

export interface TemplateRow {
  id: string
  name: string
  slide_type: SlideType
  design_json: SlideDesign
  thumbnail: string | null
  created_at: string
  updated_at: string
}

export interface UserSettings {
  /** Footer text next to the web icon (default www.homes.ph). */
  websiteText?: string
  /** Footer text next to the Facebook icon (default facebook.com/homesphofficial). */
  facebookText?: string
  /** Title Auto-Fit defaults for new covers (same options as the Figma plugin). */
  titleFit?: { extraGap?: number; matchHeadlines?: boolean }
}
