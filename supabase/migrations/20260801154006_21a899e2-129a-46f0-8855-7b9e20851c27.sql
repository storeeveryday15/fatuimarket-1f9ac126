DROP VIEW IF EXISTS public.public_orders_feed;
CREATE VIEW public.public_orders_feed AS
  SELECT order_code, product_name, tier_label, amount_inr, currency, created_at, status
  FROM public.orders
  WHERE status IN ('completed','delivered','paid')
  ORDER BY created_at DESC
  LIMIT 50;
GRANT SELECT ON public.public_orders_feed TO anon, authenticated;