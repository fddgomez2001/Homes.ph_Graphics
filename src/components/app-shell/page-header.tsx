"use client"

import type { ReactNode } from "react"
import { Menu, Plus, Search, X } from "lucide-react"
import { useCreateCarousel } from "@/components/projects/create-carousel-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme/theme"
import { useShell } from "./app-shell"
import { UserMenu } from "./user-menu"

export function PageHeader({
  title,
  description,
  search,
  onSearchChange,
  searchPlaceholder = "Search carousels…",
  children,
  createDate,
}: {
  title: string
  description?: string
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /** Extra controls such as date navigation. */
  children?: ReactNode
  /** Date to preselect when creating from this page. */
  createDate?: Date | null
}) {
  const openCreate = useCreateCarousel()
  const { openNav } = useShell()
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={openNav} aria-label="Open navigation">
          <Menu />
        </Button>
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        {onSearchChange && (
          <div className="relative order-last w-full sm:order-none sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 bg-card pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
              aria-label={searchPlaceholder}
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
        {children}
        <Button onClick={() => openCreate({ date: createDate ?? null })} className="h-9 px-3.5">
          <Plus /> <span className="hidden sm:inline">Create New Carousel</span>
          <span className="sm:hidden">New</span>
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
