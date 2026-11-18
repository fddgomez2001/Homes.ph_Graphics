"use client"

import { useState } from "react"
import { Loader2, Users } from "lucide-react"
import { toast } from "sonner"
import { AssignedPagesPicker } from "@/components/pages/assigned-pages-picker"
import { Button } from "@/components/ui/button"
import { saveAssignment, useAssignment } from "@/lib/assignment"
import { hasAnyPage, sameAssignment, type Assignment } from "@/lib/pages"
import { errorMessage } from "@/lib/utils"

/** Settings → Assigned pages: the pages this person handles (the app and the Chrome extension follow them). */
export function AssignedPagesSection() {
  const { assignment, chosen } = useAssignment()
  const [draft, setDraft] = useState<Assignment | null>(null)
  const [busy, setBusy] = useState(false)
  const value = draft ?? assignment
  const changed = !!draft && !sameAssignment(draft, assignment)
  const empty = !hasAnyPage(value) && !value.carousel

  const save = async () => {
    setBusy(true)
    try {
      await saveAssignment(value)
      setDraft(null)
      toast.success("Assigned pages saved", { description: "The menus, News Article, Poster Maker, Advertisement, the Daily Report and the extension follow them now." })
    } catch (e) {
      toast.error("Couldn't save the pages", { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="assigned-pages" className="scroll-mt-20 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Users className="size-4 text-primary" /> Assigned pages
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        The pages you handle. The sidebar, Home, News Article, Poster Maker, Advertisement, the Daily Report and the Homes.ph Publisher extension (its Posting and
        Reports tabs, and the tasks it adds in My Tasks) show only these.
        {!chosen && " Not chosen yet: everything the app always had is shown."}
      </p>
      <AssignedPagesPicker value={value} onChange={setDraft} disabled={busy} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={busy || empty || (!changed && chosen)}>
          {busy && <Loader2 className="animate-spin" />} Save assigned pages
        </Button>
        {changed && (
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
            Undo changes
          </Button>
        )}
        {empty && <span className="text-sm text-amber-700 dark:text-amber-300">Tick at least one page, or turn on Carousel.</span>}
      </div>
    </section>
  )
}
