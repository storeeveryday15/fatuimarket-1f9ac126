
-- 1. Drop obsolete overload (ambiguous, superseded by the browser-aware version)
DROP FUNCTION IF EXISTS public.visitor_heartbeat(text, text, text, text);

-- 2. Leaderboard: clamp request size
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 10)
 RETURNS TABLE(rank integer, masked_username text, country text, total_orders integer, total_spent_inr numeric, level text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH agg AS (
    SELECT o.user_id, count(*)::int AS total_orders,
           coalesce(sum(o.amount_inr), 0)::numeric AS total_spent_inr
    FROM public.orders o
    WHERE o.status IN ('completed','delivered') AND o.user_id IS NOT NULL AND o.currency = 'INR'
    GROUP BY o.user_id
  ),
  ranked AS (
    SELECT row_number() OVER (ORDER BY a.total_spent_inr DESC, a.total_orders DESC)::int AS rank,
           a.user_id, a.total_orders, a.total_spent_inr
    FROM agg a
    ORDER BY a.total_spent_inr DESC, a.total_orders DESC
    LIMIT least(greatest(coalesce(_limit, 10), 1), 50)
  )
  SELECT r.rank,
    CASE
      WHEN p.username IS NOT NULL AND length(p.username) >= 2 THEN substr(p.username, 1, 2) || '****'
      WHEN p.display_name IS NOT NULL AND length(p.display_name) >= 2 THEN substr(p.display_name, 1, 2) || '****'
      ELSE 'Player'
    END,
    coalesce(p.country, ''), r.total_orders, r.total_spent_inr,
    CASE
      WHEN r.total_spent_inr >= 25000 THEN 'Diamond'
      WHEN r.total_spent_inr >= 10000 THEN 'Platinum'
      WHEN r.total_spent_inr >= 5000 THEN 'Gold'
      WHEN r.total_spent_inr >= 1000 THEN 'Silver'
      ELSE 'Bronze'
    END
  FROM ranked r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  ORDER BY r.rank
$function$;

-- 3. Verified buyer: only answer for authors of approved reviews (no arbitrary lookups)
CREATE OR REPLACE FUNCTION public.is_verified_buyer(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.reviews rv WHERE rv.user_id = _user_id AND rv.status = 'approved')
     AND EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = _user_id AND o.status IN ('completed','delivered'))
$function$;

-- 4. Assistant rating: only own recent chats, validated rating
CREATE OR REPLACE FUNCTION public.rate_assistant_chat(_chat_id uuid, _rating smallint)
 RETURNS void
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  UPDATE public.assistant_chats c
     SET rating = _rating
   WHERE c.id = _chat_id
     AND _rating IN (-1, 0, 1)
     AND c.created_at > now() - interval '1 day'
     AND (
       (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
       OR (auth.uid() IS NULL AND c.user_id IS NULL)
     )
$function$;

-- 5. Trigger-only helpers must never be callable through the API
REVOKE ALL ON FUNCTION public.notification_prefs_guard() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.orders_notify_customer() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.orders_sync_inventory() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
