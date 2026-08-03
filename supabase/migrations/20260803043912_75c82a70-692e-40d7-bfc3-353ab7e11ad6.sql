CREATE TABLE public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  url text NOT NULL,
  emoji text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.social_links TO anon;
GRANT SELECT ON public.social_links TO authenticated;
GRANT ALL ON public.social_links TO service_role;

ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active social links"
ON public.social_links FOR SELECT
USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage social links"
ON public.social_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.social_links TO authenticated;

CREATE TRIGGER social_links_touch
BEFORE UPDATE ON public.social_links
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.social_links (key, label, url, emoji, description, sort_order) VALUES
  ('website',   'Visit Website',          'https://fatuimarket.shop', '🌐', 'Official Fatui Market store', 1),
  ('youtube',   'Watch on YouTube',       'https://youtube.com/@fatuimarket?si=z4P9xR9qAxaWLcMj', '▶️', 'Videos, guides and giveaways', 2),
  ('instagram', 'Follow on Instagram',    'https://www.instagram.com/fatuimarket?igsh=bDhvNW44dGUwYXRo', '📸', 'Daily posts and stories', 3),
  ('facebook',  'Follow on Facebook',     'https://www.facebook.com/share/199YZVigUE/', '📘', 'Facebook page', 4),
  ('telegram',  'Join Telegram',          'https://t.me/fatuimarket', '✈️', 'Announcements and community', 5),
  ('whatsapp_channel', 'Join WhatsApp Channel', 'https://whatsapp.com/channel/0029VbD2uz34Y9ljxvkbLS3A', '📢', 'Offers and announcements', 6),
  ('whatsapp',  'Chat on WhatsApp',       'https://wa.me/917679393645', '💬', 'Direct customer support', 7),
  ('email',     'Email Support',          'mailto:fatuimarket@gmail.com', '📧', 'Support inbox', 8);