"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import type Konva from "konva"
import { GalleryVerticalEnd, ImageIcon, LayoutTemplate, Type, type LucideIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { measureLineWidth, measureTextHeight } from "@/lib/design/measure"
import { buildCardDesign } from "@/lib/design/templates"
import type { TemplateContext } from "@/lib/design/templates"
import type { EditorSlide } from "@/lib/design/types"
import type { ProjectRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CanvasArea } from "./canvas/canvas-area"
import { ConflictBanner, EditorHeader } from "./header"
import { ImagesPanel } from "./left/images-panel"
import { SlidesPanel } from "./left/slides-panel"
import { TemplatesPanel } from "./left/templates-panel"
import { TextPanel } from "./left/text-panel"
import { useAutosave } from "./persistence"
import { useAutoLogo } from "./use-auto-logo"
import { CaptionPanel } from "./right/caption-panel"
import { LayersPanel } from "./right/layers-panel"
import { PropertiesPanel } from "./right/properties-panel"
import { createEditorStore, EditorStoreContext } from "./store"
import { useEditorShortcuts } from "./use-editor-shortcuts"
import { useFloatBridge } from "./use-float-bridge"
import { useLocalImages } from "./use-local-images"
import { useSlideThumbnails } from "./use-slide-thumbnails"
import { ZoomBar } from "./zoom-bar"

export interface EditorInit {
  project: ProjectRow
  slides: EditorSlide[]
  templateContext: TemplateContext
  /** True when restoring unsaved local changes. */
  dirty?: boolean
  initialSlideId?: string | null
  /** Add a new content card right away (from the Day Board's "Add card"). */
  addCard?: boolean
}

type LeftTab = "slides" | "images" | "text" | "templates"

const LEFT_TABS: { id: LeftTab; label: string; icon: LucideIcon }[] = [
  { id: "slides", label: "Slides", icon: GalleryVerticalEnd },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "text", label: "Text", icon: Type },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
]

export default function Editor({ init }: { init: EditorInit }) {
  const [store] = useState(() => {
    const created = createEditorStore({
      project: {
        id: init.project.id,
        title: init.project.title,
        topic: init.project.topic,
        caption: init.project.caption,
        scheduled_at: init.project.scheduled_at,
        status: init.project.status,
      },
      slides: init.slides,
      revision: init.project.revision,
      templateContext: init.templateContext,
      measure: measureTextHeight,
      measureLine: measureLineWidth,
      dirty: init.dirty,
      initialSlideId: init.initialSlideId,
    })
    if (init.addCard) created.getState().addSlide(buildCardDesign())
    return created
  })

  // Drop one-off query parameters (?slide=, ?add=) so a reload doesn't repeat them.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname)
  }, [])
  const stageRef = useRef<Konva.Stage>(null)
  const [leftTab, setLeftTab] = useState<LeftTab | null>("slides")
  const [rightOpen, setRightOpen] = useState(false)

  useAutosave(store)
  useSlideThumbnails(store)
  useAutoLogo(store)
  useEditorShortcuts(store)
  useFloatBridge(store)
  useLocalImages(store)

  return (
    <EditorStoreContext.Provider value={store}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <EditorHeader onToggleRight={() => setRightOpen((o) => !o)} />
        <ConflictBanner />
        <div className="relative flex min-h-0 flex-1">
          {/* Left: tool rail + panel */}
          <nav aria-label="Editor tools" className="flex w-16 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
            {LEFT_TABS.map((tab) => (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setLeftTab((t) => (t === tab.id ? null : tab.id))}
                    aria-pressed={leftTab === tab.id}
                    className={cn(
                      "flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      leftTab === tab.id && "bg-accent text-primary hover:bg-accent hover:text-primary",
                    )}
                  >
                    <tab.icon className="size-5" />
                    {tab.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{leftTab === tab.id ? `Hide ${tab.label.toLowerCase()}` : tab.label}</TooltipContent>
              </Tooltip>
            ))}
          </nav>
          {leftTab && (
            <aside className="absolute inset-y-0 left-16 z-20 w-72 shrink-0 border-r bg-card shadow-lg md:static md:z-auto md:shadow-none" aria-label={`${leftTab} panel`}>
              <LeftPanel tab={leftTab} />
            </aside>
          )}

          {/* Center: canvas */}
          <div className="flex min-w-0 flex-1 flex-col">
            <CanvasArea stageRef={stageRef} />
            <ZoomBar />
          </div>

          {/* Right: properties */}
          <aside
            className={cn(
              "absolute inset-y-0 right-0 z-20 w-80 shrink-0 border-l bg-card shadow-lg xl:static xl:z-auto xl:flex xl:shadow-none",
              rightOpen ? "flex" : "hidden",
            )}
            aria-label="Properties"
          >
            <RightPanel />
          </aside>
        </div>
      </div>
    </EditorStoreContext.Provider>
  )
}

function LeftPanel({ tab }: { tab: LeftTab }) {
  const panels: Record<LeftTab, ReactNode> = {
    slides: <SlidesPanel />,
    images: <ImagesPanel />,
    text: <TextPanel />,
    templates: <TemplatesPanel />,
  }
  return <div className="h-full">{panels[tab]}</div>
}

function RightPanel() {
  return (
    <Tabs defaultValue="design" className="flex h-full w-full flex-col gap-0">
      <div className="border-b px-3 py-2">
        <TabsList className="w-full">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="layers">Layers</TabsTrigger>
          <TabsTrigger value="caption">Caption</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="design" className="min-h-0 flex-1 overflow-y-auto">
        <PropertiesPanel />
      </TabsContent>
      <TabsContent value="layers" className="min-h-0 flex-1 overflow-y-auto">
        <LayersPanel />
      </TabsContent>
      <TabsContent value="caption" className="min-h-0 flex-1 overflow-y-auto">
        <CaptionPanel />
      </TabsContent>
    </Tabs>
  )
}
