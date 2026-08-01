CREATE TABLE public.game_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  server_code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_slug, server_code)
);

GRANT SELECT ON public.game_servers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_servers TO authenticated;
GRANT ALL ON public.game_servers TO service_role;

ALTER TABLE public.game_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active game servers"
  ON public.game_servers FOR SELECT
  TO anon, authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert game servers"
  ON public.game_servers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update game servers"
  ON public.game_servers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete game servers"
  ON public.game_servers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER game_servers_touch_updated_at
  BEFORE UPDATE ON public.game_servers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.game_servers (product_slug, server_code, label, sort_order) VALUES
  ('wuthering-waves','sea','SEA',1),
  ('wuthering-waves','asia','Asia',2),
  ('wuthering-waves','america','America',3),
  ('wuthering-waves','europe','Europe',4),
  ('wuthering-waves','hmt','HMT',5),
  ('genshin-impact','asia','Asia',1),
  ('genshin-impact','europe','Europe',2),
  ('genshin-impact','america','America',3),
  ('genshin-impact','tw-hk-mo','TW / HK / MO',4),
  ('love-and-deepspace','asia','Asia',1),
  ('love-and-deepspace','america','America',2),
  ('love-and-deepspace','europe','Europe',3),
  ('honor-of-kings','global','Global',1),
  ('honor-of-kings','asia','Asia',2),
  ('honor-of-kings','europe','Europe',3),
  ('honor-of-kings','america','America',4),
  ('pubg-mobile','global','Global',1),
  ('pubg-mobile','korea-japan','Korea / Japan',2),
  ('pubg-mobile','vietnam','Vietnam',3),
  ('pubg-mobile','taiwan','Taiwan',4),
  ('valorant','ap','Asia Pacific (AP)',1),
  ('valorant','na','North America (NA)',2),
  ('valorant','eu','Europe (EU)',3),
  ('valorant','kr','Korea (KR)',4),
  ('valorant','br','Brazil (BR)',5),
  ('valorant','latam','LATAM',6);