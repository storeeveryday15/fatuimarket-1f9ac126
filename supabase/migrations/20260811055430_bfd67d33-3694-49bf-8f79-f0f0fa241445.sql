CREATE OR REPLACE FUNCTION public.reviews_guard_customer_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected review fields';
  END IF;

  RETURN NEW;
END;
$function$;