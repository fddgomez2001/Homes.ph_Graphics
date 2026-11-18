"use client"

import { useEffect } from "react"
import { syncKeysWithDesktop } from "@/lib/ai/client"

/** Desktop app: keeps the person's AI and Tavily keys in step with the app's encrypted copy (nothing elsewhere). */
export function DesktopKeysSync() {
  useEffect(() => {
    void syncKeysWithDesktop()
  }, [])
  return null
}
