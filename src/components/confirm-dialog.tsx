"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"

interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** The person must type this (e.g. the carousel title) before confirming. */
  typeToConfirm?: string
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase()

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Promise-based confirmation dialog for destructive or irreversible actions. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [typed, setTyped] = useState("")
  const resolver = useRef<((value: boolean) => void) | null>(null)
  const matches = !options?.typeToConfirm || normalize(typed) === normalize(options.typeToConfirm)

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false)
    setTyped("")
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!options} onOpenChange={(open) => !open && settle(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          {options?.typeToConfirm && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-type" className="text-sm font-normal text-slate-700 dark:text-slate-200">
                Type <span className="font-semibold text-foreground">{options.typeToConfirm}</span> to confirm
              </Label>
              <Input
                id="confirm-type"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches) settle(true)
                }}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                aria-label="Type the title to confirm"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>{options?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!matches}
              onClick={(e) => {
                if (!matches) return e.preventDefault()
                settle(true)
              }}
              className={options?.destructive ? "gap-1.5 bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600/30" : undefined}
            >
              {options?.destructive && <Trash2 className="size-4" />}
              {options?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>")
  return confirm
}
