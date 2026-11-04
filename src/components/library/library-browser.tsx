"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, Copy, ExternalLink, ImagePlus, Images, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app-shell/page-header"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cloudinaryPreviewUrl } from "@/lib/cloudinary/url"
import {
  deleteAsset,
  getAssetUsage,
  getIntegrationStatus,
  listAssets,
  uploadAsset,
  type IntegrationStatus,
} from "@/lib/data/assets"
import { swr } from "@/lib/cache"
import { forgetUrl } from "@/lib/local-images"
import { ACCEPTED_IMAGE_EXTENSIONS, ACCEPTED_IMAGE_TYPES } from "@/lib/design/constants"
import { useDebouncedValue } from "@/lib/hooks"
import { checkImageFile } from "@/lib/image-validation"
import type { AssetRow } from "@/lib/types"
import { cn, errorMessage, formatBytes, shortId } from "@/lib/utils"

interface Upload {
  id: string
  name: string
  progress: number
  error?: string
}

export function LibraryBrowser() {
  const confirm = useConfirm()
  const [search, setSearch] = useState("")
  const term = useDebouncedValue(search.trim())
  const [assets, setAssets] = useState<AssetRow[] | null>(null)
  const [usage, setUsage] = useState<Map<string, number>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [preview, setPreview] = useState<AssetRow | null>(null)
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [dropOver, setDropOver] = useState(false)

  useEffect(() => {
    getIntegrationStatus().then(setStatus)
  }, [])

  useEffect(() => {
    let cancelled = false
    const stop = swr(
      `assets:${term}`,
      () => listAssets(term),
      async (rows, fresh) => {
        setAssets(rows)
        setError(null)
        if (!fresh) return
        const counts = await getAssetUsage(rows.map((r) => r.cloudinary_public_id)).catch(() => new Map<string, number>())
        if (!cancelled) setUsage(counts)
      },
      (e) => setError(errorMessage(e)),
    )
    return () => {
      cancelled = true
      stop()
    }
  }, [term, version])

  const upload = async (files: File[]) => {
    for (const file of files) {
      const problem = checkImageFile(file)
      if (problem) {
        toast.error(problem)
        continue
      }
      const id = shortId()
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }])
      try {
        const { duplicate } = await uploadAsset(file, (progress) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress } : x))))
        setUploads((u) => u.filter((x) => x.id !== id))
        toast.success(duplicate ? `"${file.name}" is already in your library` : `"${file.name}" uploaded`)
        setVersion((v) => v + 1)
      } catch (e) {
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: errorMessage(e) } : x)))
      }
    }
  }

  const remove = async (asset: AssetRow) => {
    const used = usage.get(asset.cloudinary_public_id) ?? 0
    const ok = await confirm({
      title: "Delete this image permanently?",
      description:
        used > 0
          ? `It's used on ${used} slide${used === 1 ? "" : "s"}. Those slides will show an empty photo frame. The original is removed from Cloudinary and can't be recovered.`
          : "The original is removed from Cloudinary and can't be recovered. No slides use it.",
      confirmLabel: "Delete image",
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteAsset(asset.id)
      // Also removed from this computer.
      void forgetUrl(asset.secure_url).catch(() => {})
      setPreview(null)
      setVersion((v) => v + 1)
      toast.success("Image deleted")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Image Library" description="Original photos stored in Cloudinary, reusable on any slide" search={search} onSearchChange={setSearch} searchPlaceholder="Search by file name…" />
      <div
        className="flex flex-1 flex-col gap-4 p-4 lg:p-6"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          setDropOver(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDropOver(false)
          void upload(Array.from(e.dataTransfer.files))
        }}
      >
        {status && !status.cloudinary && (
          <div className="flex gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Cloudinary isn&apos;t configured yet</p>
              <p>
                Add {status.missingCloudinary.join(", ")} to <code>.env.local</code> and restart the app. Until then, uploads can&apos;t be
                stored.
              </p>
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-card p-6 text-center transition-colors sm:flex-row sm:text-left",
            dropOver && "border-primary bg-accent",
          )}
        >
          <Upload className="size-6 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Drop images here to add them to your library</p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG (transparency kept) or WebP, up to 25 MB. Originals are stored untouched at full resolution. Re-uploading the same
              file reuses the existing copy.
            </p>
          </div>
          <Button asChild>
            <label className="cursor-pointer">
              <ImagePlus /> Upload images
              <input
                type="file"
                multiple
                hidden
                accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_IMAGE_EXTENSIONS].join(",")}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ""
                  void upload(files)
                }}
              />
            </label>
          </Button>
        </div>

        {uploads.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Uploads">
            {uploads.map((u) => (
              <li key={u.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{u.name}</span>
                  {u.error ? (
                    <Button size="xs" variant="ghost" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}>
                      Dismiss
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {u.progress >= 1 ? "Saving to Cloudinary…" : `${Math.round(u.progress * 100)}%`}
                    </span>
                  )}
                </div>
                {u.error ? (
                  <p className="mt-1 text-xs text-destructive">{u.error}</p>
                ) : (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {!assets && !error && <Loader2 className="mx-auto mt-8 size-5 animate-spin text-muted-foreground" />}
        {assets?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Images className="size-8 text-muted-foreground" />
            <p className="font-medium">{term ? "No images match your search" : "Your library is empty"}</p>
            <p className="text-sm text-muted-foreground">
              {term ? "Try another file name." : "Images you upload here or in the editor appear in this library."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {assets?.map((asset) => {
            const used = usage.get(asset.cloudinary_public_id) ?? 0
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => setPreview(asset)}
                className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-2xs transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="bg-checker relative aspect-square">
                  {/* Preview variant only — editing and export always use the original. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cloudinaryPreviewUrl(asset.secure_url, 480)} alt="" loading="lazy" className="size-full object-cover" />
                  <span
                    className={cn(
                      "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      used ? "bg-primary text-primary-foreground" : "bg-card/90 text-slate-600 dark:text-slate-300",
                    )}
                  >
                    {used ? `Used on ${used} slide${used === 1 ? "" : "s"}` : "Not used yet"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 p-2.5">
                  <span className="truncate text-xs font-medium">{asset.original_filename ?? "Untitled image"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {asset.width} × {asset.height} · {formatBytes(asset.bytes)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Uploaded {format(new Date(asset.created_at), "MMM d, yyyy")}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-6">{preview.original_filename ?? "Image"}</DialogTitle>
                <DialogDescription>
                  Original: {preview.width} × {preview.height} px · {preview.format?.toUpperCase()} · {formatBytes(preview.bytes)} · uploaded{" "}
                  {format(new Date(preview.created_at), "PPp")}
                </DialogDescription>
              </DialogHeader>
              <div className="bg-checker flex max-h-[60vh] items-center justify-center overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cloudinaryPreviewUrl(preview.secure_url, 1400)} alt={preview.original_filename ?? ""} className="max-h-[60vh] object-contain" />
              </div>
              <p className="text-xs text-muted-foreground">
                To use this image, open a carousel and pick it from the editor&apos;s Images tab (or drag it onto the canvas). Removing it from
                a slide keeps it here.
              </p>
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="destructive" onClick={() => void remove(preview)}>
                  <Trash2 /> Delete from library
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigator.clipboard.writeText(preview.secure_url).then(
                        () => toast.success("Original URL copied"),
                        () => toast.error("Couldn't access the clipboard"),
                      )
                    }
                  >
                    <Copy /> Copy original URL
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={preview.secure_url} target="_blank" rel="noreferrer">
                      <ExternalLink /> Open original
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
