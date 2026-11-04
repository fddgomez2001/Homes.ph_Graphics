"use client"

import { invalidate } from "@/lib/cache"
import type { SlideDesign, SlideType } from "@/lib/design/types"
import { getSupabase } from "@/lib/supabase/client"
import type { TemplateRow } from "@/lib/types"
import { toDataError } from "./errors"

const COLUMNS = "id,name,slide_type,design_json,thumbnail,created_at,updated_at"

export async function listTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await getSupabase().from("carousel_templates").select(COLUMNS).order("created_at", { ascending: false })
  if (error) throw toDataError(error)
  return (data ?? []) as TemplateRow[]
}

export async function createTemplate(input: {
  name: string
  slideType: SlideType
  design: SlideDesign
  thumbnail: string | null
}): Promise<TemplateRow> {
  const { data, error } = await getSupabase()
    .from("carousel_templates")
    .insert({ name: input.name, slide_type: input.slideType, design_json: input.design, thumbnail: input.thumbnail })
    .select(COLUMNS)
    .single()
  if (error) throw toDataError(error)
  invalidate("templates")
  return data as TemplateRow
}

export async function renameTemplate(id: string, name: string): Promise<void> {
  const { error } = await getSupabase().from("carousel_templates").update({ name }).eq("id", id)
  if (error) throw toDataError(error)
  invalidate("templates")
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await getSupabase().from("carousel_templates").delete().eq("id", id)
  if (error) throw toDataError(error)
  invalidate("templates")
}
