"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, HardDrive, ImagePlus, Loader2, Plus, Replace, Search, Upload, Wallpaper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cloudinaryPreviewUrl } from "@/lib/cloudinary/url"
import { swr } from "@/lib/cache"
import { getIntegrationStatus, listAssets, type IntegrationStatus } from "@/lib/data/assets"
import { useDebouncedValue } from "@/lib/hooks"
import type { AssetRow } from "@/lib/types"
import { cn, errorMessage, formatBytes } from "@/lib/utils"
import { ASSET_DRAG_TYPE, defaultTarget, filesFromDataTransfer, importImageFiles, libraryEvents, placeAsset } from "../image-import"
import { useEditor, useEditorStore, useSelectedElement } from "../store"
import { useImageFilePicker } from "../use-file-picker"

export function ImagesPanel() {
  const store = useEditorStore()
  const uploads = useEditor((s) => s.uploads)
  const currentSlideId = useEditor((s) => s.currentSlideId)
  const selected = useSelectedElement()
  const [assets, setAssets] = useState<AssetRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const term = useDebouncedValue(search.trim())
  const [version, setVersion] = useState(0)
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [dropOver, setDropOver] = useState(false)
  const picker = useImageFilePicker((files) => void importImageFiles(store, files, defaultTarget(store)), true)

  useEffect(() => {
    getIntegrationStatus().then(setStatus)
    const refresh = () => setVersion((v) => v + 1)
    libraryEvents.addEventListener("changed", refresh)
    return () => libraryEvents.removeEventListener("changed", refresh)
  }, [])

  useEffect(
    () =>
      swr(
        `assets:${term}`,
        () => listAssets(term),
        (rows) => {
          setAssets(rows)
          setError(null)
        },
        (e) => setError(errorMessage(e)),
      ),
    [term, version],
  )

  const active = Object.values(uploads).filter((u) => u.status !== "done")
  const replaceTarget = selected?.type === "image" ? selected : null

  return (
    <div className="flex h-full flex-col">
      {picker.input}
      <div className="flex flex-col gap-3 p-3">
        <h2 className="text-sm font-semibold">Images</h2>
        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return
            e.preventDefault()
            setDropOver(true)
          }}
          onDragLeave={() => setDropOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDropOver(false)
            const files = filesFromDataTransfer(e.dataTransfer)
            if (files.length) void importImageFiles(store, files, defaultTarget(store))
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
            dropOver ? "border-primary bg-accent" : "border-border",
          )}
        >
          <Upload className="size-5 text-muted-foreground" />
          <Button size="sm" onClick={picker.open}>
            <ImagePlus /> Upload image
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Or drop JPG, PNG or WebP here, drag onto the canvas, or paste with Ctrl+V. Originals are kept at full resolution.
          </p>
        </div>

        {status && !status.cloudinary && (
          <div className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 p-2 text-[11px] text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Cloudinary isn&apos;t configured ({status.missingCloudinary.join(", ")}), so new images aren&apos;t saved to your library
              yet.
            </span>
          </div>
        )}

        {active.length > 0 && (
          <ul className="flex flex-col gap-1.5" aria-label="Uploads">
            {active.map((u) => (
              <li key={u.id} className="rounded-md border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{u.name}</span>
                  {u.status === "local" ? (
                    <HardDrive className="size-3 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Saved on this computer" />
                  ) : (
                    u.status !== "error" && <Loader2 className="size-3 shrink-0 animate-spin" />
                  )}
                </div>
                {u.status === "local" ? (
                  <p className="mt-1 text-amber-700 dark:text-amber-300">Saved on this computer — uploads to Cloudinary automatically. {u.error}</p>
                ) : u.status === "error" ? (
                  <p className="mt-1 text-destructive">{u.error}</p>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-3 pt-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Library</h3>
      </div>
      <div className="relative px-3 py-2">
        <Search className="pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by file name" className="h-8 pl-7 text-xs" aria-label="Search library" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!assets && !error && <Loader2 className="mx-auto mt-6 size-4 animate-spin text-muted-foreground" />}
        {assets?.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">{term ? "No matching images." : "Uploaded images will appear here."}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {assets?.map((asset) => (
            <div
              key={asset.id}
              className="group/asset relative overflow-hidden rounded-md border bg-checker"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(asset))
                e.dataTransfer.effectAllowed = "copy"
              }}
            >
              <button
                type="button"
                className="block aspect-square w-full"
                onClick={() => void placeAsset(store, asset, defaultTarget(store))}
                title={`${asset.original_filename ?? "Image"} · ${asset.width}×${asset.height} · ${formatBytes(asset.bytes)}`}
                aria-label={`Add ${asset.original_filename ?? "image"} to the slide`}
              >
                {/* Preview variant for the grid only; the slide always uses the original. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cloudinaryPreviewUrl(asset.secure_url, 300)} alt="" loading="lazy" className="size-full object-cover" draggable={false} />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition-opacity group-hover/asset:opacity-100 group-focus-within/asset:opacity-100">
                <AssetAction label="Set as background photo" onClick={() => void placeAsset(store, asset, { mode: "background", slideId: currentSlideId })}>
                  <Wallpaper />
                </AssetAction>
                <AssetAction label="Add as new image" onClick={() => void placeAsset(store, asset, { mode: "object", slideId: currentSlideId })}>
                  <Plus />
                </AssetAction>
                {replaceTarget && (
                  <AssetAction
                    label={`Replace "${replaceTarget.name}"`}
                    onClick={() => void placeAsset(store, asset, { mode: "replace", slideId: currentSlideId, elementId: replaceTarget.id })}
                  >
                    <Replace />
                  </AssetAction>
                )}
              </div>
            </div>
          ))}
        </div>
        {assets && assets.length > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Removing an image from a slide never deletes it from your library. Manage the library from the Image Library page.
          </p>
        )}
      </div>
    </div>
  )
}

function AssetAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon-xs" variant="secondary" className="bg-card/90" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
