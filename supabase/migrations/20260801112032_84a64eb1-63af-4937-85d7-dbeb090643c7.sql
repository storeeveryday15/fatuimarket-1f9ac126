DROP POLICY "Anyone can view active game servers" ON public.game_servers;

CREATE POLICY "Guests can view active game servers"
  ON public.game_servers FOR SELECT
  TO anon
  USING (active);

CREATE POLICY "Users can view active game servers"
  ON public.game_servers FOR SELECT
  TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));