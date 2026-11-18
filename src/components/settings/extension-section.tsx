"use client"

import { useEffect, useState } from "react"
import { Copy, FolderOpen, Puzzle, Unplug } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useDesktop, type ExtensionStatus } from "@/lib/desktop"
import { errorMessage } from "@/lib/utils"

/**
 * Settings → Chrome extension (desktop app): Homes.ph Publisher's folder for Chrome's "Load unpacked", how to
 * install it, and the browsers connected to the app (each one allowed once; Disconnect forgets them).
 */
export function ExtensionSection() {
  const desktop = useDesktop()
  const [status, setStatus] = useState<ExtensionStatus | null>(null)

  useEffect(() => {
    if (!desktop?.extension) return
    const load = () => desktop.extension?.status().then(setStatus, () => setStatus(null))
    void load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [desktop])

  if (!desktop?.extension) return null

  const openFolder = async () => {
    try {
      const folder = await desktop.extension!.openFolder()
      setStatus((s) => (s ? { ...s, folder, copied: true } : s))
    } catch (e) {
      toast.error("Couldn't open the extension's folder", { description: errorMessage(e) })
    }
  }

  const copyPath = async () => {
    if (!status) return
    try {
      await navigator.clipboard.writeText(status.folder)
      toast.success("Folder copied", { description: "Paste it in Chrome's Load unpacked window." })
    } catch {
      toast.error("Couldn't copy the folder")
    }
  }

  const clients = status?.clients ?? []

  return (
    <section className="rounded-xl border bg-card p-5" id="chrome-extension">
      <h2 className="flex items-center gap-2 font-semibold">
        <Puzzle className="size-4" /> Chrome extension: Homes.ph Publisher
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        A floating button in Chrome with today&apos;s articles to publish (FHI Global, PicklePlay, Homes.ph Caraga and Gensan). Click a time: it publishes the article on dash.homes.ph,
        adds it to News Article here (its template is saved in your download folder) and schedules its Facebook post on homes.ph Facebook Autopost.
      </p>
      <ol className="mb-4 ml-5 list-decimal space-y-1 text-sm">
        <li>
          <Button variant="outline" size="sm" className="mr-2 align-middle" onClick={() => void openFolder()}>
            <FolderOpen /> Open the extension&apos;s folder
          </Button>
          {status?.copied && (
            <button type="button" className="inline-flex items-center gap-1 align-middle text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => void copyPath()} title="Copy the folder's path">
              <Copy className="size-3" /> {status.folder}
            </button>
          )}
        </li>
        <li>
          In Chrome, go to <code className="rounded bg-muted px-1">chrome://extensions</code>, turn on <b>Developer mode</b>, click <b>Load unpacked</b> and choose the{" "}
          <b>Chrome Extension</b> folder itself (the one with <code className="rounded bg-muted px-1">manifest.json</code>; you can paste the path above in the window&apos;s address bar). After
          the app updates, click the extension&apos;s reload arrow there.
        </li>
        <li>
          In the extension&apos;s <b>Options</b>, click <b>Connect</b>, then <b>Allow</b> here. Sign in to dash.homes.ph and homes.ph in Chrome.
        </li>
      </ol>
      <div className="rounded-lg border px-3 py-2.5 text-sm">
        {status == null ? (
          <span className="text-muted-foreground">Checking…</span>
        ) : status.port == null ? (
          <span className="text-destructive">The connection for the extension couldn&apos;t start (ports 39390–39394 are in use). Restart the app.</span>
        ) : clients.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Connected:{" "}
              {clients.map((c) => (
                <span key={c.origin} className="mr-2 font-medium">
                  {c.name} ({c.browser})
                  {c.lastUsed ? <span className="font-normal text-muted-foreground"> · last used {new Date(c.lastUsed).toLocaleString()}</span> : null}
                </span>
              ))}
            </span>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void desktop.extension!.forget().then(
                  () => {
                    setStatus((s) => (s ? { ...s, clients: [] } : s))
                    toast.success("Disconnected", { description: "Connect again from the extension's Options." })
                  },
                  (e) => toast.error(errorMessage(e)),
                )
              }
            >
              <Unplug /> Disconnect
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">No browser connected yet (waiting on 127.0.0.1:{status.port}).</span>
        )}
      </div>
    </section>
  )
}
