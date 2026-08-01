-- 1. Public view now runs as the querying user (no privilege escalation).
DROP VIEW public.catalog_products_public;

CREATE VIEW public.catalog_products_public
WITH (security_invoker = on) AS
  SELECT
    id, product_slug, tier_label, name, category, category_id,
    image_url, description, price_inr, product_type, stock, status,
    stock_status, visible, featured, sort_order, created_at, updated_at
  FROM public.catalog_products
  WHERE status <> 'hidden';

GRANT SELECT ON public.catalog_products_public TO anon, authenticated;

-- 2. Row policy for public reads (columns are further restricted by grants below).
CREATE POLICY "catalog public read visible"
  ON public.catalog_products FOR SELECT
  TO anon, authenticated
  USING (status <> 'hidden');

-- 3. Column-level grants: supplier cost/sourcing columns are NOT selectable by anon/authenticated.
REVOKE SELECT ON public.catalog_products FROM anon, authenticated;
GRANT SELECT (
  id, product_slug, tier_label, name, category, category_id,
  image_url, description, price_inr, product_type, stock, status,
  stock_status, visible, featured, sort_order, created_at, updated_at
) ON public.catalog_products TO anon, authenticated;

-- Writes remain gated by the admin-only RLS policy.
GRANT INSERT, UPDATE, DELETE ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;

-- 4. Admins read full rows (incl. cost/supplier) through an admin-checked function.
CREATE OR REPLACE FUNCTION public.admin_catalog_products()
RETURNS SETOF public.catalog_products
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY SELECT * FROM public.catalog_products ORDER BY name NULLS LAST;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_catalog_products() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_catalog_products() TO authenticated;