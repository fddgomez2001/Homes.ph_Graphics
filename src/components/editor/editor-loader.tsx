"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, ArrowLeft, History, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getProject, getProjectSlides } from "@/lib/data/projects"
import { getTemplateContext } from "@/lib/data/settings"
import { relinkDesign } from "@/lib/image-sync"
import { ensureFonts } from "@/lib/design/fonts"
import { normalizeDesign } from "@/lib/design/normalize"
import type { EditorSlide } from "@/lib/design/types"
import { errorMessage } from "@/lib/utils"
import type { EditorInit } from "./editor"
import { clearBackup, readBackup, type LocalBackup } from "./persistence"

const Editor = dynamic(() => import("./editor"), { ssr: false, loading: () => <EditorSkeleton message="Opening editor…" /> })

/**
 * True when a leftover local backup holds edits the person made. Changes the
 * app makes by itself (the automatic logo color, images that have since
 * finished uploading) are redone on open, so they don't need a "restore?" question.
 */
async function hasRealChanges(backup: LocalBackup, init: EditorInit) {
  const meta = (p: Partial<EditorInit["project"]>) => JSON.stringify([p.title, p.topic ?? null, p.caption, p.scheduled_at ?? null, p.status])
  if (meta(backup.project) !== meta(init.project)) return true
  // An auto-color logo switches its artwork (src, size) by itself; only its frame counts.
  const AUTO_LOGO_FIELDS = new Set(["logoResolved", "src", "naturalWidth", "naturalHeight"])
  const comparable = (slides: EditorSlide[]) =>
    JSON.stringify(
      slides.map((s) => ({
        id: s.id,
        type: s.type,
        design: {
          ...s.design,
          elements: s.design.elements.map((e) =>
            e.type === "image" && e.role === "logo" && e.logoVariant === "auto"
              ? Object.fromEntries(Object.entries(e).filter(([k]) => !AUTO_LOGO_FIELDS.has(k)))
              : e,
          ),
        },
      })),
      (key, value) => (key === "uploadId" ? undefined : value),
    )
  const mine = await Promise.all(backup.slides.map(async (s) => ({ ...s, design: await relinkDesign(normalizeDesign(s.design)) })))
  return comparable(mine) !== comparable(init.slides)
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "recover"; init: EditorInit; backup: LocalBackup }
  | { status: "ready"; init: EditorInit }

export function EditorLoader({
  projectId,
  initialSlideId,
  addCard,
}: {
  projectId: string
  initialSlideId?: string | null
  addCard?: boolean
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [project, rows, templateContext] = await Promise.all([
          getProject(projectId),
          getProjectSlides(projectId),
          getTemplateContext(),
        ])
        if (!rows.length || rows[0].slide_type !== "cover") throw new Error("This carousel is missing its cover slide.")
        const normalized: EditorSlide[] = rows.map((row) => ({ id: row.id, type: row.slide_type, design: normalizeDesign(row.design_json) }))
        // Images that finished uploading since the last save point at Cloudinary again.
        const slides = await Promise.all(normalized.map(async (s) => ({ ...s, design: await relinkDesign(s.design) })))
        const relinked = slides.some((s, i) => s.design !== normalized[i].design)
        // Real fonts must be ready before text is measured and laid out.
        await ensureFonts(slides.map((s) => s.design))
        const init: EditorInit = { project, slides, templateContext, initialSlideId, addCard, dirty: relinked }
        const backup = readBackup(projectId)
        if (cancelled) return
        if (backup && backup.savedAt > Date.parse(project.updated_at) && backup.slides?.length && (await hasRealChanges(backup, init))) {
          setState({ status: "recover", init, backup })
        } else {
          if (backup) clearBackup(projectId)
          setState({ status: "ready", init })
        }
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: errorMessage(error) })
      }
    })()
    return () => {
      cancelled = true
    }
    // The URL options only matter for the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  if (state.status === "loading") return <EditorSkeleton message="Loading carousel…" />
  if (state.status === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="size-8 text-destructive" />
        <div>
          <p className="font-medium">Couldn&apos;t open this carousel</p>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/home">
            <ArrowLeft /> Back to calendar
          </Link>
        </Button>
      </div>
    )
  }
  if (state.status === "recover") {
    const { init, backup } = state
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <div className="flex max-w-md flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <History className="size-6 text-primary" />
            <h1 className="font-semibold">Unsaved changes found</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Changes to &ldquo;{backup.project.title}&rdquo; from {formatDistanceToNow(backup.savedAt, { addSuffix: true })} weren&apos;t
            saved (the connection may have dropped). Restore them?
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                clearBackup(init.project.id)
                setState({ status: "ready", init })
              }}
            >
              Discard
            </Button>
            <Button
              onClick={() =>
                setState({
                  status: "ready",
                  init: {
                    ...init,
                    project: { ...init.project, ...backup.project },
                    slides: backup.slides.map((s) => ({ ...s, design: normalizeDesign(s.design) })),
                    dirty: true,
                  },
                })
              }
            >
              Restore my changes
            </Button>
          </div>
        </div>
      </div>
    )
  }
  return <Editor init={state.init} />
}

export function EditorSkeleton({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex h-dvh flex-col bg-background" aria-busy="true">
      <div className="h-14 border-b bg-card" />
      <div className="flex flex-1">
        <div className="w-16 border-r bg-card" />
        <div className="hidden w-72 border-r bg-card md:block" />
        <div className="flex flex-1 items-center justify-center bg-[#EEF2F6] dark:bg-[#0b111d]">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {message}
          </p>
        </div>
        <div className="hidden w-80 border-l bg-card xl:block" />
      </div>
    </div>
  )
}
