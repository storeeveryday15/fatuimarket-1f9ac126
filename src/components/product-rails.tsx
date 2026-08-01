import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PRODUCTS, getINR, type Denomination, type Product } from "@/lib/products";
import { useCatalogStatus } from "@/hooks/use-catalog-status";
import { useStoreSignals } from "@/hooks/use-store-signals";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { StockOverlay, stockImageClass } from "@/components/stock-overlay";
import { supabase } from "@/integrations/supabase/client";

type Pick_ = { product: Product; den: Denomination };

const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));

const STOP = new Set(["the", "and", "pass", "of", "x", "+"]);

function words(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9× ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Score how related two tiers are: shared wording first, then price proximity. */
function relatedness(a: Denomination, b: Denomination) {
  const wa = new Set(words(a.label));
  const shared = words(b.label).filter((w) => wa.has(w)).length;
  const priceGap = Math.abs(getINR(a) - getINR(b));
  return shared * 100 - Math.min(priceGap / 50, 50);
}

function TierCard({ product, den }: Pick_) {
  const catalog = useCatalogStatus();
  const state = catalog.tierState(product.slug, den.label);
  return (
    <Link
      to="/products/$slug"
      params={{ slug: product.slug }}
      className="surface-card card-lift flex w-[220px] shrink-0 flex-col overflow-hidden sm:w-auto"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={product.image}
          alt={`${product.name} — ${den.label}`}
          loading="lazy"
          decoding="async"
          width={440}
          height={275}
          className={`h-full w-full object-cover ${stockImageClass(state)}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <StockOverlay state={state} size="sm" />
        <span className="absolute bottom-2 left-2 truncate text-[11px] font-semibold text-white/90">{product.name}</span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 p-3">
        <span className="min-w-0 truncate text-xs font-semibold">{den.label}</span>
        <span className="shrink-0 text-sm font-bold">₹{getINR(den)}</span>
      </div>
    </Link>
  );
}

function Rail({ title, subtitle, items }: { title: string; subtitle?: string; items: Pick_[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h2 className="text-xl font-bold md:text-2xl">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {items.map(({ product, den }) => (
          <TierCard key={`${product.slug}-${den.id}`} product={product} den={den} />
        ))}
      </div>
    </div>
  );
}

/** Last 10 products the customer opened (stored on-device). */
export function RecentlyViewedRail({ title = "Recently viewed" }: { title?: string }) {
  const viewed = useRecentlyViewed();
  const items = useMemo(() => {
    const out: Pick_[] = [];
    for (const v of viewed) {
      const product = bySlug.get(v.slug);
      if (!product) continue;
      const den = product.denominations.find((d) => d.label === v.tier) ?? product.denominations[0]!;
      out.push({ product, den });
    }
    return out;
  }, [viewed]);

  return <Rail title={title} subtitle="Pick up where you left off." items={items.slice(0, 10)} />;
}

/** Suggestions from past purchases, recently viewed games and popular tiers. */
export function RecommendedRail() {
  const viewed = useRecentlyViewed();
  const signals = useStoreSignals();
  const [purchases, setPurchases] = useState<{ slug: string; tier: string }[]>([]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("orders")
        .select("product_slug,tier_label")
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data: rows }) => {
          if (!alive || !rows) return;
          setPurchases((rows as { product_slug: string; tier_label: string }[]).map((r) => ({ slug: r.product_slug, tier: r.tier_label })));
        });
    });
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(() => {
    const seeds: { slug: string; tier?: string }[] = [
      ...purchases.map((p) => ({ slug: p.slug, tier: p.tier })),
      ...viewed.map((v) => ({ slug: v.slug, tier: v.tier })),
    ];
    const seen = new Set(seeds.filter((s) => s.tier).map((s) => `${s.slug}|${s.tier}`));
    const scored: { pick: Pick_; score: number }[] = [];

    for (const product of PRODUCTS) {
      for (const den of product.denominations) {
        const key = `${product.slug}|${den.label}`;
        if (seen.has(key)) continue;
        let score = (signals.tierSales[key] ?? 0) * 4 + (signals.gameSales[product.slug] ?? 0);
        for (const seed of seeds) {
          if (seed.slug !== product.slug) continue;
          score += 25;
          const seedDen = bySlug.get(seed.slug)?.denominations.find((d) => d.label === seed.tier);
          if (seedDen) score += Math.max(relatedness(seedDen, den), 0);
        }
        if (score > 0) scored.push({ pick: { product, den }, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5).map((s) => s.pick);
  }, [purchases, viewed, signals]);

  return <Rail title="Recommended for you" subtitle="Based on what you bought, viewed and what's trending." items={items} />;
}

/** "You may also like" for a product page. */
export function RelatedProducts({ slug, tierLabel }: { slug: string; tierLabel?: string }) {
  const signals = useStoreSignals();
  const product = bySlug.get(slug);

  const items = useMemo(() => {
    if (!product) return [];
    const current = product.denominations.find((d) => d.label === tierLabel);
    const sameGame = product.denominations
      .filter((d) => d.label !== tierLabel)
      .map((den) => ({
        pick: { product, den },
        score: (current ? relatedness(current, den) : 0) + (signals.tierSales[`${slug}|${den.label}`] ?? 0) * 3,
      }));

    const otherGames = PRODUCTS.filter((p) => p.slug !== slug).map((p) => {
      const den = [...p.denominations].sort(
        (a, b) => (signals.tierSales[`${p.slug}|${b.label}`] ?? 0) - (signals.tierSales[`${p.slug}|${a.label}`] ?? 0),
      )[0]!;
      return { pick: { product: p, den }, score: (signals.gameSales[p.slug] ?? 0) - 500 };
    });

    return [...sameGame, ...otherGames].sort((a, b) => b.score - a.score).slice(0, 5).map((s) => s.pick);
  }, [product, tierLabel, slug, signals]);

  return <Rail title="You may also like" items={items} />;
}
