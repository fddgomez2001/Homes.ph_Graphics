"use client"

import { memo, useMemo } from "react"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { Group, Image as KImage, Label, Rect, Tag, Text } from "react-konva"
import { coverLayout, focusFromImageOffset, konvaFillAttrs } from "@/lib/design/geometry"
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
      return <ImageNode {...props} el={props.el} />
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

function ImageNode({ el, interactive, cropping, viewScale, handlers }: NodeProps & { el: ImageElement }) {
  const { image, status } = useCanvasImage(el.src)

  if (cropping && image && el.fit === "cover") {
    return <CropModeImage el={el} image={image} viewScale={viewScale} onCropChange={handlers.onCropChange} />
  }

  const draw = image ? imageDrawAttrs(el, image) : null
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
        if (bitmap && image) {
          const { crop, ...rect } = imageDrawAttrs({ ...el, width, height }, image)
          bitmap.setAttrs({ ...rect, crop })
        }
      }}
    >
      <Rect name="hit" width={el.width} height={el.height} fill="rgba(0,0,0,0)" />
      {image && draw ? (
        <KImage
          name="bitmap"
          image={image}
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
  const layout = coverLayout(image.naturalWidth, image.naturalHeight, el.width, el.height, el.zoom, el.focusX, el.focusY)
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
          const x = Math.min(0, Math.max(-layout.overflowX, node.x()))
          const y = Math.min(0, Math.max(-layout.overflowY, node.y()))
          node.position({ x, y })
          onCropChange(el.id, focusFromImageOffset(x, y, layout.overflowX, layout.overflowY))
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
