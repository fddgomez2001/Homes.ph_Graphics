"use client"

import { useRef } from "react"
import { ACCEPTED_IMAGE_EXTENSIONS, ACCEPTED_IMAGE_TYPES } from "@/lib/design/constants"

/** Hidden <input type="file"> for JPG/PNG/WebP. Render `input` and call `open()` from a button. */
export function useImageFilePicker(onFiles: (files: File[]) => void, multiple = false) {
  const ref = useRef<HTMLInputElement>(null)
  const input = (
    <input
      ref={ref}
      type="file"
      hidden
      multiple={multiple}
      accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_IMAGE_EXTENSIONS].join(",")}
      onChange={(e) => {
        const files = Array.from(e.target.files ?? [])
        e.target.value = ""
        if (files.length) onFiles(files)
      }}
    />
  )
  return { input, open: () => ref.current?.click() }
}
