ALTER TABLE public.orders ALTER COLUMN expires_at SET DEFAULT (now() + interval '11 minutes');

CREATE OR REPLACE FUNCTION public.expire_stale_orders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.orders
    SET status = 'expired', expired_at = now(), reason = 'Payment window (11 minutes) ended without a submitted UTR'
    WHERE status = 'pending_payment' AND utr IS NULL
      AND COALESCE(expires_at, created_at + interval '11 minutes') < now();
  UPDATE public.orders
    SET status = 'expired', expired_at = now(), reason = 'Verification pending for over 24 hours'
    WHERE status IN ('pending_verification','awaiting_verification') AND created_at < now() - interval '24 hours';
END;
$function$;