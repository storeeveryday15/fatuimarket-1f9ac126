CREATE TABLE public.assistant_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  welcome_message text NOT NULL DEFAULT 'Hi! I''m Fatui AI ✨ — ask me about any game top-up, prices, delivery, wallet, refunds or the latest in-game events.',
  supported_games text[] NOT NULL DEFAULT '{}',
  extra_instructions text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assistant_settings TO anon, authenticated;
GRANT ALL ON public.assistant_settings TO service_role;
ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read assistant settings" ON public.assistant_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage assistant settings" ON public.assistant_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.assistant_settings (id) VALUES (1);

CREATE TABLE public.assistant_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assistant_faqs TO anon, authenticated;
GRANT ALL ON public.assistant_faqs TO service_role;
ALTER TABLE public.assistant_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active FAQs" ON public.assistant_faqs FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage FAQs" ON public.assistant_faqs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.assistant_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  question text NOT NULL,
  answer text NOT NULL,
  rating smallint CHECK (rating IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assistant_chats TO authenticated;
GRANT ALL ON public.assistant_chats TO service_role;
ALTER TABLE public.assistant_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read chat logs" ON public.assistant_chats FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER assistant_settings_touch BEFORE UPDATE ON public.assistant_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER assistant_faqs_touch BEFORE UPDATE ON public.assistant_faqs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.rate_assistant_chat(_chat_id uuid, _rating smallint)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.assistant_chats SET rating = _rating WHERE id = _chat_id AND created_at > now() - interval '1 day';
$$;
REVOKE EXECUTE ON FUNCTION public.rate_assistant_chat(uuid, smallint) FROM public;
GRANT EXECUTE ON FUNCTION public.rate_assistant_chat(uuid, smallint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_assistant_stats()
RETURNS TABLE(total_chats integer, chats_today integer, positive integer, negative integer, satisfaction numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE created_at > now() - interval '1 day')::int,
    count(*) FILTER (WHERE rating = 1)::int,
    count(*) FILTER (WHERE rating = -1)::int,
    CASE WHEN count(*) FILTER (WHERE rating IS NOT NULL) = 0 THEN 0
      ELSE round(100.0 * count(*) FILTER (WHERE rating = 1) / count(*) FILTER (WHERE rating IS NOT NULL), 1) END
  FROM public.assistant_chats
  WHERE public.has_role(auth.uid(), 'admin');
$$;
REVOKE EXECUTE ON FUNCTION public.get_assistant_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_assistant_stats() TO authenticated;