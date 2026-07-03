
-- Prevent customers from escalating review status via UPDATE.
-- Replace UPDATE policy and add a BEFORE UPDATE guard trigger.

DROP POLICY IF EXISTS "reviews update own or admin" ON public.reviews;

CREATE POLICY "reviews update own or admin"
ON public.reviews
FOR UPDATE
TO authenticated
USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.reviews_guard_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin');
  IF is_admin THEN RETURN NEW; END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected review fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_guard_customer_updates ON public.reviews;
CREATE TRIGGER reviews_guard_customer_updates
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.reviews_guard_customer_updates();
