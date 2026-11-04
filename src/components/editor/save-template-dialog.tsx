"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createTemplate } from "@/lib/data/templates"
import { renderThumbnail } from "@/lib/design/render"
import { errorMessage } from "@/lib/utils"
import { useCurrentSlide } from "./store"

export const templateEvents = new EventTarget()

export function SaveTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const slide = useCurrentSlide()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    try {
      // Templates must reference stored images only (not temporary local ones).
      const design = {
        ...slide.design,
        elements: slide.design.elements.map((el) =>
          el.type === "image" && el.src?.startsWith("blob:") ? { ...el, src: null, uploadId: null } : el,
        ),
      }
      const thumbnail = await renderThumbnail(design, 320).catch(() => null)
      await createTemplate({ name: name.trim(), slideType: slide.type, design, thumbnail })
      templateEvents.dispatchEvent(new Event("changed"))
      toast.success(`Template "${name.trim()}" saved`)
      setName("")
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Save slide as template</DialogTitle>
            <DialogDescription>Reuse this layout later from the Templates tab. Text, photos and styling are saved.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />} Save template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
