"use client"

import { useState, type FormEvent } from "react"
import { Database, Loader2, LogOut, UserPlus, Users, X } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCachedQuery } from "@/lib/cache"
import { addTeammate, getMyProfile, listTeam, removeTeammate, setMyName, type TeamMember } from "@/lib/data/posting"
import { projectFeatures } from "@/lib/data/projects"
import { errorMessage } from "@/lib/utils"

/**
 * Your name (shown as "Made by" and "Posted by") and your team: everyone in a
 * team sees, edits and posts the team's carousels with their own login.
 */
export function TeamSection() {
  const features = useCachedQuery("posting:features", () => projectFeatures(), { freshFor: 60_000 })
  const me = useCachedQuery("profile:me", getMyProfile, { freshFor: 60_000 })
  const team = useCachedQuery(features.data?.posting ? "team:list" : null, listTeam, { freshFor: 10_000, errorMessage })
  const confirm = useConfirm()
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState<"name" | "add" | null>(null)
  const shownName = name ?? me.data?.name ?? ""

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    if (!shownName.trim()) return
    setBusy("name")
    try {
      await setMyName(shownName)
      await me.reload()
      setName(null)
      toast.success("Name saved", { description: "New carousels and ticks show this name." })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy("add")
    try {
      await addTeammate(email)
      await team.reload()
      toast.success("Teammate added", { description: `${email.trim()} now sees and posts your carousels.` })
      setEmail("")
    } catch (err) {
      toast.error("Couldn't add them", { description: errorMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (member: TeamMember) => {
    const leaving = member.is_me
    const ok = await confirm({
      title: leaving ? "Leave this team?" : `Remove ${member.name}?`,
      description: leaving ? "You'll no longer see the team's carousels." : `${member.name} will no longer see or post your carousels.`,
      confirmLabel: leaving ? "Leave team" : "Remove",
      destructive: true,
    })
    if (!ok) return
    try {
      await removeTeammate(member.user_id)
      await team.reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const members = team.data ?? []
  const myId = me.data?.id
  const teams = [...new Set(members.map((m) => m.team_id))].sort((a, b) => (a === myId ? -1 : b === myId ? 1 : 0))

  return (
    <section className="rounded-xl border bg-card p-5" aria-labelledby="team-heading">
      <h2 id="team-heading" className="flex items-center gap-2 font-semibold">
        <Users className="size-4" /> Team
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your name shows as <strong>Made by</strong> on the carousels you create and <strong>Posted by</strong> on the Facebook pages you tick.
      </p>

      <form onSubmit={saveName} className="mt-4 flex max-w-md flex-col gap-1.5">
        <Label htmlFor="team-my-name">Your name</Label>
        <div className="flex gap-2">
          <Input id="team-my-name" value={shownName} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frank Gomez" maxLength={80} />
          <Button type="submit" variant="outline" disabled={busy !== null || !shownName.trim() || shownName.trim() === me.data?.name}>
            {busy === "name" && <Loader2 className="animate-spin" />} Save
          </Button>
        </div>
      </form>

      {features.data && !features.data.posting ? (
        <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Database className="mt-0.5 size-4 shrink-0" />
          <p>
            To share carousels with teammates, run <code className="rounded bg-card/70 px-1">supabase/migrations/20261031000000_team_posting.sql</code> in the
            Supabase SQL Editor, then reload.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-4">
            {team.error && <p className="text-sm text-destructive">{team.error}</p>}
            {teams.length === 0 && !team.error && (
              <p className="text-sm text-muted-foreground">No teammates yet. Add someone below to share your carousels with them.</p>
            )}
            {teams.map((teamId) => {
              const list = members.filter((m) => m.team_id === teamId)
              const owner = list.find((m) => m.role === "owner")
              const mine = teamId === myId
              return (
                <div key={teamId}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {mine ? "Your team" : `${owner?.name ?? "A"}'s team`}
                  </h3>
                  <ul className="divide-y rounded-lg border" aria-label={mine ? "Your team" : `${owner?.name ?? ""}'s team`}>
                    {list.map((m) => (
                      <li key={m.user_id} className="flex items-center gap-3 px-3 py-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                          {(m.name[0] ?? "?").toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {m.name}
                            {m.is_me && <span className="font-normal text-muted-foreground"> (you)</span>}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {m.email} · {m.role === "owner" ? "Owner" : "Member"}
                          </span>
                        </span>
                        {m.role === "member" && (mine || m.is_me) && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void remove(m)}>
                            {m.is_me ? <LogOut /> : <X />} {m.is_me ? "Leave" : "Remove"}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <form onSubmit={add} className="mt-4 flex max-w-md flex-col gap-1.5">
            <Label htmlFor="team-add-email">Add a teammate</Label>
            <div className="flex gap-2">
              <Input id="team-add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their account email" autoComplete="off" />
              <Button type="submit" disabled={busy !== null || !email.trim()}>
                {busy === "add" ? <Loader2 className="animate-spin" /> : <UserPlus />} Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              They need their own account first (Supabase → Authentication → Add user, with Auto confirm). Then they sign in with it and see your carousels.
            </p>
          </form>
        </>
      )}
    </section>
  )
}
