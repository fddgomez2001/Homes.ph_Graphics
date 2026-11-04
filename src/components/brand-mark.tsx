import { LOGO_BLUE_SRC } from "@/lib/design/constants"
import { cn } from "@/lib/utils"

/** App mark: the official blue Homes.ph logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_BLUE_SRC} alt="" aria-hidden="true" className={cn("size-8 shrink-0 object-contain", className)} draggable={false} />
  )
}
