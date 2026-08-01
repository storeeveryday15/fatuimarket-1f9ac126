CREATE OR REPLACE FUNCTION public.is_verified_buyer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = _user_id AND o.status IN ('completed','delivered')
  )
$$;

REVOKE ALL ON FUNCTION public.is_verified_buyer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_buyer(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.reviews_public
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.product_slug,
  r.display_name,
  r.rating,
  r.review,
  r.created_at,
  public.is_verified_buyer(r.user_id) AS verified
FROM public.reviews r
WHERE r.status = 'approved';

GRANT SELECT ON public.reviews_public TO anon, authenticated;