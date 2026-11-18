"use client"

import { useEffect, useState } from "react"
import { Download, FolderOpen, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useDesktop, type DesktopFolders, type FolderKind } from "@/lib/desktop"
import { errorMessage } from "@/lib/utils"

/**
 * Where files go. Desktop app: the folder for every download (PNG, ZIP, carousel
 * folders) and the Poster Maker's own folder. In a browser the browser decides.
 */
export function FoldersSection() {
  const desktop = useDesktop()
  const [folders, setFolders] = useState<DesktopFolders | null>(null)
  const [busy, setBusy] = useState<FolderKind | null>(null)

  useEffect(() => {
    desktop?.folders?.get().then(setFolders, () => setFolders(null))
  }, [desktop])

  const run = async (kind: FolderKind, action: "choose" | "reset") => {
    if (!desktop?.folders) return
    setBusy(kind)
    try {
      const next = action === "choose" ? await desktop.folders.choose(kind) : await desktop.folders.reset(kind)
      if (next) {
        setFolders(next)
        toast.success(kind === "posters" ? "Posters will be saved here" : kind === "report" ? "The floating report will save here" : "Downloads will be saved here", {
          description: kind === "posters" ? next.posters : kind === "report" ? next.report : next.downloads,
        })
      }
    } catch (e) {
      toast.error("Couldn't change the folder", { description: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5" id="folders">
      <h2 className="flex items-center gap-2 font-semibold">
        <Download className="size-4" /> Downloads &amp; saving
      </h2>
      {!desktop?.folders ? (
        <p className="mt-1 text-sm text-muted-foreground">
          In a web browser, files go wherever the browser saves downloads (change it in the browser&apos;s settings). In the Windows app you can choose the folders here.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">Choose where the app puts the files it makes. Stored on this computer.</p>
          <div className="flex flex-col divide-y rounded-lg border">
            <FolderRow
              title="Download folder"
              detail="Every Download PNG, ZIP and carousel folder goes here."
              path={folders?.downloads}
              chosen={folders?.downloadsChosen}
              missing={folders?.downloadsMissing}
              defaultLabel="Windows Downloads folder"
              busy={busy === "downloads"}
              onChoose={() => void run("downloads", "choose")}
              onReset={() => void run("downloads", "reset")}
              onOpen={() => void desktop.folders?.open("downloads").catch((e) => toast.error(errorMessage(e)))}
            />
            <FolderRow
              title="Poster Maker folder"
              detail="Save PNG in the Poster Maker puts the poster here (it never replaces a file)."
              path={folders?.posters}
              chosen={folders?.postersChosen}
              missing={folders?.postersMissing}
              defaultLabel="Same as the download folder"
              busy={busy === "posters"}
              onChoose={() => void run("posters", "choose")}
              onReset={() => void run("posters", "reset")}
              onOpen={() => void desktop.folders?.open("posters").catch((e) => toast.error(errorMessage(e)))}
            />
            {folders?.report !== undefined && (
              <FolderRow
                title="Daily report folder"
                detail="The floating report saves each article, poster and carousel picture it copies here, in New Article Posting, Daily Trend News and Carousel (one file per post, replaced when copied again)."
                path={folders.report}
                chosen={folders.reportChosen}
                missing={folders.reportMissing}
                defaultLabel={folders.reportDefault ?? "D:\\DAILY REPORT"}
                busy={busy === "report"}
                onChoose={() => void run("report", "choose")}
                onReset={() => void run("report", "reset")}
                onOpen={() => void desktop.folders?.open("report").catch((e) => toast.error(errorMessage(e)))}
              />
            )}
          </div>
        </>
      )}
    </section>
  )
}

function FolderRow({
  title,
  detail,
  path,
  chosen,
  missing,
  defaultLabel,
  busy,
  onChoose,
  onReset,
  onOpen,
}: {
  title: string
  detail: string
  path?: string
  chosen?: boolean
  missing?: string
  defaultLabel: string
  busy: boolean
  onChoose: () => void
  onReset: () => void
  onOpen: () => void
}) {
  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="truncate font-mono text-xs" title={path}>
          {path ?? "…"}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {chosen ? detail : `${defaultLabel}. ${detail}`}
        </div>
        {missing && (
          <div className="text-[11px] text-amber-700 dark:text-amber-300">
            {missing} can&apos;t be found right now (a drive that isn&apos;t plugged in?), so the folder above is used meanwhile.
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={onChoose} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <FolderOpen />} Change…
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpen} disabled={!path}>
          Open
        </Button>
        {(chosen || missing) && (
          <Button size="sm" variant="ghost" onClick={onReset} disabled={busy} title="Use the default folder again">
            <RotateCcw /> Default
          </Button>
        )}
      </div>
    </div>
  )
}
