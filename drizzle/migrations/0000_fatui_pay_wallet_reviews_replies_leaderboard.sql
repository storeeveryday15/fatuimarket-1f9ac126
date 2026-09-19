CREATE TABLE public.consumed_payment_rrns (
  rrn_normalized text PRIMARY KEY,
  payment_target text NOT NULL CHECK (payment_target IN ('order','wallet_topup')),
  target_id uuid NOT NULL,
  amount_inr numeric NOT NULL CHECK (amount_inr > 0),
  event_id text NOT NULL UNIQUE,
  consumed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.consumed_payment_rrns TO service_role;
ALTER TABLE public.consumed_payment_rrns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topup_code text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  amount_inr numeric NOT NULL CHECK (amount_inr >= 10 AND amount_inr <= 100000 AND amount_inr = trunc(amount_inr)),
  utr text,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','pending_verification','paid','rejected','duplicate_rrn','expired')),
  reason text,
  needs_review boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  utr_submitted_at timestamptz,
  verified_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_topups TO authenticated;
GRANT ALL ON public.wallet_topups TO service_role;
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet topups own select" ON public.wallet_topups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX wallet_topups_user_created_idx ON public.wallet_topups (user_id, created_at DESC);
CREATE INDEX wallet_topups_status_idx ON public.wallet_topups (status);
CREATE TRIGGER wallet_topups_touch BEFORE UPDATE ON public.wallet_topups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.finalize_fatui_wallet_topup(_topup_code text,_rrn text,_amount numeric,_event_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE t public.wallet_topups%ROWTYPE; normalized text := lower(btrim(coalesce(_rrn, ''))); new_balance numeric;
BEGIN
  IF normalized = '' OR _event_id IS NULL OR btrim(_event_id) = '' THEN RAISE EXCEPTION 'Missing payment reference'; END IF;
  SELECT * INTO t FROM public.wallet_topups WHERE topup_code = _topup_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','not_found'); END IF;
  IF t.status = 'paid' THEN RETURN jsonb_build_object('result','already_paid','target_id',t.id); END IF;
  IF t.status NOT IN ('pending_payment','pending_verification') THEN RETURN jsonb_build_object('result','closed','target_id',t.id); END IF;
  IF t.utr IS NULL OR lower(btrim(t.utr)) <> normalized THEN
    UPDATE public.wallet_topups SET status='rejected', needs_review=true, reason='Bank reference does not match the submitted UTR' WHERE id=t.id;
    RETURN jsonb_build_object('result','rrn_mismatch','target_id',t.id);
  END IF;
  IF _amount IS NULL OR abs(_amount - t.amount_inr) > 0.009 THEN
    UPDATE public.wallet_topups SET status='rejected', needs_review=true, reason='Paid amount does not match the wallet top-up amount' WHERE id=t.id;
    RETURN jsonb_build_object('result','amount_mismatch','target_id',t.id);
  END IF;
  BEGIN
    INSERT INTO public.consumed_payment_rrns(rrn_normalized,payment_target,target_id,amount_inr,event_id)
    VALUES(normalized,'wallet_topup',t.id,t.amount_inr,_event_id);
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.wallet_topups SET status='duplicate_rrn', needs_review=true, reason='This payment reference was already used' WHERE id=t.id;
    RETURN jsonb_build_object('result','duplicate_rrn','target_id',t.id);
  END;
  INSERT INTO public.wallet_transactions(user_id,type,amount_inr,description)
  VALUES(t.user_id,'topup',t.amount_inr,'Fatui Pay ' || normalized) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','already_paid','target_id',t.id); END IF;
  PERFORM set_config('app.internal_wallet','on',true);
  UPDATE public.profiles SET wallet_balance=coalesce(wallet_balance,0)+t.amount_inr WHERE id=t.user_id RETURNING wallet_balance INTO new_balance;
  PERFORM set_config('app.internal_wallet','off',true);
  UPDATE public.wallet_topups SET status='paid', verified_at=now(), credited_at=now(), needs_review=false, reason=NULL WHERE id=t.id;
  RETURN jsonb_build_object('result','credited','target_id',t.id,'balance',coalesce(new_balance,0));
END;
$function$;
REVOKE ALL ON FUNCTION public.finalize_fatui_wallet_topup(text,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_fatui_wallet_topup(text,text,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.register_fatui_order_payment(_order_id uuid,_rrn text,_amount numeric,_event_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE o public.orders%ROWTYPE; normalized text := lower(btrim(coalesce(_rrn, ''))); expected numeric;
BEGIN
  IF normalized = '' OR _event_id IS NULL OR btrim(_event_id) = '' THEN RAISE EXCEPTION 'Missing payment reference'; END IF;
  SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','not_found'); END IF;
  IF o.status IN ('paid','processing','completed','delivered') THEN RETURN jsonb_build_object('result','already_paid'); END IF;
  expected := CASE WHEN o.currency='INR' THEN o.amount_inr ELSE o.amount_usd END;
  IF o.utr IS NULL OR lower(btrim(o.utr)) <> normalized THEN
    UPDATE public.orders SET status='rejected', rejected_at=now(), reason='Bank reference does not match the submitted UTR', needs_review=true WHERE id=o.id;
    RETURN jsonb_build_object('result','rrn_mismatch');
  END IF;
  IF _amount IS NULL OR abs(_amount-expected)>0.009 THEN
    UPDATE public.orders SET status='rejected', rejected_at=now(), reason='Paid amount does not match the order amount', needs_review=true WHERE id=o.id;
    RETURN jsonb_build_object('result','amount_mismatch');
  END IF;
  BEGIN
    INSERT INTO public.consumed_payment_rrns(rrn_normalized,payment_target,target_id,amount_inr,event_id)
    VALUES(normalized,'order',o.id,_amount,_event_id);
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.orders SET status='duplicate_rrn', reason='This payment reference was already used for another payment', needs_review=true WHERE id=o.id;
    RETURN jsonb_build_object('result','duplicate_rrn');
  END;
  UPDATE public.orders SET status='paid', verified_at=now(), payment_method='fatui_pay', utr=_rrn, needs_review=false, reason=NULL WHERE id=o.id;
  RETURN jsonb_build_object('result','paid');
END;
$function$;
REVOKE ALL ON FUNCTION public.register_fatui_order_payment(uuid,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_fatui_order_payment(uuid,text,numeric,text) TO service_role;

CREATE TABLE public.review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  is_seller boolean NOT NULL DEFAULT false,
  display_name text NOT NULL DEFAULT 'Customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_replies TO authenticated;
GRANT SELECT ON public.review_replies TO anon;
GRANT ALL ON public.review_replies TO service_role;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads replies to approved reviews" ON public.review_replies FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.reviews r WHERE r.id=review_id AND r.status='approved'));
CREATE POLICY "review owner or admin inserts replies" ON public.review_replies FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.id=review_id AND r.user_id=auth.uid())));
CREATE POLICY "reply owner or admin updates" ON public.review_replies FOR UPDATE TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id=auth.uid() AND (public.has_role(auth.uid(),'admin') OR is_seller=false));
CREATE POLICY "reply owner or admin deletes" ON public.review_replies FOR DELETE TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX review_replies_review_created_idx ON public.review_replies(review_id,created_at);

CREATE OR REPLACE FUNCTION public.review_replies_prepare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE n text;
BEGIN
  NEW.user_id := auth.uid();
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  NEW.is_seller := public.has_role(NEW.user_id,'admin');
  IF NEW.is_seller THEN NEW.display_name := 'Fatui Market Seller';
  ELSE
    SELECT coalesce(display_name,username,'Customer') INTO n FROM public.profiles WHERE id=NEW.user_id;
    NEW.display_name := CASE WHEN length(coalesce(n,'')) >= 2 THEN left(n,2) || '****' ELSE 'Customer' END;
  END IF;
  NEW.body := btrim(NEW.body);
  RETURN NEW;
END;
$function$;
CREATE TRIGGER review_replies_prepare_trg BEFORE INSERT ON public.review_replies FOR EACH ROW EXECUTE FUNCTION public.review_replies_prepare();
CREATE TRIGGER review_replies_touch BEFORE UPDATE ON public.review_replies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.reviews_auto_publish() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN NEW.status := 'approved'; RETURN NEW; END;
$function$;
CREATE TRIGGER reviews_auto_publish_trg BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.reviews_auto_publish();
DROP POLICY IF EXISTS "reviews public approved select" ON public.reviews;

CREATE OR REPLACE VIEW public.review_replies_public WITH (security_invoker = false) AS
SELECT rr.id, rr.review_id, rr.body, rr.is_seller, rr.display_name, rr.created_at
FROM public.review_replies rr JOIN public.reviews r ON r.id=rr.review_id WHERE r.status='approved';
GRANT SELECT ON public.review_replies_public TO anon, authenticated;
GRANT ALL ON public.review_replies_public TO service_role;

CREATE OR REPLACE FUNCTION public.get_leaderboard_v2(_limit integer DEFAULT 10)
RETURNS TABLE(rank integer, masked_username text, country text, total_orders integer, total_spent_inr numeric, level text, review_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH agg AS (
    SELECT o.user_id, count(*)::int AS total_orders, coalesce(sum(o.amount_inr),0)::numeric AS total_spent_inr
    FROM public.orders o WHERE o.status IN ('completed','delivered') AND o.user_id IS NOT NULL AND o.currency='INR' GROUP BY o.user_id
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY a.total_spent_inr DESC,a.total_orders DESC)::int AS rank,a.user_id,a.total_orders,a.total_spent_inr
    FROM agg a ORDER BY a.total_spent_inr DESC,a.total_orders DESC LIMIT least(greatest(coalesce(_limit,10),1),50)
  )
  SELECT r.rank,
    CASE WHEN p.username IS NOT NULL AND length(p.username)>=2 THEN left(p.username,2)||'****'
         WHEN p.display_name IS NOT NULL AND length(p.display_name)>=2 THEN left(p.display_name,2)||'****' ELSE 'Player' END,
    coalesce(p.country,''),r.total_orders,r.total_spent_inr,
    CASE WHEN r.total_spent_inr>=25000 THEN 'Diamond' WHEN r.total_spent_inr>=10000 THEN 'Platinum' WHEN r.total_spent_inr>=5000 THEN 'Gold' WHEN r.total_spent_inr>=1000 THEN 'Silver' ELSE 'Bronze' END,
    (SELECT count(*)::int FROM public.reviews rv WHERE rv.user_id=r.user_id AND rv.status='approved')
  FROM ranked r LEFT JOIN public.profiles p ON p.id=r.user_id ORDER BY r.rank
$function$;
REVOKE ALL ON FUNCTION public.get_leaderboard_v2(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_v2(integer) TO anon, authenticated, service_role;