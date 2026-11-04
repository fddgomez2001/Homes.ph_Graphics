/** Lightweight static placeholder shown while a page's client code takes over. */
export function PageSkeleton({ title }: { title: string }) {
  return (
    <div aria-busy="true">
      <div className="border-b px-4 py-3 lg:px-6">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 lg:p-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
