"use client"

import { useRef, useState } from "react"
import { CheckCircle2, Crop, ImageUp, Loader2, RotateCcw, Scissors, Sparkles, Sun, Trash, TriangleAlert, Wallpaper, WandSparkles, X } from "lucide-react"
import { toast } from "sonner"
import { loadImage } from "@/lib/design/image-cache"
import { autoLightColor, removeBackground, removePlainBackground, ToolCancelled } from "@/lib/image-tools"
import { canEnhancePhoto, EnhanceCancelled, enhancePhoto, imageToBlob } from "@/lib/photo-enhance"
import { errorMessage } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { imageUpscaleFactor } from "@/lib/design/geometry"
import { logoSource } from "@/lib/design/logo"
import type { ImageElement } from "@/lib/design/types"
import { CANVAS_SIZE, MIN_FRAME_ZOOM } from "@/lib/design/types"
import { Section, SliderField } from "../fields"
import { importImageFiles, slideBackground } from "../image-import"
import { useCurrentSlide, useEditor, useEditorStore } from "../store"
import { useImageFilePicker } from "../use-file-picker"

export function ImageProperties({ el }: { el: ImageElement }) {
  const store = useEditorStore()
  const slide = useCurrentSlide()
  const upload = useEditor((s) => (el.uploadId ? s.uploads[el.uploadId] : undefined))
  const update = (patch: Partial<ImageElement>, history?: string) => store.getState().updateElement(el.id, patch, history ? { history } : {})
  const picker = useImageFilePicker((files) =>
    void importImageFiles(store, files.slice(0, 1), { mode: "replace", slideId: slide.id, elementId: el.id }),
  )

  return (
    <>
      {el.src && <PictureTools el={el} />}
      {el.role === "logo" && (
        <Section title="Logo color">
          {el.logoVariant ? (
            <>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={el.logoVariant}
                onValueChange={(v) => {
                  if (!v) return
                  if (v === "auto") update({ logoVariant: "auto" })
                  else update({ logoVariant: v as "white" | "blue", ...logoSource(v as "white" | "blue") })
                }}
                className="w-full"
                aria-label="Logo color"
              >
                <ToggleGroupItem value="auto" className="flex-1">
                  Auto
                </ToggleGroupItem>
                <ToggleGroupItem value="white" className="flex-1">
                  White
                </ToggleGroupItem>
                <ToggleGroupItem value="blue" className="flex-1">
                  Blue
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[11px] text-muted-foreground">
                {el.logoVariant === "auto"
                  ? `Auto picks the logo with the best contrast for the photo behind it — now showing ${el.logoResolved === "blue" ? "blue" : "white"}.`
                  : "This slide always uses this logo color."}
              </p>
            </>
          ) : (
            <Button variant="outline" size="sm" className="self-start" onClick={() => update({ logoVariant: "auto", fit: "contain", ...logoSource("white") })}>
              Use the Homes.ph logo (auto color)
            </Button>
          )}
        </Section>
      )}
      <Section title="Image">
        {picker.input}
        <ImageInfo el={el} upload={upload} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={picker.open}>
            <ImageUp /> {el.src ? "Replace" : "Upload"}
          </Button>
          {el.src && el.fit === "cover" ? (
            <Button variant="outline" size="sm" onClick={() => store.getState().setCrop(el.id)}>
              <Crop /> Adjust crop
            </Button>
          ) : (
            <span />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          You can also drag a photo from your computer or the Images tab onto the canvas.
        </p>
      </Section>

      {el.src && (
        <Section title="Fit & crop">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={el.fit}
            onValueChange={(v) => v && update({ fit: v as ImageElement["fit"] })}
            className="w-full"
            aria-label="Image fit"
          >
            <ToggleGroupItem value="cover" className="flex-1">
              Fill frame
            </ToggleGroupItem>
            <ToggleGroupItem value="contain" className="flex-1">
              Fit inside
            </ToggleGroupItem>
          </ToggleGroup>
          {el.fit === "cover" && (
            <>
              <SliderField
                label="Zoom"
                value={el.zoom}
                // A poster photo can zoom out over its blurred copy.
                min={el.blurFill ? MIN_FRAME_ZOOM : 1}
                max={5}
                step={0.01}
                onChange={(zoom) => update({ zoom }, `zoom:${el.id}`)}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <SliderField
                label="Horizontal position"
                value={Math.round(el.focusX * 100)}
                min={0}
                max={100}
                onChange={(v) => update({ focusX: v / 100 }, `focus:${el.id}`)}
                format={(v) => `${v}%`}
              />
              <SliderField
                label="Vertical position"
                value={Math.round(el.focusY * 100)}
                min={0}
                max={100}
                onChange={(v) => update({ focusY: v / 100 }, `focus:${el.id}`)}
                format={(v) => `${v}%`}
              />
              <Button variant="ghost" size="sm" className="self-start" onClick={() => update({ zoom: 1, focusX: 0.5, focusY: 0.5 })}>
                <RotateCcw /> Reset crop
              </Button>
            </>
          )}
        </Section>
      )}

      <Section title="Role">
        {el.role === "background" ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">This is the slide&apos;s background photo. It&apos;s locked so it doesn&apos;t move by accident.</p>
            {el.src && (
              <Button variant="outline" size="sm" className="self-start" onClick={() => update({ src: null, assetId: null, publicId: null, uploadId: null })}>
                <Trash /> Remove photo (keeps the frame)
              </Button>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={!el.src}
            onClick={() => {
              const s = store.getState()
              const bg = slideBackground(slide.design)
              const source = {
                src: el.src,
                assetId: el.assetId,
                publicId: el.publicId,
                uploadId: el.uploadId,
                naturalWidth: el.naturalWidth,
                naturalHeight: el.naturalHeight,
                zoom: 1,
                focusX: 0.5,
                focusY: 0.5,
              }
              s.updateDesign(slide.id, (d) => {
                const elements = d.elements.filter((x) => x.id !== el.id)
                if (bg) {
                  return { ...d, elements: elements.map((x) => (x.id === bg.id ? ({ ...x, ...source, visible: true } as ImageElement) : x)) }
                }
                const background: ImageElement = {
                  ...el,
                  ...source,
                  name: "Background image",
                  role: "background",
                  x: 0,
                  y: 0,
                  width: d.width || CANVAS_SIZE,
                  height: d.height || CANVAS_SIZE,
                  rotation: 0,
                  fit: "cover",
                  locked: true,
                }
                return { ...d, elements: [background, ...elements] }
              })
              s.select(null)
            }}
          >
            <Wallpaper /> Use as background photo
          </Button>
        )}
      </Section>
    </>
  )
}

function ImageInfo({ el, upload }: { el: ImageElement; upload?: { status: string; progress: number; error?: string } }) {
  if (!el.src) return <p className="text-xs text-muted-foreground">No photo yet.</p>
  const factor = imageUpscaleFactor(el)
  const sharp = factor <= 1.05
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted/60 p-2.5 text-xs">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Original</span>
        <span className="font-medium tabular-nums">
          {el.naturalWidth} × {el.naturalHeight} px
        </span>
      </div>
      <div className={sharp ? "flex items-start gap-1.5 text-emerald-700 dark:text-emerald-300" : "flex items-start gap-1.5 text-amber-700 dark:text-amber-300"}>
        {sharp ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <TriangleAlert className="mt-px size-3.5 shrink-0" />}
        <span>
          {sharp
            ? "Sharp: the export uses the original at full detail."
            : `Low resolution here: enlarged ${factor.toFixed(1)}× in the export. Use a bigger photo or zoom out for a crisper result.`}
        </span>
      </div>
      {upload && upload.status !== "done" && (
        <div className={upload.status === "error" ? "text-destructive" : "text-muted-foreground"}>
          {upload.status === "error"
            ? upload.error
            : upload.status === "processing"
              ? "Saving original to Cloudinary…"
              : `Uploading original… ${Math.round(upload.progress * 100)}%`}
        </div>
      )}
      {!upload && el.assetId && <div className="text-muted-foreground">Stored in your image library.</div>}
    </div>
  )
}

type Tool = "person" | "plain" | "enhance" | "auto"

/**
 * Picture tools (1.53), on this computer: cut the people out (with their hair) or a plain background (logos),
 * enhance (AI: sharper and bigger) and auto light & color. Each gives a new picture in the same place (Ctrl+Z
 * puts the old one back).
 */
function PictureTools({ el }: { el: ImageElement }) {
  const store = useEditorStore()
  const slide = useCurrentSlide()
  const [work, setWork] = useState<{ tool: Tool; label: string; progress: number } | null>(null)
  const abort = useRef<AbortController | null>(null)

  const run = async (tool: Tool) => {
    if (!el.src || work) return
    const ctrl = new AbortController()
    abort.current = ctrl
    setWork({ tool, label: "Starting…", progress: 0 })
    const progress = (fraction: number, label?: string) => setWork((w) => (w ? { ...w, progress: fraction, label: label ?? w.label } : w))
    try {
      const img = await loadImage(el.src)
      const source = await imageToBlob(img)
      let out: Blob | null = null
      let what = ""
      if (tool === "person") {
        out = (await removeBackground(source, { onProgress: progress, signal: ctrl.signal })).blob
        what = "cut out"
      } else if (tool === "plain") {
        progress(0.5, "Clearing the background…")
        out = await removePlainBackground(source)
        if (!out) {
          toast.info("The background isn't one plain color", { description: "For photos of people, use Remove background (people)." })
          return
        }
        what = "no background"
      } else if (tool === "enhance") {
        if (canEnhancePhoto(img.naturalWidth, img.naturalHeight)) {
          const r = await enhancePhoto(source, { onProgress: (f) => progress(f, "Enhancing (AI)…"), signal: ctrl.signal })
          out = r.blob
          what = "enhanced"
          // Then its light and color.
          progress(0.95, "Light & color…")
          out = await autoLightColor(out)
        } else {
          // Big pictures are sharp enough: their light and color are fixed.
          progress(0.5, "Light & color…")
          out = await autoLightColor(source)
          what = "light & color"
        }
      } else {
        progress(0.5, "Light & color…")
        out = await autoLightColor(source)
        what = "light & color"
      }
      if (ctrl.signal.aborted) return
      const keep = { zoom: el.zoom, focusX: el.focusX, focusY: el.focusY, fit: el.fit }
      const ext = out.type === "image/png" ? "png" : "jpg"
      await importImageFiles(store, [new File([out], `${el.name} (${what}).${ext}`, { type: out.type })], { mode: "replace", slideId: slide.id, elementId: el.id })
      store.getState().updateElement(el.id, keep, { history: false })
      toast.success(tool === "person" ? "Background removed" : tool === "plain" ? "Plain background removed" : "Picture enhanced", { description: "Ctrl+Z brings the old picture back." })
    } catch (e) {
      if (e instanceof ToolCancelled || e instanceof EnhanceCancelled || ctrl.signal.aborted) return
      toast.error("Couldn't change the picture", { description: errorMessage(e) })
    } finally {
      if (abort.current === ctrl) abort.current = null
      setWork(null)
    }
  }

  const button = (tool: Tool, Icon: typeof Scissors, label: string, title: string) => (
    <Button variant="outline" size="sm" className="justify-start" disabled={!!work} onClick={() => void run(tool)} title={title}>
      {work?.tool === tool ? <Loader2 className="animate-spin" /> : <Icon />} {label}
    </Button>
  )

  return (
    <Section title="Picture tools">
      <div className="grid grid-cols-2 gap-1.5">
        {button("person", Scissors, "Remove background", "AI: cuts the people out with their hair (about 10–30 s)")}
        {button("plain", Wallpaper, "Plain background", "Logos and graphics on one plain color: that color goes")}
        {button("enhance", WandSparkles, "Enhance (AI)", "Sharper and up to 4× bigger (small pictures), with better light and color")}
        {button("auto", Sun, "Light & color", "Brighter, clearer colors and a little sharper")}
      </div>
      {work ? (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground" role="status">
          <Sparkles className="size-3.5 shrink-0" />
          <span className="flex-1">
            {work.label} {Math.round(work.progress * 100)}%
          </span>
          <Button variant="ghost" size="icon-xs" aria-label="Stop" onClick={() => abort.current?.abort()}>
            <X />
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Runs on this computer. Remove background is made for people (hair too); then put the cut-out between the template&apos;s layers.</p>
      )}
    </Section>
  )
}
