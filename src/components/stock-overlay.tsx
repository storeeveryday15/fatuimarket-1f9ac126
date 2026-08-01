import { cn } from "@/lib/utils";
import { STAMP_STYLES, type StockState } from "@/lib/stock-status";

/**
 * Premium semi-transparent stamp shown over product artwork.
 * The image stays visible behind it; blocked states also dim + desaturate.
 */
export function StockOverlay({
  state,
  size = "md",
  className,
}: {
  state: StockState;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (state.key === "normal") return null;

  // Low stock reads better as a corner ribbon than a full stamp.
  if (state.key === "limited") {
    return (
      <div
        key={state.key}
        className={cn(
          "pointer-events-none absolute right-2 top-2 z-10 stock-fade-in rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm",
          STAMP_STYLES.limited,
          className,
        )}
      >
        {state.label}
      </div>
    );
  }

  return (
    <div
      key={state.key}
      className={cn("pointer-events-none absolute inset-0 z-10 flex stock-fade-in items-center justify-center", className)}
    >
      <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px]" />
      <span
        className={cn(
          "relative -rotate-12 rounded-lg border-2 border-dashed px-4 py-2 font-extrabold uppercase tracking-[0.2em] shadow-[var(--shadow-elegant)] backdrop-blur-sm",
          size === "sm" ? "text-[10px] px-2 py-1 tracking-[0.15em]" : size === "lg" ? "text-2xl" : "text-sm",
          STAMP_STYLES[state.key],
        )}
      >
        {state.label}
      </span>
    </div>
  );
}

/** Image classes for the dim/grayscale treatment, with a smooth transition. */
export function stockImageClass(state: StockState): string {
  return state.dim ? "grayscale brightness-[0.7] saturate-0 transition-all duration-300" : "transition-all duration-300";
}
