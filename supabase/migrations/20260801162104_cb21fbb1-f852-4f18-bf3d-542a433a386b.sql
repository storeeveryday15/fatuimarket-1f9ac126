-- 1. Price engine fields
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS competitor_price_inr numeric,
  ADD COLUMN IF NOT EXISTS min_safe_price_inr numeric;

-- 2. Scheduled price changes
CREATE TABLE IF NOT EXISTS public.price_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  new_price_inr numeric NOT NULL,
  apply_at timestamptz NOT NULL,
  applied_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_schedules TO authenticated;
GRANT ALL ON public.price_schedules TO service_role;
ALTER TABLE public.price_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage price schedules" ON public.price_schedules;
CREATE POLICY "Admins manage price schedules" ON public.price_schedules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_price_schedules_updated ON public.price_schedules;
CREATE TRIGGER trg_price_schedules_updated BEFORE UPDATE ON public.price_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Product views (anonymous analytics, no personal data)
CREATE TABLE IF NOT EXISTS public.product_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  tier_label text,
  session_id text,
  device_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_views TO authenticated;
GRANT ALL ON public.product_views TO service_role;
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read product views" ON public.product_views;
CREATE POLICY "Admins read product views" ON public.product_views
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_product_views_created ON public.product_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_views_slug ON public.product_views (product_slug);

CREATE OR REPLACE FUNCTION public.record_product_view(_product_slug text, _tier_label text DEFAULT NULL, _session_id text DEFAULT NULL, _device_type text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _product_slug IS NULL OR length(_product_slug) = 0 OR length(_product_slug) > 120 THEN
    RETURN;
  END IF;
  INSERT INTO public.product_views (product_slug, tier_label, session_id, device_type)
  VALUES (left(_product_slug,120), nullif(left(coalesce(_tier_label,''),120),''), nullif(left(coalesce(_session_id,''),64),''), nullif(left(coalesce(_device_type,''),16),''));
END;
$$;

REVOKE ALL ON FUNCTION public.record_product_view(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_product_view(text, text, text, text) TO anon, authenticated;

-- 4. Browser on visitor sessions
ALTER TABLE public.site_visitors ADD COLUMN IF NOT EXISTS browser text;

CREATE OR REPLACE FUNCTION public.visitor_heartbeat(_session_id text, _device_type text DEFAULT NULL::text, _referrer text DEFAULT NULL::text, _country text DEFAULT NULL::text, _browser text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 64 THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  INSERT INTO public.site_visitors (session_id, first_seen_at, last_seen_at, user_id, device_type, referrer, country, browser)
  VALUES (
    _session_id, now(), now(), auth.uid(),
    nullif(left(coalesce(_device_type,''), 16), ''),
    nullif(left(coalesce(_referrer,''), 200), ''),
    nullif(left(coalesce(_country,''), 8), ''),
    nullif(left(coalesce(_browser,''), 24), '')
  )
  ON CONFLICT (session_id) DO UPDATE
    SET last_seen_at = now(),
        user_id = COALESCE(auth.uid(), public.site_visitors.user_id),
        device_type = COALESCE(EXCLUDED.device_type, public.site_visitors.device_type),
        referrer = COALESCE(public.site_visitors.referrer, EXCLUDED.referrer),
        country = COALESCE(EXCLUDED.country, public.site_visitors.country),
        browser = COALESCE(EXCLUDED.browser, public.site_visitors.browser);
END;
$$;

REVOKE ALL ON FUNCTION public.visitor_heartbeat(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.visitor_heartbeat(text, text, text, text, text) TO anon, authenticated;

-- 5. Admin analytics helpers
CREATE OR REPLACE FUNCTION public.admin_visitor_breakdown()
RETURNS TABLE(browser text, device_type text, referrer text, sessions integer, avg_session_seconds numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    coalesce(v.browser,'Unknown'),
    coalesce(v.device_type,'unknown'),
    coalesce(v.referrer,'direct'),
    count(*)::int,
    coalesce(avg(extract(epoch from (v.last_seen_at - v.first_seen_at))),0)::numeric
  FROM public.site_visitors v
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY 1,2,3
$$;

REVOKE ALL ON FUNCTION public.admin_visitor_breakdown() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_visitor_breakdown() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_visitor_growth(_days integer DEFAULT 30)
RETURNS TABLE(day date, visitors integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v.first_seen_at::date, count(*)::int
  FROM public.site_visitors v
  WHERE public.has_role(auth.uid(), 'admin')
    AND v.first_seen_at > now() - make_interval(days => greatest(_days,1))
  GROUP BY 1 ORDER BY 1
$$;

REVOKE ALL ON FUNCTION public.admin_visitor_growth(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_visitor_growth(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_product_views(_days integer DEFAULT 30)
RETURNS TABLE(product_slug text, tier_label text, views integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pv.product_slug, coalesce(pv.tier_label,''), count(*)::int
  FROM public.product_views pv
  WHERE public.has_role(auth.uid(), 'admin')
    AND pv.created_at > now() - make_interval(days => greatest(_days,1))
  GROUP BY 1,2 ORDER BY 3 DESC
$$;

REVOKE ALL ON FUNCTION public.admin_product_views(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_views(integer) TO authenticated;

-- 6. Realtime for the new tables
ALTER TABLE public.price_schedules REPLICA IDENTITY FULL;
ALTER TABLE public.product_views REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.price_schedules; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_views; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.site_visitors; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_products; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;