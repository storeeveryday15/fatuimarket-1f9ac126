
-- 1) Replace always-true RLS policies on site_visitors
DROP POLICY IF EXISTS "visitors insert anyone" ON public.site_visitors;
DROP POLICY IF EXISTS "visitors update anyone" ON public.site_visitors;

CREATE POLICY "visitors insert anyone"
ON public.site_visitors
FOR INSERT
TO anon, authenticated
WITH CHECK (
  session_id IS NOT NULL
  AND last_seen_at >= now() - interval '30 seconds'
  AND last_seen_at <= now() + interval '30 seconds'
);

CREATE POLICY "visitors update anyone"
ON public.site_visitors
FOR UPDATE
TO anon, authenticated
USING (session_id IS NOT NULL)
WITH CHECK (
  session_id IS NOT NULL
  AND last_seen_at >= now() - interval '30 seconds'
  AND last_seen_at <= now() + interval '30 seconds'
);

-- 2) Revoke unnecessary EXECUTE on the reviews trigger function
REVOKE ALL ON FUNCTION public.reviews_guard_customer_updates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reviews_guard_customer_updates() FROM anon;
REVOKE ALL ON FUNCTION public.reviews_guard_customer_updates() FROM authenticated;

-- 3) Public-facing aggregate views (owner: postgres) so we can drop
--    SECURITY DEFINER from the stats functions.
CREATE OR REPLACE VIEW public.visitor_stats_v AS
SELECT
  (SELECT count(*)::int FROM public.site_visitors WHERE last_seen_at > now() - interval '2 minutes') AS online,
  (SELECT count(*)::int FROM public.site_visitors WHERE first_seen_at::date = (now() AT TIME ZONE 'UTC')::date) AS today,
  (SELECT count(*)::int FROM public.site_visitors) AS total;

GRANT SELECT ON public.visitor_stats_v TO anon, authenticated;

CREATE OR REPLACE VIEW public.order_stats_v AS
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
FROM s;

GRANT SELECT ON public.order_stats_v TO anon, authenticated;

CREATE OR REPLACE VIEW public.leaderboard_v AS
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
)
SELECT
  row_number() OVER (ORDER BY a.total_spent_inr DESC, a.total_orders DESC)::int AS rank,
  CASE
    WHEN p.username IS NOT NULL AND length(p.username) >= 2 THEN substr(p.username, 1, 2) || '****'
    WHEN p.display_name IS NOT NULL AND length(p.display_name) >= 2 THEN substr(p.display_name, 1, 2) || '****'
    ELSE 'Player'
  END AS masked_username,
  coalesce(p.country, '') AS country,
  a.total_orders,
  a.total_spent_inr,
  CASE
    WHEN a.total_spent_inr >= 25000 THEN 'Diamond'
    WHEN a.total_spent_inr >= 10000 THEN 'Platinum'
    WHEN a.total_spent_inr >= 5000 THEN 'Gold'
    WHEN a.total_spent_inr >= 1000 THEN 'Silver'
    ELSE 'Bronze'
  END AS level
FROM agg a
LEFT JOIN public.profiles p ON p.id = a.user_id
ORDER BY a.total_spent_inr DESC, a.total_orders DESC;

GRANT SELECT ON public.leaderboard_v TO anon, authenticated;

-- 4) Rewrite stats functions as SECURITY INVOKER wrappers over the views
CREATE OR REPLACE FUNCTION public.get_visitor_stats()
RETURNS TABLE(online integer, today integer, total integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT online, today, total FROM public.visitor_stats_v
$$;

CREATE OR REPLACE FUNCTION public.get_order_stats()
RETURNS TABLE(successful integer, total_relevant integer, success_rate numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT successful, total_relevant, success_rate FROM public.order_stats_v
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(rank integer, masked_username text, country text, total_orders integer, total_spent_inr numeric, level text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT rank, masked_username, country, total_orders, total_spent_inr, level
  FROM public.leaderboard_v
  LIMIT greatest(_limit, 1)
$$;
