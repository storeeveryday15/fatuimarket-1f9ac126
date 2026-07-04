
-- Fix 1: Revoke EXECUTE from anon/public on SECURITY DEFINER functions that should not be publicly callable.
-- Keep public access only for functions intentionally exposed to anon (get_visitor_stats, get_leaderboard, get_order_stats).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.expire_stale_orders() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.expire_stale_orders() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_on_complete() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_guard_customer_updates() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_guard_customer_updates() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_guard_customer_updates() FROM anon, public, authenticated;

-- Fix 2: Prevent customers from changing reviews.status via RLS (defense in depth alongside the guard trigger).
DROP POLICY IF EXISTS "reviews update own or admin" ON public.reviews;
CREATE POLICY "reviews update own or admin"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      auth.uid() = user_id
      AND status = (SELECT r.status FROM public.reviews r WHERE r.id = reviews.id)
    )
  );

-- Fix 3: Add admin SELECT policy on site_visitors so admins can read visitor rows.
CREATE POLICY "admins can read site_visitors"
  ON public.site_visitors
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
