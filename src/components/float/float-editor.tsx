"use client"

import { useEffect, useRef, useState } from "react"
import { ClipboardPaste, GripHorizontal, Loader2, Maximize2, Plus, X } from "lucide-react"
import { AiSuggestion } from "@/components/ai/ai-suggestion"
import { DescriptionHint } from "@/components/editor/description-hint"
import { suggestCaption, suggestCardDescription, suggestCoverSubtitle } from "@/lib/ai/client"
import { descriptionStatus } from "@/lib/design/content-rules"
import { Textarea } from "@/components/ui/textarea"
import { measureTextHeight } from "@/lib/design/measure"
import type { SlideDesign, TextElement } from "@/lib/design/types"
import { getFloatBridge, slideTextFields, useFloatAvailable, type FloatBridge, type FloatState } from "@/lib/float"
import { cn } from "@/lib/utils"

const FIELD_LABELS: Record<string, string> = {
  headline: "Headline line 1",
  highlight: "Headline line 2",
  subtitle: "Subtitle",
  title: "Title",
  description: "Description",
  stat: "Number",
}

const SAVE_TEXT: Record<FloatState["saveStatus"], string> = {
  saved: "Saved",
  dirty: "Saving soon…",
  saving: "Saving…",
  error: "Not saved — retrying",
  conflict: "Conflict — open the editor",
}

/**
 * The floating quick-edit window: only the current slide's fields and a live
 * preview. Every edit goes straight to the full editor, which saves it.
 */
export function FloatEditor() {
  // Read after hydration (the server can't know it runs inside the Windows app).
  const bridge = useFloatAvailable() ? getFloatBridge() : null
  const [state, setState] = useState<FloatState | null>(null)
  const [viewSlideId, setViewSlideId] = useState<string | null>(null)
  // Follow the editor whenever it changes slide (e.g. after adding a card).
  const [followed, setFollowed] = useState<string | null>(null)
  if (state && state.currentSlideId !== followed) {
    setFollowed(state.currentSlideId)
    setViewSlideId(null)
  }

  useEffect(() => {
    if (!bridge) return
    const off = bridge.onState(setState)
    bridge.requestState()
    return off
  }, [bridge])

  if (!bridge) {
    return <Centered>The floating editor is part of the Daily Carousel Maker Windows app.</Centered>
  }
  if (!state) {
    return (
      <Shell bridge={bridge} title="Quick edit">
        <Centered>
          <Loader2 className="size-5 animate-spin text-slate-400 dark:text-slate-500" />
          <span>Open a carousel in the editor to edit it here.</span>
        </Centered>
      </Shell>
    )
  }

  const slide = state.slides.find((s) => s.id === (viewSlideId ?? state.currentSlideId)) ?? state.slides[0]
  const isCover = slide.id === state.slides[0].id
  const slideIndex = state.slides.indexOf(slide)
  const selectSlide = (id: string) => {
    setViewSlideId(id)
    bridge.send({ type: "select-slide", slideId: id })
  }

  return (
    <Shell bridge={bridge} title={state.title} status={SAVE_TEXT[state.saveStatus]} statusTone={state.saveStatus}>
      <div className="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-1" role="tablist" aria-label="Slides">
        {state.slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === slide.id}
            onClick={() => selectSlide(s.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              s.id === slide.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700",
            )}
          >
            {i === 0 ? "Cover" : `Card ${i}`}
          </button>
        ))}
        <button
          type="button"
          hidden={state.slides[0]?.design.templateId?.endsWith("-news")}
          onClick={() => bridge.send({ type: "add-card", afterSlideId: slide.id })}
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary"
          aria-label="Add card"
          title="Add a card after this slide"
        >
          <Plus className="size-3.5" /> Card
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto px-3 pt-2 pb-4">
        <Preview design={slide.design} slideId={slide.id} bridge={bridge} />

        <div className="flex flex-col gap-3">
          {slideTextFields(slide.design).map((el) => (
            <Field
              key={`${slide.id}:${el.id}`}
              el={el}
              templateId={slide.design.templateId}
              onChange={(text) => bridge.send({ type: "set-text", slideId: slide.id, elementId: el.id, text })}
              ai={fieldAi(state, slideIndex, el)}
            />
          ))}
          {slideTextFields(slide.design).length === 0 && <p className="text-xs text-muted-foreground">This slide has no text fields.</p>}
        </div>

        {/* One caption per carousel: it belongs with the cover. */}
        {isCover && (
          <CaptionField
            caption={state.caption}
            onChange={(text) => bridge.send({ type: "set-caption", text })}
            aiRequest={() => suggestCaption(state.slides, state.caption)}
          />
        )}
      </div>
    </Shell>
  )
}

function Shell({
  bridge,
  title,
  status,
  statusTone,
  children,
}: {
  bridge: FloatBridge
  title: string
  status?: string
  statusTone?: FloatState["saveStatus"]
  children: React.ReactNode
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50 dark:bg-white/[0.03] text-foreground">
      <header className="flex h-11 shrink-0 items-center gap-2 bg-[#0B1767] pr-1.5 pl-3 text-white [-webkit-app-region:drag]">
        <GripHorizontal className="size-4 shrink-0 text-white/50" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-tight font-semibold">{title}</div>
          {status && (
            <div className={cn("text-[10px] leading-tight", statusTone === "error" || statusTone === "conflict" ? "text-amber-300" : "text-white/60")} role="status">
              {status}
            </div>
          )}
        </div>
        <div className="flex items-center [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={() => bridge.openMain()}
            className="flex size-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Open the full editor"
            title="Open the full editor"
          >
            <Maximize2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => bridge.close()}
            className="flex size-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Turn off the floating editor"
            title="Turn off the floating editor"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">{children}</div>
}

/** Live preview, re-rendered (latest wins) whenever the slide changes. Also the paste target for images. */
function Preview({ design, slideId, bridge }: { design: SlideDesign; slideId: string; bridge: FloatBridge }) {
  const [src, setSrc] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  const latest = useRef(design)
  const running = useRef(false)

  useEffect(() => {
    latest.current = design
    if (running.current) return
    running.current = true
    ;(async () => {
      const { renderThumbnail } = await import("@/lib/design/render")
      let rendered: SlideDesign | null = null
      while (rendered !== latest.current) {
        rendered = latest.current
        const url = await renderThumbnail(rendered, 720, 0.85).catch(() => null)
        if (url) setSrc(url)
      }
      running.current = false
    })()
  }, [design])

  const sendImage = async (blob: Blob, name?: string) => {
    setPasting(true)
    try {
      bridge.send({ type: "paste-image", slideId, name: name || `pasted-image-${Date.now()}.png`, mime: blob.type || "image/png", bytes: await blob.arrayBuffer() })
    } finally {
      setTimeout(() => setPasting(false), 600)
    }
  }

  // Ctrl+V anywhere outside a text field puts the copied image behind the slide.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) return
      const data = e.clipboardData
      if (!data) return
      const file = Array.from(data.items).find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile()
      if (file) {
        e.preventDefault()
        void sendImage(file, file.name)
        return
      }
      const html = data.getData("text/html")
      const match = /<img[^>]+src="([^"]+)"/i.exec(html)
      if (match && /^(https?:|data:image\/)/i.test(match[1])) {
        e.preventDefault()
        bridge.send({ type: "paste-image-url", slideId, url: match[1].replace(/&amp;/g, "&") })
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  })

  const pasteFromButton = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"))
        if (type) return void sendImage(await item.getType(type))
      }
      alert("There's no image on the clipboard. Copy an image first (in Figma: Copy as PNG).")
    } catch {
      alert("Couldn't read the clipboard. Click the preview and press Ctrl+V instead.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
        tabIndex={0}
        aria-label="Slide preview. Press Ctrl+V to paste an image as the background."
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-slate-400 dark:text-slate-500" />
          </div>
        )}
        {pasting && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/60 text-xs font-medium text-slate-700 dark:text-slate-200">
            <Loader2 className="mr-1.5 size-4 animate-spin" /> Adding image…
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => void pasteFromButton()}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-card/60 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary"
      >
        <ClipboardPaste className="size-3.5" /> Paste image as background
        <span className="font-normal text-slate-400 dark:text-slate-500">· or Ctrl+V on the preview</span>
      </button>
    </div>
  )
}

/**
 * A field that keeps its own text while focused (so incoming updates never
 * move the cursor) and follows the editor otherwise.
 */
function useSyncedDraft(value: string) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const [seen, setSeen] = useState(value)
  if (!focused && value !== seen) {
    setSeen(value)
    setDraft(value)
  }
  return { draft, setDraft, focus: () => setFocused(true), blur: () => setFocused(false) }
}

interface FieldAi {
  label: string
  emphasis: boolean
  request: () => Promise<string>
}

/** AI help for the card description and the cover subtitle (same as in the editor). */
function fieldAi(state: FloatState, slideIndex: number, el: TextElement): FieldAi | undefined {
  const design = state.slides[slideIndex]?.design
  if (slideIndex > 0 && el.role === "description" && design?.templateId === "homes-card") {
    const { lines } = descriptionStatus(el, measureTextHeight)
    return {
      label: lines > 3 ? "Shorten with AI" : lines < 2 ? "Write it with AI" : "Rewrite with AI",
      emphasis: lines > 3 || lines < 2,
      request: () => suggestCardDescription(state.slides, slideIndex, el, measureTextHeight),
    }
  }
  if (slideIndex === 0 && el.role === "description") {
    return { label: el.text.trim() ? "Improve subtitle with AI" : "Write subtitle with AI", emphasis: false, request: () => suggestCoverSubtitle(state.slides) }
  }
  return undefined
}

function Field({ el, templateId, onChange, ai }: { el: TextElement; templateId?: string | null; onChange: (text: string) => void; ai?: FieldAi }) {
  const { draft, setDraft, focus, blur } = useSyncedDraft(el.text)
  const label = el.role === "description" && templateId !== "homes-card" ? "Subtitle" : (FIELD_LABELS[el.role ?? ""] ?? el.name)
  const id = `float-${el.id}`
  const isDescription = el.role === "description"
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </label>
      <Textarea
        id={id}
        value={draft}
        rows={isDescription ? 3 : 1}
        onFocus={focus}
        onBlur={blur}
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(e.target.value)
        }}
        className="min-h-0 resize-none bg-card text-sm"
      />
      {isDescription && templateId === "homes-card" && <DescriptionHint el={{ ...el, text: draft }} measure={measureTextHeight} />}
      {ai && (
        <AiSuggestion
          label={ai.label}
          emphasis={ai.emphasis}
          request={ai.request}
          onUse={(text) => {
            setDraft(text)
            onChange(text)
          }}
        />
      )}
    </div>
  )
}

function CaptionField({ caption, onChange, aiRequest }: { caption: string; onChange: (text: string) => void; aiRequest: () => Promise<string> }) {
  const { draft, setDraft, focus, blur } = useSyncedDraft(caption)
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <label htmlFor="float-caption" className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span>Post caption</span>
        <span className="font-normal tracking-normal normal-case">{draft.trim() ? `${draft.length} characters` : "Required"}</span>
      </label>
      <Textarea
        id="float-caption"
        value={draft}
        rows={5}
        onFocus={focus}
        onBlur={blur}
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(e.target.value)
        }}
        placeholder="Paste or write the caption…"
        className="min-h-24 bg-card text-sm"
      />
      {!draft.trim() && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">Every carousel needs a caption before it can be scheduled.</p>
      )}
      <AiSuggestion
        label={draft.trim() ? "Rewrite caption with AI" : "Write caption with AI"}
        emphasis={!draft.trim()}
        request={aiRequest}
        onUse={(text) => {
          setDraft(text)
          onChange(text)
        }}
      />
    </div>
  )
}
