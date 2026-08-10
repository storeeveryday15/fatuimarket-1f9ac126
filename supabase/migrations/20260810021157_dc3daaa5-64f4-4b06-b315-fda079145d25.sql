GRANT SELECT ON public.reviews_public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
GRANT ALL ON public.reviews_public TO service_role;