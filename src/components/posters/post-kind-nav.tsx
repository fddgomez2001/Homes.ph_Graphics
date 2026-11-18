"use client"

import { BadgeHelp, Lightbulb, MessagesSquare, Newspaper } from "lucide-react"
import { brandPostId, brandPostTemplate, POST_KINDS, templatesOf, templateThumb, type PostBrand } from "@/lib/brand-templates/catalog"
import type { BrandPostKind } from "@/lib/brand-templates/types"
import { cn } from "@/lib/utils"

const ICONS: Record<BrandPostKind, typeof Newspaper> = { news: Newspaper, dyk: Lightbulb, engagement: MessagesSquare }
const HINTS: Record<BrandPostKind, string> = {
  news: "News posters · 1080 × 1350",
  dyk: "One fact, or 3 facts · 1126 × 1408",
  engagement: "Questions, trivia, this or that · 1126 × 1408",
}

/**
 * The Poster Maker's navigation (1.52): Poster (news posters), Did You Know and Engagement Posts. Each has its own
 * templates for every brand, its own posts on the day board and its own upcoming list.
 */
export function PostKindNav({ kind, onChange }: { kind: BrandPostKind; onChange: (kind: BrandPostKind) => void }) {
  return (
    <nav className="grid grid-cols-3 gap-1 rounded-xl border bg-card p-1" aria-label="Poster Maker">
      {POST_KINDS.map((k) => {
        const Icon = ICONS[k.id]
        const on = k.id === kind
        return (
          <button
            key={k.id}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={() => onChange(k.id)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2.5 rounded-lg px-2 py-2.5 text-left transition-colors",
              on ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{k.name}</span>
              <span className={cn("hidden truncate text-[11px] sm:block", on ? "text-background/70" : "text-muted-foreground")}>{HINTS[k.id]}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

/**
 * A brand's templates of one navigation, as small pictures to pick from (the brand's own versions of them).
 * `value`: the template number picked ("01"), or null when the post is on another (older) template.
 */
export function TemplateGallery({ kind, brand, value, onChange }: { kind: BrandPostKind; brand: PostBrand; value: string | null; onChange: (num: string) => void }) {
  const list = templatesOf(kind)
  const cols = list.length > 7 ? "grid-cols-6" : list.length > 2 ? "grid-cols-4" : "grid-cols-2"
  return (
    <div className={cn("grid gap-1.5", cols)} role="radiogroup" aria-label={`${POST_KINDS.find((k) => k.id === kind)!.name} template`}>
      {list.map((t) => {
        const file = brandPostTemplate(brandPostId(brand, kind, t.num))?.file
        const on = value === t.num
        return (
          <button
            key={t.num}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${t.num} ${t.name}`}
            title={`${t.num} · ${t.name}: ${t.hint}`}
            onClick={() => onChange(t.num)}
            className={cn(
              "group relative overflow-hidden rounded-md bg-muted ring-offset-2 ring-offset-background transition",
              on ? "ring-2 ring-primary" : "opacity-85 ring-1 ring-border hover:opacity-100",
            )}
          >
            {file ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={templateThumb(file)} alt="" className={cn("w-full object-cover", kind === "news" ? "aspect-[1080/1350]" : "aspect-[1126/1408]")} draggable={false} loading="lazy" />
            ) : (
              <BadgeHelp className="m-auto size-5" />
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1 py-0.5 text-[9.5px] leading-tight font-semibold text-white">
              {t.num} {t.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const LAST_KIND_KEY = "dcm-poster-kind"

/** The navigation last used (the sidebar's Poster Maker link opens it). */
export function readLastKind(): BrandPostKind | null {
  try {
    const v = localStorage.getItem(LAST_KIND_KEY)
    return v === "news" || v === "dyk" || v === "engagement" ? v : null
  } catch {
    return null
  }
}

export function rememberKind(kind: BrandPostKind) {
  try {
    localStorage.setItem(LAST_KIND_KEY, kind)
  } catch {
    // remembered for this session only
  }
}
