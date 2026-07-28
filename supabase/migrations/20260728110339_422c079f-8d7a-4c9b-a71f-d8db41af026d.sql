
-- =====================================================================
-- Fatui Market reseller platform: core operations schema
-- =====================================================================

-- ---------- SUPPLIERS -------------------------------------------------
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  api_endpoint text,
  api_key_secret_name text,
  status text NOT NULL DEFAULT 'unknown',
  priority integer NOT NULL DEFAULT 100,
  supported_products text[] NOT NULL DEFAULT '{}',
  notes text,
  auto_pricing_enabled boolean NOT NULL DEFAULT false,
  auto_ordering_enabled boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  avg_response_ms integer,
  error_count integer NOT NULL DEFAULT 0,
  wallet_balance_inr numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers admin all" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- SUPPLIER HEALTH CHECKS -----------------------------------
CREATE TABLE public.supplier_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status text NOT NULL,
  response_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_checks TO authenticated;
GRANT ALL ON public.supplier_checks TO service_role;
ALTER TABLE public.supplier_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_checks admin all" ON public.supplier_checks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX supplier_checks_supplier_idx ON public.supplier_checks(supplier_id, created_at DESC);

-- ---------- CATALOG PRODUCTS -----------------------------------------
CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  tier_label text NOT NULL,
  category text,
  image_url text,
  description text,
  price_inr numeric NOT NULL DEFAULT 0,
  supplier_cost_inr numeric NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_url text,
  visible boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  stock_status text NOT NULL DEFAULT 'in_stock',
  auto_pricing boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_slug, tier_label)
);
GRANT SELECT ON public.catalog_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog public read visible" ON public.catalog_products FOR SELECT
  TO anon, authenticated USING (visible = true);
CREATE POLICY "catalog admin all" ON public.catalog_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER catalog_products_touch BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- PRICE HISTORY --------------------------------------------
CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  old_price_inr numeric,
  new_price_inr numeric,
  supplier_cost_inr numeric,
  profit_inr numeric,
  reason text,
  ai_explanation text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history admin all" ON public.price_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX price_history_product_idx ON public.price_history(catalog_product_id, created_at DESC);

-- ---------- NOTIFICATIONS --------------------------------------------
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications admin all" ON public.admin_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX admin_notifications_created_idx ON public.admin_notifications(created_at DESC);

-- ---------- ADMIN AUDIT LOG ------------------------------------------
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_table text,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audit admin insert" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- PLATFORM SETTINGS ----------------------------------------
CREATE TABLE public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  min_profit_inr numeric NOT NULL DEFAULT 5,
  max_profit_inr numeric NOT NULL DEFAULT 200,
  min_profit_pct numeric NOT NULL DEFAULT 3,
  max_profit_pct numeric NOT NULL DEFAULT 40,
  price_rounding text NOT NULL DEFAULT 'nearest_1',
  auto_pricing_mode text NOT NULL DEFAULT 'suggest',
  auto_ordering_enabled boolean NOT NULL DEFAULT false,
  low_wallet_threshold_inr numeric NOT NULL DEFAULT 500,
  low_profit_threshold_inr numeric NOT NULL DEFAULT 2,
  discord_webhook_url text,
  email_alerts_enabled boolean NOT NULL DEFAULT true,
  telegram_alerts_enabled boolean NOT NULL DEFAULT true,
  ai_behaviour text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings admin all" ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER platform_settings_touch BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ---------- AI REPORTS -----------------------------------------------
CREATE TABLE public.ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  kind text NOT NULL DEFAULT 'daily',
  content text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_reports TO authenticated;
GRANT ALL ON public.ai_reports TO service_role;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_reports admin all" ON public.ai_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- SUPPORT TICKETS ------------------------------------------
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets insert own" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tickets select own or admin" ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tickets update admin" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER support_tickets_touch BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- CUSTOMER FLAGS -------------------------------------------
CREATE TABLE public.customer_flags (
  user_id uuid PRIMARY KEY,
  vip_level text NOT NULL DEFAULT 'standard',
  banned boolean NOT NULL DEFAULT false,
  ban_reason text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_flags TO authenticated;
GRANT ALL ON public.customer_flags TO service_role;
ALTER TABLE public.customer_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_flags admin all" ON public.customer_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER customer_flags_touch BEFORE UPDATE ON public.customer_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- REALTIME --------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_reports;

-- ---------- SEED SUPPLIERS -------------------------------------------
INSERT INTO public.suppliers (name, website, status, priority, supported_products, notes) VALUES
  ('LioGames', 'https://www.liogames.com/product/mobile-legends/', 'unknown', 10, ARRAY['mobile-legends'], 'Manual pricing — no public reseller API.'),
  ('BitTopup', 'https://bittopup.com/goods/wuthering-waves', 'unknown', 20, ARRAY['wuthering-waves'], 'Manual pricing — no public reseller API.'),
  ('BuffBuff', 'https://buffbuff.com/top-up/honor-of-kings', 'unknown', 30, ARRAY['honor-of-kings'], 'Manual pricing — no public reseller API.'),
  ('Flipkart', 'https://www.flipkart.com/google-play-gift-card/p/itme91000a1f5be5', 'unknown', 40, ARRAY['google-play'], 'Manual pricing — retail marketplace.'),
  ('UniPin (BGMI)', 'https://www.unipin.com/in/bgmi', 'unknown', 50, ARRAY['pubg'], 'Manual pricing — reseller API available on request.'),
  ('AcroShop', 'https://acroshop.in/product/6798df470c41fcf554584298/20', 'unknown', 60, ARRAY['genshin-impact'], 'Manual pricing — no public reseller API.'),
  ('Kaleoz (LADS)', 'https://www.kaleoz.com/buy/love-and-deepspace/243902', 'unknown', 70, ARRAY['love-and-deepspace'], 'Manual pricing — marketplace listing.'),
  ('Kaleoz (MLBB Weekly)', 'https://www.kaleoz.com/buy/mobile-legends/289993', 'unknown', 80, ARRAY['mobile-legends'], 'Manual pricing — marketplace listing.'),
  ('Rooter (Valorant)', 'https://shop.rooter.gg/product/valorant-points', 'unknown', 90, ARRAY['valorant'], 'Manual pricing — no public reseller API.'),
  ('Eneba (Razer Gold)', 'https://www.eneba.com/en-in/razer-razer-gold-gift-card-1-usd-key-global', 'unknown', 100, ARRAY['razer-gold'], 'Manual pricing — marketplace listing.'),
  ('Eneba (Roblox)', 'https://www.eneba.com/roblox-roblox-800-robux-key-global/pomelo-digital-shop', 'unknown', 110, ARRAY['roblox'], 'Manual pricing — 800 Robux global key.'),
  ('UniPin (Roblox & more)', 'https://www.unipin.com/in/game/', 'unknown', 120, ARRAY['roblox'], 'Manual pricing — general catalogue.'),
  ('Rooter (Steam Wallet)', 'https://shop.rooter.gg/product/steam-wallet-gift-card', 'unknown', 130, ARRAY['steam-wallet'], 'Manual pricing — no public reseller API.');
