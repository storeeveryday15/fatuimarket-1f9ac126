DROP POLICY IF EXISTS "catalog public read visible" ON public.catalog_products;
CREATE POLICY "catalog public read visible" ON public.catalog_products
  FOR SELECT TO anon, authenticated
  USING (status <> 'hidden');