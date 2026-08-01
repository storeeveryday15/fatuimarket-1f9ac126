-- Public storefront view: customer-safe columns only, no supplier cost/sourcing data.
CREATE OR REPLACE VIEW public.catalog_products_public
WITH (security_invoker = off) AS
  SELECT
    id,
    product_slug,
    tier_label,
    name,
    category,
    category_id,
    image_url,
    description,
    price_inr,
    product_type,
    stock,
    status,
    stock_status,
    visible,
    featured,
    sort_order,
    created_at,
    updated_at
  FROM public.catalog_products
  WHERE status <> 'hidden';

GRANT SELECT ON public.catalog_products_public TO anon, authenticated;

-- Remove the all-columns public read on the base table.
DROP POLICY "catalog public read visible" ON public.catalog_products;