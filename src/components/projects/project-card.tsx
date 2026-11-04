"use client"

import Link from "next/link"
import { formatDistanceToNowStrict, isPast } from "date-fns"
import { Layers } from "lucide-react"
import { formatPosted, formatSchedule } from "@/lib/dates"
import type { ProjectRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ProjectActionsMenu } from "./project-actions-menu"
import { ProjectThumb } from "./project-thumb"
import { StatusBadge, StatusDot } from "./status-badge"
import type { ProjectActions } from "./use-project-actions"

export const PROJECT_DRAG_TYPE = "application/x-dcm-project"

export function dragProps(project: ProjectRow) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(PROJECT_DRAG_TYPE, project.id)
      e.dataTransfer.effectAllowed = "move"
    },
  }
}

function SlideCount({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)} title={`${count} slides`}>
      <Layers className="size-3" aria-hidden="true" />
      {count}
      <span className="sr-only"> slides</span>
    </span>
  )
}

/** Past the scheduled time but still "Scheduled": a gentle reminder, never an automatic status change. */
function OverdueHint({ project }: { project: ProjectRow }) {
  if (project.status !== "scheduled" || !project.scheduled_at || !isPast(new Date(project.scheduled_at))) return null
  return <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Date passed — mark as published?</span>
}

/** When a published carousel went live (set on the website or in the app). */
export function PostedHint({ project, className }: { project: Pick<ProjectRow, "status" | "posted_at">; className?: string }) {
  if (project.status !== "published" || !project.posted_at) return null
  return <span className={cn("text-[11px] font-medium text-emerald-700 dark:text-emerald-300", className)}>Posted {formatPosted(project.posted_at)}</span>
}

/** Compact one-line item for the month grid. */
export function ProjectChip({ project, actions }: { project: ProjectRow; actions: ProjectActions }) {
  return (
    <div
      {...dragProps(project)}
      className="group/chip relative flex items-center gap-1.5 rounded-md border bg-card py-1 pr-1 pl-1 text-left shadow-2xs transition-colors hover:border-primary/40"
    >
      <Link
        href={`/editor/${project.id}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={(e) => e.stopPropagation()}
        title={`${project.title} · ${project.slide_count} slides`}
      >
        <ProjectThumb src={project.thumbnail} title={project.title} className="size-7 shrink-0 rounded" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{project.title}</span>
          <span className="flex items-center gap-1.5">
            <StatusDot status={project.status} />
            <SlideCount count={project.slide_count} className="text-[11px]" />
          </span>
        </span>
      </Link>
      <ProjectActionsMenu
        project={project}
        actions={actions}
        className="size-6 opacity-0 group-hover/chip:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
      />
    </div>
  )
}

/** Grid card with a large cover preview. */
export function ProjectCard({ project, actions, draggable }: { project: ProjectRow; actions: ProjectActions; draggable?: boolean }) {
  return (
    <div
      {...(draggable ? dragProps(project) : {})}
      className="group/card relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-2xs transition-shadow hover:shadow-sm"
    >
      <Link href={`/editor/${project.id}`} className="outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <ProjectThumb src={project.thumbnail} title={project.title} className="w-full rounded-none" />
        <span className="sr-only">Open {project.title}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start gap-2">
          <Link href={`/editor/${project.id}`} className="line-clamp-2 flex-1 text-sm font-medium hover:underline">
            {project.title}
          </Link>
          <ProjectActionsMenu project={project} actions={actions} className="-mt-1 -mr-1" />
        </div>
        <div className="text-xs text-muted-foreground">{formatSchedule(project.scheduled_at)}</div>
        <OverdueHint project={project} />
        <PostedHint project={project} />
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <StatusBadge status={project.status} />
          <SlideCount count={project.slide_count} />
        </div>
        <div className="text-[11px] text-muted-foreground">
          Edited {formatDistanceToNowStrict(new Date(project.updated_at), { addSuffix: true })}
          {project.archived_at && " · Archived"}
        </div>
      </div>
    </div>
  )
}

/** Dense list row. */
export function ProjectListRow({ project, actions }: { project: ProjectRow; actions: ProjectActions }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
      <Link href={`/editor/${project.id}`} className="shrink-0">
        <ProjectThumb src={project.thumbnail} title={project.title} className="size-12" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/editor/${project.id}`} className="block truncate text-sm font-medium hover:underline">
          {project.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          <span>{formatSchedule(project.scheduled_at)}</span>
          <OverdueHint project={project} />
          <PostedHint project={project} />
        </div>
      </div>
      <div className="hidden w-28 sm:block">
        <StatusBadge status={project.status} />
      </div>
      <SlideCount count={project.slide_count} className="hidden w-12 md:inline-flex" />
      <div className="hidden w-32 text-xs text-muted-foreground lg:block">
        {formatDistanceToNowStrict(new Date(project.updated_at), { addSuffix: true })}
        {project.archived_at && " · Archived"}
      </div>
      <ProjectActionsMenu project={project} actions={actions} />
    </div>
  )
}
