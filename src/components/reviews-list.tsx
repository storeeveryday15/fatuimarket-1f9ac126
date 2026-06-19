import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, BadgeCheck } from "lucide-react";

type PublicReview = {
  id: string;
  product_slug: string | null;
  display_name: string;
  rating: number;
  review: string;
  created_at: string;
  verified: boolean | null;
};

export function ReviewsList({ productSlug, limit = 12, refreshKey = 0 }: { productSlug?: string; limit?: number; refreshKey?: number }) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("reviews_public" as never)
        .select("id, product_slug, display_name, rating, review, created_at, verified")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (productSlug) q = q.eq("product_slug", productSlug);
      else q = q.is("product_slug", null);
      const { data } = await q;
      if (cancelled) return;
      setReviews(((data as unknown) as PublicReview[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [productSlug, limit, refreshKey]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading reviews…</div>;
  if (reviews.length === 0) return <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No reviews yet. Be the first to share your experience!</div>;

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Stars value={Math.round(avg)} />
        <span className="font-semibold">{avg.toFixed(1)}</span>
        <span className="text-muted-foreground">({reviews.length} review{reviews.length === 1 ? "" : "s"})</span>
      </div>
      <div className="grid gap-3">
        {reviews.map((r) => (
          <div key={r.id} className="surface-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)]">
                  {r.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {r.display_name}
                    {r.verified && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success" title="Verified purchase">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <Stars value={r.rating} />
            </div>
            <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap">{r.review}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} width={size} height={size} className={i <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"} />
      ))}
    </div>
  );
}
