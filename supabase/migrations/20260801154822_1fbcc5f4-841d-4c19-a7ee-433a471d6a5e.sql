DROP VIEW IF EXISTS public.public_orders_feed;

CREATE VIEW public.public_orders_feed AS
SELECT
  o.order_code,
  o.product_name,
  o.tier_label,
  o.amount_inr,
  o.currency,
  o.created_at,
  o.status,
  CASE
    WHEN p.username IS NOT NULL AND length(p.username) >= 2 THEN substr(p.username, 1, 2) || '****'
    WHEN p.display_name IS NOT NULL AND length(p.display_name) >= 2 THEN substr(p.display_name, 1, 2) || '****'
    WHEN o.player_name IS NOT NULL AND length(o.player_name) >= 2 THEN substr(o.player_name, 1, 2) || '****'
    ELSE 'Player'
  END AS masked_buyer
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE o.status IN ('completed', 'delivered')
ORDER BY o.created_at DESC;

GRANT SELECT ON public.public_orders_feed TO anon, authenticated;