ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS display_status text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS auto_status boolean NOT NULL DEFAULT true;

ALTER TABLE public.catalog_products DROP CONSTRAINT IF EXISTS catalog_products_display_status_chk;
ALTER TABLE public.catalog_products ADD CONSTRAINT catalog_products_display_status_chk
  CHECK (display_status = ANY (ARRAY['auto','normal','limited','sold_out','restocking','coming_soon','unavailable']));

ALTER TABLE public.catalog_products DROP CONSTRAINT IF EXISTS catalog_products_status_chk;
ALTER TABLE public.catalog_products ADD CONSTRAINT catalog_products_status_chk
  CHECK (status = ANY (ARRAY['active','hidden','out_of_stock','restocking','coming_soon','disabled']));

CREATE OR REPLACE FUNCTION public.catalog_products_sync_visibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.auto_status, true)
     AND NEW.product_type = 'limited'
     AND NEW.stock <= 0
     AND NEW.status = 'active' THEN
    NEW.status := 'out_of_stock';
  END IF;
  NEW.visible := (NEW.status <> 'hidden');
  RETURN NEW;
END;
$function$;

DROP VIEW IF EXISTS public.catalog_products_public;
CREATE VIEW public.catalog_products_public
WITH (security_invoker = true) AS
SELECT id, product_slug, tier_label, name, category, category_id, image_url, description,
       price_inr, product_type, stock, status, stock_status, visible, featured, sort_order,
       display_status, low_stock_threshold, auto_status, created_at, updated_at
FROM public.catalog_products
WHERE status <> 'hidden';

GRANT SELECT ON public.catalog_products_public TO anon, authenticated;
GRANT ALL ON public.catalog_products_public TO service_role;