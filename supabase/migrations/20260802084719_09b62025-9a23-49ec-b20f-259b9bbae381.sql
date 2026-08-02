-- Public view goes back to invoker semantics (no SECURITY DEFINER view).
ALTER VIEW public.catalog_products_public SET (security_invoker = on);

-- Rows are public again...
CREATE POLICY "catalog public read visible"
  ON public.catalog_products
  FOR SELECT
  TO anon, authenticated
  USING (status <> 'hidden');

-- ...but cost/margin columns are not readable by anyone but admins (via
-- admin_catalog_products(), which is SECURITY DEFINER and role-checked).
REVOKE SELECT ON public.catalog_products FROM anon, authenticated;

GRANT SELECT (
  id, product_slug, tier_label, name, category, category_id, image_url,
  description, price_inr, product_type, stock, status, stock_status, visible,
  featured, sort_order, display_status, low_stock_threshold, auto_status,
  created_at, updated_at
) ON public.catalog_products TO anon, authenticated;

-- Realtime payloads are column-privilege filtered, so this is safe again.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_products;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;