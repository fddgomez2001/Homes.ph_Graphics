"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  CalendarClock,
  CircleCheckBig,
  ClipboardList,
  FilePen,
  House,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Newspaper,
  PanelsTopLeft,
  Settings,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { BrandMark } from "@/components/brand-mark"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/home", label: "Home", icon: House },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/board", label: "Day Board", icon: PanelsTopLeft },
      { href: "/content", label: "All Content", icon: LayoutGrid },
      { href: "/news", label: "News Article", icon: Newspaper },
      { href: "/report", label: "Daily Report", icon: ClipboardList },
    ],
  },
  {
    label: "By status",
    items: [
      { href: "/drafts", label: "Drafts", icon: FilePen },
      { href: "/scheduled", label: "Scheduled", icon: CalendarClock },
      { href: "/published", label: "Published", icon: CircleCheckBig },
    ],
  },
  {
    label: "Assets",
    items: [
      { href: "/library", label: "Image Library", icon: Images },
      { href: "/templates", label: "Templates", icon: LayoutTemplate },
      { href: "/trash", label: "Trash", icon: Trash2 },
    ],
  },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/home" onClick={onNavigate} className="flex items-center gap-2.5 px-4 py-4">
        <BrandMark className="size-8" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Homes.ph</div>
          <div className="text-xs text-muted-foreground">Daily Carousel Maker</div>
        </div>
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {group.label && (
              <div className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{group.label}</div>
            )}
            {group.items.map((item) => (
              <Suspense key={item.href} fallback={<NavLink item={item} active={false} onNavigate={onNavigate} />}>
                <ActiveNavLink item={item} onNavigate={onNavigate} />
              </Suspense>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t px-3 py-3">
        <Suspense fallback={<NavLink item={{ href: "/settings", label: "Settings", icon: Settings }} active={false} />}>
          <ActiveNavLink item={{ href: "/settings", label: "Settings", icon: Settings }} onNavigate={onNavigate} />
        </Suspense>
      </div>
    </div>
  )
}

function ActiveNavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname()
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
  return <NavLink item={item} active={active} onNavigate={onNavigate} />
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-accent text-primary hover:bg-accent hover:text-primary",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  )
}
