
DROP POLICY IF EXISTS "profiles update self or admin" ON public.profiles;
CREATE POLICY "profiles update self or admin"
ON public.profiles
FOR UPDATE
USING ((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'));

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, username, country, contact, hide_popup) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "orders update own or admin" ON public.orders;
CREATE POLICY "orders update own or admin"
ON public.orders
FOR UPDATE
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_set_display_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_on_complete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_guard_customer_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_guard_customer_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_guard_customer_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_orders() FROM PUBLIC, anon;
