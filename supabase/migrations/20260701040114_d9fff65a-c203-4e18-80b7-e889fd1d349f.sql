
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_balance numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_used_welcome_offer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_popup boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_inr numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_used_inr numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_inr numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_credited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason text;

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('cashback','spend','refund','adjustment')),
  amount_inr numeric(10,2) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own wallet" ON public.wallet_transactions;
CREATE POLICY "user reads own wallet" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin reads all wallet" ON public.wallet_transactions;
CREATE POLICY "admin reads all wallet" ON public.wallet_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.compute_cashback_inr(amount numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF amount IS NULL OR amount <= 0 THEN RETURN 0; END IF;
  IF amount >= 1000 THEN RETURN 30;
  ELSIF amount >= 500 THEN RETURN 10;
  ELSIF amount >= 60 THEN RETURN 5;
  ELSE RETURN 2;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_on_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

    UPDATE public.profiles
      SET wallet_balance = COALESCE(wallet_balance,0) + cb,
          has_used_welcome_offer = true
      WHERE id = NEW.user_id;

    INSERT INTO public.wallet_transactions (user_id, order_id, type, amount_inr, description)
    VALUES (NEW.user_id, NEW.id, 'cashback', cb, 'Cashback for ' || NEW.order_code);

    IF COALESCE(NEW.wallet_used_inr, 0) > 0 THEN
      INSERT INTO public.wallet_transactions (user_id, order_id, type, amount_inr, description)
      VALUES (NEW.user_id, NEW.id, 'spend', -NEW.wallet_used_inr, 'Wallet applied to ' || NEW.order_code);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_on_complete ON public.orders;
CREATE TRIGGER trg_orders_on_complete
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_on_complete();

CREATE OR REPLACE FUNCTION public.expire_stale_orders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.orders
    SET status = 'failed', failed_at = now(), reason = 'Payment not submitted within 3 minutes'
    WHERE status = 'pending_payment' AND created_at < now() - interval '3 minutes';

  UPDATE public.orders
    SET status = 'expired', expired_at = now(), reason = 'Verification pending for over 24 hours'
    WHERE status IN ('pending_verification','awaiting_verification') AND created_at < now() - interval '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_cashback_inr(numeric) TO authenticated, anon;
