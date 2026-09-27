REVOKE SELECT ON public.review_replies FROM anon;

CREATE OR REPLACE FUNCTION public.orders_guard_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin');
  IF is_admin OR auth.uid() IS NULL THEN RETURN NEW; END IF;

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
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.needs_review IS DISTINCT FROM OLD.needs_review
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.coupon_code IS DISTINCT FROM OLD.coupon_code
     OR NEW.server_region IS DISTINCT FROM OLD.server_region
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.catalog_product_id IS DISTINCT FROM OLD.catalog_product_id
     OR NEW.supplier_status IS DISTINCT FROM OLD.supplier_status
     OR NEW.supplier_order_id IS DISTINCT FROM OLD.supplier_order_id
     OR NEW.delivery_details IS DISTINCT FROM OLD.delivery_details
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.utr IS DISTINCT FROM OLD.utr
     OR NEW.utr_submitted_at IS DISTINCT FROM OLD.utr_submitted_at
     OR NEW.screenshot_url IS DISTINCT FROM OLD.screenshot_url
     OR NEW.stock_deducted IS DISTINCT FROM OLD.stock_deducted
  THEN RAISE EXCEPTION 'Not allowed to modify protected order fields'; END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Order status is controlled by payment verification';
  END IF;
  RETURN NEW;
END;
$function$;