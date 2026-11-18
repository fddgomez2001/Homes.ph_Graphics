"use client"

import { ConflictError, DataError } from "@/lib/data/errors"

/** One call to the desktop app's own storage (/api/local/…), for the "saved on this computer" mode. */
export async function localApi<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : ""
  let res: Response
  try {
    res = await fetch(`/api/local/${path}${qs}`, {
      method,
      cache: "no-store",
      ...(body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new DataError("The app's local server isn't answering. Close the app and open it again.", "network")
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error || `The app couldn't save or read your work (HTTP ${res.status}).`
    if (res.status === 409) throw new ConflictError(message, "conflict", 409)
    throw new DataError(message, (data as { code?: string } | null)?.code ?? (res.status === 404 ? "not_found" : undefined), res.status)
  }
  return data as T
}
