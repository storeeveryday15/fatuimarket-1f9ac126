ALTER VIEW public.catalog_products_public SET (security_invoker = on);
GRANT SELECT (id, product_slug, tier_label, category, category_id, name, image_url, description, price_inr, visible, featured, stock_status, sort_order, product_type, stock, status, display_status, low_stock_threshold, auto_status, created_at, updated_at)
  ON public.catalog_products TO anon, authenticated;