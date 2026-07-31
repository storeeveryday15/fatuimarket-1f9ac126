-- 1. Categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.product_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories admin all" ON public.product_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_categories_touch BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.product_categories (slug, name, sort_order) VALUES
  ('mobile-legends','Mobile Legends',1),
  ('genshin-impact','Genshin Impact',2),
  ('wuthering-waves','Wuthering Waves',3),
  ('free-fire','Free Fire',4),
  ('honor-of-kings','Honor of Kings',5),
  ('love-and-deepspace','Love and Deepspace',6),
  ('pubg-mobile','PUBG Mobile',7),
  ('valorant','Valorant',8),
  ('steam-wallet','Steam Wallet',9),
  ('google-play','Google Play',10),
  ('razer-gold','Razer Gold',11),
  ('roblox','Roblox',12);

-- 2. Product inventory columns
ALTER TABLE public.catalog_products
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN name text,
  ADD COLUMN product_type text NOT NULL DEFAULT 'unlimited',
  ADD COLUMN stock integer NOT NULL DEFAULT 0,
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN supplier_name text;

ALTER TABLE public.catalog_products
  ADD CONSTRAINT catalog_products_product_type_chk CHECK (product_type IN ('unlimited','limited')),
  ADD CONSTRAINT catalog_products_status_chk CHECK (status IN ('active','hidden','out_of_stock'));

UPDATE public.catalog_products SET name = tier_label WHERE name IS NULL;

CREATE INDEX idx_catalog_products_category ON public.catalog_products(category_id);
CREATE INDEX idx_catalog_products_slug_tier ON public.catalog_products(product_slug, tier_label);

-- keep `visible` (used by the public read policy) in sync with status
CREATE OR REPLACE FUNCTION public.catalog_products_sync_visibility()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.product_type = 'limited' AND NEW.stock <= 0 AND NEW.status = 'active' THEN
    NEW.status := 'out_of_stock';
  END IF;
  NEW.visible := (NEW.status = 'active');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_catalog_products_sync_visibility
  BEFORE INSERT OR UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.catalog_products_sync_visibility();

-- 3. Inventory history
CREATE TABLE public.inventory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  change integer NOT NULL,
  new_stock integer,
  reason text NOT NULL,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.inventory_history TO authenticated;
GRANT ALL ON public.inventory_history TO service_role;
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory history admin read" ON public.inventory_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "inventory history admin insert" ON public.inventory_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_inventory_history_product ON public.inventory_history(catalog_product_id, created_at DESC);

-- 4. Orders: quantity + deduction bookkeeping
ALTER TABLE public.orders
  ADD COLUMN quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  ADD COLUMN stock_deducted boolean NOT NULL DEFAULT false;

-- 5. Automatic stock reduction / restore
CREATE OR REPLACE FUNCTION public.orders_sync_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prod public.catalog_products%ROWTYPE;
  qty integer := GREATEST(COALESCE(NEW.quantity, 1), 1);
  new_qty integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO prod FROM public.catalog_products
   WHERE (NEW.catalog_product_id IS NOT NULL AND id = NEW.catalog_product_id)
      OR (NEW.catalog_product_id IS NULL AND product_slug = NEW.product_slug AND tier_label = NEW.tier_label)
   LIMIT 1;

  IF NOT FOUND OR prod.product_type <> 'limited' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('completed','delivered') AND NOT COALESCE(NEW.stock_deducted, false) THEN
    new_qty := GREATEST(prod.stock - qty, 0);
    UPDATE public.catalog_products SET stock = new_qty WHERE id = prod.id;
    INSERT INTO public.inventory_history (catalog_product_id, order_id, change, new_stock, reason, note)
      VALUES (prod.id, NEW.id, -qty, new_qty, 'sale', 'Order ' || NEW.order_code || ' completed');
    NEW.stock_deducted := true;
  ELSIF NEW.status IN ('cancelled','refunded','rejected','failed','expired') AND COALESCE(NEW.stock_deducted, false) THEN
    new_qty := prod.stock + qty;
    UPDATE public.catalog_products SET stock = new_qty WHERE id = prod.id;
    INSERT INTO public.inventory_history (catalog_product_id, order_id, change, new_stock, reason, note)
      VALUES (prod.id, NEW.id, qty, new_qty, 'restore', 'Order ' || NEW.order_code || ' ' || NEW.status);
    NEW.stock_deducted := false;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orders_sync_inventory() FROM anon, public;

CREATE TRIGGER trg_orders_sync_inventory
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_sync_inventory();

-- Existing customer-update guard must tolerate the new bookkeeping columns
CREATE OR REPLACE FUNCTION public.orders_guard_customer_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin');
  IF is_admin THEN RETURN NEW; END IF;

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
     OR NEW.server_region IS DISTINCT FROM OLD.server_region
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.catalog_product_id IS DISTINCT FROM OLD.catalog_product_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected order fields';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending_payment' AND NEW.status = 'pending_verification') THEN
      RAISE EXCEPTION 'Invalid status transition for customer: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  IF OLD.status NOT IN ('pending_payment','pending_verification','awaiting_verification') THEN
    RAISE EXCEPTION 'Order is locked from customer edits';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orders_guard_customer_updates() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.catalog_products_sync_visibility() FROM anon, public;

-- 6. Category-level stats for the admin dashboard
CREATE OR REPLACE FUNCTION public.get_category_stats()
RETURNS TABLE(
  category_id uuid,
  total_products integer,
  active_products integer,
  out_of_stock_products integer,
  total_inventory integer,
  total_sales integer,
  revenue_inr numeric,
  profit_inr numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id,
    count(p.id)::int,
    count(p.id) FILTER (WHERE p.status = 'active')::int,
    count(p.id) FILTER (WHERE p.status = 'out_of_stock')::int,
    coalesce(sum(CASE WHEN p.product_type = 'limited' THEN p.stock ELSE 0 END), 0)::int,
    coalesce((SELECT count(*) FROM public.orders o
        JOIN public.catalog_products cp ON cp.id = o.catalog_product_id
       WHERE cp.category_id = c.id AND o.status IN ('completed','delivered')), 0)::int,
    coalesce((SELECT sum(o.amount_inr) FROM public.orders o
        JOIN public.catalog_products cp ON cp.id = o.catalog_product_id
       WHERE cp.category_id = c.id AND o.status IN ('completed','delivered')), 0)::numeric,
    coalesce((SELECT sum(o.amount_inr - cp.supplier_cost_inr) FROM public.orders o
        JOIN public.catalog_products cp ON cp.id = o.catalog_product_id
       WHERE cp.category_id = c.id AND o.status IN ('completed','delivered')), 0)::numeric
  FROM public.product_categories c
  LEFT JOIN public.catalog_products p ON p.category_id = c.id
  GROUP BY c.id
$$;
REVOKE EXECUTE ON FUNCTION public.get_category_stats() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_category_stats() TO authenticated, service_role;