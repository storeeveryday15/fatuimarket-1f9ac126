-- 1. Approved customer INR price lives in its own column; sell_price_inr held raw USD.
ALTER TABLE public.supplier_services
  ADD COLUMN IF NOT EXISTS customer_price_inr numeric,
  ADD COLUMN IF NOT EXISTS priced_at_supplier_usd numeric,
  ADD COLUMN IF NOT EXISTS customer_price_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_price_approved_by uuid;
ALTER TABLE public.supplier_services
  ADD CONSTRAINT supplier_services_customer_price_positive CHECK (customer_price_inr IS NULL OR customer_price_inr > 0);
COMMENT ON COLUMN public.supplier_services.sell_price_inr IS 'DEPRECATED: contained unconverted USD. Replaced by customer_price_inr.';

-- 2. Stop the old recompute from writing USD values into an INR column.
CREATE OR REPLACE FUNCTION public.recompute_sell_prices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN 0; -- DEPRECATED: customer prices are only set by admin approval.
END;
$$;

-- 3. Alert thresholds.
ALTER TABLE public.supplier_pricing_settings
  ADD COLUMN IF NOT EXISTS min_change_pct numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_change_usd numeric NOT NULL DEFAULT 0.01;

-- 4. Alert metadata.
ALTER TABLE public.supplier_price_changes
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'change',
  ADD COLUMN IF NOT EXISTS change_pct numeric,
  ADD COLUMN IF NOT EXISTS baseline_supplier_usd numeric,
  ADD COLUMN IF NOT EXISTS previous_customer_price_inr numeric,
  ADD COLUMN IF NOT EXISTS applied_customer_price_inr numeric,
  ADD COLUMN IF NOT EXISTS source_sync_run_id uuid;
-- Alerts created before this repair compared against unconverted USD values.
UPDATE public.supplier_price_changes SET kind = 'legacy' WHERE detected_at < now();
CREATE UNIQUE INDEX IF NOT EXISTS supplier_price_changes_one_pending
  ON public.supplier_price_changes (supplier_service_id) WHERE status = 'pending' AND kind = 'change';

-- 5. Append-only price history.
CREATE TABLE public.supplier_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_service_id uuid NOT NULL REFERENCES public.supplier_services(id),
  supplier_key text NOT NULL,
  product_code text,
  service_code text NOT NULL,
  action text NOT NULL CHECK (action IN ('initial_price','price_change_approved','price_change_rejected')),
  old_supplier_usd numeric,
  new_supplier_usd numeric,
  usd_inr_rate numeric NOT NULL,
  markup_pct numeric NOT NULL,
  rounding_step integer NOT NULL,
  old_customer_price_inr numeric,
  new_customer_price_inr numeric,
  price_change_id uuid REFERENCES public.supplier_price_changes(id),
  source_sync_run_id uuid,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_price_history TO authenticated;
GRANT ALL ON public.supplier_price_history TO service_role;
ALTER TABLE public.supplier_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read supplier price history" ON public.supplier_price_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Column-level lockdown: public and signed-in clients can never read supplier cost data.
REVOKE SELECT ON public.supplier_services FROM anon, authenticated;
GRANT SELECT (id, supplier_product_id, service_code, service_name, description, min_quantity, max_quantity,
  available, active, requires_validation, input_fields, validation_code, sort_order, customer_price_inr,
  catalog_product_id, created_at, updated_at) ON public.supplier_services TO anon, authenticated;