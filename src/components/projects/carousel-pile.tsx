import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

/** Cards drawn under the cover (more would only add edges). */
export const PILE_CARDS = 4

const SHADOW = "shadow-[0_1px_2px_rgba(15,23,42,0.22),0_12px_28px_-8px_rgba(15,23,42,0.45)]"

/** Small repeatable random numbers from a string (each carousel keeps its own pile). */
function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/**
 * A carousel as a pile of printed slides: the cover on top, its cards tilted
 * underneath like stacked photos. Sharp corners. Hovering the parent `group`
 * fans the pile out a little.
 */
export function CarouselPile({
  seed,
  cover,
  cards,
  title,
  className,
}: {
  /** Usually the carousel id: the same carousel always gets the same pile. */
  seed: string
  cover?: string | null
  /** Card previews in order (undefined while one is still rendering). */
  cards: (string | undefined)[]
  title: string
  className?: string
}) {
  const random = seeded(seed)
  const layers = cards.slice(0, PILE_CARDS).map((src, i) => {
    const side = i % 2 === 0 ? 1 : -1
    return {
      src,
      rotate: side * (2.5 + i * 1.6 + random() * 2.5),
      x: side * (1 + random() * 2.5),
      y: (random() - 0.5) * 3,
    }
  })
  const coverTilt = (random() - 0.5) * 2.4

  return (
    <span className={cn("relative block aspect-square w-full", className)}>
      {layers
        .map((layer, i) => (
          <span
            key={i}
            className={cn(
              "absolute inset-[10%] overflow-hidden bg-[#0B1F8E] transition-transform duration-300 ease-out",
              "[transform:translate(var(--x),var(--y))_rotate(var(--r))]",
              "group-hover:[transform:translate(calc(var(--x)*1.8),calc(var(--y)*1.8))_rotate(calc(var(--r)*1.45))]",
              SHADOW,
            )}
            style={{ "--x": `${layer.x}%`, "--y": `${layer.y}%`, "--r": `${layer.rotate}deg`, filter: `brightness(${0.97 - i * 0.04})` } as CSSProperties}
          >
            {layer.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={layer.src} alt="" className="size-full" draggable={false} />
            ) : (
              <span className="block size-full animate-pulse bg-gradient-to-b from-[#1A3ED6] to-[#0B1F8E]" />
            )}
          </span>
        ))
        .reverse()}
      <span
        className={cn(
          "absolute inset-[10%] z-10 overflow-hidden bg-[#0B1F8E] transition-transform duration-300 ease-out",
          "[transform:rotate(var(--r))] group-hover:[transform:translateY(-2.5%)_rotate(0deg)_scale(1.02)]",
          "shadow-[0_2px_4px_rgba(15,23,42,0.25),0_18px_36px_-10px_rgba(15,23,42,0.55)]",
          "group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
        )}
        style={{ "--r": `${coverTilt}deg` } as CSSProperties}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={`Cover of ${title}`} className="size-full" draggable={false} />
        ) : (
          <span className="block size-full animate-pulse bg-gradient-to-b from-[#1A3ED6] to-[#0B1F8E]" />
        )}
      </span>
    </span>
  )
}
