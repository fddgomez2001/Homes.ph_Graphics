import { shortId } from "@/lib/utils"
import type { DesignElement, Fill, ImageElement, ShapeElement, SlideDesign, TextElement } from "./types"
import { CANVAS_SIZE, DESIGN_VERSION } from "./types"
import { SWOOSH_LEFT_SRC, SWOOSH_SRC } from "./constants"

/** Canvas size in px: any sensible square format, 1254 when missing. */
function validSize(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) && v >= 256 && v <= 4096 ? Math.round(v) : CANVAS_SIZE
}

/**
 * Makes design JSON from the database safe to render: fills in missing fields
 * with defaults and drops unknown element types. Never throws.
 */
export function normalizeDesign(raw: unknown): SlideDesign {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<SlideDesign>
  const parsed = Array.isArray(d.elements) ? d.elements.map(normalizeElement).filter((e): e is DesignElement => !!e) : []
  const version = typeof d.version === "number" ? d.version : 1
  const withSwoosh = version < 2 ? addLeftSwoosh(parsed) : parsed
  // FHI portrait posts made before version 3 get their headline in capitals once (it can be turned off).
  const elements =
    version < 3 && d.templateId === "fhi-portrait-news"
      ? withSwoosh.map((el) => (el.type === "text" && el.role === "title" ? { ...el, textCase: "upper" as const } : el))
      : withSwoosh
  const ids = new Set(elements.map((e) => e.id))
  const stack: SlideDesign["stack"] =
    d.stack && Array.isArray(d.stack.items)
      ? {
          enabled: d.stack.enabled !== false,
          anchor: d.stack.anchor === "center" ? "center" : "bottom",
          bottom: num(d.stack.bottom, 1214),
          ...(typeof d.stack.center === "number" ? { center: d.stack.center } : {}),
          minTop: num(d.stack.minTop, 130),
          ...(typeof d.stack.maxBottom === "number" ? { maxBottom: d.stack.maxBottom } : {}),
          items: d.stack.items
            .filter((i) => i && ids.has(i.id))
            .map((i) => ({
              id: i.id,
              gap: num(i.gap, 0),
              ...(typeof i.gapWithoutPrevious === "number" ? { gapWithoutPrevious: i.gapWithoutPrevious } : {}),
              ...(typeof i.minHeight === "number" ? { minHeight: i.minHeight } : {}),
            })),
        }
      : null
  return {
    version: DESIGN_VERSION,
    // 1254 × 1254 carousels; other square formats (e.g. 1408 news articles) keep their size.
    width: validSize(d.width),
    height: validSize(d.height ?? d.width),
    background: typeof d.background === "string" ? d.background : "#FFFFFF",
    elements,
    stack,
    templateId: typeof d.templateId === "string" ? d.templateId : null,
    titleFit:
      d.titleFit && Array.isArray(d.titleFit.headlineIds)
        ? {
            headlineIds: d.titleFit.headlineIds.filter((id) => ids.has(id)),
            baseSize: num(d.titleFit.baseSize, 172),
            baseGap: num(d.titleFit.baseGap, -26),
            extraGap: num(d.titleFit.extraGap, 0),
            matchHeadlines: d.titleFit.matchHeadlines === true,
          }
        : null,
  }
}

/**
 * Covers made before the corner swoosh was mirrored to the top left get the left
 * copy once, right above the top-right one (same position and visibility). Its id
 * comes from the right swoosh so every load produces the same design.
 */
function addLeftSwoosh(elements: DesignElement[]): DesignElement[] {
  if (elements.some((e) => e.type === "image" && e.src === SWOOSH_LEFT_SRC)) return elements
  const index = elements.findIndex((e) => e.type === "image" && e.src === SWOOSH_SRC)
  if (index < 0) return elements
  const right = elements[index] as ImageElement
  const left: ImageElement = { ...right, id: `${right.id}-left`, name: "Top Left Swoosh", src: SWOOSH_LEFT_SRC }
  return [...elements.slice(0, index + 1), left, ...elements.slice(index + 1)]
}

function normalizeElement(raw: unknown): DesignElement | null {
  if (!raw || typeof raw !== "object") return null
  const e = raw as Partial<DesignElement> & Record<string, unknown>
  const base = {
    id: typeof e.id === "string" && e.id ? e.id : shortId(),
    name: typeof e.name === "string" ? e.name : "Element",
    role: e.role,
    x: num(e.x, 0),
    y: num(e.y, 0),
    width: Math.max(1, num(e.width, 100)),
    rotation: num(e.rotation, 0),
    opacity: Math.min(1, Math.max(0, num(e.opacity, 1))),
    visible: e.visible !== false,
    locked: e.locked === true,
  }
  if (e.type === "text") {
    const t = e as Partial<TextElement>
    return {
      ...base,
      type: "text",
      text: typeof t.text === "string" ? t.text : "",
      fontFamily: typeof t.fontFamily === "string" ? t.fontFamily : "Outfit",
      fontSize: Math.max(1, num(t.fontSize, 40)),
      fontWeight: num(t.fontWeight, 400),
      fill: typeof t.fill === "string" ? t.fill : "#FFFFFF",
      align: t.align === "center" || t.align === "right" || t.align === "justify" ? t.align : "left",
      lineHeight: Math.max(1, num(t.lineHeight, num(t.fontSize, 40) * 1.25)),
      letterSpacing: num(t.letterSpacing, 0),
      shadow: {
        enabled: t.shadow?.enabled === true,
        color: t.shadow?.color ?? "#000000",
        blur: num(t.shadow?.blur, 5),
        offsetX: num(t.shadow?.offsetX, 4),
        offsetY: num(t.shadow?.offsetY, 4),
      },
      background: {
        enabled: t.background?.enabled === true,
        color: t.background?.color ?? "#F8C563",
        padding: num(t.background?.padding, 16),
        radius: num(t.background?.radius, 8),
      },
      fillGradient: t.fillGradient?.type === "linear" ? (normalizeFill(t.fillGradient) as Extract<Fill, { type: "linear" }>) : null,
      autoFit: t.autoFit
        ? {
            maxWidth: Math.max(1, num(t.autoFit.maxWidth, 1067)),
            maxSize: Math.max(1, num(t.autoFit.maxSize, num(t.fontSize, 40))),
            letterSpacingEm: num(t.autoFit.letterSpacingEm, 0),
            ...(t.autoFit.lineHeightRatio ? { lineHeightRatio: Math.max(0.5, num(t.autoFit.lineHeightRatio, 1)) } : {}),
          }
        : null,
      ...(t.textCase === "upper" ? { textCase: "upper" as const } : {}),
    }
  }
  if (e.type === "image") {
    const i = e as Partial<ImageElement>
    return {
      ...base,
      type: "image",
      height: Math.max(1, num(i.height, 100)),
      src: typeof i.src === "string" && i.src ? i.src : null,
      assetId: i.assetId ?? null,
      publicId: i.publicId ?? null,
      naturalWidth: num(i.naturalWidth, 0),
      naturalHeight: num(i.naturalHeight, 0),
      fit: i.fit === "contain" ? "contain" : "cover",
      ...(num(i.cornerRadius, 0) > 0 ? { cornerRadius: num(i.cornerRadius, 0) } : {}),
      zoom: Math.max(1, num(i.zoom, 1)),
      focusX: num(i.focusX, 0.5),
      focusY: num(i.focusY, 0.5),
      uploadId: i.uploadId ?? null,
      logoVariant: i.logoVariant === "auto" || i.logoVariant === "white" || i.logoVariant === "blue" ? i.logoVariant : null,
      logoResolved: i.logoResolved === "blue" ? "blue" : i.logoResolved === "white" ? "white" : null,
      shadow: i.shadow
        ? {
            enabled: i.shadow.enabled === true,
            color: i.shadow.color ?? "rgba(0, 0, 0, 0.18)",
            blur: num(i.shadow.blur, 4),
            offsetX: num(i.shadow.offsetX, 0),
            offsetY: num(i.shadow.offsetY, 4),
          }
        : null,
    }
  }
  if (e.type === "shape") {
    const s = e as Partial<ShapeElement>
    return {
      ...base,
      type: "shape",
      height: Math.max(1, num(s.height, 100)),
      fill: normalizeFill(s.fill),
      cornerRadius: num(s.cornerRadius, 0),
      blur: Math.max(0, num(s.blur, 0)),
      stroke: s.stroke && typeof s.stroke.color === "string" ? { color: s.stroke.color, width: Math.max(0, num(s.stroke.width, 1)) } : null,
      shadow: s.shadow
        ? {
            enabled: s.shadow.enabled === true,
            color: s.shadow.color ?? "rgba(0, 0, 0, 0.25)",
            blur: num(s.shadow.blur, 10),
            offsetX: num(s.shadow.offsetX, 0),
            offsetY: num(s.shadow.offsetY, 4),
          }
        : null,
    }
  }
  return null
}

function normalizeFill(fill: unknown): Fill {
  const f = fill as Partial<Fill> | undefined
  if (f?.type === "radial" && Array.isArray(f.stops) && f.stops.length >= 2) {
    return {
      type: "radial",
      cx: num(f.cx, 0.5),
      cy: num(f.cy, 0.5),
      rx: Math.max(0.001, num(f.rx, 0.5)),
      ry: Math.max(0.001, num(f.ry, 0.5)),
      stops: f.stops.map((s) => ({ offset: Math.min(1, Math.max(0, num(s.offset, 0))), color: String(s.color ?? "#000000") })),
    }
  }
  if (f?.type === "linear" && Array.isArray(f.stops) && f.stops.length >= 2) {
    return {
      type: "linear",
      angle: num(f.angle, 180),
      stops: f.stops.map((s) => ({ offset: Math.min(1, Math.max(0, num(s.offset, 0))), color: String(s.color ?? "#000000") })),
    }
  }
  return { type: "solid", color: f?.type === "solid" && typeof f.color === "string" ? f.color : "#0F4C81" }
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}
