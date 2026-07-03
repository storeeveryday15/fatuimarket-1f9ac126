
-- Guard non-admin updates on orders: prevent tampering with amounts, status transitions, cashback, admin fields.
CREATE OR REPLACE FUNCTION public.orders_guard_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin');
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin: block changes to sensitive fields.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.order_code IS DISTINCT FROM OLD.order_code
     OR NEW.product_slug IS DISTINCT FROM OLD.product_slug
     OR NEW.product_name IS DISTINCT FROM OLD.product_name
     OR NEW.tier_label IS DISTINCT FROM OLD.tier_label
     OR NEW.amount_inr IS DISTINCT FROM OLD.amount_inr
     OR NEW.amount_usd IS DISTINCT FROM OLD.amount_usd
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.discount_inr IS DISTINCT FROM OLD.discount_inr
     OR NEW.wallet_used_inr IS DISTINCT FROM OLD.wallet_used_inr
     OR NEW.cashback_inr IS DISTINCT FROM OLD.cashback_inr
     OR NEW.cashback_credited IS DISTINCT FROM OLD.cashback_credited
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
     OR NEW.processing_at IS DISTINCT FROM OLD.processing_at
     OR NEW.failed_at IS DISTINCT FROM OLD.failed_at
     OR NEW.expired_at IS DISTINCT FROM OLD.expired_at
     OR NEW.coupon_code IS DISTINCT FROM OLD.coupon_code
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected order fields';
  END IF;

  -- Only allow status transition from pending_payment to pending_verification.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending_payment' AND NEW.status = 'pending_verification') THEN
      RAISE EXCEPTION 'Invalid status transition for customer: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- Once past pending phases, block further customer edits.
  IF OLD.status NOT IN ('pending_payment','pending_verification','awaiting_verification') THEN
    RAISE EXCEPTION 'Order is locked from customer edits';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_guard_customer ON public.orders;
CREATE TRIGGER trg_orders_guard_customer
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_guard_customer_updates();

-- Guard non-admin updates on profiles: block wallet_balance / welcome offer tampering.
CREATE OR REPLACE FUNCTION public.profiles_guard_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin');
  IF is_admin THEN
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
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_customer ON public.profiles;
CREATE TRIGGER trg_profiles_guard_customer
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_customer_updates();
