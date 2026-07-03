
-- Restore SECURITY DEFINER stats functions with original bodies
CREATE OR REPLACE FUNCTION public.get_visitor_stats()
RETURNS TABLE(online integer, today integer, total integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.site_visitors WHERE last_seen_at > now() - interval '2 minutes'),
    (SELECT count(*)::int FROM public.site_visitors WHERE first_seen_at::date = (now() AT TIME ZONE 'UTC')::date),
    (SELECT count(*)::int FROM public.site_visitors)
$$;

CREATE OR REPLACE FUNCTION public.get_order_stats()
RETURNS TABLE(successful integer, total_relevant integer, success_rate numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(rank integer, masked_username text, country text, total_orders integer, total_spent_inr numeric, level text)
LANGUAGE sql
STABLE SECURITY DEFINER
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
      a.user_id, a.total_orders, a.total_spent_inr
    FROM agg a
    ORDER BY a.total_spent_inr DESC, a.total_orders DESC
    LIMIT greatest(_limit, 1)
  )
  SELECT
    r.rank,
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

-- Drop the intermediate views that triggered Security Definer View lint
DROP VIEW IF EXISTS public.visitor_stats_v;
DROP VIEW IF EXISTS public.order_stats_v;
DROP VIEW IF EXISTS public.leaderboard_v;

-- Revoke anon EXECUTE on stats functions — signed-in only
REVOKE EXECUTE ON FUNCTION public.get_visitor_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_order_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_visitor_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;
