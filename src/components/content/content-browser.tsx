"use client"

import { useState } from "react"
import { LayoutGrid, List, Loader2, Plus, SearchX } from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { useCreateCarousel } from "@/components/projects/create-carousel-dialog"
import { ProjectCard, ProjectListRow } from "@/components/projects/project-card"
import { StatusFilter } from "@/components/projects/status-filter"
import { useProjectActions } from "@/components/projects/use-project-actions"
import { useProjects } from "@/components/projects/use-projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ProjectQuery } from "@/lib/data/projects"
import { combineDateTime } from "@/lib/dates"
import { useDebouncedValue, usePreference } from "@/lib/hooks"
import { STATUS_LABELS, type ProjectStatus } from "@/lib/types"

const SORTS = {
  updated: { label: "Last edited", orderBy: "updated_at", ascending: false },
  upcoming: { label: "Publication date", orderBy: "scheduled_at", ascending: true },
  created: { label: "Newest first", orderBy: "created_at", ascending: false },
} as const
type SortKey = keyof typeof SORTS

export function ContentBrowser({ title, fixedStatus }: { title: string; fixedStatus?: ProjectStatus }) {
  const openCreate = useCreateCarousel()
  const [layout, setLayout] = usePreference<"grid" | "list">("dcm:content-layout", "grid", ["grid", "list"])
  const [search, setSearch] = useState("")
  const term = useDebouncedValue(search.trim())
  const [statuses, setStatuses] = useState<ProjectStatus[]>([])
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [archived, setArchived] = useState<"exclude" | "only" | "include">("exclude")
  const [sort, setSort] = useState<SortKey>(fixedStatus === "scheduled" ? "upcoming" : "updated")

  const fromIso = combineDateTime(from, "00:00")
  const toIso = to ? new Date(new Date(combineDateTime(to, "00:00")!).getTime() + 86_400_000).toISOString() : null
  const query: ProjectQuery = {
    statuses: fixedStatus ? [fixedStatus] : statuses,
    search: term,
    from: fromIso ?? undefined,
    to: toIso ?? undefined,
    archived,
    orderBy: SORTS[sort].orderBy,
    ascending: SORTS[sort].ascending,
  }
  const { projects, loading, error, apply } = useProjects(query)
  const { actions, dialogs } = useProjectActions(apply)
  const filtered = Boolean(term || from || to || statuses.length || archived !== "exclude")

  return (
    <>
      <PageHeader
        title={title}
        description={fixedStatus ? `Carousels marked as ${STATUS_LABELS[fixedStatus]}` : "Every carousel you've made"}
        search={search}
        onSearchChange={setSearch}
      />
      <div className="flex flex-wrap items-end gap-3 border-b bg-card/50 px-4 py-2.5 lg:px-6">
        {!fixedStatus && <StatusFilter value={statuses} onChange={setStatuses} />}
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-from" className="text-[11px] text-muted-foreground">
              From
            </Label>
            <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-to" className="text-[11px] text-muted-foreground">
              To
            </Label>
            <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" />
          </div>
        </div>
        <Select value={archived} onValueChange={(v) => setArchived(v as typeof archived)}>
          <SelectTrigger size="sm" className="w-36" aria-label="Archived filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exclude">Active only</SelectItem>
            <SelectItem value="only">Archived</SelectItem>
            <SelectItem value="include">Active + archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger size="sm" className="w-40" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORTS).map(([key, s]) => (
              <SelectItem key={key} value={key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={layout}
          onValueChange={(v) => v && setLayout(v as "grid" | "list")}
          className="ml-auto"
          aria-label="Layout"
        >
          <ToggleGroupItem value="grid" aria-label="Grid">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex-1 p-4 lg:p-6">
        {error && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {!loading && projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
            {filtered ? <SearchX className="size-8 text-muted-foreground" /> : <LayoutGrid className="size-8 text-muted-foreground" />}
            <div>
              <p className="font-medium">{filtered ? "No carousels match these filters" : "No carousels yet"}</p>
              <p className="text-sm text-muted-foreground">
                {filtered ? "Try a different search or clear the filters." : "Create your first carousel to get started."}
              </p>
            </div>
            {!filtered && (
              <Button onClick={() => openCreate()}>
                <Plus /> Create New Carousel
              </Button>
            )}
          </div>
        ) : layout === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} actions={actions} />
            ))}
          </div>
        ) : (
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {projects.map((p) => (
              <ProjectListRow key={p.id} project={p} actions={actions} />
            ))}
          </div>
        )}
      </div>
      {dialogs}
    </>
  )
}
