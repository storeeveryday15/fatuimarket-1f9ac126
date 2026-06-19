import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star } from "lucide-react";

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  rating: z.number().int().min(1, "Please pick a rating").max(5),
  review: z.string().trim().min(5, "Review must be at least 5 characters").max(1000),
});

export function ReviewForm({ productSlug, onSubmitted }: { productSlug?: string; onSubmitted?: () => void }) {
  const [authState, setAuthState] = useState<{ status: "loading" | "authed" | "guest"; userId?: string }>({ status: "loading" });
  const [fullName, setFullName] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) setAuthState({ status: "authed", userId: data.user.id });
      else setAuthState({ status: "guest" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) setAuthState({ status: "authed", userId: session.user.id });
      else setAuthState({ status: "guest" });
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  if (authState.status === "loading") return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (authState.status !== "authed" || !authState.userId) {
    return (
      <div className="surface-card p-5 text-sm">
        <p className="text-muted-foreground">Sign in to share your experience.</p>
        <Link to="/auth" className="mt-3 inline-flex items-center rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in to leave a review</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ full_name: fullName, rating, review });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      user_id: authState.userId,
      product_slug: productSlug ?? null,
      full_name: parsed.data.full_name,
      rating: parsed.data.rating,
      review: parsed.data.review,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thanks for your review!");
    setFullName(""); setRating(0); setReview("");
    onSubmitted?.();
  };

  return (
    <form onSubmit={submit} className="surface-card grid gap-3 p-5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your full name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Rahul Sharma"
          maxLength={100}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">For privacy, only your first name + last initial (e.g. "Rahul S.") is shown publicly.</p>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rating</label>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              type="button"
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(i)}
              className="p-0.5"
              aria-label={`${i} star${i === 1 ? "" : "s"}`}
            >
              <Star className={`h-7 w-7 ${(hover || rating) >= i ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your review</label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Tell others about your experience…"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="mt-1 text-right text-[11px] text-muted-foreground">{review.length}/1000</div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
