"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Cloud, FolderOpen, HardDrive, Loader2, RotateCcw, Users } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useDesktop } from "@/lib/desktop"
import { useDesktopSetup } from "@/lib/local/use-local-mode"
import { errorMessage } from "@/lib/utils"

const reason = (e: unknown) => errorMessage(e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")

/** Desktop app: where the work is saved (a folder on this computer, or the team cloud) and the welcome setup again. */
export function WorkFolderSection() {
  const desktop = useDesktop()
  const confirm = useConfirm()
  const router = useRouter()
  const [setup, setSetup] = useDesktopSetup()
  const [busy, setBusy] = useState(false)
  if (!desktop?.setup || !setup) return null
  const bridge = desktop.setup
  const local = setup.mode === "local"

  const change = async () => {
    const picked = await bridge.chooseFolder().catch((e) => {
      toast.error(reason(e))
      return null
    })
    if (!picked || picked === setup.storage.folder) return
    const ok = await confirm({
      title: "Save your work in this folder?",
      description: (
        <>
          <span className="block break-all font-mono text-xs text-foreground">{picked}</span>
          <span className="mt-2 block">Your work is copied there (the old folder stays as a backup). If that folder already has saved work, the app opens that work instead.</span>
        </>
      ),
      confirmLabel: "Use this folder",
    })
    if (!ok) return
    setBusy(true)
    try {
      setSetup(await bridge.save({ folder: picked }))
      toast.success("Your work is saved in the new folder now.")
      // Everything on screen comes from the new folder.
      window.location.reload()
    } catch (e) {
      toast.error(reason(e))
      setBusy(false)
    }
  }

  return (
    <section id="work-folder" className="scroll-mt-20 rounded-xl border bg-card p-5" aria-labelledby="work-folder-heading">
      <h2 id="work-folder-heading" className="flex items-center gap-2 font-semibold">
        {local ? <HardDrive className="size-4 text-muted-foreground" /> : <Users className="size-4 text-muted-foreground" />} Where your work is saved
      </h2>
      {local ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            No account: your carousels, news posts, templates and settings are saved in this folder on this computer
            {setup.storage.kind === "cloudinary" ? ", and your photos in your own Cloudinary." : ", photos too (in its images folder)."} To back up, copy the whole folder.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs" title={setup.storage.folder}>
              {setup.storage.folder}
            </code>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void bridge.openFolder().catch((e) => toast.error(reason(e)))}>
                <FolderOpen /> Open folder
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void change()} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Change…
              </Button>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {setup.storage.kind === "cloudinary" ? <Cloud className="size-3.5" /> : <HardDrive className="size-3.5" />}
            Photos: {setup.storage.kind === "cloudinary" ? `your Cloudinary (${setup.cloudinary.cloudName || "cloud name not set"})` : "on this computer"}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Signed in to the team cloud: carousels are saved online for the team, and photos go to the team&apos;s Cloudinary.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => router.push("/welcome")}>
          <RotateCcw /> Run the welcome setup again
        </Button>
        <span className="text-xs text-muted-foreground">Change the AI or where your work is saved, or switch between this computer and a team account.</span>
      </div>
    </section>
  )
}
