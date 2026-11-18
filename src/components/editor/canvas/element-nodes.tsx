"use client"

import { memo, useMemo } from "react"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { Group, Image as KImage, Label, Rect, Tag, Text } from "react-konva"
import { blurBackdrop, blurredCopy } from "@/lib/design/blur-fill"
import { slotDef } from "@/lib/design/cover-collage"
import { coverLayout, focusFromImageOffset, frameLayout, konvaFillAttrs } from "@/lib/design/geometry"
import { glowBitmap, isGlowShape } from "@/lib/design/glow"
import { useCanvasImage } from "@/lib/design/image-cache"
import {
  highQualityImageSceneFunc,
  imageDrawAttrs,
  imageClip,
  imageGroupAttrs,
  imageShadowAttrs,
  labelAttrs,
  shapeAttrs,
  tagAttrs,
  textAttrs,
} from "@/lib/design/konva-attrs"
import type { DesignElement, ImageElement, ShapeElement, TextElement } from "@/lib/design/types"

export interface NodeHandlers {
  onSelect: (id: string) => void
  onDoubleClick: (el: DesignElement) => void
  onDragMove: (e: KonvaEventObject<DragEvent>) => void
  onDragEnd: (el: DesignElement, node: Konva.Node) => void
  onTransformEnd: (el: DesignElement, node: Konva.Node) => void
  onCropChange: (id: string, patch: { focusX: number; focusY: number }) => void
  getActiveAnchor: () => string | null
}

interface NodeProps {
  el: DesignElement
  /** A brand post's template layer: its picture, drawn from the template (1.53). */
  templateImage?: HTMLCanvasElement
  hidden: boolean
  cropping: boolean
  interactive: boolean
  viewScale: number
  handlers: NodeHandlers
}

function commonEvents(el: DesignElement, interactive: boolean, handlers: NodeHandlers) {
  if (!interactive) return { listening: false }
  return {
    listening: true,
    draggable: true,
    onMouseDown: () => handlers.onSelect(el.id),
    onTouchStart: () => handlers.onSelect(el.id),
    onDblClick: () => handlers.onDoubleClick(el),
    onDblTap: () => handlers.onDoubleClick(el),
    onDragMove: handlers.onDragMove,
    onDragEnd: (e: KonvaEventObject<DragEvent>) => handlers.onDragEnd(el, e.target),
    onTransformEnd: (e: KonvaEventObject<Event>) => handlers.onTransformEnd(el, e.target),
    onMouseEnter: (e: KonvaEventObject<MouseEvent>) => setCursor(e, "move"),
    onMouseLeave: (e: KonvaEventObject<MouseEvent>) => setCursor(e, ""),
  }
}

function setCursor(e: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container()
  if (container) container.style.cursor = cursor
}

export const ElementNode = memo(function ElementNode(props: NodeProps) {
  switch (props.el.type) {
    case "text":
      return <TextNode {...props} el={props.el} />
    case "image":
      return props.el.slot ? <SlotNode {...props} el={props.el} /> : <ImageNode {...props} el={props.el} />
    case "shape":
      return <ShapeNode {...props} el={props.el} />
  }
})

function TextNode({ el, hidden, interactive, handlers }: NodeProps & { el: TextElement }) {
  return (
    <Label
      {...labelAttrs(el)}
      visible={el.visible && !hidden}
      {...commonEvents(el, interactive, handlers)}
      onTransform={(e) => {
        // Side handles change the wrap width (text reflows) instead of stretching glyphs.
        const anchor = handlers.getActiveAnchor()
        if (anchor !== "middle-left" && anchor !== "middle-right") return
        const label = e.target as unknown as Konva.Label
        const text = label.getText()
        text.width(Math.max(20, text.width() * label.scaleX()))
        label.scaleX(1)
        label.scaleY(1)
      }}
    >
      <Tag {...tagAttrs(el)} />
      <Text {...(textAttrs(el) as Konva.TextConfig)} />
    </Label>
  )
}

function ShapeNode(props: NodeProps & { el: ShapeElement }) {
  return isGlowShape(props.el) ? <GlowNode {...props} /> : <RectNode {...props} />
}

/** Radial / blurred shapes (title glows): the same bitmap the exporter draws. */
function GlowNode({ el, interactive, handlers }: NodeProps & { el: ShapeElement }) {
  const glow = useMemo(() => glowBitmap(el), [el])
  return (
    <Group
      id={el.id}
      name="element"
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      rotation={el.rotation}
      opacity={el.opacity}
      visible={el.visible}
      {...commonEvents(el, interactive, handlers)}
    >
      <Rect name="hit" width={el.width} height={el.height} fill="rgba(0,0,0,0)" />
      <KImage
        image={glow.canvas}
        x={-glow.pad}
        y={-glow.pad}
        width={el.width + glow.pad * 2}
        height={el.height + glow.pad * 2}
        sceneFunc={highQualityImageSceneFunc}
        listening={false}
      />
    </Group>
  )
}

function RectNode({ el, interactive, handlers }: NodeProps & { el: ShapeElement }) {
  return (
    <Rect
      {...(shapeAttrs(el) as Konva.RectConfig)}
      {...commonEvents(el, interactive, handlers)}
      onTransform={(e) => {
        const node = e.target as Konva.Rect
        const width = Math.max(4, node.width() * node.scaleX())
        const height = Math.max(4, node.height() * node.scaleY())
        node.setAttrs({ scaleX: 1, scaleY: 1, width, height, ...konvaFillAttrs(el.fill, width, height) })
      }}
    />
  )
}

function ImageNode({ el, interactive, cropping, viewScale, handlers, templateImage }: NodeProps & { el: ImageElement }) {
  const loaded = useCanvasImage(el.templatePart ? null : el.src)
  // A template layer shows the template's own drawing (a canvas, drawn like a picture).
  const image = el.templatePart ? (templateImage as unknown as HTMLImageElement | undefined) : loaded.image
  const status = el.templatePart ? (templateImage ? "loaded" : "loading") : loaded.status

  if (cropping && image && el.fit === "cover") {
    return <CropModeImage el={el} image={image} viewScale={viewScale} onCropChange={handlers.onCropChange} />
  }

  // A backdrop that follows the photo (1.51 poster designs): drawn as its blurred copy.
  const bitmapImage = image && el.blurred ? blurredCopy(image) : image
  const draw = image && bitmapImage ? imageDrawAttrs(el, el.blurred ? { naturalWidth: bitmapImage.width, naturalHeight: bitmapImage.height } : image) : null
  // A zoomed-out poster photo: its blurred copy fills the frame behind it.
  const backdrop = image ? blurBackdrop(el, image) : null
  return (
    <Group
      {...imageGroupAttrs(el)}
      {...commonEvents(el, interactive, handlers)}
      onTransform={(e) => {
        // Resize the frame (not a stretch): cover images re-crop, contain images re-fit.
        const group = e.target as unknown as Konva.Group
        const width = Math.max(8, group.width() * group.scaleX())
        const height = Math.max(8, group.height() * group.scaleY())
        group.setAttrs({ scaleX: 1, scaleY: 1, width, height, ...imageClip({ ...el, width, height }) })
        group.findOne(".hit")?.setAttrs({ width, height })
        group.findOne(".placeholder-bg")?.setAttrs({ width, height })
        const bitmap = group.findOne(".bitmap")
        if (bitmap && image && bitmapImage) {
          const { crop, ...rect } = imageDrawAttrs({ ...el, width, height }, el.blurred ? { naturalWidth: bitmapImage.width, naturalHeight: bitmapImage.height } : image)
          bitmap.setAttrs({ ...rect, crop })
        }
        const fill = group.findOne(".blur-fill")
        if (fill && image) {
          const next = blurBackdrop({ ...el, width, height }, image)
          if (next) fill.setAttrs({ width: next.width, height: next.height, crop: next.crop })
        }
      }}
    >
      <Rect name="hit" width={el.width} height={el.height} fill="rgba(0,0,0,0)" />
      {backdrop && <KImage name="blur-fill" {...backdrop} sceneFunc={highQualityImageSceneFunc} listening={false} />}
      {bitmapImage && draw ? (
        <KImage
          name="bitmap"
          image={bitmapImage}
          x={draw.x}
          y={draw.y}
          width={draw.width}
          height={draw.height}
          crop={draw.crop}
          {...imageShadowAttrs(el)}
          sceneFunc={highQualityImageSceneFunc}
          listening={false}
        />
      ) : (
        <ImagePlaceholder el={el} status={status} />
      )}
    </Group>
  )
}

/**
 * A photo slot of the cover collage. The frame stays where the template puts it, cut to the
 * slot's shape; the photo inside is dragged to move it (and zoomed with the mouse wheel or the
 * panel). An empty slot shows its color and which card's photo will appear in it.
 */
function SlotNode({ el, handlers }: NodeProps & { el: ImageElement }) {
  const { image, status } = useCanvasImage(el.src)
  const def = slotDef(el.slot)
  const layout = image ? coverLayout(image.naturalWidth, image.naturalHeight, el.width, el.height, el.zoom, el.focusX, el.focusY) : null
  const select = () => handlers.onSelect(el.id)
  const index = el.slot?.index ?? 0
  const card = el.slot?.card
  const message = el.src
    ? status === "error"
      ? `Photo ${index}\nThis photo could not be loaded`
      : `Photo ${index}\nLoading…`
    : card
      ? `Photo ${index}\nShows Card ${card}'s photo`
      : `Photo ${index}\nNo photo yet`
  return (
    <Group
      {...imageGroupAttrs(el)}
      onMouseDown={select}
      onTouchStart={select}
      onMouseEnter={(e) => setCursor(e, image ? "grab" : "pointer")}
      onMouseLeave={(e) => setCursor(e, "")}
    >
      <Rect name="hit" width={el.width} height={el.height} fill={def?.color ?? "#DCE3EC"} />
      {image && layout ? (
        <KImage
          name="bitmap"
          image={image}
          {...layout.image}
          draggable
          sceneFunc={highQualityImageSceneFunc}
          onDragMove={(e) => {
            // The photo always fills its slot: it stops at its own edges.
            const node = e.target
            const x = Math.min(0, Math.max(-layout.overflowX, node.x()))
            const y = Math.min(0, Math.max(-layout.overflowY, node.y()))
            node.position({ x, y })
            handlers.onCropChange(el.id, focusFromImageOffset(x, y, layout.overflowX, layout.overflowY))
          }}
        />
      ) : (
        <Text
          text={message}
          width={el.width}
          height={el.height}
          align="center"
          verticalAlign="middle"
          fontFamily="Inter"
          fontStyle="700"
          fontSize={30}
          lineHeight={1.35}
          fill="#FFFFFF"
          shadowColor="rgba(0,0,0,0.35)"
          shadowBlur={6}
          listening={false}
        />
      )}
    </Group>
  )
}

/** Editor-only placeholder for an empty or broken image frame. Never exported. */
function ImagePlaceholder({ el, status }: { el: ImageElement; status: string }) {
  const message = !el.src
    ? el.role === "background"
      ? "Drag a photo here\nor click Upload in the Images tab"
      : "Empty image"
    : status === "error"
      ? el.src.startsWith("blob:")
        ? "This image was never saved\nPaste or drop it again"
        : el.src.startsWith("local:")
          ? "Saved on another computer\nIt appears once it's uploaded"
          : "Image unavailable\nReplace it from the Images tab"
      : "Loading image…"
  const fontSize = Math.max(14, Math.min(44, Math.min(el.width, el.height) / 14))
  return (
    <Group listening={false}>
      <Rect name="placeholder-bg" width={el.width} height={el.height} fill={status === "error" ? "#FDE8E8" : "#DCE3EC"} />
      <Text
        text={message}
        width={el.width}
        height={el.height}
        y={el.role === "background" ? -el.height * 0.18 : 0}
        align="center"
        verticalAlign="middle"
        fontFamily="Inter"
        fontStyle="600"
        fontSize={fontSize}
        lineHeight={1.4}
        fill={status === "error" ? "#B91C1C" : "#475569"}
      />
    </Group>
  )
}

/**
 * Canva-style crop: the whole photo is shown faintly and can be dragged to choose
 * which part fills the frame. Only zoom/focus change; the original is untouched.
 */
function CropModeImage({
  el,
  image,
  viewScale,
  onCropChange,
}: {
  el: ImageElement
  image: HTMLImageElement
  viewScale: number
  onCropChange: (id: string, patch: { focusX: number; focusY: number }) => void
}) {
  // Where the photo can go: the free space (a zoomed-out blur-fill photo) or how far it overflows.
  const frame = el.blurFill ? frameLayout(image.naturalWidth, image.naturalHeight, el.width, el.height, el.zoom, el.focusX, el.focusY) : null
  const cover = coverLayout(image.naturalWidth, image.naturalHeight, el.width, el.height, el.zoom, el.focusX, el.focusY)
  const layout = frame ? { image: frame.image, rangeX: frame.rangeX, rangeY: frame.rangeY } : { image: cover.image, rangeX: -cover.overflowX, rangeY: -cover.overflowY }
  const focusAt = (offset: number, range: number) => (Math.abs(range) > 0.01 ? Math.min(1, Math.max(0, offset / range)) : 0.5)
  return (
    <Group x={el.x} y={el.y} rotation={el.rotation}>
      <KImage
        image={image}
        {...layout.image}
        opacity={0.35}
        draggable
        sceneFunc={highQualityImageSceneFunc}
        onMouseEnter={(e) => setCursor(e, "grab")}
        onMouseLeave={(e) => setCursor(e, "")}
        onDragMove={(e) => {
          const node = e.target
          const x = Math.min(Math.max(0, layout.rangeX), Math.max(Math.min(0, layout.rangeX), node.x()))
          const y = Math.min(Math.max(0, layout.rangeY), Math.max(Math.min(0, layout.rangeY), node.y()))
          node.position({ x, y })
          onCropChange(el.id, { focusX: focusAt(x, layout.rangeX), focusY: focusAt(y, layout.rangeY) })
        }}
      />
      <Group clipX={0} clipY={0} clipWidth={el.width} clipHeight={el.height} listening={false} opacity={el.opacity}>
        <KImage image={image} {...layout.image} sceneFunc={highQualityImageSceneFunc} />
      </Group>
      <Rect
        width={el.width}
        height={el.height}
        stroke="#F8C563"
        strokeWidth={3 / viewScale}
        dash={[10 / viewScale, 6 / viewScale]}
        listening={false}
      />
    </Group>
  )
}
