ALTER VIEW public.catalog_products_public SET (security_invoker = off);
GRANT SELECT ON public.catalog_products_public TO anon, authenticated;