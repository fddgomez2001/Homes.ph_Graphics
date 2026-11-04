"use client"

import { createContext, useContext } from "react"
import { toast } from "sonner"
import { useStore } from "zustand"
import { createStore, type StoreApi } from "zustand/vanilla"
import { applyTextStack, type MeasureText } from "@/lib/design/layout"
import { coverTitle } from "@/lib/design/cover-title"
import { applyTitleFit, type MeasureLine } from "@/lib/design/title-fit"
import { cloneDesignWithNewIds, type TemplateContext } from "@/lib/design/templates"
import type { DesignElement, EditorSlide, ImageElement, SlideDesign } from "@/lib/design/types"
import type { ProjectRow } from "@/lib/types"
import { shortId } from "@/lib/utils"

export type ProjectMeta = Pick<ProjectRow, "id" | "title" | "topic" | "caption" | "scheduled_at" | "status">
type MetaKey = Exclude<keyof ProjectMeta, "id">

/** An image's stored Cloudinary original. */
export interface StoredImage {
  src: string
  assetId: string
  publicId: string
  naturalWidth?: number
  naturalHeight?: number
}

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict"

export interface UploadInfo {
  id: string
  name: string
  progress: number
  /** "local": saved on this computer, waiting to upload to Cloudinary (retried automatically). */
  status: "uploading" | "processing" | "done" | "error" | "local"
  /** The local copy's SHA-256 (set while it waits to upload). */
  sha?: string
  error?: string
}

interface Snapshot {
  slides: EditorSlide[]
  currentSlideId: string
  selectedId: string | null
}

export interface EditOptions {
  /**
   * Undo behaviour: a key merges continuous edits with the same key into one undo
   * step, null always creates a new step, false records no undo step.
   */
  history?: string | false | null
  slideId?: string
  /** Set by canvas drags: moving a stacked text box vertically turns auto-arrange off. */
  manualMove?: boolean
}

export interface EditorState {
  project: ProjectMeta
  slides: EditorSlide[]
  currentSlideId: string
  selectedId: string | null
  editingTextId: string | null
  cropId: string | null
  zoom: number | "fit"
  /** Effective on-screen scale of the 1254 px canvas (resolved "fit"). */
  viewScale: number
  templateContext: TemplateContext
  thumbnails: Record<string, string>
  uploads: Record<string, UploadInfo>
  clipboard: DesignElement | null

  past: Snapshot[]
  future: Snapshot[]
  historyKey: string | null
  historyAt: number

  revision: number
  /** Increments on every change that must be saved. */
  changeVersion: number
  savedVersion: number
  /** Metadata fields changed since the last save → changeVersion when last changed. */
  dirtyMeta: Partial<Record<MetaKey, number>>
  saving: boolean
  saveError: string | null
  conflict: boolean
  lastSavedAt: number | null
  requestSave: () => void

  measure: MeasureText
}

export interface EditorActions {
  setCurrentSlide: (id: string) => void
  select: (id: string | null) => void
  setEditingText: (id: string | null) => void
  setCrop: (id: string | null) => void
  setZoom: (zoom: number | "fit") => void
  setThumbnail: (slideId: string, dataUrl: string) => void

  updateElement: (id: string, patch: Partial<DesignElement>, opts?: EditOptions) => void
  updateDesign: (slideId: string, fn: (design: SlideDesign) => SlideDesign, opts?: EditOptions) => void
  addElement: (el: DesignElement, opts?: { slideId?: string; index?: number; select?: boolean }) => void
  removeElement: (id: string) => void
  duplicateElement: (id: string) => void
  moveLayer: (id: string, direction: "forward" | "backward" | "front" | "back") => void
  reorderLayer: (id: string, toIndex: number) => void

  addSlide: (design: SlideDesign, opts?: { afterId?: string; select?: boolean }) => string
  duplicateSlide: (id: string) => void
  deleteSlide: (id: string) => void
  moveSlide: (id: string, toIndex: number) => void

  setMeta: (patch: Partial<Omit<ProjectMeta, "id">>) => void

  undo: () => void
  redo: () => void

  copy: () => DesignElement | null
  paste: () => void

  setUpload: (id: string, patch: Partial<UploadInfo>) => void
  resolveUpload: (uploadId: string, data: StoredImage) => void
  /** Points every use of a local image ("local:<sha>") at its Cloudinary original. */
  resolveLocal: (localSrc: string, data: StoredImage) => void

  markSaving: () => void
  markSaved: (revision: number, version: number) => void
  markSaveError: (message: string) => void
  markConflict: () => void
  resolveConflictKeepMine: (latestRevision: number) => void
}

export type EditorStore = StoreApi<EditorState & EditorActions>

const MAX_HISTORY = 100
const COALESCE_MS = 900

export function createEditorStore(init: {
  project: ProjectMeta
  slides: EditorSlide[]
  revision: number
  templateContext: TemplateContext
  measure: MeasureText
  /** Single-line width measurement for auto-fit titles (browser only). */
  measureLine?: MeasureLine
  /** Restored local changes start out unsaved. */
  dirty?: boolean
  /** Slide to show first (e.g. clicked on the Day Board). */
  initialSlideId?: string | null
}): EditorStore {
  const layoutDesign = (design: SlideDesign) => {
    let next = init.measureLine ? applyTitleFit(design, init.measureLine) : design
    if (next.stack?.enabled) next = applyTextStack(next, init.measure)
    return next
  }

  const initialSlides = init.slides.map((sl) => {
    const design = layoutDesign(sl.design)
    return design === sl.design ? sl : { ...sl, design }
  })
  const initialTitle = coverTitle(initialSlides[0].design)
  const retitle = !!initialTitle && initialTitle !== init.project.title

  return createStore<EditorState & EditorActions>()((set, get) => {
    const currentSlide = () => {
      const s = get()
      return s.slides.find((sl) => sl.id === s.currentSlideId) ?? s.slides[0]
    }

    const snapshot = (): Snapshot => {
      const s = get()
      return {
        slides: s.slides,
        currentSlideId: s.currentSlideId,
        selectedId: s.selectedId,
      }
    }

    /** Title auto-fit, then the text stack (auto layout), for slides whose design changed. */
    const withLayout = (next: EditorSlide[], prev: EditorSlide[]) => {
      const prevById = new Map(prev.map((s) => [s.id, s]))
      return next.map((slide) => {
        if (prevById.get(slide.id)?.design === slide.design) return slide
        const design = layoutDesign(slide.design)
        return design === slide.design ? slide : { ...slide, design }
      })
    }

    const commit = (
      nextSlides: EditorSlide[],
      opts: EditOptions & {
        selectedId?: string | null
        currentSlideId?: string
      } = {},
    ) => {
      const s = get()
      const now = Date.now()
      const patch: Partial<EditorState> = {}
      if (opts.history !== false) {
        const key = opts.history ?? null
        const coalesce = key !== null && key === s.historyKey && now - s.historyAt < COALESCE_MS
        if (!coalesce) patch.past = [...s.past, snapshot()].slice(-MAX_HISTORY)
        patch.future = []
        patch.historyKey = key
        patch.historyAt = now
      }
      const slides = withLayout(nextSlides, s.slides)
      set({
        ...patch,
        ...titleSync(slides, s.changeVersion + 1),
        slides,
        changeVersion: s.changeVersion + 1,
        ...(opts.selectedId !== undefined ? { selectedId: opts.selectedId } : {}),
        ...(opts.currentSlideId !== undefined ? { currentSlideId: opts.currentSlideId } : {}),
      })
    }

    /** The carousel title follows the cover's Headline 1 + Headline 2. */
    const titleSync = (slides: EditorSlide[], version: number): Partial<EditorState> => {
      const s = get()
      const title = coverTitle(slides[0].design)
      if (!title || title === s.project.title) return {}
      return {
        project: { ...s.project, title },
        dirtyMeta: { ...s.dirtyMeta, title: version },
      }
    }

    const mapDesign = (slideId: string, fn: (d: SlideDesign) => SlideDesign) =>
      get().slides.map((sl) => (sl.id === slideId ? { ...sl, design: fn(sl.design) } : sl))

    const findElement = (id: string) => {
      for (const slide of get().slides) {
        const el = slide.design.elements.find((e) => e.id === id)
        if (el) return { slide, el }
      }
      return null
    }

    /** Swaps an image's source everywhere: current slides, undo/redo history and the clipboard. */
    function swapImages(match: (e: ImageElement) => boolean, data: StoredImage) {
      const swap = (slides: EditorSlide[]) =>
        slides.map((slide) => {
          if (!slide.design.elements.some((e) => e.type === "image" && match(e))) return slide
          return {
            ...slide,
            design: {
              ...slide.design,
              elements: slide.design.elements.map((e) =>
                e.type === "image" && match(e)
                  ? ({
                      ...e,
                      src: data.src,
                      assetId: data.assetId,
                      publicId: data.publicId,
                      naturalWidth: data.naturalWidth ?? e.naturalWidth,
                      naturalHeight: data.naturalHeight ?? e.naturalHeight,
                      uploadId: null,
                    } satisfies ImageElement)
                  : e,
              ),
            },
          }
        })
      const s = get()
      const inUse = (slides: EditorSlide[]) => slides.some((sl) => sl.design.elements.some((e) => e.type === "image" && match(e)))
      if (!inUse(s.slides) && !s.past.some((p) => inUse(p.slides)) && !s.future.some((f) => inUse(f.slides))) return
      set({
        slides: swap(s.slides),
        past: s.past.map((p) => ({ ...p, slides: swap(p.slides) })),
        future: s.future.map((f) => ({ ...f, slides: swap(f.slides) })),
        clipboard:
          s.clipboard?.type === "image" && match(s.clipboard)
            ? {
                ...s.clipboard,
                src: data.src,
                assetId: data.assetId,
                publicId: data.publicId,
                uploadId: null,
              }
            : s.clipboard,
        changeVersion: s.changeVersion + 1,
      })
    }

    return {
      project: retitle ? { ...init.project, title: initialTitle } : init.project,
      slides: initialSlides,
      currentSlideId: init.slides.some((sl) => sl.id === init.initialSlideId) ? init.initialSlideId! : init.slides[0].id,
      selectedId: null,
      editingTextId: null,
      cropId: null,
      zoom: "fit",
      viewScale: 0.4,
      templateContext: init.templateContext,
      thumbnails: {},
      uploads: {},
      clipboard: null,
      past: [],
      future: [],
      historyKey: null,
      historyAt: 0,
      revision: init.revision,
      changeVersion: init.dirty || retitle ? 1 : 0,
      savedVersion: 0,
      dirtyMeta: init.dirty ? { title: 1, topic: 1, caption: 1, scheduled_at: 1, status: 1 } : retitle ? { title: 1 } : {},
      saving: false,
      saveError: null,
      conflict: false,
      lastSavedAt: null,
      requestSave: () => {},
      measure: init.measure,

      setCurrentSlide: (id) => {
        if (get().slides.some((s) => s.id === id))
          set({
            currentSlideId: id,
            selectedId: null,
            editingTextId: null,
            cropId: null,
          })
      },
      select: (id) =>
        set({
          selectedId: id,
          editingTextId: null,
          cropId: get().cropId === id ? get().cropId : null,
        }),
      setEditingText: (id) =>
        set({
          editingTextId: id,
          selectedId: id ?? get().selectedId,
          cropId: null,
        }),
      setCrop: (id) =>
        set({
          cropId: id,
          selectedId: id ?? get().selectedId,
          editingTextId: null,
        }),
      setZoom: (zoom) => set({ zoom }),
      setThumbnail: (slideId, dataUrl) => set({ thumbnails: { ...get().thumbnails, [slideId]: dataUrl } }),

      updateElement: (id, patch, opts = {}) => {
        const found = findElement(id)
        if (!found) return
        const { slide, el } = found
        const stack = slide.design.stack
        // Dragging a stacked text element up/down means the user wants manual placement.
        const leavesStack =
          opts.manualMove &&
          stack?.enabled &&
          "y" in patch &&
          patch.y !== undefined &&
          Math.abs(patch.y - el.y) > 1 &&
          stack.items.some((i) => i.id === id)
        commit(
          mapDesign(slide.id, (d) => ({
            ...d,
            stack: leavesStack && d.stack ? { ...d.stack, enabled: false } : d.stack,
            elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as DesignElement) : e)),
          })),
          {
            history: opts.history === undefined ? `el:${id}:${Object.keys(patch).sort().join(",")}` : opts.history,
          },
        )
        if (leavesStack) {
          toast.info("Auto-arrange is off for this slide's text", {
            description: "You moved a text box by hand. Turn “Auto-arrange text” back on in the slide settings anytime.",
          })
        }
      },

      updateDesign: (slideId, fn, opts = {}) => {
        commit(mapDesign(slideId, fn), { history: opts.history ?? null })
      },

      addElement: (el, opts = {}) => {
        const slideId = opts.slideId ?? get().currentSlideId
        commit(
          mapDesign(slideId, (d) => {
            const elements = [...d.elements]
            elements.splice(opts.index ?? elements.length, 0, el)
            return { ...d, elements }
          }),
          {
            history: null,
            selectedId: opts.select === false ? undefined : el.id,
            currentSlideId: slideId,
          },
        )
      },

      removeElement: (id) => {
        const found = findElement(id)
        if (!found) return
        commit(
          mapDesign(found.slide.id, (d) => ({
            ...d,
            elements: d.elements.filter((e) => e.id !== id),
            stack: d.stack ? { ...d.stack, items: d.stack.items.filter((i) => i.id !== id) } : d.stack,
          })),
          {
            history: null,
            selectedId: get().selectedId === id ? null : get().selectedId,
          },
        )
      },

      duplicateElement: (id) => {
        const found = findElement(id)
        if (!found) return
        const copy = {
          ...structuredClone(found.el),
          id: shortId(),
          name: `${found.el.name} copy`,
          locked: false,
          x: found.el.x + 30,
          y: found.el.y + 30,
        }
        const index = found.slide.design.elements.findIndex((e) => e.id === id) + 1
        get().addElement(copy as DesignElement, {
          slideId: found.slide.id,
          index,
        })
      },

      moveLayer: (id, direction) => {
        const found = findElement(id)
        if (!found) return
        const elements = [...found.slide.design.elements]
        const from = elements.findIndex((e) => e.id === id)
        const to = direction === "front" ? elements.length - 1 : direction === "back" ? 0 : direction === "forward" ? from + 1 : from - 1
        if (to < 0 || to >= elements.length || to === from) return
        get().reorderLayer(id, to)
      },

      reorderLayer: (id, toIndex) => {
        const found = findElement(id)
        if (!found) return
        commit(
          mapDesign(found.slide.id, (d) => {
            const elements = [...d.elements]
            const from = elements.findIndex((e) => e.id === id)
            const [moved] = elements.splice(from, 1)
            elements.splice(Math.max(0, Math.min(elements.length, toIndex)), 0, moved)
            return { ...d, elements }
          }),
          { history: null },
        )
      },

      addSlide: (design, opts = {}) => {
        const s = get()
        const slide: EditorSlide = {
          id: crypto.randomUUID(),
          type: "card",
          design,
        }
        const afterIndex = opts.afterId ? s.slides.findIndex((x) => x.id === opts.afterId) : s.slides.length - 1
        const slides = [...s.slides]
        slides.splice(Math.max(1, afterIndex + 1), 0, slide)
        commit(slides, {
          history: null,
          currentSlideId: opts.select === false ? undefined : slide.id,
          selectedId: null,
        })
        return slide.id
      },

      duplicateSlide: (id) => {
        const s = get()
        const source = s.slides.find((x) => x.id === id)
        if (!source) return
        // Duplicating the cover creates a card with the same design; the cover stays unique and first.
        get().addSlide(cloneDesignWithNewIds(source.design), { afterId: id })
      },

      deleteSlide: (id) => {
        const s = get()
        const index = s.slides.findIndex((x) => x.id === id)
        if (index <= 0) return // the cover can't be deleted
        const slides = s.slides.filter((x) => x.id !== id)
        const current = s.currentSlideId === id ? slides[Math.min(index, slides.length - 1)].id : s.currentSlideId
        commit(slides, {
          history: null,
          currentSlideId: current,
          selectedId: null,
        })
      },

      moveSlide: (id, toIndex) => {
        const s = get()
        const from = s.slides.findIndex((x) => x.id === id)
        if (from <= 0) return
        const slides = [...s.slides]
        const [moved] = slides.splice(from, 1)
        slides.splice(Math.max(1, Math.min(slides.length, toIndex)), 0, moved) // never before the cover
        commit(slides, { history: null })
      },

      setMeta: (patch) => {
        const s = get()
        const version = s.changeVersion + 1
        const dirtyMeta = { ...s.dirtyMeta }
        for (const key of Object.keys(patch) as MetaKey[]) dirtyMeta[key] = version
        set({
          project: { ...s.project, ...patch },
          dirtyMeta,
          changeVersion: version,
        })
      },

      undo: () => {
        const s = get()
        const prev = s.past[s.past.length - 1]
        if (!prev) return
        set({
          ...titleSync(prev.slides, s.changeVersion + 1),
          past: s.past.slice(0, -1),
          future: [snapshot(), ...s.future].slice(0, MAX_HISTORY),
          slides: prev.slides,
          currentSlideId: prev.slides.some((x) => x.id === prev.currentSlideId) ? prev.currentSlideId : prev.slides[0].id,
          selectedId: prev.selectedId,
          editingTextId: null,
          cropId: null,
          historyKey: null,
          changeVersion: s.changeVersion + 1,
        })
      },

      redo: () => {
        const s = get()
        const next = s.future[0]
        if (!next) return
        set({
          ...titleSync(next.slides, s.changeVersion + 1),
          past: [...s.past, snapshot()].slice(-MAX_HISTORY),
          future: s.future.slice(1),
          slides: next.slides,
          currentSlideId: next.slides.some((x) => x.id === next.currentSlideId) ? next.currentSlideId : next.slides[0].id,
          selectedId: next.selectedId,
          editingTextId: null,
          cropId: null,
          historyKey: null,
          changeVersion: s.changeVersion + 1,
        })
      },

      copy: () => {
        const s = get()
        const el = currentSlide().design.elements.find((e) => e.id === s.selectedId)
        if (!el) return null
        set({ clipboard: structuredClone(el) })
        return el
      },

      paste: () => {
        const clip = get().clipboard
        if (!clip) return
        const copy = {
          ...structuredClone(clip),
          id: shortId(),
          locked: false,
          x: clip.x + 30,
          y: clip.y + 30,
        }
        get().addElement(copy as DesignElement)
        set({ clipboard: { ...clip, x: clip.x + 30, y: clip.y + 30 } })
      },

      setUpload: (id, patch) => {
        const uploads = get().uploads
        const prev = uploads[id] ?? {
          id,
          name: "image",
          progress: 0,
          status: "uploading" as const,
        }
        set({ uploads: { ...uploads, [id]: { ...prev, ...patch } } })
      },

      /** Swaps the temporary local image for the stored Cloudinary original everywhere, including undo history. */
      resolveUpload: (uploadId, data) => swapImages((e) => e.uploadId === uploadId, data),
      resolveLocal: (localSrc, data) => swapImages((e) => e.src === localSrc, data),

      markSaving: () => set({ saving: true }),
      markSaved: (revision, version) => {
        const s = get()
        const dirtyMeta = Object.fromEntries(Object.entries(s.dirtyMeta).filter(([, v]) => (v ?? 0) > version))
        set({
          saving: false,
          saveError: null,
          revision,
          savedVersion: version,
          dirtyMeta,
          lastSavedAt: Date.now(),
        })
      },
      markSaveError: (message) => set({ saving: false, saveError: message }),
      markConflict: () => set({ saving: false, conflict: true }),
      resolveConflictKeepMine: (latestRevision) => set({ conflict: false, saveError: null, revision: latestRevision }),
    }
  })
}

export function saveStatusOf(s: EditorState): SaveStatus {
  if (s.conflict) return "conflict"
  if (s.saving) return "saving"
  if (s.saveError) return "error"
  return s.changeVersion > s.savedVersion ? "dirty" : "saved"
}

export const EditorStoreContext = createContext<EditorStore | null>(null)

export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext)
  if (!store) throw new Error("useEditorStore must be used inside the editor")
  return store
}

export function useEditor<T>(selector: (state: EditorState & EditorActions) => T): T {
  return useStore(useEditorStore(), selector)
}

export function useCurrentSlide(): EditorSlide {
  return useEditor((s) => s.slides.find((sl) => sl.id === s.currentSlideId) ?? s.slides[0])
}

export function useSelectedElement(): DesignElement | null {
  return useEditor((s) => {
    if (!s.selectedId) return null
    const slide = s.slides.find((sl) => sl.id === s.currentSlideId) ?? s.slides[0]
    return slide.design.elements.find((e) => e.id === s.selectedId) ?? null
  })
}
