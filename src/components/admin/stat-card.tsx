import { Skeleton } from "@/components/ui/skeleton";

/** Animated metric card used across the admin dashboard. */
export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad" | "neon";
  loading?: boolean;
}) {
  const toneRing =
    tone === "good"
      ? "ring-1 ring-success/40"
      : tone === "warn"
        ? "ring-1 ring-warning/40"
        : tone === "bad"
          ? "ring-1 ring-destructive/40"
          : tone === "neon"
            ? "ring-1 ring-[var(--neon)]/40"
            : "";

  return (
    <div
      className={`surface-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] ${toneRing}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      )}
      {sub && !loading && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
        </div>
      ))}
    </div>
  );
}
