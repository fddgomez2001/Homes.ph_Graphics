"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { getDesktop, type DesktopSetupStatus } from "@/lib/desktop"
import { isLocalMode } from "./shared"

const noSubscribe = () => () => {}

/** The desktop app without an account (the work is saved on this computer). False on the server's first render. */
export function useLocalMode(): boolean {
  return useSyncExternalStore(noSubscribe, isLocalMode, () => false)
}

/** The desktop app's welcome-setup choices (null outside the app or while loading). */
export function useDesktopSetup(): [DesktopSetupStatus | null, (next: DesktopSetupStatus) => void] {
  const [setup, setSetup] = useState<DesktopSetupStatus | null>(null)
  useEffect(() => {
    let cancelled = false
    getDesktop()
      ?.setup?.get()
      .then((s) => !cancelled && setSetup(s))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return [setup, setSetup]
}
