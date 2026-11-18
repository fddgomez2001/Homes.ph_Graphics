import { desktopDownloadUrl, desktopDownloadsConfigured, listDesktopReleases } from "@/lib/desktop-release"
import { getRequestUser } from "@/lib/supabase/server"

/** A redirect on the same site, whatever host name the request came in on. */
const back = (location: string) => new Response(null, { status: 307, headers: { location, "cache-control": "no-store" } })

/**
 * /api/desktop/download (?version=1.21.0): the Windows installer for signed-in people
 * only. Sends the browser to a download link that works for 15 minutes; the file itself
 * is private (it carries the team's keys).
 */
export async function GET(request: Request) {
  const { user } = await getRequestUser()
  if (!user) return back("/login?next=%2Fgraphicdesktopapp")
  if (!desktopDownloadsConfigured()) return back("/graphicdesktopapp?error=not-set-up")
  try {
    const wanted = new URL(request.url).searchParams.get("version")
    const releases = await listDesktopReleases()
    const release = wanted ? releases.find((r) => r.version === wanted) : releases[0]
    if (!release) return back("/graphicdesktopapp?error=none")
    return new Response(null, { status: 307, headers: { location: await desktopDownloadUrl(release.pathname), "cache-control": "no-store" } })
  } catch {
    return back("/graphicdesktopapp?error=failed")
  }
}
