"use client"

import { DEFAULT_TEMPLATE_CONTEXT, type TemplateContext } from "@/lib/design/templates"
import { readCache, writeCache } from "@/lib/cache"
import { getSupabase } from "@/lib/supabase/client"
import type { UserSettings } from "@/lib/types"
import { toDataError } from "./errors"

const SETTINGS_KEY = "settings"
let cached: Promise<UserSettings> | null = null

async function fetchSettings(): Promise<UserSettings> {
  const { data, error } = await getSupabase().from("carousel_settings").select("settings").maybeSingle()
  if (error) throw toDataError(error)
  const settings = ((data?.settings as UserSettings | undefined) ?? {}) as UserSettings
  void writeCache(SETTINGS_KEY, settings)
  return settings
}

/**
 * The user's settings. Uses the copy saved on this device right away (and
 * refreshes it in the background); `refresh` always asks the database.
 */
export function getSettings(refresh = false): Promise<UserSettings> {
  if (!cached || refresh) {
    cached = refresh
      ? fetchSettings()
      : readCache<UserSettings>(SETTINGS_KEY).then((hit) => {
          const fresh = fetchSettings()
          if (!hit) return fresh
          fresh.then((s) => (cached = Promise.resolve(s))).catch(() => {})
          return hit.data
        })
    cached.catch(() => {
      cached = null
    })
  }
  return cached
}

export async function saveSettings(settings: UserSettings): Promise<UserSettings> {
  const supabase = getSupabase()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error("Please sign in again.")
  const { data, error } = await supabase
    .from("carousel_settings")
    .upsert({ user_id: auth.user.id, settings }, { onConflict: "user_id" })
    .select("settings")
    .single()
  if (error) throw toDataError(error)
  const saved = data.settings as UserSettings
  cached = Promise.resolve(saved)
  void writeCache(SETTINGS_KEY, saved)
  return saved
}

/** Template defaults (footer texts) from the user's settings. */
export function templateContextFrom(settings: UserSettings | null | undefined): TemplateContext {
  return {
    websiteText: settings?.websiteText?.trim() || DEFAULT_TEMPLATE_CONTEXT.websiteText,
    facebookText: settings?.facebookText?.trim() || DEFAULT_TEMPLATE_CONTEXT.facebookText,
    titleExtraGap: Number(settings?.titleFit?.extraGap) || 0,
    titleMatchHeadlines: settings?.titleFit?.matchHeadlines === true,
  }
}

export async function getTemplateContext(): Promise<TemplateContext> {
  try {
    return templateContextFrom(await getSettings())
  } catch {
    return DEFAULT_TEMPLATE_CONTEXT
  }
}
