import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ArrowRight, X } from "lucide-react";
import { PRODUCTS, getINR, type Product, type Denomination } from "@/lib/products";
import { useCatalogStatus } from "@/hooks/use-catalog-status";
import { useStoreSignals } from "@/hooks/use-store-signals";
import { StockOverlay, stockImageClass } from "@/components/stock-overlay";
import { cn } from "@/lib/utils";

const SORTS = [
  { id: "recommended", label: "Recommended" },
  { id: "price-asc", label: "Lowest price" },
  { id: "price-desc", label: "Highest price" },
  { id: "best-selling", label: "Best selling" },
  { id: "popular", label: "Most popular" },
  { id: "newest", label: "Newest" },
  { id: "restocked", label: "Recently restocked" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

const minInr = (p: Product) => Math.min(...p.denominations.map((d) => getINR(d)));

/** Extra keywords so "diamonds", "uc", "robux", "gift card" etc. match the right games. */
const KEYWORDS: Record<string, string> = {
  "mobile-legends": "diamonds weekly pass starlight twilight elite mlbb moonton",
  "genshin-impact": "genesis crystals blessing welkin battle pass hoyoverse",
  "wuthering-waves": "lunites oscillated coral kuro",
  "love-and-deepspace": "diamonds infold lads",
  "honor-of-kings": "tokens vouchers aurum pass hok",
  "pubg-mobile": "uc unknown cash royale pass bgmi",
  "free-fire": "diamonds garena",
  valorant: "vp valorant points radianite riot",
  roblox: "robux gift card",
  steam: "steam wallet gift card code",
  "google-play": "gift card google play code voucher",
  razer: "razer gold gift card pin",
};

export function ProductExplorer() {
  const [q, setQ] = useState("");
  const [game, setGame] = useState<string>("all");
  const [sort, setSort] = useState<SortId>("recommended");
  const catalog = useCatalogStatus();
  const signals = useStoreSignals();

  const query = q.trim().toLowerCase();

  const games = useMemo(() => {
    const list = PRODUCTS.filter((p) => game === "all" || p.slug === game);
    return sortGames(list, sort, signals);
  }, [game, sort, signals]);

  const tierResults = useMemo(() => {
    if (!query) return [];
    const rows: { product: Product; den: Denomination }[] = [];
    for (const p of PRODUCTS) {
      if (game !== "all" && p.slug !== game) continue;
      const haystackGame = `${p.name} ${p.publisher} ${p.currency} ${KEYWORDS[p.slug] ?? ""}`.toLowerCase();
      for (const d of p.denominations) {
        const hay = `${haystackGame} ${d.label} ${d.bonus ?? ""}`.toLowerCase();
        if (hay.includes(query)) rows.push({ product: p, den: d });
      }
    }
    return sortTiers(rows, sort, signals);
  }, [query, game, sort, signals]);

  return (
    <div>
      {/* Search + sort */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            inputMode="search"
            placeholder="Search diamonds, UC, Robux, Weekly Pass, gift cards…"
            aria-label="Search products"
            className="w-full rounded-xl border border-border bg-card/70 py-3 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[var(--neon)]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortId)}
          aria-label="Sort products"
          className="w-full shrink-0 rounded-xl border border-border bg-card/70 px-3 py-3 text-sm outline-none focus:border-[var(--neon)] sm:w-auto"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Game filter chips */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={game === "all"} onClick={() => setGame("all")}>
          All games
        </Chip>
        {PRODUCTS.map((p) => (
          <Chip key={p.slug} active={game === p.slug} onClick={() => setGame(p.slug)}>
            {p.name}
          </Chip>
        ))}
      </div>

      {query ? (
        tierResults.length ? (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tierResults.map(({ product, den }) => {
              const state = catalog.tierState(product.slug, den.label);
              return (
                <li key={`${product.slug}-${den.id}`}>
                  <Link
                    to="/products/$slug"
                    params={{ slug: product.slug }}
                    className="surface-card card-lift flex items-center gap-3 overflow-hidden p-3"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        width={112}
                        height={112}
                        className={`h-full w-full object-cover ${stockImageClass(state)}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{den.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{product.name}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold">₹{getINR(den)}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--neon)]">
                        {state.blocked ? state.label : "Buy"}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">No products match “{q}”. Try “diamonds”, “UC” or “gift card”.</p>
        )
      ) : (
        <div className="stagger-grid mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((p) => {
            const state = catalog.gameState(p.slug);
            return (
              <Link
                key={p.slug}
                to="/products/$slug"
                params={{ slug: p.slug }}
                className="group surface-card card-lift ripple relative overflow-hidden"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={p.image}
                    alt={`${p.name} top-up card`}
                    loading="lazy"
                    decoding="async"
                    width={800}
                    height={600}
                    className={`h-full w-full object-cover object-center duration-700 ease-out group-hover:scale-110 ${stockImageClass(state)}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
                  <StockOverlay state={state} size="lg" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
                    {p.publisher}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="text-xl font-extrabold text-white drop-shadow-lg">{p.name}</h3>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--neon)]">{p.currency}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Starting from</div>
                    <div className="text-base font-bold text-foreground">₹{minInr(p)}</div>
                  </div>
                  {state.blocked ? (
                    <span className="shrink-0 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground">
                      {state.label}
                    </span>
                  ) : (
                    <span className="btn-shine soft-pulse inline-flex shrink-0 items-center gap-1 rounded-lg bg-[image:var(--gradient-primary)] bg-[length:200%_200%] px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform group-hover:translate-x-0.5">
                      Top Up <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-[var(--neon)] bg-[var(--neon)]/15 text-[var(--neon)]"
          : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function sortGames(list: Product[], sort: SortId, s: ReturnType<typeof useStoreSignals>) {
  const arr = [...list];
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => minInr(a) - minInr(b));
    case "price-desc":
      return arr.sort((a, b) => minInr(b) - minInr(a));
    case "best-selling":
    case "popular":
      return arr.sort((a, b) => (s.gameSales[b.slug] ?? 0) - (s.gameSales[a.slug] ?? 0));
    case "newest":
      return arr.sort((a, b) => (s.gameCreatedAt[b.slug] ?? 0) - (s.gameCreatedAt[a.slug] ?? 0));
    case "restocked":
      return arr.sort((a, b) => (s.gameRestockedAt[b.slug] ?? 0) - (s.gameRestockedAt[a.slug] ?? 0));
    default:
      return arr;
  }
}

function sortTiers(
  rows: { product: Product; den: Denomination }[],
  sort: SortId,
  s: ReturnType<typeof useStoreSignals>,
) {
  const arr = [...rows];
  const sales = (r: { product: Product; den: Denomination }) => s.tierSales[`${r.product.slug}|${r.den.label}`] ?? 0;
  const restocked = (r: { product: Product; den: Denomination }) => s.tierRestockedAt[`${r.product.slug}|${r.den.label}`] ?? 0;
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => getINR(a.den) - getINR(b.den));
    case "price-desc":
      return arr.sort((a, b) => getINR(b.den) - getINR(a.den));
    case "best-selling":
    case "popular":
      return arr.sort((a, b) => sales(b) - sales(a));
    case "restocked":
      return arr.sort((a, b) => restocked(b) - restocked(a));
    case "newest":
      return arr.sort((a, b) => (s.gameCreatedAt[b.product.slug] ?? 0) - (s.gameCreatedAt[a.product.slug] ?? 0));
    default:
      return arr;
  }
}
