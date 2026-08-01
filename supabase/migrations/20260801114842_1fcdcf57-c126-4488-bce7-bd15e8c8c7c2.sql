CREATE OR REPLACE FUNCTION public.get_category_stats()
RETURNS TABLE(
  category_id uuid,
  total_products integer,
  active_products integer,
  out_of_stock_products integer,
  total_inventory integer,
  total_sales integer,
  revenue_inr numeric,
  profit_inr numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    count(p.id)::int,
    count(p.id) FILTER (WHERE p.status = 'active')::int,
    count(p.id) FILTER (WHERE p.status = 'out_of_stock')::int,
    coalesce(sum(CASE WHEN p.product_type = 'limited' THEN p.stock ELSE 0 END), 0)::int,
    coalesce((SELECT count(*) FROM public.orders o
      JOIN public.catalog_products cp ON cp.id = o.catalog_product_id
      WHERE cp.category_id = c.id AND o.status IN ('completed', 'delivered')), 0)::int,
    coalesce((SELECT sum(o.amount_inr) FROM public.orders o
      JOIN public.catalog_products cp ON cp.id = o.catalog_product_id
      WHERE cp.category_id = c.id AND o.status IN ('completed', 'delivered')), 0)::numeric,
    coalesce((SELECT sum(o.amount_inr - cp.supplier_cost_inr) FROM public.orders o
      JOIN public.catalog_products cp ON cp.id = o.catalog_product_id
      WHERE cp.category_id = c.id AND o.status IN ('completed', 'delivered')), 0)::numeric
  FROM public.product_categories c
  LEFT JOIN public.catalog_products p ON p.category_id = c.id
  GROUP BY c.id
$$;

REVOKE ALL ON FUNCTION public.get_category_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_category_stats() TO authenticated, service_role;