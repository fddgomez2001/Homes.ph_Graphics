"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { invalidateProjects } from "@/components/projects/use-projects"
import { newsTimeLabel } from "@/lib/design/news-templates"
import { reportBrandLabel } from "@/lib/news-lanes"
import { getDesktop, type ExtensionRequest } from "@/lib/desktop"
import { extensionCarouselDay, extensionCarouselImages, extensionCarouselPosted } from "@/lib/extension-carousel"
import { extensionNewsPost, extensionNewsStatus, type ExtensionNewsInput } from "@/lib/extension-news"
import { errorMessage } from "@/lib/utils"

const label = (p: ExtensionNewsInput) => `${reportBrandLabel(p.brand)} ${newsTimeLabel(p.time)}`

/**
 * Answers the Homes.ph Publisher Chrome extension (desktop app, main window): an article published there
 * becomes the slot's News Article post, and its template picture goes back to the extension. Carousels: the
 * day's scheduled carousel with its checklist, its slides as 1.png, 2.png…, and the pages it was posted to
 * ticked on the checklist. Advertisements: the day's scheduled ads, each one's PNG (latest version) and its
 * Facebook post marked on the calendar. Daily Trend News: the day's posters, their PNGs and report texts.
 */
export function ExtensionBridge() {
  useEffect(() => {
    const bridge = getDesktop()?.extension
    if (!bridge) return
    const off = bridge.onRequest(async (request) => {
      const payload = request.payload as unknown as ExtensionNewsInput & { facebook?: "scheduled" | "posted" | null; projectId?: string | null }
      try {
        if (request.type === "news-post") {
          const result = await extensionNewsPost(payload)
          invalidateProjects()
          toast.success(`${result.created ? "Added" : "Updated"} from Chrome: ${label(payload)}`, { description: `${payload.headline} · ${result.fileName} saved in your download folder` })
          await bridge.reply(request.id, true, result)
        } else if (request.type === "news-status") {
          const result = await extensionNewsStatus(payload)
          invalidateProjects()
          if (result.updated) toast.success(`Published: ${label(payload)}`, { description: payload.facebook === "posted" ? "Posted on Facebook" : "Facebook post scheduled" })
          await bridge.reply(request.id, true, result)
        } else if (request.type === "carousel-day") {
          await bridge.reply(request.id, true, await extensionCarouselDay(request.payload as { day: string }))
        } else if (request.type === "carousel-images") {
          const input = request.payload as { projectId: string; save: boolean }
          const result = await extensionCarouselImages(input)
          if (result.savedTo) toast.success(`Carousel slides for Chrome: ${result.title}`, { description: `${result.files.length} PNGs (1 = cover) saved in ${result.savedTo}` })
          await bridge.reply(request.id, true, result)
        } else if (request.type === "carousel-posted") {
          const input = request.payload as { projectId: string; pageKeys: string[]; facebook: "posted" | "scheduled" | null }
          const result = await extensionCarouselPosted(input)
          invalidateProjects()
          toast.success(`Carousel ${input.facebook === "posted" ? "posted" : "scheduled"} from Chrome: ${result.names.join(", ")}`, {
            description: `Ticked on the posting checklist · ${result.done}/${result.total} pages`,
          })
          await bridge.reply(request.id, true, result)
        } else if (AD_REQUESTS.has(request.type)) {
          await answerAds(request, bridge.reply)
        } else await bridge.reply(request.id, false, { error: "Unknown request" })
      } catch (e) {
        await bridge.reply(request.id, false, { error: errorMessage(e) }).catch(() => {})
      }
    })
    bridge.ready()
    return off
  }, [])
  return null
}

const AD_REQUESTS = new Set<ExtensionRequest["type"]>(["ads-day", "ad-image", "ad-posted", "trends-day", "trend-image", "trend-texts"])

/** Advertisements and Daily Trend News (their drawing code loads only when the extension asks). */
async function answerAds(request: ExtensionRequest, reply: (id: string, ok: boolean, result: unknown) => Promise<void>) {
  const { extensionAdImage, extensionAdPosted, extensionAdsDay, extensionTrendImage, extensionTrendsDay, extensionTrendTexts } = await import("@/lib/extension-ads")
  if (request.type === "ads-day") {
    await reply(request.id, true, await extensionAdsDay(request.payload as { day: string }))
  } else if (request.type === "ad-image") {
    const { label, ...result } = await extensionAdImage(request.payload as { id: string; save: boolean })
    if (result.savedTo) toast.success(`Advertisement for Chrome: ${label}`, { description: `${result.name} saved in ${result.savedTo}` })
    await reply(request.id, true, result)
  } else if (request.type === "ad-posted") {
    const input = request.payload as { id: string; facebook: "posted" | "scheduled" }
    const { label, ...result } = await extensionAdPosted(input)
    toast.success(`Advertisement ${input.facebook === "posted" ? "posted" : "scheduled"} from Chrome: ${label}`, { description: "Marked on the Advertisement calendar" })
    await reply(request.id, true, result)
  } else if (request.type === "trends-day") {
    await reply(request.id, true, await extensionTrendsDay(request.payload as { day: string }))
  } else if (request.type === "trend-image") {
    const { label, ...result } = await extensionTrendImage(request.payload as { id: string; save: boolean })
    if (result.savedTo) toast.success(`Trend poster for Chrome: ${label}`, { description: `${result.name} saved in ${result.savedTo}` })
    await reply(request.id, true, result)
  } else if (request.type === "trend-texts") {
    const { written, ...result } = await extensionTrendTexts(request.payload as { ids: string[] })
    if (written) invalidateProjects()
    await reply(request.id, true, result)
  }
}
