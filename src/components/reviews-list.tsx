import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, BadgeCheck, ChevronDown, Send, Store } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/fatui-logo.asset.json";

type PublicReview = { id: string; product_slug: string | null; display_name: string; rating: number; review: string; created_at: string; verified: boolean | null };
type PublicReply = { id: string; review_id: string; body: string; is_seller: boolean; display_name: string; created_at: string };

export function ReviewsList({ productSlug, limit = 12, refreshKey = 0 }: { productSlug?: string; limit?: number; refreshKey?: number }) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [replies, setReplies] = useState<PublicReply[]>([]);
  const [ownReviewIds, setOwnReviewIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("reviews_public").select("id,product_slug,display_name,rating,review,created_at,verified").order("created_at", { ascending: false }).limit(limit);
    q = productSlug ? q.eq("product_slug", productSlug) : q.is("product_slug", null);
    const { data } = await q;
    const next = (data ?? []) as PublicReview[];
    setReviews(next);
    const ids = next.map((review) => review.id);
    if (ids.length) {
      const [{ data: replyRows }, { data: userData }] = await Promise.all([
        supabase.from("review_replies_public").select("id,review_id,body,is_seller,display_name,created_at").in("review_id", ids).order("created_at"),
        supabase.auth.getUser(),
      ]);
      setReplies((replyRows ?? []) as PublicReply[]);
      if (userData.user) {
        const { data: owned } = await supabase.from("reviews").select("id").eq("user_id", userData.user.id).in("id", ids);
        setOwnReviewIds(new Set((owned ?? []).map((row) => row.id)));
      }
    } else setReplies([]);
    setLoading(false);
  };

  useEffect(() => { let active = true; void load().then(() => { if (!active) return; }); return () => { active = false; }; }, [productSlug, limit, refreshKey]);

  const sendReply = async (reviewId: string) => {
    const body = (drafts[reviewId] ?? "").trim();
    if (!body) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return toast.error("Sign in to reply");
    const { error } = await supabase.from("review_replies").insert({ review_id: reviewId, user_id: userData.user.id, body });
    if (error) return toast.error(error.message);
    setDrafts((current) => ({ ...current, [reviewId]: "" }));
    toast.success("Reply posted");
    await load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading reviews…</div>;
  if (!reviews.length) return <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No reviews yet. Be the first to share your experience!</div>;
  const avg = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

  return <div className="space-y-4">
    <div className="flex items-center gap-2 text-sm"><Stars value={Math.round(avg)} /><span className="font-semibold">{avg.toFixed(1)}</span><span className="text-muted-foreground">({reviews.length} review{reviews.length === 1 ? "" : "s"})</span></div>
    <div className="grid gap-3">{reviews.map((review) => {
      const reviewReplies = replies.filter((reply) => reply.review_id === review.id);
      const expanded = open.has(review.id);
      return <article key={review.id} className="surface-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-sm font-bold text-primary-foreground">{review.display_name.charAt(0).toUpperCase()}</div><div><div className="flex items-center gap-1.5 text-sm font-semibold">{review.display_name}{review.verified && <span className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success" title="Verified purchase"><BadgeCheck className="h-3 w-3" /> Verified</span>}</div><div className="text-[11px] text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</div></div></div><Stars value={review.rating} /></div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{review.review}</p>
        {(reviewReplies.length > 0 || ownReviewIds.has(review.id)) && <button type="button" onClick={() => setOpen((current) => { const next = new Set(current); next.has(review.id) ? next.delete(review.id) : next.add(review.id); return next; })} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />{reviewReplies.length ? `View ${reviewReplies.length} ${reviewReplies.length === 1 ? "reply" : "replies"}` : "Reply"}</button>}
        {expanded && <div className="mt-3 space-y-3 border-l border-border pl-4">{reviewReplies.map((reply) => <div key={reply.id} className="flex gap-2.5"><div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary">{reply.is_seller ? <img src={logo.url} alt="Fatui Market" className="h-full w-full object-cover" /> : reply.display_name.charAt(0)}</div><div className="min-w-0"><div className="flex items-center gap-1.5 text-xs font-semibold">{reply.display_name}{reply.is_seller && <Store className="h-3 w-3 text-[var(--neon)]" />}<span className="font-normal text-muted-foreground">{new Date(reply.created_at).toLocaleDateString()}</span></div><p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/85">{reply.body}</p></div></div>)}
          {ownReviewIds.has(review.id) && <div className="flex gap-2"><input value={drafts[review.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [review.id]: event.target.value }))} maxLength={1000} placeholder="Reply…" className="min-w-0 flex-1 border-b border-border bg-transparent py-1 text-sm outline-none focus:border-[var(--neon)]" /><button type="button" onClick={() => void sendReply(review.id)} aria-label="Post reply" className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"><Send className="h-3.5 w-3.5" /></button></div>}
        </div>}
      </article>;
    })}</div>
  </div>;
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return <div className="inline-flex">{[1,2,3,4,5].map((i) => <Star key={i} width={size} height={size} className={i <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"} />)}</div>;
}