export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--ef-radius-sm)] bg-[var(--ef-gray-200)] ${className}`}
      aria-hidden
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[var(--ef-surface)] border border-[var(--ef-border)] rounded-[var(--ef-radius-md)] p-5">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function RowSkeleton({ dense }: { dense?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${dense ? 'py-2' : 'py-3.5'}`}>
      <Skeleton className={`${dense ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg shrink-0`} />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
