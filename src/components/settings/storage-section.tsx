"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, CheckCircle2, CloudUpload, FlaskConical, HardDrive, Info, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import type { CloudinaryStatus, UploadTestResult } from "@/lib/cloudinary/types"
import { getCloudinaryStatus, testCloudinaryUpload } from "@/lib/data/assets"
import { syncPendingImages } from "@/lib/image-sync"
import { clearUploadedCopies, listPending, localImageStats, type LocalImageStats, type PendingUpload } from "@/lib/local-images"
import { cn, errorMessage, formatBytes } from "@/lib/utils"

const GB = 1024 ** 3
const FREE_PLAN_BYTES = 25 * GB

function Meter({ label, value, detail, percent }: { label: string; value: string; detail?: string; percent: number }) {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn("h-full rounded-full transition-[width]", pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

const gb = (bytes: number) => `${(bytes / GB).toFixed(bytes < 10 * GB ? 2 : 1)} GB`

/** Settings card: real Cloudinary check, storage/credit usage, and the images saved on this computer. */
export function StorageSection() {
  const confirm = useConfirm()
  const [cloud, setCloud] = useState<CloudinaryStatus | { error: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [local, setLocal] = useState<LocalImageStats | null>(null)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [syncing, setSyncing] = useState(false)
  const [test, setTest] = useState<UploadTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  const refreshLocal = useCallback(async () => {
    const [stats, waiting] = await Promise.all([localImageStats().catch(() => null), listPending().catch(() => [])])
    setLocal(stats)
    setPending(waiting)
  }, [])

  const check = useCallback(async (refresh: boolean) => {
    setChecking(true)
    try {
      setCloud(await getCloudinaryStatus(refresh))
    } catch (e) {
      setCloud({ error: errorMessage(e) })
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getCloudinaryStatus().then(
      (status) => !cancelled && setCloud(status),
      (e) => !cancelled && setCloud({ error: errorMessage(e) }),
    )
    Promise.all([localImageStats().catch(() => null), listPending().catch(() => [])]).then(([stats, waiting]) => {
      if (cancelled) return
      setLocal(stats)
      setPending(waiting)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const uploadNow = async () => {
    setSyncing(true)
    try {
      const result = await syncPendingImages({ fresh: true })
      if (result.error) toast.error("Some images couldn't upload yet", { description: result.error })
      else if (result.uploaded) toast.success(`Uploaded ${result.uploaded} image${result.uploaded === 1 ? "" : "s"} to Cloudinary`)
      else toast.info("Nothing is waiting to upload.")
    } finally {
      setSyncing(false)
      void refreshLocal()
      void check(true)
    }
  }

  const freeUp = async () => {
    const ok = await confirm({
      title: "Remove local copies?",
      description: "Images that are already in Cloudinary are removed from this computer (they download again when needed). Images still waiting to upload are kept.",
      confirmLabel: "Remove copies",
    })
    if (!ok) return
    const removed = await clearUploadedCopies().catch(() => 0)
    toast.success(`Removed ${removed} local cop${removed === 1 ? "y" : "ies"}`)
    void refreshLocal()
  }

  const usage = cloud && "ok" in cloud && cloud.ok ? cloud.usage : null
  // Credits-based plans (e.g. Free = 25 credits) share them between storage and bandwidth: 1 credit = 1 GB.
  const storageLimit = usage ? (usage.storageLimitBytes ?? (usage.credits ? usage.credits.limit * GB : null)) : null
  const app = cloud && "configured" in cloud && cloud.configured ? cloud.app : null
  // The key works but may not read the usage report: show what this app stored instead.
  const keyWorks = !!cloud && "configured" in cloud && cloud.configured && (cloud.ok || cloud.reason === "permission")

  const runTest = async () => {
    setTesting(true)
    try {
      setTest(await testCloudinaryUpload())
    } catch (e) {
      setTest({ upload: { ok: false, error: errorMessage(e) } })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5" aria-labelledby="storage-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="storage-heading" className="flex items-center gap-2 font-semibold">
            <HardDrive className="size-4 text-muted-foreground" /> Image storage
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every image you add is saved on this computer first, then uploaded to Cloudinary, so it never disappears from your slides.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void check(true)} disabled={checking} aria-label="Check Cloudinary again">
          {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {!cloud ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking Cloudinary…
          </p>
        ) : "error" in cloud && !("configured" in cloud) ? (
          <p className="text-sm text-destructive">{cloud.error}</p>
        ) : "configured" in cloud && !cloud.configured ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Cloudinary isn&apos;t set up: {cloud.missing.join(", ")} missing. Images are kept on this computer until it is.</span>
          </div>
        ) : "ok" in cloud && !cloud.ok && cloud.reason === "permission" ? (
          <>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium">Connected to Cloudinary</span>
              <span className="text-muted-foreground">cloud “{cloud.cloudName}” · API key accepted</span>
            </p>
            <div className="flex gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-200" role="status">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">Exact plan totals aren&apos;t available for this API key</span>
                <span className="text-amber-900/80 dark:text-amber-200/80">{cloud.hint}</span>
                <span className="text-xs text-amber-900/60 dark:text-amber-200/60">Cloudinary said: {cloud.error}</span>
              </div>
            </div>
          </>
        ) : "ok" in cloud && !cloud.ok ? (
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-destructive">
                {cloud.reason === "unreachable"
                  ? "Cloudinary can't be reached right now."
                  : `Cloudinary isn't accepting uploads for cloud name “${cloud.cloudName}”: ${cloud.error}`}
              </span>
              <span className="text-muted-foreground">{cloud.hint}</span>
              <span className="text-muted-foreground">Until this is fixed, new images are kept on this computer and upload automatically afterwards.</span>
            </div>
          </div>
        ) : usage && "cloudName" in cloud ? (
          <>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium">Connected to Cloudinary</span>
              <span className="text-muted-foreground">
                cloud “{cloud.cloudName}”{usage.plan ? ` · ${usage.plan} plan` : ""}
                {usage.lastUpdated ? ` · usage as of ${format(new Date(usage.lastUpdated), "MMM d")}` : ""}
              </span>
            </p>
            {storageLimit ? (
              <Meter
                label="Cloudinary storage"
                value={`${gb(usage.storageBytes)} of ${gb(storageLimit)}`}
                percent={(usage.storageBytes / storageLimit) * 100}
                detail={`${usage.images != null ? `${usage.images.toLocaleString()} files · ` : ""}${gb(storageLimit - usage.storageBytes)} free`}
              />
            ) : (
              <Meter label="Cloudinary storage" value={gb(usage.storageBytes)} percent={0} />
            )}
            {usage.credits && (
              <Meter
                label="Monthly credits"
                value={`${usage.credits.used.toFixed(2)} of ${usage.credits.limit} used (${usage.credits.usedPercent.toFixed(1)}%)`}
                percent={usage.credits.usedPercent}
                detail={`Credits are shared: 1 credit = 1 GB of storage, 1 GB of bandwidth (${gb(usage.bandwidthBytes)} used this month) or 1,000 transformations.`}
              />
            )}
          </>
        ) : null}

        {keyWorks && !usage && app && (
          <Meter
            label="Stored by this app"
            value={`${gb(app.bytes)} of ${gb(FREE_PLAN_BYTES)}`}
            percent={(app.bytes / FREE_PLAN_BYTES) * 100}
            detail={`${app.images.toLocaleString()} original image${app.images === 1 ? "" : "s"} uploaded from Daily Carousel Maker. Measured against Cloudinary's Free plan (25 credits ≈ 25 GB); other files in your Cloudinary account aren't counted here.`}
          />
        )}
        {usage && app && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Of that, {gb(app.bytes)} is {app.images.toLocaleString()} original image{app.images === 1 ? "" : "s"} uploaded from this app.
          </p>
        )}

        {keyWorks && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Button size="sm" variant="outline" onClick={() => void runTest()} disabled={testing}>
              {testing ? <Loader2 className="animate-spin" /> : <FlaskConical />} Test upload
            </Button>
            {test ? (
              <span className="flex flex-col gap-0.5" role="status">
                {test.upload.ok ? (
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" /> Uploads work with this key
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="size-4" /> Upload refused: {test.upload.error}
                  </span>
                )}
                {test.remove && !test.remove.ok && (
                  <span className="text-xs text-amber-800 dark:text-amber-300">
                    This key can&apos;t delete files ({test.remove.error}). “Delete from library” won&apos;t remove originals from Cloudinary.
                  </span>
                )}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Uploads a tiny test image with your key and deletes it again.</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">On this computer:</span>{" "}
              {local ? (
                <>
                  {local.files.toLocaleString()} image{local.files === 1 ? "" : "s"} ({formatBytes(local.bytes)})
                  {pending.length > 0 ? (
                    <span className="text-amber-700 dark:text-amber-300"> · {pending.length} waiting to upload</span>
                  ) : (
                    <span className="text-muted-foreground"> · all uploaded</span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">…</span>
              )}
            </span>
            <div className="flex gap-2">
              {pending.length > 0 && (
                <Button size="sm" onClick={() => void uploadNow()} disabled={syncing}>
                  {syncing ? <Loader2 className="animate-spin" /> : <CloudUpload />} Upload now
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => void freeUp()} disabled={!local?.files}>
                Free up space
              </Button>
            </div>
          </div>
          {pending.some((p) => p.lastError) && (
            <p className="text-xs text-muted-foreground">Last upload error: {pending.find((p) => p.lastError)?.lastError}</p>
          )}
        </div>
      </div>
    </section>
  )
}
