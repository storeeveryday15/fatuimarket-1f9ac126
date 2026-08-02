-- 1. Supplier cost exposure: make the public catalogue view the only guest entry point.
ALTER VIEW public.catalog_products_public SET (security_invoker = off);
GRANT SELECT ON public.catalog_products_public TO anon, authenticated;

DROP POLICY IF EXISTS "catalog public read visible" ON public.catalog_products;

REVOKE SELECT ON public.catalog_products FROM anon;

-- Guests no longer receive realtime row payloads (which are not column-filtered).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.catalog_products;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Fixed search_path + no public EXECUTE on the email queue helpers.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;

-- 3. Internal helper: only used by server-side logic, not a public RPC.
REVOKE ALL ON FUNCTION public.is_verified_buyer(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.is_verified_buyer(uuid) TO service_role;