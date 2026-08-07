
CREATE TABLE public.supplier_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_product_id uuid NOT NULL REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  service_code text NOT NULL,
  service_name text NOT NULL,
  supplier_price numeric,
  currency text,
  min_quantity integer NOT NULL DEFAULT 1,
  max_quantity integer NOT NULL DEFAULT 1,
  validation_code text,
  input_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_validation boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_product_id, service_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_services TO authenticated;
GRANT ALL ON public.supplier_services TO service_role;
ALTER TABLE public.supplier_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage supplier services" ON public.supplier_services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER supplier_services_touch BEFORE UPDATE ON public.supplier_services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_supplier_services_product ON public.supplier_services(supplier_product_id);
CREATE INDEX idx_supplier_services_catalog ON public.supplier_services(catalog_product_id);

CREATE TABLE public.supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  service_code text NOT NULL,
  reference_id text NOT NULL UNIQUE,
  supplier_order_id text,
  status text NOT NULL DEFAULT 'pending',
  last_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_orders TO authenticated;
GRANT ALL ON public.supplier_orders TO service_role;
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage supplier orders" ON public.supplier_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers read their supplier order" ON public.supplier_orders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = supplier_orders.order_id AND o.user_id = auth.uid()));
CREATE TRIGGER supplier_orders_touch BEFORE UPDATE ON public.supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.supplier_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.supplier_webhook_events TO service_role;
ALTER TABLE public.supplier_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read webhook events" ON public.supplier_webhook_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS supplier_status text,
  ADD COLUMN IF NOT EXISTS supplier_order_id text,
  ADD COLUMN IF NOT EXISTS delivery_details text;
