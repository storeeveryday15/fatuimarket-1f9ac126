
REVOKE ALL ON FUNCTION public.expire_stale_orders() FROM PUBLIC, anon, authenticated;
-- Only admins can trigger sweep. We use a wrapper that checks role.
CREATE OR REPLACE FUNCTION public.expire_stale_orders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.orders
    SET status = 'failed', failed_at = now(), reason = 'Payment not submitted within 3 minutes'
    WHERE status = 'pending_payment' AND created_at < now() - interval '3 minutes';
  UPDATE public.orders
    SET status = 'expired', expired_at = now(), reason = 'Verification pending for over 24 hours'
    WHERE status IN ('pending_verification','awaiting_verification') AND created_at < now() - interval '24 hours';
END;
$$;
GRANT EXECUTE ON FUNCTION public.expire_stale_orders() TO authenticated;
