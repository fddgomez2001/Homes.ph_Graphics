"use client"

import { useSyncExternalStore } from "react"
import { getDesktop } from "./desktop"
import { LEGACY_ASSIGNMENT, normalizeAssignment, type Assignment } from "./pages"

/**
 * The pages this person is assigned, for every screen. The desktop app keeps them in its setup (the Chrome
 * extension reads them there); a browser keeps them on this device. A copy on this device shows them right
 * away on the next start. Until they're chosen, the app shows what it always did (LEGACY_ASSIGNMENT).
 */

const KEY = "dcm-assigned-pages"

export interface AssignmentState {
  assignment: Assignment
  /** False until the setup (or Settings) saved a choice. */
  chosen: boolean
  /** The desktop app's saved choice has been read (the copy on this device is used meanwhile). */
  ready: boolean
}

const listeners = new Set<() => void>()
let state: AssignmentState | null = null
let loading: Promise<void> | null = null

function readCopy(): Assignment | null {
  try {
    return normalizeAssignment(JSON.parse(localStorage.getItem(KEY) ?? "null"))
  } catch {
    return null
  }
}

function writeCopy(a: Assignment) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a))
  } catch {
    // private window: the desktop app still has it
  }
}

function publish(next: AssignmentState) {
  state = next
  for (const l of listeners) l()
}

function start(): AssignmentState {
  if (state) return state
  const copy = readCopy()
  const desktop = getDesktop()
  state = { assignment: copy ?? LEGACY_ASSIGNMENT, chosen: !!copy, ready: !desktop?.setup }
  if (desktop?.setup && !loading) {
    loading = desktop.setup
      .get()
      .then((s) => {
        const saved = normalizeAssignment(s.pages)
        if (saved) writeCopy(saved)
        publish({ assignment: saved ?? copy ?? LEGACY_ASSIGNMENT, chosen: !!saved, ready: true })
      })
      .catch(() => publish({ ...(state ?? { assignment: LEGACY_ASSIGNMENT, chosen: false }), ready: true }))
    desktop.setup.onPagesChanged?.((p) => {
      const a = normalizeAssignment(p)
      if (!a) return
      writeCopy(a)
      publish({ assignment: a, chosen: true, ready: true })
    })
  }
  return state
}

const SERVER: AssignmentState = { assignment: LEGACY_ASSIGNMENT, chosen: false, ready: false }

function subscribe(fn: () => void) {
  listeners.add(fn)
  start()
  return () => listeners.delete(fn)
}

/** The assigned pages in a component (re-renders when they change, here or in another window). */
export function useAssignment(): AssignmentState {
  return useSyncExternalStore(subscribe, start, () => SERVER)
}

/** The assigned pages now (outside components). */
export function currentAssignment(): Assignment {
  return start().assignment
}

/** Saves the assigned pages (the desktop app's setup, and this device's copy). */
export async function saveAssignment(a: Assignment): Promise<Assignment> {
  const clean = normalizeAssignment(a) ?? LEGACY_ASSIGNMENT
  const desktop = getDesktop()
  const saved = desktop?.setup?.setPages ? (normalizeAssignment(await desktop.setup.setPages(clean)) ?? clean) : clean
  writeCopy(saved)
  publish({ assignment: saved, chosen: true, ready: true })
  return saved
}
