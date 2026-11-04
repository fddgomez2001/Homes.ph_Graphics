import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Cover preview (small JPEG generated on save). Purely visual — never an export source. */
export function ProjectThumb({ src, title, className }: { src: string | null; title: string; className?: string }) {
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-md bg-gradient-to-b from-[#0730A3] to-[#0B1767]", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Cover of ${title}`} className="size-full object-cover" draggable={false} />
      ) : (
        <div className="flex size-full items-center justify-center text-white/60">
          <ImageIcon className="size-1/3 max-h-8 max-w-8" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
