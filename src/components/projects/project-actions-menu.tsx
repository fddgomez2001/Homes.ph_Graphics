"use client"

import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  CircleDot,
  Copy,
  DatabaseBackup,
  Download,
  MoreHorizontal,
  PencilLine,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PROJECT_STATUSES, STATUS_LABELS, type ProjectRow, type ProjectStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { ProjectActions } from "./use-project-actions"

export function ProjectActionsMenu({
  project,
  actions,
  className,
  align = "end",
}: {
  project: ProjectRow
  actions: ProjectActions
  className?: string
  align?: "start" | "end"
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground", className)}
          aria-label={`Actions for ${project.title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => actions.open(project)}>
          <PencilLine /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.duplicate(project)}>
          <Copy /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.reschedule(project)}>
          <CalendarClock /> Reschedule…
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CircleDot /> Status
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={project.status}
              onValueChange={(v) => void actions.setStatus(project, v as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => void actions.download(project)}>
          <Download /> Download all slides (ZIP)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.backup(project)}>
          <DatabaseBackup /> Back up (images + text)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {project.archived_at ? (
          <DropdownMenuItem onSelect={() => void actions.setArchived(project, false)}>
            <ArchiveRestore /> Restore from archive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => void actions.setArchived(project, true)}>
            <Archive /> Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => void actions.remove(project)}
          className="font-medium text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-700 dark:focus:text-red-300 [&_svg]:!text-red-600 dark:text-red-400"
        >
          <Trash2 /> Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
