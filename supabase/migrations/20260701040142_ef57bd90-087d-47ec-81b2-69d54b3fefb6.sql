
REVOKE ALL ON FUNCTION public.orders_on_complete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_cashback_inr(numeric) FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.compute_cashback_inr(numeric) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION public.compute_cashback_inr(numeric) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.expire_stale_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_orders() TO authenticated;
