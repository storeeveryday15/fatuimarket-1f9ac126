/**
 * Shared storefront stock-state resolution.
 *
 * Every product card / buy button derives its visual state from the same
 * function so the homepage, category grids, search results, related products
 * and the product page can never disagree.
 */

export type DisplayStatus =
  | "auto"
  | "normal"
  | "limited"
  | "sold_out"
  | "restocking"
  | "coming_soon"
  | "unavailable";

export type StockStateKey =
  | "normal"
  | "limited"
  | "sold_out"
  | "restocking"
  | "coming_soon"
  | "unavailable";

export type StockState = {
  key: StockStateKey;
  /** Stamp text, empty for `normal`. */
  label: string;
  /** True when purchasing must be blocked. */
  blocked: boolean;
  /** True when the artwork should be desaturated/darkened. */
  dim: boolean;
};

export type StockSource = {
  product_type?: string | null;
  stock?: number | null;
  status?: string | null;
  display_status?: string | null;
  low_stock_threshold?: number | null;
  auto_status?: boolean | null;
};

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export const DISPLAY_STATUS_OPTIONS: Array<{ value: DisplayStatus; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "normal", label: "Normal" },
  { value: "limited", label: "Limited Stock" },
  { value: "sold_out", label: "Sold Out" },
  { value: "restocking", label: "Restocking" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "unavailable", label: "Unavailable" },
];

const STATES: Record<StockStateKey, Omit<StockState, "key">> = {
  normal: { label: "", blocked: false, dim: false },
  limited: { label: "Limited Stock", blocked: false, dim: false },
  sold_out: { label: "Out of Stock", blocked: true, dim: true },
  restocking: { label: "Restocking", blocked: true, dim: true },
  coming_soon: { label: "Coming Soon", blocked: true, dim: true },
  unavailable: { label: "Unavailable", blocked: true, dim: true },
};

function make(key: StockStateKey): StockState {
  return { key, ...STATES[key] };
}

/** Stamp styling per state — tokens only, keeps the dark theme consistent. */
export const STAMP_STYLES: Record<StockStateKey, string> = {
  normal: "",
  limited: "border-warning/60 bg-warning/20 text-warning",
  sold_out: "border-destructive/60 bg-destructive/25 text-destructive-foreground",
  restocking: "border-warning/60 bg-warning/25 text-warning",
  coming_soon: "border-primary/60 bg-primary/25 text-primary-foreground",
  unavailable: "border-muted-foreground/50 bg-muted/40 text-muted-foreground",
};

/** Resolve the visual state for a single catalog row. */
export function resolveStockState(row: StockSource | null | undefined): StockState {
  if (!row) return make("normal");

  const manual = (row.display_status ?? "auto") as DisplayStatus;
  if (manual && manual !== "auto") {
    return make(manual === "normal" ? "normal" : (manual as StockStateKey));
  }

  const status = row.status ?? "active";
  if (status === "coming_soon") return make("coming_soon");
  if (status === "restocking") return make("restocking");
  if (status === "disabled" || status === "hidden") return make("unavailable");
  if (status === "out_of_stock") return make("sold_out");

  const auto = row.auto_status !== false;
  const limited = row.product_type === "limited";
  const stock = Number(row.stock ?? 0);
  if (auto && limited) {
    const threshold = Number(row.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD);
    if (stock <= 0) return make("sold_out");
    if (stock <= threshold) return make("limited");
  }
  return make("normal");
}

/**
 * Roll several tiers of one game into a single card state.
 * A game only goes dark when every tracked tier is blocked.
 */
export function aggregateStockState(rows: StockSource[]): StockState {
  if (rows.length === 0) return make("normal");
  const states = rows.map(resolveStockState);
  if (states.some((s) => !s.blocked)) {
    return states.some((s) => s.key === "limited") ? make("limited") : make("normal");
  }
  const first = states[0]!;
  return states.every((s) => s.key === first.key) ? first : make("sold_out");
}
