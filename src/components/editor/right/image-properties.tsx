"use client"

import { CheckCircle2, Crop, ImageUp, RotateCcw, Trash, TriangleAlert, Wallpaper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { imageUpscaleFactor } from "@/lib/design/geometry"
import { logoSource } from "@/lib/design/logo"
import type { ImageElement } from "@/lib/design/types"
import { CANVAS_SIZE } from "@/lib/design/types"
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
                min={1}
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
