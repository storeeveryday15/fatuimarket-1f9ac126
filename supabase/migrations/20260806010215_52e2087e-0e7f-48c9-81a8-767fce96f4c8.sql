CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_key text NOT NULL DEFAULT 'flashtopup',
  product_code text NOT NULL,
  name text NOT NULL DEFAULT '',
  product_type text,
  icon_url text,
  validation_code text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_key, product_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;
GRANT ALL ON public.supplier_products TO service_role;

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage supplier products"
ON public.supplier_products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER supplier_products_touch_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_supplier_products_supplier ON public.supplier_products (supplier_key, active);