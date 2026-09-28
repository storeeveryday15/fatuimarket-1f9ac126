REVOKE ALL ON public.consumed_payment_rrns FROM anon, authenticated;
GRANT ALL ON public.consumed_payment_rrns TO service_role;

REVOKE ALL ON public.wallet_topups FROM anon, authenticated;
GRANT SELECT ON public.wallet_topups TO authenticated;
GRANT ALL ON public.wallet_topups TO service_role;

REVOKE ALL ON public.review_replies FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_replies TO authenticated;
GRANT ALL ON public.review_replies TO service_role;

REVOKE ALL ON public.review_replies_public FROM anon, authenticated;
GRANT SELECT ON public.review_replies_public TO anon, authenticated;
GRANT ALL ON public.review_replies_public TO service_role;