import { Suspense } from "react"
import { connection } from "next/server"
import { AlertTriangle, CheckCircle2, Download, Loader2, MonitorDown, ShieldCheck } from "lucide-react"
import { desktopDownloadsConfigured, latestDesktopRelease, listDesktopReleases } from "@/lib/desktop-release"

const ERRORS: Record<string, string> = {
  "not-set-up": "Downloads aren't set up on this website yet.",
  none: "No installer has been published yet.",
  failed: "The download link couldn't be made. Please try again.",
}

const sizeText = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`
const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" })

/**
 * The Windows app's download page: the newest installer (published with
 * `npm run desktop:publish`), always the latest, for signed-in people only.
 */
export default function DesktopAppPage({ searchParams }: PageProps<"/graphicdesktopapp">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MonitorDown className="size-7" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Homes.ph Graphics for Windows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The Homes.ph SocMedSystem desktop app: carousels, news posts, the Poster Maker, the daily report and more. This page always has the newest version.
          </p>
        </div>
      </div>
      <Suspense fallback={<ReleaseSkeleton />}>
        <LatestRelease searchParams={searchParams} />
      </Suspense>
      <section className="rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-semibold">Installing and updating</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>Download the installer and open it. If Windows SmartScreen appears, click <span className="font-medium text-foreground">More info → Run anyway</span> (the app isn&apos;t code-signed).</li>
          <li>It installs for your Windows account and opens the app. Sign in with your Homes.ph Graphics account.</li>
          <li>To update, close the app, then download and open the newest installer here. Your settings and saved work are kept.</li>
        </ol>
      </section>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        Only signed-in team members can download it: the installer includes the team&apos;s image storage and AI settings. Please don&apos;t share the file outside the team.
      </p>
    </main>
  )
}

async function LatestRelease({ searchParams }: { searchParams: PageProps<"/graphicdesktopapp">["searchParams"] }) {
  await connection()
  const error = (await searchParams).error
  const message = typeof error === "string" ? ERRORS[error] : undefined
  if (!desktopDownloadsConfigured()) {
    return (
      <Notice>
        Downloads aren&apos;t set up on this website yet. The owner connects a <span className="font-medium">private Vercel Blob store</span> to the project (that adds{" "}
        <code className="rounded bg-muted px-1">BLOB_STORE_ID</code> or <code className="rounded bg-muted px-1">BLOB_READ_WRITE_TOKEN</code>), redeploys, then publishes the installer
        with <code className="rounded bg-muted px-1">npm run desktop:publish</code>.
      </Notice>
    )
  }
  let release: Awaited<ReturnType<typeof latestDesktopRelease>> = null
  let older: Awaited<ReturnType<typeof listDesktopReleases>> = []
  try {
    release = await latestDesktopRelease()
    older = (await listDesktopReleases()).slice(1, 4)
  } catch {
    return <Notice>The download list couldn&apos;t be loaded right now. Please refresh in a moment.</Notice>
  }
  if (!release) return <Notice>No installer has been published yet.</Notice>
  return (
    <>
      {message && <Notice>{message}</Notice>}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" /> Latest version
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{release.version}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Published {dateText(release.uploadedAt)} · {sizeText(release.size)} · Windows 10 and 11 (64-bit)
            </p>
          </div>
          {/* A normal link: the route checks the sign-in, then sends the browser to the file. */}
          <a
            href="/api/desktop/download"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <Download className="size-4" /> Download for Windows
          </a>
        </div>
        {release.notes && (
          <div className="mt-4 border-t pt-4">
            <h2 className="text-sm font-semibold">What&apos;s new</h2>
            <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{release.notes}</p>
          </div>
        )}
      </section>
      {older.length > 0 && (
        <section className="text-sm">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Earlier versions</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {older.map((r) => (
              <li key={r.pathname} className="flex items-center gap-2">
                <a href={`/api/desktop/download?version=${encodeURIComponent(r.version)}`} className="font-medium underline-offset-2 hover:underline">
                  {r.version}
                </a>
                <span className="text-xs text-muted-foreground">
                  {dateText(r.uploadedAt)} · {sizeText(r.size)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function ReleaseSkeleton() {
  return (
    <section className="flex h-32 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> Looking for the newest version…
    </section>
  )
}
