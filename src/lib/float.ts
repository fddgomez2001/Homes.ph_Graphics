"use client"

import { useSyncExternalStore } from "react"
import type { SlideDesign, SlideType, TextElement } from "@/lib/design/types"
import { getDesktop } from "@/lib/desktop"

/**
 * The floating quick-edit window (Windows app only). The full editor publishes
 * its slides to it; the float sends small edit commands back. The main process
 * relays messages between the two windows and only accepts each kind from the
 * window it belongs to.
 */

export interface FloatSlide {
  id: string
  type: SlideType
  label: string
  design: SlideDesign
}

export interface FloatState {
  projectId: string
  title: string
  caption: string
  currentSlideId: string
  saveStatus: "saved" | "dirty" | "saving" | "error" | "conflict"
  slides: FloatSlide[]
}

export type FloatCommand =
  | { type: "set-text"; slideId: string; elementId: string; text: string }
  | { type: "set-caption"; text: string }
  | { type: "select-slide"; slideId: string }
  | { type: "add-card"; afterSlideId: string }
  | { type: "paste-image"; slideId: string; name: string; mime: string; bytes: ArrayBuffer }
  | { type: "paste-image-url"; slideId: string; url: string }
  | { type: "closed" }

export interface FloatBridge {
  /** Full editor: turn the floating window on (it appears when you switch to another app). */
  enable: () => Promise<void>
  disable: () => Promise<void>
  publish: (state: FloatState) => void
  onCommand: (callback: (command: FloatCommand) => void) => () => void
  /** Floating window: */
  onState: (callback: (state: FloatState | null) => void) => () => void
  requestState: () => void
  send: (command: FloatCommand) => void
  openMain: () => void
  close: () => void
}

export function getFloatBridge(): FloatBridge | null {
  return getDesktop()?.float ?? null
}

const TEXT_ROLES_HIDDEN = new Set(["footer", "label"])

/** The text fields people fill in on a slide, in reading order (stack order when the slide has one). */
export function slideTextFields(design: SlideDesign): TextElement[] {
  const stacked = (design.stack?.items ?? [])
    .map((item) => design.elements.find((e): e is TextElement => e.id === item.id && e.type === "text"))
    .filter((e): e is TextElement => !!e)
  if (stacked.length) return stacked
  return design.elements
    .filter((e): e is TextElement => e.type === "text" && e.visible && !TEXT_ROLES_HIDDEN.has(e.role ?? ""))
    .sort((a, b) => a.y - b.y)
}

// ---------- "float mode" preference shared by the header button and the editor ----------

const PREF_KEY = "dcm-float-mode"
const listeners = new Set<() => void>()
let enabled: boolean | null = null

function read() {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(PREF_KEY) === "1"
    } catch {
      enabled = false
    }
  }
  return enabled
}

export function setFloatMode(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0")
  } catch {
    // remembered for this session only
  }
  listeners.forEach((l) => l())
}

const noSubscribe = () => () => {}

/** True in the Windows app (the floating window needs it). */
export function useFloatAvailable(): boolean {
  return useSyncExternalStore(noSubscribe, () => !!getFloatBridge(), () => false)
}

export function useFloatMode(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => !!getFloatBridge() && read(),
    () => false,
  )
}
