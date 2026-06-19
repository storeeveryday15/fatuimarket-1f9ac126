
ALTER TABLE public.reviews ALTER COLUMN status SET DEFAULT 'pending';

DROP VIEW IF EXISTS public.reviews_public;

CREATE VIEW public.reviews_public
WITH (security_invoker = true)
AS
SELECT
  r.id,
  r.product_slug,
  r.display_name,
  r.rating,
  r.review,
  r.created_at,
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = r.user_id
      AND o.status IN ('completed','delivered')
  ) AS verified
FROM public.reviews r
WHERE r.status = 'approved';

GRANT SELECT ON public.reviews_public TO anon, authenticated;
