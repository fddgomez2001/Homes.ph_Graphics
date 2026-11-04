"use client"

import { useState, useSyncExternalStore, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDesktop } from "@/lib/desktop"
import { IS_MOBILE_APP, isSupabaseConfigured } from "@/lib/env"
import { HOME_PATH } from "@/lib/routes"
import { getSupabase } from "@/lib/supabase/client"
import { errorMessage } from "@/lib/utils"

type Mode = "signin" | "signup" | "link"

function safeNext(value: string | null) {
  // Only allow same-site relative paths.
  return value && value.startsWith("/") && !value.startsWith("//") ? value : HOME_PATH
}

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get("next"))
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(params.get("error"))
  const [sentTo, setSentTo] = useState<string | null>(null)
  // Email links open in the web browser, which can't sign in the desktop or phone app — use a password there.
  const isDesktop = useSyncExternalStore(
    () => () => {},
    () => !!getDesktop() || IS_MOBILE_APP,
    () => IS_MOBILE_APP,
  )

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase isn&apos;t configured. Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart
        the app.
      </p>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = getSupabase()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace(next)
        router.refresh()
        return
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
        if (error) throw error
        if (data.session) {
          router.replace(next)
          router.refresh()
          return
        }
        setSentTo(email)
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
        if (error) throw error
        setSentTo(email)
      }
    } catch (e) {
      setError(friendlyAuthError(errorMessage(e)))
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="size-10 text-primary" />
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          We sent a link to <span className="font-medium text-foreground">{sentTo}</span>. Open it on this computer to
          continue.
        </p>
        <Button variant="ghost" onClick={() => setSentTo(null)}>
          Back
        </Button>
      </div>
    )
  }

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-5">
      <TabsList className="w-full">
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Create account</TabsTrigger>
        {!isDesktop && <TabsTrigger value="link">Email link</TabsTrigger>}
      </TabsList>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@homes.ph"
          />
        </div>
        <TabsContent value="signin" className="contents">
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        </TabsContent>
        <TabsContent value="signup" className="contents">
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
        </TabsContent>
        <TabsContent value="link" className="contents">
          <p className="text-sm text-muted-foreground">We&apos;ll email you a one-time sign-in link. No password needed.</p>
        </TabsContent>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy && <Loader2 className="animate-spin" />}
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send sign-in link"}
        </Button>
      </form>
    </Tabs>
  )
}

function PasswordField(props: { value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="password">Password</Label>
      <Input
        id="password"
        type="password"
        required
        minLength={8}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  )
}

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password."
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the link."
  if (/rate limit/i.test(message)) return "Too many attempts. Please wait a minute and try again."
  return message
}
