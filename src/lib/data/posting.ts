"use client"

import { invalidate } from "@/lib/cache"
import { getSupabase } from "@/lib/supabase/client"
import type { ProjectRow } from "@/lib/types"
import { toDataError } from "./errors"

/** A Facebook page every carousel is posted to (the list lives in the database). */
export interface PostPage {
  key: string
  /** "Homes.ph Cebu" */
  name: string
  /** "Cebu" */
  short_name: string
  sort: number
}

/** One page ticked on a carousel's checklist: who posted it and when. */
export interface PostCheck {
  project_id: string
  page_key: string
  checked_by: string | null
  checked_by_name: string
  checked_at: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  email: string
  name: string
  role: "owner" | "member"
  is_me: boolean
}

export async function listPostPages(): Promise<PostPage[]> {
  const { data, error } = await getSupabase().from("carousel_post_pages").select("key,name,short_name,sort").order("sort")
  if (error) throw toDataError(error)
  return (data ?? []) as PostPage[]
}

export async function listPostChecks(projectId: string): Promise<PostCheck[]> {
  const { data, error } = await getSupabase()
    .from("carousel_post_checks")
    .select("project_id,page_key,checked_by,checked_by_name,checked_at")
    .eq("project_id", projectId)
    .order("checked_at")
  if (error) throw toDataError(error)
  return (data ?? []) as PostCheck[]
}

/**
 * Ticks (or unticks) a page. The database records who is signed in and the time,
 * and marks the carousel Published once every page is ticked.
 */
export async function setPostCheck(projectId: string, pageKey: string, checked: boolean): Promise<void> {
  const table = getSupabase().from("carousel_post_checks")
  const { error } = checked
    ? await table.upsert({ project_id: projectId, page_key: pageKey }, { onConflict: "project_id,page_key", ignoreDuplicates: true })
    : await table.delete().eq("project_id", projectId).eq("page_key", pageKey)
  if (error) throw toDataError(error)
  invalidate(`posting:checks:${projectId}`)
  invalidate("projects:")
}

/** Where the posting of a carousel stands. */
export type PostingState = "posted" | "partial" | "none"

export function postingState(project: Pick<ProjectRow, "status" | "posted_count">): PostingState {
  if (project.status === "published") return "posted"
  return (project.posted_count ?? 0) > 0 ? "partial" : "none"
}

/** Everyone in the teams the signed-in user belongs to. */
export async function listTeam(): Promise<TeamMember[]> {
  const { data, error } = await getSupabase().rpc("carousel_team_list")
  if (error) throw toDataError(error)
  return (data ?? []) as TeamMember[]
}

/** Shares your carousels with someone who already has an account. */
export async function addTeammate(email: string): Promise<void> {
  const { error } = await getSupabase().rpc("carousel_team_add", { p_email: email.trim() })
  if (error) throw toDataError(error)
  invalidate("team:")
  invalidate("projects:")
}

/** Removes a teammate (as the owner) or leaves a team (yourself). */
export async function removeTeammate(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc("carousel_team_remove", { p_user: userId })
  if (error) throw toDataError(error)
  invalidate("team:")
  invalidate("projects:")
}

export interface MyProfile {
  id: string
  email: string
  /** "Your name" from Settings ("" when not set yet). */
  name: string
}

export async function getMyProfile(): Promise<MyProfile | null> {
  const { data } = await getSupabase().auth.getSession()
  const user = data.session?.user
  if (!user) return null
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : ""
  return { id: user.id, email: user.email ?? "", name }
}

/** Saves the name teammates see in "Made by" and "Posted by". */
export async function setMyName(name: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim().slice(0, 80) } })
  if (error) throw toDataError(error)
  await supabase.auth.refreshSession().catch(() => {})
  invalidate("profile:")
  invalidate("team:")
}

/** "Frank Gomez | Peter Yares" */
export function postedByLabel(names: string[] | undefined) {
  return (names ?? []).filter(Boolean).join(" | ")
}
