"use client"

import { AlertTriangle, Check, Copy, WandSparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AiSuggestion } from "@/components/ai/ai-suggestion"
import { useConfirm } from "@/components/confirm-dialog"
import { suggestCaption } from "@/lib/ai/client"
import { draftCaption } from "@/lib/design/caption"
import { useEditor, useEditorStore } from "../store"

const FACEBOOK_LIMIT = 63206

/** The post caption is stored with the project, separate from the slide designs. */
export function CaptionPanel() {
  const store = useEditorStore()
  const caption = useEditor((s) => s.project.caption)
  const topic = useEditor((s) => s.project.topic)
  const [copied, setCopied] = useState(false)
  const confirm = useConfirm()

  const draft = async () => {
    const text = draftCaption(store.getState().slides)
    if (!text) return void toast.info("Add text to the cover and cards first.")
    if (caption.trim()) {
      const ok = await confirm({
        title: "Replace the caption with a draft?",
        description: "The draft is built from the cover description and card titles. You can undo by editing it.",
        confirmLabel: "Replace caption",
      })
      if (!ok) return
    }
    store.getState().setMeta({ caption: text })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't access the clipboard. Select the text and press Ctrl+C instead.")
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="caption">Facebook caption</Label>
          <div className="flex gap-1">
            <Button variant="outline" size="xs" onClick={() => void draft()}>
              <WandSparkles /> Draft from slides
            </Button>
            <Button variant="outline" size="xs" onClick={copy} disabled={!caption}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <AiSuggestion
          label={caption.trim() ? "Rewrite caption with AI" : "Write caption with AI"}
          emphasis={!caption.trim()}
          request={() => suggestCaption(store.getState().slides, store.getState().project.caption)}
          onUse={(text) => store.getState().setMeta({ caption: text })}
          note={(text) => <p className="text-[11px] text-muted-foreground">{text.length} characters · reads every slide</p>}
        />
        {!caption.trim() && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            Every carousel needs a caption. Write one, or use “Draft from slides” and edit it.
          </p>
        )}
        <Textarea
          id="caption"
          value={caption}
          onChange={(e) => store.getState().setMeta({ caption: e.target.value })}
          rows={14}
          maxLength={FACEBOOK_LIMIT}
          placeholder="Discover 6 traditional Filipino instruments with stories behind their sound! From the melodic kulintang and powerful gangsa to …"
          className="min-h-64 text-sm leading-relaxed"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{caption.trim() ? `${caption.trim().split(/\s+/).length} words` : "Empty"}</span>
          <span className="tabular-nums">
            {caption.length.toLocaleString()} characters
            {caption.length > 0 && caption.length <= 125 ? " · fits the preview" : caption.length > 125 ? " · “See more” after ~125" : ""}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="topic">
          Topic <span className="font-normal text-muted-foreground">(for your own reference)</span>
        </Label>
        <Input id="topic" value={topic ?? ""} onChange={(e) => store.getState().setMeta({ topic: e.target.value })} maxLength={500} />
      </div>
    </div>
  )
}
