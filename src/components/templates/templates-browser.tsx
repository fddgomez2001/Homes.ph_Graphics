"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Check, LayoutTemplate, Loader2, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app-shell/page-header"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getTemplateContext } from "@/lib/data/settings"
import { swr } from "@/lib/cache"
import { deleteTemplate, listTemplates, renameTemplate } from "@/lib/data/templates"
import { BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE_CONTEXT, type TemplateContext } from "@/lib/design/templates"
import type { TemplateRow } from "@/lib/types"
import { errorMessage } from "@/lib/utils"
import { useBuiltInPreviews } from "./use-template-previews"

export function TemplatesBrowser() {
  const confirm = useConfirm()
  const [ctx, setCtx] = useState<TemplateContext>(DEFAULT_TEMPLATE_CONTEXT)
  const previews = useBuiltInPreviews(ctx, 400)
  const [saved, setSaved] = useState<TemplateRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    getTemplateContext().then(setCtx)
  }, [])
  useEffect(() => swr("templates", listTemplates, setSaved, (e) => setError(errorMessage(e))), [version])

  const saveName = async () => {
    if (!renaming?.name.trim()) return
    try {
      await renameTemplate(renaming.id, renaming.name.trim())
      setRenaming(null)
      setVersion((v) => v + 1)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Templates" description="Starting layouts for covers and cards" />
      <div className="flex flex-col gap-8 p-4 lg:p-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          In the editor, open the <span className="font-medium text-foreground">Templates</span> tab to add a new slide from a template or apply
          one to the current slide (your text and photo are kept). New carousels always start with the Homes.ph cover.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Homes.ph templates</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {BUILT_IN_TEMPLATES.map((t) => (
              <div key={t.id} className="overflow-hidden rounded-xl border bg-card shadow-2xs">
                <div className="aspect-square bg-muted">
                  {previews[t.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[t.id]} alt={`${t.name} preview`} className="size-full object-cover" />
                  ) : (
                    <div className="size-full animate-pulse bg-slate-200 dark:bg-slate-800" />
                  )}
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                  <span className="mt-1 text-[11px] font-medium text-primary">{t.slideType === "cover" ? "Cover" : "Card"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Saved by you</h2>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!saved && !error && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          {saved?.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card py-10 text-center">
              <LayoutTemplate className="size-7 text-muted-foreground" />
              <p className="text-sm font-medium">No saved templates yet</p>
              <p className="text-xs text-muted-foreground">Customize a slide in the editor, then choose “Save slide as template”.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {saved?.map((t) => (
              <div key={t.id} className="overflow-hidden rounded-xl border bg-card shadow-2xs">
                <div className="aspect-square bg-muted">
                  {t.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.thumbnail} alt={`${t.name} preview`} className="size-full object-cover" />
                  )}
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {renaming?.id === t.id ? (
                    <form
                      className="flex gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void saveName()
                      }}
                    >
                      <Input
                        autoFocus
                        value={renaming.name}
                        onChange={(e) => setRenaming({ id: t.id, name: e.target.value })}
                        className="h-7 text-xs"
                        maxLength={120}
                        aria-label="Template name"
                      />
                      <Button type="submit" size="icon-xs" aria-label="Save name">
                        <Check />
                      </Button>
                      <Button type="button" size="icon-xs" variant="ghost" onClick={() => setRenaming(null)} aria-label="Cancel">
                        <X />
                      </Button>
                    </form>
                  ) : (
                    <span className="truncate text-sm font-medium">{t.name}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {t.slide_type === "cover" ? "Cover" : "Card"} · saved {format(new Date(t.created_at), "MMM d, yyyy")}
                  </span>
                  <div className="flex gap-1">
                    <Button size="xs" variant="outline" onClick={() => setRenaming({ id: t.id, name: t.name })}>
                      <Pencil /> Rename
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete "${t.name}"?`,
                          description: "Slides already made from this template are not affected.",
                          confirmLabel: "Delete template",
                          destructive: true,
                        })
                        if (!ok) return
                        try {
                          await deleteTemplate(t.id)
                          setVersion((v) => v + 1)
                        } catch (e) {
                          toast.error(errorMessage(e))
                        }
                      }}
                    >
                      <Trash2 /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
