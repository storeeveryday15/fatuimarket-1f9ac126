
CREATE TABLE public.game_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug text NOT NULL,
  category text NOT NULL DEFAULT 'event',
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  source_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX game_news_unique ON public.game_news (game_slug, lower(title));
CREATE INDEX game_news_slug_idx ON public.game_news (game_slug, published_at DESC);
GRANT SELECT ON public.game_news TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.game_news TO authenticated;
GRANT ALL ON public.game_news TO service_role;
ALTER TABLE public.game_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game news is public" ON public.game_news FOR SELECT USING (true);
CREATE POLICY "Admins manage game news" ON public.game_news FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER game_news_touch BEFORE UPDATE ON public.game_news
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'text',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  button_text text,
  button_link text,
  target_games text[] NOT NULL DEFAULT '{}',
  placements text[] NOT NULL DEFAULT '{homepage,dashboard,inbox}',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  send_email boolean NOT NULL DEFAULT false,
  emailed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX announcements_live_idx ON public.announcements (status, starts_at, ends_at, priority DESC);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published announcements are public" ON public.announcements FOR SELECT
  USING (status = 'published' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "Admins read all announcements" ON public.announcements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write announcements" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update announcements" ON public.announcements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete announcements" ON public.announcements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER announcements_touch BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  button_text text,
  button_link text,
  target_game text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX banners_live_idx ON public.banners (active, starts_at, ends_at, priority DESC);
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live banners are public" ON public.banners FOR SELECT
  USING (active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "Admins read all banners" ON public.banners FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write banners" ON public.banners FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update banners" ON public.banners FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete banners" ON public.banners FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER banners_touch BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  image_url text,
  game_slug text,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_announcement_unique ON public.notifications (user_id, announcement_id)
  WHERE announcement_id IS NOT NULL;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users mark their own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  announcements_enabled boolean NOT NULL DEFAULT true,
  last_promo_email_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own preferences" ON public.notification_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create their own preferences" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own preferences" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notification_prefs_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  NEW.last_promo_email_at := OLD.last_promo_email_at;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notification_prefs_guard() FROM anon, public;
CREATE TRIGGER notification_prefs_guard_trg BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.notification_prefs_guard();
CREATE TRIGGER notification_preferences_touch BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.orders_notify_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, category, title, body, link, game_slug)
  VALUES (
    NEW.user_id,
    'orders',
    'Order ' || NEW.order_code || ' — ' || replace(NEW.status, '_', ' '),
    NEW.product_name || ' · ' || NEW.tier_label,
    '/orders/' || NEW.order_code,
    NEW.product_slug
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orders_notify_customer() FROM anon, public;
CREATE TRIGGER orders_notify_customer_trg AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_notify_customer();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

CREATE POLICY "Admins upload announcement images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read announcement images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update announcement images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete announcement images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));
