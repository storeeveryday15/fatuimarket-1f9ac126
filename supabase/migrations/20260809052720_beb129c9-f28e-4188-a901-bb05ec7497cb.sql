-- 1. Catalog metadata -------------------------------------------------
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_products_slug_key ON public.supplier_products (slug) WHERE slug IS NOT NULL;

ALTER TABLE public.supplier_services
  ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sell_price_inr numeric;

-- 2. Pricing rules ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','category','product')),
  scope_value text,
  markup_type text NOT NULL CHECK (markup_type IN ('percent','fixed')),
  markup_value numeric NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pricing rules" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS pricing_rules_touch ON public.pricing_rules;
CREATE TRIGGER pricing_rules_touch BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Sync runs ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'catalog',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  products_total integer NOT NULL DEFAULT 0,
  products_added integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  products_disabled integer NOT NULL DEFAULT 0,
  services_total integer NOT NULL DEFAULT 0,
  pages_fetched integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.supplier_sync_runs TO authenticated;
GRANT ALL ON public.supplier_sync_runs TO service_role;
ALTER TABLE public.supplier_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sync runs" ON public.supplier_sync_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Markup application -------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_markup(_cost numeric, _category text, _product_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _cost IS NULL THEN NULL
    ELSE round(COALESCE((
      SELECT CASE r.markup_type
               WHEN 'percent' THEN _cost * (1 + r.markup_value / 100)
               ELSE _cost + r.markup_value
             END
      FROM public.pricing_rules r
      WHERE r.active
        AND (
          (r.scope = 'product'  AND r.scope_value = _product_id::text) OR
          (r.scope = 'category' AND r.scope_value IS NOT DISTINCT FROM _category) OR
          (r.scope = 'global')
        )
      ORDER BY CASE r.scope WHEN 'product' THEN 3 WHEN 'category' THEN 2 ELSE 1 END DESC,
               r.priority DESC
      LIMIT 1
    ), _cost), 2)
  END
$$;

REVOKE EXECUTE ON FUNCTION public.apply_markup(numeric, text, uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.recompute_sell_prices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.supplier_services s
     SET sell_price_inr = public.apply_markup(s.supplier_price, p.category, p.id)
    FROM public.supplier_products p
   WHERE p.id = s.supplier_product_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_sell_prices() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.pricing_rules_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_sell_prices();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS pricing_rules_recompute_trg ON public.pricing_rules;
CREATE TRIGGER pricing_rules_recompute_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.pricing_rules
  FOR EACH STATEMENT EXECUTE FUNCTION public.pricing_rules_recompute();

-- 5. Public read access (safe columns only) -----------------------------
GRANT SELECT (id, product_code, name, display_name, slug, region, category, product_type,
              icon_url, active, enabled, featured, hidden, updated_at)
  ON public.supplier_products TO anon, authenticated;

GRANT SELECT (id, supplier_product_id, service_code, service_name, currency, min_quantity,
              max_quantity, input_fields, requires_validation, available, active,
              description, sort_order, sell_price_inr, catalog_product_id, updated_at)
  ON public.supplier_services TO anon, authenticated;

DROP POLICY IF EXISTS "Public can browse enabled games" ON public.supplier_products;
CREATE POLICY "Public can browse enabled games" ON public.supplier_products
  FOR SELECT TO anon, authenticated
  USING (active AND enabled AND NOT hidden);

DROP POLICY IF EXISTS "Public can browse available services" ON public.supplier_services;
CREATE POLICY "Public can browse available services" ON public.supplier_services
  FOR SELECT TO anon, authenticated
  USING (
    active AND EXISTS (
      SELECT 1 FROM public.supplier_products p
      WHERE p.id = supplier_services.supplier_product_id
        AND p.active AND p.enabled AND NOT p.hidden
    )
  );

-- 6. Default markup -----------------------------------------------------
INSERT INTO public.pricing_rules (scope, scope_value, markup_type, markup_value, priority)
SELECT 'global', NULL, 'percent', 10, 0
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_rules WHERE scope = 'global');