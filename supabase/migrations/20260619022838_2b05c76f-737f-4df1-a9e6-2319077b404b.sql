
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_slug text,
  full_name text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  rating int NOT NULL,
  review text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_rating_chk CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT reviews_status_chk CHECK (status IN ('approved','pending','rejected')),
  CONSTRAINT reviews_review_len CHECK (char_length(review) BETWEEN 1 AND 1000),
  CONSTRAINT reviews_name_len CHECK (char_length(full_name) BETWEEN 1 AND 100)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews owner select" ON public.reviews
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviews insert own" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews update own or admin" ON public.reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviews delete own or admin" ON public.reviews
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Trigger: compute privacy-safe display_name from full_name
CREATE OR REPLACE FUNCTION public.reviews_set_display_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cleaned text;
  parts text[];
  first_part text;
  last_part text;
BEGIN
  cleaned := btrim(regexp_replace(NEW.full_name, '\s+', ' ', 'g'));
  parts := string_to_array(cleaned, ' ');
  first_part := parts[1];
  IF array_length(parts, 1) >= 2 THEN
    last_part := parts[array_length(parts, 1)];
    NEW.display_name := first_part || ' ' || upper(left(last_part, 1)) || '.';
  ELSE
    NEW.display_name := first_part;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER reviews_set_display_name_trg
BEFORE INSERT OR UPDATE OF full_name ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.reviews_set_display_name();

CREATE TRIGGER reviews_touch_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Public view: exposes only privacy-safe columns
CREATE VIEW public.reviews_public
WITH (security_invoker = true)
AS
SELECT id, product_slug, display_name, rating, review, created_at
FROM public.reviews
WHERE status = 'approved';

GRANT SELECT ON public.reviews_public TO anon, authenticated;

-- Allow anon/authenticated to read approved rows via the view (security_invoker honors RLS).
-- Add a SELECT policy on base table limited to approved rows so the view works for anon.
CREATE POLICY "reviews public approved select" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

CREATE INDEX reviews_product_slug_idx ON public.reviews(product_slug);
CREATE INDEX reviews_created_at_idx ON public.reviews(created_at DESC);
