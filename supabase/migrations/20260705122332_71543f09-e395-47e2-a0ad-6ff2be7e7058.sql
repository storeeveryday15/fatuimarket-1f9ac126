
-- Defense-in-depth: split UPDATE policies so customers cannot modify sensitive columns even if triggers are bypassed.

DROP POLICY IF EXISTS "profiles update self or admin" ON public.profiles;

CREATE POLICY "profiles update admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "profiles update self restricted" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND wallet_balance = (SELECT p.wallet_balance FROM public.profiles p WHERE p.id = auth.uid())
    AND has_used_welcome_offer = (SELECT p.has_used_welcome_offer FROM public.profiles p WHERE p.id = auth.uid())
    AND email IS NOT DISTINCT FROM (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "orders update own or admin" ON public.orders;

CREATE POLICY "orders update admin" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "orders update own restricted" ON public.orders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND order_code = (SELECT o.order_code FROM public.orders o WHERE o.id = orders.id)
    AND product_slug = (SELECT o.product_slug FROM public.orders o WHERE o.id = orders.id)
    AND product_name = (SELECT o.product_name FROM public.orders o WHERE o.id = orders.id)
    AND tier_label = (SELECT o.tier_label FROM public.orders o WHERE o.id = orders.id)
    AND amount_inr IS NOT DISTINCT FROM (SELECT o.amount_inr FROM public.orders o WHERE o.id = orders.id)
    AND amount_usd IS NOT DISTINCT FROM (SELECT o.amount_usd FROM public.orders o WHERE o.id = orders.id)
    AND currency = (SELECT o.currency FROM public.orders o WHERE o.id = orders.id)
    AND discount_inr = (SELECT o.discount_inr FROM public.orders o WHERE o.id = orders.id)
    AND wallet_used_inr = (SELECT o.wallet_used_inr FROM public.orders o WHERE o.id = orders.id)
    AND cashback_inr = (SELECT o.cashback_inr FROM public.orders o WHERE o.id = orders.id)
    AND cashback_credited = (SELECT o.cashback_credited FROM public.orders o WHERE o.id = orders.id)
    AND admin_notes IS NOT DISTINCT FROM (SELECT o.admin_notes FROM public.orders o WHERE o.id = orders.id)
    AND coupon_code IS NOT DISTINCT FROM (SELECT o.coupon_code FROM public.orders o WHERE o.id = orders.id)
    AND user_id IS NOT DISTINCT FROM (SELECT o.user_id FROM public.orders o WHERE o.id = orders.id)
    AND server_region IS NOT DISTINCT FROM (SELECT o.server_region FROM public.orders o WHERE o.id = orders.id)
  );
