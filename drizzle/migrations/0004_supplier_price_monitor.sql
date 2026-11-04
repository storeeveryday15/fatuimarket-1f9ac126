CREATE TABLE public.supplier_pricing_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  usd_inr_rate numeric NOT NULL DEFAULT 111.1111 CHECK (usd_inr_rate > 0),
  markup_pct numeric NOT NULL DEFAULT 15 CHECK (markup_pct >= 0),
  rounding_step integer NOT NULL DEFAULT 10 CHECK (rounding_step IN (1,5,10)),
  auto_apply_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.supplier_pricing_settings TO authenticated;
GRANT ALL ON public.supplier_pricing_settings TO service_role;
ALTER TABLE public.supplier_pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage supplier pricing settings" ON public.supplier_pricing_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.supplier_pricing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.supplier_price_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_service_id uuid NOT NULL REFERENCES public.supplier_services(id) ON DELETE CASCADE,
  supplier_key text NOT NULL DEFAULT 'flashtopup',
  product_name text,
  service_name text NOT NULL,
  service_code text NOT NULL,
  old_supplier_price_usd numeric,
  new_supplier_price_usd numeric NOT NULL,
  usd_inr_rate numeric NOT NULL,
  markup_pct numeric NOT NULL,
  rounding_step integer NOT NULL,
  acquisition_cost_inr numeric NOT NULL,
  current_sell_price_inr numeric,
  proposed_sell_price_inr numeric NOT NULL,
  expected_profit_inr numeric NOT NULL,
  expected_margin_pct numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
CREATE INDEX supplier_price_changes_status_idx ON public.supplier_price_changes (status, detected_at DESC);
CREATE INDEX supplier_price_changes_service_idx ON public.supplier_price_changes (supplier_service_id);
GRANT SELECT, UPDATE ON public.supplier_price_changes TO authenticated;
GRANT ALL ON public.supplier_price_changes TO service_role;
ALTER TABLE public.supplier_price_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read supplier price changes" ON public.supplier_price_changes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins review supplier price changes" ON public.supplier_price_changes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));