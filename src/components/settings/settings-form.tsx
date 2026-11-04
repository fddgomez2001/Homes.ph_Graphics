"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CheckCircle2, FolderOpen, Loader2, LogOut, MonitorCog, Sparkles, XCircle } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app-shell/page-header"
import { useCurrentUserEmail, useSignOut } from "@/components/app-shell/user-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { CloudinaryStatus } from "@/lib/cloudinary/types"
import { cloudinaryStatusEvents, getCloudinaryStatus, getIntegrationStatus, type IntegrationStatus } from "@/lib/data/assets"
import { BackupSection } from "@/components/backup/backup-section"
import { aiWrite } from "@/lib/ai/client"
import { StorageSection } from "./storage-section"
import { TeamSection } from "./team-section"
import { checkSchema } from "@/lib/data/projects"
import { getSettings, saveSettings } from "@/lib/data/settings"
import {
  DEFAULT_FACEBOOK_TEXT,
  DEFAULT_WEBSITE_TEXT,
  ICON_FACEBOOK_SRC,
  ICON_WEB_SRC,
  LOGO_BLUE_SRC,
  LOGO_WHITE_SRC,
} from "@/lib/design/constants"
import { getDesktop, type DesktopConfigStatus } from "@/lib/desktop"
import type { UserSettings } from "@/lib/types"
import { errorMessage } from "@/lib/utils"

export function SettingsForm() {
  const email = useCurrentUserEmail()
  const signOut = useSignOut()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [website, setWebsite] = useState("")
  const [facebook, setFacebook] = useState("")
  const [extraGap, setExtraGap] = useState(0)
  const [matchHeadlines, setMatchHeadlines] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [cloud, setCloud] = useState<CloudinaryStatus | null>(null)
  const [schema, setSchema] = useState<"ok" | "missing" | "error" | null>(null)

  useEffect(() => {
    getSettings(true)
      .then((s) => {
        setSettings(s)
        setWebsite(s.websiteText ?? DEFAULT_WEBSITE_TEXT)
        setFacebook(s.facebookText ?? DEFAULT_FACEBOOK_TEXT)
        setExtraGap(Number(s.titleFit?.extraGap) || 0)
        setMatchHeadlines(s.titleFit?.matchHeadlines === true)
      })
      .catch((e) => {
        toast.error(errorMessage(e))
        setSettings({})
        setWebsite(DEFAULT_WEBSITE_TEXT)
        setFacebook(DEFAULT_FACEBOOK_TEXT)
      })
    getIntegrationStatus(true).then(setStatus)
    getCloudinaryStatus().then(setCloud, () => setCloud(null))
    checkSchema(true).then(setSchema, () => setSchema("error"))
  }, [])

  // Follow re-checks made from the Image storage card.
  useEffect(() => {
    const onStatus = (e: Event) => setCloud((e as CustomEvent<CloudinaryStatus>).detail)
    cloudinaryStatusEvents.addEventListener("status", onStatus)
    return () => cloudinaryStatusEvents.removeEventListener("status", onStatus)
  }, [])

  const saveBrand = async () => {
    setBusy(true)
    try {
      setSettings(
        await saveSettings({
          ...settings,
          websiteText: website.trim() || DEFAULT_WEBSITE_TEXT,
          facebookText: facebook.trim() || DEFAULT_FACEBOOK_TEXT,
          titleFit: { extraGap, matchHeadlines },
        }),
      )
      toast.success("Saved. New slides will use these settings.")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-3xl flex-col gap-6 p-4 lg:p-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Brand</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The Homes.ph logo switches automatically: the <span className="font-medium text-foreground">blue logo</span> on light photos and
            the <span className="font-medium text-foreground">white logo</span> on dark photos or the blue fade. To force one on a slide,
            select the logo and choose its color.
          </p>
          <div className="flex flex-wrap gap-4">
            <figure className="flex flex-col items-center gap-2">
              <div className="flex size-28 items-center justify-center rounded-lg bg-gradient-to-b from-[#0730A3] to-[#0B1767]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_WHITE_SRC} alt="Homes.ph logo, white" className="h-[70px] w-[72px]" />
              </div>
              <figcaption className="text-xs text-muted-foreground">White · dark backgrounds</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-2">
              <div className="flex size-28 items-center justify-center rounded-lg border bg-gradient-to-b from-sky-100 to-white dark:border-transparent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_BLUE_SRC} alt="Homes.ph logo, blue" className="h-[63px] w-[65px]" />
              </div>
              <figcaption className="text-xs text-muted-foreground">Blue · light backgrounds</figcaption>
            </figure>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <h3 className="text-sm font-medium">Footer (cover and text cards)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="website" className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded bg-[#0D1969]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ICON_WEB_SRC} alt="" className="size-4" />
                  </span>
                  Website
                </Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={80} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="facebook" className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded bg-[#0D1969]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ICON_FACEBOOK_SRC} alt="" className="size-4" />
                  </span>
                  Facebook page
                </Label>
                <Input id="facebook" value={facebook} onChange={(e) => setFacebook(e.target.value)} maxLength={80} />
              </div>
            </div>
            <h3 className="mt-3 text-sm font-medium">Title Auto-Fit defaults (new covers)</h3>
            <p className="-mt-1 text-xs text-muted-foreground">
              Same options as the Homes.ph Title Auto-Fit plugin. You can still change them on each cover.
            </p>
            <label className="flex max-w-md items-center justify-between gap-2 text-sm">
              <span>Same size for white &amp; gold lines</span>
              <Switch checked={matchHeadlines} onCheckedChange={setMatchHeadlines} aria-label="Same size for white and gold lines" />
            </label>
            <div className="flex max-w-md items-center gap-3 text-sm">
              <span className="shrink-0">Extra line gap</span>
              <Slider value={[extraGap]} min={-20} max={40} step={1} onValueChange={([v]) => setExtraGap(v)} aria-label="Extra line gap" />
              <span className="w-12 text-right tabular-nums">{extraGap}px</span>
            </div>
            <div>
              <Button variant="outline" disabled={busy || !settings} onClick={() => void saveBrand()}>
                {busy && <Loader2 className="animate-spin" />} Save brand settings
              </Button>
            </div>
          </div>
        </section>

        <StorageSection />

        <TeamSection />

        <BackupSection />

        <DesktopConnection />

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Connections</h2>
          <ul className="flex flex-col gap-2 text-sm">
            <StatusRow
              ok={status?.supabase && schema === "ok"}
              loading={!status || !schema}
              label="Supabase database"
              detail={
                schema === "missing"
                  ? "Connected, but the tables are missing — run the SQL migration (see README)."
                  : schema === "error"
                    ? "Can't reach the database."
                    : "Projects, slides and settings are saved here."
              }
            />
            <StatusRow
              ok={cloud?.configured === true && (cloud.ok || cloud.reason === "permission")}
              loading={!status || (status.cloudinary && !cloud)}
              label="Cloudinary image storage"
              detail={
                !status?.cloudinary
                  ? `Missing ${status?.missingCloudinary.join(", ") ?? "configuration"}.`
                  : cloud?.configured && !cloud.ok && cloud.reason !== "permission"
                    ? `Not working: ${cloud.error} (see Image storage above).`
                    : "Original images are stored here."
              }
            />
            <StatusRow
              ok={status?.ai}
              loading={!status}
              label="Groq AI suggestions"
              detail={status?.ai ? "Writes card descriptions, cover subtitles and post captions on request." : "Add GROQ_API_KEY to turn on the AI suggestions."}
            />
          </ul>
          {status?.ai && <AiTest />}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Account</h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="text-muted-foreground">Signed in as</div>
              <div className="font-medium">{email ?? "…"}</div>
            </div>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}

/** Only in the Windows app: Cloudinary details are stored on this computer, never sent to the browser. */
function DesktopConnection() {
  const [desktop] = useState(getDesktop)
  const [config, setConfig] = useState<DesktopConfigStatus | null>(null)
  const [cloudName, setCloudName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [groqKey, setGroqKey] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    desktop?.getConfig().then((c) => {
      setConfig(c)
      setCloudName(c.cloudName)
    })
  }, [desktop])

  if (!desktop) return null

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await desktop.saveConfig({
        cloudName: cloudName.trim(),
        apiKey: apiKey.trim() || undefined,
        apiSecret: apiSecret.trim() || undefined,
        groqKey: groqKey.trim() || undefined,
      })
      toast.success("Saved. Restarting…")
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <MonitorCog className="size-4" /> Desktop app connection
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Cloudinary details for image uploads and the Groq key for AI suggestions, stored only on this computer. Leave a key or secret empty to keep the saved one.
      </p>
      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-cloud">Cloud name</Label>
            <Input id="d-cloud" value={cloudName} onChange={(e) => setCloudName(e.target.value)} placeholder="e.g. homesph" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-key">API key {config?.hasApiKey && <span className="font-normal text-emerald-700 dark:text-emerald-300">· saved</span>}</Label>
            <Input id="d-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={config?.hasApiKey ? "••••••••" : ""} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-secret">API secret {config?.hasApiSecret && <span className="font-normal text-emerald-700 dark:text-emerald-300">· saved</span>}</Label>
            <Input
              id="d-secret"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={config?.hasApiSecret ? "••••••••" : ""}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:max-w-sm">
          <Label htmlFor="d-groq">Groq API key (AI suggestions) {config?.hasGroqKey && <span className="font-normal text-emerald-700 dark:text-emerald-300">· saved</span>}</Label>
          <Input
            id="d-groq"
            type="password"
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            placeholder={config?.hasGroqKey ? "••••••••" : "gsk_…"}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Save and restart
          </Button>
          <Button type="button" variant="ghost" onClick={() => void desktop.openDataFolder()}>
            <FolderOpen /> Open app data folder
          </Button>
          <span className="text-xs text-muted-foreground">Version {desktop.version}</span>
        </div>
      </form>
    </section>
  )
}

/** One small real request (a sample subtitle) to prove the Groq key and model work. */
function AiTest() {
  const [state, setState] = useState<{ busy: boolean; ok?: boolean; message?: string }>({ busy: false })
  const run = async () => {
    setState({ busy: true })
    try {
      const text = await aiWrite({
        task: "cover-subtitle",
        maxChars: 50,
        carousel: {
          title: "Every Sound Carries A Story.",
          subtitle: "",
          cards: [
            { title: "Kulintang", subtitle: "A Melody Of Many Gongs", description: "A row of tuned gongs from Mindanao." },
            { title: "Gangsa", subtitle: "The Rhythmic Heart Of The Highlands", description: "Flat gongs played in the Cordillera." },
          ],
        },
      })
      setState({ busy: false, ok: true, message: `Works. Sample subtitle: “${text}”` })
    } catch (e) {
      setState({ busy: false, ok: false, message: errorMessage(e) })
    }
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3 text-sm">
      <Button size="sm" variant="outline" onClick={() => void run()} disabled={state.busy}>
        {state.busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Test AI
      </Button>
      {state.message ? (
        <span className={state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"} role="status">
          {state.message}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Sends one tiny request to check the key and the model.</span>
      )}
    </div>
  )
}

function StatusRow({ ok, loading, label, detail }: { ok?: boolean; loading: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2">
      {loading ? (
        <Loader2 className="mt-0.5 size-4 animate-spin text-muted-foreground" />
      ) : ok ? (
        <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <XCircle className="mt-0.5 size-4 text-amber-600 dark:text-amber-400" />
      )}
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </li>
  )
}
