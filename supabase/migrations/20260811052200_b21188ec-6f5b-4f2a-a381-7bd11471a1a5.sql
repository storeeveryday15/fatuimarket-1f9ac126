DROP VIEW IF EXISTS public.reviews_public;

CREATE VIEW public.reviews_public
WITH (security_invoker = false) AS
SELECT
  r.id,
  r.product_slug,
  r.display_name,
  r.rating,
  r.review,
  r.created_at,
  (
    r.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = r.user_id
        AND o.status IN ('completed','delivered')
    )
  ) AS verified
FROM public.reviews r
WHERE r.status = 'approved';

ALTER VIEW public.reviews_public OWNER TO postgres;

GRANT SELECT ON public.reviews_public TO anon, authenticated;
GRANT ALL ON public.reviews_public TO service_role;