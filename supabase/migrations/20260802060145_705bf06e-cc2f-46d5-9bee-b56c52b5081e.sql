-- 1. Allow internal, audited wallet movements to bypass the customer profile guard
CREATE OR REPLACE FUNCTION public.profiles_guard_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.internal_wallet', true), '') = 'on' THEN
    -- internal wallet movement (order debit / refund / topup); other fields still locked
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Not allowed to modify protected profile fields';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
     OR NEW.has_used_welcome_offer IS DISTINCT FROM OLD.has_used_welcome_offer
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Authoritative server-side validation of every customer-created order
CREATE OR REPLACE FUNCTION public.orders_validate_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_label text;
  mult integer;
  unit numeric;
  expected numeric;
  bal numeric := 0;
  used_welcome boolean := true;
BEGIN
  -- Admins (and service-role/back-office inserts) are trusted.
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL AND NEW.user_id IS NOT NULL THEN
    -- service role / trusted server context
    RETURN NEW;
  END IF;

  -- Force a safe initial state; customers cannot self-declare progress.
  NEW.status := 'pending_payment';
  NEW.cashback_inr := 0;
  NEW.cashback_credited := false;
  NEW.stock_deducted := false;
  NEW.completed_at := NULL;
  NEW.rejected_at := NULL;
  NEW.processing_at := NULL;
  NEW.failed_at := NULL;
  NEW.expired_at := NULL;
  NEW.admin_notes := NULL;
  NEW.reason := NULL;
  NEW.quantity := GREATEST(COALESCE(NEW.quantity, 1), 1);
  NEW.currency := CASE WHEN NEW.currency = 'INR' THEN 'INR' ELSE 'USD' END;

  -- Resolve the authoritative catalogue price.
  base_label := btrim(regexp_replace(COALESCE(NEW.tier_label, ''), '\s*(×|x)\s*[0-9]+\s*$', ''));
  mult := GREATEST(
    COALESCE(((regexp_match(COALESCE(NEW.tier_label, ''), '(?:×|x)\s*([0-9]+)\s*$'))[1])::int, 1),
    NEW.quantity,
    1
  );
  IF mult > 100 THEN
    RAISE EXCEPTION 'Quantity is too large';
  END IF;

  SELECT c.price_inr INTO unit
  FROM public.catalog_products c
  WHERE c.product_slug = NEW.product_slug
    AND c.tier_label = base_label
  LIMIT 1;

  IF unit IS NULL OR unit <= 0 THEN
    RAISE EXCEPTION 'Unknown product or tier';
  END IF;

  expected := unit * mult;

  IF NEW.user_id IS NOT NULL THEN
    SELECT COALESCE(p.wallet_balance, 0), COALESCE(p.has_used_welcome_offer, false)
      INTO bal, used_welcome
    FROM public.profiles p WHERE p.id = NEW.user_id;
  END IF;

  -- Coupon: welcome offer only, INR only, once per customer, fixed value.
  IF NEW.user_id IS NOT NULL
     AND NEW.coupon_code IS NOT NULL
     AND upper(btrim(NEW.coupon_code)) = 'WELCOME2FATUI'
     AND NOT used_welcome
     AND NEW.currency = 'INR'
     AND expected > 5 THEN
    NEW.coupon_code := 'WELCOME2FATUI';
    NEW.discount_inr := 5;
  ELSE
    NEW.coupon_code := NULL;
    NEW.discount_inr := 0;
  END IF;

  -- Wallet: never more than the real balance, never more than the order value.
  NEW.wallet_used_inr := GREATEST(COALESCE(NEW.wallet_used_inr, 0), 0);
  IF NEW.currency <> 'INR' OR NEW.user_id IS NULL THEN
    NEW.wallet_used_inr := 0;
  END IF;
  IF NEW.wallet_used_inr > GREATEST(expected - NEW.discount_inr, 0) THEN
    NEW.wallet_used_inr := GREATEST(expected - NEW.discount_inr, 0);
  END IF;
  IF NEW.wallet_used_inr > bal THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Authoritative totals.
  IF NEW.currency = 'INR' THEN
    NEW.amount_inr := GREATEST(expected - NEW.discount_inr - NEW.wallet_used_inr, 0);
    NEW.amount_usd := NULL;
    NEW.region := 'IN';
  ELSE
    IF COALESCE(NEW.amount_usd, 0) < (expected / 100.0) THEN
      RAISE EXCEPTION 'Order amount does not match the product price';
    END IF;
    NEW.amount_inr := NULL;
  END IF;

  -- Debit the wallet immediately so a balance cannot be spent twice.
  IF NEW.wallet_used_inr > 0 THEN
    PERFORM set_config('app.internal_wallet', 'on', true);
    UPDATE public.profiles
      SET wallet_balance = COALESCE(wallet_balance, 0) - NEW.wallet_used_inr
      WHERE id = NEW.user_id AND COALESCE(wallet_balance, 0) >= NEW.wallet_used_inr;
    IF NOT FOUND THEN
      PERFORM set_config('app.internal_wallet', 'off', true);
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
    INSERT INTO public.wallet_transactions (user_id, type, amount_inr, description)
      VALUES (NEW.user_id, 'spend', -NEW.wallet_used_inr, 'Wallet applied to ' || NEW.order_code);
    PERFORM set_config('app.internal_wallet', 'off', true);
  END IF;

  IF NEW.discount_inr > 0 THEN
    PERFORM set_config('app.internal_wallet', 'on', true);
    UPDATE public.profiles SET has_used_welcome_offer = true WHERE id = NEW.user_id;
    PERFORM set_config('app.internal_wallet', 'off', true);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_validate_new ON public.orders;
CREATE TRIGGER trg_orders_validate_new
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_validate_new();

-- 3. Cashback on completion (no duplicate wallet 'spend' row: already debited at creation)
CREATE OR REPLACE FUNCTION public.orders_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cb numeric;
BEGIN
  IF NEW.status IN ('completed','delivered')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NOT COALESCE(NEW.cashback_credited, false)
     AND NEW.user_id IS NOT NULL
     AND NEW.currency = 'INR' THEN
    cb := public.compute_cashback_inr(COALESCE(NEW.amount_inr, 0));
    NEW.cashback_inr := cb;
    NEW.cashback_credited := true;
    IF NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;

    PERFORM set_config('app.internal_wallet', 'on', true);
    UPDATE public.profiles
      SET wallet_balance = COALESCE(wallet_balance,0) + cb,
          has_used_welcome_offer = true
      WHERE id = NEW.user_id;
    PERFORM set_config('app.internal_wallet', 'off', true);

    INSERT INTO public.wallet_transactions (user_id, order_id, type, amount_inr, description)
    VALUES (NEW.user_id, NEW.id, 'cashback', cb, 'Cashback for ' || NEW.order_code);
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Refund applied wallet credit when an order does not go through
CREATE OR REPLACE FUNCTION public.orders_refund_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.wallet_used_inr, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('cancelled','refunded','rejected','failed','expired')
     AND OLD.status NOT IN ('cancelled','refunded','rejected','failed','expired') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions w
      WHERE w.user_id = NEW.user_id
        AND w.type = 'refund'
        AND w.description = 'Wallet refund for ' || NEW.order_code
    ) THEN
      PERFORM set_config('app.internal_wallet', 'on', true);
      UPDATE public.profiles
        SET wallet_balance = COALESCE(wallet_balance,0) + NEW.wallet_used_inr
        WHERE id = NEW.user_id;
      PERFORM set_config('app.internal_wallet', 'off', true);
      INSERT INTO public.wallet_transactions (user_id, order_id, type, amount_inr, description)
        VALUES (NEW.user_id, NEW.id, 'refund', NEW.wallet_used_inr, 'Wallet refund for ' || NEW.order_code);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_refund_wallet ON public.orders;
CREATE TRIGGER trg_orders_refund_wallet
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_refund_wallet();

-- 5. Atomic, idempotent wallet top-up crediting
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_topup_ref_uidx
  ON public.wallet_transactions (description)
  WHERE type = 'topup';

CREATE OR REPLACE FUNCTION public.credit_wallet_topup(_user_id uuid, _amount numeric, _ref text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inserted boolean := false;
  bal numeric;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 OR _amount > 100000 OR _ref IS NULL THEN
    RAISE EXCEPTION 'Invalid top-up';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, type, amount_inr, description)
  VALUES (_user_id, 'topup', _amount, _ref)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted THEN
    PERFORM set_config('app.internal_wallet', 'on', true);
    UPDATE public.profiles
      SET wallet_balance = COALESCE(wallet_balance, 0) + _amount
      WHERE id = _user_id;
    PERFORM set_config('app.internal_wallet', 'off', true);
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO bal FROM public.profiles WHERE id = _user_id;
  RETURN COALESCE(bal, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.credit_wallet_topup(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_topup(uuid, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.orders_validate_new() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orders_refund_wallet() FROM PUBLIC, anon, authenticated;

-- 6. Visitor analytics: writes must go through the heartbeat function only
DROP POLICY IF EXISTS "visitors insert anyone" ON public.site_visitors;
DROP POLICY IF EXISTS "visitors update anyone" ON public.site_visitors;