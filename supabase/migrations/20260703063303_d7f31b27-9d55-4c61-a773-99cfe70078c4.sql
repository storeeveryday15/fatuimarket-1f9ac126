
-- Visitors table
CREATE TABLE public.site_visitors (
  session_id text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.site_visitors TO anon, authenticated;
GRANT ALL ON public.site_visitors TO service_role;
ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;

-- Anyone can upsert their own visitor row (session id is client-generated random)
CREATE POLICY "visitors insert anyone" ON public.site_visitors FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "visitors update anyone" ON public.site_visitors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX site_visitors_last_seen_idx ON public.site_visitors (last_seen_at DESC);

-- Aggregated visitor stats (no PII exposed)
CREATE OR REPLACE FUNCTION public.get_visitor_stats()
RETURNS TABLE(online int, today int, total int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.site_visitors WHERE last_seen_at > now() - interval '2 minutes'),
    (SELECT count(*)::int FROM public.site_visitors WHERE first_seen_at::date = (now() AT TIME ZONE 'UTC')::date),
    (SELECT count(*)::int FROM public.site_visitors)
$$;
GRANT EXECUTE ON FUNCTION public.get_visitor_stats() TO anon, authenticated;

-- Order stats (completed count + success rate)
CREATE OR REPLACE FUNCTION public.get_order_stats()
RETURNS TABLE(successful int, total_relevant int, success_rate numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      count(*) FILTER (WHERE status IN ('completed','delivered'))::int AS successful,
      count(*) FILTER (WHERE status IN ('completed','delivered','rejected','failed','expired','cancelled','refunded'))::int AS total_relevant
    FROM public.orders
  )
  SELECT
    s.successful,
    s.total_relevant,
    CASE WHEN s.total_relevant = 0 THEN 0
         ELSE round((s.successful::numeric / s.total_relevant::numeric) * 100, 1)
    END AS success_rate
  FROM s
$$;
GRANT EXECUTE ON FUNCTION public.get_order_stats() TO anon, authenticated;

-- Leaderboard: aggregate completed orders per user, with masked username, country, totals
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit int DEFAULT 10)
RETURNS TABLE(
  rank int,
  masked_username text,
  country text,
  total_orders int,
  total_spent_inr numeric,
  level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      o.user_id,
      count(*)::int AS total_orders,
      coalesce(sum(o.amount_inr), 0)::numeric AS total_spent_inr
    FROM public.orders o
    WHERE o.status IN ('completed','delivered')
      AND o.user_id IS NOT NULL
      AND o.currency = 'INR'
    GROUP BY o.user_id
  ),
  ranked AS (
    SELECT
      row_number() OVER (ORDER BY a.total_spent_inr DESC, a.total_orders DESC)::int AS rank,
      a.user_id,
      a.total_orders,
      a.total_spent_inr
    FROM agg a
    ORDER BY a.total_spent_inr DESC, a.total_orders DESC
    LIMIT greatest(_limit, 1)
  )
  SELECT
    r.rank,
    -- Mask: first 2 chars + **** (fallback to 'Player')
    CASE
      WHEN p.username IS NOT NULL AND length(p.username) >= 2 THEN substr(p.username, 1, 2) || '****'
      WHEN p.display_name IS NOT NULL AND length(p.display_name) >= 2 THEN substr(p.display_name, 1, 2) || '****'
      ELSE 'Player'
    END AS masked_username,
    coalesce(p.country, '') AS country,
    r.total_orders,
    r.total_spent_inr,
    CASE
      WHEN r.total_spent_inr >= 25000 THEN 'Diamond'
      WHEN r.total_spent_inr >= 10000 THEN 'Platinum'
      WHEN r.total_spent_inr >= 5000 THEN 'Gold'
      WHEN r.total_spent_inr >= 1000 THEN 'Silver'
      ELSE 'Bronze'
    END AS level
  FROM ranked r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  ORDER BY r.rank
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO anon, authenticated;

-- Enable realtime for visitors so counts update live
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_visitors;
