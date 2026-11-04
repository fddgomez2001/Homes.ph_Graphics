"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const listeners = new Set<() => void>()

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Small per-browser preference (view mode, layout). Falls back to the default when storage is unavailable. */
export function usePreference<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (value: T) => void] {
  const stored = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => readStorage(key),
    () => null,
  )
  const value = stored && (!allowed || allowed.includes(stored as T)) ? (stored as T) : fallback
  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, next)
      } catch {
        // storage unavailable (private mode) — keep working without persistence
      }
      listeners.forEach((l) => l())
    },
    [key],
  )
  return [value, setValue]
}

/** Latest value in a ref, for use inside stable callbacks and listeners. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
